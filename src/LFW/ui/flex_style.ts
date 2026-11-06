export type TNodeDisplay = "block" | "flex";

export type TNodeFlexDirection = "row" | "row-reverse" | "column" | "column-reverse";

export type TNodeFlexWrap = "nowrap" | "wrap" | "wrap-reverse";

export type TNodeJustify =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "space-evenly";

export type TNodeAlign = "flex-start" | "flex-end" | "center" | "stretch";

export type TNodeAlignSelf = "auto" | TNodeAlign;

export type TNodeAlignContent =
  | "flex-start"
  | "flex-end"
  | "center"
  | "space-between"
  | "space-around"
  | "stretch";

export type TNodeFlexBasis = number | "auto";

export type TNodePadding = readonly [number, number, number, number];

export interface IFlexStyleData {
  display?: TNodeDisplay | string;
  direction?: TNodeFlexDirection | string;
  wrap?: TNodeFlexWrap | string;
  justify?: TNodeJustify | string;
  align?: TNodeAlign | string;
  align_content?: TNodeAlignContent | string;
  align_self?: TNodeAlignSelf | string;
  gap?: number | string;
  row_gap?: number | string;
  col_gap?: number | string;
  padding?: number | readonly number[] | string;
  grow?: number | string;
  shrink?: number | string;
  basis?: TNodeFlexBasis | string;
  order?: number | string;
  fit?: boolean | string;
  fit_w?: boolean | string;
  fit_h?: boolean | string;
}

const KEY_ALIAS: Record<string, string> = {
  flex_direction: "direction",
  flex_wrap: "wrap",
  justify_content: "justify",
  align_items: "align",
  flex_align_self: "align_self",
  flex_grow: "grow",
  flex_shrink: "shrink",
  flex_basis: "basis",
  flex_order: "order",
  column_gap: "col_gap",
};

const DISPLAY_TABLE: Record<string, TNodeDisplay> = {
  block: "block",
  flex: "flex",
};

const DIRECTION_TABLE: Record<string, TNodeFlexDirection> = {
  row: "row",
  row_reverse: "row-reverse",
  column: "column",
  column_reverse: "column-reverse",
};

const WRAP_TABLE: Record<string, TNodeFlexWrap> = {
  nowrap: "nowrap",
  wrap: "wrap",
  wrap_reverse: "wrap-reverse",
};

const ALIGN_TABLE: Record<string, TNodeAlign> = {
  start: "flex-start",
  flex_start: "flex-start",
  left: "flex-start",
  end: "flex-end",
  flex_end: "flex-end",
  right: "flex-end",
  center: "center",
  stretch: "stretch",
};

const ALIGN_SELF_TABLE: Record<string, TNodeAlignSelf> = {
  auto: "auto",
  ...ALIGN_TABLE,
};

const JUSTIFY_TABLE: Record<string, TNodeJustify> = {
  start: "flex-start",
  flex_start: "flex-start",
  left: "flex-start",
  end: "flex-end",
  flex_end: "flex-end",
  right: "flex-end",
  center: "center",
  between: "space-between",
  space_between: "space-between",
  around: "space-around",
  space_around: "space-around",
  evenly: "space-evenly",
  space_evenly: "space-evenly",
};

const ALIGN_CONTENT_TABLE: Record<string, TNodeAlignContent> = {
  start: "flex-start",
  flex_start: "flex-start",
  end: "flex-end",
  flex_end: "flex-end",
  center: "center",
  stretch: "stretch",
  between: "space-between",
  space_between: "space-between",
  around: "space-around",
  space_around: "space-around",
};

function norm<T extends string>(value: unknown, table: Record<string, T>, fallback: T): T {
  if (typeof value !== "string") return fallback;
  const key = value.trim().toLowerCase().replace(/-/g, "_");
  return table[key] ?? fallback;
}

function bool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") return value === "true" || value === "1";
  return false;
}

function num(value: unknown, fallback: number): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value !== "string" || !value.trim()) return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function padding(value: unknown): TNodePadding {
  if (typeof value === "number") return [value, value, value, value];
  const list = Array.isArray(value)
    ? value.map(Number)
    : typeof value === "string"
      ? value.split(/[,\s]+/).filter(Boolean).map(Number)
      : [];
  const nums = list.filter(Number.isFinite);
  switch (nums.length) {
    case 0: return [0, 0, 0, 0];
    case 1: return [nums[0], nums[0], nums[0], nums[0]];
    case 2: return [nums[0], nums[1], nums[0], nums[1]];
    case 3: return [nums[0], nums[1], nums[2], nums[1]];
    default: return [nums[0], nums[1], nums[2], nums[3]];
  }
}

export function parse_flex_style(v: string | IFlexStyleData | null | undefined): IFlexStyleData | undefined {
  if (v == null) return void 0;
  if (typeof v !== "string") return v;
  const ret: Record<string, string> = {};
  for (const part of v.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim().toLowerCase().replace(/-/g, "_");
    if (!key) continue;
    ret[key] = part.slice(idx + 1).trim();
  }
  return ret;
}

export function normalize_flex_style(
  data?: string | IFlexStyleData | null
): Required<IFlexStyleData> | undefined {
  const src = parse_flex_style(data);
  if (!src) return void 0;
  const raw: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(src)) {
    raw[KEY_ALIAS[key] ?? key] = value;
  }
  const basis = raw.basis;
  return {
    display: norm(raw.display, DISPLAY_TABLE, "block"),
    direction: norm(raw.direction, DIRECTION_TABLE, "row"),
    wrap: norm(raw.wrap, WRAP_TABLE, "nowrap"),
    justify: norm(raw.justify, JUSTIFY_TABLE, "flex-start"),
    align: norm(raw.align, ALIGN_TABLE, "stretch"),
    align_content: norm(raw.align_content, ALIGN_CONTENT_TABLE, "stretch"),
    align_self: norm(raw.align_self, ALIGN_SELF_TABLE, "auto"),
    gap: num(raw.gap, 0),
    row_gap: num(raw.row_gap, num(raw.gap, 0)),
    col_gap: num(raw.col_gap, num(raw.gap, 0)),
    padding: padding(raw.padding),
    grow: Math.max(0, num(raw.grow, 0)),
    shrink: Math.max(0, num(raw.shrink, 1)),
    basis: basis == null || basis === "" || basis === "auto" ? "auto" : num(basis, 0),
    order: num(raw.order, 0),
    fit: bool(raw.fit),
    fit_w: bool(raw.fit_w ?? raw.fit),
    fit_h: bool(raw.fit_h ?? raw.fit),
  };
}

export class FlexStyle {
  on_change: (() => void) | undefined;

  private _display: TNodeDisplay = "block";
  private _direction: TNodeFlexDirection = "row";
  private _wrap: TNodeFlexWrap = "nowrap";
  private _justify: TNodeJustify = "flex-start";
  private _align: TNodeAlign = "stretch";
  private _align_content: TNodeAlignContent = "stretch";
  private _align_self: TNodeAlignSelf = "auto";
  private _gap = 0;
  private _row_gap = 0;
  private _col_gap = 0;
  private _padding: TNodePadding = [0, 0, 0, 0];
  private _grow = 0;
  private _shrink = 1;
  private _basis: TNodeFlexBasis = "auto";
  private _order = 0;
  private _fit_w = false;
  private _fit_h = false;
  private _stretch_force = false;

  constructor(data?: string | IFlexStyleData | null) {
    this.assign(data);
  }

  assign(data?: string | IFlexStyleData | null): this {
    const v = normalize_flex_style(data);
    if (!v) return this;
    this._display = v.display as TNodeDisplay;
    this._direction = v.direction as TNodeFlexDirection;
    this._wrap = v.wrap as TNodeFlexWrap;
    this._justify = v.justify as TNodeJustify;
    this._align = v.align as TNodeAlign;
    this._align_content = v.align_content as TNodeAlignContent;
    this._align_self = v.align_self as TNodeAlignSelf;
    this._gap = v.gap as number;
    this._row_gap = v.row_gap as number;
    this._col_gap = v.col_gap as number;
    this._padding = v.padding as unknown as TNodePadding;
    this._grow = v.grow as number;
    this._shrink = v.shrink as number;
    this._basis = v.basis as TNodeFlexBasis;
    this._order = v.order as number;
    this._fit_w = v.fit_w as boolean;
    this._fit_h = v.fit_h as boolean;
    this._notify();
    return this;
  }

  get display(): TNodeDisplay { return this._display; }
  set display(v: TNodeDisplay) {
    const n = norm(v, DISPLAY_TABLE, "block");
    if (n === this._display) return;
    this._display = n;
    this._notify();
  }

  get direction(): TNodeFlexDirection { return this._direction; }
  set direction(v: TNodeFlexDirection) {
    const n = norm(v, DIRECTION_TABLE, "row");
    if (n === this._direction) return;
    this._direction = n;
    this._notify();
  }

  get wrap(): TNodeFlexWrap { return this._wrap; }
  set wrap(v: TNodeFlexWrap) {
    const n = norm(v, WRAP_TABLE, "nowrap");
    if (n === this._wrap) return;
    this._wrap = n;
    this._notify();
  }

  get justify(): TNodeJustify { return this._justify; }
  set justify(v: TNodeJustify) {
    const n = norm(v, JUSTIFY_TABLE, "flex-start");
    if (n === this._justify) return;
    this._justify = n;
    this._notify();
  }

  get align(): TNodeAlign { return this._align; }
  set align(v: TNodeAlign) {
    const n = norm(v, ALIGN_TABLE, "stretch");
    if (n === this._align) return;
    this._align = n;
    this._notify();
  }

  get align_content(): TNodeAlignContent { return this._align_content; }
  set align_content(v: TNodeAlignContent) {
    const n = norm(v, ALIGN_CONTENT_TABLE, "stretch");
    if (n === this._align_content) return;
    this._align_content = n;
    this._notify();
  }

  get align_self(): TNodeAlignSelf { return this._align_self; }
  set align_self(v: TNodeAlignSelf) {
    const n = norm(v, ALIGN_SELF_TABLE, "auto");
    if (n === this._align_self) return;
    this._align_self = n;
    this._notify();
  }

  get gap(): number { return this._gap; }
  set gap(v: number) {
    const n = num(v, 0);
    if (n === this._gap) return;
    this._gap = n;
    this._notify();
  }

  get row_gap(): number { return this._row_gap; }
  set row_gap(v: number) {
    const n = num(v, 0);
    if (n === this._row_gap) return;
    this._row_gap = n;
    this._notify();
  }

  get col_gap(): number { return this._col_gap; }
  set col_gap(v: number) {
    const n = num(v, 0);
    if (n === this._col_gap) return;
    this._col_gap = n;
    this._notify();
  }

  get padding(): TNodePadding { return this._padding; }
  set padding(v: number | readonly number[] | string) {
    const n = padding(v);
    if (n.every((value, i) => value === this._padding[i])) return;
    this._padding = n;
    this._notify();
  }

  get grow(): number { return this._grow; }
  set grow(v: number) {
    const n = Math.max(0, num(v, 0));
    if (n === this._grow) return;
    this._grow = n;
    this._notify();
  }

  get shrink(): number { return this._shrink; }
  set shrink(v: number) {
    const n = Math.max(0, num(v, 1));
    if (n === this._shrink) return;
    this._shrink = n;
    this._notify();
  }

  get basis(): TNodeFlexBasis { return this._basis; }
  set basis(v: TNodeFlexBasis) {
    const n = v === "auto" ? "auto" : Math.max(0, num(v, 0));
    if (n === this._basis) return;
    this._basis = n;
    this._notify();
  }

  get order(): number { return this._order; }
  set order(v: number) {
    const n = num(v, 0);
    if (n === this._order) return;
    this._order = n;
    this._notify();
  }

  get fit(): boolean { return this._fit_w && this._fit_h; }
  set fit(v: boolean) { this._set_fit(bool(v), bool(v)); }

  get fit_w(): boolean { return this._fit_w; }
  set fit_w(v: boolean) { this._set_fit(bool(v), this._fit_h); }

  get fit_h(): boolean { return this._fit_h; }
  set fit_h(v: boolean) { this._set_fit(this._fit_w, bool(v)); }

  get stretch_force(): boolean { return this._stretch_force; }
  set stretch_force(v: boolean) {
    const n = bool(v);
    if (n === this._stretch_force) return;
    this._stretch_force = n;
    this._notify();
  }

  private _set_fit(w: boolean, h: boolean): void {
    if (w === this._fit_w && h === this._fit_h) return;
    this._fit_w = w;
    this._fit_h = h;
    this._notify();
  }

  private _notify(): void {
    this.on_change?.();
  }
}
