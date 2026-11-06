import { Easing, Sequence } from "../../animation";
import { Animation } from "../../animation/Animation";
import { Sine } from "../../animation/Sine";
import { Ditto } from "../../ditto";
import { LFWPointerEvent } from "../LFWPointerEvent";
import type { IUICompnentCallbacks } from "./IUICompnentCallbacks";
import { UIComponent } from "./UIComponent";
export interface IJalousieCallbacks extends IUICompnentCallbacks {
  on_anim_end?(v: Jalousie): void;
}
export class Jalousie extends UIComponent<unknown, IJalousieCallbacks> {
  static override readonly TAGS: string[] = ["Jalousie"];
  protected _anim: Animation = new Sequence(
    new Easing(0, 0).set_duration(250),
    new Sine(-1, 2, 1).set_duration(250),
    new Easing(1, 1).set_duration(250),
  )
  get anim(): Animation { return this._anim }
  get click_test(): boolean { return this.props_holder.bool('click_test') === true; }
  get direction(): "row" | "column" {
    return this.props_holder.str('direction', ['row', 'column']) === 'column' ? 'column' : 'row';
  }

  override on_start() {
    this.sync_screen_rect();
    this.apply_layout();
    const open = this.props_holder.bool('open') ?? this.bool(1);
    const end = this.props_holder.bool('end') ?? this.bool(2);
    if (end) this._anim.end(open)
    else this._anim.start(open)
  }
  override on_resume(): void {
    this.sync_screen_rect();
    this.apply_layout();
  }
  protected apply_layout(): void {
    const flex = this.node.flex;
    flex.display = "flex";
    flex.direction = this.direction;
    flex.align = "stretch";
    flex.row_gap = 0;
    flex.col_gap = 0;
    for (const child of this.node.children) {
      child.flex.shrink = 0;
      child.flex.stretch_force = true;
    }
    this.node.invalidate_flex();
    this.node.flush_flex();
  }
  protected sync_screen_rect(): void {
    const root = this.node.root;
    if (!root.w || !root.h) return;
    const { x: cx, y: cy } = this.node.center;
    this.node.move_to_global(
      root.global_pos.x + cx * root.w,
      root.global_pos.y + cy * root.h,
      this.node.global_pos.z,
    );
    this.node.resize(root.w, root.h);
  }
  get open(): boolean { return this._anim.reverse; }
  set open(v: boolean) { this._anim.start(v); }
  get w(): number { return this.node.root.w }
  get h(): number { return this.node.root.h }

  override on_click(e: LFWPointerEvent): void {
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
