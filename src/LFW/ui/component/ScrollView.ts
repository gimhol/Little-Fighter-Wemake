import { Defines, GK, type IPropsMeta } from "../../defines";
import type { IPointingEvent } from "../../ditto/pointings/IPointingEvent";
import type { IPointingsCallback } from "../../ditto/pointings/IPointingsCallback";
import { max, round } from "../../utils/math/base";
import { clamp } from "../../utils/math/clamp";
import { UINode } from "../UINode";
import type { IUICompnentCallbacks } from "./IUICompnentCallbacks";
import { SliderHandle } from "./Slider/SliderHandle";
import { UIComponent } from "./UIComponent";

export interface IScrollViewProps {
  /** 滚动方向，row=横向，col=纵向（默认 col） */
  direction?: 'row' | 'col';
  /**
   * 内容节点（被滚动的内容），缺省为视口的第一个可见子节点。
   *
   * 滚动视图会把该节点整体平移，因此要求它直接挂在视口节点下，
   * 且「未被滚动时内容起点与视口起点对齐」这一几何关系由 data 保证即可，
   * 组件会自动根据内容子节点实际包围盒推算可滚动区间。
   */
  content?: UINode;
  /** 可选：关联的滚动条（SliderHandle 组件 id），会自动双向同步 */
  scrollbar?: SliderHandle;
  /** 是否允许鼠标拖拽内容滚动（默认 true） */
  draggable?: boolean;
  /** 是否允许使用方向键滚动（默认 true，需视口/内容节点持有焦点） */
  keyboard?: boolean;
  /** 是否响应滚轮滚动（默认 true，需光标位于视口内） */
  wheel?: boolean;
  /** 滚轮滚动倍率（默认 1；delta 已换算为 UI 像素） */
  wheel_speed?: number;
  /**
   * 是否额外隐藏视口外的内容子节点（默认 false，仅当需要“虚拟化”时才开启）。
   *
   * 视口节点已启用 overflow:hidden 裁剪（越界部分不再绘制、不再响应指针），一般无需开启本项；
   * 注意若内容由 VerticalLayout 等“跳过隐藏子节点”的布局排版，开启裁剪会导致排版塌缩/跳动。
   */
  cull?: boolean;
  /** 方向键每步滚动的像素（默认 40） */
  step?: number;
  /** 平滑速度 0~1，每帧向目标靠近的比例（默认 0.4；<=0 或 >=1 时直接跳变） */
  speed?: number;
  /** 触发拖拽判定前允许的指针位移 px（默认 8） */
  drag_threshold?: number;
  /** 焦点在内容子节点之间移动时，是否自动滚动使其保持可见（默认 true） */
  follow_focus?: boolean;
}

export interface IScrollViewCallbacks extends IUICompnentCallbacks {
  on_scroll?(offset: number, factor: number, component: ScrollView): void;
  on_scroll_start?(component: ScrollView): void;
  on_scroll_end?(component: ScrollView): void;
}

const KEY_REPEAT_MS = 80;

export class ScrollView extends UIComponent<IScrollViewProps, IScrollViewCallbacks> {
  static override readonly TAGS: string[] = ["ScrollView"];
  static override readonly PROPS: IPropsMeta<IScrollViewProps> = {
    direction: { type: String, oneof: ["row", "col"], nullable: true },
    content: UINode,
    scrollbar: SliderHandle,
    draggable: { type: Boolean, nullable: true },
    keyboard: { type: Boolean, nullable: true },
    wheel: { type: Boolean, nullable: true },
    cull: { type: Boolean, nullable: true },
    step: Number,
    speed: Number,
    drag_threshold: Number,
    wheel_speed: Number,
    follow_focus: { type: Boolean, nullable: true },
  }

  protected _content: UINode | undefined;
  protected _captured = false;
  protected _base_x = 0;
  protected _base_y = 0;

  /** 当前实际滚动的像素（0 ~ max_scroll，从“内容起点对齐视口起点”算起） */
  protected _offset = 0;
  /** 目标滚动像素（带平滑） */
  protected _target_offset = 0;
  protected _reported = -1;

  /** 被本组件隐藏（裁剪）的内容子节点 */
  protected _culled = new Set<UINode>();
  protected _cull_orig = new Map<UINode, boolean>();

  // 拖拽
  protected _armed = false;
  protected _dragging = false;
  protected _last_axis = 0;
  protected _drag_dist = 0;

  // 键盘
  protected _key_active = false;
  protected _key_time = 0;

  // 滚动条同步
  protected _last_slider_factor: number | null = null;

  get direction() { return this.props.direction ?? 'col'; }
  get is_col() { return this.direction === 'col'; }
  get step() { return this.props.step ?? 40; }
  get speed() { const v = this.props.speed; return v == null ? 0.4 : v; }
  get draggable() { return this.props.draggable !== false; }
  get keyboard() { return this.props.keyboard !== false; }
  get wheel_enabled() { return this.props.wheel !== false; }
  get wheel_speed() { return this.props.wheel_speed ?? 1; }
  get cull() { return this.props.cull === true; }
  get drag_threshold() { return this.props.drag_threshold ?? 8; }
  get follow_focus() { return this.props.follow_focus !== false; }

  /** 内容节点（被滚动的节点） */
  get content(): UINode | undefined {
    if (this._content) return this._content;
    const c = this.props.content;
    if (c) return this._content = c;
    const child = this.node.children.find(v => v.self_visible) ?? this.node.children[0];
    return this._content = child;
  }
  set content(v: UINode | undefined) {
    this._content = v;
    this._captured = false;
    this._target_offset = 0;
    this._offset = 0;
  }

  /** 可滚动像素（内容超出视口的部分）；内容不足一屏时为 0 */
  get max_scroll(): number {
    const [lo, hi] = this.range();
    return max(0, hi - lo);
  }
  /** 当前滚动像素 */
  get offset() { return this._offset; }
  set offset(v: number) { this.scroll_to(v); }
  /** 当前进度 0~1 */
  get factor() {
    const m = this.max_scroll;
    return m > 0 ? clamp(this._offset / m, 0, 1) : 0;
  }
  set factor(v: number) { this.scroll_to(clamp(v, 0, 1) * this.max_scroll); }

  override on_start(): void {
    super.on_start?.();
    // 启用 overflow:hidden：视口矩形外的内容（渲染与指针）都会被裁剪
    this.node.clip_children = true;
    // 拖拽与滚轮都通过 pointings 订阅（拖拽在 on_pointer_down 内按 draggable 判定）
    this.lfw.pointings.callback.add(this.p);
    this._captured = false;
    this._target_offset = this._offset;
  }
  override on_stop(): void {
    super.on_stop?.();
    this.lfw.pointings.callback.del(this.p);
    this._armed = false;
    this._dragging = false;
  }
  override on_resume(): void {
    super.on_resume?.();
    this.node.clip_children = true;
    this._armed = false;
    this._dragging = false;
  }

  /**
   * 滚动到指定像素（从“内容起点对齐视口起点”算起），带平滑
   */
  scroll_to(offset: number): this {
    this._target_offset = clamp(offset, 0, this.max_scroll);
    return this;
  }
  /** 相对滚动（向下/向右为正） */
  scroll_by(delta: number): this {
    return this.scroll_to(this._target_offset + delta);
  }
  scroll_to_start(): this { return this.scroll_to(0); }
  scroll_to_end(): this { return this.scroll_to(this.max_scroll); }

  on_scroll(cb: (offset: number, factor: number, component: ScrollView) => void): this {
    this.callbacks.add({ on_scroll: cb });
    return this;
  }

  /**
   * 滚动使指定节点可见（节点需位于内容子树内）
   */
  ensure_visible(node: UINode): boolean {
    const m = this.max_scroll;
    if (m <= 0) return false;
    const [s, e] = this.node_range(node);
    const view = this.is_col ? this.node.h : this.node.w;
    const win_lo = this.window_lo();
    const win_hi = win_lo + view;
    let o = this._target_offset;
    if (s < win_lo) {
      o += s - win_lo;
    } else if (e > win_hi) {
      o += e - win_hi;
    }
    if (o !== this._target_offset) this.scroll_to(o);
    return o !== this._target_offset;
  }

  override update(dt: number): void {
    const c = this.content;
    if (!c) return;
    if (!this._captured) {
      this._base_x = c.x;
      this._base_y = c.y;
      this._captured = true;
    }

    // 内容尺寸变化后收敛目标
    this._target_offset = clamp(this._target_offset, 0, this.max_scroll);
    if (this._dragging || this.speed <= 0 || this.speed >= 1) {
      this._offset = this._target_offset;
    } else {
      this._offset += (this._target_offset - this._offset) * this.speed;
      if (Math.abs(this._target_offset - this._offset) < 0.5) this._offset = this._target_offset;
    }

    // 焦点位于内容内时，自动滚动保持其可见
    if (this.follow_focus) {
      const foc = this.focused_in(c);
      if (foc) this.ensure_visible(foc);
    }

    this.apply_offset();
    this.update_cull();
    this.update_keys(dt);
    this.sync_scrollbar();

    const o = round(this._offset);
    if (o !== this._reported) {
      this._reported = o;
      this.callbacks.call('on_scroll', this._offset, this.factor, this);
    }
  }

  /** 可滚动区间（内容起点/终点允许的平移量，相对基础位置，单位 px） */
  protected range(): [number, number] {
    const c = this.content;
    if (!c) return [0, 0];
    if (this.is_col) {
      const vh = this.node.h;
      if (vh <= 0) return [0, 0];
      const vt = this.node.cross.top;
      const [ct, cb] = this.box(c);
      if (cb - ct <= vh) return [0, 0];
      return [ct - vt + this._base_y, cb - (vt + vh) + this._base_y];
    }
    const vw = this.node.w;
    if (vw <= 0) return [0, 0];
    const vl = this.node.cross.left;
    const [cl, cr] = this.box(c);
    if (cr - cl <= vw) return [0, 0];
    return [cl - vl + this._base_x, cr - (vl + vw) + this._base_x];
  }

  /** 视口起点在内容坐标系中的位置（对应 offset=0 的窗口起点） */
  protected window_lo(): number {
    const [lo] = this.range();
    const c = this.content;
    if (!c) return this._offset;
    if (this.is_col) {
      return this.node.cross.top - this._base_y + lo + this._offset;
    }
    return this.node.cross.left - this._base_x + lo + this._offset;
  }

  /** 内容节点子节点的包围盒（内容坐标系） */
  protected box(c: UINode): [number, number] {
    let lo = 0;
    let hi = 0;
    let first = true;
    for (const child of c.children) {
      if (!child.self_visible && !this._culled.has(child)) continue;
      const [s, e] = this.node_range(child);
      if (first) { lo = s; hi = e; first = false; }
      else {
        lo = Math.min(lo, s);
        hi = Math.max(hi, e);
      }
    }
    return [lo, hi];
  }

  protected node_range(n: UINode): [number, number] {
    const c = this.content;
    let ox = 0;
    let oy = 0;
    for (let p: UINode | undefined = n; p && p !== c; p = p.parent) {
      ox += p.x;
      oy += p.y;
    }
    if (this.is_col) {
      return [oy + n.cross.top, oy + n.cross.bottom];
    }
    return [ox + n.cross.left, ox + n.cross.right];
  }

  protected apply_offset(): void {
    const c = this.content;
    if (!c) return;
    const [lo] = this.range();
    const t = lo + this._offset;
    if (this.is_col) {
      const y = this._base_y - t;
      if (c.y !== y) c.y = y;
    } else {
      const x = this._base_x - t;
      if (c.x !== x) c.x = x;
    }
  }

  protected update_cull(): void {
    if (!this.cull) return;
    const c = this.content;
    if (!c) return;
    const view = this.is_col ? this.node.h : this.node.w;
    if (view <= 0) return;
    const win_lo = this.window_lo();
    const win_hi = win_lo + view;
    for (const child of c.children) {
      const [s, e] = this.node_range(child);
      const inside = e > win_lo && s < win_hi;
      if (inside) {
        if (this._culled.delete(child)) {
          const orig = this._cull_orig.get(child);
          if (child.self_visible !== (orig ?? true)) child.visible = orig ?? true;
        }
      } else if (!this._culled.has(child) && child.self_visible) {
        if (!this._cull_orig.has(child)) this._cull_orig.set(child, true);
        this._culled.add(child);
        child.visible = false;
      }
    }
  }

  // ===================== 方向键 =====================
  protected key_dir(): number {
    const k = this.keys;
    const hold = (gk: GK) => !k[gk].is_end();
    if (this.is_col) {
      return (hold(GK.D) ? 1 : 0) - (hold(GK.U) ? 1 : 0);
    }
    return (hold(GK.R) ? 1 : 0) - (hold(GK.L) ? 1 : 0);
  }
  protected update_keys(dt: number): void {
    if (!this.keyboard || this.max_scroll <= 0) { this._key_active = false; this._key_time = 0; return; }
    const c = this.content;
    if (!(this.node.focused || (!!c && c.focused))) { this._key_active = false; this._key_time = 0; return; }
    const dir = this.key_dir();
    if (!dir) { this._key_active = false; this._key_time = 0; return; }
    if (!this._key_active) {
      this._key_active = true;
      this._key_time = 0;
      this.scroll_by(dir * this.step);
      return;
    }
    this._key_time += dt;
    while (this._key_time >= KEY_REPEAT_MS) {
      this._key_time -= KEY_REPEAT_MS;
      this.scroll_by(dir * this.step);
    }
  }

  /** 焦点节点是否位于内容子树内 */
  protected focused_in(c: UINode): UINode | undefined {
    const f = this.node.focused_node;
    if (!f || f === this.node || f === c) return void 0;
    for (let n: UINode | undefined = f; n; n = n.parent) {
      if (n === c) return f;
    }
    return void 0;
  }

  protected pointer_axis_px(e: IPointingEvent): number {
    if (this.is_col) {
      return Defines.MODERN_SCREEN_HEIGHT * (1 - e.scene_y) / 2;
    }
    return Defines.MODERN_SCREEN_WIDTH * (e.scene_x + 1) / 2;
  }
  protected pointer_in_view(e: IPointingEvent): boolean {
    const g = this.node.geo;
    if (this.is_col) {
      const fy = Defines.MODERN_SCREEN_HEIGHT * (1 - e.scene_y) / 2;
      return fy >= g.top && fy <= g.bottom;
    }
    const fx = Defines.MODERN_SCREEN_WIDTH * (e.scene_x + 1) / 2;
    return fx >= g.left && fx <= g.right;
  }
  protected p: IPointingsCallback = {
    on_pointer_down: (e: IPointingEvent): void => {
      if (!this.draggable) return;
      if (!this.node.visible || this.node.disabled) return;
      if (e.button !== 0) return;
      if (this.max_scroll <= 0) return;
      if (!this.pointer_in_view(e)) return;
      this._armed = true;
      this._dragging = false;
      this._drag_dist = 0;
      this._last_axis = this.pointer_axis_px(e);
    },
    on_pointer_move: (e: IPointingEvent): void => {
      if (!this._armed) return;
      const px = this.pointer_axis_px(e);
      const d = px - this._last_axis;
      this._last_axis = px;
      if (!this._dragging) {
        this._drag_dist += Math.abs(d);
        if (this._drag_dist < this.drag_threshold) return;
        this._dragging = true;
        this.callbacks.call('on_scroll_start', this);
      }
      // 内容跟随指针移动
      this._target_offset = clamp(this._target_offset - d, 0, this.max_scroll);
      this._offset = this._target_offset;
      this.apply_offset();
    },
    on_pointer_up: (): void => this.end_drag(),
    on_pointer_cancel: (): void => this.end_drag(),
    on_wheel: (e: IPointingEvent): void => {
      if (!this.wheel_enabled) return;
      if (!this.node.visible || this.node.disabled) return;
      if (this._armed || this._dragging) return;
      if (this.max_scroll <= 0) return;
      // 只有光标位于视口内时才滚动
      if (!this.pointer_in_view(e)) return;
      // 主方向增量优先，其次使用另一轴：
      // 例如横向列表可用普通鼠标的“垂直滚轮”滚动（Shift/触控板横滑时系统会把增量放到 deltaX/deltaY 其中之一）
      const dx = e.delta_x ?? 0;
      const dy = e.delta_y ?? 0;
      const d = this.is_col ? (dy || dx) : (dx || dy);
      if (!d) return;
      this.scroll_by(d * this.wheel_speed);
    },
  };
  protected end_drag(): void {
    if (this._dragging) this.callbacks.call('on_scroll_end', this);
    this._armed = false;
    this._dragging = false;
  }

  protected sync_scrollbar(): void {
    const sb = this.props.scrollbar;
    if (!sb) return;
    if (sb.min_value !== 0) sb.min_value = 0;
    if (sb.max_value !== 100) sb.max_value = 100;
    if (this._last_slider_factor == null) {
      this._last_slider_factor = sb.factor;
    } else if (sb.factor !== this._last_slider_factor) {
      this._last_slider_factor = sb.factor;
      this.factor = sb.factor;
    }
    const want = this.factor;
    if (Math.abs(sb.factor - want) > 1e-4) sb.factor = want;
    this._last_slider_factor = sb.factor;
  }
}
