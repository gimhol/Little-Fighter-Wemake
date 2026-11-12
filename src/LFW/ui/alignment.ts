import type { UINode } from "./UINode";

export interface IAlignmentInfo {
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  followed?: string | { l?: string; r?: string; t?: string; b?: string };
  offset?: { l?: number; r?: number; t?: number; b?: number };
  once?: boolean;
}

export function normalize_alignment(v: unknown): IAlignmentInfo | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const src = v as Record<string, unknown>;
  const ret: IAlignmentInfo = {};
  if (typeof src.left === "string") ret.left = src.left.trim().toLowerCase();
  if (typeof src.right === "string") ret.right = src.right.trim().toLowerCase();
  if (typeof src.top === "string") ret.top = src.top.trim().toLowerCase();
  if (typeof src.bottom === "string") ret.bottom = src.bottom.trim().toLowerCase();
  if (typeof src.followed === "string") {
    ret.followed = src.followed;
  } else if (src.followed && typeof src.followed === "object" && !Array.isArray(src.followed)) {
    const src_followed = src.followed as Record<string, unknown>;
    const followed: { l?: string; r?: string; t?: string; b?: string } = {};
    if (typeof src_followed.l === "string") followed.l = src_followed.l;
    if (typeof src_followed.r === "string") followed.r = src_followed.r;
    if (typeof src_followed.t === "string") followed.t = src_followed.t;
    if (typeof src_followed.b === "string") followed.b = src_followed.b;
    if (Object.keys(followed).length) ret.followed = followed;
  }
  if (src.offset && typeof src.offset === "object" && !Array.isArray(src.offset)) {
    const src_offset = src.offset as Record<string, unknown>;
    ret.offset = {
      l: Number(src_offset.l) || 0,
      r: Number(src_offset.r) || 0,
      t: Number(src_offset.t) || 0,
      b: Number(src_offset.b) || 0,
    };
  }
  if (src.once === true || src.once === 1 || src.once === "1" || src.once === "true")
    ret.once = true;
  if (!ret.left && !ret.right && !ret.top && !ret.bottom) return null;
  return ret;
}

export function parse_offset(value: string): { l: number; r: number; t: number; b: number } | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (/[lrtb]\s*[:=]/i.test(text)) {
    const named: Partial<Record<"l" | "r" | "t" | "b", number>> = {};
    for (const part of text.split(",")) {
      const matched = part.trim().match(/^([lrtb])\s*[:=]\s*(-?\d+(?:\.\d+)?)$/i);
      if (!matched) continue;
      named[matched[1].toLowerCase() as "l" | "r" | "t" | "b"] = Number(matched[2]);
    }
    if (!Object.keys(named).length) return undefined;
    return { l: named.l ?? 0, r: named.r ?? 0, t: named.t ?? 0, b: named.b ?? 0 };
  }
  const nums = text.split(/[\s,]+/).filter(Boolean).map(Number);
  if (!nums.length || nums.some(v => !Number.isFinite(v))) return undefined;
  if (nums.length === 1) return { l: nums[0], r: nums[0], t: nums[0], b: nums[0] };
  if (nums.length === 2) return { l: nums[0], r: nums[0], t: nums[1], b: nums[1] };
  return { l: nums[0] ?? 0, r: nums[1] ?? 0, t: nums[2] ?? 0, b: nums[3] ?? 0 };
}

export function parse_alignment_object(value: unknown): IAlignmentInfo | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const raw = { ...(value as Record<string, unknown>) };
  if (typeof raw.offset === "string") {
    const offset = parse_offset(raw.offset);
    if (offset) raw.offset = offset;
    else delete raw.offset;
  }
  if (raw.offset == null) {
    const l = Number(raw.offset_l);
    const r = Number(raw.offset_r);
    const t = Number(raw.offset_t);
    const b = Number(raw.offset_b);
    if ([l, r, t, b].some(v => Number.isFinite(v)))
      raw.offset = { l: l || 0, r: r || 0, t: t || 0, b: b || 0 };
  }
  if (raw.followed == null) {
    const l = typeof raw.followed_l === "string" ? raw.followed_l : void 0;
    const r = typeof raw.followed_r === "string" ? raw.followed_r : void 0;
    const t = typeof raw.followed_t === "string" ? raw.followed_t : void 0;
    const b = typeof raw.followed_b === "string" ? raw.followed_b : void 0;
    if (l != null || r != null || t != null || b != null)
      raw.followed = { l, r, t, b };
  }
  return normalize_alignment(raw) ?? undefined;
}

function parse_followed(value: string): IAlignmentInfo["followed"] | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (text.includes(",") || /^[lrtb]\s*[:=]/i.test(text)) {
    const followed: { l?: string; r?: string; t?: string; b?: string } = {};
    for (const part of text.split(",")) {
      const matched = part.trim().match(/^([lrtb])\s*[:=]\s*(.+)$/i);
      if (!matched) continue;
      followed[matched[1].toLowerCase() as "l" | "r" | "t" | "b"] = matched[2].trim();
    }
    if (Object.keys(followed).length) return followed;
  }
  return text;
}

export function parse_alignment(value: unknown): IAlignmentInfo | undefined {
  if (typeof value !== "string") return parse_alignment_object(value);
  const text = value.trim();
  if (!text) return undefined;
  if (text.startsWith("{")) {
    try {
      return parse_alignment_object(JSON.parse(text));
    } catch {
      return undefined;
    }
  }
  const info: IAlignmentInfo = {};
  for (const part of text.split(";")) {
    const decl = part.trim();
    if (!decl) continue;
    const idx = decl.search(/[:=]/);
    if (idx < 0) continue;
    const key = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!val) continue;
    switch (key) {
      case "left": info.left = val; break;
      case "right": info.right = val; break;
      case "top": info.top = val; break;
      case "bottom": info.bottom = val; break;
      case "offset": {
        const offset = parse_offset(val);
        if (offset) info.offset = offset;
        break;
      }
      case "followed": {
        const followed = parse_followed(val);
        if (followed) info.followed = followed;
        break;
      }
      case "once": info.once = val.toLowerCase() === "true" || val === "1"; break;
    }
  }
  return normalize_alignment(info) ?? undefined;
}

function find_node(node: UINode, which: string | null | undefined): UINode | null {
  if (typeof which !== "string") return null;
  const w = which.trim();
  if (w === "parent") return node.parent ?? null;
  if (w === "self") return node;
  if (w.startsWith("parent:")) {
    let distance = Number(w.substring(7));
    let parent = node.parent;
    while (distance && parent) {
      parent = parent.parent;
      --distance;
    }
    return parent ?? null;
  }
  if (w.startsWith("bro:")) {
    const parent = node.parent;
    if (!parent) return null;
    const siblings = parent.children;
    const v = w.substring(4).trim();
    const self_idx = siblings.indexOf(node);
    if (v === "prev" || v === "-1") return siblings[self_idx - 1] ?? null;
    if (v === "next" || v === "+1") return siblings[self_idx + 1] ?? null;
    const sibling = siblings[Number(v)];
    return sibling && sibling !== node ? sibling : null;
  }
  if (w.startsWith("id:")) return node.root?.search_node(w.substring(3).trim()) ?? null;
  if (w.startsWith("name:")) return node.root?.find_child_by_name(w.substring(5).trim()) ?? null;
  return null;
}

export function apply_alignment(follower: UINode, info: IAlignmentInfo): boolean {
  const followed = info.followed;
  const followed_node = (side: "l" | "r" | "t" | "b"): UINode | null =>
    find_node(follower, (typeof followed === "string" ? followed : followed?.[side]) ?? "parent");

  const offset = info.offset;
  const offset_l = offset?.l ?? 0;
  const offset_r = offset?.r ?? 0;
  const offset_t = offset?.t ?? 0;
  const offset_b = offset?.b ?? 0;

  let _l: number | null = null;
  let _r: number | null = null;
  let _t: number | null = null;
  let _b: number | null = null;

  const { x: cx, y: cy } = follower.center;
  const global_pos = follower.global_pos;
  let { x, y } = global_pos;
  const z = global_pos.z;
  let { w, h } = follower;

  const followed_r = info.right ? followed_node("r") : null;
  if (info.right && followed_r && followed_r !== follower) {
    const followed_x = followed_r.global_pos.x;
    const c = followed_r.cross;
    if (info.right === "left") _r = followed_x + c.left;
    else if (info.right === "right") _r = followed_x + c.right;
  }

  const followed_l = info.left ? followed_node("l") : null;
  if (info.left && followed_l && followed_l !== follower) {
    const followed_x = followed_l.global_pos.x;
    const c = followed_l.cross;
    if (info.left === "left") _l = followed_x + c.left;
    else if (info.left === "right") _l = followed_x + c.right;
    else if (info.left === "mid") {
      _l = followed_x + c.mid_x - 0.5 * w;
      _r = null;
    }
  }

  const followed_b = info.bottom ? followed_node("b") : null;
  if (info.bottom && followed_b && followed_b !== follower) {
    const followed_y = followed_b.global_pos.y;
    const c = followed_b.cross;
    if (info.bottom === "top") _b = followed_y + c.top;
    else if (info.bottom === "bottom") _b = followed_y + c.bottom;
  }

  const followed_t = info.top ? followed_node("t") : null;
  if (info.top && followed_t && followed_t !== follower) {
    const followed_y = followed_t.global_pos.y;
    const c = followed_t.cross;
    if (info.top === "top") _t = followed_y + c.top;
    else if (info.top === "bottom") _t = followed_y + c.bottom;
    else if (info.top === "mid") {
      _t = followed_y + c.mid_y - 0.5 * h;
      _b = null;
    }
  }

  const applied = _l !== null || _r !== null || _t !== null || _b !== null;
  if (!applied) return false;

  if (_l !== null && _r !== null) w = (_r - _l) - offset_l + offset_r;
  if (_l !== null) x = _l + cx * w + offset_l;
  else if (_r !== null) x = _r - (1 - cx) * w + offset_r;
  if (_t !== null && _b !== null) h = (_b - _t) - offset_t + offset_b;
  if (_t !== null) y = _t + cy * h + offset_t;
  else if (_b !== null) y = _b - (1 - cy) * h + offset_b;

  if (follower.x !== x || follower.y !== y || follower.z !== z)
    follower.move_to_global(x, y, z);
  if (follower.w !== w || follower.h !== h)
    follower.resize(w, h);
  return true;
}
