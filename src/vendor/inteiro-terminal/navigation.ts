import type { Choice } from "./contracts.ts";
export interface Location {
  id: string;
  focusedId: string;
  filter: string;
  offset: number;
}
export class Navigation {
  private history: Location[] = [];
  current: Location;
  readonly items: readonly Choice[];
  constructor(id: string, items: readonly Choice[], selected?: string) {
    this.items = items;
    this.current = {
      id,
      focusedId:
        selected && items.some((i) => i.id === selected)
          ? selected
          : (items.find((i) => !i.disabled)?.id ?? items[0]?.id ?? ""),
      filter: "",
      offset: 0,
    };
  }
  get visible() {
    const q = this.current.filter.toLocaleLowerCase();
    return this.items.filter((i) =>
      `${i.label} ${i.description ?? ""}`.toLocaleLowerCase().includes(q),
    );
  }
  get searchable() {
    return this.items.length > 10;
  }
  move(delta: number, pageSize = 1) {
    const items = this.visible,
      index = Math.max(
        0,
        items.findIndex((i) => i.id === this.current.focusedId),
      );
    this.current.focusedId =
      items[Math.max(0, Math.min(items.length - 1, index + delta * pageSize))]
        ?.id ?? "";
  }
  first() {
    this.current.focusedId = this.visible[0]?.id ?? "";
  }
  last() {
    this.current.focusedId = this.visible.at(-1)?.id ?? "";
  }
  filter(value: string) {
    this.current.filter = value;
    if (!this.visible.some((i) => i.id === this.current.focusedId))
      this.first();
    this.current.offset = 0;
  }
  enter(id: string) {
    this.history.push({ ...this.current });
    this.current = { id, focusedId: "", filter: "", offset: 0 };
  }
  back() {
    const previous = this.history.pop();
    if (previous) this.current = previous;
    return !!previous;
  }
}
