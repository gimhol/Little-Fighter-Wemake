import { Easing, Sequence } from "../../animation";
import { Animation } from "../../animation/Animation";
import { Sine } from "../../animation/Sine";
import { Ditto } from "../../ditto";
import { LF2PointerEvent } from "../LF2PointerEvent";
import { Flex } from "./Flex";
import type { IUICompnentCallbacks } from "./IUICompnentCallbacks";
export interface IJalousieCallbacks extends IUICompnentCallbacks {
  on_anim_end?(v: Jalousie): void;
}
export class Jalousie extends Flex<IJalousieCallbacks> {
  static override readonly TAGS: string[] = ["Jalousie"];
  protected _anim: Animation = new Sequence(
    new Easing(0, 0).set_duration(250),
    new Sine(-1, 2, 0.5).set_duration(250),
    new Easing(1, 1).set_duration(250),
  )
  get anim(): Animation { return this._anim }
  get click_test(): boolean { return this.props_holder.bool('click_test') === true; }

  override on_start() {
    super.on_start?.();
    const open = this.props_holder.bool('open') ?? this.bool(1);
    const end = this.props_holder.bool('end') ?? this.bool(2);
    if (end) this._anim.end(open)
    else this._anim.start(open)
  }
  get open(): boolean { return this._anim.reverse; }
  set open(v: boolean) { this._anim.start(v); }
  get w(): number { return this.node.root.w }
  get h(): number { return this.node.root.h }

  override on_click(e: LF2PointerEvent): void {
    super.on_click?.(e)
    if (this.click_test) {
      this.open = !this.open;
      Ditto.debug(`[${Jalousie.TAG}]open=${this.open}`)
    }
  }
  override on_stop(): void {
    super.on_stop?.()
    this.callbacks.clear();
  }

  override update(dt: number): void {
    super.update(dt);
    if (this._anim.done) return;
    this._anim.update(dt);
    this.update_children();

    if (this._anim.done)
      this.callbacks.call('on_anim_end', this);
  }

  override on_show(): void {
    super.on_show?.()
    this._anim.calc();
    this.update_children();
  }

  protected update_children() {
    const { value } = this._anim;
    const { children } = this.node;
    const len = children.length;
    for (let i = 0; i < len; i++) {
      const child = children[i];
      if (!child) continue;
      if (this.direction === 'column') {
        child.set_scale(1, value, 1);
      } else {
        child.set_scale(value, 1, 1);
      }
    }
  }
}
