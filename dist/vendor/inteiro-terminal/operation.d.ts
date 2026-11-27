import type { OperationState, TerminalResult } from "./contracts.ts";
import { type Locale, type MessageOverrides, type TerminalMessages } from "./i18n.ts";
import { type ErrorContext, type FormatError } from "./errors.ts";
/** A product can report cancellation only after confirming that its work stopped. */
export declare class OperationCancelled extends Error {
    name: string;
}
export interface OperationOptions {
    locale?: Locale | string;
    messages?: MessageOverrides;
    /** Time the work has to settle after abort before the outcome is unknown. Default 100 ms. */
    cancelGraceMs?: number;
    formatError?: FormatError;
}
export interface RunOptions<T> {
    /** Product error text (cause + recovery); overrides the operation-level hook. */
    formatError?: FormatError;
    /** Context passed to `formatError`. Default `{ phase: "task" }`. */
    context?: ErrorContext;
    /** Final message from the returned value; empty/undefined keeps the default. */
    describe?: (value: T) => string | undefined;
    /** Progress label shown until the work reports its own. Default: the "starting" message. */
    label?: string;
}
export declare class Operation<T> {
    state: OperationState;
    message: string;
    progress: {
        label: string;
        completed?: number;
        total?: number;
    };
    /**
     * True when the last run succeeded although Esc (`cancel`) or the timeout had already aborted
     * its signal. The value is real, but the person asked to stop: do not act on it.
     */
    cancelRequested: boolean;
    private controller;
    private generation;
    private disposed;
    readonly owner: string;
    readonly effect: "local" | "external";
    messages: TerminalMessages;
    private readonly options;
    constructor(owner: string, effect?: "local" | "external", options?: OperationOptions);
    setLocale(locale: Locale | string, messages?: MessageOverrides): void;
    get active(): boolean;
    get percent(): number | undefined;
    cancel(): void;
    run(work: (signal: AbortSignal, report: (label: string, completed?: number, total?: number) => void) => Promise<T>, timeoutMs: number, runOptions?: RunOptions<T>): Promise<TerminalResult<T>>;
    reconcile(state: "succeeded" | "failed" | "cancelled", message: string): void;
    dispose(): void;
}
