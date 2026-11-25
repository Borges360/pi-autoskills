import { type Component, type KeybindingsManager } from "@earendil-works/pi-tui";
import type { Binding, TerminalResult, Values } from "./contracts.ts";
import { PanelController, type PanelControllerOptions, type PanelTask } from "./controller.ts";
import { type Locale, type MessageOverrides } from "./i18n.ts";
import { WorkspaceModel } from "./workspace.ts";
export { installInteiroPiThemes, registerInteiroPiThemes, piAgentDir, type PiThemeInstallOptions, type PiThemeInstallResult, } from "./pi-theme-install.ts";
/**
 * The subset of the Pi theme the adapter paints with. IDS roles map to host tokens:
 * choose → `accent`; commit (real effect) → `bashMode` + bold, the editor color for running commands
 * for real; focus → `accent` over `selectedBg`. `bg` is optional so older hosts degrade to color only.
 */
export interface PiTheme {
    fg(name: "accent" | "muted" | "error" | "success" | "warning" | "bashMode", text: string): string;
    bg?(name: "selectedBg", text: string): string;
    bold?(text: string): string;
}
export interface PiRuntime {
    requestRender(): void;
    terminal?: {
        rows: number;
    };
}
export interface PiOverlayOptions {
    /** Columns or percentage of the terminal. Default `100%`. */
    width?: number | `${number}%`;
    minWidth?: number;
    /** Rows or percentage of the terminal. Default `100%`. */
    maxHeight?: number | `${number}%`;
    anchor?: "center" | "top-center" | "bottom-center";
    margin?: number;
}
export interface PiUI {
    custom<T>(factory: (tui: PiRuntime, theme: PiTheme, keys: KeybindingsManager, done: (value: T) => void) => Component & {
        focused?: boolean;
    }, options?: {
        overlay: boolean;
        overlayOptions: PiOverlayOptions;
    }): Promise<T>;
}
export interface PiBindingOptions {
    locale?: Locale | string;
    messages?: MessageOverrides;
}
/**
 * Host keys first (`tui.select.*`), with readable labels (`↑`, `Enter`, `Esc`, `PgDn`). A host remap
 * that collides with a default no longer prevents the panel from opening: the host key wins.
 */
export declare function piBindings(keys: KeybindingsManager, reserved?: readonly string[], ctrlS?: boolean, options?: PiBindingOptions): Binding[];
/** A temporary host component: no writes to process streams, no editor/footer replacement. */
export declare class PiSettingsPanel implements Component {
    focused: boolean;
    readonly controller: PanelController;
    private input;
    private editingId;
    private disposed;
    private pasting;
    private pending;
    readonly theme: PiTheme;
    readonly requestRender: () => void;
    readonly done: () => void;
    readonly rows: () => number;
    readonly reserved: readonly string[];
    constructor(options: PanelControllerOptions, theme: PiTheme, requestRender: () => void, done: () => void, rows: () => number, task?: PanelTask, reserved?: readonly string[]);
    invalidate(): void;
    private syncInput;
    private execute;
    handleInput(data: string): void;
    render(columns: number): string[];
    drain(): Promise<void>;
    dispose(): void;
}
export interface PiSettingsOptions extends Omit<PanelControllerOptions, "bindings"> {
    signal: AbortSignal;
    reservedKeys?: string[];
    /** Ctrl+S saves and keeps the panel open. Default true. */
    ctrlS?: boolean;
    task?: PanelTask;
    overlay?: PiOverlayOptions;
}
/**
 * `value` is always the persisted snapshot. `action` is the id of an action row that closed the
 * panel (`closeWith`), with its `actionValue`.
 */
export type PiSettingsResult = TerminalResult<Values> & {
    action?: string;
    actionValue?: unknown;
};
/**
 * Pi defaults: English unless `locale` (or a session locale) is given, standard presentation,
 * second Esc discards, cancellable save, resize message below 40×12. Pass the options explicitly
 * to opt out.
 *
 * With a cancellable save, a `persist` that ignores its AbortSignal past `cancelGraceMs` leaves
 * the outcome unknown: pass `reconcile` (a fresh storage read), or the panel asks before writing
 * the draft again.
 */
export declare function openPiSettings(ui: PiUI, options: PiSettingsOptions): Promise<PiSettingsResult>;
export interface PiWorkspaceOptions {
    /** Default `["ctrl+c"]` (the host keeps Ctrl+C). */
    reservedKeys?: string[];
    overlay?: PiOverlayOptions;
    locale?: Locale | string;
    messages?: MessageOverrides;
    title?: string;
    scope?: string;
    help?: string;
    /**
     * Below 40×12. Default: the model's own `narrow` when it was given to `new WorkspaceModel`,
     * otherwise `resize`.
     */
    narrow?: "linear" | "resize";
}
export declare function openPiWorkspace(ui: PiUI, model: WorkspaceModel, signal: AbortSignal, reservedKeysOrOptions?: string[] | PiWorkspaceOptions): Promise<void>;
