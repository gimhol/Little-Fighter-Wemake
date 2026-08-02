import type { LFW } from "../LFW";
import type { IEntityData, IFramePic } from "../defines";
import { cos, PI, sin } from "../utils";
export function preprocess_pic(lfw: LFW, data: IEntityData, pic: IFramePic): IFramePic {
  if (!pic) return pic;
  if (typeof pic.rad == 'number') {
    pic.deg = pic.rad * 180 / PI
    pic.__cos_r = cos(pic.rad)
    pic.__sin_r = sin(pic.rad)
  }
  else if (typeof pic.deg == 'number') {
    pic.rad = pic.deg * PI / 180;
    pic.__cos_r = cos(pic.rad)
    pic.__sin_r = sin(pic.rad)
  }
  return pic;
}
preprocess_pic.TAG = "preprocess_pic"
