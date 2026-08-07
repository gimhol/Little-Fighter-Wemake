import { BackgroundGroup, BGG } from "../defines";
import { bg_data_info_fields, bg_data_new, type IBgData } from "../defines/IBgData";
import { bg_layer_info_fields, bg_layer_info_new, type IBgLayerInfo } from "../defines/IBgLayerInfo";
import type { IDatIndex } from "../defines/IDatIndex";
import { Defines } from "../defines/defines";
import { reorder_keys } from "../fields";
import { match_colon_value } from "../utils/string_parser/match_colon_value";
import { take_blocks } from "../utils/string_parser/take_blocks";
import { to_num } from "../utils/type_cast/to_num";
import { is_str } from "../utils/type_check";
import { ColonValueReader } from "./ColonValueReader";
import { take } from "./take";
import { delete_undefined } from "./xml";
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
  const { blocks } = take_blocks(full_str, "layer:", "layer_end");
  for (const block_str of blocks) {
    const layer: IBgLayerInfo = make_bg_layer(block_str);
    layer.z = ret.layers.length - blocks.length;
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

function make_bg_layer(block_str: string) {
  const [file, remains] = block_str
    .trim()
    .split(/\n|\r/g)
    .filter((v) => v)
    .map((v) => v.trim());
  const fields: any = {};

  for (const [key, value] of match_colon_value(remains))
    fields[key] = to_num(value) ?? value;

  take(fields, "transparency");

  const y = take(fields, "y");
  const layer: IBgLayerInfo = bg_layer_info_new();
  layer.id = fields.id ? ('' + fields.id) : layer.id;
  layer.name = fields.name ? ('' + fields.name) : layer.name;
  /*
  lf2中，背景layer.rect会是意义不明的字符串，对应不同颜色，就是这么任性。
  对应关系参见 bg_color_translate。

  有rect的layer，永远跟随相机移动，且不使用图片文件，而是直接用颜色填充。
  */
  layer.file = fields.rect ? void 0 : file.replace(/.bmp$/, ".png").replace(/\\/g, '/');
  layer.absolute = fields.rect ? 1 : void 0;
  layer.color = fields.rect ? bg_color_translate(fields.rect) : void 0;
  layer.width = fields.width ?? 0;
  layer.height = fields.height ?? 0;
  layer.x = typeof fields.x === "number" ? fields.x : 0;
  layer.y = Defines.CLASSIC_SCREEN_HEIGHT - (y ?? 0);
  layer.z = 0;
  layer.w = typeof fields.w === "number" ? fields.w : layer.width;
  layer.h = typeof fields.h === "number" ? fields.h : layer.height;
  layer.loop = fields.loop ?? void 0;
  layer.cc = typeof fields.cc === "number" ? fields.cc * 2 : void 0;
  layer.c1 = typeof fields.c1 === "number" ? fields.c1 * 2 : void 0;
  layer.c2 = typeof fields.c2 === "number" ? fields.c2 * 2 + 1 : void 0;

  reorder_keys(layer, bg_layer_info_fields);
  delete_undefined(layer)
  return layer;
}

