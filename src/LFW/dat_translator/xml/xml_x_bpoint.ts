import { type IBpointInfo, bpoint_info_new } from "../../defines";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { delete_undefined } from "./delete_undefined";

export function xml_2_bpoint(el: IXMLElement): IBpointInfo {
  const ret = bpoint_info_new()
  ret.x = el.get_num("x", ret.x)
  ret.y = el.get_num("y", ret.y)
  ret.z = el.get_num("z", ret.z)
  ret.r = el.get_num("r", ret.r)
  return delete_undefined(ret);
}

export function xml_x_bpoint(xml: IXML, i: IBpointInfo, tag: string): IXMLElement;
export function xml_x_bpoint(xml: IXML, i: IBpointInfo | undefined, tag: string): IXMLElement | undefined;
export function xml_x_bpoint(xml: IXML, i: IBpointInfo | undefined, tag: string): IXMLElement | undefined {
  if (!i) return void 0;
  const ret = xml.create(tag)
  ret.set_attr('x', i.x)
  ret.set_attr('y', i.y)
  ret.set_attr('z', i.z)
  ret.set_attr('r', i.r)
  return ret;
}
