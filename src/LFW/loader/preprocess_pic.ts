import type { LFW } from "../LFW";
import type { IEntityData, IFramePic } from "../defines";
import { Ditto } from "../ditto/Instance";
import type { ImageInfo } from "../ditto/image/ImageInfo";
import { cos, sin } from "../utils";
import { find } from "../utils/container_help/find";
const cache_key = (a: IFramePic, b: ImageInfo): string => {
  return [a.tex, a.x, a.y, a.w, a.h, b.w, b.h, b.scale].join();
}
const cache_map = new Map<string, IFramePic>();

export function preprocess_pic(lfw: LFW, data: IEntityData, pic: IFramePic): IFramePic {
  if (!pic) return pic;

  if (typeof pic.r == 'number') {
    pic.__cos_r = cos(pic.r)
    pic.__sin_r = sin(pic.r)
  }
  const pic_info = find(data.base.files, ([, v]) => v.id === pic.tex)?.[1];
  if (!pic_info) {
    Ditto.warn(preprocess_pic.TAG, "file info not found, pic:", pic);
    return pic;
  }
  const p = lfw.images.find_by_pic_info(pic_info);
  if (!p) {
    Ditto.warn(preprocess_pic.TAG, "img info not found", pic_info);
    return pic;
  };


  const ck = cache_key(pic, p)
  let ret = cache_map.get(ck);
  if (ret) return ret;
  cache_map.set(ck, pic)
  return pic;
}
preprocess_pic.TAG = "preprocess_pic"
