import { armor_Info_new, type IArmorInfo } from "../../defines/IArmorInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";


export function xml_x_armor_info(xml: IXML, a: IArmorInfo, tag: string): IXMLElement
export function xml_x_armor_info(xml: IXML, a: IArmorInfo | undefined, tag: string): IXMLElement | undefined
export function xml_x_armor_info(xml: IXML, a: IArmorInfo | undefined, tag: string): IXMLElement | undefined {
  if (!a) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("id", a.id);
  ret.set_attr("name", a.name);
  ret.set_attr("type", a.type);
  ret.set_attr("toughness", a.toughness);
  ret.set_attr("fireproof", a.fireproof);
  ret.set_attr("antifreeze", a.antifreeze);
  ret.set_attr("fulltime", a.fulltime);
  ret.set_attr("injury_ratio", a.injury_ratio);
  ret.set_attr("shaking_ratio", a.shaking_ratio);
  ret.set_attr("motionless_ratio", a.motionless_ratio);
  ret.set_attr("hit_sounds", a.hit_sounds);
  ret.set_attr("dead_sounds", a.dead_sounds);
  return ret;
}

export function xml_2_armor_info(el: IXMLElement): IArmorInfo;
export function xml_2_armor_info(el: IXMLElement | undefined): IArmorInfo | undefined;
export function xml_2_armor_info(el: IXMLElement | undefined): IArmorInfo | undefined {
  if (!el) return void 0;
  const ret /**/ = armor_Info_new();
  ret.id /**/ = el.get_str("id");
  ret.name /**/ = el.get_str("name");
  ret.type /**/ = el.get_num("type");
  ret.toughness /**/ = el.get_num("toughness");
  ret.fireproof /**/ = el.get_num("fireproof");
  ret.antifreeze /**/ = el.get_num("antifreeze");
  ret.fulltime /**/ = el.get_bool("fulltime");
  ret.injury_ratio /**/ = el.get_num("injury_ratio");
  ret.shaking_ratio /**/ = el.get_num("shaking_ratio");
  ret.motionless_ratio /**/ = el.get_num("motionless_ratio");
  ret.hit_sounds /**/ = el.get_str_arr("hit_sounds");
  ret.dead_sounds /**/ = el.get_str_arr("dead_sounds");
  return delete_undefined(ret);
}

