#!/usr/bin/env node
// Host smoke: loads src/extension.ts with the extension loader of an installed Pi release (default
// ~/.pi/agent/install/releases/1.6.0, or PI_HOST_DIR), opens /autoskills through the registered
// command and renders the panel at 40/80/120 columns with the host's pi-tui keybindings.
//
// State, skills, agents and the project live in a temporary directory (PI_ECOSYSTEM_STATE_ROOT,
// PI_CODING_AGENT_DIR and cwd). Only navigation keys, one read-only action and Esc are sent; no
// setting is saved. It does not start or restart a Pi session and does not touch
// ~/.pi/agent/settings.json.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const hostDir = resolve(
  process.env.PI_HOST_DIR ?? join(homedir(), ".pi", "agent", "install", "releases", "1.6.0"),
);
const modules = join(hostDir, "node_modules", "@earendil-works");
const load = (path) => import(pathToFileURL(path).href);
const { loadExtensions } = await load(
  join(modules, "pi-coding-agent", "dist", "core", "extensions", "loader.js"),
);
const tui = await load(join(modules, "pi-tui", "dist", "index.js"));
const agentVersion = (
  await load(join(modules, "pi-coding-agent", "dist", "config.js")).catch(() => ({}))
).VERSION;

const extension = fileURLToPath(new URL("../src/extension.ts", import.meta.url));
const scratch = await mkdtemp(join(tmpdir(), "autoskills-host-smoke-"));
const saved = {
  cwd: process.cwd(),
  agentDir: process.env.PI_CODING_AGENT_DIR,
  stateRoot: process.env.PI_ECOSYSTEM_STATE_ROOT,
};
const failures = [];
const check = (ok, message) => {
  if (!ok) failures.push(message);
};
try {
  const project = join(scratch, "project");
  const stateRoot = join(scratch, "state");
  await mkdir(project, { recursive: true });
  await mkdir(join(stateRoot, "pi-autoskills"), { recursive: true });
  // Isolated roots: no real user skill or agent is read.
  await writeFile(
    join(stateRoot, "pi-autoskills", "config.json"),
    JSON.stringify({ skillRoots: [join(scratch, "skills")], agentRoots: [join(scratch, "agents")] }),
  );
  const configBefore = await readFile(join(stateRoot, "pi-autoskills", "config.json"), "utf8");
  process.env.PI_CODING_AGENT_DIR = join(scratch, "agent");
  process.env.PI_ECOSYSTEM_STATE_ROOT = stateRoot;
  process.chdir(project);
  const loaded = await loadExtensions([extension], project);
  check(loaded.errors.length === 0, `loader errors: ${JSON.stringify(loaded.errors)}`);
  const ext = loaded.extensions[0];
  // The host binds runtime actions when a session starts; the smoke records chat messages instead.
  const sent = [];
  if (loaded.runtime) loaded.runtime.sendMessage = (message) => sent.push(message);
  const command = ext?.commands.get("autoskills");
  check(!!command, "/autoskills is not registered");
  let component;
  let opened = 0;
  let resolveOpen;
  const open = new Promise((r) => {
    resolveOpen = r;
  });
  const ui = {
    custom: (factory, options) =>
      new Promise((done) => {
        ++opened;
        component = factory(
          { terminal: { rows: 30 }, requestRender() {} },
          { fg: (_c, s) => s, bold: (s) => s },
          tui.getKeybindings(),
          done,
        );
        resolveOpen(options);
      }),
  };
  const ctx = { cwd: project, mode: "tui", hasUI: true, ui, isProjectTrusted: () => true };
  const running = command.handler("", ctx);
  const options = await Promise.race([open, running.then(() => undefined)]);
  check(opened === 1 && !!component, "panel did not open");
  if (component) {
    const settle = async () => {
      for (let i = 0; i < 4; i++) {
        await component.drain?.();
        await new Promise((r) => setImmediate(r));
      }
    };
    for (const width of [40, 80, 120]) {
      const lines = component.render(width);
      const widest = Math.max(...lines.map((l) => tui.visibleWidth(l)));
      check(widest <= width, `width ${width}: line of ${widest} columns`);
      console.log(`--- ${width} columns, ${lines.length} rows, widest ${widest} ---`);
      for (const line of lines) console.log(`|${line}`);
    }
    const first = component.render(80).join("\n");
    check(
      first.includes("AutoSkills") && first.includes("Ctrl+S save") && first.includes("Suggestions"),
      "English panel text missing",
    );
    check(options?.overlayOptions?.minWidth === 40, "overlay options were not passed to ui.custom");
    for (const key of ["\x1b[B", "\x1b[B", "\x1b[B", "\x1b[A"]) {
      component.handleInput(key);
      await settle();
    }
    check(
      component.controller.session.focusedId === "show",
      `focus after ↓↓↓↑: ${component.controller.session.focusedId}`,
    );
    component.handleInput("\r");
    await settle();
    const after = component.render(80).join("\n");
    check(after.includes("Show selected skills completed."), `read-only action did not complete: ${after.split("\n").slice(-4).join(" / ")}`);
    check(sent.length === 1 && sent[0].customType === "pi-autoskills", `chat messages: ${sent.length}`);
    component.handleInput("\x1b");
    await settle();
  }
  await running;
  check(
    (await readFile(join(stateRoot, "pi-autoskills", "config.json"), "utf8")) === configBefore,
    "settings were written",
  );
  for (const handler of ext?.handlers.get("session_shutdown") ?? []) await handler({}, ctx);
  console.log(`host: ${hostDir} (pi-coding-agent ${agentVersion ?? "?"})`);
} finally {
  process.chdir(saved.cwd);
  for (const [key, value] of [
    ["PI_CODING_AGENT_DIR", saved.agentDir],
    ["PI_ECOSYSTEM_STATE_ROOT", saved.stateRoot],
  ])
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  await rm(scratch, { recursive: true, force: true });
}
if (failures.length) {
  for (const f of failures) console.error(`smoke failed: ${f}`);
  process.exitCode = 1;
} else
  console.log(
    "smoke ok: /autoskills panel opened by the host loader, rendered at 40/80/120, ran a read-only action, closed with Esc, no setting written",
  );
