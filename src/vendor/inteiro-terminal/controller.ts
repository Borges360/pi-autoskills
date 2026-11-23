import type {
  ActionId,
  Binding,
  Choice,
  Field,
  Values,
} from "./contracts.ts";
import { SettingsSession, type Persist } from "./settings.ts";
import { Navigation } from "./navigation.ts";
import { Operation } from "./operation.ts";
import { keyLabel, standardKeyHints } from "./keyboard.ts";
import {
  resolveMessages,
  type Locale,
  type MessageOverrides,
  type TerminalMessages,
} from "./i18n.ts";
import type { FormatError } from "./errors.ts";
import {
  ActionBar,
  HelpView,
  KeyHints,
  ListRows,
  Select,
  TerminalPanel,
  TextInput,
  SecretInput,
  MultiSelect,
  fieldRow,
  type LineKind,
  type ListRow,
  type Presentation,
  type View,
} from "./components.ts";
export type ProgressReport = (
  label: string,
  completed?: number,
  total?: number,
) => void;
/**
 * A row in the panel list that runs a product operation with Enter. The work receives a draft
 * snapshot and an AbortSignal; Esc cancels it. It never runs because of navigation alone.
 */
export interface PanelAction {
  id: string;
  label: string;
  description?: string;
  /** `external` failures/aborts become `outcomeUnknown` (see `reconcile`). Default `local`. */
  effect?: "local" | "external";
  /** Default 30000 ms. */
  timeoutMs?: number;
  /** Value column text. Default: the activate key label (`Enter`). */
  hint?: string;
  /** Confirmation text (destination and effect). Enter on [Run] confirms; Esc goes back. */
  confirm?: string | ((draft: Readonly<Values>) => string | undefined);
  /** Reason shown instead of running. */
  disabled?: string | ((draft: Readonly<Values>) => string | undefined);
  /** Refuse while the draft differs from the saved values. Default: true when `closeWith`. */
  requiresSaved?: boolean;
  /** Close the panel after success (or immediately without `run`) and report it as the result action. */
  closeWith?: boolean;
  /**
   * The work. A string result, or `{ message }`, becomes the final status line;
   * `{ value }` is reported with the close action; `{ close: true }` closes like `closeWith`.
   */
  run?: (
    draft: Readonly<Values>,
    signal: AbortSignal,
    report: ProgressReport,
  ) => Promise<unknown>;
  /** Fresh read of an external result after `outcomeUnknown`. Without it, Enter asks before re-running. */
  reconcile?: (signal: AbortSignal) => Promise<{
    state: "succeeded" | "failed" | "cancelled";
    message: string;
  }>;
}
export interface PanelActionResult {
  id: string;
  value?: unknown;
}
export interface DraftChangeEvent {
  /** `edit`: a field was committed to the draft. `discard`: the draft returned to the saved values. */
  reason: "edit" | "discard";
}
export interface PanelControllerOptions {
  title: string;
  scope: string;
  session: SettingsSession;
  persist: Persist;
  bindings: readonly Binding[];
  onChange?: () => void;
  /** UI language of the panel and its session. Default: the session's (pt-BR). */
  locale?: Locale | string;
  messages?: MessageOverrides;
  /**
   * `legacy` (default) keeps 1.3 output. `standard`: `*` in the title while dirty, aligned values,
   * choice labels and on/off for booleans, one-Enter boolean toggle, compact key hints with
   * readable labels, a resize message below 40×12 and validation messages in the status line.
   */
  presentation?: Presentation;
  /** In the unsaved-changes decision, Esc discards and closes (first Esc warns). Default false. */
  discardOnSecondEscape?: boolean;
  /** Action rows listed after the fields. Ids must not collide with field ids. */
  actions?: readonly PanelAction[];
  /** Product text for errors: cause and recovery, without payloads. */
  formatError?: FormatError;
  /** Save timeout; default 15000 ms. */
  saveTimeoutMs?: number;
  /** Esc during save aborts the persist signal (confirmed when the persist rejects). Default false. */
  cancellableSave?: boolean;
  /** Grace for cancelled work to settle before `outcomeUnknown`. Default 100 ms. */
  cancelGraceMs?: number;
  /** Fresh storage read used after an unconfirmed save (Ctrl+S / "Check storage"). */
  reconcile?: (signal: AbortSignal) => Promise<Values>;
  /** Called after the draft changes (live preview). `panel` allows `setLocale`/`relabel`. */
  onDraftChange?: (
    draft: Readonly<Values>,
    event: DraftChangeEvent,
    panel: PanelController,
  ) => void;
  /** Below 40×12. Default: `resize` for standard presentation, `linear` for legacy. */
  narrow?: "linear" | "resize";
}
// Operation callback intentionally receives a snapshot, never a mutable session.
export interface PanelTask {
  label: string;
  timeoutMs: number;
  effect: "local" | "external";
  run: (
    draft: Readonly<Values>,
    signal: AbortSignal,
    report: ProgressReport,
  ) => Promise<unknown>;
}
const textOf = (
  value: unknown,
  draft: Readonly<Values>,
): string | undefined => {
  try {
    const text =
      typeof value === "function"
        ? (value as (d: Readonly<Values>) => unknown)(draft)
        : value;
    return typeof text === "string" && text.trim() ? text : undefined;
  } catch {
    return undefined;
  }
};
export class PanelController {
  navigation: Navigation;
  /** The bar task's operation (1.3 API). Action rows have their own operations. */
  readonly operation: Operation<unknown>;
  region: "fields" | "actions" = "fields";
  actionIndex = 0;
  modalIndex = 0;
  choiceIndex = 0;
  help = false;
  searchEditing = false;
  search = "";
  helpOffset = 0;
  /**
   * Pending confirmation of an action row, or of writing the draft again after an unconfirmed
   * save without `reconcile` (`save`).
   */
  confirm:
    | {
        action: PanelAction;
        text: string;
        unknown: boolean;
        index: number;
        save?: "save" | "saveClose";
      }
    | undefined;
  /** Set when an action closed the panel. */
  closedWith: PanelActionResult | undefined;
  messages: TerminalMessages;
  bindings: readonly Binding[];
  title: string;
  scope: string;
  listActions: readonly PanelAction[];
  private selected: string[] = [];
  private operations = new Map<string, Operation<unknown>>();
  private current: Operation<unknown> | undefined;
  private lastDraft: string;
  private discarding = false;
  readonly options: PanelControllerOptions;
  readonly task: PanelTask | undefined;
  constructor(options: PanelControllerOptions, task?: PanelTask) {
    this.options = options;
    this.task = task;
    this.title = options.title;
    this.scope = options.scope;
    this.bindings = options.bindings;
    this.listActions = options.actions ?? [];
    if (options.locale !== undefined || options.messages)
      options.session.setLocale(
        options.locale ?? options.session.locale,
        options.messages,
      );
    this.messages = options.session.messages;
    const ids = new Set(options.session.fields.map((f) => f.id));
    for (const a of this.listActions) {
      if (ids.has(a.id)) throw new Error(this.messages.duplicateFieldIds);
      ids.add(a.id);
    }
    options.session.configure({
      ...(options.formatError ? { formatError: options.formatError } : {}),
      ...(options.saveTimeoutMs !== undefined
        ? { saveTimeoutMs: options.saveTimeoutMs }
        : {}),
      ...(options.cancellableSave !== undefined
        ? { cancellableSave: options.cancellableSave }
        : {}),
      ...(options.cancelGraceMs !== undefined
        ? { cancelGraceMs: options.cancelGraceMs }
        : {}),
    });
    this.navigation = new Navigation(
      "settings",
      this.items(),
      options.session.focusedId,
    );
    this.operation = this.newOperation(options.scope, task?.effect ?? "local");
    this.lastDraft = JSON.stringify(options.session.draft);
  }
  get presentation(): Presentation {
    return this.options.presentation ?? "legacy";
  }
  get session() {
    return this.options.session;
  }
  get field(): Field | undefined {
    return this.session.fields.find((f) => f.id === this.session.editing?.id);
  }
  get choices(): readonly Choice[] {
    const f = this.field;
    return f ? (this.session.choicesOf(f) ?? []) : [];
  }
  /** Bar actions (Tab region). */
  get actions() {
    const reconcile = this.session.outcomeUnknown && !!this.options.reconcile;
    return [
      {
        id: "save",
        label: reconcile
          ? this.messages.actionReconcile
          : this.messages.actionSave,
      },
      ...(this.task
        ? [
            {
              id: "run",
              label: this.operation.active
                ? this.messages.actionCancelOperation
                : this.task.label,
            },
          ]
        : []),
      { id: "help", label: this.messages.actionHelp },
      { id: "close", label: this.messages.actionClose },
    ];
  }
  /** Running operation (bar task, action row, choice loading or storage check), if any. */
  get activeOperation(): Operation<unknown> | undefined {
    if (this.operation.active) return this.operation;
    for (const op of this.operations.values()) if (op.active) return op;
    return undefined;
  }
  get busy() {
    return !!this.activeOperation;
  }
  get selectedChoices() {
    return [...this.selected];
  }
  /** Switches every visible package string (live language preview). Discarded drafts should switch back. */
  setLocale(locale: Locale | string, messages?: MessageOverrides) {
    const previous = this.messages;
    this.messages = resolveMessages(locale, messages ?? this.options.messages);
    this.session.setLocale(locale, messages ?? this.options.messages);
    this.operation.setLocale(locale, messages ?? this.options.messages);
    for (const op of this.operations.values())
      op.setLocale(locale, messages ?? this.options.messages);
    this.bindings = this.bindings.map((b) =>
      b.label === keyLabel(b.key, previous)
        ? { ...b, label: keyLabel(b.key, this.messages) }
        : b,
    );
  }
  /** Replaces product texts (same ids) for a translated preview. */
  relabel(text: {
    title?: string;
    scope?: string;
    fields?: readonly Field[];
    actions?: readonly PanelAction[];
  }) {
    if (text.title !== undefined) this.title = text.title;
    if (text.scope !== undefined) this.scope = text.scope;
    if (text.fields) this.session.relabelFields(text.fields);
    if (text.actions) {
      const ids = this.listActions.map((a) => a.id).join("\n");
      if (text.actions.map((a) => a.id).join("\n") !== ids)
        throw new Error(this.messages.unknownField);
      this.listActions = text.actions;
    }
    const previous = this.navigation.current;
    this.navigation = new Navigation(
      "settings",
      this.items(),
      this.session.focusedId,
    );
    this.navigation.filter(previous.filter);
    this.session.focusedId = this.navigation.current.focusedId;
  }
  private items(): Choice[] {
    return [
      ...this.session.fields.map((f) => ({
        id: f.id,
        label: f.label,
        description: f.description,
      })),
      ...this.listActions.map((a) => ({
        id: a.id,
        label: a.label,
        ...(a.description !== undefined ? { description: a.description } : {}),
      })),
    ];
  }
  private newOperation(owner: string, effect: "local" | "external") {
    const op = new Operation<unknown>(owner, effect, {
      ...(this.options.messages ? { messages: this.options.messages } : {}),
      ...(this.options.cancelGraceMs !== undefined
        ? { cancelGraceMs: this.options.cancelGraceMs }
        : {}),
      ...(this.options.formatError
        ? { formatError: this.options.formatError }
        : {}),
    });
    op.messages = this.messages;
    return op;
  }
  private operationFor(id: string, effect: "local" | "external") {
    let op = this.operations.get(id);
    if (!op) {
      op = this.newOperation(id, effect);
      this.operations.set(id, op);
    }
    return op;
  }
  begin(id: string) {
    this.session.begin(id);
    const value = this.session.editing?.value;
    this.choiceIndex = Math.max(
      0,
      this.choices.findIndex((c) => c.id === value),
    );
    this.selected = Array.isArray(value) ? [...value] : [];
  }
  setText(text: string) {
    if (this.field)
      this.session.edit(
        this.field.kind === "number"
          ? text.trim() === ""
            ? NaN
            : Number(text)
          : text,
      );
  }
  private move(delta: number) {
    if (this.session.closeDecision)
      this.modalIndex = Math.max(0, Math.min(2, this.modalIndex + delta));
    else if (this.confirm)
      this.confirm.index = Math.max(
        0,
        Math.min(1, this.confirm.index + delta),
      );
    else if (this.session.editing)
      this.choiceIndex = Math.max(
        0,
        Math.min(this.choices.length - 1, this.choiceIndex + delta),
      );
    else if (this.region === "actions")
      this.actionIndex = Math.max(
        0,
        Math.min(this.actions.length - 1, this.actionIndex + delta),
      );
    else {
      this.navigation.move(delta);
      this.session.focusedId = this.navigation.current.focusedId;
    }
  }
  async dispatch(action: ActionId) {
    try {
      await this.handle(action);
    } finally {
      this.notifyDraft();
    }
  }
  private notifyDraft() {
    const draft = this.session.draft,
      key = JSON.stringify(draft);
    const reason = this.discarding ? "discard" : "edit";
    this.discarding = false;
    if (key === this.lastDraft) return;
    this.lastDraft = key;
    try {
      this.options.onDraftChange?.(draft, { reason }, this);
    } catch {
      /* preview errors never break the panel */
    }
  }
  private async handle(action: ActionId) {
    if (this.session.closed) return;
    if (this.help) {
      if (action === "navigate.down" || action === "navigate.pageDown")
        this.helpOffset = Math.min(
          this.bindings.length,
          this.helpOffset + (action === "navigate.pageDown" ? 5 : 1),
        );
      if (action === "navigate.up" || action === "navigate.pageUp")
        this.helpOffset = Math.max(
          0,
          this.helpOffset - (action === "navigate.pageUp" ? 5 : 1),
        );
      if (["back", "help", "close", "activate"].includes(action))
        this.help = false;
      return;
    }
    if (this.session.closeDecision) {
      if (action === "back" && this.session.saving) {
        if (!this.session.cancelSave()) this.session.back();
      } else if (action === "back") {
        if (this.options.discardOnSecondEscape) await this.discard();
        else this.session.back();
      } else if (action === "navigate.up") this.move(-1);
      else if (action === "navigate.down") this.move(1);
      else if (action === "activate") {
        const decision = (["continue", "saveClose", "discard"] as const)[
          this.modalIndex
        ]!;
        if (decision === "discard") await this.discard();
        else if (decision === "saveClose" && this.session.outcomeUnknown) {
          if (this.options.reconcile) {
            await this.reconcileStorage();
            if (!this.session.outcomeUnknown)
              await this.session.decide(decision, this.options.persist);
          } else {
            this.session.closeDecision = false;
            this.askSaveRetry("saveClose");
          }
        } else await this.session.decide(decision, this.options.persist);
      }
      return;
    }
    if (this.confirm) {
      const pending = this.confirm;
      if (action === "back" || action === "close") this.confirm = undefined;
      else if (action === "navigate.up") this.move(-1);
      else if (action === "navigate.down") this.move(1);
      else if (action === "activate") {
        this.confirm = undefined;
        if (pending.index === 1 && pending.save) {
          this.session.allowSaveRetry();
          if (pending.save === "saveClose") {
            this.session.closeDecision = true;
            await this.session.decide("saveClose", this.options.persist);
          } else await this.save();
        } else if (pending.index === 1) {
          if (pending.unknown)
            this.operationFor(
              pending.action.id,
              pending.action.effect ?? "local",
            ).reconcile("failed", "");
          await this.runAction(pending.action);
        }
      }
      return;
    }
    if (action === "help") {
      this.help = true;
      return;
    }
    if (
      action === "search" &&
      this.navigation.searchable &&
      !this.session.editing &&
      !this.busy
    ) {
      this.searchEditing = true;
      return;
    }
    if (action === "cancelOperation" || (this.busy && action === "back")) {
      this.activeOperation?.cancel();
      return;
    }
    if (this.busy) return;
    if (this.session.saving && (action === "back" || action === "close")) {
      if (!this.session.cancelSave()) this.session.back();
      return;
    }
    if (action === "save") {
      if (this.session.outcomeUnknown && this.options.reconcile) {
        await this.reconcileStorage();
        return;
      }
      const f = this.field;
      if (f?.kind === "select") {
        const c = this.choices[this.choiceIndex];
        if (!c || c.disabled) return;
        this.session.edit(c.id);
      }
      if (f?.kind === "multiselect") this.session.edit(this.selected);
      if (this.session.outcomeUnknown) {
        this.askSaveRetry("save");
        return;
      }
      await this.save();
      return;
    }
    if (action === "back" || action === "close") {
      this.session.back();
      this.modalIndex = 0;
      return;
    }
    if (action === "nextRegion" || action === "previousRegion") {
      if (!this.session.editing)
        this.region = this.region === "fields" ? "actions" : "fields";
      return;
    }
    if (action === "navigate.up") this.move(-1);
    if (action === "navigate.down") this.move(1);
    if (!this.session.editing && this.region === "fields") {
      if (action === "navigate.first") this.navigation.first();
      if (action === "navigate.last") this.navigation.last();
      if (action === "navigate.pageUp") this.navigation.move(-1, 5);
      if (action === "navigate.pageDown") this.navigation.move(1, 5);
      this.session.focusedId = this.navigation.current.focusedId;
    }
    if (action === "toggle" && this.field?.kind === "multiselect") {
      const c = this.choices[this.choiceIndex];
      if (c && !c.disabled)
        this.selected = this.selected.includes(c.id)
          ? this.selected.filter((id) => id !== c.id)
          : [...this.selected, c.id];
    }
    if (action !== "activate") return;
    if (this.session.editing) {
      const f = this.field!;
      if (f.kind === "select") {
        const c = this.choices[this.choiceIndex];
        if (!c || c.disabled) return;
        this.session.edit(c.id);
      }
      if (f.kind === "multiselect") this.session.edit(this.selected);
      if (f.kind === "boolean") this.session.edit(!this.session.editing.value);
      this.session.confirmEdit();
      return;
    }
    if (this.region === "fields") {
      const id = this.session.focusedId;
      const row = this.listActions.find((a) => a.id === id);
      if (row) await this.activateAction(row);
      else await this.activateField(id);
      return;
    }
    const id = this.actions[this.actionIndex]?.id;
    if (id === "save") {
      if (this.session.outcomeUnknown && this.options.reconcile)
        await this.reconcileStorage();
      else if (this.session.outcomeUnknown) this.askSaveRetry("save");
      else await this.save();
    }
    if (id === "help") this.help = true;
    if (id === "close") this.session.back();
    if (id === "run" && this.task) {
      const draft = this.session.draft;
      this.current = this.operation;
      await this.operation.run(
        (signal, report) =>
          this.task!.run(draft, signal, (label, completed, total) => {
            report(label, completed, total);
            this.options.onChange?.();
          }),
        this.task.timeoutMs,
        { context: { phase: "task", label: this.task.label } },
      );
    }
  }
  /** Without a storage read, writing the draft again needs an explicit choice (focus on Go back). */
  private askSaveRetry(mode: "save" | "saveClose") {
    const m = this.messages;
    this.confirm = {
      action: { id: "@save", label: m.actionSave },
      text: m.saveRetryConfirm,
      unknown: true,
      index: 0,
      save: mode,
    };
  }
  private async save() {
    const result = await this.session.save(this.options.persist);
    if (
      this.presentation === "standard" &&
      result.status === "invalid" &&
      !this.session.closed
    )
      this.session.setStatus(result.message, "error");
  }
  private async discard() {
    this.discarding = this.session.dirty;
    await this.session.decide("discard", this.options.persist);
  }
  private async activateField(id: string) {
    const f = this.session.fields.find((f) => f.id === id);
    if (!f) return;
    if (f.override || f.locked) {
      this.begin(id);
      return;
    }
    if (this.presentation === "standard" && f.kind === "boolean") {
      this.session.begin(id);
      const editing = this.session.editing;
      if (!editing) return;
      this.session.edit(!editing.value);
      this.session.confirmEdit();
      return;
    }
    if (f.loadChoices && (f.kind === "select" || f.kind === "multiselect")) {
      const op = this.operationFor(`choices:${id}`, "local");
      if (op.state === "outcomeUnknown") op.reconcile("failed", "");
      this.current = op;
      this.session.setStatus("");
      const load = f.loadChoices;
      const result = await op.run(
        (signal) => load(signal),
        f.loadTimeoutMs ?? 15000,
        {
          context: { phase: "loadChoices", id, label: f.label },
          label: this.messages.loadingChoices(f.label),
        },
      );
      if (result.status !== "succeeded" || this.session.closed) return;
      if (op.cancelRequested) {
        // Esc already cancelled the load (read-only): late choices never open the submenu.
        op.state = "cancelled";
        op.message = this.messages.operationCancelled;
        return;
      }
      const choices = Array.isArray(result.value)
        ? (result.value as Choice[])
        : [];
      this.session.setChoices(id, choices);
      this.current = undefined;
      if (!choices.length) {
        this.session.setStatus(this.messages.noChoices, "warning");
        return;
      }
    }
    this.begin(id);
  }
  private async activateAction(a: PanelAction) {
    const m = this.messages,
      draft = this.session.draft;
    const disabled = textOf(a.disabled, draft);
    if (disabled) {
      this.session.setStatus(m.actionDisabled(disabled), "warning");
      return;
    }
    if ((a.requiresSaved ?? !!a.closeWith) && this.session.dirty) {
      this.session.setStatus(m.actionRequiresSaved, "warning");
      return;
    }
    const op = this.operationFor(a.id, a.effect ?? "local");
    if (op.state === "outcomeUnknown") {
      if (a.reconcile) await this.reconcileAction(a, op);
      else
        this.confirm = {
          action: a,
          text: m.unknownOutcomeConfirm,
          unknown: true,
          index: 0,
        };
      return;
    }
    const text = textOf(a.confirm, draft);
    if (text) {
      this.confirm = { action: a, text, unknown: false, index: 0 };
      return;
    }
    await this.runAction(a);
  }
  private async runAction(a: PanelAction) {
    if (!a.run) {
      if (a.closeWith) this.closeWithAction(a.id, undefined);
      return;
    }
    const op = this.operationFor(a.id, a.effect ?? "local");
    this.current = op;
    this.session.setStatus("");
    const draft = this.session.draft,
      run = a.run,
      m = this.messages;
    const result = await op.run(
      (signal, report) =>
        run(draft, signal, (label, completed, total) => {
          report(label, completed, total);
          this.options.onChange?.();
        }),
      a.timeoutMs ?? 30000,
      {
        context: { phase: "action", id: a.id, label: a.label },
        describe: (value) =>
          typeof value === "string"
            ? value
            : value &&
                typeof value === "object" &&
                typeof (value as { message?: unknown }).message === "string"
              ? (value as { message: string }).message
              : m.actionDone(a.label),
      },
    );
    if (result.status !== "succeeded" || this.session.closed) return;
    if (op.cancelRequested) {
      // The work finished despite Esc: report it, but never close or hand its value over.
      op.message = m.finishedBeforeCancel(a.label);
      return;
    }
    const value = result.value as
      | { close?: unknown; value?: unknown }
      | undefined;
    const close =
      a.closeWith ||
      (!!value && typeof value === "object" && value.close === true);
    if (close)
      this.closeWithAction(
        a.id,
        value && typeof value === "object" && "value" in value
          ? value.value
          : result.value,
      );
  }
  private closeWithAction(id: string, value: unknown) {
    this.closedWith = value === undefined ? { id } : { id, value };
    this.session.closed = true;
  }
  private async reconcileAction(a: PanelAction, op: Operation<unknown>) {
    const check = this.operationFor(`reconcile:${a.id}`, "local");
    if (check.state === "outcomeUnknown") check.reconcile("failed", "");
    this.current = check;
    const reconcile = a.reconcile!;
    const result = await check.run(
      (signal) => reconcile(signal),
      a.timeoutMs ?? 30000,
      { context: { phase: "reconcile", id: a.id, label: a.label } },
    );
    if (result.status !== "succeeded") return;
    const outcome = result.value as { state: unknown; message: unknown };
    const state =
      outcome?.state === "succeeded" ||
      outcome?.state === "cancelled" ||
      outcome?.state === "failed"
        ? outcome.state
        : "failed";
    op.reconcile(
      state,
      typeof outcome?.message === "string" && outcome.message.trim()
        ? outcome.message
        : this.messages.operationStates[state],
    );
    this.current = op;
  }
  /** Fresh storage read after an unconfirmed save; never repeats the write. */
  async reconcileStorage() {
    const read = this.options.reconcile;
    if (!read || this.busy || this.session.saving) return;
    const op = this.operationFor("@storage", "local");
    if (op.state === "outcomeUnknown") op.reconcile("failed", "");
    this.current = op;
    this.session.setStatus("");
    const result = await op.run(
      (signal) => read(signal),
      this.options.saveTimeoutMs ?? 15000,
      { context: { phase: "reconcile" } },
    );
    if (result.status !== "succeeded" || this.session.closed) return;
    try {
      this.session.reconcilePersistence(result.value as Values);
      this.current = undefined;
    } catch {
      this.session.setStatus(this.messages.invalidPersistedState, "error");
    }
  }
  filter(value: string) {
    this.search = value;
    this.navigation.filter(value);
    this.session.focusedId = this.navigation.current.focusedId;
  }
  private actionRow(a: PanelAction): ListRow {
    const m = this.messages,
      op = this.operations.get(a.id);
    const disabled = textOf(a.disabled, this.session.draft);
    const activate = this.bindings.find((b) => b.action === "activate")?.label;
    const value = op?.active
      ? m.operationStates[op.state]
      : disabled
        ? m.unavailable(disabled)
        : this.presentation === "legacy"
          ? m.actionMarker
          : (a.hint ?? activate ?? m.actionMarker);
    return { id: a.id, label: a.label, value };
  }
  private list(columns: number): View {
    const m = this.messages;
    const visible = new Set(this.navigation.visible.map((i) => i.id));
    const rows: ListRow[] = [
      ...this.session.fields
        .filter((f) => !this.search || visible.has(f.id))
        .map((f) => fieldRow(f, this.session, this.presentation)),
      ...this.listActions
        .filter((a) => !this.search || visible.has(a.id))
        .map((a) => this.actionRow(a)),
    ];
    let body: View = rows.length
      ? ListRows(
          rows,
          this.session.focusedId,
          columns,
          this.presentation,
          m,
        )
      : {
          lines: [m.noSearchResults],
          focusedLine: 0,
          fullText: [m.noSearchResults],
          kinds: ["muted"],
        };
    if (this.navigation.searchable)
      body = {
        lines: [`[${m.searchItems}] ${this.search}`, ...body.lines],
        focusedLine: body.focusedLine + 1,
        fullText: [`[${m.searchItems}] ${this.search}`, ...body.fullText],
        kinds: [undefined, ...(body.kinds ?? [])],
      };
    return body;
  }
  private hints(ascii: boolean): View {
    const m = this.messages,
      sep = ascii ? " | " : " · ";
    const editing = this.session.editing,
      f = this.field;
    if (this.presentation === "legacy")
      return KeyHints(
        this.bindings,
        {
          activate: editing ? m.hintFinishField : m.hintEditOpen,
          nextRegion: m.hintActions,
          back: this.busy ? m.hintCancelOperation : m.hintBack,
          save: m.hintSave,
          ...(this.navigation.searchable ? { search: m.hintSearch } : {}),
        },
        ascii,
      );
    type Entry = readonly [ActionId | "navigate", string];
    const entries: Entry[] = this.help
      ? [
          ["navigate", m.hintScroll],
          ["back", m.hintBack],
        ]
      : this.session.closeDecision
        ? [
            ["navigate", m.hintNavigate],
            ["activate", m.hintChoose],
            [
              "back",
              this.options.discardOnSecondEscape
                ? m.hintDiscard
                : m.hintKeepEditing,
            ],
          ]
        : this.confirm
          ? [
              ["navigate", m.hintNavigate],
              ["activate", m.hintChoose],
              ["back", m.hintBack],
            ]
          : this.busy
            ? [["back", m.hintCancelOperation]]
            : this.session.saving
              ? this.session.cancellableSave
                ? [["back", m.hintCancelSave]]
                : []
              : editing && f
                ? f.kind === "select" || f.kind === "multiselect"
                  ? [
                      ["navigate", m.hintNavigate],
                      ...(f.kind === "multiselect"
                        ? ([["toggle", m.hintToggle]] as Entry[])
                        : []),
                      ["activate", m.hintChoose],
                      ["save", m.hintSave],
                      ["back", m.hintBack],
                    ]
                  : [
                      ["activate", m.hintFinishField],
                      ["save", m.hintSave],
                      ["back", m.hintBack],
                    ]
                : [
                    ["navigate", m.hintNavigate],
                    ["activate", m.hintEditOpen],
                    ["save", m.hintSave],
                    ...(this.navigation.searchable
                      ? ([["search", m.hintSearch]] as Entry[])
                      : []),
                    ["back", m.hintClose],
                    ["nextRegion", m.hintActions],
                  ];
    const text = standardKeyHints(this.bindings, entries, sep);
    return {
      lines: [text],
      focusedLine: 0,
      fullText: [text],
      kinds: ["muted"],
    };
  }
  private feedback(ascii: boolean): {
    text: string;
    kind: LineKind | undefined;
  } {
    const op = this.activeOperation ?? this.current ?? this.operation,
      m = this.messages;
    if (op.active) {
      const separator = ascii ? " | " : " · ";
      const state =
        this.presentation === "legacy"
          ? op.state
          : m.operationStates[op.state];
      return {
        text: `${op.progress.label}${separator}${state}`,
        kind: "info",
      };
    }
    if (this.session.status) {
      const kind = this.session.statusKind;
      return {
        text: this.session.status,
        kind: kind === "" || kind === "info" ? undefined : kind,
      };
    }
    return {
      text: op.message.trim() ? op.message : "",
      kind:
        op.state === "failed" || op.state === "outcomeUnknown"
          ? "error"
          : op.state === "cancelled"
            ? "warning"
            : op.state === "succeeded"
              ? "success"
              : undefined,
    };
  }
  render(columns: number, rows: number, ascii = false): View {
    const m = this.messages,
      standard = this.presentation === "standard";
    let body: View;
    const editing = this.session.editing,
      f = this.field;
    if (this.help) {
      body = HelpView(
        m.helpModePanel,
        this.bindings,
        standard || this.options.locale !== undefined ? m : undefined,
      );
      body.lines.push(
        this.session.status,
        this.operation.message,
        this.focusedDescription(),
      );
      body.fullText.push(...body.lines.slice(-3));
      body.kinds?.push(undefined, undefined, undefined);
      body.focusedLine = this.helpOffset;
    } else if (this.session.closeDecision) {
      const lines = [
        m.unsavedChangesQuestion,
        ...[m.decisionContinue, m.decisionSaveClose, m.decisionDiscard].map(
          (s, i) => `${i === this.modalIndex ? ">" : " "} [${s}]`,
        ),
        ...(this.options.discardOnSecondEscape
          ? [m.decisionEscapeDiscards]
          : []),
      ];
      body = {
        lines,
        focusedLine: 1 + this.modalIndex,
        fullText: [],
        kinds: [
          "warning",
          ...[0, 1, 2].map((i) =>
            i === this.modalIndex ? ("focus" as const) : undefined,
          ),
          "muted",
        ],
      };
    } else if (this.confirm) {
      const c = this.confirm;
      const lines = [
        c.action.label,
        c.text,
        `${c.index === 0 ? ">" : " "} [${m.confirmBack}]`,
        `${c.index === 1 ? ">" : " "} [${c.save ? m.confirmSaveAgain : m.confirmRun(c.action.label)}]`,
      ];
      body = {
        lines,
        focusedLine: 2 + c.index,
        fullText: [...lines],
        kinds: [
          "label",
          "warning",
          c.index === 0 ? "focus" : undefined,
          c.index === 1 ? "focus" : undefined,
        ],
      };
    } else if (editing && f) {
      if (f.kind === "secret")
        body = SecretInput(f.label, this.session.errors[f.id], m);
      else if (f.kind === "select")
        body = Select(
          f.label,
          this.choices,
          this.choices[this.choiceIndex]?.id ?? "",
          String(editing.value),
          m,
        );
      else if (f.kind === "multiselect")
        body = MultiSelect(
          f.label,
          this.choices,
          this.choices[this.choiceIndex]?.id ?? "",
          this.selected,
          m,
        );
      else
        body = TextInput(
          f.label,
          String(editing.value),
          this.session.errors[f.id],
          m,
        );
    } else body = this.list(columns);
    const feedback = this.feedback(ascii);
    return TerminalPanel({
      title: standard && this.session.dirty ? `${this.title} *` : this.title,
      scope: this.scope,
      dirty: this.session.dirty,
      body,
      // Help mode already prints the full description in the body; the footer must not repeat it.
      help: this.help ? "" : this.focusedDescription(),
      feedback: feedback.text,
      ...(feedback.kind ? { feedbackKind: feedback.kind } : {}),
      actions: ActionBar(
        this.actions,
        this.region === "actions"
          ? this.actions[this.actionIndex]?.id
          : undefined,
        m,
      ),
      hints: this.hints(ascii),
      columns,
      rows,
      ascii,
      messages: m,
      narrow: this.options.narrow ?? (standard ? "resize" : "linear"),
      position: standard ? "overflow" : "always",
      wrap: standard ? "word" : "grapheme",
    });
  }
  private focusedDescription() {
    const id = this.session.focusedId;
    return (
      this.session.fields.find((f) => f.id === id)?.description ??
      this.listActions.find((a) => a.id === id)?.description ??
      ""
    );
  }
  dispose() {
    this.operation.dispose();
    for (const op of this.operations.values()) op.dispose();
    this.session.dispose();
  }
}
