/** Where a product error happened, so `formatError` can explain cause and recovery. */
export interface ErrorContext {
    phase: "save" | "action" | "task" | "loadChoices" | "reconcile";
    /** Field or action id, when there is one. */
    id?: string;
    /** Visible label of the field or action, when there is one. */
    label?: string;
}
/**
 * Product hook for user-facing error text: return cause + recovery, never payloads, secrets or
 * stack traces. `undefined` (or empty text) keeps the package message.
 */
export type FormatError = (error: unknown, context: ErrorContext) => string | undefined;
/** Cancellation acknowledged by the work: `OperationCancelled`, `AbortError` or `code: "CANCELLED"`. */
export declare function isCancellation(error: unknown): boolean;
/** Safe call of a product formatter: exceptions and empty text fall back to `fallback`. */
export declare function formatProductError(format: FormatError | undefined, error: unknown, context: ErrorContext, fallback: string): string;
