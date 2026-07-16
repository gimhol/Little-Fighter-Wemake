import { FrameId } from "./FrameId";
import { Defines } from "./defines";
import type { IFrameInfo } from "./IFrameInfo";

export const EMPTY_FRAME_INFO: IFrameInfo = {
  id: FrameId.None,
  name: "EMPTY_FRAME_INFO",
  pic: { tex: "", x: 0, y: 0, w: 0, h: 0 },
  width: 0,
  height: 0,
  state: NaN,
  wait: 0,
  next: Defines.NEXT_FRAME_AUTO,
  centerx: 0,
  centery: 0,
};
