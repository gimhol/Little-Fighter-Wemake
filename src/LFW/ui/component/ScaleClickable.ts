import { Easing } from "../../animation";
import { UIComponent } from "./UIComponent";
export class ScaleClickable extends UIComponent {
  static override readonly TAGS: string[] = ["ScaleClickable"];
  protected normal_scale: number = 1;
  protected hover_scale: number = 1.1;
  protected press_scale: number = 0.9;
  protected anim = new Easing(this.normal_scale, this.hover_scale).set_duration(100);
  private _p: number | null = null;

  override on_start(): void {
    super.on_start?.();
    this.normal_scale = this.num(0) ?? this.normal_scale;
    this.hover_scale = this.num(1) ?? this.hover_scale;
    const duration = this.num(2) ?? this.anim.duration
    this.anim.set(this.normal_scale, this.hover_scale)
      .set_duration(duration)
      .set_reverse(false);
    this._p = this.num(3);
  }

  override update(dt: number): void {
    const watching = this._p ? this.node.parent! : this.node;

    this.anim.set_val_1(watching.is_pointer_down(0) ? this.press_scale : this.normal_scale);
    const reverse = (!watching.pointer_over && !watching.focused) || !!watching.is_pointer_down(0);
    const { value } = this.anim.auto_trip(reverse, dt)
    this.node.set_scale(value, value, value);
  }
}
