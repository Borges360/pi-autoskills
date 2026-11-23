import { openPiSettings, type PiUI } from "../vendor/inteiro-terminal/pi.js";
import {
  PersistenceOutcomeUnknown,
  SettingsSession,
  type Persist,
} from "../vendor/inteiro-terminal/settings.js";
import type { Field, Values } from "../vendor/inteiro-terminal/contracts.js";
import type {
  PanelAction,
  PanelController,
} from "../vendor/inteiro-terminal/controller.js";
import type { MessageOverrides } from "../vendor/inteiro-terminal/i18n.js";
import type { ErrorContext } from "../vendor/inteiro-terminal/errors.js";
import { translate, type Locale, type MessageKey } from "../common/i18n.js";

export const modes = ["auto", "observe", "off"] as const;
export type Mode = (typeof modes)[number];

/** Everything the menu needs from the host; no Pi or storage handle leaks into the panel. */
export interface MenuOptions {
  ui: PiUI;
  /** Product name shown as the panel title. */
  title: string;
  /** Action groups in display order (Active, Suggestions, Agents, Settings). `config`/`mode` become the Mode field. */
  groups: Record<string, readonly string[]>;
  /** Pi project trust; the language preference is saved per trusted project only. */
  trusted: boolean;
  /** Saved interface language of this project. */
  locale: Locale;
  /** The saved language file exists but is invalid (English is the fallback). */
  invalidLocale?: boolean;
  /** Owner signal: session shutdown or reload closes the menu. */
  signal: AbortSignal;
  /** Effective mode right now. */
  mode(): Mode;
  saveMode(mode: Mode, signal?: AbortSignal): Promise<void>;
  saveLocale(locale: Locale, signal: AbortSignal): Promise<void>;
  /** Fresh read of the stored mode and language, used after an unconfirmed save. */
  readStored(signal: AbortSignal): Promise<{ mode: Mode; locale: Locale }>;
  /** Runs a read-only command (`show`, `explain`, `detect`, `agents`, `doctor`). */
  run(action: string, signal: AbortSignal): Promise<unknown>;
  /** Posts a command result to the chat. */
  show(value: unknown): void;
}

const MODE = "mode";
const LANGUAGE = "language";
const asLocale = (value: unknown): Locale => (value === "pt-BR" ? "pt-BR" : "en");
const asMode = (value: unknown): Mode =>
  value === "observe" || value === "off" ? value : "auto";

const groupKeys: Record<string, MessageKey> = {
  Active: "group.active",
  Suggestions: "group.suggestions",
  Agents: "group.agents",
  Settings: "group.settings",
};
const actionKeys: Record<string, MessageKey> = {
  show: "action.show",
  explain: "action.explain",
  detect: "action.detect",
  agents: "action.agents",
  doctor: "action.doctor",
};
const actionDescriptionKeys: Record<string, MessageKey> = {
  show: "actionDescription.show",
  explain: "actionDescription.explain",
  detect: "actionDescription.detect",
  agents: "actionDescription.agents",
  doctor: "actionDescription.doctor",
};
/** Doctor runs storage recovery; the read-only listings use the adapter default (30 s). */
const actionTimeouts: Record<string, number> = { doctor: 120_000 };

/** Rejects with the signal's reason as soon as it aborts, without waiting for `work`. */
function untilAborted<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    work.then(
      (value) => {
        signal.removeEventListener("abort", abort);
        if (signal.aborted) reject(signal.reason);
        else resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener("abort", abort);
        reject(error);
      },
    );
  });
}

/** Stable product error codes; formatError turns them into translated cause + recovery text. */
export class MenuError extends Error {
  constructor(
    readonly reason:
      | "trusted-project-required"
      | "mode-save-failed"
      | "locale-save-failed",
    options?: ErrorOptions,
  ) {
    super(reason, options);
    this.name = "MenuError";
  }
}

/**
 * The /autoskills menu: one panel with the Mode and Language fields (Settings, drafts saved with
 * Ctrl+S) followed by the read-only actions of the Active, Suggestions, Agents and Settings groups.
 * The group of each action is shown in its value column. Results go to the chat, as before.
 */
export async function openMenu(o: MenuOptions): Promise<void> {
  /** Work started by the panel. The menu returns only after it settled, even if it ignored Esc. */
  const inflight = new Set<Promise<unknown>>();
  const track = <T>(work: Promise<T>): Promise<T> => {
    inflight.add(work);
    const forget = () => {
      inflight.delete(work);
    };
    work.then(forget, forget);
    return work;
  };
  let locale: Locale = o.locale;
  const tr = (key: MessageKey, values?: Record<string, string | number>) =>
    translate(locale, key, values);
  const modeLabel = (mode: unknown) => tr(`mode.${asMode(mode)}`);
  const localeLabel = (value: unknown) =>
    tr(asLocale(value) === "pt-BR" ? "locale.ptBR" : "locale.en");
  const groupLabel = (group: string) =>
    groupKeys[group] ? tr(groupKeys[group]!) : group;
  const actionLabel = (action: string) =>
    actionKeys[action] ? tr(actionKeys[action]!) : action;

  /** The Mode description explains the mode in the draft (the select list shows labels only). */
  const fields = (draftMode: unknown = o.mode()): Field[] => [
    {
      id: MODE,
      label: tr("field.mode"),
      kind: "select",
      description: `${tr(`modeDescription.${asMode(draftMode)}`)} ${tr("field.modeDescription")}`,
      choices: modes.map((mode) => ({
        id: mode,
        label: tr(`mode.${mode}`),
        description: tr(`modeDescription.${mode}`),
      })),
    },
    {
      id: LANGUAGE,
      label: tr("field.language"),
      kind: "select",
      description: tr(
        o.trusted
          ? "field.languageDescription"
          : "field.languageUntrustedDescription",
      ),
      choices: [
        { id: "en", label: tr("locale.en") },
        { id: "pt-BR", label: tr("locale.ptBR") },
      ],
      ...(o.trusted ? {} : { locked: { source: tr("source.projectTrust") } }),
    },
  ];
  const actions = (): PanelAction[] =>
    Object.entries(o.groups).flatMap(([group, ids]) =>
      ids
        .filter((id) => id !== "config" && id !== "mode")
        .map((id): PanelAction => {
          const label = actionLabel(id);
          return {
            id,
            label,
            hint: groupLabel(group),
            ...(actionDescriptionKeys[id]
              ? { description: tr(actionDescriptionKeys[id]!) }
              : {}),
            timeoutMs: actionTimeouts[id] ?? 30_000,
            run: async (_draft, signal) => {
              // Read-only: Esc stops waiting at once; a result that arrives later never reaches
              // the chat, and the menu still waits for the work before it returns.
              const result = await untilAborted(track(o.run(id, signal)), signal);
              o.show(result);
              return tr("notice.actionCompleted", { action: label });
            },
          };
        }),
    );
  const scope = (saved: Readonly<Values>) =>
    `${tr("summary.currentMode")}: ${modeLabel(saved[MODE])} · ${tr("summary.currentLanguage")}: ${localeLabel(saved[LANGUAGE])}`;
  /**
   * Package `saved` text is a fixed string read when Ctrl+S starts, so it is recomputed from the
   * draft on every change: "Saved mode: Observe." instead of a generic confirmation.
   */
  const messages = (
    draft: Readonly<Values>,
    saved: Readonly<Values>,
  ): MessageOverrides => {
    const modeChanged = draft[MODE] !== saved[MODE];
    const localeChanged = draft[LANGUAGE] !== saved[LANGUAGE];
    return {
      saved:
        modeChanged && localeChanged
          ? tr("notice.modeAndLocaleSaved", { mode: modeLabel(draft[MODE]) })
          : localeChanged
            ? tr("notice.localeSaved")
            : modeChanged
              ? tr("notice.modeSaved", { mode: modeLabel(draft[MODE]) })
              : tr("notice.noChanges"),
      lockedStatus: () => tr("notice.trustedProjectRequired"),
    };
  };
  const formatError = (error: unknown, context: ErrorContext) => {
    if (context.phase === "save") {
      const reason = error instanceof MenuError ? error.reason : undefined;
      if (reason === "trusted-project-required")
        return tr("notice.trustedProjectRequired");
      if (reason === "locale-save-failed") return tr("notice.localeSaveFailed");
      return tr("notice.modeSaveFailed");
    }
    if (context.phase === "action")
      return tr("notice.actionFailed", { action: context.label ?? "" });
    return undefined;
  };

  const initial: Values = { [MODE]: o.mode(), [LANGUAGE]: locale };
  const session = new SettingsSession(fields(), initial, {
    locale,
    messages: messages(initial, initial),
  });
  if (o.invalidLocale) session.setStatus(tr("notice.invalidLocale"), "warning");
  let panel: PanelController | undefined;

  const save = async (values: Readonly<Values>, signal: AbortSignal) => {
    const before = session.persisted;
    const mode = asMode(values[MODE]);
    const language = asLocale(values[LANGUAGE]);
    const modeChanged = mode !== before[MODE];
    const localeChanged = language !== before[LANGUAGE];
    if (localeChanged && !o.trusted)
      throw new MenuError("trusted-project-required");
    if (modeChanged) {
      try {
        await o.saveMode(mode, signal);
      } catch (error) {
        if (signal.aborted) throw error;
        throw new MenuError("mode-save-failed", { cause: error });
      }
    }
    if (localeChanged) {
      try {
        await o.saveLocale(language, signal);
      } catch (error) {
        // All or nothing: the saved mode goes back so the panel never hides a half-applied save.
        if (modeChanged)
          await o.saveMode(asMode(before[MODE])).catch((rollback: unknown) => {
            throw new PersistenceOutcomeUnknown("mode-rollback-failed", {
              cause: rollback,
            });
          });
        if (signal.aborted) throw error;
        throw new MenuError("locale-save-failed", { cause: error });
      }
    }
    // Next Ctrl+S without edits reports "No changes to save."; the header shows the new values.
    session.setLocale(locale, messages(values, values));
    panel?.relabel({ scope: scope(values) });
  };
  const persist: Persist = (values, signal) => track(save(values, signal));

  try {
    const result = await openPiSettings(o.ui, {
      title: o.title,
      scope: scope(initial),
      session,
      persist,
      signal: o.signal,
      locale,
      messages: messages(initial, initial),
      actions: actions(),
      reservedKeys: ["ctrl+c"],
      overlay: {
        width: "85%",
        minWidth: 40,
        maxHeight: "95%",
        anchor: "center",
        margin: 1,
      },
      cancelGraceMs: 1_000,
      formatError,
      reconcile: async (signal) => {
        const stored = await o.readStored(signal);
        const values: Values = { [MODE]: stored.mode, [LANGUAGE]: stored.locale };
        session.setLocale(locale, messages(session.draft, values));
        panel?.relabel({ scope: scope(values) });
        return values;
      },
      // Live language preview: every visible string follows the draft; discard reverts it.
      onDraftChange: (draft, _event, controller) => {
        panel = controller;
        locale = asLocale(draft[LANGUAGE]);
        controller.setLocale(locale, messages(draft, session.persisted));
        controller.relabel({
          scope: scope(session.persisted),
          fields: fields(draft[MODE]),
          actions: actions(),
        });
      },
    });
    if (result.status === "failed") throw new Error(result.message);
  } finally {
    // Work that ignored its AbortSignal is awaited here, so shutdown really ends it.
    while (inflight.size) await Promise.allSettled([...inflight]);
  }
}
