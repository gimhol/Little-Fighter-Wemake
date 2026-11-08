import { Keys } from "../../Keys";
import { Callbacks } from "../../base";
import { type IDebugging, make_debugging } from "../../base/Debugging";
import type { IPropsMeta, IVector3 } from "../../defines";
import { Ditto } from "../../ditto";
import { is_num } from '../../utils/type_check/is_num';
import type { IComponentInfo } from "../IComponentInfo";
import type { IUIInfo } from "../IUIInfo.dat";
import type { IUIKeyEvent } from "../IUIKeyEvent";
import { LFWPointerEvent } from "../LFWPointerEvent";
import type { UINode } from "../UINode";
import type { IUICompnentCallbacks } from "./IUICompnentCallbacks";
import { UIProps } from "./UIProps";
/**
 * 组件
 * 
 * @export
 * @class Component
 */
export class UIComponent<
  P = unknown,
  C extends IUICompnentCallbacks = IUICompnentCallbacks
> implements IDebugging {

  static get TAG(): string { return this.TAGS[0]; }
  static readonly TAGS: string[] = ["UIComponent"]
  static readonly PROPS: IPropsMeta = {}
  static readonly SINGLETON: boolean = false;
  static readonly ITEMS: readonly IUIInfo[] = [];
  readonly node: UINode;
  readonly f_name: string;
  readonly callbacks = new Callbacks<C>()
  readonly info: Required<IComponentInfo>;
  readonly props_holder: UIProps;
  protected _props: any;
  private _args_caches = new Map<any, any>()
  private _props_error?: Error & { errors: ReadonlyArray<string> };
  private _keys: Keys | null = null;
  stopped: boolean = true;
  paused: boolean = true;
  get props(): P {
    if (this._props) return this._props;
    if (this._props_error) throw this._props_error;
    this._props = this.props_holder.validate(this.constructor as any)
    if (this.props_holder.errors.length) {
      const e = new Error("[UIComponent.props] failed")
      this._props_error = Object.assign(e, {
        errors: this.props_holder.errors
      })
      throw this._props_error
    }
    return this._props
  }
  __debugging?: boolean | undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  debug(...args: unknown[]): void { }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  warn(...args: unknown[]): void { }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  log(...args: unknown[]): void { }

  id: string = '';
  name: string = ''
  get lfw() { return this.node.lfw; }
  get world() { return this.node.lfw.world; }
  mounted: boolean = false;

  private _enabled: boolean = true;

  get enabled() { return this._enabled; }
  set enabled(v: boolean) { this.set_enabled(v); }
  set_enabled(v: boolean): this { this._enabled = v; return this; }

  get disabled() { return !this.enabled }
  set disabled(v: boolean) { this.set_enabled(!v); }
  get LR(): -1 | 0 | 1 {
    const r = this.keys.R.is_end() ? 0 : 1;
    const l = this.keys.L.is_end() ? 0 : 1;
    return r - l as (-1 | 0 | 1);
  }
  get UD(): -1 | 0 | 1 {
    const u = this.keys.U.is_end() ? 0 : 1;
    const d = this.keys.D.is_end() ? 0 : 1;
    return u - d as (-1 | 0 | 1);
  }

  /**
   * 组件基类构造函数
   *
   * @constructor
   * @protected
   * @param {UINode} layout 布局对象
   * @param {string} f_name 组件在工厂中的名字
   * @param {IComponentInfo} info
   */
  constructor(layout: UINode, f_name: string, info: Required<IComponentInfo>) {
    this.node = layout;
    this.f_name = f_name;
    this.info = info;
    this.props_holder = new UIProps({
      ...info.props,
      ...info.properties
    }, this)
    this._enabled = info.enabled;
    this.id = info.id
    this.name = info.name;
    make_debugging(this);
  }
  init?(): void;
  /** @deprecated */
  num(idx: number): number | null {
    if (idx >= this.info.args.length) return null;
    const num = Number(this.info.args[idx]);
    return is_num(num) ? num : null;
  }
  /** @deprecated */
  str(idx: number): string | null {
    if (idx >= this.info.args.length) return null;
    return '' + this.info.args[idx]
  }
  /** @deprecated */
  bool(idx: number): boolean {
    const str = this.str(idx)?.toLowerCase();
    if (!str) return false;
    return !['false', '0'].some(v => v === str);
  }

  /** @deprecated */
  nums(idx: number, length: 1): [number] | null
  /** @deprecated */
  nums(idx: number, length: 2): [number, number] | null
  /** @deprecated */
  nums(idx: number, length: 3): [number, number, number] | null
  /** @deprecated */
  nums(idx: number, length: number): number[] | null;
  nums(idx: number, length: number): number[] | null {
    if (idx >= this.info.args.length) return null;

    const key = `nums_${idx}_${length}`
    const cache = this._args_caches.get(key)
    if (cache) return cache;

    let raw = this.info.args[idx];
    raw = typeof raw === 'string' ? raw.split(',') : raw
    if (Array.isArray(raw)) {
      if (raw.length < length) {
        this.warn(`nums`, `args[${idx}].length < ${length}!`)
        this._args_caches.set(key, null)
        return null
      }
      const unsafe_nums = raw.map(v => Number(v));
      const ret: number[] = []
      for (let i = 0; i < length; i++) {
        const unsafe_num = unsafe_nums[i];
        if (!is_num(unsafe_num)) {
          this.warn(`nums`, `args[${idx}][${i}] is not a number, but got ${raw[i]}`)
          this._args_caches.set(key, null)
          return null
        }
        ret.push(unsafe_num)
        this._args_caches.set(key, ret)
      }
      return ret
    } else {
      this.warn(`nums`, `args[${idx}] got ${raw}, can not parse to num2`)
      this._args_caches.set(key, null)
      return null
    }
  }
  /** @deprecated */
  vec3(idx: number): IVector3 | null {
    const key = `vec3_${idx}`
    const cache = this._args_caches.get(key)
    if (cache) return cache;
    const nums = this.nums(idx, 3)
    if (nums == null) {
      this._args_caches.set(key, null)
      return null
    }
    const [x, y, z] = nums;
    const ret = Ditto.vec3(x, y, z);
    this._args_caches.set(key, ret)
    return ret;
  }

  get node_name() {
    return this.node.name ?? this.node.id ?? 'no_name'
  }
  get keys(): Keys {
    if (this._keys) return this._keys;
    return this._keys = this.lfw.create_keys()
  }
  recycle_keys() {
    this._keys?.unmount()
  }
  on_pointer_down?(e: LFWPointerEvent): void;
  on_pointer_move?(e: LFWPointerEvent): void;
  on_pointer_up?(e: LFWPointerEvent): void;
  on_pointer_cancel?(e: LFWPointerEvent): void;
  on_pointer_leave?(): void;
  on_pointer_enter?(): void;
  on_click?(e: LFWPointerEvent): void;
  on_start?(): void;
  on_resume?(): void
  on_pause?(): void
  on_stop?(): void;

  on_show?(): void;

  on_hide?(): void;

  on_blur?(): void;

  on_foucs?(): void;

  update?(dt: number): void

  on_key_down?(e: IUIKeyEvent): void;

  on_key_up?(e: IUIKeyEvent): void;

  on_add?(): void;

  on_del?(): void;

  on_link?(node: UINode): void;

  on_unlink?(node: UINode): void;

  /** stupid. */
  find_node(which: string | null | undefined): UINode | null {
    if (typeof which !== 'string')
      return this.node
    which = which.trim();
    if (which.startsWith('parent:')) {
      let distance = Number(which.substring(7))
      let parent = this.node.parent;
      while (distance && parent) {
        parent = parent.parent
        --distance;
      }
      return parent || null
    } else if (which === 'parent') {
      return this.node.parent || null
    }
    switch (which) {
      case 'parent':
        return this.node.parent ?? null
      case 'self':
        return this.node;
    }
    const parent = this.node.parent
    if (parent && which.startsWith('bro:')) {
      const v = which.substring(4).trim();
      const brothers = parent.children;
      const len = brothers.length;
      if (len < 1) return null;
      let bro: UINode | null = null
      switch (v) {
        case 'prev': case '-1':
          bro = brothers[brothers.indexOf(this.node) - 1] || null;
          break;
        case 'next': case '+1':
          bro = brothers[brothers.indexOf(this.node) + 1] || null;
          break;
        default:
          bro = brothers[v as any] || null
          break;
      }
      if (bro === this.node)
        return null
      return bro
    }

    if (which.startsWith('id:')) {
      const v = which.substring(3).trim();
      return this.node.root?.search_node(v) || null
    }
    if (which.startsWith('name:')) {
      const v = which.substring(5).trim();
      return this.node.root?.find_child_by_name(v) || null
    }
    return null
  }
}
