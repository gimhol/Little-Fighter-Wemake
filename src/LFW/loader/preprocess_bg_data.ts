import { Defines, } from "../defines/defines";
import type { IBgData } from "../defines/IBgData";
import type { ImageInfo } from "../ditto/image/ImageInfo";
import type { LFW } from "../LFW";
import { is_non_blank_str } from "../utils/type_check/is_str";

export function preprocess_bg_data(lfw: LFW, data: IBgData, jobs: Promise<ImageInfo>[]): IBgData {
  const { layers, base: { shadow } } = data;
  data.base.height ??= Defines.MODERN_SCREEN_HEIGHT;
  is_non_blank_str(shadow) && jobs.push(lfw.images.load_img(shadow, shadow));
  
  if (layers?.length)
    for (const { file } of layers)
      is_non_blank_str(file) && jobs.push(lfw.images.load_img(file, file));

  const { shadowsize, zoom } = (data.base as any);
  if (Array.isArray(shadowsize)) {
    const [a, b] = shadowsize
    data.base.shadow_w ??= typeof a == 'number' ? a : 0;
    data.base.shadow_h ??= typeof b == 'number' ? b : 0;
  }

  if (Array.isArray(zoom)) {
    const [a, b, c] = zoom
    data.base.zoom_x ??= typeof a == 'number' ? a : 0;
    data.base.zoom_y ??= typeof b == 'number' ? b : 0;
    data.base.zoom_z ??= typeof c == 'number' ? c : 0;
  }
  return data
}
preprocess_bg_data.TAG = "preprocess_bg_data"