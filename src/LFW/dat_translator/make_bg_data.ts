import { BackgroundGroup, BGG } from "../defines";
import { bg_data_info_fields, bg_data_new, type IBgData } from "../defines/IBgData";
import { bg_layer_info_fields, type IBgLayerInfo } from "../defines/IBgLayerInfo";
import type { IDatIndex } from "../defines/IDatIndex";
import { Defines } from "../defines/defines";
import { reorder_keys } from "../fields";
import { min } from "../utils/math/base";
import { match_colon_value } from "../utils/string_parser/match_colon_value";
import { take_blocks } from "../utils/string_parser/take_blocks";
import { to_num } from "../utils/type_cast/to_num";
import { is_str } from "../utils/type_check";
import { ColonValueReader } from "./ColonValueReader";
import { take } from "./take";
const bg_color_translate = function (rect: number | string) {
  switch ("" + rect) {
    case "4706":
      return "rgb(16,79,16)";
    case "16835":
      return "rgb(66,56,24)";
    case "21096":
      return "rgb(90,78,75)";
    case "25356":
      return "rgb(103,103,103)";
    case "29582":
      return "rgb(119,119,119)";
    case "33580":
      return "rgb(135,107,103)";
    case "37770":
      return "rgb(154,110,90)";
    case "37773":
      return "rgb(151,119,111)";
    case "34816":
      return "rgb(143,7,7)";
    case "40179":
    case "40179b":
      return "rgb(159,163,159)";
  }
  if (is_str(rect)) return rect;
  const r = (rect >> 11) << 3;
  const g = ((rect >> 6) & 31) << 3;
  const b = (rect & 31) << 3;
  return (
    "rgb(" +
    (r + (r > 64 || r === 0 ? 7 : 0)) +
    "," +
    (g + (g > 64 || g === 0 ? 7 : 0) + ((rect >> 5) & 1 && g > 80 ? 4 : 0)) +
    "," +
    (b + (b > 64 || b === 0 ? 7 : 0)) +
    ")"
  );
};
export function make_bg_data(
  full_str: string,
  datIndex: IDatIndex,
): IBgData {
  full_str = full_str.replace(/\\\\/g, "/");
  const [fields] = new ColonValueReader()
    .str("name")
    .int("width")
    .int_2("zboundary")
    .str("shadow")
    .int_2("shadowsize")
    .read(full_str, {});

  const ret: IBgData = bg_data_new();
  const info = ret.base

  info.name = fields.name
  info.shadow = fields.shadow
  info.shadow_w = fields.shadowsize[0]
  info.shadow_h = fields.shadowsize[1]
  info.group = [BGG.Regular]
  info.left = 0
  info.right = fields.width
  info.far = 2 * (fields.zboundary[0] - Defines.CLASSIC_SCREEN_HEIGHT) // 转为Z轴的远坐标
  info.near = 2 * (fields.zboundary[1] - Defines.CLASSIC_SCREEN_HEIGHT) // 转为Z轴的近坐标,
  info.height = 0

  ret.id = datIndex.id ?? info.name
  ret.base = info
  ret.layers = []

  ret.base.name = ret.base.name?.replace(/_/g, " ");
  ret.base.shadow = ret.base.shadow?.replace(/.bmp$/, ".png").replace(/\\/g, '/');
  const { blocks, remains } = take_blocks(full_str, "layer:", "layer_end");
  full_str = remains

  let min_y = fields.top;
  for (const block_str of blocks) {
    const [file, remains] = block_str
      .trim()
      .split(/\n|\r/g)
      .filter((v) => v)
      .map((v) => v.trim());
    const fields: any = {};
    for (const [key, value] of match_colon_value(remains)) {
      fields[key] = to_num(value) ?? value;
    }
    take(fields, "transparency");
    const y = take(fields, "y");
    const cc = take(fields, "cc");
    const c1 = take(fields, "c1");
    const c2 = take(fields, "c2");
    const color = take(fields, "rect");
    const layer: IBgLayerInfo = {
      ...fields,
      file: file.replace(/.bmp$/, ".png").replace(/\\/g, '/'),
      y: Defines.CLASSIC_SCREEN_HEIGHT - y,
      z: ret.layers.length - blocks.length,
    };
    min_y = min(layer.y, min_y);
    if (color) {
      layer.absolute = 1;
      layer.color = bg_color_translate(color);
      delete layer.file;
    } else if (
      typeof cc === "number" &&
      typeof c1 === "number" &&
      typeof c2 === "number"
    ) {
      layer.cc = cc * 2;
      layer.c1 = c1 * 2;
      layer.c2 = c2 * 2 + 1;
    }
    reorder_keys(layer, bg_layer_info_fields);
    ret.layers.push(layer);
  }

  if (datIndex && datIndex.file.startsWith("bg/template")) {
    ret.base.group = []
  } else {
    ret.base.group = [BackgroundGroup.Regular]
  }
  reorder_keys(ret, bg_data_info_fields);
  return ret;
}
