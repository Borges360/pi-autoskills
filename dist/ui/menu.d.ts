import { type PiUI } from "../vendor/inteiro-terminal/pi.js";
import { type Locale } from "../common/i18n.js";
export declare const modes: readonly ["auto", "observe", "off"];
export type Mode = (typeof modes)[number];
/** Everything the menu needs from the host; no Pi or storage handle leaks into the panel. */
export interface MenuOptions {
    ui: PiUI;
    /** Product name shown as the panel title. */
    title: string;
    /** Action groups in display order (Active, Suggestions, Agents, Settings). `config`/`mode` become the Mode field. */
    groups: Record<string, readonly string[]>;
    /** Pi project trust; the language preference is saved per trusted project only. */
    trusted: boolean;
    /** Saved interface language of this project. */
    locale: Locale;
    /** The saved language file exists but is invalid (English is the fallback). */
    invalidLocale?: boolean;
    /** Project storage could not start: the menu still opens; Mode and Doctor keep working. */
    storageUnavailable?: boolean;
    /** Owner signal: session shutdown or reload closes the menu. */
    signal: AbortSignal;
    /** Effective mode right now. */
    mode(): Mode;
    saveMode(mode: Mode, signal?: AbortSignal): Promise<void>;
    saveLocale(locale: Locale, signal: AbortSignal): Promise<void>;
    /** Fresh read of the stored mode and language, used after an unconfirmed save. */
    readStored(signal: AbortSignal): Promise<{
        mode: Mode;
        locale: Locale;
    }>;
    /** Runs a read-only command (`show`, `explain`, `detect`, `agents`, `doctor`). */
    run(action: string, signal: AbortSignal): Promise<unknown>;
    /** Posts a command result to the chat. */
    show(value: unknown): void;
}
/** Stable product error codes; formatError turns them into translated cause + recovery text. */
export declare class MenuError extends Error {
    readonly reason: "trusted-project-required" | "mode-save-failed" | "locale-save-failed" | "action-timed-out" | "storage-unavailable";
    constructor(reason: "trusted-project-required" | "mode-save-failed" | "locale-save-failed" | "action-timed-out" | "storage-unavailable", options?: ErrorOptions);
}
/**
 * The /autoskills menu: one panel with the Mode and Language fields (Settings, drafts saved with
 * Ctrl+S) followed by the read-only actions of the Active, Suggestions, Agents and Settings groups.
 * The group of each action is shown in its value column. Results go to the chat, as before.
 */
export declare function openMenu(o: MenuOptions): Promise<void>;
