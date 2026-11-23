import type { Choice, Field, Value, Values, TerminalResult } from "./contracts.ts";
import { type Locale, type MessageOverrides, type TerminalMessages } from "./i18n.ts";
import { type FormatError } from "./errors.ts";
export type Persist = (values: Readonly<Values>, signal: AbortSignal) => Promise<void>;
export interface SaveOptions {
    signal?: AbortSignal | undefined;
    timeoutMs?: number;
    formatError?: FormatError | undefined;
}
export interface SettingsSessionOptions {
    /** UI language of session messages. Default: pt-BR (package compatibility). */
    locale?: Locale | string;
    /** Partial message overrides; empty or invalid entries fall back to the catalog. */
    messages?: MessageOverrides;
    /** Product text for storage errors (cause + recovery, no payload). */
    formatError?: FormatError;
    /** Default save timeout. Default 15000 ms; extensions that download or migrate may need minutes. */
    saveTimeoutMs?: number;
    /**
     * Cancellable save: `cancelSave()`, timeout or the caller's signal abort the persist and wait
     * `cancelGraceMs` for it to settle. A persist that rejects after abort (or with AbortError /
     * code CANCELLED) is a confirmed cancellation: the draft stays and saving can be retried.
     * Only a persist that does not settle becomes `outcomeUnknown`. Default false (1.3 behavior).
     */
    cancellableSave?: boolean;
    /** Grace period for a cancelled persist to settle. Default 100 ms. */
    cancelGraceMs?: number;
}
export type StatusKind = "" | "info" | "success" | "warning" | "error";
export declare class PersistenceOutcomeUnknown extends Error {
}
/** Snapshot ownership prevents consumers from mutating persisted state through shared references. */
export declare class SettingsSession {
    private stored;
    private working;
    private editor;
    private controller;
    private userCancel;
    private generation;
    private disposed;
    private persistenceUnknown;
    private currentFields;
    private loaded;
    private options;
    messages: TerminalMessages;
    /** Current UI locale of the session messages. */
    locale: Locale;
    /** False while the locale is the package default (no `locale` option, no `setLocale`). */
    private localeChosen;
    errors: Record<string, string>;
    focusedId: string;
    private statusText;
    /** Tone of `status`, for renderers that color feedback. Set together with `status`. */
    statusKind: StatusKind;
    closeDecision: boolean;
    closed: boolean;
    constructor(fields: readonly Field[], initial: Values, options?: SettingsSessionOptions);
    get fields(): readonly Field[];
    /** Plain assignment keeps 1.3 semantics (neutral tone); use `setStatus` to set a tone. */
    get status(): string;
    set status(value: string);
    setStatus(value: string, kind?: StatusKind): void;
    /** Adjusts save policy after construction (used by controllers/adapters). */
    configure(options: Pick<SettingsSessionOptions, "formatError" | "saveTimeoutMs" | "cancellableSave" | "cancelGraceMs">): void;
    get cancellableSave(): boolean;
    /** True after an unconfirmed save; saving stays blocked until `reconcilePersistence` or `allowSaveRetry`. */
    get outcomeUnknown(): boolean;
    /** Switches session messages (live preview of the UI language). Values are untouched. */
    setLocale(locale: Locale | string, messages?: MessageOverrides): void;
    /** True when a locale was given (constructor option or `setLocale`), not the package default. */
    get hasLocale(): boolean;
    /** Replaces labels/descriptions/choices with a translated set. Ids and kinds must match. */
    relabelFields(fields: readonly Field[]): void;
    /** Choices currently valid for a field: loaded ones first, then static ones. */
    choicesOf(field: Field): readonly Choice[] | undefined;
    setChoices(id: string, choices: readonly Choice[]): void;
    get persisted(): Values;
    get draft(): Values;
    get effective(): Values;
    get editing(): {
        id: string;
        value: Value;
    } | undefined;
    get saving(): boolean;
    get dirty(): boolean;
    get changes(): {
        id: string;
        label: string;
        before: Value | undefined;
        after: Value | undefined;
    }[];
    begin(id: string): void;
    edit(value: Value): void;
    private error;
    confirmEdit(): boolean;
    /** Leaves the field without applying the edit; its validation error goes with it. */
    abandonEdit(): void;
    validate(): boolean;
    /** Requests cancellation of the running save (cancellable sessions only). */
    cancelSave(): boolean;
    save(persist: Persist, options?: SaveOptions): Promise<TerminalResult<Values>>;
    /**
     * After an unconfirmed save without a storage read, lets the user explicitly write the draft
     * again. The persisted snapshot is unchanged, so the draft stays dirty until that save succeeds.
     */
    allowSaveRetry(): void;
    /** The consumer supplies a fresh storage read; this never repeats a write. */
    reconcilePersistence(current: Values): void;
    back(): void;
    decide(decision: "continue" | "saveClose" | "discard", persist: Persist, options?: SaveOptions): Promise<void>;
    dispose(): void;
}
