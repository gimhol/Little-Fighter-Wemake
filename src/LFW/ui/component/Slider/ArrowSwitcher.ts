import {
  type IUICallback, type IPropsMeta, type IUICompnentCallbacks,
  UIComponent, UINode
} from "../../..";

export interface IArrowSwitcherProps {
  /**
   * 选项 key 列表（逗号分隔）。label 显示时按 i18n 解析：
   * 若 key 是词条（如 `lang.zh-hans`）显示译文；不是词条则原样显示。
   */
  items?: string;
  /** 左箭头节点（点击 -1） */
  left?: UINode;
  /** 右箭头节点（点击 +1） */
  right?: UINode;
  /** 当前选项文字节点：每次变化 set_text(items[value]) */
  label?: UINode;
  /** 键盘 ◀/▶ 生效所需的焦点节点（缺省使用本组件所在节点） */
  responser?: UINode;
  /** 左/右箭头显示文本（缺省 ◀ / ▶） */
  left_text?: string;
  right_text?: string;
}

export interface IArrowSwitcherCallbacks extends IUICompnentCallbacks {
  on_value_changed?(value: number, component: ArrowSwitcher): void;
}

/**
 * 箭头切换器（不限选项数量）
 *
 * 与 SwitcherHandle 的「轨道上均分平铺所有选项」不同，本组件只显示当前一个选项：
 * - 选项两侧各有一个箭头节点，点击左/右箭头即循环切换（wrap）；
 * - 当前选项文字放在中间 label 节点（只显示 items[value] 一个）；
 * - 支持键盘 ◀/▶（焦点在 responser/自身时）切换；
 * - 选项数量不限（items 任意长度），常用于语言选择等“一行一值”的设置。
 *
 * 交互约定：
 * - 点击箭头 / 键盘切换 → value 变化并触发 `on_value_changed(value, this)`；
 * - `set_value(v)` 仅刷新显示，不触发回调（供外部按保存值初始化）。
 */
export class ArrowSwitcher extends UIComponent<IArrowSwitcherProps, IArrowSwitcherCallbacks> {
  static override readonly TAGS: string[] = ["ArrowSwitcher"];
  static override readonly PROPS: IPropsMeta<IArrowSwitcherProps> = {
    items: String,
    left: UINode,
    right: UINode,
    label: UINode,
    responser: UINode,
    left_text: String,
    right_text: String,
  }

  protected _value = 0;

  get items(): string[] {
    return this.props.items?.split(',') ?? [];
  }
  get count(): number {
    return this.items.length;
  }
  /** 当前下标（越界自动钳制） */
  get value(): number {
    const n = this.count;
    return n ? Math.min(this._value, n - 1) : 0;
  }
  get left(): UINode | undefined {
    return this.props.left;
  }
  get right(): UINode | undefined {
    return this.props.right;
  }
  get label(): UINode | undefined {
    return this.props.label;
  }
  get responser(): UINode {
    return this.props.responser ?? this.node;
  }

  protected _p_left: IUICallback = {
    on_pointer_down: (): void => { this.press(-1); },
  };
  protected _p_right: IUICallback = {
    on_pointer_down: (): void => { this.press(1); },
  };

  override on_start(): void {
    this.left?.callbacks.add(this._p_left);
    this.right?.callbacks.add(this._p_right);
    this.sync_arrows();
    this.sync_label();
  }
  override on_resume(): void {
    this.sync_arrows();
    this.sync_label();
  }
  override on_stop(): void {
    this.left?.callbacks.del(this._p_left);
    this.right?.callbacks.del(this._p_right);
  }
  override update(_dt: number): void {
    const resp = this.responser;
    if (!resp?.focused && !this.node.focused) return;
    if (this.keys.L.is_start()) this.step(-1);
    if (this.keys.R.is_start()) this.step(1);
  }

  /** 点击箭头：聚焦并切换 */
  protected press(dir: -1 | 1): void {
    this.responser.focused = true;
    this.step(dir);
  }

  /** 注册值变化回调（点击箭头/键盘切换时触发） */
  on_value_changed(cb: (value: number, component: ArrowSwitcher) => void): void {
    this.callbacks.add({ on_value_changed: cb });
  }

  /** 步进（循环 wrap）并触发回调 */
  step(dir: -1 | 1): void {
    const n = this.count;
    if (n <= 1) return;
    let c = this._value + dir;
    c = ((c % n) + n) % n; // 负数也正确取模
    if (c === this._value) return;
    this._value = c;
    this.sync_label();
    this.callbacks.call('on_value_changed', this.value, this);
  }

  /** 设置当前下标（钳制，不触发回调） */
  set_value(v: number): this {
    const n = this.count;
    if (!n) return this;
    const c = Math.max(0, Math.min(n - 1, Math.round(v) || 0));
    if (c !== this._value) {
      this._value = c;
      this.sync_label();
    }
    return this;
  }

  protected sync_label(): void {
    const label = this.label;
    if (!label) return;
    const key = this.items[this.value] ?? '';
    if (label.text?.text !== key) label.set_text(key);
  }

  protected sync_arrows(): void {
    const lt = this.props.left_text ?? '◀';
    const rt = this.props.right_text ?? '▶';
    const l = this.left;
    if (l && l.text?.text !== lt) l.set_text(lt);
    const r = this.right;
    if (r && r.text?.text !== rt) r.set_text(rt);
  }
}
