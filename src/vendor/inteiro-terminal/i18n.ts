import type { ActionId, OperationState } from "./contracts.ts";
/** UI locales shipped with the package. Unknown locales fall back to English. */
export type Locale = "en" | "pt-BR";
export const DEFAULT_LOCALE: Locale = "pt-BR";
export const LOCALES: readonly Locale[] = ["en", "pt-BR"];
type Text = string;
type Fn<A extends unknown[]> = (...args: A) => string;
/** Every visible string of the package. Functions receive already sanitized values. */
export interface TerminalMessages {
  // panel actions and decision
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
  // hints
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
  // settings session
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
  // operation
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
  // components
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
  terminalTooSmall: Fn<
    [columns: number, rows: number, minColumns: number, minRows: number]
  >;
  enlargeOrClose: Text;
  /** Resize message for surfaces without a draft (workspace). */
  enlargeOrGoBack: Text;
  valueOn: Text;
  valueOff: Text;
  emptyValue: Text;
  noneSelected: Text;
  // keyboard and adapters
  keySpace: Text;
  keyUp: Text;
  keyDown: Text;
  duplicateBinding: Fn<[id: string]>;
  actionFailed: Text;
  openFailed: Text;
  inputRequired: Fn<[names: string]>;
  // workspace
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
const pt: TerminalMessages = {
  actionSave: "Salvar alterações",
  actionCancelOperation: "Cancelar operação",
  actionHelp: "Ajuda",
  actionClose: "Fechar",
  actionReconcile: "Conferir armazenamento",
  helpModePanel: "painel",
  helpModeWorkspace: "workspace",
  unsavedChangesQuestion: "Há alterações não salvas.",
  decisionContinue: "Continuar editando",
  decisionSaveClose: "Salvar e fechar",
  decisionDiscard: "Descartar alterações",
  decisionEscapeDiscards: "Esc novamente descarta as alterações e fecha.",
  confirmBack: "Voltar",
  confirmRun: (label) => `Executar: ${label}`,
  unknownOutcomeConfirm:
    "A execução anterior não confirmou o resultado. Confira o destino antes de repetir.",
  saveRetryConfirm:
    "O salvamento anterior não foi confirmado. Salvar de novo grava o rascunho outra vez.",
  confirmSaveAgain: "Salvar de novo",
  actionRequiresSaved:
    "Salve (Ctrl+S) ou descarte as alterações antes de executar esta ação.",
  actionDisabled: (reason) => `Indisponível: ${reason}`,
  actionDone: (label) => `${label}: concluído.`,
  finishedBeforeCancel: (label) =>
    `${label} terminou antes de o cancelamento valer. O resultado não foi usado.`,
  noSearchResults: "Nenhum resultado. Limpe a busca.",
  searchItems: "Buscar itens",
  searchPrompt: "Buscar itens (vazio limpa)",
  loadingChoices: (label) => `Carregando opções de ${label}`,
  noChoices: "Nenhuma opção disponível.",
  hintNavigate: "navegar",
  hintEditOpen: "editar/abrir",
  hintFinishField: "concluir campo",
  hintChoose: "escolher",
  hintToggle: "marcar",
  hintActions: "ações",
  hintSave: "salvar",
  hintBack: "voltar",
  hintClose: "fechar",
  hintDiscard: "descartar",
  hintKeepEditing: "continuar editando",
  hintCancelOperation: "cancelar operação",
  hintCancelSave: "cancelar salvamento",
  hintSearch: "buscar",
  hintApply: "aplicar",
  hintScroll: "rolar",
  hintRun: "executar",
  duplicateFieldIds: "IDs de campos duplicados",
  missingValue: (id) => `Valor ausente: ${id}`,
  unknownField: "Campo desconhecido",
  protectedValue: "[protegido]",
  overrideStatus: (source) => `Valor definido por ${source}. Altere a origem.`,
  lockedStatus: (source) => `Bloqueado por ${source}. Altere a origem.`,
  invalidValue: "Informe um valor válido.",
  duplicateChoice: "Escolha cada opção apenas uma vez.",
  unavailableChoice: "Selecione uma opção disponível.",
  validatorFailed:
    "Não foi possível validar este campo. Verifique a regra do produto.",
  reconcileBeforeSave:
    "Consulte o armazenamento antes de repetir o salvamento.",
  saveUnavailable: "Salvamento indisponível.",
  sessionEnded: "Sessão encerrada.",
  invalidSaveTimeout: "Timeout de salvamento inválido.",
  fixFields: "Corrija os campos indicados.",
  saving: "Salvando…",
  saveUnconfirmed:
    "Confirmação não recebida. Consulte o armazenamento antes de repetir.",
  saved: "Alterações salvas.",
  saveFailed:
    "Não foi possível salvar. O rascunho foi preservado. Tente novamente.",
  saveCancelled: "Salvamento cancelado. O rascunho foi preservado.",
  saveTimedOut:
    "O salvamento excedeu o prazo e foi interrompido. O rascunho foi preservado.",
  invalidPersistedState: "Estado persistido inválido",
  storageReconciled: "Armazenamento conferido. Revise as alterações pendentes.",
  waitForSave: "Aguarde a confirmação do salvamento.",
  cancelRequested: "Cancelamento solicitado. Aguardando confirmação.",
  checkResultFirst: "Consulte o resultado antes de repetir.",
  operationUnavailable: "Operação indisponível.",
  timeoutRequired: "Timeout obrigatório",
  operationRunning: "Operação em andamento.",
  operationStarting: "Iniciando",
  operationDone: "Operação concluída.",
  operationUnconfirmed:
    "Confirmação não recebida. Consulte o destino antes de repetir.",
  operationCancelled: "Operação cancelada.",
  operationFailed: "Operação falhou. Consulte o diagnóstico e tente novamente.",
  noPendingResult: "Não há resultado pendente",
  operationStates: {
    idle: "parada",
    running: "em andamento",
    cancelling: "cancelando",
    succeeded: "concluída",
    failed: "falhou",
    cancelled: "cancelada",
    outcomeUnknown: "resultado desconhecido",
  },
  actionMarker: "[ação]",
  unavailable: (reason) => `[indisponível: ${reason}]`,
  unavailableShort: (reason) => `Indisponível: ${reason}`,
  noItems: "Nenhum item. Altere a busca ou volte.",
  origin: (source) => `[origem: ${source}]`,
  locked: (source) => `[bloqueado: ${source}]`,
  errorPrefix: "Erro:",
  protectedInput: "[entrada protegida]",
  selectedCount: (count) => `${count} selecionados`,
  finishSelection: "[Concluir seleção]",
  searchField: (query) => `Buscar: ${query} [Limpar busca]`,
  searchResults: (count) => `${count} resultados`,
  noFilterResults: "Nenhum resultado para este filtro. Limpe a busca.",
  confirmObject: (object) => `Objeto: ${object}`,
  confirmDestination: (destination) => `Destino: ${destination}`,
  confirmKeepEditing: "Continuar editando",
  changesIn: (scope) => `Alterações em ${scope}`,
  saveHasNoExternalEffects: "Salvar configuração não executa ações externas.",
  statusSuccess: "Concluído",
  statusWarning: "Atenção",
  statusDanger: "Erro",
  statusInfo: "Informação",
  cancelOperationButton: "[Cancelar operação]",
  sortedBy: (label, direction) => `Ordenado por ${label}: ${direction}`,
  originalOrder: "Ordem original",
  record: (index) => `Registro ${index}`,
  moreColumns: "Mais colunas disponíveis no detalhe e no modo linear.",
  unknownColumn: "Coluna desconhecida",
  invalidLogLimit: "Limite de histórico inválido",
  logsHeader: (paused) =>
    `Logs: ${paused ? "pausado" : "acompanhando"} [${paused ? "Retomar" : "Pausar"}]`,
  logsDropped: (count) =>
    `${count} linhas antigas removidas · [Exportar texto]`,
  emptyData: "Nenhum dado disponível.",
  emptyFiltered: "Nenhum resultado para o filtro.",
  emptyUnavailable: "Dependência indisponível.",
  helpTitle: (mode) => `Ajuda — modo ${mode}`,
  helpFooter:
    "Salvar é uma ação visível mesmo sem atalho. Esc volta; alterações pendentes exigem decisão.",
  actionNames: {
    "navigate.up": "subir",
    "navigate.down": "descer",
    "navigate.first": "primeiro item",
    "navigate.last": "último item",
    "navigate.pageUp": "página anterior",
    "navigate.pageDown": "próxima página",
    activate: "editar, escolher ou executar",
    toggle: "marcar opção",
    nextRegion: "próxima região",
    previousRegion: "região anterior",
    back: "voltar, cancelar ou fechar",
    save: "salvar",
    help: "ajuda",
    search: "buscar",
    close: "fechar",
    cancelOperation: "cancelar operação",
  },
  unsavedChanges: "Alterações não salvas",
  noChanges: "Sem alterações",
  linesRange: (first, last, total) => `${first}-${last} de ${total} linhas`,
  fullMessageInHelp: "Mensagem completa disponível em Ajuda.",
  useLinearMode: "Use o modo linear.",
  draftPreserved: "O rascunho foi preservado.",
  linearButtons: "[Modo linear] [Voltar]",
  terminalTooSmall: (columns, rows, minColumns, minRows) =>
    `Terminal pequeno demais (${columns}×${rows}; mínimo ${minColumns}×${minRows}).`,
  enlargeOrClose:
    "Aumente a janela para continuar ou pressione Esc para voltar. O rascunho foi preservado.",
  enlargeOrGoBack:
    "Aumente a janela para continuar ou pressione Esc para voltar.",
  valueOn: "ligado",
  valueOff: "desligado",
  emptyValue: "(vazio)",
  noneSelected: "nenhum",
  keySpace: "Espaço",
  keyUp: "Cima",
  keyDown: "Baixo",
  duplicateBinding: (id) => `Binding duplicado: ${id}`,
  actionFailed: "Ação falhou. O rascunho foi preservado.",
  openFailed: "Não foi possível abrir o painel. Verifique a API do host.",
  inputRequired: (names) =>
    `Entrada necessária: ${names}. Informe os argumentos em modo sem entrada.`,
  workspaceTitle: "Diagnóstico / Workspace",
  workspaceScope: "projeto atual",
  workspaceHelp:
    "Tab alterna conteúdo e ações. Setas navegam. Enter ativa. Esc fecha.",
  workspaceHints: "Tab ações · Enter abrir · Esc voltar",
  workspaceResults: "Resultados",
  workspaceTable: "Tabela",
  workspaceLogs: "Logs",
  workspaceSort: "Ordenar",
  workspacePauseLogs: "Pausar logs",
  workspaceResumeLogs: "Retomar logs",
  workspaceClose: "Fechar",
  workspaceNoResult: "Nenhum resultado",
};
const en: TerminalMessages = {
  actionSave: "Save changes",
  actionCancelOperation: "Cancel operation",
  actionHelp: "Help",
  actionClose: "Close",
  actionReconcile: "Check storage",
  helpModePanel: "panel",
  helpModeWorkspace: "workspace",
  unsavedChangesQuestion: "There are unsaved changes.",
  decisionContinue: "Keep editing",
  decisionSaveClose: "Save and close",
  decisionDiscard: "Discard changes",
  decisionEscapeDiscards: "Press Esc again to discard the changes and close.",
  confirmBack: "Go back",
  confirmRun: (label) => `Run: ${label}`,
  unknownOutcomeConfirm:
    "The previous run did not confirm its result. Check the destination before running it again.",
  saveRetryConfirm:
    "The previous save was not confirmed. Saving again writes your draft again.",
  confirmSaveAgain: "Save again",
  actionRequiresSaved:
    "Save (Ctrl+S) or discard your changes before running this action.",
  actionDisabled: (reason) => `Unavailable: ${reason}`,
  actionDone: (label) => `${label}: done.`,
  finishedBeforeCancel: (label) =>
    `${label} finished before the cancellation took effect. Its result was not used.`,
  noSearchResults: "No results. Clear the search.",
  searchItems: "Search items",
  searchPrompt: "Search items (empty clears)",
  loadingChoices: (label) => `Loading options for ${label}`,
  noChoices: "No options available.",
  hintNavigate: "navigate",
  hintEditOpen: "edit/open",
  hintFinishField: "finish field",
  hintChoose: "choose",
  hintToggle: "toggle",
  hintActions: "actions",
  hintSave: "save",
  hintBack: "back",
  hintClose: "close",
  hintDiscard: "discard",
  hintKeepEditing: "keep editing",
  hintCancelOperation: "cancel operation",
  hintCancelSave: "cancel save",
  hintSearch: "search",
  hintApply: "apply",
  hintScroll: "scroll",
  hintRun: "run",
  duplicateFieldIds: "Duplicate field IDs",
  missingValue: (id) => `Missing value: ${id}`,
  unknownField: "Unknown field",
  protectedValue: "[protected]",
  overrideStatus: (source) =>
    `Value set by ${source}. Change it at the source.`,
  lockedStatus: (source) => `Locked by ${source}. Change it at the source.`,
  invalidValue: "Enter a valid value.",
  duplicateChoice: "Choose each option only once.",
  unavailableChoice: "Select an available option.",
  validatorFailed: "This field could not be validated. Check the product rule.",
  reconcileBeforeSave: "Check storage before saving again.",
  saveUnavailable: "Saving is unavailable.",
  sessionEnded: "Session ended.",
  invalidSaveTimeout: "Invalid save timeout.",
  fixFields: "Fix the highlighted fields.",
  saving: "Saving…",
  saveUnconfirmed: "Save was not confirmed. Check storage before trying again.",
  saved: "Changes saved.",
  saveFailed: "Could not save. Your draft was kept. Try again.",
  saveCancelled: "Save cancelled. Your draft was kept.",
  saveTimedOut: "Saving took too long and was stopped. Your draft was kept.",
  invalidPersistedState: "Invalid persisted state",
  storageReconciled: "Storage checked. Review the pending changes.",
  waitForSave: "Wait for the save to be confirmed.",
  cancelRequested: "Cancellation requested. Waiting for confirmation.",
  checkResultFirst: "Check the result before running again.",
  operationUnavailable: "Operation unavailable.",
  timeoutRequired: "A timeout is required",
  operationRunning: "Operation in progress.",
  operationStarting: "Starting",
  operationDone: "Operation completed.",
  operationUnconfirmed:
    "Result not confirmed. Check the destination before running again.",
  operationCancelled: "Operation cancelled.",
  operationFailed: "Operation failed. Check diagnostics and try again.",
  noPendingResult: "There is no pending result",
  operationStates: {
    idle: "idle",
    running: "running",
    cancelling: "cancelling",
    succeeded: "done",
    failed: "failed",
    cancelled: "cancelled",
    outcomeUnknown: "unknown result",
  },
  actionMarker: "[action]",
  unavailable: (reason) => `[unavailable: ${reason}]`,
  unavailableShort: (reason) => `Unavailable: ${reason}`,
  noItems: "No items. Change the search or go back.",
  origin: (source) => `[source: ${source}]`,
  locked: (source) => `[locked: ${source}]`,
  errorPrefix: "Error:",
  protectedInput: "[protected input]",
  selectedCount: (count) => `${count} selected`,
  finishSelection: "[Finish selection]",
  searchField: (query) => `Search: ${query} [Clear search]`,
  searchResults: (count) => `${count} results`,
  noFilterResults: "No results for this filter. Clear the search.",
  confirmObject: (object) => `Object: ${object}`,
  confirmDestination: (destination) => `Destination: ${destination}`,
  confirmKeepEditing: "Keep editing",
  changesIn: (scope) => `Changes in ${scope}`,
  saveHasNoExternalEffects: "Saving settings does not run external actions.",
  statusSuccess: "Done",
  statusWarning: "Warning",
  statusDanger: "Error",
  statusInfo: "Info",
  cancelOperationButton: "[Cancel operation]",
  sortedBy: (label, direction) => `Sorted by ${label}: ${direction}`,
  originalOrder: "Original order",
  record: (index) => `Record ${index}`,
  moreColumns: "More columns are available in the detail and linear views.",
  unknownColumn: "Unknown column",
  invalidLogLimit: "Invalid history limit",
  logsHeader: (paused) =>
    `Logs: ${paused ? "paused" : "following"} [${paused ? "Resume" : "Pause"}]`,
  logsDropped: (count) => `${count} old lines removed · [Export text]`,
  emptyData: "No data available.",
  emptyFiltered: "No results for the filter.",
  emptyUnavailable: "Dependency unavailable.",
  helpTitle: (mode) => `Help — ${mode} mode`,
  helpFooter:
    "Save is a visible action even without a shortcut. Esc goes back; pending changes require a decision.",
  actionNames: {
    "navigate.up": "move up",
    "navigate.down": "move down",
    "navigate.first": "first item",
    "navigate.last": "last item",
    "navigate.pageUp": "previous page",
    "navigate.pageDown": "next page",
    activate: "edit, choose or run",
    toggle: "toggle option",
    nextRegion: "next region",
    previousRegion: "previous region",
    back: "back, cancel or close",
    save: "save",
    help: "help",
    search: "search",
    close: "close",
    cancelOperation: "cancel operation",
  },
  unsavedChanges: "Unsaved changes",
  noChanges: "No changes",
  linesRange: (first, last, total) => `${first}-${last} of ${total} lines`,
  fullMessageInHelp: "Full message available in Help.",
  useLinearMode: "Use linear mode.",
  draftPreserved: "Your draft was kept.",
  linearButtons: "[Linear mode] [Back]",
  terminalTooSmall: (columns, rows, minColumns, minRows) =>
    `Terminal too small (${columns}×${rows}; minimum ${minColumns}×${minRows}).`,
  enlargeOrClose:
    "Enlarge the window to continue or press Esc to go back. Your draft was kept.",
  enlargeOrGoBack: "Enlarge the window to continue or press Esc to go back.",
  valueOn: "on",
  valueOff: "off",
  emptyValue: "(empty)",
  noneSelected: "none",
  keySpace: "Space",
  keyUp: "Up",
  keyDown: "Down",
  duplicateBinding: (id) => `Duplicate binding: ${id}`,
  actionFailed: "The action failed. Your draft was kept.",
  openFailed: "Could not open the panel. Check the host API.",
  inputRequired: (names) =>
    `Input required: ${names}. Pass the arguments when running without input.`,
  workspaceTitle: "Diagnostics / Workspace",
  workspaceScope: "current project",
  workspaceHelp:
    "Tab switches between content and actions. Arrows navigate. Enter activates. Esc closes.",
  workspaceHints: "Tab actions · Enter open · Esc back",
  workspaceResults: "Results",
  workspaceTable: "Table",
  workspaceLogs: "Logs",
  workspaceSort: "Sort",
  workspacePauseLogs: "Pause logs",
  workspaceResumeLogs: "Resume logs",
  workspaceClose: "Close",
  workspaceNoResult: "No result",
};
export const MESSAGES: Readonly<Record<Locale, TerminalMessages>> = {
  en,
  "pt-BR": pt,
};
/** `pt*` → pt-BR, anything else (including unknown or empty) → en. `undefined` keeps the package default. */
export function normalizeLocale(locale?: string): Locale {
  if (locale === undefined) return DEFAULT_LOCALE;
  return /^pt(?:[-_]|$)/i.test(locale.trim()) ? "pt-BR" : "en";
}
export type MessageOverrides = {
  [K in keyof TerminalMessages]?: TerminalMessages[K] extends Record<
    string,
    string
  >
    ? Partial<TerminalMessages[K]>
    : TerminalMessages[K];
};
const usable = (value: unknown): value is string =>
  typeof value === "string" && value.trim() !== "";
/**
 * Resolves the catalog for a locale plus partial overrides. Overrides of the wrong type,
 * empty strings or functions that return empty text fall back to the locale catalog, so the
 * UI never shows an internal key or an empty label.
 */
export function resolveMessages(
  locale?: string,
  overrides: MessageOverrides = {},
): TerminalMessages {
  const base = MESSAGES[normalizeLocale(locale)];
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(overrides)) {
    const fallback = (base as unknown as Record<string, unknown>)[key];
    if (fallback === undefined || value === undefined) continue;
    if (typeof fallback === "string") {
      if (usable(value)) result[key] = value;
    } else if (typeof fallback === "function") {
      if (typeof value === "function")
        result[key] = (...args: unknown[]) => {
          try {
            const text = (value as (...a: unknown[]) => unknown)(...args);
            if (usable(text)) return text;
          } catch {
            /* fall back to the catalog */
          }
          return (fallback as (...a: unknown[]) => string)(...args);
        };
    } else if (value && typeof value === "object") {
      const merged: Record<string, string> = {
        ...(fallback as Record<string, string>),
      };
      for (const [k, v] of Object.entries(value as Record<string, unknown>))
        if (k in merged && usable(v)) merged[k] = v;
      result[key] = merged;
    }
  }
  return result as unknown as TerminalMessages;
}
