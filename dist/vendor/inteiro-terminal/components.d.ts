import type { Binding, Choice, Field, MenuItem, Value } from "./contracts.ts";
import type { SettingsSession } from "./settings.ts";
import { keyHints } from "./keyboard.ts";
import { type TerminalMessages } from "./i18n.ts";
/**
 * Semantic role of a projected line. Renderers map it to their theme (Pi: `theme.fg/bold`);
 * the text itself stays readable without color.
 */
export type LineKind = "title" | "muted" | "focus" | "error" | "success" | "warning" | "info" | "label" | "input"
/** Action bar: renderers split it with `actionSegments` to paint each button by role. */
 | "actions";
export interface View {
    lines: string[];
    focusedLine: number;
    fullText: string[];
    /** Parallel to `lines`. Missing entries are plain text. */
    kinds?: (LineKind | undefined)[];
}
export type Presentation = "legacy" | "standard";
export declare function MenuList(items: readonly MenuItem[], focusedId: string, messages?: TerminalMessages): View;
/** One list row: a field value or an action line. */
export interface ListRow {
    id: string;
    label: string;
    value: string;
    /** Appended after the value, e.g. the override source. */
    suffix?: string;
    error?: string;
}
/**
 * Rows for a settings list. Legacy: `label: value` (stacked below 60 columns). Standard: labels and
 * values aligned in columns when there is room; a label too long for the column stacks.
 */
export declare function ListRows(rows: readonly ListRow[], focusedId: string, columns?: number, presentation?: Presentation, messages?: TerminalMessages): View;
/** Text shown for a field value; never used for persistence. */
export declare function displayValue(field: Field, value: Value, session: SettingsSession, presentation?: Presentation): string;
export declare function fieldRow(field: Field, session: SettingsSession, presentation?: Presentation): ListRow;
export declare function SettingsList(session: SettingsSession, columns?: number, presentation?: Presentation): View;
export declare function TextInput(label: string, value: string, error?: string, messages?: TerminalMessages): View;
export declare function SecretInput(label: string, error?: string, messages?: TerminalMessages): View;
export declare function Select(label: string, choices: readonly Choice[], focusedId: string, selectedId: string, messages?: TerminalMessages): View;
export declare function MultiSelect(label: string, choices: readonly Choice[], focusedId: string, selected: readonly string[], messages?: TerminalMessages): View;
export declare function SearchField(query: string, count: number, messages?: TerminalMessages): View;
/** Semantic role of an action button: `commit` makes a real effect, `choose` selects or navigates. */
export type ActionRole = "commit" | "choose";
export interface BarAction {
    id: string;
    label: string;
    disabled?: string;
    /** Default `choose`. */
    role?: ActionRole;
}
export declare function ActionBar(actions: readonly BarAction[], focusedId?: string, messages?: TerminalMessages): View;
export interface ActionSegment {
    text: string;
    /** Unset for separators and plain text. */
    role?: ActionRole | "muted";
    focused?: boolean;
}
/**
 * Splits a projected action-bar line (whole or wrapped) into buttons so a renderer can paint each one
 * by role without changing the text: joining every `text` returns the line unchanged.
 */
export declare function actionSegments(line: string, actions: readonly BarAction[], focusedId?: string): ActionSegment[];
export declare function KeyHints(bindings: readonly Binding[], actions: Parameters<typeof keyHints>[1], ascii?: boolean): View;
export declare function Breadcrumbs(parts: readonly string[]): View;
export declare function ConfirmAction(object: string, consequence: string, destination: string, label: string, messages?: TerminalMessages): View;
export declare function ChangeSummary(changes: readonly {
    label: string;
    before: unknown;
    after: unknown;
}[], scope: string, messages?: TerminalMessages): View;
export declare function StatusMessage(kind: "success" | "warning" | "danger" | "info", message: string, next?: string, messages?: TerminalMessages): View;
export declare function Progress(label: string, state: string, completed?: number, total?: number, cancellable?: boolean, messages?: TerminalMessages): View;
export declare function TaskList(tasks: readonly {
    label: string;
    state: string;
}[]): View;
export declare function DetailView(label: string, fields: Readonly<Record<string, unknown>>): View;
export declare function ResultList(items: readonly Choice[], focusedId: string, detail: View, columns?: number): View;
export interface Column {
    id: string;
    label: string;
    priority: number;
}
export declare class TableModel {
    sort: {
        id: string;
        direction: "asc" | "desc";
    } | undefined;
    readonly columns: readonly Column[];
    readonly records: readonly Record<string, string>[];
    messages: TerminalMessages;
    constructor(columns: readonly Column[], records: readonly Record<string, string>[], messages?: TerminalMessages);
    order(id: string): void;
    get rows(): Record<string, string>[];
}
export declare function DataTable(table: TableModel, columns?: number, linear?: boolean): View;
export declare class LogModel {
    private history;
    private frozen;
    paused: boolean;
    dropped: number;
    readonly limit: number;
    messages: TerminalMessages;
    constructor(limit?: number, messages?: TerminalMessages);
    append(message: string): void;
    toggle(): void;
    get lines(): string[];
    export(): string;
}
export declare function LogView(log: LogModel): View;
export declare function EmptyState(kind: "empty" | "filtered" | "unavailable", next: string, messages?: TerminalMessages): View;
export declare function ErrorState(message: string, next: string, messages?: TerminalMessages): View;
/**
 * Help lists each binding. Without `messages` it keeps the 1.3 output (action ids);
 * with `messages` it shows localized action names.
 */
export declare function HelpView(mode: string, bindings: readonly Binding[], messages?: TerminalMessages): View;
export interface PanelOptions {
    title: string;
    scope: string;
    dirty: boolean;
    body: View;
    help: string;
    feedback: string;
    actions: View;
    hints: View;
    columns: number;
    rows: number;
    density?: "focus" | "calm";
    ascii?: boolean;
    messages?: TerminalMessages;
    /** Tone of `feedback` for renderers. Default: plain feedback, muted help text. */
    feedbackKind?: LineKind;
    /** Below the minimum geometry: legacy linear-mode buttons, or a localized resize message (hosts). */
    narrow?: "linear" | "resize";
    /** `always` (default) shows the `x-y of N lines` position; `overflow` only when content scrolls. */
    position?: "always" | "overflow";
    /** `grapheme` (default, 1.3 output) fills each line; `word` breaks at spaces when it can. */
    wrap?: "grapheme" | "word";
    /** Whether the surface has a draft to keep (resize message wording). Default true. */
    draft?: boolean;
}
/** Cell-layout projection. Full text stays available separately; focused content is never scrolled away. */
export declare function TerminalPanel(p: PanelOptions): View;
