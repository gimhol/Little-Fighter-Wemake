import { Callbacks } from "../base";
import { Ditto } from "../ditto";
import { LFW } from "../LFW";
import { is_str } from '../utils/type_check/is_str';
import { UINode } from "./UINode";

export interface IUIStacksCallback {
  on_set?(pushed: UINode | undefined, popped: UINode | undefined, stack: UIStack): void;
  on_push?(pushed: UINode | undefined, prev: UINode | undefined, stack: UIStack): void;
  on_pop?(curr: UINode | undefined, poppeds: UINode[], stack: UIStack): void;
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
   * @type {?boolean}
   */
  inclusive?: boolean;


  /**
   * 判断节点是否应该抛出
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
export class UIStack {
  readonly lfw: LFW;
  readonly uis: UINode[] = [];
  readonly callback = new Callbacks<IUIStacksCallback>;
  protected _index: number

  get ui(): UINode | undefined {
    return this.uis[this.uis.length - 1];
  }
  constructor(lfw: LFW, index: number) {
    this.lfw = lfw;
    this._index = index;
  }
  dispose(): void {
    this.uis.forEach(ui => {
      ui.on_pause();
      ui.on_stop();
    });
  }

  set(opts: IPushUIOpts = {}): void {
    const { id } = opts
    if (is_str(id) && this.ui?.id === id) return;
    const prev = this.uis.pop();
    prev?.on_pause();
    prev?.on_stop();
    const info = this.lfw.uis.all?.find((v) => v.id === id)
    const curr = info && UINode.create(this.lfw, info);
    if (curr) {
      const { x, y, z } = curr.pos
      curr.z = curr.z + this._index
      this.uis.push(curr);
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
    const curr = info && UINode.create(this.lfw, info);
    if (curr) {
      curr.z = curr.z + this._index
      this.uis.push(curr);
      curr.on_start();
      curr.on_resume();
    }
    this.callback.call('on_push', curr, prev, this)
  }

  pop(opts: IPopUIOpts = {}): void {
    const { inclusive, until } = opts;
    const poppeds: UINode[] = []
    const len = this.uis.length
    for (let i = len - 1; i >= 0; --i) {
      const ui = this.uis[i]
      if (!until) {
        poppeds.push(ui);
        break;
      }
      if (until(ui, i, this.uis)) {
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
    this.uis.splice(len - poppeds.length, poppeds.length)
    this.ui?.on_resume();
    this.callback.call('on_pop', this.ui, poppeds, this)
  }
}
