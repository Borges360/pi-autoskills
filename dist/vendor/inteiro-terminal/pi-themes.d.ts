export declare const PI_THEMES_VERSION = "2.0.0-rc.1";
export interface PiThemeFile {
    $schema: string;
    name: string;
    appearance: "dark" | "light";
    vars: Record<string, string>;
    colors: Record<string, string>;
    export: Record<string, string>;
}
export declare const PI_THEMES: readonly PiThemeFile[];
