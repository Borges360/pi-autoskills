// The /autoskills command through the real extension entry: one menu at a time, and the menu,
// Mode and Doctor stay reachable when project storage cannot start.
import test from "node:test";
import assert from "node:assert/strict";
import { getKeybindings } from "@earendil-works/pi-tui";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = await mkdtemp(join(tmpdir(), "pi-autoskills-runtime-menu-"));
process.env.PI_ECOSYSTEM_STATE_ROOT = join(root, "state");
const { localBus } = await import("../dist/common/cli.js");
const { defaults } = await import("../dist/common/config.js");
const { projectKey } = await import("../dist/common/security.js");
const { default: extension } = await import("../dist/extension.js");
test.after(() => rm(root, { recursive: true, force: true }));

const KEY = { up: "\x1b[A", down: "\x1b[B", enter: "\r", esc: "\x1b", ctrlS: "\x13" };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const wait = async (until, label) => {
  for (let i = 0; i < 400; i++) {
    if (until()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail(`timed out waiting for ${label}`);
};

function setup(cwd, panels) {
  const handlers = new Map();
  const commands = new Map();
  const messages = [];
  extension({
    events: localBus(),
    on: (name, fn) => {
      handlers.set(name, fn);
      return () => {};
    },
    registerCommand: (name, definition) => commands.set(name, definition),
    registerTool: () => {},
    sendMessage: (message) => messages.push(message),
    getAllTools: () => [],
    getActiveTools: () => [],
    setActiveTools: () => {},
    registerMcpServer: () => {},
    unregisterMcpServer: () => {},
  });
  const base = {
    cwd,
    isProjectTrusted: () => true,
    signal: undefined,
    getContextUsage: () => undefined,
    compact() {},
    isIdle: () => true,
    hasPendingMessages: () => false,
    abort() {},
    shutdown() {},
    getSystemPrompt: () => "",
    sessionManager: {},
    modelRegistry: {},
    model: undefined,
  };
  const tui = {
    ...base,
    mode: "tui",
    hasUI: true,
    ui: {
      custom: (factory) =>
        new Promise((resolve) => {
          const panel = factory(
            { requestRender() {}, terminal: { rows: 30 } },
            { fg: (_color, text) => text, bold: (text) => text },
            getKeybindings(),
            resolve,
          );
          panels.push(panel);
        }),
    },
  };
  const headless = { ...base, mode: "print", hasUI: false, ui: {} };
  return { handlers, command: [...commands.values()][0], messages, tui, headless };
}
const driver = (panel) => {
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await panel.drain();
      await tick();
    }
  };
  return {
    screen: () => panel.render(120).join("\n"),
    key: async (...data) => {
      for (const d of data) {
        panel.handleInput(d);
        await settle();
      }
    },
    focused: () => panel.controller.session.focusedId,
  };
};

test("two /autoskills issued back to back open one menu; shutdown waits for it", async () => {
  const cwd = join(root, "race");
  await mkdir(cwd);
  const panels = [];
  const { handlers, command, tui } = setup(cwd, panels);
  await handlers.get("session_start")({}, tui);
  // Neither call is awaited before the next one: both pass the "already open" check together
  // unless the slot is claimed before the first await.
  const first = command.handler("", tui);
  const second = command.handler("", tui);
  await second;
  await wait(() => panels.length === 1, "the first panel");
  await new Promise((resolve) => setTimeout(resolve, 50));
  assert.equal(panels.length, 1);
  // A third one while the menu is open does nothing either.
  await command.handler("", tui);
  assert.equal(panels.length, 1);
  // Shutdown closes the open menu through the owner signal and waits for it.
  let shutdownDone = false;
  const shutdown = handlers.get("session_shutdown")({}, tui).then(() => {
    shutdownDone = true;
  });
  let firstDone = false;
  first.then(() => {
    firstDone = true;
  });
  await shutdown;
  await tick();
  assert.equal(shutdownDone, true);
  assert.equal(firstDone, true, "shutdown returned before the open menu settled");
  // After the menu closed, a new /autoskills opens a new one.
  await handlers.get("session_start")({}, tui);
  const again = command.handler("", tui);
  await wait(() => panels.length === 2, "a new panel");
  await driver(panels[1]).key(KEY.esc);
  await again;
  await handlers.get("session_shutdown")({}, tui);
});

test("a corrupt storage pointer still opens the menu; Mode saves, Doctor explains, actions guide", async () => {
  const cwd = join(root, "broken");
  await mkdir(cwd);
  const panels = [];
  const { handlers, command, messages, tui, headless } = setup(cwd, panels);
  await handlers.get("session_start")({}, tui);
  await handlers.get("session_shutdown")({}, tui);
  const stateRoot = defaults("pi-autoskills").storage.root;
  const key = await projectKey(cwd);
  assert.ok((await readdir(join(stateRoot, "projects"))).includes(key));
  const pointer = join(stateRoot, "projects", key, "backend.json");
  await writeFile(pointer, "{not json");

  // Headless doctor reports the cause instead of throwing.
  await command.handler("doctor", headless);
  const report = JSON.parse(messages.at(-1).content);
  assert.equal(report.storage, "unavailable");
  assert.equal(report.startup.ok, false);
  assert.equal(report.startup.reason, "storage-pointer-invalid");
  assert.equal(report.startup.file, pointer);
  assert.match(report.startup.recovery, /Do not delete it/);
  // Other headless commands still need storage and say so.
  await assert.rejects(command.handler("status", headless));

  const run = command.handler("", tui);
  await wait(() => panels.length === 1, "the menu with broken storage");
  const p = driver(panels[0]);
  for (const text of ["Project storage could not start", "Mode", "Language", "Show selected skills", "Doctor"])
    assert.ok(p.screen().includes(text), `missing ${text}`);
  // An action that needs storage explains what to do.
  while (p.focused() !== "agents") await p.key(KEY.down);
  await p.key(KEY.enter);
  assert.match(p.screen(), /Agents needs the project storage, which could not start\. Run Doctor/);
  // Doctor runs and posts the diagnosis.
  const before = messages.length;
  await p.key(KEY.down, KEY.enter);
  await wait(() => messages.length === before + 1, "the doctor report");
  assert.match(p.screen(), /Doctor completed\./);
  assert.equal(JSON.parse(messages.at(-1).content).startup.reason, "storage-pointer-invalid");
  // Mode is saved in the user configuration, which does not need storage.
  while (p.focused() !== "mode") await p.key(KEY.up);
  await p.key(KEY.enter, KEY.down, KEY.enter, KEY.ctrlS);
  assert.match(p.screen(), /Saved mode: Observe\./);
  const saved = JSON.parse(await readFile(join(stateRoot, "config.json"), "utf8"));
  assert.equal(saved.mode, "observe");
  assert.equal(await readFile(pointer, "utf8"), "{not json", "doctor and the menu never rewrite the pointer");
  await p.key(KEY.esc);
  await run;
  await handlers.get("session_shutdown")({}, tui);
});
