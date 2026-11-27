import type { ActionId, Choice } from "./contracts.ts";
import { Navigation } from "./navigation.ts";
import { type Locale, type MessageOverrides, type TerminalMessages } from "./i18n.ts";
import { LogModel, TableModel, type Column, type View } from "./components.ts";
export interface WorkspaceRecord extends Choice {
    fields: Record<string, string>;
}
export interface WorkspaceOptions {
    records: readonly WorkspaceRecord[];
    columns: readonly Column[];
    logLimit?: number;
    /** Header line 1. Default: localized "Diagnostics / Workspace". */
    title?: string;
    /** Header line 2. Default: localized "current project". */
    scope?: string;
    /** Persistent help line. Default: localized navigation help. */
    help?: string;
    /** Key hints line. Default: localized `Tab actions · Enter open · Esc back`. */
    hints?: string;
    /** Default pt-BR (package compatibility). */
    locale?: Locale | string;
    messages?: MessageOverrides;
    /** Below 40×12: legacy linear buttons or a resize message (hosts). Default `linear`. */
    narrow?: "linear" | "resize";
}
/** Persistent data exploration policy; host/renderer exclusively owns buffers and stream cleanup. */
export declare class WorkspaceModel {
    readonly navigation: Navigation;
    readonly table: TableModel;
    readonly log: LogModel;
    mode: "results" | "table" | "logs";
    region: "content" | "actions";
    scroll: number;
    closed: boolean;
    messages: TerminalMessages;
    locale: Locale;
    title: string | undefined;
    scope: string | undefined;
    help: string | undefined;
    hints: string | undefined;
    narrow: "linear" | "resize";
    /** True when `narrow` was given to the constructor (adapters keep it instead of their default). */
    readonly narrowChosen: boolean;
    private localeChosen;
    private readonly overrides;
    constructor(readonlyOptions: WorkspaceOptions);
    readonly records: readonly WorkspaceRecord[];
    actionIndex: number;
    /** Switches package texts; product title/scope/help stay as given. */
    setLocale(locale: Locale | string, messages?: MessageOverrides): void;
    /** True when a locale was given (constructor option or `setLocale`), not the package default. */
    get hasLocale(): boolean;
    get actions(): string[];
    /** Action-bar buttons; all navigate or switch views, so they take the `choose` role. */
    get barActions(): {
        id: string;
        label: string;
        role: "choose";
    }[];
    get focusedActionId(): string | undefined;
    dispatch(action: ActionId): void;
    linear(): View;
    render(columns: number, rows: number): View;
}
