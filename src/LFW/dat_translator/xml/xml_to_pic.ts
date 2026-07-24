import type { IFramePictureInfo } from "../../defines";
import type { IXML } from "../../ditto/xml/IXML";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";

/**
 * 解析 `<pic>` 帧切图，支持 rect="x,y,w,h" 快捷属性
 */
export function xml_to_pic(el: IXMLElement): IFramePictureInfo {
  const rect = el.nums_attr("rect");
  return {
    tex: el.get_str("tex") ?? "0",
    x: el.get_num("x") ?? rect?.[0] ?? 0,
    y: el.get_num("y") ?? rect?.[1] ?? 0,
    w: el.get_num("w") ?? rect?.[2] ?? 0,
    h: el.get_num("h") ?? rect?.[3] ?? 0,

    r: el.get_num("r"),
    ox: el.get_num("ox"),
    oy: el.get_num("oy"),

    cx: el.get_num("cx"),
    cy: el.get_num("cy"),
  };
}
export function xml_from_pic(xml: IXML, pic: IFramePictureInfo, tag = 'pic'): IXMLElement {
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