import type { Choice } from "./contracts.ts";
export interface Location {
    id: string;
    focusedId: string;
    filter: string;
    offset: number;
}
export declare class Navigation {
    private history;
    current: Location;
    readonly items: readonly Choice[];
    constructor(id: string, items: readonly Choice[], selected?: string);
    get visible(): Choice[];
    get searchable(): boolean;
    move(delta: number, pageSize?: number): void;
    first(): void;
    last(): void;
    filter(value: string): void;
    enter(id: string): void;
    back(): boolean;
}
