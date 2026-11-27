export interface PiThemeInstallOptions {
    /** Pi agent directory. Default: `PI_CODING_AGENT_DIR` (with `~` expanded) or `~/.pi/agent`. */
    agentDir?: string;
    /** Environment used for the defaults. Default `process.env`. */
    env?: Record<string, string | undefined>;
}
export interface PiThemeInstallResult {
    /** Theme files present in `<agent-dir>/themes/` after the call (written or already there). */
    paths: string[];
    written: string[];
    /** Files left as they were: edited by the user or written by a newer copy. */
    kept: string[];
    errors: string[];
    disabled: boolean;
}
export declare function piAgentDir(env?: Record<string, string | undefined>): string;
/** `a < b` for `x.y.z[-pre.n]` versions; a release is newer than its pre-releases. */
export declare function olderVersion(a: string, b: string): boolean;
export declare function installInteiroPiThemes(options?: PiThemeInstallOptions): PiThemeInstallResult;
/** The part of Pi's `ExtensionAPI` this module uses. */
export interface PiResourceEvents {
    on(event: "resources_discover", handler: () => {
        themePaths: string[];
    }): void;
}
/** Installs the themes now and lists them in the running session. Call once in the extension factory. */
export declare function registerInteiroPiThemes(pi: PiResourceEvents, options?: PiThemeInstallOptions): PiThemeInstallResult;
