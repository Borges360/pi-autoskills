import { randomUUID } from "node:crypto";
import { readFile, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonical, contained } from "./security.js";

export const locales = ["en", "pt-BR"] as const;
export type Locale = (typeof locales)[number];

const en = {
  "group.active": "Active",
  "group.suggestions": "Suggestions",
  "group.agents": "Agents",
  "group.settings": "Settings",
  "groupDescription.active": "Review skills currently selected for this project.",
  "groupDescription.suggestions": "Explain and detect skills relevant to the current task.",
  "groupDescription.agents": "Inspect available specialist agents.",
  "groupDescription.settings": "Choose the operating mode and menu language, or run diagnostics.",
  "menu.oneAction": "1 action",
  "menu.actionCount": "{count} actions",
  "action.show": "Show selected skills",
  "action.explain": "Explain selection",
  "action.detect": "Detect context",
  "action.agents": "Agents",
  "action.config": "Mode",
  "action.doctor": "Doctor",
  "action.language": "Language",
  "mode.auto": "Automatic",
  "mode.observe": "Observe",
  "mode.off": "Off",
  "modeDescription.auto": "Select audited skills when the task context matches.",
  "modeDescription.observe": "Show matching skills without adding them to the prompt.",
  "modeDescription.off": "Stop automatic skill selection.",
  "page.mode": "Mode",
  "page.language": "Language",
  "page.chooseMode": "Choose a mode",
  "page.chooseLanguage": "Choose a language",
  "locale.en": "English",
  "locale.ptBR": "Português (Brasil)",
  "summary.currentMode": "Current mode",
  "summary.draftMode": "Draft mode",
  "summary.currentLanguage": "Current language",
  "summary.draftLanguage": "Draft language",
  "notice.actionCount": "{count} actions",
  "notice.modeDraft": "Draft mode: {mode}.",
  "notice.modeSaved": "Saved mode: {mode}.",
  "notice.noChanges": "No changes to save.",
  "notice.modeSaveFailed": "Could not save mode. Draft preserved; try again.",
  "notice.localeDraftMatches": "Draft matches the saved language.",
  "notice.localeDraftSelected": "Language preview selected. Press Ctrl+S to save.",
  "notice.localeSaved": "Language saved for this project.",
  "notice.localeAlreadySaved": "Language is already saved for this project.",
  "notice.localeSaveFailed": "Could not save the language. Draft preserved; try again.",
  "notice.trustedProjectRequired": "Trust this project before saving its language preference.",
  "notice.invalidLocale": "Project language preference is invalid. English is active as fallback.",
  "notice.partialSave": "Mode saved; language was not saved. The language draft is still open.",
  "notice.partialTrustSave": "Mode saved; trust this project to save the language preference. The language draft is still open.",
  "notice.actionCompleted": "{action} completed.",
  "panel.back": "Back",
  "panel.authorize": "Authorize",
  "panel.working": "Working… Esc cancels the operation.",
  "panel.canceling": "Canceling…",
  "panel.canceled": "Operation canceled.",
  "panel.failed": "Operation failed. Try again.",
  "panel.unsaved": "Unsaved changes. Ctrl+S saves; press Esc again to discard.",
  "panel.chooseHelp": "↑↓ choose · Enter confirm · Esc back",
  "panel.navigateHelp": "↑↓ navigate · Enter edit/open · Ctrl+S save · Esc close",
} as const;

const ptBR = {
  "group.active": "Ativas",
  "group.suggestions": "Sugestões",
  "group.agents": "Agentes",
  "group.settings": "Configurações",
  "groupDescription.active": "Revise as skills selecionadas para este projeto.",
  "groupDescription.suggestions": "Explique e detecte skills relevantes para a tarefa atual.",
  "groupDescription.agents": "Consulte os agentes especialistas disponíveis.",
  "groupDescription.settings": "Escolha o modo e o idioma do menu ou execute diagnósticos.",
  "menu.oneAction": "1 ação",
  "menu.actionCount": "{count} ações",
  "action.show": "Exibir skills selecionadas",
  "action.explain": "Explicar seleção",
  "action.detect": "Detectar contexto",
  "action.agents": "Agentes",
  "action.config": "Modo",
  "action.doctor": "Diagnóstico",
  "action.language": "Idioma",
  "mode.auto": "Automático",
  "mode.observe": "Observar",
  "mode.off": "Desativado",
  "modeDescription.auto": "Seleciona skills auditadas quando o contexto da tarefa corresponde.",
  "modeDescription.observe": "Mostra skills correspondentes sem adicioná-las ao prompt.",
  "modeDescription.off": "Interrompe a seleção automática de skills.",
  "page.mode": "Modo",
  "page.language": "Idioma",
  "page.chooseMode": "Escolha um modo",
  "page.chooseLanguage": "Escolha um idioma",
  "locale.en": "Inglês",
  "locale.ptBR": "Português (Brasil)",
  "summary.currentMode": "Modo atual",
  "summary.draftMode": "Rascunho do modo",
  "summary.currentLanguage": "Idioma atual",
  "summary.draftLanguage": "Rascunho do idioma",
  "notice.actionCount": "{count} ações",
  "notice.modeDraft": "Modo em rascunho: {mode}.",
  "notice.modeSaved": "Modo salvo: {mode}.",
  "notice.noChanges": "Não há alterações para salvar.",
  "notice.modeSaveFailed": "Não foi possível salvar o modo. O rascunho foi mantido; tente novamente.",
  "notice.localeDraftMatches": "O rascunho corresponde ao idioma salvo.",
  "notice.localeDraftSelected": "Idioma pré-visualizado. Pressione Ctrl+S para salvar.",
  "notice.localeSaved": "Idioma salvo para este projeto.",
  "notice.localeAlreadySaved": "O idioma já está salvo para este projeto.",
  "notice.localeSaveFailed": "Não foi possível salvar o idioma. O rascunho foi mantido; tente novamente.",
  "notice.trustedProjectRequired": "Confie neste projeto antes de salvar a preferência de idioma.",
  "notice.invalidLocale": "A preferência de idioma do projeto é inválida. O inglês está ativo como fallback.",
  "notice.partialSave": "Modo salvo; idioma não salvo. O rascunho do idioma continua aberto.",
  "notice.partialTrustSave": "Modo salvo; confie neste projeto para salvar o idioma. O rascunho do idioma continua aberto.",
  "notice.actionCompleted": "{action} concluído.",
  "panel.back": "Voltar",
  "panel.authorize": "Autorizar",
  "panel.working": "Em andamento… Esc cancela a operação.",
  "panel.canceling": "Cancelando…",
  "panel.canceled": "Operação cancelada.",
  "panel.failed": "A operação falhou. Tente novamente.",
  "panel.unsaved": "Há alterações sem salvar. Ctrl+S salva; pressione Esc novamente para descartar.",
  "panel.chooseHelp": "↑↓ escolher · Enter confirmar · Esc voltar",
  "panel.navigateHelp": "↑↓ navegar · Enter editar/abrir · Ctrl+S salvar · Esc fechar",
} satisfies Record<keyof typeof en, string>;

export const catalogs = { en, "pt-BR": ptBR } as const;
export type MessageKey = keyof typeof en;
export const messageKeys = Object.keys(en) as MessageKey[];

export interface PanelMessages {
  back: string;
  authorize: string;
  working: string;
  canceling: string;
  canceled: string;
  failed: string;
  unsaved: string;
  chooseHelp: string;
  navigateHelp: string;
}

export function panelMessages(locale: Locale): PanelMessages {
  return {
    back: translate(locale, "panel.back"),
    authorize: translate(locale, "panel.authorize"),
    working: translate(locale, "panel.working"),
    canceling: translate(locale, "panel.canceling"),
    canceled: translate(locale, "panel.canceled"),
    failed: translate(locale, "panel.failed"),
    unsaved: translate(locale, "panel.unsaved"),
    chooseHelp: translate(locale, "panel.chooseHelp"),
    navigateHelp: translate(locale, "panel.navigateHelp"),
  };
}

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && locales.includes(value as Locale);
}

export function translate(
  locale: Locale,
  key: MessageKey,
  values: Record<string, string | number> = {},
): string {
  const template = catalogs[locale][key] ?? en[key] ?? key;
  return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : placeholder,
  );
}

export async function loadProjectLocale(
  cwd: string,
  trusted: boolean,
): Promise<{ locale: Locale; invalid: boolean }> {
  if (!trusted) return { locale: "en", invalid: false };
  try {
    const path = await contained(cwd, ".pi/pi-autoskills.locale.json", true);
    const raw = JSON.parse(await readFile(path, "utf8")) as {
      schemaVersion?: unknown;
      locale?: unknown;
    };
    if (raw.schemaVersion !== 1 || !isLocale(raw.locale))
      return { locale: "en", invalid: true };
    return { locale: raw.locale, invalid: false };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { locale: "en", invalid: false };
    return { locale: "en", invalid: true };
  }
}

export async function saveProjectLocale(
  cwd: string,
  trusted: boolean,
  locale: Locale,
  signal?: AbortSignal,
): Promise<void> {
  if (!trusted) throw new Error("trusted-project-required");
  if (!isLocale(locale)) throw new Error("invalid-locale");
  if (signal?.aborted) throw new Error("operation-cancelled");

  const path = await contained(cwd, ".pi/pi-autoskills.locale.json", true);
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const temporary = join(
    dirname(path),
    `.pi-autoskills.locale-${randomUUID()}.tmp`,
  );
  let handle: Awaited<ReturnType<typeof open>> | undefined;
  try {
    handle = await open(temporary, "wx", 0o600);
    if (signal?.aborted) throw new Error("operation-cancelled");
    await handle.writeFile(canonical({ schemaVersion: 1, locale }));
    await handle.sync();
    if (signal?.aborted) throw new Error("operation-cancelled");
  } catch (error) {
    await handle?.close();
    await unlink(temporary).catch(() => {});
    throw error;
  }
  await handle.close();
  if (signal?.aborted) {
    await unlink(temporary).catch(() => {});
    throw new Error("operation-cancelled");
  }
  try {
    await rename(temporary, path);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}
