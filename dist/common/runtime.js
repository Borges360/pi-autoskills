import { mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import { loadConfig, saveConfig } from "./config.js";
import { FileStorage, SqliteStorage, } from "./storage.js";
import { DurableStorage } from "./durable.js";
import { Interop } from "./contracts.js";
import { openSettingsPanel } from "../ui/settings-panel.js";
import { loadProjectLocale, panelMessages, saveProjectLocale, translate, } from "./i18n.js";
import { atomicWrite, canonical, digest, projectKey, redact, } from "./security.js";
export const toolResult = (value) => ({
    content: [{ type: "text", text: JSON.stringify(redact(value)) }],
    details: redact(value),
});
export class Host {
    extension;
    factory;
    cwd;
    bus;
    trusted;
    api;
    config;
    store;
    interop;
    service;
    key = "";
    started = false;
    starting;
    queue = Promise.resolve();
    migrationFault;
    constructor(extension, factory, cwd, bus, trusted = false, api) {
        this.extension = extension;
        this.factory = factory;
        this.cwd = cwd;
        this.bus = bus;
        this.trusted = trusted;
        this.api = api;
    }
    async start() {
        if (this.started)
            return;
        if (!this.starting)
            this.starting = this.initialize().finally(() => {
                this.starting = undefined;
            });
        return this.starting;
    }
    async initialize() {
        try {
            await this.initializeResources();
        }
        catch (error) {
            this.interop?.close();
            await this.service?.close?.().catch(() => { });
            await this.store?.close().catch(() => { });
            throw error;
        }
    }
    async initializeResources() {
        this.config = await loadConfig(this.extension, this.cwd, this.trusted);
        this.key = await projectKey(this.cwd);
        const base = join(this.config.storage.root, "projects", this.key);
        await mkdir(base, { recursive: true, mode: 0o700 });
        let backend = this.config.storage.backend;
        let root = base;
        try {
            const pointer = JSON.parse(await readFile(join(base, "backend.json"), "utf8"));
            if (!["files", "sqlite", "durable"].includes(pointer.backend) ||
                !/^migration-[a-zA-Z0-9-]+$/.test(pointer.directory))
                throw new Error("invalid-backend-pointer");
            backend = pointer.backend;
            root = join(base, pointer.directory);
        }
        catch (e) {
            if (e.code !== "ENOENT")
                throw e;
        }
        this.store =
            backend === "files"
                ? new FileStorage({ root, extension: this.extension })
                : backend === "sqlite"
                    ? new SqliteStorage({ root, extension: this.extension })
                    : new DurableStorage({ root, extension: this.extension });
        await this.store.open();
        const metadata = await this.store.getMetadata();
        if (metadata.migratedTo) {
            // An old backend is only selected when the pointer switch did not commit.
            // Its own journal is still authoritative, so rollback never replays effects.
            if (metadata.migrationHost !== hostname() || !metadata.migrationPid)
                throw new Error("migration-owner-review-required");
            let dead = false;
            try {
                process.kill(metadata.migrationPid, 0);
            }
            catch (error) {
                dead = error.code === "ESRCH";
            }
            if (!dead)
                throw new Error("migration-in-progress");
            await this.store.rollbackMigration(metadata.migratedTo);
        }
        this.interop = new Interop(this.extension, this.bus, this.key, this.config.disabledIntegrations);
        this.service = this.factory(this);
        await this.service.start?.();
        this.interop.start(this.service.capabilities);
        this.started = true;
    }
    async close() {
        await this.starting?.catch(() => { });
        if (!this.started)
            return;
        this.interop.close();
        await this.service.close?.();
        await this.store.close();
        this.started = false;
    }
    serial(fn) {
        const result = this.queue.then(fn);
        this.queue = result.catch(() => { });
        return result;
    }
    async configure(patch, signal) {
        signal?.throwIfAborted();
        const nextConfig = await loadConfig(this.extension, this.cwd, this.trusted, {
            ...this.config,
            ...patch,
        });
        signal?.throwIfAborted();
        await saveConfig(this.extension, nextConfig);
        this.config = nextConfig;
        return nextConfig;
    }
    async doctor() {
        const recovery = await this.store.recover();
        return {
            extension: this.extension,
            version: "0.1.0",
            pi: "1.2.0",
            node: process.versions.node,
            enabled: this.config.enabled,
            mode: this.config.mode,
            storage: this.store.constructor.name,
            recovery,
            integrations: {
                failures: this.interop.failures,
                fallbacks: this.interop.fallbacks,
                incompatible: this.interop.incompatible,
            },
            standalone: true,
        };
    }
    async command(action, args, context) {
        if (action === "doctor")
            return this.doctor();
        if (action === "config")
            return this.config;
        if (action === "off" || action === "auto" || action === "observe")
            return this.configure({ enabled: action !== "off", mode: action }, context.signal);
        if (action === "storage")
            return args[0] === "migrate"
                ? this.migrate(args[1])
                : {
                    backend: this.store.constructor.name,
                    root: this.store.options.root,
                };
        return this.service.command(action, args, context);
    }
    async migrate(backend) {
        if (backend !== "files" && backend !== "sqlite" && backend !== "durable")
            throw new Error("supported-backends: files, sqlite, durable");
        const activeChildren = await this.store.listRecords("children");
        const activeRuns = await this.store.listRecords("runs");
        if (activeChildren.some((c) => c.status === "running") ||
            activeRuns.some((r) => r.status === "active"))
            throw new Error("pause-active-work-before-migration");
        const sourceStore = this.store;
        const migrationId = crypto.randomUUID();
        const base = join(this.config.storage.root, "projects", this.key);
        const directory = "migration-" + migrationId;
        const root = join(base, directory);
        const target = backend === "files"
            ? new FileStorage({ root, extension: this.extension })
            : backend === "sqlite"
                ? new SqliteStorage({ root, extension: this.extension })
                : new DurableStorage({ root, extension: this.extension });
        await target.open();
        let switched = false;
        let sealed = false;
        let previousPointer;
        try {
            previousPointer = await readFile(join(base, "backend.json"), "utf8");
        }
        catch (e) {
            if (e.code !== "ENOENT")
                throw e;
        }
        try {
            await this.store.transact(async (source) => {
                const frozen = structuredClone(source);
                const logical = (s) => digest({
                    metadata: s.metadata,
                    records: s.records,
                    events: s.events,
                    blobs: s.blobs,
                });
                await target.importSnapshot(frozen);
                if (logical(await target.exportSnapshot()) !== logical(frozen))
                    throw new Error("migration-parity-failed");
                await target.recover();
                source.metadata.migratedTo = root;
                source.metadata.migrationPid = process.pid;
                source.metadata.migrationHost = hostname();
            });
            sealed = true;
            this.migrationFault?.("after-seal");
            await atomicWrite(join(base, "backend.json"), canonical({
                schemaVersion: 1,
                backend,
                directory,
                migrationId,
                sourceRoot: this.store.options.root,
            }));
            switched = true;
            this.migrationFault?.("after-pointer");
            await target.recover();
            await this.service.close?.();
            this.store = target;
            // Services capture Host, never a stale store handle; restart listeners after backend replacement.
            this.interop.close();
            this.interop = new Interop(this.extension, this.bus, this.key, this.config.disabledIntegrations);
            this.service = this.factory(this);
            await this.service.start?.();
            this.interop.start(this.service.capabilities);
            await sourceStore.close();
            return { migrationId, backend, verified: true, backupPreserved: true };
        }
        catch (e) {
            if (switched) {
                if (previousPointer)
                    await atomicWrite(join(base, "backend.json"), previousPointer);
                else
                    await unlink(join(base, "backend.json"));
            }
            this.store = sourceStore;
            if (sealed)
                await sourceStore.rollbackMigration(root);
            await target.close();
            throw e;
        }
    }
}
export function register(pi, extension, command, factory, tools = []) {
    let host;
    const get = async (ctx) => {
        if (!host || host.cwd !== ctx.cwd) {
            await host?.close();
            host = new Host(extension, factory, ctx.cwd, pi.events, ctx.isProjectTrusted(), pi);
            await host.start();
        }
        await host.start();
        return host;
    };
    const show = (value) => pi.sendMessage({
        customType: extension,
        content: JSON.stringify(redact(value), null, 2),
        display: true,
    });
    pi.on("session_start", async (_e, ctx) => {
        await get(ctx);
    });
    pi.on("session_shutdown", async () => {
        await host?.close();
        host = undefined;
    });
    pi.registerCommand(command, {
        description: `${extension}: status, explain, config, doctor`,
        handler: async (args, ctx) => {
            const h = await get(ctx);
            let parts = args.trim().split(/\s+/).filter(Boolean);
            const interactive = ctx.mode === "tui" && ctx.hasUI;
            const opensMenu = interactive &&
                (!parts.length ||
                    (parts.length === 1 && (parts[0] === "config" || parts[0] === "mode")));
            const trustedProject = opensMenu ? ctx.isProjectTrusted() : false;
            const localeState = opensMenu
                ? await loadProjectLocale(ctx.cwd, trustedProject)
                : { locale: "en", invalid: false };
            let locale = localeState.locale;
            let savedLocale = locale;
            let draftLocale = locale;
            const tr = (key, values) => translate(locale, key, values);
            const displayNames = {
                longrun: "Longrun",
                autoskills: "AutoSkills",
                autoplan: "AutoPlan",
                subagents: "Subagent Router",
                mcprouter: "MCP Router",
            };
            const displayName = displayNames[command] ?? extension;
            const groups = h.service.menuGroups ?? {
                Actions: h.service.menu,
                Settings: ["config", "doctor"],
            };
            const modeActions = ["auto", "observe", "off"];
            const modeLabel = (mode) => tr(`mode.${mode}`);
            const groupKeys = {
                Active: "group.active",
                Suggestions: "group.suggestions",
                Agents: "group.agents",
                Settings: "group.settings",
            };
            const groupDescriptionKeys = {
                Active: "groupDescription.active",
                Suggestions: "groupDescription.suggestions",
                Agents: "groupDescription.agents",
                Settings: "groupDescription.settings",
            };
            const actionKeys = {
                show: "action.show",
                explain: "action.explain",
                detect: "action.detect",
                agents: "action.agents",
                config: "action.config",
                mode: "action.config",
                doctor: "action.doctor",
                language: "action.language",
            };
            const groupLabel = (group) => groupKeys[group] ? tr(groupKeys[group]) : group;
            const actionLabel = (action) => actionKeys[action] ? tr(actionKeys[action]) : action;
            const actionCount = (count) => count === 1
                ? tr("menu.oneAction")
                : tr("menu.actionCount", { count });
            const currentMode = () => !h.config.enabled || h.config.mode === "off"
                ? "off"
                : h.config.mode === "observe"
                    ? "observe"
                    : "auto";
            let draftMode = currentMode();
            const panelRows = Object.entries(groups).map(([group, actions]) => ({
                id: `group:${group}`,
                label: () => groupLabel(group),
                value: () => {
                    if (group !== "Settings")
                        return actionCount(actions.length);
                    const mode = draftMode === currentMode()
                        ? `${tr("summary.currentMode")}: ${modeLabel(draftMode)}`
                        : `${tr("summary.draftMode")}: ${modeLabel(draftMode)}`;
                    const language = draftLocale === savedLocale
                        ? `${tr("summary.currentLanguage")}: ${tr(draftLocale === "en" ? "locale.en" : "locale.ptBR")}`
                        : `${tr("summary.draftLanguage")}: ${tr(draftLocale === "en" ? "locale.en" : "locale.ptBR")}`;
                    return `${mode} · ${language}`;
                },
                description: () => groupDescriptionKeys[group]
                    ? tr(groupDescriptionKeys[group])
                    : actions.map(actionLabel).join(" · "),
                activate: async (panel, signal) => {
                    const menuActions = group === "Settings" ? [...actions, "language"] : actions;
                    const selected = await panel.choose(`${displayName} / ${groupLabel(group)}`, menuActions.map((action) => ({
                        value: action,
                        label: actionLabel(action),
                    })));
                    if (!selected || signal.aborted)
                        return;
                    if (selected === "config" || selected === "mode") {
                        const mode = await panel.choose(`${displayName} / ${groupLabel("Settings")} / ${tr("page.mode")}`, modeActions.map((action) => ({
                            value: action,
                            label: modeLabel(action),
                        })), draftMode);
                        if (mode && !signal.aborted) {
                            draftMode = mode;
                            panel.report(tr("notice.modeDraft", { mode: modeLabel(draftMode) }));
                        }
                        return;
                    }
                    if (selected === "language") {
                        const selectedLocale = await panel.choose(`${displayName} / ${groupLabel("Settings")} / ${tr("page.language")}`, ["en", "pt-BR"].map((choice) => ({
                            value: choice,
                            label: tr(choice === "en" ? "locale.en" : "locale.ptBR"),
                        })), draftLocale);
                        if (!selectedLocale || signal.aborted)
                            return;
                        draftLocale = selectedLocale;
                        locale = draftLocale;
                        panel.report(draftLocale === savedLocale
                            ? tr("notice.localeDraftMatches")
                            : tr("notice.localeDraftSelected"));
                        return;
                    }
                    const selectedParts = selected.split(/\s+/);
                    const inputTitle = h.service.menuInputs?.[selected];
                    if (inputTitle) {
                        const value = await panel.input(inputTitle, "");
                        if (!value?.trim() || signal.aborted)
                            return;
                        selectedParts.push(value.trim());
                    }
                    const action = selectedParts.shift() ?? "status";
                    const result = await h.serial(() => h.command(action, selectedParts, {
                        cwd: ctx.cwd,
                        trusted: ctx.isProjectTrusted(),
                        hostContext: ctx,
                        commandContext: ctx,
                        signal,
                    }));
                    if (signal.aborted)
                        return;
                    show(result);
                    panel.report(tr("notice.actionCompleted", { action: actionLabel(action) }));
                },
            }));
            const showSettingsPanel = async () => {
                const signal = ctx.signal ?? new AbortController().signal;
                await openSettingsPanel(ctx.ui, {
                    title: displayName,
                    messages: () => panelMessages(locale),
                    initialStatus: localeState.invalid
                        ? tr("notice.invalidLocale")
                        : undefined,
                    summary: () => {
                        const current = currentMode();
                        const modeSummary = draftMode === current
                            ? `${tr("summary.currentMode")}: ${modeLabel(current)}`
                            : `${tr("summary.currentMode")}: ${modeLabel(current)} · ${tr("summary.draftMode")}: ${modeLabel(draftMode)}`;
                        return draftLocale === savedLocale
                            ? `${modeSummary} · ${tr("summary.currentLanguage")}: ${tr(savedLocale === "en" ? "locale.en" : "locale.ptBR")}`
                            : `${modeSummary} · ${tr("summary.draftLanguage")}: ${tr(draftLocale === "en" ? "locale.en" : "locale.ptBR")}`;
                    },
                    rows: panelRows,
                    dirty: () => draftMode !== currentMode() || draftLocale !== savedLocale,
                    signal,
                    save: async (panel, saveSignal) => {
                        const modeChanged = draftMode !== currentMode();
                        const localeChanged = draftLocale !== savedLocale;
                        if (!modeChanged && !localeChanged) {
                            panel.report(tr("notice.noChanges"));
                            return;
                        }
                        if (modeChanged) {
                            try {
                                await h.serial(() => h.configure({ enabled: draftMode !== "off", mode: draftMode }, saveSignal));
                            }
                            catch {
                                throw new Error("mode-save-failed");
                            }
                        }
                        if (localeChanged) {
                            try {
                                await saveProjectLocale(ctx.cwd, ctx.isProjectTrusted(), draftLocale, saveSignal);
                                savedLocale = draftLocale;
                            }
                            catch (error) {
                                if (modeChanged) {
                                    panel.report(error.message === "trusted-project-required"
                                        ? tr("notice.partialTrustSave")
                                        : tr("notice.partialSave"));
                                    return;
                                }
                                throw error;
                            }
                        }
                        panel.report(localeChanged
                            ? tr("notice.localeSaved")
                            : tr("notice.modeSaved", { mode: modeLabel(draftMode) }));
                    },
                    formatError: (error) => {
                        const reason = error.message;
                        if (reason === "trusted-project-required")
                            return tr("notice.trustedProjectRequired");
                        if (reason === "operation-cancelled")
                            return tr("panel.canceled");
                        if (reason === "mode-save-failed")
                            return tr("notice.modeSaveFailed");
                        return draftLocale !== savedLocale
                            ? tr("notice.localeSaveFailed")
                            : tr("notice.modeSaveFailed");
                    },
                });
            };
            if (interactive && !parts.length) {
                await showSettingsPanel();
                return;
            }
            let action = parts.shift() ?? "status";
            if (action === "mode")
                action = "config";
            if (interactive && action === "config") {
                await showSettingsPanel();
                return;
            }
            show(await h.serial(() => h.command(action, parts, {
                cwd: ctx.cwd,
                trusted: ctx.isProjectTrusted(),
                hostContext: ctx,
                commandContext: ctx,
                signal: ctx.signal,
            })));
        },
    });
    for (const t of tools)
        pi.registerTool({
            ...t,
            execute: async (callId, input, signal, onUpdate, ctx) => {
                await get(ctx);
                return t.execute(callId, input, signal, onUpdate, ctx);
            },
        });
    pi.on("before_agent_start", async (e, ctx) => {
        const h = await get(ctx);
        if (!h.config.enabled ||
            h.config.mode === "off" ||
            e.messageType !== "user")
            return;
        const value = await h.serial(() => h.service.prompt?.(e.prompt, ctx) ?? Promise.resolve(undefined));
        if (value !== undefined)
            return {
                message: {
                    customType: extension,
                    content: JSON.stringify(redact(value)),
                    display: false,
                },
            };
    });
    pi.on("tool_call", async (e, ctx) => {
        const h = await get(ctx);
        if (h.config.enabled)
            return h.serial(() => h.service.toolCall?.(e, ctx) ?? Promise.resolve(undefined));
    });
    pi.on("tool_result", async (e, ctx) => {
        const h = await get(ctx);
        if (h.config.enabled)
            await h.serial(() => h.service.toolResult?.(e, ctx) ?? Promise.resolve());
    });
    pi.on("message_end", async (e, ctx) => {
        const h = await get(ctx);
        if (h.config.enabled)
            await h.serial(() => h.service.messageEnd?.(e, ctx) ?? Promise.resolve());
    });
    pi.on("agent_before_settle", async (e, ctx) => {
        const h = await get(ctx);
        if (!h.config.enabled || h.config.mode === "observe")
            return;
        return (await h.serial(() => h.service.settle?.(e, ctx) ?? Promise.resolve(undefined)));
    });
    return { get };
}
