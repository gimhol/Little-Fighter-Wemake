import type { IFramePictureInfo } from "../../defines";
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
