import type { IEntityData, IFrameInfo, IFramePic } from "../defines";
import type { LFW } from "../LFW";
import { preprocess_pic } from "./preprocess_pic";

export function preprocess_frame_pic(lfw: LFW, data: IEntityData, frame: IFrameInfo): IFramePic | undefined {
  const { pic } = frame;
  if (!pic) return pic;
  return preprocess_pic(lfw, data, pic)
}

preprocess_frame_pic.TAG = "preprocess_frame_pic"