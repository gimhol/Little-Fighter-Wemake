import { bg_layer_info_fields, bg_layer_info_new, type IBgLayerInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";
import { reorder_fields } from "../../fields";
import { delete_undefined } from "./delete_undefined";

export function xml_2_bg_layer(el: IXMLElement, index: number): IBgLayerInfo {
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
  ret.z           /**/ = el.get_num("z") ?? index ?? ret.z
  ret.loop        /**/ = el.get_num("loop") ?? ret.loop;
  ret.absolute    /**/ = el.get_num("absolute") ?? ret.absolute;
  ret.color       /**/ = el.get_str("color") ?? ret.color;
  ret.cc          /**/ = el.get_num("cc") ?? ret.cc;
  ret.c1          /**/ = el.get_num("c1") ?? ret.c1;
  ret.c2          /**/ = el.get_num("c2") ?? ret.c2;
  ret.offsetAnimX /**/ = el.get_num("offsetAnimX") ?? offsetAnim?.[0] ?? ret.offsetAnimX;
  ret.offsetAnimY /**/ = el.get_num("offsetAnimY") ?? offsetAnim?.[1] ?? ret.offsetAnimY;

  delete_undefined(ret)
  reorder_fields(ret, bg_layer_info_fields);
  return ret;
}

export function xml_x_bg_layer(xml: IXML, l: IBgLayerInfo, tag: string): IXMLElement {
  const layer = xml.create(tag);
  layer.set_attr("width", l.width);
  layer.set_attr("height", l.height);
  layer.set_attr("x", l.x);
  layer.set_attr("y", l.y);
  layer.set_attr("z", l.z);
  layer.set_attr("w", l.w);
  layer.set_attr("h", l.h);
  layer.set_attr("loop", l.loop);
  layer.set_attr("absolute", l.absolute);
  layer.set_attr("cc", l.cc);
  layer.set_attr("c1", l.c1);
  layer.set_attr("c2", l.c2);
  layer.set_attr("offsetAnimX", l.offsetAnimX);
  layer.set_attr("offsetAnimY", l.offsetAnimY);
  layer.set_attr("id", l.id);
  layer.set_attr("name", l.name);
  layer.set_attr("file", l.file);
  layer.set_attr("color", l.color);
  return layer;
}

