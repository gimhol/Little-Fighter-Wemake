import { Callbacks } from "../LFW/base/Callbacks";
import { NoEmitCallbacks } from "../LFW/base/NoEmitCallbacks";
import type { IPointings, IPointingsCallback } from "../LFW/ditto";
import { __PointingEvent } from "./__PointingEvent";

export class __Pointings implements IPointings {
  protected _callbacks = new Callbacks<IPointingsCallback>();
  protected _ele?: HTMLElement;
  enabled: boolean = true;
  get callback(): NoEmitCallbacks<IPointingsCallback> {
    return this._callbacks;
  }
  private _on_pointer_down = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_down", new __PointingEvent(this._ele, e));
  private _on_pointer_up = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_up", new __PointingEvent(this._ele, e));
  private _on_pointer_move = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_move", new __PointingEvent(this._ele, e));
  private _on_pointer_cancel = (e: PointerEvent) =>
    this.enabled && this._callbacks.call("on_pointer_cancel", new __PointingEvent(this._ele, e));
  private _on_click = (e: MouseEvent) =>
    this.enabled && this._callbacks.call("on_click", new __PointingEvent(this._ele, e));
  private _on_wheel = (e: WheelEvent) => {
    if (!this.enabled) return;
    e.preventDefault();
    this._callbacks.call("on_wheel", new __PointingEvent(this._ele, e));
  }
  dispose() {
    this._ele?.removeEventListener("click", this._on_click);
    this._ele?.removeEventListener("pointermove", this._on_pointer_move);
    this._ele?.removeEventListener("pointerdown", this._on_pointer_down);
    this._ele?.removeEventListener("pointerup", this._on_pointer_up);
    this._ele?.removeEventListener("wheel", this._on_wheel);
    this._callbacks.clear()
  }

  set_element(element: HTMLElement | null | undefined) {
    if (this._ele === element) return;
    this._ele?.removeEventListener("click", this._on_click);
    this._ele?.removeEventListener("pointermove", this._on_pointer_move);
    this._ele?.removeEventListener("pointerdown", this._on_pointer_down);
    this._ele?.removeEventListener("pointerup", this._on_pointer_up);
    this._ele?.removeEventListener("pointercancel", this._on_pointer_cancel);
    this._ele?.removeEventListener("wheel", this._on_wheel);
    this._ele = void 0;
    if (element) {
      this._ele = element;
      element.addEventListener("click", this._on_click);
      element.addEventListener("pointermove", this._on_pointer_move);
      element.addEventListener("pointerdown", this._on_pointer_down);
      element.addEventListener("pointerup", this._on_pointer_up);
      element.addEventListener("pointercancel", this._on_pointer_cancel);
      element.addEventListener("wheel", this._on_wheel, { passive: false });
    }

  }
}
