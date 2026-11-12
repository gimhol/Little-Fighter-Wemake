import type { NoEmitCallbacks } from "../../base/NoEmitCallbacks";
import type { IPointingsCallback } from "./IPointingsCallback";

export interface IPointings {
  get callback(): NoEmitCallbacks<IPointingsCallback>;
  get grabbing(): unknown;
  get enabled(): boolean;
  set enabled(v: boolean);
  set_screen_size(w: number, h: number): void;
  grab(grabbing: unknown): boolean;
  ungrab(grabbing: unknown): void;
  dispose(): void;
}
