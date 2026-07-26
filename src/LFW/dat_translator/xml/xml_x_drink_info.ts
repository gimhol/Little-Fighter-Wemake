import { drink_info_new, type IDrinkInfo } from "../../defines/IDrinkInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";

export function xml_x_drink_info(xml: IXML, d: IDrinkInfo, tag?: string): IXMLElement;
export function xml_x_drink_info(xml: IXML, d: IDrinkInfo | undefined, tag?: string): IXMLElement | undefined;
export function xml_x_drink_info(xml: IXML, d: IDrinkInfo | undefined, tag: string = "drink"): IXMLElement | undefined {
  if (!d) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("id", d.id);
  ret.set_attr("name", d.name);
  ret.set_arr_attr_soft("hp_h", [d.hp_h_total, d.hp_h_value, d.hp_h_ticks]);
  ret.set_arr_attr_soft("hp_r", [d.hp_r_total, d.hp_r_value, d.hp_r_ticks]);
  ret.set_arr_attr_soft("mp_h", [d.mp_h_total, d.mp_h_value, d.mp_h_ticks]);
  return ret;
}

export function xml_2_drink_info(el: IXMLElement): IDrinkInfo {
  const ret = drink_info_new()
  const hp_h     /**/ = el.nums_attr_soft("hp_h");
  const hp_r     /**/ = el.nums_attr_soft("hp_r");
  const mp_h     /**/ = el.nums_attr_soft("mp_h");
  ret.id         /**/ = el.get_str("id", ret.id)
  ret.name       /**/ = el.get_str("name", ret.name)
  ret.hp_h_total /**/ = el.get_num("hp_h_total", hp_h?.[0] ?? ret.hp_h_total)
  ret.hp_h_value /**/ = el.get_num("hp_h_value", hp_h?.[1] ?? ret.hp_h_value)
  ret.hp_h_ticks /**/ = el.get_num("hp_h_ticks", hp_h?.[2] ?? ret.hp_h_ticks)
  ret.hp_r_total /**/ = el.get_num("hp_r_total", hp_r?.[0] ?? ret.hp_r_total)
  ret.hp_r_value /**/ = el.get_num("hp_r_value", hp_r?.[1] ?? ret.hp_r_value)
  ret.hp_r_ticks /**/ = el.get_num("hp_r_ticks", hp_r?.[2] ?? ret.hp_r_ticks)
  ret.mp_h_total /**/ = el.get_num("mp_h_total", mp_h?.[0] ?? ret.mp_h_total)
  ret.mp_h_value /**/ = el.get_num("mp_h_value", mp_h?.[1] ?? ret.mp_h_value)
  ret.mp_h_ticks /**/ = el.get_num("mp_h_ticks", mp_h?.[2] ?? ret.mp_h_ticks)
  return delete_undefined(ret)
}

