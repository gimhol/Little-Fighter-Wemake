import { round_float } from "../utils/math/round_float";
import type {
  TNodeAlign,
  TNodeAlignContent,
  TNodeAlignSelf,
  TNodeFlexBasis,
  TNodeFlexDirection,
  TNodeFlexWrap,
  TNodeJustify,
  TNodePadding,
} from "./flex_style";
import type { UINode } from "./UINode";

export interface IFlexItemInput {
  key: number;
  width: number;
  height: number;
  grow: number;
  shrink: number;
  basis: TNodeFlexBasis;
  align_self: TNodeAlignSelf;
  order: number;
  stretchable: boolean;
}

export interface IFlexContainerInput {
  width: number;
  height: number;
  direction: TNodeFlexDirection;
  wrap: TNodeFlexWrap;
  justify: TNodeJustify;
  align: TNodeAlign;
  align_content: TNodeAlignContent;
  row_gap: number;
  col_gap: number;
  padding: TNodePadding;
}

export interface IFlexItemOutput {
  key: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ILine {
  items: IFlexItemInput[];
  base: number[];
  main: number[];
  cross: number;
  top: number;
}

const EPSILON = 1e-6;

function flip_justify(v: TNodeJustify): TNodeJustify {
  if (v === "flex-start") return "flex-end";
  if (v === "flex-end") return "flex-start";
  return v;
}

export function compute_flex_layout(
  container: IFlexContainerInput,
  items: readonly IFlexItemInput[]
): IFlexItemOutput[] {
  if (!items.length) return [];

  const [padding_top, padding_right, padding_bottom, padding_left] = container.padding;
  const content_w = Math.max(0, container.width - padding_left - padding_right);
  const content_h = Math.max(0, container.height - padding_top - padding_bottom);

  const is_row = container.direction === "row" || container.direction === "row-reverse";
  const reverse = container.direction === "row-reverse" || container.direction === "column-reverse";
  const main_size = is_row ? content_w : content_h;
  const cross_size = is_row ? content_h : content_w;
  const main_gap = Math.max(0, is_row ? container.col_gap : container.row_gap);
  const line_gap = Math.max(0, is_row ? container.row_gap : container.col_gap);

  const ordered = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => a.item.order - b.item.order || a.index - b.index)
    .map(v => v.item);
  if (reverse) ordered.reverse();

  const base_of = (item: IFlexItemInput): number =>
    item.basis === "auto" ? (is_row ? item.width : item.height) : Math.max(0, item.basis);
  const cross_of = (item: IFlexItemInput): number => (is_row ? item.height : item.width);

  const lines: ILine[] = [];
  const push_line = (line_items: IFlexItemInput[]): void => {
    const base = line_items.map(base_of);
    lines.push({ items: line_items, base, main: [...base], cross: 0, top: 0 });
  };
  if (container.wrap === "nowrap") {
    push_line(ordered);
  } else {
    let current: IFlexItemInput[] = [];
    let used = 0;
    for (const item of ordered) {
      const size = base_of(item);
      const next = current.length ? used + main_gap + size : size;
      if (current.length && next > main_size) {
        push_line(current);
        current = [item];
        used = size;
      } else {
        current.push(item);
        used = next;
      }
    }
    if (current.length) push_line(current);
  }

  for (const line of lines) {
    const count = line.items.length;
    const gaps = Math.max(0, count - 1) * main_gap;
    const total = line.base.reduce((a, b) => a + b, 0) + gaps;
    const free = main_size - total;
    if (free > EPSILON) {
      const grow_sum = line.items.reduce((a, item) => a + item.grow, 0);
      if (grow_sum > 0) {
        for (let i = 0; i < count; i++) line.main[i] += free * line.items[i].grow / grow_sum;
      }
    } else if (free < -EPSILON) {
      const shrink_sum = line.items.reduce((a, item, i) => a + item.shrink * line.base[i], 0);
      if (shrink_sum > 0) {
        for (let i = 0; i < count; i++) {
          const delta = -free * (line.items[i].shrink * line.base[i]) / shrink_sum;
          line.main[i] = Math.max(0, line.base[i] - delta);
        }
      }
    }
    for (const item of line.items) line.cross = Math.max(line.cross, cross_of(item));
  }

  let cross_free = cross_size - (
    lines.reduce((a, line) => a + line.cross, 0) + Math.max(0, lines.length - 1) * line_gap
  );
  let line_cursor = 0;
  let line_extra = 0;
  if (container.align_content === "stretch") {
    const free = Math.max(0, cross_free);
    const total_cross = lines.reduce((a, line) => a + line.cross, 0);
    for (const line of lines) {
      line.cross += total_cross > 0 ? free * line.cross / total_cross : free / lines.length;
    }
    cross_free = 0;
  } else if (cross_free > 0) {
    switch (container.align_content) {
      case "flex-end": line_cursor = cross_free; break;
      case "center": line_cursor = cross_free / 2; break;
      case "space-between": line_extra = lines.length > 1 ? cross_free / (lines.length - 1) : 0; break;
      case "space-around":
        line_extra = cross_free / lines.length;
        line_cursor = line_extra / 2;
        break;
      default: break;
    }
  }
  for (const line of lines) {
    line.top = line_cursor;
    line_cursor += line.cross + line_gap + line_extra;
  }
  if (container.wrap === "wrap-reverse") {
    for (const line of lines) line.top = cross_size - (line.top + line.cross);
  }

  const justify = reverse ? flip_justify(container.justify) : container.justify;
  const out: IFlexItemOutput[] = [];
  for (const line of lines) {
    const count = line.items.length;
    const gaps = Math.max(0, count - 1) * main_gap;
    const remain = Math.max(0, main_size - (line.main.reduce((a, b) => a + b, 0) + gaps));
    let main_cursor = 0;
    let main_extra = 0;
    switch (justify) {
      case "flex-end": main_cursor = remain; break;
      case "center": main_cursor = remain / 2; break;
      case "space-between": main_extra = count > 1 ? remain / (count - 1) : 0; break;
      case "space-around":
        main_extra = remain / count;
        main_cursor = main_extra / 2;
        break;
      case "space-evenly":
        main_extra = remain / (count + 1);
        main_cursor = main_extra;
        break;
      default: break;
    }
    for (let i = 0; i < count; i++) {
      const item = line.items[i];
      const self = item.align_self === "auto" ? container.align : item.align_self;
      const stretch = self === "stretch" && item.stretchable;
      const cross_len = stretch ? line.cross : cross_of(item);
      const cross_offset = self === "flex-end"
        ? line.cross - cross_len
        : self === "center"
          ? (line.cross - cross_len) / 2
          : 0;
      const main_len = line.main[i];
      out.push({
        key: item.key,
        x: is_row ? main_cursor : line.top + cross_offset,
        y: is_row ? line.top + cross_offset : main_cursor,
        width: is_row ? main_len : cross_len,
        height: is_row ? cross_len : main_len,
      });
      main_cursor += main_len + main_gap + main_extra;
    }
  }
  return out;
}

function is_stretchable(node: UINode): boolean {
  return !node.raw?.size;
}

export function apply_flex_layout(node: UINode): void {
  const targets: UINode[] = [];
  const items: IFlexItemInput[] = [];
  for (const child of node.children) {
    if (!child.self_visible) continue;
    items.push({
      key: targets.length,
      width: child.w,
      height: child.h,
      grow: child.flex.grow,
      shrink: child.flex.shrink,
      basis: child.flex.basis,
      align_self: child.flex.align_self,
      order: child.flex.order,
      stretchable: is_stretchable(child),
    });
    targets.push(child);
  }
  if (!items.length) return;

  const flex = node.flex;
  const result = compute_flex_layout({
    width: node.w,
    height: node.h,
    direction: flex.direction,
    wrap: flex.wrap,
    justify: flex.justify,
    align: flex.align,
    align_content: flex.align_content,
    row_gap: flex.row_gap,
    col_gap: flex.col_gap,
    padding: flex.padding,
  }, items);

  const origin_x = -node.cx * node.w + flex.padding[3];
  const origin_y = -node.cy * node.h + flex.padding[0];
  for (const r of result) {
    const child = targets[r.key];
    const w = round_float(r.width);
    const h = round_float(r.height);
    if (child.w !== w || child.h !== h) child.resize(w, h);
    const x = round_float(origin_x + r.x + child.cx * child.w);
    const y = round_float(origin_y + r.y + child.cy * child.h);
    if (child.x !== x || child.y !== y) child.move_to(x, y, child.z);
  }
}
