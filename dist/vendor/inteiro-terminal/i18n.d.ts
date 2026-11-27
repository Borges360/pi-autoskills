import type { ActionId, OperationState } from "./contracts.ts";
/** UI locales shipped with the package. Unknown locales fall back to English. */
export type Locale = "en" | "pt-BR";
export declare const DEFAULT_LOCALE: Locale;
export declare const LOCALES: readonly Locale[];
type Text = string;
type Fn<A extends unknown[]> = (...args: A) => string;
/** Every visible string of the package. Functions receive already sanitized values. */
export interface TerminalMessages {
    actionSave: Text;
    actionCancelOperation: Text;
    actionHelp: Text;
    actionClose: Text;
    actionReconcile: Text;
    helpModePanel: Text;
    helpModeWorkspace: Text;
    unsavedChangesQuestion: Text;
    decisionContinue: Text;
    decisionSaveClose: Text;
    decisionDiscard: Text;
    decisionEscapeDiscards: Text;
    confirmBack: Text;
    confirmRun: Fn<[label: string]>;
    unknownOutcomeConfirm: Text;
    saveRetryConfirm: Text;
    confirmSaveAgain: Text;
    actionRequiresSaved: Text;
    actionDisabled: Fn<[reason: string]>;
    actionDone: Fn<[label: string]>;
    finishedBeforeCancel: Fn<[label: string]>;
    noSearchResults: Text;
    searchItems: Text;
    searchPrompt: Text;
    loadingChoices: Fn<[label: string]>;
    noChoices: Text;
    hintNavigate: Text;
    hintEditOpen: Text;
    hintFinishField: Text;
    hintChoose: Text;
    hintToggle: Text;
    hintActions: Text;
    hintSave: Text;
    hintBack: Text;
    hintClose: Text;
    hintDiscard: Text;
    hintKeepEditing: Text;
    hintCancelOperation: Text;
    hintCancelSave: Text;
    hintSearch: Text;
    hintApply: Text;
    hintScroll: Text;
    hintRun: Text;
    duplicateFieldIds: Text;
    missingValue: Fn<[id: string]>;
    unknownField: Text;
    protectedValue: Text;
    overrideStatus: Fn<[source: string]>;
    lockedStatus: Fn<[source: string]>;
    invalidValue: Text;
    duplicateChoice: Text;
    unavailableChoice: Text;
    validatorFailed: Text;
    reconcileBeforeSave: Text;
    saveUnavailable: Text;
    sessionEnded: Text;
    invalidSaveTimeout: Text;
    fixFields: Text;
    saving: Text;
    saveUnconfirmed: Text;
    saved: Text;
    saveFailed: Text;
    saveCancelled: Text;
    saveTimedOut: Text;
    invalidPersistedState: Text;
    storageReconciled: Text;
    waitForSave: Text;
    cancelRequested: Text;
    checkResultFirst: Text;
    operationUnavailable: Text;
    timeoutRequired: Text;
    operationRunning: Text;
    operationStarting: Text;
    operationDone: Text;
    operationUnconfirmed: Text;
    operationCancelled: Text;
    operationFailed: Text;
    noPendingResult: Text;
    operationStates: Record<OperationState, string>;
    actionMarker: Text;
    unavailable: Fn<[reason: string]>;
    unavailableShort: Fn<[reason: string]>;
    noItems: Text;
    origin: Fn<[source: string]>;
    locked: Fn<[source: string]>;
    errorPrefix: Text;
    protectedInput: Text;
    selectedCount: Fn<[count: number]>;
    finishSelection: Text;
    searchField: Fn<[query: string]>;
    searchResults: Fn<[count: number]>;
    noFilterResults: Text;
    confirmObject: Fn<[object: string]>;
    confirmDestination: Fn<[destination: string]>;
    confirmKeepEditing: Text;
    changesIn: Fn<[scope: string]>;
    saveHasNoExternalEffects: Text;
    statusSuccess: Text;
    statusWarning: Text;
    statusDanger: Text;
    statusInfo: Text;
    cancelOperationButton: Text;
    sortedBy: Fn<[label: string, direction: "asc" | "desc"]>;
    originalOrder: Text;
    record: Fn<[index: number]>;
    moreColumns: Text;
    unknownColumn: Text;
    invalidLogLimit: Text;
    logsHeader: Fn<[paused: boolean]>;
    logsDropped: Fn<[count: number]>;
    emptyData: Text;
    emptyFiltered: Text;
    emptyUnavailable: Text;
    helpTitle: Fn<[mode: string]>;
    helpFooter: Text;
    actionNames: Record<ActionId, string>;
    unsavedChanges: Text;
    noChanges: Text;
    linesRange: Fn<[first: number, last: number, total: number]>;
    fullMessageInHelp: Text;
    useLinearMode: Text;
    draftPreserved: Text;
    linearButtons: Text;
    terminalTooSmall: Fn<[
        columns: number,
        rows: number,
        minColumns: number,
        minRows: number
    ]>;
    enlargeOrClose: Text;
    /** Resize message for surfaces without a draft (workspace). */
    enlargeOrGoBack: Text;
    valueOn: Text;
    valueOff: Text;
    emptyValue: Text;
    noneSelected: Text;
    keySpace: Text;
    keyUp: Text;
    keyDown: Text;
    duplicateBinding: Fn<[id: string]>;
    actionFailed: Text;
    openFailed: Text;
    inputRequired: Fn<[names: string]>;
    workspaceTitle: Text;
    workspaceScope: Text;
    workspaceHelp: Text;
    workspaceHints: Text;
    workspaceResults: Text;
    workspaceTable: Text;
    workspaceLogs: Text;
    workspaceSort: Text;
    workspacePauseLogs: Text;
    workspaceResumeLogs: Text;
    workspaceClose: Text;
    workspaceNoResult: Text;
}
export declare const MESSAGES: Readonly<Record<Locale, TerminalMessages>>;
/** `pt*` → pt-BR, anything else (including unknown or empty) → en. `undefined` keeps the package default. */
export declare function normalizeLocale(locale?: string): Locale;
export type MessageOverrides = {
    [K in keyof TerminalMessages]?: TerminalMessages[K] extends Record<string, string> ? Partial<TerminalMessages[K]> : TerminalMessages[K];
};
/**
 * Resolves the catalog for a locale plus partial overrides. Overrides of the wrong type,
 * empty strings or functions that return empty text fall back to the locale catalog, so the
 * UI never shows an internal key or an empty label.
 */
export declare function resolveMessages(locale?: string, overrides?: MessageOverrides): TerminalMessages;
export {};
