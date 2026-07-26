import type { IQube } from "../../defines";
import type { IXMLElement } from "../../ditto";

/**
 * 解析快捷属性：rect="x,y,w,h" 或 qube="x,y,w,h" 或 qube="x,y,w,h,z,l"
 */

export function parse_rect_qube(el: IXMLElement): Partial<IQube> {
  const rect = el.nums_attr("rect");
  if (rect && rect.length >= 4) {
    return { x: rect[0], y: rect[1], w: rect[2], h: rect[3], z: rect[4], l: rect[5] };
  }
  const qube = el.nums_attr("qube");
  if (qube && qube.length >= 4) {
    return { x: qube[0], y: qube[1], w: qube[2], h: qube[3], z: qube[4], l: qube[5] };
  }
  return {};
}
