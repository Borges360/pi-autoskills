import type { ActionId, Binding } from "./contracts.ts";
import { type Locale, type MessageOverrides, type TerminalMessages } from "./i18n.ts";
export declare const DEFAULT_BINDINGS: readonly Binding[];
/** Human key label from a host key id: `pageDown` → `PgDn`, `ctrl+s` → `Ctrl+S`, `escape` → `Esc`. */
export declare function keyLabel(key: string, messages?: TerminalMessages): string;
export interface BindingOptions {
    /** Relabels default bindings with readable, localized key labels (`↑`, `Esc`, `Space`). */
    locale?: Locale | string;
    messages?: MessageOverrides;
}
export declare function resolveBindings(overrides?: readonly Binding[], reserved?: readonly string[], ctrlS?: boolean, options?: BindingOptions): Binding[];
/** Same as `resolveBindings` with options, but drops colliding overrides instead of throwing. */
export declare function resolveBindingsLenient(overrides?: readonly Binding[], reserved?: readonly string[], ctrlS?: boolean, options?: BindingOptions): Binding[];
export declare function keyAction(key: string, bindings: readonly Binding[], context: "navigation" | "field" | "operation", pasted?: boolean): ActionId | undefined;
export declare function keyHints(bindings: readonly Binding[], actions: Partial<Record<ActionId, string>>, separator?: string): string;
/**
 * Hints that only show actions with a binding. `navigate` merges up/down labels (`↑↓ navigate`);
 * an empty label hides the entry.
 */
export declare function standardKeyHints(bindings: readonly Binding[], actions: readonly (readonly [ActionId | "navigate", string])[], separator?: string): string;
