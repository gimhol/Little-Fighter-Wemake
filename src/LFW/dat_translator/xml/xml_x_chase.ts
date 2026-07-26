import { type IChaseInfo, chase_info_new } from "../../defines";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { delete_undefined } from "./delete_undefined";

export function xml_2_chase(el: IXMLElement): IChaseInfo {
  const ret    /**/ = chase_info_new();
  ret.stratedy /**/ = el.get_num("stratedy", ret.stratedy)
  ret.flag     /**/ = el.get_num("flag", ret.flag)
  ret.lost     /**/ = el.get_num("lost", ret.lost)
  ret.oy       /**/ = el.get_num("oy", ret.oy)
  return delete_undefined(ret);
}
export function xml_x_chase(xml: IXML, c: IChaseInfo | undefined, tag: string): IXMLElement | undefined {
  if (!c) return void 0;
  const ret = xml.create(tag);
  ret.set_attr('stratedy', c.stratedy);
  ret.set_attr('flag', c.flag);
  ret.set_attr('lost', c.lost);
  ret.set_attr('oy', c.oy);
  return ret;
}