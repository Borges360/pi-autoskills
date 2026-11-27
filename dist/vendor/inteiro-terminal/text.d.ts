/** Strip OSC/DCS/APC/CSI (7/8 bit), then all controls. External text is never ANSI. */
export declare function safeText(value: unknown): string;
export declare const graphemes: (value: string) => string[];
/** Dependency-free UAX #11 approximation per grapheme: CJK/fullwidth and emoji take two cells. */
export declare function fallbackCellWidth(value: string): number;
export type CellWidthMeasure = (value: string) => number;
/**
 * Injects the renderer's own width function (Pi: `visibleWidth` from pi-tui), so layout and
 * host agree on every line. `undefined` restores the dependency-free fallback.
 */
export declare function setCellWidthMeasure(next?: CellWidthMeasure): void;
export declare const getCellWidthMeasure: () => CellWidthMeasure;
export declare const cellWidth: (value: string) => number;
export declare function truncate(value: string, columns: number, marker?: string): string;
/**
 * Splits text into lines of at most `columns` cells. `grapheme` (default) fills each line;
 * `word` breaks at the last space when there is one and splits only words wider than a line.
 */
export declare function wrap(value: string, columns: number, mode?: "grapheme" | "word"): string[];
/** Pads with spaces to an exact cell width (truncating first when needed). */
export declare function pad(value: string, columns: number, marker?: string): string;
