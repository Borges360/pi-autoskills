import type { Host, Service, CommandContext } from "./common/runtime.js";
import { type SkillMetadata } from "./common/catalog.js";
import { ChildDispatcher, type AgentDefinition } from "./common/children.js";
export interface SkillDecision {
    schemaVersion: 1;
    taskId?: string;
    skills: Array<{
        id: string;
        score: number;
        reason: string;
    }>;
    playbooks: string[];
    source: "rules" | "classifier" | "manual";
    confidence: number;
}
export interface TaskSignals {
    text: string;
    paths: string[];
    stack: string[];
    kind?: string;
}
export declare function selectSkills(task: TaskSignals, catalog: SkillMetadata[], maxActive?: number, minScore?: number, pins?: string[]): SkillDecision;
/** Menu action groups in display order; the menu also uses them when storage cannot start. */
export declare const autoSkillsMenuGroups: Record<string, string[]>;
export declare class AutoSkills implements Service {
    readonly host: Host;
    modeDescriptions: {
        auto: string;
        observe: string;
        off: string;
    };
    menuGroups: Record<string, string[]>;
    capabilities: string[];
    menu: string[];
    catalog: SkillMetadata[];
    agents: AgentDefinition[];
    decision?: SkillDecision;
    dispatcher: ChildDispatcher;
    private ownership;
    constructor(host: Host);
    start(): Promise<void>;
    close(): Promise<void>;
    discover(): Promise<void>;
    select(signals: TaskSignals): Promise<SkillDecision>;
    disclose(decision: SkillDecision): Promise<{
        id: string;
        content: string;
        reason: string;
    }[]>;
    prompt(text: string): Promise<{
        selectedSkills: {
            id: string;
            content: string;
            reason: string;
        }[];
        instruction: string;
    } | undefined>;
    detect(): Promise<string[]>;
    delegate(agentId: string, objective: string, signal?: AbortSignal): Promise<unknown>;
    toolResult(raw: unknown): Promise<void>;
    command(action: string, args: string[], context: CommandContext): Promise<unknown>;
}
export declare const createService: (host: Host) => AutoSkills;
