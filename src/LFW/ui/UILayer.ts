import { Callbacks } from "../base";
import { LFW } from "../LFW";
import { is_str } from '../utils/type_check/is_str';
import { UINode } from "./UINode";
import { UINodeBuilder } from "./UINodeBuilder";

export interface IUILayersCallback {
  on_set?(pushed: UINode | undefined, popped: UINode | undefined, layer: UILayer): void;
  on_push?(pushed: UINode | undefined, prev: UINode | undefined, layer: UILayer): void;
  on_pop?(curr: UINode | undefined, poppeds: UINode[], layer: UILayer): void;

  /**
   * 打开弹窗
   *
   * @param {UINode} opened 被打开的弹窗
   * @param {(UINode | undefined)} prev 打开前的层最上层节点
   * @param {UILayer} layer 所在层
   */
  on_modal_open?(opened: UINode, prev: UINode | undefined, layer: UILayer): void;

  /**
   * 关闭弹窗
   *
   * @param {(UINode | undefined)} curr 关闭后的层最上层节点
   * @param {UINode[]} closed 被关闭的弹窗（末尾为最上层）
   * @param {UILayer} layer 所在层
   */
  on_modal_close?(curr: UINode | undefined, closed: UINode[], layer: UILayer): void;
}
export interface IUITransition {
  run?(
    prev: UINode | undefined,
    curr: UINode | undefined,
    end: () => void,
  ): void;
}
export interface IPopPageOpts {
  /**
   * 是否包含用于判定的节点
   *
   * @default false
   * @type {?boolean} 
   */
  inclusive?: boolean;


  /**
   * 直到该判定返回 true 时停止弹页
   *
   * @param {UINode} ui 
   * @param {number} index 
   * @param {UINode[]} pages 
   * @returns {boolean} 
   */
  until?(ui: UINode, index: number, pages: UINode[]): boolean

  /**
   * 本层至少保留的页数（0 = 允许弹空；1 = 至少留一页，避免层变空）
   *
   * @default 0
   */
  min_pages?: number

  transition?: string;
}
export interface IPushPageOpts {
  id?: string;
  transition?: string;
}
export interface ICloseModalOpts {
  /**
   * 关闭到该 id 的弹窗（包含该弹窗）
   *
   * 缺省时只关闭最上层的一个弹窗。
   *
   * @type {?string}
   */
  id?: string;
}

export class UILayer {
  /**
   * 弹窗相对所属页面抬高的 z 差
   *
   * 取小于 1 的值，保证弹窗只盖住本层的当前页面，不会压到上一层。
   */
  static readonly MODAL_Z_STEP = 0.25;

  readonly lfw: LFW;
  /**
   * 本层的节点栈（末尾为当前节点）
   *
   * 页面用 `set`/`push` 压入；弹窗用 `open_modal` 压入，且始终连续位于栈顶，
   * 由 `_modals` 记录哪些是弹窗。因此 `at()`/`indexOf()` 对页面与弹窗都有效。
   */
  readonly pages: UINode[] = [];
  readonly callback = new Callbacks<IUILayersCallback>;
  protected _index: number
  /** 栈顶连续弹窗（末尾为最上层弹窗） */
  protected readonly _modals: UINode[] = [];

  /** 本层最上层节点（有弹窗时为最上层弹窗） */
  get ui(): UINode | undefined {
    return this.pages[this.pages.length - 1];
  }

  /** 本层当前页面（忽略盖在上面的弹窗） */
  get page(): UINode | undefined {
    return this.pages[this.pages.length - 1 - this._modals.length];
  }

  /** 最上层弹窗 */
  get modal(): UINode | undefined {
    return this._modals[this._modals.length - 1];
  }

  /** 本层弹窗（末尾为最上层弹窗） */
  get modals(): Readonly<UINode[]> {
    return this._modals;
  }

  /**
   * 需要更新/绘制的节点数：当前页面（若有）+ 其上所有弹窗
   *
   * 弹窗盖住页面，但页面仍在运行（动画、逻辑不停），两者都要更新与绘制。
   */
  get live_count(): number {
    return this._modals.length + (this.pages.length > this._modals.length ? 1 : 0);
  }

  /** 第 i 个需要更新/绘制的节点（0 = 当前页面，往后依次为弹窗） */
  live_at(i: number): UINode | undefined {
    const k = this.live_count - i;
    return k > 0 ? this.pages[this.pages.length - k] : undefined;
  }

  /** 所在层级（同时作为 z 偏移） */
  get index(): number { return this._index }

  constructor(lfw: LFW, index: number) {
    this.lfw = lfw;
    this._index = index;
  }

  at(idx: number): UINode | undefined {
    return this.pages[idx];
  }

  has_modal(id?: string): boolean {
    return id ? this._modals.some(m => m.id === id) : this._modals.length > 0;
  }

  dispose(): void {
    this.pages.forEach(ui => {
      ui.on_pause();
      ui.on_stop();
    });
    this.pages.length = 0;
    this._modals.length = 0;
  }

  /** 按 UI 数据创建节点；找不到对应 id 时返回 undefined */
  protected _create(id: string | undefined): UINode | undefined {
    const info = this.lfw.uis.all?.find((v) => v.id === id)
    if (!info) return;
    const ret = UINodeBuilder.create(this.lfw, info, void 0, this);
    ret.z = ret.z + this._index;
    return ret;
  }

  /** 切换到指定页面（本层弹窗随之关闭） */
  set(opts: IPushPageOpts = {}): void {
    const { id } = opts
    if (is_str(id) && this.page?.id === id) return;
    this.close_modals();
    const prev = this.pages.pop();
    prev?.on_pause();
    prev?.on_stop();
    const curr = this._create(id);
    if (curr) {
      this.pages.push(curr);
      curr.on_start();
      curr.on_resume();
    }
    if (curr || prev) this.callback.call('on_set', curr, prev, this)
  }

  reset(opts: IPushPageOpts = {}): void {
    this.close_modals();
    const prev = this.pages[this.pages.length - 1];
    const poppeds = this.pages.splice(0, this.pages.length);
    for (let i = poppeds.length - 1; i >= 0; i--) {
      const popped = poppeds[i];
      if (i === poppeds.length - 1) popped.on_pause();
      popped.on_stop();
    }
    const curr = this._create(opts.id);
    if (curr) {
      this.pages.push(curr);
      curr.on_start();
      curr.on_resume();
    }
    if (curr || prev) this.callback.call('on_set', curr, prev, this)
  }

  push(opts: IPushPageOpts = {}): void {
    const { id } = opts
    this.close_modals();
    const prev = this.ui;
    prev?.on_pause();
    const curr = this._create(id);
    if (curr) {
      this.pages.push(curr);
      curr.on_start();
      curr.on_resume();
    }
    this.callback.call('on_push', curr, prev, this)
  }

  /** 弹掉页面（本层弹窗随之关闭） */
  pop(opts: IPopPageOpts = {}): boolean {
    this.close_modals();
    const { inclusive, until, min_pages = 0 } = opts;
    const poppeds: UINode[] = []
    const len = this.pages.length
    const max_pop = len - Math.min(Math.max(min_pages, 0), len)
    for (let i = len - 1; i >= 0 && poppeds.length < max_pop; --i) {
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
    if (!poppeds.length) return false;

    this.pages.splice(len - poppeds.length, poppeds.length)
    for (let i = 0; i < poppeds.length; i++) {
      const popped = poppeds[i];
      if (i === 0) popped?.on_pause();
      popped?.on_stop();
    }
    this.ui?.on_resume();
    this.callback.call('on_pop', this.ui, poppeds, this)
    return true;
  }

  /**
   * 打开弹窗
   *
   * 弹窗 UI 与页面一样取自 UI 数据（`lfw.uis.all`），压在当前页面之上，
   * 页面本身不会被暂停（动画、逻辑照常运行），但键盘/指针事件只会先到弹窗。
   *
   * 弹窗跟随当前页面：`set`/`push`/`pop` 换页时自动关闭。
   *
   * @param {IPushPageOpts} [opts] 弹窗 id（UI 数据中的 id）
   * @returns 打开的弹窗；找不到对应 UI 数据时返回 undefined
   */
  open_modal(opts: IPushPageOpts = {}): UINode | undefined {
    const { id } = opts
    if (is_str(id) && this.modal?.id === id) return this.modal;
    const prev = this.ui;
    const curr = this._create(id);
    if (!curr) return;
    curr.z = curr.z + UILayer.MODAL_Z_STEP * (this._modals.length + 1);
    this.pages.push(curr);
    this._modals.push(curr);
    curr.on_start();
    curr.on_resume();
    this.callback.call('on_modal_open', curr, prev, this);
    return curr;
  }

  /**
   * 关闭弹窗
   *
   * 缺省关闭最上层的一个弹窗；传入 `id` 时自顶向下关闭，直到（含）该 id 的弹窗。
   *
   * @param {ICloseModalOpts} [opts]
   * @returns 是否真的关闭了弹窗
   */
  close_modal(opts: ICloseModalOpts = {}): boolean {
    const { id } = opts;
    if (!this._modals.length) return false;
    if (id && !this.has_modal(id)) return false;
    const closed: UINode[] = [];
    while (this._modals.length) {
      const modal = this._modals.pop()!;
      this.pages.pop();
      closed.push(modal);
      if (!id || modal.id === id) break;
    }
    for (let i = 0; i < closed.length; i++) {
      const modal = closed[i];
      if (i === 0) modal.on_pause();
      modal.on_stop();
    }
    this.callback.call('on_modal_close', this.ui, closed, this);
    return true;
  }

  /** 关闭本层全部弹窗 */
  close_modals(): void {
    this.close_modal({ id: this._modals[0]?.id });
  }
}
export class UILayers {
  readonly lfw: LFW;
  protected _all: UILayer[] = [];
  constructor(lfw: LFW) {
    this.lfw = lfw;
  }
  get pages(): UINode[] {
    const ret: UINode[] = [];
    for (let i = this._all.length - 1; i >= 0; i--) {
      const ui = this._all[i]?.ui;
      if (ui) ret.push(ui);
    }
    return ret;
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
    for (let i = this._all.length - 1; i >= 0; i--) {
      const ui = this._all[i]?.ui;
      if (ui) return ui;
    }
    return undefined
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
  push_page(opts: IPushPageOpts, index: number): void {
    this.ensure(index).push(opts)
  }
  set_page(opts: IPushPageOpts, index: number): void {
    this.ensure(index).set(opts)
  }

  reset_page(opts: IPushPageOpts = {}, index: number = 0): void {
    this.at(index)?.reset(opts)
  }
  pop_page(opts: IPopPageOpts, index: number): void {
    this.at(index)?.pop(opts)
  }
  /** 在第 index 层的当前页面上打开弹窗/关闭弹窗 */
  open_modal(opts: IPushPageOpts, index: number): UINode | undefined {
    return this.ensure(index).open_modal(opts)
  }
  close_modal(opts: ICloseModalOpts, index: number): boolean {
    return this.at(index)?.close_modal(opts) ?? false
  }
  has_modal(id?: string): boolean {
    return this._all.some(i => i.has_modal(id))
  }
  dispose() {
    for (const i of this._all)
      i?.dispose();
    this._all.length = 0;
  }
}