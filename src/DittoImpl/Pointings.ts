import { Callbacks } from "../LFW/base/Callbacks";
import { NoEmitCallbacks } from "../LFW/base/NoEmitCallbacks";
import { Defines } from "../LFW/defines/defines";
import type { IPointings, IPointingsCallback } from "../LFW/ditto";
import { __PointingEvent } from "./__PointingEvent";

export class __Pointings implements IPointings {
  protected _callbacks = new Callbacks<IPointingsCallback>();
  protected _ele?: HTMLElement;
  protected _screen_w: number = Defines.MODERN_SCREEN_WIDTH;
  protected _screen_h: number = Defines.MODERN_SCREEN_HEIGHT;
  enabled: boolean = true;

  set_screen_size(w: number, h: number): void {
    if (!(w > 0) || !(h > 0)) return;
    this._screen_w = w;
    this._screen_h = h;
  }
  protected _event(e: PointerEvent | MouseEvent | WheelEvent): __PointingEvent {
    return new __PointingEvent(this._ele, e, this._screen_w, this._screen_h);
  }

  get callback(): NoEmitCallbacks<IPointingsCallback> {
    return this._callbacks;
  }

  protected _grab_prev_epoch = -1;
  protected _grab_epoch = 0;
  protected _grabbing: unknown = void 0;
  get grabbing(): unknown {
    return this._grabbing !== void 0 && this._grab_prev_epoch === this._grab_epoch
      ? this._grabbing
      : void 0;
  }
  grab(who: unknown): boolean {
    if (
      this._grabbing !== void 0 &&
      this._grabbing !== who &&
      this._grab_prev_epoch === this._grab_epoch
    ) return false;

    this._grabbing = who;
    this._grab_prev_epoch = this._grab_epoch;
    return true;
  }
  ungrab(grabbing: unknown): void {
    if (this._grabbing === grabbing) this._grabbing = void 0;
  }
  protected grab_begin(): void {
    ++this._grab_epoch;
  }
  protected reset_grab(): void {
    this._grabbing = void 0;
    this._grab_prev_epoch = -1;
  }

  private _on_pointer_down = (e: PointerEvent) => {
    this.grab_begin();
    if (this.enabled) this._callbacks.call("on_pointer_down", this._event(e));
  };
  private _on_pointer_up = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_up", this._event(e));
  private _on_pointer_move = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_move", this._event(e));
  private _on_pointer_cancel = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_cancel", this._event(e));
  private _on_pointer_enter = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_enter", this._event(e));
  private _on_pointer_leave = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_leave", this._event(e));
  private _on_click = (e: MouseEvent) =>
    this.enabled && this._callbacks.call("on_click", this._event(e));
  private _on_wheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this._callbacks.call("on_wheel", this._event(e));
  }
  dispose() {
    this._ele?.removeEventListener("click", this._on_click);
    this._ele?.removeEventListener("pointermove", this._on_pointer_move);
    this._ele?.removeEventListener("pointerdown", this._on_pointer_down);
    this._ele?.removeEventListener("pointerup", this._on_pointer_up);
    this._ele?.removeEventListener("pointercancel", this._on_pointer_cancel);
    this._ele?.removeEventListener("pointerenter", this._on_pointer_enter);
    this._ele?.removeEventListener("pointerleave", this._on_pointer_leave);
    this._ele?.removeEventListener("wheel", this._on_wheel);
    this.reset_grab();
    this._callbacks.clear()
  }

  set_element(element: HTMLElement | null | undefined) {
    if (this._ele === element) return;
    this._ele?.removeEventListener("click", this._on_click);
    this._ele?.removeEventListener("pointermove", this._on_pointer_move);
    this._ele?.removeEventListener("pointerdown", this._on_pointer_down);
    this._ele?.removeEventListener("pointerup", this._on_pointer_up);
    this._ele?.removeEventListener("pointercancel", this._on_pointer_cancel);
    this._ele?.removeEventListener("pointerenter", this._on_pointer_enter);
    this._ele?.removeEventListener("pointerleave", this._on_pointer_leave);
    this._ele?.removeEventListener("wheel", this._on_wheel);
    this._ele = void 0;
    if (element) {
      this._ele = element;
      element.addEventListener("click", this._on_click);
      element.addEventListener("pointermove", this._on_pointer_move);
      element.addEventListener("pointerdown", this._on_pointer_down);
      element.addEventListener("pointerup", this._on_pointer_up);
      element.addEventListener("pointercancel", this._on_pointer_cancel);
      element.addEventListener("pointerenter", this._on_pointer_enter);
      element.addEventListener("pointerleave", this._on_pointer_leave);
      element.addEventListener("wheel", this._on_wheel, { passive: false });
    }

  }
}
