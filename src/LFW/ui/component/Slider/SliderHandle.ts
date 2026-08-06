import {
  clamp, Defines, type IPointingEvent, type IPointingsCallback, type IPropsMeta,
  type IUICallback, type IUICompnentCallbacks,
  Label, LF2PointerEvent, max, min, round, round_float, UIComponent, UINode
} from "../../..";
export interface ISliderHandleProps {
  mode?: string;
  items?: string;

  min?: number;
  max?: number;
  step?: number;
  precision?: number;

  container?: UINode;
  responser?: UINode;
  handle_label?: Label;
  direction?: 'row' | 'col';

  items_container?: UINode;
  visible_items?: number;

}
enum SliderHandleMode {
  Default = "default",
  Switcher = "switcher",
  ItemsScrollBar = "items_scroll_bar",
}
export interface ISliderHandleCallbacks extends IUICompnentCallbacks {
  on_value_changed?(value: number, component: SliderHandle): void
}
export class SliderHandle extends UIComponent<ISliderHandleProps, ISliderHandleCallbacks> {
  static override readonly TAGS: string[] = ["SliderHandle"];
  static override readonly PROPS: IPropsMeta<ISliderHandleProps> = {
    mode: String,
    min: Number,
    max: Number,
    precision: Number,
    step: Number,
    container: UINode,
    responser: UINode,
    items_container: UINode,
    handle_label: Label,
    items: String,
    visible_items: Number,
    direction: { type: String, oneof: ["row", "col"], nullable: true }
  }
  get direction() { return this.props.direction ?? 'row' }
  get mode() { return this.props.mode ?? SliderHandleMode.Default }
  set mode(v) { this.props.mode = v; }
  get items() { return this.props.items?.split(',') ?? [] }
  set items(v) { this.props.items = v.join(); }

  private _on_me = false;
  private _factor: number = 0;
  private p: IUICallback = {
    on_pointer_down: (e: LF2PointerEvent): void => {
      const { container, responser } = this;
      if (responser) responser.focused = true
      else if (container) container.focused = true
      else return;
      const { min_value, max_value, precision, step } = this;
      if (min_value == 0 && max_value == 1 && precision == 1 && step == 1) {
        this.factor = this._factor ? 0 : 1;
        this.callbacks.call('on_value_changed', this.value, this)
      } else {
        this._on_me = true
      }
    }
  }
  private b: IPointingsCallback = {
    on_pointer_down: (e: IPointingEvent): void => {
      if (!this._on_me) return;
      this.handle_pointing_event(e);
    },
    on_pointer_move: (e: IPointingEvent): void => {
      if (!this._on_me) return;
      this.handle_pointing_event(e);
    },
    on_pointer_up: (e: IPointingEvent): void => {
      if (!this._on_me) return;
      this.handle_pointing_event(e);
      this.callbacks.call('on_value_changed', this.value, this)
      this._on_me = false;
    },
    on_pointer_cancel: (e) => {
      if (!this._on_me) return;
      this.callbacks.call('on_value_changed', this.value, this)
      this._on_me = false;
    },
  }
  get container(): UINode | undefined {
    return this.props.container ?? this.node.parent;
  }
  get responser(): UINode | undefined {
    return this.props.responser ?? this.container;
  }
  get step(): number { return this.props.step ?? 10 }
  set step(v: number) { this.props.step = v }
  get precision(): number { return this.props.precision ?? 1 }
  set precision(v: number) { this.props.precision = v }
  get min_value(): number { return this.props.min ?? 0 }
  set min_value(v: number) { this.props.min = v }
  get max_value(): number { return this.props.max ?? 100 }
  set max_value(v: number) { this.props.max = v }
  get factor(): number { return clamp(this._factor, 0, 1) }
  set factor(v: number) { this.set_factor(v) }
  on_value_changed(cb: (value: number, component: SliderHandle) => void) {
    this.callbacks.add({ on_value_changed: cb })
  }
  set_factor(v: number): this {
    this._factor = clamp(v, 0, 1);
    if (SliderHandleMode.Switcher == this.mode) {
      const { items } = this
      if (items.length) {
        this.props.handle_label?.set_text('' + (items.at(this.value) ?? this.value))
      } else {
        this.props.handle_label?.set_text('' + this.value)
      }
    } else {
      this.props.handle_label?.set_text('' + this.value)
    }
    return this;
  }
  get value(): number {
    const { min_value, max_value, precision } = this;
    return round_float(min_value + (max_value - min_value) * this._factor, precision)
  }
  set value(v: number) { this.set_value(v) }
  set_value(v: number): this {
    const { min_value, max_value, precision } = this;
    v = round_float(clamp(v, min_value, max_value), precision);
    this.factor = round_float((v - min_value) / (max_value - min_value));
    return this;
  }
  handle_pointing_event(e: IPointingEvent): void {
    const { container } = this;
    if (!container) return;
    const { geo } = container;
    const { cross } = this.node;

    if (this.direction == 'row') {
      const fx = Defines.MODERN_SCREEN_WIDTH * (e.scene_x + 1) / 2
      const min_num = geo.left - geo.pos.x - cross.left;
      const max_num = geo.right - geo.pos.x - cross.right;
      const x = clamp(fx - geo.pos.x, min_num, max_num);
      this.factor = round_float((x - min_num) / (max_num - min_num));
      this.value = this.value
    } else {
      const fy = Defines.MODERN_SCREEN_HEIGHT * (1 - e.scene_y) / 2
      const min_num = geo.top - geo.pos.y - cross.top;
      const max_num = geo.bottom - geo.pos.y - cross.bottom;
      const y = clamp(fy - geo.pos.y, min_num, max_num);
      this.factor = round_float((y - min_num) / (max_num - min_num));
      this.value = this.value // 懒了，直接用这个来“弹”
    }
  }
  override on_start(): void {
    this.container?.callbacks.add(this.p)
    this.lfw.pointings.callback.add(this.b)
    if (SliderHandleMode.Switcher == this.mode) {
      this.max_value = max(this.items.length - 1, 0)
      this.min_value = 0;
      this.precision = 1;
      this.step = 1;
    }
  }
  override on_stop(): void {
    this.container?.callbacks.del(this.p)
    this.lfw.pointings.callback.del(this.b)
  }
  override update(dt: number): void {
    const { container, responser } = this;
    if (!container) return;
    const { cross } = this.node;
    const { geo } = container;
    const { parent } = this.node

    if (parent) switch (this.mode) {
      case SliderHandleMode.Switcher: {
        const { size } = parent;
        const { items: { length } } = this
        if (!length) break;
        if (this.direction == 'row') {
          this.node.resize(size.x / length, size.y)
        } else {
          this.node.resize(size.x, size.y / length,)
        }
        break;
      }
      case SliderHandleMode.Default: {
        const { size } = parent;
        if (this.direction == 'row') {
          this.node.set_h(size.y)
        } else {
          this.node.set_w(size.x)
        }
        break;
      }
      case SliderHandleMode.ItemsScrollBar: {
        const { size } = parent;
        const length = this.props.items_container?.children.length || 1
        const visibles = min(this.props.visible_items ?? length, length)
        if (this.direction == 'row') {
          this.node.resize(size.x * visibles / length, size.y)
        } else {
          this.node.resize(size.x, size.y * visibles / length)
        }
        break;
      }
    }

    if (this.direction == 'row') {
      const min_num = geo.left - geo.pos.x - cross.left;
      const max_num = geo.right - geo.pos.x - cross.right;
      const dist = min_num + (max_num - min_num) * this.factor;
      const curr = this.node.x + (dist - this.node.x) * 0.25
      this.node.x = round(clamp(curr, min_num, max_num));
    } else {
      const min_num = geo.top - geo.pos.y - cross.top;
      const max_num = geo.bottom - geo.pos.y - cross.bottom;
      const dist = min_num + (max_num - min_num) * this.factor;
      const curr = this.node.y + (dist - this.node.y) * 0.25
      this.node.y = round(clamp(curr, min_num, max_num))
    }
    if (
      !responser?.focused &&
      !container?.focused &&
      !this.node?.focused
    ) return;

    if (SliderHandleMode.Default == this.mode) {
      const { LR: lr, UD: ud } = this;
      if (this.direction == 'row' && lr) {
        this.value += this.step * lr;
      } else if (this.direction == 'col' && ud) {
        this.value -= this.step * ud;
      }
    } else if (this.direction == 'row') {
      const lr =
        (this.keys.R.is_start() ? 1 : 0) -
        (this.keys.L.is_start() ? 1 : 0);
      const prev = this.value
      let curr = this.value + this.step * lr
      if (curr < this.min_value) curr = this.max_value;
      if (curr > this.max_value) curr = this.min_value;
      this.value = curr;
      if (prev != curr)
        this.callbacks.call('on_value_changed', this.value, this)
    } else if (this.direction == 'col') {
      const ud =
        (this.keys.D.is_start() ? 1 : 0) -
        (this.keys.U.is_start() ? 1 : 0);
      const prev = this.value
      let curr = this.value - this.step * ud
      if (curr < this.min_value) curr = this.max_value;
      if (curr > this.max_value) curr = this.min_value;
      this.value = curr;
      if (prev != curr)
        this.callbacks.call('on_value_changed', this.value, this)
    }
  }
}