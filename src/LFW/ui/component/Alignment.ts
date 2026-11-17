import type { UINode } from "../UINode";
import { parse_percent } from "../alignment";
import { UIComponent } from "./UIComponent";

interface IFolloweds {
  l?: UINode | null
  r?: UINode | null
  t?: UINode | null
  b?: UINode | null
}
interface IAligns {
  l?: string | null;
  r?: string | null;
  t?: string | null;
  b?: string | null;
}
interface IOffsets {
  l: number;
  r: number;
  t: number;
  b: number;
}
class Offsets implements IOffsets {
  l: number = 0;
  r: number = 0;
  t: number = 0;
  b: number = 0;
}
/** FIXME: 总觉得这玩意设计有问题 -Gim */
export class Alignment extends UIComponent {
  static override readonly TAGS: string[] = ["Alignment"];
  follower: UINode | null = null;

  readonly followed: IFolloweds = {};
  readonly align: IAligns = {}
  readonly offset: Offsets = new Offsets
  protected once: boolean = false;
  override on_start(): void {
    const { followed, offset } = this.props_holder.raw;
    this.followed.l = this.find_node((typeof followed === 'string' ? followed : followed?.l) ?? "parent")
    this.followed.r = this.find_node((typeof followed === 'string' ? followed : followed?.r) ?? "parent")
    this.followed.t = this.find_node((typeof followed === 'string' ? followed : followed?.t) ?? "parent")
    this.followed.b = this.find_node((typeof followed === 'string' ? followed : followed?.b) ?? "parent")
    this.follower = this.find_node(this.props_holder.str("follower"))
    this.align.l = this.props_holder.str("left")
    this.align.r = this.props_holder.str("right")
    this.align.t = this.props_holder.str("top")
    this.align.b = this.props_holder.str("bottom")
    this.once = !!this.props_holder.bool("once");

    this.offset.l = Number(offset?.l) || 0
    this.offset.r = Number(offset?.r) || 0
    this.offset.t = Number(offset?.t) || 0
    this.offset.b = Number(offset?.b) || 0
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override update(dt: number): void {
    const { followed, follower, offset } = this
    if (!follower) return;
    let _l: number | null = null;
    let _r: number | null = null;
    let _t: number | null = null;
    let _b: number | null = null;

    const { x: cx, y: cy } = follower.center;
    // eslint-disable-next-line prefer-const
    let { x, y, z } = follower.global_pos;
    let { w, h } = follower;
    const left_pct = parse_percent(this.align.l);
    const right_pct = parse_percent(this.align.r);
    const top_pct = parse_percent(this.align.t);
    const bottom_pct = parse_percent(this.align.b);
    if (this.align.r && followed.r && followed.r !== follower) {
      const { x } = followed.r.global_pos;
      const c = followed.r.cross;
      if (right_pct !== null) {
        _r = x + c.left + right_pct * (c.right - c.left - w) + w;
      } else switch (this.align.r) {
        case "left": _r = x + c.left; break;
        case "right": _r = x + c.right; break;
      }
    }

    if (this.align.l && followed.l && followed.l !== follower) {
      const { x } = followed.l.global_pos;
      const c = followed.l.cross;
      if (left_pct !== null) {
        _l = x + c.left + left_pct * (c.right - c.left - w);
      } else switch (this.align.l) {
        case "left": _l = x + c.left; break;
        case "right": _l = x + c.right; break;
        case "mid":
          _l = x + c.mid_x - 0.5 * w;
          _r = null;
          break;
      }
    }

    if (this.align.b && followed.b && followed.b !== follower) {
      const { y } = followed.b.global_pos;
      const c = followed.b.cross;
      if (bottom_pct !== null) {
        _b = y + c.top + bottom_pct * (c.bottom - c.top - h) + h;
      } else switch (this.align.b) {
        case "top": _b = y + c.top; break;
        case "bottom": _b = y + c.bottom; break;
      }
    }
    if (this.align.t && followed.t && followed.t !== follower) {
      const { y } = followed.t.global_pos;
      const c = followed.t.cross;
      if (top_pct !== null) {
        _t = y + c.top + top_pct * (c.bottom - c.top - h);
      } else switch (this.align.t) {
        case "top": _t = y + c.top; break;
        case "bottom": _t = y + c.bottom; break;
        case "mid":
          _t = y + c.mid_y - 0.5 * h;
          _b = null;
          break;
      }
    }
    if (_l !== null && _r !== null) {
      w = (_r - _l) - offset.l + offset.r
    }
    if (_l !== null) {
      x = _l + cx * w + offset.l
    } else if (_r !== null) {
      x = _r - (1 - cx) * w + offset.r
    }
    if (_t !== null && _b !== null) {
      h = (_b - _t) - offset.t + offset.b
    }
    if (_t !== null) {
      y = _t + cy * h + offset.t
    } else if (_b !== null) {
      y = _b - (1 - cy) * h + offset.b
    }
    follower.move_to_global(x, y, z);
    follower.resize(w, h);
    if (this.once) this.node.del_components(this);
  }
}
