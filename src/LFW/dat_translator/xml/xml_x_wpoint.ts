import { wpoint_info_new, type IWpointInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";

export function xml_x_wpoint(xml: IXML, i: IWpointInfo, tag: string): IXMLElement
export function xml_x_wpoint(xml: IXML, i: IWpointInfo | undefined, tag: string): IXMLElement | undefined
export function xml_x_wpoint(xml: IXML, i: IWpointInfo | undefined, tag: string): IXMLElement | undefined {
  if (!i) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("kind", i.kind);
  ret.set_attr("pos", [i.x, i.y, i.z].join());
  ret.set_attr("weaponact", i.weaponact);
  ret.set_attr("attacking", i.attacking);
  ret.set_arr_attr_soft("v", [i.dvx, i.dvy, i.dvz]);
  return ret
}

export function xml_2_wpoint(el: IXMLElement): IWpointInfo {
  const ret     /**/ = wpoint_info_new();
  ret.kind      /**/ = el.get_num("kind", ret.kind);
  const pos     /**/ = el.nums_attr_soft("pos");
  ret.x         /**/ = el.get_num("x", pos?.[0] ?? ret.x);
  ret.y         /**/ = el.get_num("y", pos?.[1] ?? ret.y);
  ret.z         /**/ = el.get_num("z", pos?.[2] ?? ret.z);
  ret.weaponact /**/ = el.get_str("weaponact", ret.weaponact);
  ret.attacking /**/ = el.get_str("attacking", ret.attacking);
  const v       /**/ = el.nums_attr_soft("v");
  ret.dvx       /**/ = el.get_num("dvx", v?.[0] ?? ret.dvx);
  ret.dvy       /**/ = el.get_num("dvy", v?.[1] ?? ret.dvy);
  ret.dvz       /**/ = el.get_num("dvz", v?.[2] ?? ret.dvz);
  return ret;
}

