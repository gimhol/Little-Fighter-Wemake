import { Callbacks } from "../base";
import { LFW } from "../LFW";
import { is_str } from '../utils/type_check/is_str';
import { UINode } from "./UINode";

export interface IUILayersCallback {
  on_set?(pushed: UINode | undefined, popped: UINode | undefined, layer: UILayer): void;
  on_push?(pushed: UINode | undefined, prev: UINode | undefined, layer: UILayer): void;
  on_pop?(curr: UINode | undefined, poppeds: UINode[], layer: UILayer): void;
}
export interface IUITransition {
  run?(
    prev: UINode | undefined,
    curr: UINode | undefined,
    end: () => void,
  ): void;
}
export interface IPopUIOpts {
  /**
   * 是否包含用于判定的节点
   *
   * @default false
   * @type {?boolean} 
   */
  inclusive?: boolean;


  /**
   * 直到该判定返回 true 时停止出栈
   *
   * @param {UINode} ui 
   * @param {number} index 
   * @param {UINode[]} stack 
   * @returns {boolean} 
   */
  until?(ui: UINode, index: number, stack: UINode[]): boolean

  transition?: string;
}
export interface IPushUIOpts {
  id?: string;
  transition?: string;
}
export class UILayer {
  readonly lfw: LFW;
  /** 本层的页面栈（末尾为当前页面） */
  readonly pages: UINode[] = [];
  readonly callback = new Callbacks<IUILayersCallback>;
  protected _index: number

  get ui(): UINode | undefined {
    return this.pages[this.pages.length - 1];
  }

  /** 所在层级（同时作为 z 偏移） */
  get index(): number { return this._index }

  constructor(lfw: LFW, index: number) {
    this.lfw = lfw;
    this._index = index;
  }

  dispose(): void {
    this.pages.forEach(ui => {
      ui.on_pause();
      ui.on_stop();
    });
  }

  set(opts: IPushUIOpts = {}): void {
    const { id } = opts
    if (is_str(id) && this.ui?.id === id) return;
    const prev = this.pages.pop();
    prev?.on_pause();
    prev?.on_stop();
    const info = this.lfw.uis.all?.find((v) => v.id === id)
    const curr = info && UINode.create(this.lfw, info, void 0, this);
    if (curr) {
      curr.z = curr.z + this._index
      this.pages.push(curr);
      curr.on_start();
      curr.on_resume();
    }
    if (curr || prev) this.callback.call('on_set', curr, prev, this)
  }

  push(opts: IPushUIOpts = {}): void {
    const { id } = opts
    const prev = this.ui;
    prev?.on_pause();
    const info = this.lfw.uis.all?.find((v) => v.id === id)
    const curr = info && UINode.create(this.lfw, info, void 0, this);
    if (curr) {
      curr.z = curr.z + this._index
      this.pages.push(curr);
      curr.on_start();
      curr.on_resume();
    }
    this.callback.call('on_push', curr, prev, this)
  }

  pop(opts: IPopUIOpts = {}): void {
    const { inclusive, until } = opts;
    const poppeds: UINode[] = []
    const len = this.pages.length
    for (let i = len - 1; i >= 0; --i) {
      const ui = this.pages[i]
      if (!until) {
        poppeds.push(ui);
        break;
      }
      if (until(ui, i, this.pages)) {
        if (inclusive) poppeds.push(ui)
        break;
      }
      poppeds.push(ui)
    }
    for (let i = 0; i < poppeds.length; i++) {
      const popped = poppeds[i];
      if (i === 0) popped?.on_pause();
      popped?.on_stop();
    }
    this.pages.splice(len - poppeds.length, poppeds.length)
    this.ui?.on_resume();
    this.callback.call('on_pop', this.ui, poppeds, this)
  }
}
export class UILayers {
  readonly lfw: LFW;
  protected _all: UILayer[] = [];
  constructor(lfw: LFW) {
    this.lfw = lfw;
  }
  get bottom(): UILayer | undefined {
    return this._all[0]
  }
  get top(): UILayer | undefined {
    return this._all[this._all.length - 1]
  }
  get all(): Readonly<UILayer[]> {
    return Array.from(this._all)
  }
  get ui(): UINode | undefined {
    return this._all[this._all.length - 1]?.ui;
  }
  get length(): number {
    return this._all.length
  }
  push(): UILayer {
    const ret = new UILayer(this.lfw, 0)
    this._all.push(ret)
    return ret;
  }
  ensure(index: number): UILayer {
    let ret = this._all[index]
    if (!ret) ret = this._all[index] = new UILayer(this.lfw, index)
    return ret
  }
  at(index: number): UILayer | undefined {
    return this._all[index]
  }

  set_ui(opts: IPushUIOpts, index: number = 0): void {
    this.ensure(index).set(opts)
  }
  pop_ui(opts?: IPopUIOpts, index: number = 0): void {
    this.at(index)?.pop(opts)
  }
  pop_ui_safe(): void {
    const layer = this.top;
    if (!layer) return;
    if (layer.pages.length > 1)
      layer.pop()
    if (!layer.ui && layer.index)
      this._all.length = this._all.length - 1;
  }
  push_ui(opts: IPushUIOpts, index: number = 0): void {
    this.ensure(index).push(opts)
  }
  dispose() {
    for (const i of this._all)
      i.dispose();
    this._all.length = 0;
  }
}