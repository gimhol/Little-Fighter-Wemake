import { Easing } from "../../animation/Easing";
import { UIComponent } from "./UIComponent";

export class OpacityHover extends UIComponent {
  static override readonly TAGS: string[] = ["OpacityHover"];
  protected anim = new Easing(0, 1).set_duration(150);
  private _p: number | null = null;

  override on_start(): void {
    super.on_start?.();
    const normal_opacity = this.num(0) ?? this.anim.val_1;
    const hover_opacity = this.num(1) ?? this.anim.val_2;
    const duration = this.num(2) ?? this.anim.duration
    this.anim.set(normal_opacity, hover_opacity)
      .set_duration(duration)
      .set_reverse(false);
    this._p = this.num(3);
  }

  override update(dt: number): void {
    const watching = this._p ? this.node.parent! : this.node;
    const reverse = (!watching.pointer_over && !watching.focused) || !!watching.is_pointer_down(0);
    this.node.opacity = this.anim.auto_trip(reverse, dt).value;
  }
}
