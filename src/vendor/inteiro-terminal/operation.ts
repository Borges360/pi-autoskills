import type { OperationState, TerminalResult } from "./contracts.ts";
import {
  resolveMessages,
  type Locale,
  type MessageOverrides,
  type TerminalMessages,
} from "./i18n.ts";
import {
  formatProductError,
  isCancellation,
  type ErrorContext,
  type FormatError,
} from "./errors.ts";
/** A product can report cancellation only after confirming that its work stopped. */
export class OperationCancelled extends Error {
  override name = "OperationCancelled";
}
class UnknownOutcome extends Error {}
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
export class Operation<T> {
  state: OperationState = "idle";
  message = "";
  progress: { label: string; completed?: number; total?: number } = {
    label: "",
  };
  /**
   * True when the last run succeeded although Esc (`cancel`) or the timeout had already aborted
   * its signal. The value is real, but the person asked to stop: do not act on it.
   */
  cancelRequested = false;
  private controller: AbortController | undefined;
  private generation = 0;
  private disposed = false;
  readonly owner: string;
  readonly effect: "local" | "external";
  messages: TerminalMessages;
  private readonly options: OperationOptions;
  constructor(
    owner: string,
    effect: "local" | "external" = "local",
    options: OperationOptions = {},
  ) {
    this.owner = owner;
    this.effect = effect;
    this.options = options;
    this.messages = resolveMessages(options.locale, options.messages);
  }
  setLocale(locale: Locale | string, messages?: MessageOverrides) {
    this.messages = resolveMessages(locale, messages ?? this.options.messages);
  }
  get active() {
    return this.state === "running" || this.state === "cancelling";
  }
  get percent() {
    const { completed, total } = this.progress;
    return total !== undefined && total > 0 && completed !== undefined
      ? Math.max(0, Math.min(100, (completed / total) * 100))
      : undefined;
  }
  cancel() {
    if (this.state === "running") {
      this.state = "cancelling";
      this.message = this.messages.cancelRequested;
      this.controller?.abort();
    }
  }
  async run(
    work: (
      signal: AbortSignal,
      report: (label: string, completed?: number, total?: number) => void,
    ) => Promise<T>,
    timeoutMs: number,
    runOptions: RunOptions<T> = {},
  ): Promise<TerminalResult<T>> {
    const m = this.messages;
    if (this.disposed || this.active || this.state === "outcomeUnknown")
      return {
        status: "invalid",
        message:
          this.state === "outcomeUnknown"
            ? m.checkResultFirst
            : m.operationUnavailable,
      };
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0)
      throw new Error(m.timeoutRequired);
    const generation = ++this.generation,
      controller = new AbortController();
    this.controller = controller;
    this.state = "running";
    this.cancelRequested = false;
    this.message = m.operationRunning;
    this.progress = {
      label: runOptions.label?.trim() ? runOptions.label : m.operationStarting,
    };
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let cancellationDeadline: ReturnType<typeof setTimeout> | undefined;
    const abortResult = new Promise<never>((_, reject) => {
      controller.signal.addEventListener(
        "abort",
        () => {
          cancellationDeadline = setTimeout(
            () => reject(new UnknownOutcome()),
            Math.max(0, this.options.cancelGraceMs ?? 100),
          );
        },
        { once: true },
      );
      timeout = setTimeout(() => {
        if (generation === this.generation) this.cancel();
      }, timeoutMs);
    });
    try {
      const value = await Promise.race([
        work(controller.signal, (label, completed, total) => {
          if (
            this.disposed ||
            generation !== this.generation ||
            controller.signal.aborted
          )
            return;
          this.progress = {
            label,
            ...(completed !== undefined ? { completed } : {}),
            ...(total !== undefined ? { total } : {}),
          };
        }),
        abortResult,
      ]);
      if (this.disposed || generation !== this.generation)
        return { status: "cancelled", message: m.sessionEnded };
      // Work that completed is reported as completed (1.3 contract), but callers can tell that
      // the person had already asked to stop and must not act on the value (close, open, …).
      this.cancelRequested = controller.signal.aborted;
      let message = m.operationDone;
      try {
        const described = runOptions.describe?.(value);
        if (typeof described === "string" && described.trim())
          message = described;
      } catch {
        /* keep the default message */
      }
      this.state = "succeeded";
      this.message = message;
      return { status: "succeeded", value };
    } catch (error) {
      const aborted = controller.signal.aborted;
      // Explicit acknowledgement always counts; AbortError or a rejection after abort only
      // proves a stop for local work (an external request may already have been applied).
      const confirmed =
        !(error instanceof UnknownOutcome) &&
        (error instanceof OperationCancelled ||
          (error as { name?: unknown } | undefined)?.name ===
            "OperationCancelled" ||
          (error as { code?: unknown } | undefined)?.code === "CANCELLED" ||
          (this.effect === "local" && (aborted || isCancellation(error))));
      const state = confirmed
        ? "cancelled"
        : error instanceof UnknownOutcome ||
            this.effect === "external" ||
            aborted
          ? "outcomeUnknown"
          : "failed";
      const message =
        state === "outcomeUnknown"
          ? m.operationUnconfirmed
          : state === "cancelled"
            ? m.operationCancelled
            : formatProductError(
                runOptions.formatError ?? this.options.formatError,
                error,
                runOptions.context ?? { phase: "task" },
                m.operationFailed,
              );
      if (!this.disposed && generation === this.generation) {
        this.state = state;
        this.message = message;
      }
      return { status: state, message };
    } finally {
      clearTimeout(timeout);
      clearTimeout(cancellationDeadline);
      if (generation === this.generation) this.controller = undefined;
    }
  }
  reconcile(state: "succeeded" | "failed" | "cancelled", message: string) {
    if (this.state !== "outcomeUnknown")
      throw new Error(this.messages.noPendingResult);
    this.state = state;
    this.message = message;
  }
  dispose() {
    this.disposed = true;
    this.generation++;
    this.controller?.abort();
    this.controller = undefined;
  }
}
