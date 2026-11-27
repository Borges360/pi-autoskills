import type { ActionId, Choice } from "./contracts.ts";
import { Navigation } from "./navigation.ts";
import {
  normalizeLocale,
  resolveMessages,
  type Locale,
  type MessageOverrides,
  type TerminalMessages,
} from "./i18n.ts";
import {
  DataTable,
  DetailView,
  LogModel,
  LogView,
  ResultList,
  TableModel,
  TerminalPanel,
  ActionBar,
  type Column,
  type View,
} from "./components.ts";
export interface WorkspaceRecord extends Choice {
  fields: Record<string, string>;
}
export interface WorkspaceOptions {
  records: readonly WorkspaceRecord[];
  columns: readonly Column[];
  logLimit?: number;
  /** Header line 1. Default: localized "Diagnostics / Workspace". */
  title?: string;
  /** Header line 2. Default: localized "current project". */
  scope?: string;
  /** Persistent help line. Default: localized navigation help. */
  help?: string;
  /** Key hints line. Default: localized `Tab actions · Enter open · Esc back`. */
  hints?: string;
  /** Default pt-BR (package compatibility). */
  locale?: Locale | string;
  messages?: MessageOverrides;
  /** Below 40×12: legacy linear buttons or a resize message (hosts). Default `linear`. */
  narrow?: "linear" | "resize";
}
/** Persistent data exploration policy; host/renderer exclusively owns buffers and stream cleanup. */
export class WorkspaceModel {
  readonly navigation: Navigation;
  readonly table: TableModel;
  readonly log: LogModel;
  mode: "results" | "table" | "logs" = "results";
  region: "content" | "actions" = "content";
  scroll = 0;
  closed = false;
  messages: TerminalMessages;
  locale: Locale;
  title: string | undefined;
  scope: string | undefined;
  help: string | undefined;
  hints: string | undefined;
  narrow: "linear" | "resize";
  /** True when `narrow` was given to the constructor (adapters keep it instead of their default). */
  readonly narrowChosen: boolean;
  private localeChosen: boolean;
  private readonly overrides: MessageOverrides | undefined;
  constructor(readonlyOptions: WorkspaceOptions) {
    this.records = readonlyOptions.records;
    this.overrides = readonlyOptions.messages;
    this.messages = resolveMessages(
      readonlyOptions.locale,
      readonlyOptions.messages,
    );
    this.locale = normalizeLocale(readonlyOptions.locale);
    this.localeChosen = readonlyOptions.locale !== undefined;
    this.title = readonlyOptions.title;
    this.scope = readonlyOptions.scope;
    this.help = readonlyOptions.help;
    this.hints = readonlyOptions.hints;
    this.narrow = readonlyOptions.narrow ?? "linear";
    this.narrowChosen = readonlyOptions.narrow !== undefined;
    this.navigation = new Navigation("workspace", this.records);
    this.table = new TableModel(
      readonlyOptions.columns,
      this.records.map((r) => r.fields),
      this.messages,
    );
    this.log = new LogModel(readonlyOptions.logLimit, this.messages);
  }
  readonly records: readonly WorkspaceRecord[];
  actionIndex = 0;
  /** Switches package texts; product title/scope/help stay as given. */
  setLocale(locale: Locale | string, messages?: MessageOverrides) {
    this.messages = resolveMessages(locale, messages ?? this.overrides);
    this.locale = normalizeLocale(locale);
    this.localeChosen = true;
    this.table.messages = this.messages;
    this.log.messages = this.messages;
  }
  /** True when a locale was given (constructor option or `setLocale`), not the package default. */
  get hasLocale() {
    return this.localeChosen;
  }
  get actions() {
    const m = this.messages;
    return [
      m.workspaceResults,
      m.workspaceTable,
      m.workspaceLogs,
      m.workspaceSort,
      this.log.paused ? m.workspaceResumeLogs : m.workspacePauseLogs,
      m.workspaceClose,
    ];
  }
  /** Action-bar buttons; all navigate or switch views, so they take the `choose` role. */
  get barActions() {
    return this.actions.map((label, i) => ({
      id: String(i),
      label,
      role: "choose" as const,
    }));
  }
  get focusedActionId(): string | undefined {
    return this.region === "actions" ? String(this.actionIndex) : undefined;
  }
  dispatch(action: ActionId) {
    if (action === "back" || action === "close") {
      this.closed = true;
      return;
    }
    if (action === "nextRegion" || action === "previousRegion") {
      this.region = this.region === "content" ? "actions" : "content";
      return;
    }
    if (this.region === "actions") {
      if (action === "navigate.up")
        this.actionIndex = Math.max(0, this.actionIndex - 1);
      if (action === "navigate.down")
        this.actionIndex = Math.min(
          this.actions.length - 1,
          this.actionIndex + 1,
        );
      if (action === "activate") {
        if (this.actionIndex < 3) {
          this.mode = (["results", "table", "logs"] as const)[
            this.actionIndex
          ]!;
          this.scroll = 0;
        }
        if (this.actionIndex === 3 && this.table.columns[0])
          this.table.order(this.table.columns[0].id);
        if (this.actionIndex === 4) this.log.toggle();
        if (this.actionIndex === 5) this.closed = true;
      }
      return;
    }
    const delta =
      action === "navigate.down"
        ? 1
        : action === "navigate.up"
          ? -1
          : action === "navigate.pageDown"
            ? 5
            : action === "navigate.pageUp"
              ? -5
              : 0;
    if (this.mode === "results") this.navigation.move(delta);
    else this.scroll = Math.max(0, this.scroll + delta);
    if (action === "navigate.first") {
      this.navigation.first();
      this.scroll = 0;
    }
    if (action === "navigate.last") {
      this.navigation.last();
      this.scroll = Math.max(0, this.linear().lines.length - 1);
    }
  }
  linear(): View {
    if (this.mode === "logs") return LogView(this.log);
    if (this.mode === "table") return DataTable(this.table, 40, true);
    const lines = this.navigation.visible.flatMap(
      (r) =>
        DetailView(
          r.label,
          this.records.find((v) => v.id === r.id)?.fields ?? {},
        ).lines,
    );
    return { lines, fullText: lines, focusedLine: 0 };
  }
  render(columns: number, rows: number): View {
    const m = this.messages;
    const current = this.records.find(
      (r) => r.id === this.navigation.current.focusedId,
    );
    const body =
      this.mode === "results"
        ? ResultList(
            this.navigation.visible,
            current?.id ?? "",
            DetailView(
              current?.label ?? m.workspaceNoResult,
              current?.fields ?? {},
            ),
            columns,
          )
        : this.mode === "table"
          ? DataTable(this.table, columns)
          : LogView(this.log);
    if (this.mode !== "results")
      body.focusedLine = Math.min(
        Math.max(0, body.lines.length - 1),
        this.scroll,
      );
    return TerminalPanel({
      title: this.title ?? m.workspaceTitle,
      scope: this.scope ?? m.workspaceScope,
      dirty: false,
      body,
      help: this.help ?? m.workspaceHelp,
      feedback: "",
      actions: ActionBar(this.barActions, this.focusedActionId, m),
      hints: {
        lines: [this.hints ?? m.workspaceHints],
        fullText: [],
        focusedLine: 0,
        kinds: ["muted"],
      },
      columns,
      rows,
      messages: m,
      narrow: this.narrow,
      draft: false,
    });
  }
}
