import { randomUUID } from "node:crypto";
import { readFile, mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { canonical, contained } from "./security.js";
export const locales = ["en", "pt-BR"];
const en = {
    "group.active": "Active",
    "group.suggestions": "Suggestions",
    "group.agents": "Agents",
    "group.settings": "Settings",
    "action.show": "Show selected skills",
    "action.explain": "Explain selection",
    "action.detect": "Detect context",
    "action.agents": "Agents",
    "action.doctor": "Doctor",
    "actionDescription.show": "Posts the skills selected for this project and the audited catalog to the chat. Read-only.",
    "actionDescription.explain": "Posts why the current skills were selected to the chat. Read-only.",
    "actionDescription.detect": "Detects the project stack from marker files and posts it to the chat. Read-only.",
    "actionDescription.agents": "Posts the available specialist agents, without their instructions, to the chat. Read-only.",
    "actionDescription.doctor": "Checks storage recovery and integrations and posts the report to the chat.",
    "field.mode": "Mode",
    "field.modeDescription": "How skills are selected for your tasks. Saved for your user with Ctrl+S.",
    "field.language": "Language",
    "field.languageDescription": "Menu language for this trusted project. Previews immediately; Ctrl+S saves it.",
    "field.languageUntrustedDescription": "Menu language. Trust this project to choose and save a language for it.",
    "source.projectTrust": "project trust",
    "mode.auto": "Automatic",
    "mode.observe": "Observe",
    "mode.off": "Off",
    "modeDescription.auto": "Select audited skills when the task context matches.",
    "modeDescription.observe": "Show matching skills without adding them to the prompt.",
    "modeDescription.off": "Stop automatic skill selection.",
    "locale.en": "English",
    "locale.ptBR": "Português (Brasil)",
    "summary.currentMode": "Current mode",
    "summary.currentLanguage": "Current language",
    "notice.modeSaved": "Saved mode: {mode}.",
    "notice.modeAndLocaleSaved": "Saved mode: {mode}. Language saved for this project.",
    "notice.noChanges": "No changes to save.",
    "notice.modeSaveFailed": "Could not save mode. Draft preserved; try again.",
    "notice.localeSaved": "Language saved for this project.",
    "notice.localeSaveFailed": "Could not save the language. Nothing was changed; draft preserved, try again.",
    "notice.trustedProjectRequired": "Trust this project before saving its language preference.",
    "notice.invalidLocale": "Project language preference is invalid. English is active as fallback.",
    "notice.actionCompleted": "{action} completed.",
    "notice.actionFailed": "{action} failed. Try again.",
    "notice.actionTimedOut": "{action} did not finish in time and was stopped. Try again, or run Doctor if it keeps happening.",
    "notice.storageUnavailable": "{action} needs the project storage, which could not start. Run Doctor for the cause and recovery steps.",
    "notice.storageUnavailableAtOpen": "Project storage could not start. Mode can still be saved; run Doctor for the cause and recovery steps.",
};
const ptBR = {
    "group.active": "Ativas",
    "group.suggestions": "Sugestões",
    "group.agents": "Agentes",
    "group.settings": "Configurações",
    "action.show": "Exibir skills selecionadas",
    "action.explain": "Explicar seleção",
    "action.detect": "Detectar contexto",
    "action.agents": "Agentes",
    "action.doctor": "Diagnóstico",
    "actionDescription.show": "Envia ao chat as skills selecionadas para este projeto e o catálogo auditado. Somente leitura.",
    "actionDescription.explain": "Envia ao chat o motivo da seleção atual de skills. Somente leitura.",
    "actionDescription.detect": "Detecta a stack do projeto pelos arquivos marcadores e envia ao chat. Somente leitura.",
    "actionDescription.agents": "Envia ao chat os agentes especialistas disponíveis, sem as instruções. Somente leitura.",
    "actionDescription.doctor": "Verifica a recuperação do armazenamento e as integrações e envia o relatório ao chat.",
    "field.mode": "Modo",
    "field.modeDescription": "Como as skills são selecionadas para suas tarefas. Salvo para o seu usuário com Ctrl+S.",
    "field.language": "Idioma",
    "field.languageDescription": "Idioma do menu neste projeto confiável. A prévia é imediata; Ctrl+S salva.",
    "field.languageUntrustedDescription": "Idioma do menu. Confie neste projeto para escolher e salvar um idioma para ele.",
    "source.projectTrust": "confiança no projeto",
    "mode.auto": "Automático",
    "mode.observe": "Observar",
    "mode.off": "Desativado",
    "modeDescription.auto": "Seleciona skills auditadas quando o contexto da tarefa corresponde.",
    "modeDescription.observe": "Mostra skills correspondentes sem adicioná-las ao prompt.",
    "modeDescription.off": "Interrompe a seleção automática de skills.",
    "locale.en": "Inglês",
    "locale.ptBR": "Português (Brasil)",
    "summary.currentMode": "Modo atual",
    "summary.currentLanguage": "Idioma atual",
    "notice.modeSaved": "Modo salvo: {mode}.",
    "notice.modeAndLocaleSaved": "Modo salvo: {mode}. Idioma salvo para este projeto.",
    "notice.noChanges": "Não há alterações para salvar.",
    "notice.modeSaveFailed": "Não foi possível salvar o modo. O rascunho foi mantido; tente novamente.",
    "notice.localeSaved": "Idioma salvo para este projeto.",
    "notice.localeSaveFailed": "Não foi possível salvar o idioma. Nada foi alterado; o rascunho foi mantido, tente novamente.",
    "notice.trustedProjectRequired": "Confie neste projeto antes de salvar a preferência de idioma.",
    "notice.invalidLocale": "A preferência de idioma do projeto é inválida. O inglês está ativo como fallback.",
    "notice.actionCompleted": "{action} concluído.",
    "notice.actionFailed": "{action} falhou. Tente novamente.",
    "notice.actionTimedOut": "{action} não terminou a tempo e foi interrompido. Tente novamente ou execute o Diagnóstico se continuar acontecendo.",
    "notice.storageUnavailable": "{action} precisa do armazenamento do projeto, que não pôde ser iniciado. Execute o Diagnóstico para ver a causa e como recuperar.",
    "notice.storageUnavailableAtOpen": "O armazenamento do projeto não pôde ser iniciado. O modo ainda pode ser salvo; execute o Diagnóstico para ver a causa e como recuperar.",
};
export const catalogs = { en, "pt-BR": ptBR };
export const messageKeys = Object.keys(en);
export function isLocale(value) {
    return typeof value === "string" && locales.includes(value);
}
export function translate(locale, key, values = {}) {
    const template = catalogs[locale][key] ?? en[key] ?? key;
    return template.replace(/\{([a-zA-Z0-9_]+)\}/g, (placeholder, name) => Object.hasOwn(values, name) ? String(values[name]) : placeholder);
}
export async function loadProjectLocale(cwd, trusted) {
    if (!trusted)
        return { locale: "en", invalid: false };
    try {
        const path = await contained(cwd, ".pi/pi-autoskills.locale.json", true);
        const raw = JSON.parse(await readFile(path, "utf8"));
        if (raw.schemaVersion !== 1 || !isLocale(raw.locale))
            return { locale: "en", invalid: true };
        return { locale: raw.locale, invalid: false };
    }
    catch (error) {
        if (error.code === "ENOENT")
            return { locale: "en", invalid: false };
        return { locale: "en", invalid: true };
    }
}
export async function saveProjectLocale(cwd, trusted, locale, signal) {
    if (!trusted)
        throw new Error("trusted-project-required");
    if (!isLocale(locale))
        throw new Error("invalid-locale");
    if (signal?.aborted)
        throw new Error("operation-cancelled");
    const path = await contained(cwd, ".pi/pi-autoskills.locale.json", true);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    const temporary = join(dirname(path), `.pi-autoskills.locale-${randomUUID()}.tmp`);
    let handle;
    try {
        handle = await open(temporary, "wx", 0o600);
        if (signal?.aborted)
            throw new Error("operation-cancelled");
        await handle.writeFile(canonical({ schemaVersion: 1, locale }));
        await handle.sync();
        if (signal?.aborted)
            throw new Error("operation-cancelled");
    }
    catch (error) {
        await handle?.close();
        await unlink(temporary).catch(() => { });
        throw error;
    }
    await handle.close();
    if (signal?.aborted) {
        await unlink(temporary).catch(() => { });
        throw new Error("operation-cancelled");
    }
    try {
        await rename(temporary, path);
    }
    catch (error) {
        await unlink(temporary).catch(() => { });
        throw error;
    }
}
