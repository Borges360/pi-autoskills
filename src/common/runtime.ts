import type {
  ExtensionAPI,
  ExtensionContext,
  ExtensionCommandContext,
  ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { hostname } from "node:os";
import { defaults, loadConfig, saveConfig, type Config } from "./config.js";
import {
  FileStorage,
  SqliteStorage,
  type StorageBase,
  type PortableSnapshot,
} from "./storage.js";
import { DurableStorage } from "./durable.js";
import { Interop, type EventBus } from "./contracts.js";
import { MenuError, openMenu, type Mode } from "../ui/menu.js";
import { loadProjectLocale, saveProjectLocale } from "./i18n.js";
import {
  atomicWrite,
  canonical,
  digest,
  projectKey,
  redact,
  redactText,
} from "./security.js";

export interface CommandContext {
  cwd: string;
  trusted: boolean;
  signal?: AbortSignal;
  hostContext?: ExtensionContext;
  commandContext?: ExtensionCommandContext;
}
export interface Service {
  capabilities: string[];
  menu: string[];
  /** Menu action groups in display order; `config`/`mode` become the Mode field of the panel. */
  menuGroups?: Record<string, string[]>;
  modeDescriptions?: Partial<Record<"auto" | "observe" | "off", string>>;
  command(
    action: string,
    args: string[],
    context: CommandContext,
  ): Promise<unknown>;
  start?(): Promise<void>;
  close?(): Promise<void>;
  prompt?(prompt: string, context: ExtensionContext): Promise<unknown>;
  toolCall?(
    event: unknown,
    context: ExtensionContext,
  ): Promise<{ block: true; reason: string } | undefined>;
  toolResult?(event: unknown, context: ExtensionContext): Promise<void>;
  messageEnd?(event: unknown, context: ExtensionContext): Promise<void>;
  settle?(
    event: unknown,
    context: ExtensionContext,
  ): Promise<{ continue?: boolean; entries?: unknown[] } | undefined>;
}
export type ServiceFactory = (host: Host) => Service;
export const toolResult = (value: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(redact(value)) }],
  details: redact(value),
});
export class Host {
  config!: Config;
  store!: StorageBase;
  interop!: Interop;
  service!: Service;
  key = "";
  private started = false;
  private starting?: Promise<void>;
  private queue: Promise<unknown> = Promise.resolve();
  migrationFault?: (phase: "after-seal" | "after-pointer") => void;
  constructor(
    readonly extension: string,
    readonly factory: ServiceFactory,
    readonly cwd: string,
    readonly bus: EventBus,
    readonly trusted = false,
    readonly api?: ExtensionAPI,
  ) {}
  async start() {
    if (this.started) return;
    if (!this.starting)
      this.starting = this.initialize().finally(() => {
        this.starting = undefined;
      });
    return this.starting;
  }
  private async initialize() {
    try {
      await this.initializeResources();
    } catch (error) {
      this.interop?.close();
      await this.service?.close?.().catch(() => {});
      await this.store?.close().catch(() => {});
      throw error;
    }
  }
  private async initializeResources() {
    this.config = await loadConfig(this.extension, this.cwd, this.trusted);
    this.key = await projectKey(this.cwd);
    const base = join(this.config.storage.root, "projects", this.key);
    await mkdir(base, { recursive: true, mode: 0o700 });
    let backend = this.config.storage.backend;
    let root = base;
    try {
      const pointer = JSON.parse(
        await readFile(join(base, "backend.json"), "utf8"),
      );
      if (
        !["files", "sqlite", "durable"].includes(pointer.backend) ||
        !/^migration-[a-zA-Z0-9-]+$/.test(pointer.directory)
      )
        throw new Error("invalid-backend-pointer");
      backend = pointer.backend;
      root = join(base, pointer.directory);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
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
      } catch (error) {
        dead = (error as NodeJS.ErrnoException).code === "ESRCH";
      }
      if (!dead) throw new Error("migration-in-progress");
      await this.store.rollbackMigration(metadata.migratedTo);
    }
    this.interop = new Interop(
      this.extension,
      this.bus,
      this.key,
      this.config.disabledIntegrations,
    );
    this.service = this.factory(this);
    await this.service.start?.();
    this.interop.start(this.service.capabilities);
    this.started = true;
  }
  async close() {
    await this.starting?.catch(() => {});
    if (!this.started) return;
    this.interop.close();
    await this.service.close?.();
    await this.store.close();
    this.started = false;
  }
  serial<T>(fn: () => Promise<T>): Promise<T> {
    const result = this.queue.then(fn);
    this.queue = result.catch(() => {});
    return result;
  }
  async configure(patch: Partial<Config>, signal?: AbortSignal) {
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
  async command(
    action: string,
    args: string[],
    context: CommandContext,
  ): Promise<unknown> {
    if (action === "doctor") return this.doctor();
    if (action === "config") return this.config;
    if (action === "off" || action === "auto" || action === "observe")
      return this.configure(
        { enabled: action !== "off", mode: action },
        context.signal,
      );
    if (action === "storage")
      return args[0] === "migrate"
        ? this.migrate(args[1])
        : {
            backend: this.store.constructor.name,
            root: this.store.options.root,
          };
    return this.service.command(action, args, context);
  }
  async migrate(backend?: string) {
    if (backend !== "files" && backend !== "sqlite" && backend !== "durable")
      throw new Error("supported-backends: files, sqlite, durable");
    const activeChildren = await this.store.listRecords<{ status: string }>(
      "children",
    );
    const activeRuns = await this.store.listRecords<{ status: string }>("runs");
    if (
      activeChildren.some((c) => c.status === "running") ||
      activeRuns.some((r) => r.status === "active")
    )
      throw new Error("pause-active-work-before-migration");
    const sourceStore = this.store;
    const migrationId = crypto.randomUUID();
    const base = join(this.config.storage.root, "projects", this.key);
    const directory = "migration-" + migrationId;
    const root = join(base, directory);
    const target =
      backend === "files"
        ? new FileStorage({ root, extension: this.extension })
        : backend === "sqlite"
          ? new SqliteStorage({ root, extension: this.extension })
          : new DurableStorage({ root, extension: this.extension });
    await target.open();
    let switched = false;
    let sealed = false;
    let previousPointer: string | undefined;
    try {
      previousPointer = await readFile(join(base, "backend.json"), "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    try {
      await this.store.transact(async (source) => {
        const frozen = structuredClone(source);
        const logical = (s: PortableSnapshot) =>
          digest({
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
      await atomicWrite(
        join(base, "backend.json"),
        canonical({
          schemaVersion: 1,
          backend,
          directory,
          migrationId,
          sourceRoot: this.store.options.root,
        }),
      );
      switched = true;
      this.migrationFault?.("after-pointer");
      await target.recover();
      await this.service.close?.();
      this.store = target;
      // Services capture Host, never a stale store handle; restart listeners after backend replacement.
      this.interop.close();
      this.interop = new Interop(
        this.extension,
        this.bus,
        this.key,
        this.config.disabledIntegrations,
      );
      this.service = this.factory(this);
      await this.service.start?.();
      this.interop.start(this.service.capabilities);
      await sourceStore.close();
      return { migrationId, backend, verified: true, backupPreserved: true };
    } catch (e) {
      if (switched) {
        if (previousPointer)
          await atomicWrite(join(base, "backend.json"), previousPointer);
        else await unlink(join(base, "backend.json"));
      }
      this.store = sourceStore;
      if (sealed) await sourceStore.rollbackMigration(root);
      await target.close();
      throw e;
    }
  }
}
const modeOf = (config: Config): Mode =>
  !config.enabled || config.mode === "off"
    ? "off"
    : config.mode === "observe"
      ? "observe"
      : "auto";
/**
 * Doctor report when the Host cannot start. It re-checks each startup step to name the cause and
 * how to recover, and changes nothing: removing a storage pointer could reopen an older backend.
 */
export async function diagnoseStartup(
  extension: string,
  cwd: string,
  trusted: boolean,
  error: unknown,
) {
  const report = (
    reason: string,
    recovery: string,
    file?: string,
  ): Record<string, unknown> => ({
    extension,
    version: "0.1.0",
    node: process.versions.node,
    storage: "unavailable",
    startup: { ok: false, reason, ...(file ? { file } : {}), recovery },
    standalone: true,
  });
  let config: Config;
  try {
    config = await loadConfig(extension, cwd, trusted);
  } catch {
    return report(
      "config-unreadable",
      `Fix or remove the user configuration (defaults apply when it is missing)${trusted ? ` or the project file .pi/${extension}.json` : ""}, then run Doctor again.`,
      join(defaults(extension).storage.root, "config.json"),
    );
  }
  let pointerFile: string | undefined;
  try {
    pointerFile = join(
      config.storage.root,
      "projects",
      await projectKey(cwd),
      "backend.json",
    );
    const pointer = JSON.parse(await readFile(pointerFile, "utf8"));
    if (
      !["files", "sqlite", "durable"].includes(pointer?.backend) ||
      !/^migration-[a-zA-Z0-9-]+$/.test(pointer?.directory)
    )
      throw new Error("invalid-backend-pointer");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT")
      return report(
        "storage-pointer-invalid",
        "The storage pointer is unreadable. Restore it from a backup, or rewrite it as {\"schemaVersion\":1,\"backend\":\"files|sqlite|durable\",\"directory\":\"migration-...\"} naming the newest migration-* directory beside it. Do not delete it: the older backend would be opened instead.",
        pointerFile,
      );
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message === "migration-in-progress")
    return report(
      "migration-in-progress",
      "Another Pi process is migrating this project's storage. Wait for it to finish, then run Doctor again.",
    );
  if (message === "migration-owner-review-required")
    return report(
      "migration-owner-review-required",
      "A storage migration started by another host or process did not finish. Review the migration-* directories before retrying; nothing was changed.",
    );
  return report(
    "storage-start-failed",
    `Storage could not open (${redactText(message).slice(0, 200)}). Check permissions and free space in the storage root, then run Doctor again.`,
  );
}
const displayNames: Record<string, string> = {
  longrun: "Longrun",
  autoskills: "AutoSkills",
  autoplan: "AutoPlan",
  subagents: "Subagent Router",
  mcprouter: "MCP Router",
};
export function register(
  pi: ExtensionAPI,
  extension: string,
  command: string,
  factory: ServiceFactory,
  tools: ToolDefinition[] = [],
  options: {
    /** Menu groups shown when the service cannot start (storage failure). */
    menuGroups?: Record<string, string[]>;
  } = {},
) {
  let host: Host | undefined;
  const get = async (ctx: ExtensionContext) => {
    if (!host || host.cwd !== ctx.cwd) {
      await host?.close();
      host = new Host(
        extension,
        factory,
        ctx.cwd,
        pi.events,
        ctx.isProjectTrusted(),
        pi,
      );
      await host.start();
    }
    await host.start();
    return host;
  };
  const show = (value: unknown) =>
    pi.sendMessage({
      customType: extension,
      content: JSON.stringify(redact(value), null, 2),
      display: true,
    });
  pi.on("session_start", async (_e, ctx) => {
    await get(ctx);
  });
  /** Owner of the open menu: shutdown and reload abort it and wait until its work settled. */
  let menuOwner = new AbortController();
  let menu: Promise<void> | undefined;
  pi.on("session_shutdown", async () => {
    menuOwner.abort();
    await menu?.catch(() => {});
    menuOwner = new AbortController();
    await host?.close();
    host = undefined;
  });
  const commandContext = (
    ctx: ExtensionCommandContext,
    signal: AbortSignal | undefined,
  ): CommandContext => ({
    cwd: ctx.cwd,
    trusted: ctx.isProjectTrusted(),
    hostContext: ctx,
    commandContext: ctx,
    ...(signal ? { signal } : {}),
  });
  /** Doctor stays reachable when storage cannot start: it then explains the cause and recovery. */
  const doctor = async (
    ctx: ExtensionCommandContext,
    signal: AbortSignal | undefined,
  ) => {
    let h: Host;
    try {
      h = await get(ctx);
    } catch (error) {
      return diagnoseStartup(extension, ctx.cwd, ctx.isProjectTrusted(), error);
    }
    return h.serial(() => h.command("doctor", [], commandContext(ctx, signal)));
  };
  const runMenu = async (ctx: ExtensionCommandContext) => {
    const owner = menuOwner;
    const signal = ctx.signal
      ? AbortSignal.any([owner.signal, ctx.signal])
      : owner.signal;
    const trusted = ctx.isProjectTrusted();
    const localeState = await loadProjectLocale(ctx.cwd, trusted);
    // The menu never depends on a started Host: Mode and Doctor work while storage is broken.
    let h: Host | undefined = await get(ctx).catch(() => undefined);
    let fallback: Config | undefined = h
      ? undefined
      : await loadConfig(extension, ctx.cwd, trusted).catch(() => undefined);
    if (signal.aborted) return;
    const started = async () => {
      try {
        h = await get(ctx);
        return h;
      } catch (error) {
        throw new MenuError("storage-unavailable", { cause: error });
      }
    };
    const service = h?.service;
    await openMenu({
      ui: ctx.ui,
      title: displayNames[command] ?? extension,
      groups: service
        ? (service.menuGroups ?? {
            Actions: service.menu,
            Settings: ["config", "doctor"],
          })
        : (options.menuGroups ?? { Settings: ["config", "doctor"] }),
      trusted,
      locale: localeState.locale,
      invalidLocale: localeState.invalid,
      storageUnavailable: !h,
      signal,
      mode: () => modeOf(h?.config ?? fallback ?? defaults(extension)),
      saveMode: async (mode, s) => {
        const patch = { enabled: mode !== "off", mode } as const;
        const live = await get(ctx).catch(() => undefined);
        if (live) {
          h = live;
          await live.serial(() => live.configure(patch, s));
          return;
        }
        // Storage is down; the mode lives in the user configuration, which does not need it.
        s?.throwIfAborted();
        const next = await loadConfig(extension, ctx.cwd, trusted, patch);
        s?.throwIfAborted();
        await saveConfig(extension, next);
        fallback = next;
      },
      saveLocale: (locale, s) =>
        saveProjectLocale(ctx.cwd, ctx.isProjectTrusted(), locale, s),
      readStored: async (s) => {
        const stored = await loadConfig(extension, ctx.cwd, trusted);
        s.throwIfAborted();
        const locale = await loadProjectLocale(ctx.cwd, trusted);
        return { mode: modeOf(stored), locale: locale.locale };
      },
      run: async (action, s) => {
        if (action === "doctor") return doctor(ctx, s);
        const live = await started();
        return live.serial(() =>
          live.command(action, [], commandContext(ctx, s)),
        );
      },
      show,
    });
  };
  pi.registerCommand(command, {
    description: `${extension}: status, explain, config, doctor`,
    handler: async (args, ctx) => {
      const parts = args.trim().split(/\s+/).filter(Boolean);
      const interactive = ctx.mode === "tui" && ctx.hasUI;
      const opensMenu =
        interactive &&
        (!parts.length ||
          (parts.length === 1 && (parts[0] === "config" || parts[0] === "mode")));
      if (opensMenu) {
        // One menu at a time: the slot is claimed before any await, so a second /autoskills
        // while it is opening or open does nothing, and shutdown always waits for this one.
        if (menu) return;
        const mine: Promise<void> = runMenu(ctx).finally(() => {
          if (menu === mine) menu = undefined;
        });
        menu = mine;
        return mine;
      }
      let action = parts.shift() ?? "status";
      if (action === "mode") action = "config";
      if (action === "doctor") {
        show(await doctor(ctx, ctx.signal));
        return;
      }
      const h = await get(ctx);
      show(
        await h.serial(() =>
          h.command(action, parts, {
            cwd: ctx.cwd,
            trusted: ctx.isProjectTrusted(),
            hostContext: ctx,
            commandContext: ctx,
            signal: ctx.signal,
          }),
        ),
      );
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
    if (
      !h.config.enabled ||
      h.config.mode === "off" ||
      e.messageType !== "user"
    )
      return;
    const value = await h.serial(
      () => h.service.prompt?.(e.prompt, ctx) ?? Promise.resolve(undefined),
    );
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
      return h.serial(
        () => h.service.toolCall?.(e, ctx) ?? Promise.resolve(undefined),
      );
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
    if (!h.config.enabled || h.config.mode === "observe") return;
    return (await h.serial(
      () => h.service.settle?.(e, ctx) ?? Promise.resolve(undefined),
    )) as { continue?: boolean } | undefined;
  });
  return { get };
}
