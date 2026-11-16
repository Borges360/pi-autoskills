import test from "node:test";
import assert from "node:assert/strict";
import { visibleWidth } from "@earendil-works/pi-tui";
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
  const tui = { ...ctx, mode: "tui", hasUI: true };
  const keybindings = {
    getKeys: (binding) =>
      ({
        "tui.select.confirm": ["enter"],
        "tui.select.cancel": ["escape"],
        "tui.select.up": ["up"],
        "tui.select.down": ["down"],
      })[binding] ?? [],
    matches: (data, binding) =>
      ({
        "tui.select.confirm": "enter",
        "tui.select.cancel": "escape",
        "tui.select.up": "up",
        "tui.select.down": "down",
      })[binding] === data,
  };
  const interactions = [];
  let closedPanels = 0;
  let renderRequests = 0;
  const theme = {
    fg: (_color, value) => value,
    bg: (_color, value) => value,
    bold: (value) => value,
  };
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
        const panel = await factory(
          {
            requestRender: () => renderRequests++,
            terminal: { rows: 24 },
          },
          theme,
          keybindings,
          (action) => {
            closedPanels++;
            finish(action);
          },
        );
        await interaction(panel);
        return await finished;
      },
    },
  };
  const render = (panel, width = 80) =>
    panel
      .render(width)
      .map((line) => line.trimEnd())
      .join("\n");
  const configPath = join(defaults(name).storage.root, "config.json");
  const waitFor = async (predicate, description) => {
    for (let i = 0; i < 50 && !predicate(); i++)
      await new Promise((resolve) => setTimeout(resolve, 0));
    assert.ok(predicate(), description);
  };

  interactions.push(async (panel) => {
    for (const width of [40, 80, 120]) {
      const lines = panel.render(width);
      assert.ok(lines.every((line) => visibleWidth(line) === width));
    }
    assert.match(render(panel), new RegExp(`${displayName}`));
    assert.match(render(panel), /Current mode: Automatic/);
    assert.match(render(panel), /Active/);
    assert.match(render(panel), /Suggestions/);
    assert.match(render(panel), /Agents/);
    assert.match(render(panel), /Settings/);
    await panel.handleInput("enter");
    assert.match(render(panel), /Show selected skills/);
    await panel.handleInput("escape");
    await panel.drain();
    await panel.handleInput("down");
    await panel.handleInput("enter");
    assert.match(render(panel), /Explain selection/);
    assert.match(render(panel), /Detect context/);
    await panel.handleInput("escape");
    await panel.drain();
    await panel.handleInput("down");
    await panel.handleInput("enter");
    assert.match(render(panel), /Agents/);
    await panel.handleInput("escape");
    await panel.drain();
    await panel.handleInput("down");
    await panel.handleInput("enter");
    assert.match(render(panel), /Mode/);
    assert.match(render(panel), /Doctor/);
    await panel.handleInput("escape");
    await panel.drain();
    await panel.handleInput("up");
    await panel.handleInput("up");
    await panel.handleInput("enter");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Explain selection completed\./);
    assert.equal(messages.at(-1).customType, name);
    await panel.close();
  });
  await command.handler("", dashboardTui);

  interactions.push(async (panel) => {
    assert.match(render(panel), /Current mode: Automatic/);
    for (let i = 0; i < 3; i++) await panel.handleInput("down");
    await panel.handleInput("enter");
    assert.match(render(panel), /Mode/);
    assert.match(render(panel), /Doctor/);
    await panel.handleInput("enter");
    assert.match(render(panel), /Automatic/);
    assert.match(render(panel), /Observe/);
    await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Draft mode: Observe/);
    const savedBeforeFailure = await readFile(configPath, "utf8");
    assert.equal(JSON.parse(savedBeforeFailure).mode, "auto");
    await rm(configPath, { force: true });
    await mkdir(configPath);
    await panel.handleInput("\u0013");
    await waitFor(
      () => render(panel).includes("Could not save mode. Draft preserved"),
      "failed config write should preserve the mode draft",
    );
    assert.match(render(panel), /Current mode: Automatic/);
    assert.match(render(panel), /Draft mode: Observe/);
    await rm(configPath, { recursive: true, force: true });
    await writeFile(configPath, savedBeforeFailure);
    await panel.handleInput("\u0013");
    await panel.drain();
    assert.match(render(panel), /Saved mode: Observe/);
    const saved = JSON.parse(await readFile(configPath, "utf8"));
    assert.equal(saved.mode, "observe");
    assert.equal(saved.enabled, true);
    await panel.close();
  });
  await command.handler("config", dashboardTui);

  interactions.push(async (panel) => {
    for (let i = 0; i < 3; i++) await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.handleInput("enter");
    await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Draft mode: Off/);
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).mode, "observe");
    await panel.handleInput("escape");
    assert.match(render(panel), /Unsaved changes/);
    await panel.handleInput("escape");
    assert.equal(JSON.parse(await readFile(configPath, "utf8")).mode, "observe");
  });
  await command.handler("", dashboardTui);

  interactions.push(async (panel) => {
    for (let i = 0; i < 3; i++) await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Doctor completed\./);
    assert.match(messages.at(-1).content, /storage/);
    await panel.close();
  });
  await command.handler("", dashboardTui);

  const priorMessages = messages.length;
  interactions.push(async (panel) => {
    await panel.close();
  });
  await command.handler("", dashboardTui);

  projectTrusted = true;
  const openLanguageChoices = async (panel) => {
    for (let i = 0; i < 3; i++) await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.handleInput("down");
    await panel.handleInput("down");
    await panel.handleInput("enter");
  };
  const projectLocalePath = join(cwd, ".pi", "pi-autoskills.locale.json");
  interactions.push(async (panel) => {
    assert.match(render(panel), /Current language: English/);
    await openLanguageChoices(panel);
    assert.match(render(panel), /English/);
    assert.match(render(panel), /Português \(Brasil\)/);
    await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Rascunho do idioma: Português \(Brasil\)/);
    for (const width of [40, 80, 120])
      assert.ok(panel.render(width).every((line) => visibleWidth(line) === width));
    assert.match(render(panel), /Ativas/);
    assert.match(render(panel), /Configurações/);
    assert.match(render(panel), /↑↓ navegar/);
    await panel.handleInput("enter");
    assert.match(render(panel), /Modo/);
    assert.match(render(panel), /Diagnóstico/);
    assert.match(render(panel), /Idioma/);
    await panel.handleInput("escape");
    await panel.drain();
    for (let i = 0; i < 3; i++) await panel.handleInput("up");
    await panel.handleInput("enter");
    assert.match(render(panel), /Exibir skills selecionadas/);
    await panel.handleInput("escape");
    await panel.drain();
    await assert.rejects(readFile(projectLocalePath, "utf8"), { code: "ENOENT" });
    await panel.handleInput("escape");
    assert.match(render(panel), /Há alterações sem salvar/);
    assert.match(render(panel), /Rascunho do idioma: Português \(Brasil\)/);
    await panel.handleInput("escape");
    await assert.rejects(readFile(projectLocalePath, "utf8"), { code: "ENOENT" });
  });
  await command.handler("", dashboardTui);

  interactions.push(async (panel) => {
    assert.match(render(panel), /Current language: English/);
    await openLanguageChoices(panel);
    await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Rascunho do idioma: Português \(Brasil\)/);
    await panel.handleInput("\u0013");
    await waitFor(
      () => render(panel).includes("Idioma salvo para este projeto."),
      "Ctrl+S should persist the trusted project's language preference",
    );
    await panel.drain();
    assert.equal(JSON.parse(await readFile(projectLocalePath, "utf8")).locale, "pt-BR");
    await panel.close();
  });
  await command.handler("", dashboardTui);

  interactions.push(async (panel) => {
    assert.match(render(panel), /Idioma atual: Português \(Brasil\)/);
    assert.match(render(panel), /Configurações/);
    await panel.close();
  });
  await command.handler("", dashboardTui);

  const otherCwd = join(root, "other-project");
  await mkdir(otherCwd);
  interactions.push(async (panel) => {
    assert.match(render(panel), /Current language: English/);
    assert.match(render(panel), /Settings/);
    await panel.close();
  });
  await command.handler("", { ...dashboardTui, cwd: otherCwd });

  const untrustedCwd = join(root, "untrusted-project");
  await mkdir(join(untrustedCwd, ".pi"), { recursive: true });
  const untrustedLocalePath = join(untrustedCwd, ".pi", "pi-autoskills.locale.json");
  await writeFile(untrustedLocalePath, JSON.stringify({ schemaVersion: 1, locale: "pt-BR" }));
  const untrustedLocaleBefore = await readFile(untrustedLocalePath, "utf8");
  projectTrusted = false;
  interactions.push(async (panel) => {
    assert.match(render(panel), /Current language: English/);
    await openLanguageChoices(panel);
    await panel.handleInput("down");
    await panel.handleInput("enter");
    await panel.drain();
    assert.match(render(panel), /Rascunho do idioma: Português \(Brasil\)/);
    await panel.handleInput("\u0013");
    await waitFor(
      () => render(panel).includes("Confie neste projeto antes de salvar a preferência de idioma."),
      "untrusted projects must not save locale preferences",
    );
    assert.equal(await readFile(untrustedLocalePath, "utf8"), untrustedLocaleBefore);
    assert.match(render(panel), /Rascunho do idioma: Português \(Brasil\)/);
    await panel.close();
  });
  await command.handler("", { ...dashboardTui, cwd: untrustedCwd });

  assert.equal(messages.length, priorMessages);
  assert.equal(closedPanels, 10);
  assert.deepEqual([...commands.keys()], registeredCommandNames);
  assert.deepEqual([...tools.keys()].sort(), registeredToolNames);
  assert.ok(renderRequests > 0);
});
