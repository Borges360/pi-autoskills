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
export type FormatError = (
  error: unknown,
  context: ErrorContext,
) => string | undefined;
/** Cancellation acknowledged by the work: `OperationCancelled`, `AbortError` or `code: "CANCELLED"`. */
export function isCancellation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { name?: unknown; code?: unknown };
  return (
    e.name === "AbortError" ||
    e.name === "OperationCancelled" ||
    e.code === "CANCELLED" ||
    e.code === "ABORT_ERR"
  );
}
/** Safe call of a product formatter: exceptions and empty text fall back to `fallback`. */
export function formatProductError(
  format: FormatError | undefined,
  error: unknown,
  context: ErrorContext,
  fallback: string,
): string {
  if (!format) return fallback;
  try {
    const text = format(error, context);
    return typeof text === "string" && text.trim() ? text : fallback;
  } catch {
    return fallback;
  }
}
