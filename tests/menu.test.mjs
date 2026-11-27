// Drives the real /autoskills panel (vendored Pi settings adapter) by terminal bytes, with the
// real pi-tui KeybindingsManager. Storage and commands are fakes; nothing touches the network.
import test from "node:test";
import assert from "node:assert/strict";
import { getKeybindings, visibleWidth } from "@earendil-works/pi-tui";
import { openMenu } from "../dist/ui/menu.js";
import { catalogs } from "../dist/common/i18n.js";

const KEY = { up: "\x1b[A", down: "\x1b[B", enter: "\r", esc: "\x1b", ctrlS: "\x13", ctrlC: "\x03" };
const ORDER = ["mode", "language", "show", "explain", "detect", "agents", "doctor"];
const GROUPS = {
  Active: ["show"],
  Suggestions: ["explain", "detect"],
  Agents: ["agents"],
  Settings: ["config", "doctor"],
};
const plain = { fg: (_color, text) => text, bold: (text) => text };
const tick = () => new Promise((resolve) => setImmediate(resolve));
const ticks = async (n = 10) => {
  for (let i = 0; i < n; i++) await tick();
};
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
};

function fixture(overrides = {}) {
  const calls = { saveMode: [], saveLocale: [], run: [], show: [], readStored: 0 };
  const stored = { mode: overrides.mode ?? "auto", locale: overrides.locale ?? "en" };
  const owner = new AbortController();
  const overlays = [];
  let panel;
  let closed = false;
  const ui = {
    custom: (factory, options) =>
      new Promise((resolve) => {
        overlays.push(options);
        panel = factory(
          { terminal: { rows: overrides.rows ?? 30 }, requestRender() {} },
          plain,
          getKeybindings(),
          (value) => {
            closed = true;
            resolve(value);
          },
        );
      }),
  };
  const options = {
    ui,
    title: "AutoSkills",
    groups: GROUPS,
    trusted: true,
    locale: stored.locale,
    signal: owner.signal,
    mode: () => stored.mode,
    saveMode: async (mode, signal) => {
      calls.saveMode.push(mode);
      signal?.throwIfAborted();
      stored.mode = mode;
    },
    saveLocale: async (locale, signal) => {
      calls.saveLocale.push(locale);
      signal.throwIfAborted();
      stored.locale = locale;
    },
    readStored: async () => {
      calls.readStored++;
      return { ...stored };
    },
    run: async (action) => {
      calls.run.push(action);
      return { action };
    },
    show: (value) => calls.show.push(value),
    ...overrides.options,
  };
  const task = openMenu(options);
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      await panel.drain();
      await tick();
    }
  };
  const key = async (data) => {
    panel.handleInput(data);
    await settle();
  };
  const keys = async (...data) => {
    for (const d of data) await key(d);
  };
  const focused = () => panel.controller.session.focusedId;
  const goto = async (id) => {
    let at = ORDER.indexOf(focused());
    while (at < ORDER.indexOf(id)) {
      await key(KEY.down);
      at++;
    }
    while (at > ORDER.indexOf(id)) {
      await key(KEY.up);
      at--;
    }
    assert.equal(focused(), id);
  };
  const screen = (width = 100) => panel.render(width).join("\n");
  return {
    task, key, keys, goto, screen, settle, calls, stored, owner, overlays,
    panel: () => panel,
    closed: () => closed,
  };
}

test("root opens at once without IO; fields, grouped actions and hints are visible; clean Esc closes", async () => {
  const f = fixture();
  await tick();
  const s = f.screen(120);
  for (const text of [
    "AutoSkills", "Current mode: Automatic · Current language: English",
    "Mode", "Automatic", "Language", "English",
    "Show selected skills", "Active", "Explain selection", "Detect context", "Suggestions",
    "Agents", "Doctor", "Settings",
    "↑↓ navigate", "Enter edit/open", "Ctrl+S save", "Esc close",
  ]) assert.ok(s.includes(text), `missing ${text}`);
  assert.deepEqual(f.calls, { saveMode: [], saveLocale: [], run: [], show: [], readStored: 0 });
  assert.equal(f.overlays[0].overlay, true);
  assert.equal(f.overlays[0].overlayOptions.anchor, "center");
  // English mode never shows Portuguese product or adapter text.
  const ptOnly = Object.values(catalogs["pt-BR"]).filter((t) => !Object.values(catalogs.en).includes(t));
  for (const text of ptOnly) assert.ok(!s.includes(text), `pt-BR text in English menu: ${text}`);
  assert.doesNotMatch(s, /navegar|fechar|salvar|Ativas|Configurações/);
  await f.key(KEY.esc);
  await f.task;
  assert.equal(f.closed(), true);
  assert.deepEqual(f.calls.saveMode, []);
});

test("mode edits are drafts; Esc in the submenu goes back; Ctrl+S saves and keeps the panel open", async () => {
  const f = fixture();
  await tick();
  await f.key(KEY.enter);
  assert.match(f.screen(), /Observe/);
  assert.match(f.screen(), /Select audited skills when the task context matches\./);
  await f.keys(KEY.down, KEY.esc);
  assert.doesNotMatch(f.screen(), /AutoSkills \*/);
  await f.keys(KEY.enter, KEY.down, KEY.enter);
  assert.match(f.screen(), /AutoSkills \*/);
  assert.match(f.screen(), /Mode\s+Observe/);
  assert.match(f.screen(), /Show matching skills without adding them to the prompt\./);
  assert.deepEqual(f.calls.saveMode, []);
  await f.key(KEY.ctrlS);
  assert.deepEqual(f.calls.saveMode, ["observe"]);
  assert.equal(f.closed(), false);
  assert.match(f.screen(), /Saved mode: Observe\./);
  assert.match(f.screen(), /Current mode: Observe/);
  assert.doesNotMatch(f.screen(), /AutoSkills \*/);
  await f.key(KEY.ctrlS);
  assert.match(f.screen(), /No changes to save\./);
  assert.deepEqual(f.calls.saveMode, ["observe"]);
  await f.key(KEY.esc);
  await f.task;
});

test("dirty Esc warns, second Esc discards and closes without writing", async () => {
  const f = fixture();
  await tick();
  await f.keys(KEY.enter, KEY.down, KEY.down, KEY.enter);
  assert.match(f.screen(), /Mode\s+Off/);
  await f.key(KEY.esc);
  assert.equal(f.closed(), false);
  assert.match(f.screen(), /There are unsaved changes\./);
  assert.match(f.screen(), /Press Esc again to discard the changes and close\./);
  await f.key(KEY.esc);
  await f.task;
  assert.equal(f.closed(), true);
  assert.deepEqual(f.calls.saveMode, []);
  assert.equal(f.stored.mode, "auto");
});

test("failed save keeps the draft with a product message; retry succeeds", async () => {
  let fail = true;
  const f = fixture({
    options: {
      saveMode: async (mode) => {
        if (fail) throw Object.assign(new Error("EISDIR: /secret/path/config.json"), { code: "EISDIR" });
        f.stored.mode = mode;
      },
    },
  });
  await tick();
  await f.keys(KEY.enter, KEY.down, KEY.enter, KEY.ctrlS);
  assert.match(f.screen(), /Could not save mode\. Draft preserved; try again\./);
  assert.doesNotMatch(f.screen(), /secret|EISDIR/);
  assert.match(f.screen(), /AutoSkills \*/);
  assert.match(f.screen(), /Mode\s+Observe/);
  assert.match(f.screen(), /Current mode: Automatic/);
  fail = false;
  await f.key(KEY.ctrlS);
  assert.match(f.screen(), /Saved mode: Observe\./);
  assert.equal(f.stored.mode, "observe");
  await f.key(KEY.esc);
  await f.task;
});

test("Esc during save cancels it and keeps the draft", async () => {
  const f = fixture({
    options: {
      saveMode: (_mode, signal) =>
        new Promise((_, reject) =>
          signal.addEventListener("abort", () => reject(new Error("operation-cancelled")), { once: true }),
        ),
    },
  });
  await tick();
  await f.keys(KEY.enter, KEY.down, KEY.enter);
  f.panel().handleInput(KEY.ctrlS);
  await tick();
  assert.match(f.screen(), /Esc cancel save/);
  await f.key(KEY.esc);
  assert.match(f.screen(), /Save cancelled\. Your draft was kept\./);
  assert.match(f.screen(), /AutoSkills \*/);
  assert.equal(f.closed(), false);
  assert.equal(f.stored.mode, "auto");
  await f.keys(KEY.esc, KEY.esc);
  await f.task;
});

test("an action runs only on Enter, posts to the chat and reports completion", async () => {
  const f = fixture();
  await tick();
  await f.goto("explain");
  assert.deepEqual(f.calls.run, []);
  await f.key(KEY.enter);
  assert.deepEqual(f.calls.run, ["explain"]);
  assert.deepEqual(f.calls.show, [{ action: "explain" }]);
  assert.match(f.screen(), /Explain selection completed\./);
  await f.goto("doctor");
  await f.key(KEY.enter);
  assert.deepEqual(f.calls.run, ["explain", "doctor"]);
  assert.match(f.screen(), /Doctor completed\./);
  await f.key(KEY.esc);
  await f.task;
});

test("Esc cancels a running action; its late result never reaches the chat; the panel stays usable", async () => {
  const pending = deferred();
  let seen;
  const f = fixture({
    options: {
      run: async (action, signal) => {
        seen = signal;
        f.calls.run.push(action);
        return pending.promise;
      },
    },
  });
  await tick();
  await f.goto("agents");
  f.panel().handleInput(KEY.enter);
  await tick();
  assert.match(f.screen(), /Esc cancel operation/);
  await f.key(KEY.esc);
  assert.equal(seen.aborted, true);
  assert.match(f.screen(), /Operation cancelled\./);
  pending.resolve([{ id: "late-agent" }]);
  await f.settle();
  assert.deepEqual(f.calls.show, []);
  assert.doesNotMatch(f.screen(), /late-agent|completed/);
  // Still usable: navigation and a draft edit work after the cancellation.
  await f.goto("mode");
  await f.keys(KEY.enter, KEY.down, KEY.enter);
  assert.match(f.screen(), /AutoSkills \*/);
  await f.keys(KEY.esc, KEY.esc);
  await f.task;
});

test("an action that runs past its deadline reports a timeout, not a cancel, in en and pt-BR", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  for (const [locale, timedOut, cancelled] of [
    ["en", /Show selected skills did not finish in time and was stopped\. Try again, or run Doctor/, /Operation cancelled/],
    ["pt-BR", /Exibir skills selecionadas não terminou a tempo e foi interrompido\. Tente novamente ou execute o Diagnóstico/, /Operação cancelada/],
  ]) {
    const late = deferred();
    let seen;
    const f = fixture({
      locale,
      options: {
        run: (action, signal) => {
          seen = signal;
          f.calls.run.push(action);
          return late.promise;
        },
      },
    });
    await tick();
    await f.goto("show");
    f.panel().handleInput(KEY.enter);
    // drain() waits for the running action, so only plain ticks while it is in flight.
    await ticks();
    t.mock.timers.tick(29_999);
    await ticks();
    assert.equal(seen.aborted, false);
    t.mock.timers.tick(1);
    await f.settle();
    // No key was pressed: the work is told to stop and the panel names the timeout.
    assert.equal(seen.aborted, true);
    assert.match(f.screen(120), timedOut);
    assert.doesNotMatch(f.screen(120), cancelled);
    late.resolve({ late: true });
    await f.settle();
    assert.deepEqual(f.calls.show, []);
    await f.key(KEY.esc);
    await f.task;
  }
  // Doctor keeps its longer deadline.
  const f = fixture({
    options: { run: (_action, signal) => new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))) },
  });
  await tick();
  await f.goto("doctor");
  f.panel().handleInput(KEY.enter);
  await ticks();
  t.mock.timers.tick(60_000);
  await ticks();
  assert.doesNotMatch(f.screen(120), /did not finish in time/);
  t.mock.timers.tick(60_000);
  await f.settle();
  assert.match(f.screen(120), /Doctor did not finish in time/);
  await f.key(KEY.esc);
  await f.task;
});

test("storage failures in actions and at open show recovery text", async () => {
  const { MenuError } = await import("../dist/ui/menu.js");
  const f = fixture({
    options: {
      storageUnavailable: true,
      run: async () => {
        throw new MenuError("storage-unavailable", { cause: new Error("EACCES /secret") });
      },
    },
  });
  await tick();
  assert.match(f.screen(120), /Project storage could not start\. Mode can still be saved; run Doctor/);
  await f.goto("agents");
  await f.key(KEY.enter);
  assert.match(f.screen(120), /Agents needs the project storage, which could not start\. Run Doctor/);
  assert.doesNotMatch(f.screen(120), /EACCES|secret/);
  await f.key(KEY.esc);
  await f.task;
});

test("action failures show translated text without payloads", async () => {
  const f = fixture({
    options: {
      run: async () => {
        throw new Error("migration-in-progress /home/user/.pi/agent/state");
      },
    },
  });
  await tick();
  await f.goto("detect");
  await f.key(KEY.enter);
  assert.match(f.screen(), /Detect context failed\. Try again\./);
  assert.doesNotMatch(f.screen(), /migration-in-progress|\/home\/user/);
  await f.key(KEY.esc);
  await f.task;
});

test("language previews the whole panel in pt-BR; discard reverts; Ctrl+S saves mode and language", async () => {
  const f = fixture();
  await tick();
  await f.goto("language");
  await f.keys(KEY.enter, KEY.down, KEY.enter);
  const pt = f.screen(120);
  for (const text of [
    "AutoSkills *", "Modo atual: Automático · Idioma atual: Inglês", "Modo", "Idioma",
    "Português (Brasil)", "Exibir skills selecionadas", "Ativas", "Sugestões", "Agentes",
    "Diagnóstico", "Configurações", "↑↓ navegar", "Ctrl+S salvar", "Esc fechar",
  ]) assert.ok(pt.includes(text), `missing ${text}`);
  assert.doesNotMatch(pt, /Show selected skills|Current mode|navigate/);
  // Discard: the preview goes back to English.
  await f.key(KEY.esc);
  assert.match(f.screen(), /Há alterações não salvas\./);
  await f.key(KEY.esc);
  await f.task;
  assert.deepEqual(f.calls.saveLocale, []);

  const g = fixture();
  await tick();
  await g.keys(KEY.enter, KEY.down, KEY.enter);
  await g.goto("language");
  await g.keys(KEY.enter, KEY.down, KEY.enter, KEY.ctrlS);
  assert.deepEqual(g.calls.saveMode, ["observe"]);
  assert.deepEqual(g.calls.saveLocale, ["pt-BR"]);
  assert.match(g.screen(), /Modo salvo: Observar\. Idioma salvo para este projeto\./);
  assert.match(g.screen(), /Modo atual: Observar · Idioma atual: Português \(Brasil\)/);
  assert.equal(g.closed(), false);
  await g.key(KEY.esc);
  await g.task;
});

test("a failed language write rolls the saved mode back and keeps the whole draft", async () => {
  const f = fixture({
    options: {
      saveLocale: async () => {
        throw new Error("EACCES");
      },
    },
  });
  await tick();
  await f.keys(KEY.enter, KEY.down, KEY.enter);
  await f.goto("language");
  await f.keys(KEY.enter, KEY.down, KEY.enter, KEY.ctrlS);
  assert.deepEqual(f.calls.saveMode, ["observe", "auto"]);
  assert.equal(f.stored.mode, "auto");
  assert.match(f.screen(), /Não foi possível salvar o idioma\. Nada foi alterado/);
  assert.match(f.screen(), /AutoSkills \*/);
  assert.match(f.screen(), /Modo atual: Automático/);
  await f.keys(KEY.esc, KEY.esc);
  await f.task;
});

test("untrusted projects lock the language field with the reason", async () => {
  const f = fixture({ options: { trusted: false } });
  await tick();
  assert.match(f.screen(120), /\[locked: project trust\]/);
  await f.goto("language");
  await f.key(KEY.enter);
  assert.match(f.screen(120), /Trust this project before saving its language preference\./);
  assert.doesNotMatch(f.screen(120), /Português/);
  await f.key(KEY.esc);
  assert.doesNotMatch(f.screen(), /AutoSkills \*/);
  await f.key(KEY.esc);
  await f.task;
  assert.deepEqual(f.calls.saveLocale, []);
});

test("an unconfirmed save is reconciled from storage instead of being written again", async () => {
  let writes = 0;
  const f = fixture({
    options: {
      // Ignores Esc past the grace period: the outcome is unknown.
      saveMode: (mode) => {
        writes++;
        return new Promise((resolve) =>
          setTimeout(() => {
            f.stored.mode = mode;
            resolve();
          }, 1_300),
        );
      },
    },
  });
  await tick();
  await f.keys(KEY.enter, KEY.down, KEY.enter);
  f.panel().handleInput(KEY.ctrlS);
  await tick();
  await f.key(KEY.esc);
  await new Promise((resolve) => setTimeout(resolve, 1_100));
  await f.settle();
  assert.match(f.screen(), /Save was not confirmed\. Check storage before trying again\./);
  await new Promise((resolve) => setTimeout(resolve, 300));
  await f.key(KEY.ctrlS);
  assert.equal(f.calls.readStored, 1);
  assert.equal(writes, 1);
  assert.match(f.screen(), /Storage checked\./);
  assert.match(f.screen(), /Current mode: Observe/);
  assert.doesNotMatch(f.screen(), /AutoSkills \*/);
  assert.match(f.screen(), /Mode\s+Observe/);
  await f.key(KEY.esc);
  await f.task;
});

test("owner abort closes the menu and waits for work that ignored the signal", async () => {
  const pending = deferred();
  let settled = false;
  const f = fixture({
    options: {
      run: async () => {
        await pending.promise;
        settled = true;
        return { late: true };
      },
    },
  });
  await tick();
  await f.goto("show");
  f.panel().handleInput(KEY.enter);
  await tick();
  f.owner.abort();
  let returned = false;
  f.task.then(() => {
    returned = true;
  });
  await f.settle();
  assert.equal(f.closed(), true);
  assert.equal(returned, false, "menu must wait for its work");
  pending.resolve();
  await f.task;
  assert.equal(settled, true);
  assert.deepEqual(f.calls.show, []);
});

test("Ctrl+C stays with the host; it neither closes nor cancels", async () => {
  const f = fixture();
  await tick();
  await f.keys(KEY.enter, KEY.down, KEY.enter, KEY.ctrlC);
  assert.equal(f.closed(), false);
  assert.match(f.screen(), /AutoSkills \*/);
  await f.keys(KEY.esc, KEY.esc);
  await f.task;
});

test("40/80/120 columns: every line fits, in English and pt-BR, with Unicode labels", async () => {
  for (const locale of ["en", "pt-BR"]) {
    const f = fixture({
      locale,
      options: {
        title: "AutoSkills 技能 🎯 ação",
        groups: { ...GROUPS, "Grupo ñandú 技能 🧪 com um nome bem comprido": ["ação-técnica-技能-🧪-com-rótulo-longo"] },
      },
    });
    await tick();
    const states = [
      () => {},
      () => f.key(KEY.enter),
      () => f.keys(KEY.down, KEY.enter),
      () => f.key(KEY.esc),
    ];
    for (const step of states) {
      await step();
      for (const width of [40, 80, 120]) {
        const lines = f.panel().render(width);
        assert.ok(lines.length > 3);
        for (const line of lines)
          assert.ok(visibleWidth(line) <= width, `${locale} ${width}: ${visibleWidth(line)} > ${width}: ${line}`);
        assert.doesNotMatch(lines.join("\n"), /\x1b\[[0-9;]*m/);
      }
    }
    assert.match(f.screen(120), locale === "en" ? /There are unsaved changes/ : /Há alterações não salvas/);
    await f.key(KEY.esc);
    await f.task;
  }
});

test("below 40 columns the panel asks for a larger terminal instead of overflowing", async () => {
  const f = fixture({ rows: 10 });
  await tick();
  const lines = f.panel().render(30);
  assert.ok(lines.every((line) => visibleWidth(line) <= 30));
  assert.match(lines.join(" "), /Terminal\s+too\s+small/);
  await f.key(KEY.esc);
  await f.task;
});
