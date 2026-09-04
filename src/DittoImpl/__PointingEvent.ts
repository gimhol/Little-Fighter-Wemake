import { Defines } from "../LFW/defines/defines";
import type { IPointingEvent } from "../LFW/ditto";

export class __PointingEvent implements IPointingEvent {
  readonly is_pointing_event = true;
  protected _element?: HTMLElement;
  x: number = 0;
  y: number = 0;
  scene_x: number = 0;
  scene_y: number = 0;
  button: number = -1;
  delta_x: number = 0;
  delta_y: number = 0;

  constructor(element: HTMLElement | undefined, event: PointerEvent | MouseEvent | WheelEvent) {
    this._element = element;
    this.setup(element, event);
  }

  init(element: HTMLElement, event: PointerEvent | MouseEvent | WheelEvent) {
    this._element = element;
    this.setup(element, event);
  }

  protected setup(element: HTMLElement | undefined, event: PointerEvent | MouseEvent | WheelEvent) {
    const rect = element?.getBoundingClientRect();
    const width = rect?.width || 1;
    const height = rect?.height || 1;
    const is_wheel = event.type === 'wheel';
    if (is_wheel) {
      const e = event as WheelEvent;
      const ox = rect ? e.clientX - rect.left : 0;
      const oy = rect ? e.clientY - rect.top : 0;
      this.x = ox;
      this.y = oy;
      this.button = 0;
      this.delta_x = this.to_ui_delta(e.deltaX, e.deltaMode, width, true);
      this.delta_y = this.to_ui_delta(e.deltaY, e.deltaMode, height, false);
    } else {
      this.x = event.offsetX;
      this.y = event.offsetY;
      this.button = event.button
      this.delta_x = 0;
      this.delta_y = 0;
    }
    this.scene_x = (this.x / width) * 2 - 1;
    this.scene_y = -(this.y / height) * 2 + 1;
  }

  protected to_ui_delta(delta: number, mode: number, size: number, is_x: boolean): number {
    if (!delta) return 0;
    let px = delta;
    if (mode === 1) px = delta * 16;
    if (mode === 2) px = delta * size;
    const ui_size = is_x ? Defines.MODERN_SCREEN_WIDTH : Defines.MODERN_SCREEN_HEIGHT;
    return px * (size > 0 ? ui_size / size : 1);
  }
}
