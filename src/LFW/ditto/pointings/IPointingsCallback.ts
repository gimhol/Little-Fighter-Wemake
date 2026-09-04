import type { IPointingEvent } from "./IPointingEvent";

export interface IPointingsCallback {
  on_pointer_down?(e: IPointingEvent): void;
  on_pointer_move?(e: IPointingEvent): void;
  on_pointer_up?(e: IPointingEvent): void;
  on_pointer_cancel?(e: IPointingEvent): void;
  on_click?(e: IPointingEvent): void;
  on_wheel?(e: IPointingEvent): void;
}
