import { Callbacks } from "../LFW/base/Callbacks";
import { NoEmitCallbacks } from "../LFW/base/NoEmitCallbacks";
import { is_false } from "../LFW/utils/type_check";
import type { IFullScreen } from "../LFW/ditto/fullscreen/IFullScreen";
import type { IFullScreenCallback } from "../LFW/ditto/fullscreen/IFullScreenCallback";
type TAnyFunc = (...args: any[]) => unknown;
function is_fun<F extends TAnyFunc = TAnyFunc>(v: any): v is F {
  return typeof v === "function";
}
export class __FullScreen<T extends Element = any> implements IFullScreen<T> {
  protected _callbacks = new Callbacks<IFullScreenCallback>();
  protected _prev_element: T | null;

  get callbacks(): NoEmitCallbacks<IFullScreenCallback<T>> {
    return this._callbacks;
  }

  constructor() {
    document.addEventListener("fullscreenchange", this.on_fullscreenchange);
    this._prev_element = this.target;
  }

  depose(): void {
    document.removeEventListener("fullscreenchange", this.on_fullscreenchange);
    this._callbacks.clear()
  }

  private on_fullscreenchange = () => {
    const curr_element = this.target;
    if (this._prev_element === curr_element) return;

    this._prev_element = curr_element;
    this._callbacks.call("onChange", curr_element);
  };

  get target(): T | null {
    const d = document;
    return (
      d.fullscreenElement ||
      (d as any).mozFullScreenElement ||
      (d as any).webkitFullscreenElement
    );
  }
  set target(v: T | null) {
    if (!v) this.exit();
    else this.enter(v);
  }
  get is_fullscreen(): boolean {
    return !!this.target;
  }
  enter(element: T): Promise<void> {
    if (window.runtime?.WindowFullscreen) window.runtime?.WindowFullscreen?.();
    const d = document as any;
    if (is_false(d.mozFullScreenEnabled))
      return Promise.reject(new Error("全屏功能已被禁用"));
    if (is_fun(element.requestFullscreen)) return element.requestFullscreen();
    const e = element as any;
    if (is_fun(e.mozRequestFullScreen)) return e.mozRequestFullScreen();
    else if (is_fun(e.msRequestFullscreen)) return e.msRequestFullscreen();
    else if (is_fun(e.webkitRequestFullScreen))
      return e.webkitRequestFullScreen();

    return Promise.reject(new Error("不支持全屏"));
  }
  exit() {
    if (window.runtime?.WindowUnfullscreen) window.runtime?.WindowUnfullscreen?.();
    if (is_fun(document.exitFullscreen)) return document.exitFullscreen();
    const d = document as any;
    if (is_fun(d.msExitFullscreen)) return d.msExitFullscreen();
    if (is_fun(d.mozCancelFullScreen)) return d.mozCancelFullScreen();
    if (is_fun(d.webkitExitFullscreen)) return d.webkitExitFullscreen();
  }
}
