import { LFW } from "../LFW";
import { Callbacks, type IDebugging, make_debugging } from "../base";
import type { IStyle, IVector3, IVector3Like } from "../defines";
import { Ditto as D, ImageInfo, type IUINodeRenderer, TextInfo } from "../ditto";
import { Times } from '../utils/Times';
import { round } from '../utils/math/base';
import { round_float } from '../utils/math/round_float';
import { is_num } from '../utils/type_check/is_num';
import type { ICookedUIInfo } from "./ICookedUIInfo";
import type { ICrossInfo, IGeoInfo, IRectInfo } from "./ICrossInfo";
import type { IUIInfo } from "./IUIInfo.dat";
import type { IUICallback } from "./IUICallback";
import type { IUIKeyEvent } from "./IUIKeyEvent";
import { LF2PointerEvent } from "./LF2PointerEvent";
import { Style } from "./Style";
import { actor } from './action/Actor';
import type { UIComponent } from './component/UIComponent';

export class UINode implements IDebugging {
  static readonly TAG: string = 'UINode';
  debug!: (_0: string, ..._1: any[]) => void;
  warn!: (_0: string, ..._1: any[]) => void;
  log!: (_0: string, ..._1: any[]) => void;
  readonly lfw: LFW;

  /**
   * 原始UI数据
   * 
   * 对UINode的一些属性进行修改，不会影响到原始UI数据。
   *
   * @type {Readonly<ICookedUIInfo>}
   * @memberof UINode
   */
  readonly data: Readonly<ICookedUIInfo>;
  /**
   * 原始UI数据（合并模板后）
   *
   * 用于判断节点在UI数据中是否显式声明了某些属性（如 size）。
   *
   * @type {Readonly<IUIInfo> | undefined}
   * @memberof UINode
   */
  readonly raw: Readonly<IUIInfo> | undefined;
  protected _outlineColor: string | undefined;
  protected _outlineWidth: number | undefined;
  protected _outlineAlpha: number | undefined;
  protected _callbacks = new Callbacks<IUICallback>();
  protected _pointer_over: 0 | 1 = 0;
  protected _pointer_down: 0 | 1 = 0;
  protected _click_flag: 0 | 1 = 0;
  protected _update_times = new Times(0, Number.MAX_SAFE_INTEGER);
  protected _components_updating: boolean = false;
  protected _del_components: UIComponent[] = [];

  get callbacks() {
    return this._callbacks;
  }
  /**
   * 根节点
   *
   * @protected
   * @type {UINode}
   */
  protected _root: UINode;
  protected _focused_node?: UINode;
  protected _components: UIComponent[] = [];
  protected _state: any = {};
  protected _visible = true;
  protected _disabled = false;
  protected _clip_children = false;
  protected _opacity = 1;

  readonly pos: IVector3 = new D.Vector3();
  readonly scale: IVector3 = new D.Vector3(1, 1, 1)
  readonly size: IVector3 = new D.Vector3();
  readonly center: IVector3 = new D.Vector3()

  protected _text: TextInfo | null = null;
  /** 上次自动适配尺寸时的文本+样式签名，用于跳过内容未变化的重复测量 */
  protected _auto_size_key?: string;

  get text(): TextInfo | null { return this._text; }
  set text(v: TextInfo | null) {
    this._text = v;
    this.auto_size_by_text(v);
  }
  image: ImageInfo | null = null
  color: string = '';
  readonly style: Style = new Style();

  protected _parent?: UINode;
  protected _children: UINode[] = [];
  protected _prev_size: IVector3 = new D.Vector3();
  protected _prev_center: IVector3 = new D.Vector3();
  protected _prev_pos: IVector3 = new D.Vector3();
  protected _cache_cross: ICrossInfo | undefined;
  protected _cache_rect: IRectInfo | undefined;
  protected _cache_geo: IGeoInfo | undefined;
  protected _cache_global_pos: IVector3Like | undefined;
  protected _background: string | null = null;
  protected _backgroundAlpha: number | null = null;
  protected _foreground: string | null = null;
  protected _foregroundAlpha: number | null = null;

  get cross(): Readonly<ICrossInfo> {
    if (this._cache_cross) return this._cache_cross;
    const { x: w, y: h } = this.size
    const { x: a, y: b } = this.center
    const left = -a * w
    const top = -b * h
    const right = (1 - a) * w
    const bottom = (1 - b) * h
    return this._cache_cross = {
      left,
      top,
      right,
      bottom,
      mid_x: (left + right) / 2,
      mid_y: (top + bottom) / 2
    }
  }

  get rect(): Readonly<IRectInfo> {
    if (this._cache_rect) return this._cache_rect;
    const c = this.cross
    const { x, y } = this.pos
    return this._cache_rect = {
      left: x + c.left,
      top: y + c.top,
      right: x + c.right,
      bottom: y + c.bottom
    }
  }
  get geo(): Readonly<IGeoInfo> {
    if (this._cache_geo) return this._cache_geo;
    const c = this.cross
    const { x, y } = this.global_pos
    return this._cache_geo = {
      pos: { x, y },
      left: x + c.left,
      top: y + c.top,
      right: x + c.right,
      bottom: y + c.bottom
    }
  }
  get focused(): boolean {
    return this._root._focused_node === this;
  }
  set focused(v: boolean) {
    if (v === (this.focused_node === this)) return;
    if (v) this.focused_node = this;
    else if (this.focused_node === this) this.focused_node = void 0;
  }
  get focused_node(): UINode | undefined {
    return this._root._focused_node;
  }
  set focused_node(val: UINode | undefined) {
    const old = this._root._focused_node;
    if (old === val) return;
    if (val?.disabled || !val?.visible) val = void 0;
    this._root._focused_node = val;
    if (old) {
      old.on_blur();
      old._callbacks.call("on_foucs_changed", old);
    }
    if (val) {
      val.on_foucs();
      val._callbacks.call("on_foucs_changed", val);
    }
    this._root._callbacks.call("on_foucs_item_changed", val, old);
  }

  get id(): string | undefined { return this.data.id }
  get name(): string | undefined { return this.data.name }
  get root(): UINode { return this._root; }

  get depth(): number {
    return this.parent ? this.parent.depth + 1 : 0;
  }

  get state() {
    return this._state;
  }

  get self_visible() {
    return this._visible
  }
  /**
   * 是否裁剪子节点（overflow:hidden）
   *
   * 开启后，本节点矩形之外的子节点不再绘制、也不再响应指针。
   */
  get clip_children(): boolean {
    return this._clip_children;
  }
  set clip_children(v: boolean) {
    this._clip_children = v;
  }
  /**
   * 当前节点是否可见
   * 
   * @description 
   *    要注意，当任意一个祖先节点visible为false时，
   *    即使设置当前节点为visible为true，visible属性仍将返回false
   *
   * @type {boolean}
   */
  get visible(): boolean {
    if (!this.parent) return this.self_visible
    return this.parent.visible && this.self_visible;
  }

  set visible(v: boolean) {
    this.set_visible(v);
  }
  get background(): string { return this._background ?? this.data.background ?? '#000000' }
  set background(v: string | null) { this._background = v; }
  get foreground(): string { return this._foreground ?? this.data.foreground ?? '#000000' }
  set foreground(v: string | null) { this._foreground = v; }
  get backgroundAlpha(): number { return this._backgroundAlpha ?? this.data.backgroundAlpha ?? 0 }
  set backgroundAlpha(v: number | null) { this._backgroundAlpha = v; }
  get foregroundAlpha(): number { return this._foregroundAlpha ?? this.data.foregroundAlpha ?? 0 }
  set foregroundAlpha(v: number | null) { this._foregroundAlpha = v; }
  get outlineColor(): string | undefined { return this._outlineColor }
  get outlineWidth(): number | undefined { return this._outlineWidth }
  get outlineAlpha(): number | undefined { return this._outlineAlpha }
  set outlineColor(v: string | undefined) { this._outlineColor = v };
  set outlineWidth(v: number | undefined) { this._outlineWidth = v };
  set outlineAlpha(v: number | undefined) { this._outlineAlpha = v };

  get disabled(): boolean {
    if (!this.parent) return this._disabled;
    return this.parent.disabled || this._disabled;
  }
  set disabled(v: boolean) {
    this.set_disabled(v);
  }
  get self_disabled() { return this._disabled }
  get global_opacity(): number {
    if (!this.parent) return this._opacity
    return this._opacity * this.parent._opacity;
  }
  get opacity(): number { return this._opacity; }
  set opacity(v: number) { this.set_opacity(v); }
  get parent(): UINode | undefined { return this._parent; }
  get children(): Readonly<UINode[]> { return this._children; }
  get w(): number { return this.size.x; }
  get h(): number { return this.size.y; }
  set w(v: number) { this.set_w(v); }
  set h(v: number) { this.set_h(v); }
  get x(): number { return this.pos.x; }
  get y(): number { return this.pos.y; }
  get z(): number { return this.pos.z; }
  set x(v: number) { this.set_x(v) }
  set y(v: number) { this.set_y(v) }
  set z(v: number) { this.set_z(v) }
  get cx(): number { return this.center.x; }
  get cy(): number { return this.center.y; }
  get cz(): number { return this.center.z; }
  set cx(v: number) { this.set_cx(v); }
  set cy(v: number) { this.set_cy(v); }
  set cz(v: number) { this.set_cz(v); }
  get sx(): number { return this.scale.x; }
  get sy(): number { return this.scale.y; }
  get sz(): number { return this.scale.z; }
  set sx(v: number) { this.set_sx(v); }
  set sy(v: number) { this.set_sy(v); }
  set sz(v: number) { this.set_sz(v); }
  get global_pos(): Readonly<IVector3Like> {
    if (this._cache_global_pos) return this._cache_global_pos;
    let { x, y, z } = this.pos
    if (this.parent) {
      const g = this.parent.global_pos
      x += g.x;
      y += g.y;
      z += g.z;
    }
    return this._cache_global_pos = { x, y, z };
  }
  set global_pos(v: Readonly<IVector3Like>) {
    if (!this.parent) { this.move_to(v.x, v.y, v.z); return; }
    const { x, y, z } = this.parent.global_pos
    this.move_to(v.x - x, v.y - y, v.z - z);
  }
  get components(): ReadonlyArray<UIComponent> {
    return this._components;
  }

  /** 光标是否在本节点上 */
  get pointer_over() { return this._pointer_over }
  /** 光标是否在本节点中按下 */
  get pointer_down() { return this._pointer_down }
  get click_flag() { return this._click_flag }
  get lifetime() { return this._update_times.value }
  set_visible(v: boolean): this {
    const prev = this.visible;
    this._visible = v;
    if (prev !== this.visible) this.invoke_all_visible()
    if (!v && !this.focused_node?.visible) this.focused_node = void 0
    return this;
  }
  set_disabled(v: boolean): this {
    this._disabled = v;
    if (v && this.focused_node?.disabled) this.focused_node = void 0
    return this;
  }
  set_opacity(v: number): this { this._opacity = v; return this; }
  set_w(v: number): this { return this.resize(v, this.h); }
  set_h(v: number): this { return this.resize(this.w, v); }
  resize(
    x: number = this.size.x,
    y: number = this.size.y,
    z: number = this.size.z
  ): this {
    this.size.x = round_float(x);
    this.size.y = round_float(y);
    this.size.z = round_float(z);
    this._cache_cross = void 0;
    this._cache_rect = void 0;
    this._cache_geo = void 0;
    this._cache_global_pos = void 0;
    return this;
  }
  set_x(v: number): this { return this.move_to(v); }
  set_y(v: number): this { return this.move_to(void 0, v); }
  set_z(v: number): this { return this.move_to(void 0, void 0, v); }
  move_to(
    x: number = this.pos.x,
    y: number = this.pos.y,
    z: number = this.pos.z
  ): this {
    this.pos.x = round_float(x);
    this.pos.y = round_float(y);
    this.pos.z = round_float(z);
    this._cache_cross = void 0;
    this._cache_rect = void 0;
    this._cache_geo = void 0;
    this._cache_global_pos = void 0;
    return this;
  }

  set_cx(v: number): this { return this.set_center(v); }
  set_cy(v: number): this { return this.set_center(void 0, v); }
  set_cz(v: number): this { return this.set_center(void 0, void 0, v); }
  set_center(
    x: number = this.center.x,
    y: number = this.center.y,
    z: number = this.center.z
  ): this {
    this.center.x = round_float(x);
    this.center.y = round_float(y);
    this.center.z = round_float(z);
    this._cache_cross = void 0;
    this._cache_rect = void 0;
    this._cache_geo = void 0;
    this._cache_global_pos = void 0;
    return this;
  }

  set_sx(v: number): this { return this.set_scale(v); }
  set_sy(v: number): this { return this.set_scale(void 0, v); }
  set_sz(v: number): this { return this.set_scale(void 0, void 0, v); }
  set_scale(
    x: number = this.scale.x,
    y: number = this.scale.y,
    z: number = this.scale.z
  ): this {
    this.scale.x = round_float(x);
    this.scale.y = round_float(y);
    this.scale.z = round_float(z);
    return this;
  }


  renderer: IUINodeRenderer;

  constructor(lfw: LFW, data: ICookedUIInfo, parent?: UINode) {
    this.lfw = lfw;
    this.data = Object.freeze(data);
    this.raw = data.raw;
    this._parent = parent;
    this._root = parent?.root ?? this;
    this._disabled = this.data.disabled == true
    this._visible = this.data.visible != false
    this._clip_children = this.data.clips == true
    this._opacity = this.data.opacity ?? 1
    this.center.set(...this.data.center);
    this.pos.set(...this.data.pos);
    this.size.set(...this.data.size);
    this.scale.set(...this.data.scale);
    this.text = this.data.txt_info ?? null;
    this.image = this.data.img_info ?? null;
    this.color = this.data.color ?? '';
    this.renderer = new D.UINodeRenderer(this);
    this._outlineColor = this.data.outlineColor
    this._outlineWidth = this.data.outlineWidth
    this._outlineAlpha = this.data.outlineAlpha
    if (this.data.style) this.style.assign(this.data.style)
    make_debugging(this)
  }

  /**
   * 设置文本
   *
   * 若原始UI数据未显式设置 size，将按文本内容动态调整节点尺寸。
   *
   * @param {string} text 文本内容
   * @param {(IStyle | null)} [style] 文本样式，缺省使用节点样式
   * @return {this}
   * @memberof UINode
   */
  set_text(text: string, style?: IStyle | null): this {
    this.text = new TextInfo({ text, style: style ?? this.style });
    return this;
  }

  /**
   * 当原始UI数据未显式设置 size 时，根据文本内容动态调整节点尺寸
   *
   * @protected
   * @param {(TextInfo | null)} v
   * @memberof UINode
   */
  protected auto_size_by_text(v: TextInfo | null) {
    if (!v || this.raw?.size || !this.parent) { this._auto_size_key = void 0; return; }
    const key = this._text_size_key(v);
    if (this._auto_size_key === key) return;
    this._auto_size_key = key;
    const ti = (v.w && v.h)
      ? v
      : this.lfw.images.measure_text(this.lfw.string(v.text), v.style);
    this.resize((ti.w || 0) / (ti.scale || 1), (ti.h || 0) / (ti.scale || 1));
  }

  /**
   * 生成“文本+样式”签名，用于跳过内容未变化的重复测量
   *
   * @protected
   * @param {TextInfo} v
   * @return {string}
   * @memberof UINode
   */
  protected _text_size_key(v: TextInfo): string {
    const s = v.style;
    const text = this.lfw.string(v.text);
    return s instanceof Style
      ? `${text}\u0000v${s.version}`
      : `${text}\u0000${JSON.stringify(s ?? {})}`;
  }

  move_to_global(x: number, y: number, z: number): this {
    if (!this.parent) { this.move_to(x, y, z); return this; }
    const g = this.parent.global_pos
    this.move_to(x - g.x, y - g.y, z - g.z);
    return this;
  }
  hit(x: number, y: number): boolean {
    const { x: cx, y: cy } = this.center;
    const { x: px, y: py } = this.pos;
    const { x: dw, y: dh } = this.size;
    const l = px - round(cx * dw);
    const t = py - round(cy * dh);
    const [w, h] = this.data.size;
    return l <= x && t <= y && l + w >= x && t + h >= y;
  }
  on_pointer_down(e: LF2PointerEvent) {
    this._pointer_down = 1;
    this._click_flag = 1;
    for (const c of this.components)
      c.on_pointer_down?.(e);
    this.callbacks.call('on_pointer_down', e, this);
  }
  on_pointer_move(e: LF2PointerEvent) {
    for (const c of this.components)
      c.on_pointer_move?.(e);
    this.callbacks.call('on_pointer_move', e, this);
  }

  on_pointer_up(e: LF2PointerEvent) {
    this._pointer_down = 0
    for (const c of this.components)
      c.on_pointer_up?.(e);
    this.callbacks.call('on_pointer_up', e, this);
  }

  on_pointer_cancel(e: LF2PointerEvent) {
    this._pointer_down = 0
    for (const c of this.components)
      c.on_pointer_cancel?.(e);
    this.callbacks.call('on_pointer_cancel', e, this);
  }

  on_pointer_leave() {
    this._pointer_over = 0;
    this._click_flag = 0;
    for (const c of this.components)
      c.on_pointer_leave?.();
    this.callbacks.call('on_pointer_leave', this);
  }

  on_pointer_enter() {
    this._pointer_over = 1
    for (const c of this.components)
      c.on_pointer_enter?.();
    this.callbacks.call('on_pointer_enter', this);
  }

  on_start() {
    this._update_times.reset();
    this._state = {};
    for (const c of this._components) {
      c.stopped = false;
      c.on_start?.();
    }
    for (const i of this.children) i.on_start();
    const { start } = this.data.actions || {};
    if (start) actor.act(this, start);
    this.renderer.on_start?.();
  }

  on_stop(): void {
    for (const c of this.components) {
      c.stopped = true;
      c.on_stop?.();
    }
    for (const l of this.children) l.on_stop();
    const { stop } = this.data.actions || {};
    if (stop) actor.act(this, stop);
    this.renderer.on_stop?.();
  }

  on_resume() {
    if (!this.parent) {
      this.focused_node = this._state.focused_node;
      if (this._visible) this.invoke_all_visible();
    }
    for (const c of this._components) {
      c.paused = false;
      c.mounted = true;
      c.on_resume?.();
    }
    for (const i of this.children) i.on_resume();
    const { resume } = this.data.actions || {};
    if (resume) actor.act(this, resume);
    this.renderer.on_resume?.();
  }

  on_pause() {
    if (!this.parent) {
      this._state.focused_node = this.focused_node;
      this.focused_node = void 0;
      this.invoke_all_on_hide();
    }
    if (this.root === this) this.renderer.del_self();
    const { pause } = this.data.actions || {};
    if (pause) actor.act(this, pause);
    for (const c of this._components) {
      c.paused = true;
      c.mounted = false;
      c.on_pause?.();
      c.recycle_keys();
    }
    for (const item of this.children) item.on_pause();
    this.renderer.on_pause?.();
  }

  on_show() {
    for (const c of this.components) c.on_show?.();
    this._callbacks.call("on_show", this);
    if (this.data.auto_focus && !this.disabled && !this.focused_node) {
      this.focused_node = this;
    }
    this.renderer.on_show?.();
  }

  on_hide() {
    if (this.focused_node === this) this.focused_node = void 0;
    for (const c of this.components) c.on_hide?.();
    this._callbacks.call("on_hide", this);
    this.renderer.on_hide?.();
  }

  static create(lfw: LFW, info: ICookedUIInfo, parent?: UINode): UINode {
    const ret = new UINode(lfw, info, parent);
    const { component } = ret.data;
    if (component)
      for (const c of lfw.factory.create_components(ret, component))
        ret._components.push(c);

    if (info.items) {
      for (const item_info of info.items) {
        let count = (is_num(item_info.count) && item_info.count > 0) ? item_info.count : 1
        while (count) {
          const child = UINode.create(lfw, item_info, ret);
          ret.add_child(child)
          --count;
        }
      }
    }
    for (const component of ret._components)
      component.on_add?.();
    return ret;
  }

  add_child(node: UINode): this {
    this._children.push(node);
    return this;
  }

  add_children(...node: UINode[]): this {
    node.forEach(l => this.add_child(l))
    return this;
  }
  add_components(...components: UIComponent[]) {
    for (const component of components) {
      if (this._components.some(c => c == component))
        continue;
      this._components.push(component)
      component.on_add?.()
      this._callbacks.call('on_component_add', component, this)
    }
  }
  del_components(...components: UIComponent[]) {
    if (this._components_updating) {
      this._del_components.push(...components)
      return;
    }
    for (const component of components) {
      const idx = this._components.indexOf(component)
      if (idx < 0) continue;
      this._components.splice(idx, 1)
      component.on_del?.()
      this._callbacks.call('on_component_del', component, this)
    }
  }

  on_click(e: LF2PointerEvent) {
    const { click, rclick, mclick } = this.data.actions ?? {};
    if (click && e.button == 0) {
      actor.act(this, click);
      e.stop_propagation();
    }
    if (mclick && e.button == 1) {
      actor.act(this, mclick);
      e.stop_propagation();
    }
    if (rclick && e.button == 2) {
      actor.act(this, rclick);
      e.stop_propagation();
    }
    for (const c of this._components) {
      c.on_click?.(e);
      if (e.stopped === 2) break;
    }
    this.callbacks.call('on_click', e);
  }

  /** 
   * 当前节点从"不可见"变为"可见"时被调用 
   */
  protected invoke_all_on_show() {
    this.on_show();
    for (const child of this.children) {
      if (child._visible) child.invoke_all_on_show();
    }
  }

  /** 
   * 当前节点从"可见"变为"不可见"时被调用 
   */
  protected invoke_all_on_hide() {
    this.on_hide();
    for (const child of this.children) {
      if (child._visible) child.invoke_all_on_hide();
    }
  }

  protected invoke_all_visible() {
    if (this._visible) {
      this.invoke_all_on_show();
    } else {
      this.invoke_all_on_hide();
    }
  }

  update(dt: number) {
    if (
      this._prev_size.x !== this.size.x ||
      this._prev_size.y !== this.size.y ||
      this._prev_center.x !== this.center.x ||
      this._prev_center.y !== this.center.y ||
      this._prev_pos.x !== this.pos.x ||
      this._prev_pos.y !== this.pos.y ||
      this._prev_pos.z !== this.pos.z
    ) {
      this._cache_cross = void 0;
      this._cache_rect = void 0;
      this._cache_geo = void 0;
      this._cache_global_pos = void 0;

      this._prev_size.x = this.size.x
      this._prev_size.y = this.size.y
      this._prev_center.x = this.center.x
      this._prev_center.y = this.center.y
      this._prev_pos.x = this.pos.x
      this._prev_pos.y = this.pos.y
      this._prev_pos.z = this.pos.z
    }


    this._update_times.add();
    this._components_updating = true;
    for (const c of this._components) if (c.enabled) c.update?.(dt);
    this._components_updating = false;
    if (this._del_components.length) {
      this.del_components(...this._del_components);
      this._del_components.length = 0;
    }

    for (const i of this.children) if (!i.disabled) i.update(dt);
  }

  on_key_down(e: IUIKeyEvent) {
    if (e.stopped) return;
    for (const c of this._components) {
      c.on_key_down?.(e);
      if (e.stopped === 2) return;
    }
    for (const i of this.children) {
      i.on_key_down(e);
      if (e.stopped === 2) return;
    }
    const { click, rclick, mclick } = this.data.actions ?? {};
    if (this.focused && "a" === e.game_key && click) {
      actor.act(this, click);
      e.stop_immediate_propagation();
    }
    if (this.focused && "j" === e.game_key && rclick) {
      actor.act(this, rclick);
      e.stop_immediate_propagation();
    }
    if (this.focused && "d" === e.game_key && mclick) {
      actor.act(this, mclick);
      e.stop_immediate_propagation();
    }
  }

  on_key_up(e: IUIKeyEvent) {
    if (e.stopped) return;
    for (const i of this.children) {
      i.on_key_up(e);
      if (e.stopped === 2) return;
    }
    for (const c of this._components) {
      c.on_key_up?.(e);
      if (e.stopped === 2) return;
    }
  }

  /**
   * 根据子节点ID查找子节点
   *
   * @see {IUIInfo.id}
   * @param {string} id 子节点ID
   * @return {(UINode | undefined)} 
   * @memberof UINode
   */
  find_child(id: string): UINode | undefined {
    return this.children.find(v => v.id == id)
  }
  search_node(id: string): UINode | undefined {
    let ret = this.find_child(id);
    if (ret) return ret;
    for (const c of this.children) {
      ret = c.search_node(id)
      if (ret) return ret;
    }
  }
  lookup_node(id: string): UINode | undefined {
    return this.find_child(id) ?? this.parent?.lookup_node(id)
  }

  /**
   * 根据子节点名查找子节点
   *
   * @see {IUIInfo.name}
   * @param {string} name 子节点名
   * @return {(UINode | undefined)} 
   * @memberof UINode
   */
  find_child_by_name(name: string): UINode | undefined {
    return this.children.find(v => v.name == name)
  }

  find_parent<T>(
    id: string | ((node: UINode) => any),
    handler?: (parent: UINode, path: UINode[]) => T
  ): UINode | undefined {
    let { parent } = this;
    const path: UINode[] = []
    while (parent) {
      path.push(parent);
      if (
        (typeof id === 'string' && parent.id === id) ||
        (typeof id === 'function' && id(parent))
      ) {
        if (handler) handler(parent, path);
        return parent;
      }
      parent = parent.parent;
    }
    return void 0;
  }

  get_value(name: string, lookup: boolean = true): any {
    const { values } = this.data;
    if (values && name in values) return values[name];
    if (lookup && this.parent) return this.parent.get_value(name, lookup);
    return void 0;
  }

  traversal_components(fn: (c: UIComponent, depth: number) => any, depth = 0): boolean {
    for (const c of this.components) if (fn(c, depth)) return true;
    for (const c of this.children) if (c.traversal_components(fn, ++depth)) return true;
    return false;
  }

  /**
   * 查找当前layout符合条件的的component
   *
   * @template T
   * @param {T} type
   * @param {(TCond<T> | string)} [condition=() => true]
   * @return {(InstanceType<T> | undefined)}
   * @memberof UINode
   */
  find_component<T extends TCls<UIComponent>>(
    type: T,
    condition: TCond<T> | string | undefined | null = void 0
  ): InstanceType<T> | undefined {
    for (const v of this._components) {
      if (!(v instanceof type))
        continue;
      if (!condition)
        return v as InstanceType<T>;
      if (condition === v.id)
        return v as InstanceType<T>;
      if (typeof condition === 'function' && condition(v as any))
        return v as InstanceType<T>;
    }
    return void 0;
  }

  /**
   * 查找当前layout符合条件的的component数组
   *
   * @template T
   * @param {T} type
   * @param {(TCond<T> | string)} [condition=() => true]
   * @return {InstanceType<T>[]}
   * @memberof UINode
   */
  find_components<T extends TCls<UIComponent>>(
    type: T,
    condition: TCond<T> | string = () => true
  ): InstanceType<T>[] {
    const ret: any[] = []
    for (const v of this.components) {
      if (!(v instanceof type)) continue;
      if (condition === v.id) {
        ret.push(v as InstanceType<T>)
        continue;
      }
      if (typeof condition !== 'function')
        continue;
      const r = condition(v as any)
      if (r == 'abort') break;
      if (r) ret.push(v)
      if (r == 'end') break;
    }
    return ret;
  }

  /**
   * 查找当前layout以及子layout符合条件的component
   *
   * @template T 
   * @param {T} type
   * @param {(TCond<T> | string)} [condition=() => true]
   * @return {(InstanceType<T> | undefined)}
   * @memberof UINode
   */
  search_component<T extends TCls<UIComponent>>(
    type: T,
    condition: TCond<T> | string = () => true
  ): InstanceType<T> | undefined {
    const ret = this.find_component(type, condition);
    if (ret) return ret;
    for (const i of this._children) {
      const ret = i.search_component(type, condition);
      if (ret) return ret;
    }
  }

  /**
   * 查找当前layout以及子layout符合条件的component数组
   *
   * @template T
   * @param {T} type
   * @param {(TCond<T> | string)} [condition=() => true]
   * @return {InstanceType<T>[]}
   * @memberof UINode
   */
  search_components<T extends TCls<UIComponent>>(
    type: T, condition: TCond<T> | string = () => true
  ): InstanceType<T>[] {
    const ret = this.find_components(type, condition);
    for (const i of this._children)
      ret.push(...i.search_components(type, condition));
    return ret;
  }

  /**
   * 向上查找组件，当前节点不存在对应组件
   *
   * @template T
   * @param {T} type
   * @param {TCond<T>} [condition=() => true]
   * @return {(InstanceType<T> | undefined)}
   * @memberof UINode
   */
  lookup_component<T extends TCls<UIComponent>>(
    type: T,
    condition: TCond<T> = () => true
  ): InstanceType<T> | undefined {
    const ret = this.find_component(type, condition);
    if (ret) return ret;
    return this.parent?.lookup_component(type, condition);
  }

  on_foucs(): void {
    for (const c of this._components) c.on_foucs?.();
    this.renderer.on_foucs?.()
  }
  on_blur(): void {
    for (const c of this._components) c.on_blur?.();
    this.renderer.on_blur?.()
  }
  blur(): void {
    this.focused = false;
  }
}
type TCls<R = any> = abstract new (...args: any) => R;
type TCond<T extends TCls,> = (c: InstanceType<T>) => true | false | 'abort' | 'end';

