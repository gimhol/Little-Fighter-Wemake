import { frame_pic_new, type IFramePic } from "../../defines";
import type { IXML } from "../../ditto/xml/IXML";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_2_map, xml_x_map } from "./xml_x_map";

export function xml_2_frame_pic(el: IXMLElement): IFramePic {
  const ret = frame_pic_new()
  ret.tex = el.get_str("tex", ret.tex)
  const rect = el.get_num_arr("rect");
  ret.x = el.get_num("x", rect?.[0] ?? ret.x)
  ret.y = el.get_num("y", rect?.[1] ?? ret.y)
  ret.w = el.get_num("w", rect?.[2] ?? ret.w)
  ret.h = el.get_num("h", rect?.[3] ?? ret.h)
  ret.r = el.get_num("r")
  ret.ox = el.get_num("ox")
  ret.oy = el.get_num("oy")
  ret.cx = el.get_num("cx")
  ret.cy = el.get_num("cy")
  return ret;
}
export function xml_x_frame_pic(xml: IXML, pic: IFramePic, tag: string): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("tex", pic.tex);
  el.set_arr_attr("rect", [pic.x, pic.y, pic.w, pic.h]);
  el.set_attr("r", pic.r);
  el.set_attr("ox", pic.ox);
  el.set_attr("oy", pic.oy);
  el.set_attr("cx", pic.cx);
  el.set_attr("cy", pic.cy);
  return el;
}

export function xml_2_picture_info_map(el: IXMLElement, tag: string): Record<string, IFramePic> | undefined {
  return xml_2_map(el, tag, xml_2_frame_pic)
}
export function xml_x_picture_info_map(xml: IXML, map: Record<string, IFramePic> | undefined, tag: string) {
  return xml_x_map(xml, map, tag, xml_x_frame_pic);
}
