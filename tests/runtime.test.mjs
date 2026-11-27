import test from "node:test";
import assert from "node:assert/strict";
import { getKeybindings, visibleWidth } from "@earendil-works/pi-tui";
import { mkdtemp, rm, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Interop, envelope } from "../dist/common/contracts.js";
import { localBus } from "../dist/common/cli.js";
import { defaults, validateConfig } from "../dist/common/config.js";
import extension from "../dist/extension.js";
const name = JSON.parse(
  await (
    await import("node:fs/promises")
  ).readFile(new URL("../package.json", import.meta.url), "utf8"),
)
  .name.split("/")
  .at(-1);
const displayName =
  {
    "pi-autoskills": "AutoSkills",
    "pi-autoplan": "AutoPlan",
    "pi-subagent-router": "Subagent Router",
    "pi-mcp-router": "MCP Router",
  }[name] ?? name;
test("event bus ignores duplicates, future schemas, old events and isolates consumer failures", async () => {
  const bus = localBus();
  const a = new Interop("a", bus, "project");
  let count = 0;
  a.listen("test.v1", () => {
    count++;
  });
  const e = envelope("b", "test.v1", {}, { projectKey: "project" });
  bus.emit("test.v1", e);
  bus.emit("test.v1", e);
  bus.emit("test.v1", { ...e, eventId: "future", schemaVersion: 2 });
  bus.emit("test.v1", {
    ...e,
    eventId: "old",
    emittedAt: "2000-01-01T00:00:00Z",
  });
  assert.equal(count, 1);
  a.listen("failure.v1", async () => {
    throw new Error("offline");
  });
  bus.emit(
    "failure.v1",
    envelope("b", "failure.v1", {}, { projectKey: "project" }),
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(a.failures, 1);
  a.close();
});
test("capability discovery works regardless of startup order and removal", () => {
  const bus = localBus();
  const a = new Interop("a", bus, "p"),
    b = new Interop("b", bus, "p");
  a.start(["one"]);
  b.start(["two"]);
  assert.equal(a.healthy("b", "two"), true);
  assert.equal(b.healthy("a", "one"), true);
  b.close();
  a.close();
});
test("safe configuration rejects model escalation and malformed numeric values", () => {
  const c = defaults(name);
  assert.equal(c.storage.backend, "files");
  assert.throws(() => validateConfig({ ...c, assistantClaims: true }));
  assert.throws(() => validateConfig({ ...c, requireApproval: false }));
  assert.throws(() => validateConfig({ ...c, maxParallel: Infinity }));
  assert.throws(() =>
    validateConfig({ ...c, compactAtRatio: 0.9, handoffAtRatio: 0.7 }),
  );
});
test("extension loads independently and all discovery commands work without TUI", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "pi-extension-test-"));
  process.env.PI_ECOSYSTEM_STATE_ROOT = join(root, "state");
  await mkdir(join(root, "cwd"));
  const cwd = join(root, "cwd");
  let projectTrusted = false;
  const handlers = new Map(),
    commands = new Map(),
    tools = new Map(),
    messages = [];
  let active = ["read", "write", "mcp__untrusted__drop"];
  const pi = {
    events: localBus(),
    on: (n, f) => {
      handlers.set(n, f);
      return () => handlers.delete(n);
    },
    registerCommand: (n, d) => commands.set(n, d),
    registerTool: (t) => {
      tools.set(t.name, t);
    },
    sendMessage: (m) => messages.push(m),
    getAllTools: () => [
      { name: "read" },
      { name: "write" },
      {
        name: "mcp__untrusted__drop",
        namespace: { name: "mcp__untrusted" },
        annotations: { readOnlyHint: true },
      },
    ],
    getActiveTools: () => active,
    setActiveTools: (tools) => {
      active = tools;
    },
    registerMcpServer: () => {},
    unregisterMcpServer: () => {},
  };
  extension(pi);
  assert.equal(commands.size, 1);
  assert.ok(tools.size >= 1);
  const registeredCommandNames = [...commands.keys()];
  const registeredToolNames = [...tools.keys()].sort();
  assert.equal(messages.length, 0);
  const ctx = {
    cwd,
    mode: "print",
    hasUI: false,
    ui: new Proxy(
      {},
      {
        get: () => () => {
          throw new Error("TUI accessed headlessly");
        },
      },
    ),
    isProjectTrusted: () => projectTrusted,
    getContextUsage: () => undefined,
    compact: () => {},
    signal: undefined,
    isIdle: () => true,
    hasPendingMessages: () => false,
    abort: () => {},
    shutdown: () => {},
    getSystemPrompt: () => "",
    sessionManager: {},
    modelRegistry: {},
    model: undefined,
  };
  await handlers.get("session_start")?.({}, ctx);
  t.after(async () => {
    await handlers.get("session_shutdown")?.({}, ctx);
    await rm(root, { recursive: true, force: true });
    delete process.env.PI_ECOSYSTEM_STATE_ROOT;
  });
  const command = [...commands.values()][0];
  for (const action of ["status", "explain", "config", "doctor", "off", "auto"])
    await command.handler(action, ctx);
  assert.ok(messages.length >= 6);
  assert.equal(JSON.parse(messages.at(-1).content).enabled, true);
  await handlers.get("before_agent_start")?.(
    { messageType: "user", prompt: "Explain a small function" },
    ctx,
  );
  // Interactive menu: the real vendored Pi panel, driven by terminal bytes with the real pi-tui
  // KeybindingsManager, through the registered command handler.
  const KEY = { up: "\x1b[A", down: "\x1b[B", enter: "\r", esc: "\x1b", ctrlS: "\x13" };
  const ORDER = ["mode", "language", "show", "explain", "detect", "agents", "doctor"];
  const tui = { ...ctx, mode: "tui", hasUI: true };
  const interactions = [];
  let closedPanels = 0;
  let renderRequests = 0;
  const theme = { fg: (_color, value) => value, bold: (value) => value };
  const dashboardTui = {
    ...tui,
    ui: {
      custom: async (factory, options) => {
        assert.equal(options.overlay, true);
        assert.equal(options.overlayOptions.anchor, "center");
        const interaction = interactions.shift();
        assert.equal(typeof interaction, "function", "unexpected settings panel");
        let finish;
        const finished = new Promise((resolve) => {
          finish = resolve;
        });
        const panel = factory(
          { requestRender: () => renderRequests++, terminal: { rows: 24 } },
          theme,
          getKeybindings(),
          (action) => {
            closedPanels++;
            finish(action);
          },
        );
        const tick = () => new Promise((resolve) => setImmediate(resolve));
        const settle = async () => {
          for (let i = 0; i < 6; i++) {
            await panel.drain();
            await tick();
          }
        };
        const driver = {
          panel,
          render: (width = 100) => panel.render(width).join("\n"),
          key: async (...data) => {
            for (const d of data) {
              panel.handleInput(d);
              await settle();
            }
          },
          goto: async (id) => {
            let at = ORDER.indexOf(panel.controller.session.focusedId);
            for (; at < ORDER.indexOf(id); at++) await driver.key(KEY.down);
            for (; at > ORDER.indexOf(id); at--) await driver.key(KEY.up);
            assert.equal(panel.controller.session.focusedId, id);
          },
          settle,
        };
        await interaction(driver);
        return await finished;
      },
    },
  };
  const configPath = join(defaults(name).storage.root, "config.json");
  const fits = (p) => {
    for (const width of [40, 80, 120])
      for (const line of p.panel.render(width))
        assert.ok(visibleWidth(line) <= width, `${width}: ${line}`);
  };

  interactions.push(async (p) => {
    fits(p);
    const s = p.render(120);
    assert.match(s, new RegExp(displayName));
    for (const text of ["Current mode: Automatic", "Active", "Suggestions", "Agents", "Settings",
      "Show selected skills", "Explain selection", "Detect context", "Doctor", "Mode", "Language"])
      assert.ok(s.includes(text), `missing ${text}`);
    await p.goto("explain");
    await p.key(KEY.enter);
    assert.match(p.render(), /Explain selection completed\./);
    assert.equal(messages.at(-1).customType, name);
    await p.key(KEY.esc);
  });
  await command.handler("", dashboardTui);

  interactions.push(async (p) => {
    assert.match(p.render(), /Current mode: Automatic/);
    await p.key(KEY.enter);
    assert.match(p.render(), /Automatic/);
    assert.match(p.render(), /Observe/);
    await p.key(KEY.down, KEY.enter);
    assert.match(p.render(), new RegExp(`${displayName} \\*`));
    assert.match(p.render(), /Mode\s+Observe/);
    const savedBeforeFailure = await readFile(configPath, "utf8");
    assert.equal(JSON.parse(savedBeforeFailure).mode, "auto");
    await rm(configPath, { force: true });
    await mkdir(configPath);
    await p.key(KEY.ctrlS);
    assert.match(p.render(), /Could not save mode\. Draft preserved; try again\./);
    assert.match(p.render(), /Current mode: Automatic/);
    assert.match(p.render(), /Mode\s+Observe/);
    await rm(configPath, { recursive: true, force: true });
    await writeFile(configPath, savedBeforeFailure);
    await p.key(KEY.ctrlS);
    assert.match(p.render(), /Saved mode: Observe\./);
    assert.match(p.render(), /Current mode: Observe/);
    const saved = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(saved.mode, "observe");
    assert.equal(saved.enabled, true);
    await p.key(KEY.esc);
  });
  await command.handler("config", dashboardTui);

  interactions.push(async (p) => {
    await p.key(KEY.enter, KEY.down, KEY.enter);
    assert.match(p.render(), /Mode\s+Off/);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).mode, "observe");
    await p.key(KEY.esc);
    assert.match(p.render(), /There are unsaved changes/);
    await p.key(KEY.esc);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).mode, "observe");
  });
  await command.handler("", dashboardTui);

  interactions.push(async (p) => {
    await p.goto("doctor");
    await p.key(KEY.enter);
    assert.match(p.render(), /Doctor completed\./);
    assert.match(messages.at(-1).content, /storage/);
    await p.key(KEY.esc);
  });
  await command.handler("", dashboardTui);

  const priorMessages = messages.length;
  interactions.push(async (p) => {
    await p.key(KEY.esc);
  });
  await command.handler("", dashboardTui);

  projectTrusted = true;
  const projectLocalePath = join(cwd, ".pi", "pi-autoskills.locale.json");
  const choosePortuguese = async (p) => {
    await p.goto("language");
    await p.key(KEY.enter);
    assert.match(p.render(), /English/);
    assert.match(p.render(), /Português \(Brasil\)/);
    await p.key(KEY.down, KEY.enter);
  };
  interactions.push(async (p) => {
    assert.match(p.render(), /Current language: English/);
    await choosePortuguese(p);
    fits(p);
    const s = p.render(120);
    for (const text of ["Idioma atual: Inglês", "Português (Brasil)", "Ativas", "Configurações",
      "Exibir skills selecionadas", "Diagnóstico", "↑↓ navegar"])
      assert.ok(s.includes(text), `missing ${text}`);
    await assert.rejects(readFile(projectLocalePath, "utf8"), { code: "ENOENT" });
    await p.key(KEY.esc);
    assert.match(p.render(), /Há alterações não salvas/);
    await p.key(KEY.esc);
    await assert.rejects(readFile(projectLocalePath, "utf8"), { code: "ENOENT" });
  });
  await command.handler("", dashboardTui);

  interactions.push(async (p) => {
    assert.match(p.render(), /Current language: English/);
    await choosePortuguese(p);
    await p.key(KEY.ctrlS);
    assert.match(p.render(), /Idioma salvo para este projeto\./);
    assert.equal(JSON.parse(await readFile(projectLocalePath, "utf8")).locale, "pt-BR");
    await p.key(KEY.esc);
  });
  await command.handler("", dashboardTui);

  interactions.push(async (p) => {
    assert.match(p.render(), /Idioma atual: Português \(Brasil\)/);
    assert.match(p.render(), /Configurações/);
    await p.key(KEY.esc);
  });
  await command.handler("", dashboardTui);

  const otherCwd = join(root, "other-project");
  await mkdir(otherCwd);
  interactions.push(async (p) => {
    assert.match(p.render(), /Current language: English/);
    assert.match(p.render(), /Settings/);
    await p.key(KEY.esc);
  });
  await command.handler("", { ...dashboardTui, cwd: otherCwd });

  const untrustedCwd = join(root, "untrusted-project");
  await mkdir(join(untrustedCwd, ".pi"), { recursive: true });
  const untrustedLocalePath = join(untrustedCwd, ".pi", "pi-autoskills.locale.json");
  await writeFile(untrustedLocalePath, JSON.stringify({ schemaVersion: 1, locale: "pt-BR" }));
  const untrustedLocaleBefore = await readFile(untrustedLocalePath, "utf8");
  projectTrusted = false;
  interactions.push(async (p) => {
    assert.match(p.render(), /Current language: English/);
    assert.match(p.render(120), /\[locked: project trust\]/);
    await p.goto("language");
    await p.key(KEY.enter);
    assert.match(p.render(), /Trust this project before saving its language preference\./);
    await p.key(KEY.esc, KEY.ctrlS);
    assert.equal(await readFile(untrustedLocalePath, "utf8"), untrustedLocaleBefore);
    await p.key(KEY.esc);
  });
  await command.handler("", { ...dashboardTui, cwd: untrustedCwd });

  // Shutdown while the menu is open closes it through the owner signal.
  projectTrusted = true;
  let shutdown;
  interactions.push(async (p) => {
    await p.settle();
    // Not awaited here: shutdown waits for the menu, which waits for this panel to close.
    shutdown = handlers.get("session_shutdown")?.({}, ctx);
  });
  await command.handler("", dashboardTui);
  await shutdown;
  await handlers.get("session_start")?.({}, ctx);

  assert.equal(messages.length, priorMessages);
  assert.equal(closedPanels, 11);
  assert.deepEqual([...commands.keys()], registeredCommandNames);
  assert.deepEqual([...tools.keys()].sort(), registeredToolNames);
  assert.ok(renderRequests > 0);
});
