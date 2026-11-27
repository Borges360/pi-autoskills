/** Portable contract v1.0.0. No process, filesystem, host or renderer ownership. */
export const TERMINAL_CONTRACT_VERSION = "1.0.0" as const;
export type Value = string | number | boolean | string[];
export type Values = Record<string, Value>;
export type ActionId =
  | "navigate.up"
  | "navigate.down"
  | "navigate.first"
  | "navigate.last"
  | "navigate.pageUp"
  | "navigate.pageDown"
  | "activate"
  | "toggle"
  | "nextRegion"
  | "previousRegion"
  | "back"
  | "save"
  | "help"
  | "search"
  | "close"
  | "cancelOperation";
export type OperationState =
  | "idle"
  | "running"
  | "cancelling"
  | "succeeded"
  | "failed"
  | "cancelled"
  | "outcomeUnknown";
export interface Choice {
  id: string;
  label: string;
  description?: string;
  disabled?: string;
}
export interface Field {
  id: string;
  label: string;
  description: string;
  kind: "text" | "secret" | "number" | "boolean" | "select" | "multiselect";
  choices?: Choice[];
  override?: { value: Value; source: string };
  validate?: (value: Value, draft: Readonly<Values>) => string | undefined;
  /** Not editable here; the current value stays in the draft and the row shows the source. */
  locked?: { source: string };
  /** Display text for the value (never used for persistence). Errors fall back to the default display. */
  format?: (value: Value, draft: Readonly<Values>) => string;
  /**
   * select/multiselect only: loads choices when the field is activated (never when the panel opens).
   * Runs as a cancellable operation; the result replaces `choices` for this session.
   */
  loadChoices?: (signal: AbortSignal) => Promise<Choice[]>;
  /** Timeout for `loadChoices`, default 15000 ms. */
  loadTimeoutMs?: number;
}
export interface MenuItem extends Choice {
  kind: "value" | "route" | "action" | "status";
  value?: string;
  target?: string;
  effect?: "local" | "external" | "destructive";
}
export interface Capabilities {
  interactive: boolean;
  columns: number;
  rows: number;
  color: boolean;
  unicode: boolean;
  advancedKeyboard: boolean;
  mouse: boolean;
  screen: boolean;
  mode: "linear" | "prompts" | "panel" | "workspace" | "host" | "json";
  reducedMotion: boolean;
}
export interface Binding {
  action: ActionId;
  key: string;
  label: string;
  scope: "navigation" | "field" | "panel" | "operation";
}
export interface ComponentContract {
  id: string;
  version: "1.0.0";
  name: string;
  purpose: string;
  states: string[];
  actions: string[];
  focus: string;
  keyboard: string;
  linear: string;
  resize: string;
  requiredCapabilities: string[];
  tokens: string[];
  example: string;
}
export type TerminalResult<T> =
  | { status: "succeeded"; value: T }
  | {
      status: "failed" | "invalid" | "cancelled" | "outcomeUnknown";
      message: string;
    };
