import { bg_data_fields, bg_info_fields, bg_layer_info_fields, delete_undefined, Ditto, reorder_fields, world_dataset_fields } from "..";
import { Defines, } from "../defines/defines";
import type { IBgData } from "../defines/IBgData";
import { Schema_ITerrainInfo, terrain_info_fields } from "../defines/ITerrainInfo";
import type { ImageInfo } from "../ditto/image/ImageInfo";
import type { LFW } from "../LFW";
import { SchemaValidator as SV } from "../utils/schema/validate_schema";
import { is_non_blank_str } from "../utils/type_check/is_str";


export function preprocess_bg_data(lfw: LFW, data: IBgData, jobs: Promise<ImageInfo>[]): IBgData {
  const { layers, base: { shadow }, terrain } = data;

  reorder_fields(data.base, bg_info_fields)
  delete_undefined(data.base);

  if (data.dataset) {
    reorder_fields(data.dataset, world_dataset_fields)
    delete_undefined(data.dataset);
  }

  data.base.height ??= Defines.MODERN_SCREEN_HEIGHT;
  is_non_blank_str(shadow) && jobs.push(lfw.images.load_img(shadow, shadow));

  if (layers?.length) {
    for (const layer of layers) {
      reorder_fields(layer, bg_layer_info_fields)
      delete_undefined(layer);
      const { file } = layer
      is_non_blank_str(file) && jobs.push(lfw.images.load_img(file, file));
    }
  }
  if (terrain?.length) {
    for (const t of terrain) {
      reorder_fields(t, terrain_info_fields)
      delete_undefined(t);
      SV.Default.validate(t, Schema_ITerrainInfo)
      if (SV.Default.warnings.length)
        Ditto.warn(SV.Default.warnings)
      if (SV.Default.errors.length)
        Ditto.error(SV.Default.errors)
      SV.Default.reset();
    }
  }

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
  reorder_fields(data, bg_data_fields)
  delete_undefined(data);
  return data
}
preprocess_bg_data.TAG = "preprocess_bg_data"