import assert from "node:assert/strict";
import { test } from "node:test";
import { SettingsPanel } from "../dist/ui/settings-panel.js";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";

const keybindings = {
  matches: (data, binding) =>
    ({
      "tui.select.confirm": "enter",
      "tui.select.cancel": "escape",
      "tui.select.up": "up",
      "tui.select.down": "down",
    })[binding] === data,
};
const theme = {
  fg: (_color, value) => value,
  bg: (_color, value) => value,
  bold: (value) => value,
};
const waitFor = async (predicate) => {
  for (let i = 0; i < 50 && !predicate(); i++)
    await new Promise((resolve) => setTimeout(resolve, 0));
  assert.ok(predicate(), "condition did not settle");
};
function createPanel({ rows, dirty = () => false, save = async () => {}, messages, initialStatus }) {
  const controller = new AbortController();
  const reports = [];
  const done = [];
  let renderRequests = 0;
  const panel = new SettingsPanel(
    {
      title: "Settings — Pi 🐿️",
      summary: () => "Résumé — Unicode stays readable",
      rows,
      dirty,
      signal: controller.signal,
      save,
      messages,
      initialStatus,
      formatError: () => "Save failed; draft preserved.",
    },
    theme,
    keybindings,
    () => renderRequests++,
    (action) => done.push(action),
  );
  return {
    panel,
    controller,
    reports,
    done,
    get renderRequests() {
      return renderRequests;
    },
  };
}

test("panel renders Unicode safely at narrow and wide terminal sizes", () => {
  const state = createPanel({
    rows: [
      {
        id: "unicode",
        label: "配置 — Automação 🐿️",
        value: () => "pronto",
        description: "Résumé — 東京 — ação segura",
        activate: () => {},
      },
    ],
  });
  try {
    for (const width of [40, 80, 120]) {
      const lines = state.panel.render(width);
      assert.ok(lines.every((line) => visibleWidth(line) === width));
      assert.ok(lines.every((line) => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(stripTerminalSequences(line))));
    }
  } finally {
    state.panel.dispose();
  }
});

test("selection edits only a draft; Esc warns and discards without saving", async () => {
  let draft = "auto";
  let saves = 0;
  const state = createPanel({
    rows: [
      {
        id: "mode",
        label: "Mode — modo",
        value: () => draft,
        description: "Choose a mode",
        activate: async (api) => {
          const selected = await api.choose(
            "Choose mode",
            [
              { value: "auto", label: "Automatic" },
              { value: "observe", label: "Observe" },
              { value: "off", label: "Off" },
            ],
            draft,
          );
          if (selected) draft = selected;
        },
      },
    ],
    dirty: () => draft !== "auto",
    save: async () => {
      saves++;
    },
  });
  try {
    await state.panel.handleInput("enter");
    await state.panel.handleInput("down");
    await state.panel.handleInput("enter");
    await state.panel.drain();
    assert.equal(draft, "observe");
    assert.equal(saves, 0);
    await state.panel.handleInput("escape");
    assert.match(state.panel.render(80).join("\n"), /Unsaved changes/);
    await state.panel.handleInput("escape");
    assert.equal(saves, 0);
    assert.deepEqual(state.done, [undefined]);
  } finally {
    state.panel.dispose();
  }
});

test("input edits remain a draft until Ctrl+S", async () => {
  let draft = "name";
  let persisted = "before";
  const state = createPanel({
    rows: [
      {
        id: "name",
        label: "Name",
        value: () => draft,
        description: "Edit the value",
        activate: async (api) => {
          const value = await api.input("Name", draft);
          if (value !== undefined) draft = value;
        },
      },
    ],
    dirty: () => draft !== persisted,
    save: async () => {
      persisted = draft;
    },
  });
  try {
    await state.panel.handleInput("enter");
    await state.panel.handleInput("!");
    await state.panel.handleInput("enter");
    await state.panel.drain();
    assert.equal(draft, "name!");
    assert.equal(persisted, "before");
    await state.panel.handleInput("\u0013");
    await state.panel.drain();
    assert.equal(persisted, "name!");
  } finally {
    state.panel.dispose();
  }
});

test("Ctrl+S saves a draft; failed save preserves it for retry", async () => {
  let draft = "observe";
  let fail = true;
  let persisted = "auto";
  const state = createPanel({
    rows: [
      {
        id: "mode",
        label: "Mode",
        value: () => draft,
        description: "Save when ready",
        activate: () => {},
      },
    ],
    dirty: () => draft !== persisted,
    save: async (_api, signal) => {
      signal.throwIfAborted();
      if (fail) throw new Error("synthetic save error");
      persisted = draft;
    },
  });
  try {
    await state.panel.handleInput("\u0013");
    await state.panel.drain();
    assert.equal(persisted, "auto");
    assert.equal(draft, "observe");
    assert.match(state.panel.render(80).join("\n"), /Save failed; draft preserved/);
    fail = false;
    await state.panel.handleInput("\u0013");
    await state.panel.drain();
    assert.equal(persisted, "observe");
    assert.equal(draft, "observe");
  } finally {
    state.panel.dispose();
  }
});

test("Esc cancels a running action and leaves the panel responsive", async () => {
  let canceled = false;
  const state = createPanel({
    rows: [
      {
        id: "run",
        label: "Run action",
        value: () => "ready",
        description: "Cancelable action",
        activate: async (_api, signal) =>
          await new Promise((_resolve, reject) => {
            signal.addEventListener(
              "abort",
              () => {
                canceled = true;
                reject(new Error("cancelled"));
              },
              { once: true },
            );
          }),
      },
    ],
  });
  try {
    await state.panel.handleInput("enter");
    await state.panel.handleInput("escape");
    await state.panel.drain();
    assert.equal(canceled, true);
    assert.match(state.panel.render(80).join("\n"), /Operation canceled/);
    assert.deepEqual(state.done, []);
    await state.panel.handleInput("escape");
    assert.deepEqual(state.done, [undefined]);
  } finally {
    state.panel.dispose();
  }
});

test("a result arriving after dispose does not render or update the closed panel", async () => {
  let resolveAction;
  const state = createPanel({
    rows: [
      {
        id: "late",
        label: "Late action",
        value: () => "pending",
        description: "Ignore after close",
        activate: () =>
          new Promise((resolve) => {
            resolveAction = resolve;
          }),
      },
    ],
  });
  await state.panel.handleInput("enter");
  await waitFor(() => typeof resolveAction === "function");
  const beforeClose = state.renderRequests;
  state.panel.close("closed");
  resolveAction();
  await state.panel.drain();
  assert.equal(state.renderRequests, beforeClose);
  assert.deepEqual(state.done, ["closed"]);
});

test("confirm uses the explicit Back and Authorize choices", async () => {
  let authorized = false;
  const state = createPanel({
    rows: [
      {
        id: "confirm",
        label: "Confirm",
        value: () => "ready",
        description: "Safe confirmation",
        activate: async (api) => {
          authorized = await api.confirm("Continue?");
        },
      },
    ],
  });
  try {
    await state.panel.handleInput("enter");
    assert.match(state.panel.render(80).join("\n"), /Back/);
    assert.match(state.panel.render(80).join("\n"), /Authorize/);
    await state.panel.handleInput("down");
    await state.panel.handleInput("enter");
    await state.panel.drain();
    assert.equal(authorized, true);
  } finally {
    state.panel.dispose();
  }
});

test("panel renders localized initial status, draft warning, and navigation help", () => {
  const state = createPanel({
    rows: [
      {
        id: "idioma",
        label: "Idioma",
        value: () => "Inglês",
        description: "Escolha o idioma do projeto.",
        activate: () => {},
      },
    ],
    dirty: () => true,
    initialStatus: "A preferência é inválida; inglês está ativo.",
    messages: {
      back: "Voltar",
      authorize: "Autorizar",
      working: "Em andamento… Esc cancela a operação.",
      canceling: "Cancelando…",
      canceled: "Operação cancelada.",
      failed: "A operação falhou.",
      unsaved: "Há alterações sem salvar. Ctrl+S salva; Esc novamente descarta.",
      chooseHelp: "↑↓ escolher · Enter confirmar · Esc voltar",
      navigateHelp: "↑↓ navegar · Enter editar/abrir · Ctrl+S salvar · Esc fechar",
    },
  });
  try {
    assert.match(state.panel.render(80).join("\n"), /A preferência é inválida/);
    assert.match(state.panel.render(80).join("\n"), /navegar/);
    state.panel.handleInput("escape");
    assert.match(state.panel.render(80).join("\n"), /Há alterações sem salvar/);
  } finally {
    state.panel.dispose();
  }
});
