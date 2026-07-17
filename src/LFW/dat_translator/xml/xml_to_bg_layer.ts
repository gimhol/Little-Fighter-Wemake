import { type IBgLayerInfo, bg_layer_info_fields, bg_layer_info_new } from "../../defines";
import type { IXMLElement } from "../../ditto";
import { reorder_keys } from "../../fields";

/**
 * 解析 `<layer>` 元素为 IBgLayerInfo
 * @param {IXMLElement} el - layer 元素
 * @param {number} defaultZ - 默认 z 坐标
 * @return {IBgLayerInfo}
 */

export function xml_to_bg_layer(el: IXMLElement, defaultZ: number | undefined): IBgLayerInfo {
  const ret = bg_layer_info_new();
  const pos = el.get_num_arr('pos');
  const size = el.get_num_arr('size');
  const rect = el.get_num_arr('rect');
  const offsetAnim = el.get_num_arr('offsetAnim');

  ret.id          /**/ = el.get_str("id") ?? ret.id
  ret.name        /**/ = el.get_str("name") ?? ret.name
  ret.file        /**/ = el.get_str("file") ?? ret.file
  ret.width       /**/ = el.get_num("width") ?? ret.width
  ret.height      /**/ = el.get_num("height") ?? ret.height
  ret.x           /**/ = el.get_num("x") ?? pos?.[0] ?? rect?.[0] ?? ret.x
  ret.y           /**/ = el.get_num("y") ?? pos?.[1] ?? rect?.[1] ?? ret.y
  ret.w           /**/ = el.get_num("w") ?? size?.[0] ?? rect?.[2] ?? ret.w
  ret.h           /**/ = el.get_num("h") ?? size?.[1] ?? rect?.[3] ?? ret.h
  ret.z           /**/ = el.get_num("z") ?? defaultZ ?? ret.z
  ret.loop        /**/ = el.get_num("loop") ?? ret.loop;
  ret.absolute    /**/ = el.get_num("absolute") ?? ret.absolute;
  ret.color       /**/ = el.get_str("color") ?? ret.color;
  ret.cc          /**/ = el.get_num("cc") ?? ret.cc;
  ret.c1          /**/ = el.get_num("c1") ?? ret.c1;
  ret.c2          /**/ = el.get_num("c2") ?? ret.c2;
  ret.offsetAnimX /**/ = el.get_num("offsetAnimX") ?? offsetAnim?.[0] ?? ret.offsetAnimX;
  ret.offsetAnimY /**/ = el.get_num("offsetAnimY") ?? offsetAnim?.[1] ?? ret.offsetAnimY;

  reorder_keys(ret, bg_layer_info_fields);
  return ret;
}
