import type { IUINodeRenderer } from "@/LFW/ditto/render/IUINodeRenderer";
import type { UINode } from "@/LFW/ui/UINode";

/**
 * 快照里的一条记录 = 渲染一个节点所需的全部信息。
 * 刻意做成扁平结构（父子用 id 引用，不用嵌套），方便序列化与将来跨语言传输。
 */
export interface IUISnapshotItem {
  id: string | undefined;
  name: string | undefined;
  parent: string | null;
  depth: number;
  index: number;
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  center_x: number;
  center_y: number;
  visible: boolean;
  opacity: number;
  color: string;
  clip_children: boolean;
  img: string | null;
  text: string | null;
}

/**
 * 不画任何东西的 UINodeRenderer：只走一遍节点树，把「如果要画，需要画什么」记进快照。
 *
 * 用途：
 * 1. 实证 UINode / UIComponent 这一层不依赖 three.js —— 能跑通就说明模型/渲染分开了；
 * 2. 快照格式就是将来 C++ 侧要往 JS 传的那份 UI 数据；
 * 3. 无头诊断：不进 three.js 也能看 UI 树长什么样。
 *
 * 已知不等价处（有意为之）：
 * - 不做 UV 动画、九宫格、裁剪矩形、DOM 文本框（这些是纯渲染细节）；
 * - `x`/`y`/`visible` 只是记账，不驱动位移插值（真实渲染器每帧 lerp）。
 */
export class HeadlessUINodeRenderer implements IUINodeRenderer {
  /** 最近一帧的快照；由「根节点」在 render 时重建 */
  static readonly snapshot: IUISnapshotItem[] = [];
  /** render 被调用的次数，用来确认它真的在跑 */
  static frames = 0;

  ui: UINode;
  protected _visible = true;
  protected _x = 0;
  protected _y = 0;
  protected _parent: HeadlessUINodeRenderer | null = null;

  constructor(ui: UINode) {
    this.ui = ui;
  }

  get parent(): IUINodeRenderer | null { return this._parent; }
  get x(): number { return this._x; }
  set x(v: number) { this._x = v; }
  get y(): number { return this._y; }
  set y(v: number) { this._y = v; }
  get visible(): boolean { return this._visible; }
  set visible(v: boolean) { this._visible = v; }

  add(child: IUINodeRenderer): void {
    const c = child as HeadlessUINodeRenderer;
    if (c._parent === this) return;
    c._parent = this;
  }
  del(child: IUINodeRenderer): void {
    const c = child as HeadlessUINodeRenderer;
    if (c._parent === this) c._parent = null;
  }
  del_self(): void {
    if (this._parent) this._parent.del(this);
  }

  // UINode 会在生命周期节点上调用这些钩子；无头模式下没有副作用
  on_resume(): void { }
  on_pause(): void { }
  on_show(): void { }
  on_hide(): void { }
  on_start(): void { this.ui.parent?.renderer.add(this); }
  on_stop(): void { this.del_self(); }
  on_foucs(): void { }
  on_blur(): void { }

  /** 自己的深度（根为 0），按需向上走 */
  protected get depth(): number {
    let d = 0;
    let p = this.ui.parent;
    while (p) { d++; p = p.parent; }
    return d;
  }

  protected record(index: number): IUISnapshotItem {
    const { ui } = this;
    return {
      id: ui.id,
      name: ui.name,
      parent: ui.parent?.id ?? null,
      depth: this.depth,
      index,
      x: ui.pos.x,
      y: ui.pos.y,
      z: ui.pos.z,
      w: ui.w,
      h: ui.h,
      center_x: ui.center.x,
      center_y: ui.center.y,
      visible: ui.visible,
      opacity: ui.global_opacity,
      color: ui.color,
      clip_children: ui.clip_children,
      img: ui.image_desc?.path ?? null,
      text: ui.text?.text ?? null,
    };
  }

  render(_dt: number, _df: number): void {
    // 根节点被 WorldRenderer 调用；由它负责重建快照、统计帧数
    if (this._parent === null) {
      HeadlessUINodeRenderer.snapshot.length = 0;
      HeadlessUINodeRenderer.frames++;
    }
    const children = this.ui.children;
    HeadlessUINodeRenderer.snapshot.push(this.record(children.length));
    // 与真实渲染器一致：递归走模型树的 children
    for (let i = 0; i < children.length; i++) {
      if (!children[i].renderer) continue;
      children[i].renderer.render(_dt, _df);
    }
  }
}

/** 取最近一帧的快照（副本） */
export function get_ui_snapshot(): IUISnapshotItem[] {
  return HeadlessUINodeRenderer.snapshot.slice();
}
