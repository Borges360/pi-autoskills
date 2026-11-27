import type { ActionId, Binding, Choice, Field, Values } from "./contracts.ts";
import { SettingsSession, type Persist } from "./settings.ts";
import { Navigation } from "./navigation.ts";
import { Operation } from "./operation.ts";
import { type Locale, type MessageOverrides, type TerminalMessages } from "./i18n.ts";
import type { FormatError } from "./errors.ts";
import { type Presentation, type View } from "./components.ts";
export type ProgressReport = (label: string, completed?: number, total?: number) => void;
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
    run?: (draft: Readonly<Values>, signal: AbortSignal, report: ProgressReport) => Promise<unknown>;
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
    onDraftChange?: (draft: Readonly<Values>, event: DraftChangeEvent, panel: PanelController) => void;
    /** Below 40×12. Default: `resize` for standard presentation, `linear` for legacy. */
    narrow?: "linear" | "resize";
}
export interface PanelTask {
    label: string;
    timeoutMs: number;
    effect: "local" | "external";
    run: (draft: Readonly<Values>, signal: AbortSignal, report: ProgressReport) => Promise<unknown>;
}
export declare class PanelController {
    navigation: Navigation;
    /** The bar task's operation (1.3 API). Action rows have their own operations. */
    readonly operation: Operation<unknown>;
    region: "fields" | "actions";
    actionIndex: number;
    modalIndex: number;
    choiceIndex: number;
    help: boolean;
    searchEditing: boolean;
    search: string;
    helpOffset: number;
    /**
     * Pending confirmation of an action row, or of writing the draft again after an unconfirmed
     * save without `reconcile` (`save`).
     */
    confirm: {
        action: PanelAction;
        text: string;
        unknown: boolean;
        index: number;
        save?: "save" | "saveClose";
    } | undefined;
    /** Set when an action closed the panel. */
    closedWith: PanelActionResult | undefined;
    messages: TerminalMessages;
    bindings: readonly Binding[];
    title: string;
    scope: string;
    listActions: readonly PanelAction[];
    private selected;
    private operations;
    private current;
    private lastDraft;
    private discarding;
    readonly options: PanelControllerOptions;
    readonly task: PanelTask | undefined;
    constructor(options: PanelControllerOptions, task?: PanelTask);
    get presentation(): Presentation;
    get session(): SettingsSession;
    get field(): Field | undefined;
    get choices(): readonly Choice[];
    /** Bar actions (Tab region). */
    get actions(): {
        id: string;
        role: "choose" | "commit";
        label: string;
    }[];
    /** Id of the focused action-bar button, when the action region has focus. */
    get focusedActionId(): string | undefined;
    /** Running operation (bar task, action row, choice loading or storage check), if any. */
    get activeOperation(): Operation<unknown> | undefined;
    get busy(): boolean;
    get selectedChoices(): string[];
    /** Switches every visible package string (live language preview). Discarded drafts should switch back. */
    setLocale(locale: Locale | string, messages?: MessageOverrides): void;
    /** Replaces product texts (same ids) for a translated preview. */
    relabel(text: {
        title?: string;
        scope?: string;
        fields?: readonly Field[];
        actions?: readonly PanelAction[];
    }): void;
    private items;
    private newOperation;
    private operationFor;
    begin(id: string): void;
    setText(text: string): void;
    private move;
    dispatch(action: ActionId): Promise<void>;
    private notifyDraft;
    private handle;
    /** Without a storage read, writing the draft again needs an explicit choice (focus on Go back). */
    private askSaveRetry;
    private save;
    private discard;
    private activateField;
    private activateAction;
    private runAction;
    private closeWithAction;
    private reconcileAction;
    /** Fresh storage read after an unconfirmed save; never repeats the write. */
    reconcileStorage(): Promise<void>;
    filter(value: string): void;
    private actionRow;
    private list;
    private hints;
    private feedback;
    render(columns: number, rows: number, ascii?: boolean): View;
    private focusedDescription;
    dispose(): void;
}
