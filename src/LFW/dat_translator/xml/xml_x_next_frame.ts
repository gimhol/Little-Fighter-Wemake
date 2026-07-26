import { next_frame_new, type INextFrame, type TNextFrame } from "../../defines/INextFrame";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { non_empty, one_or_arr } from "./one_or_arr";

export function xml_x_next_frame(xml: IXML, i: INextFrame, tag: string): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("id", i.id);
  ret.set_attr("wait", i.wait);
  ret.set_attr("facing", i.facing);
  if (i.expression) ret.insert(xml.create("expression", i.expression));
  ret.set_attr("mp", i.mp);
  ret.set_attr("mp_mode", i.mp_mode);
  ret.set_attr("hp", i.hp);
  ret.set_arr_attr_soft("dv", [i.dvx, i.dvy, i.dvz]);
  ret.set_arr_attr_soft("acc", [i.acc_x, i.acc_y, i.acc_z]);
  ret.set_arr_attr_soft("vm", [i.vxm, i.vym, i.vzm]);
  ret.set_arr_attr_soft("ctrl", [i.ctrl_x, i.ctrl_y, i.ctrl_z]);
  ret.set_attr("sound", i.sound);
  ret.set_attr("blink_time", i.blink_time);
  return ret;
}

export function xml_2_next_frame(el: IXMLElement): INextFrame {
  const ret      /**/ = next_frame_new();
  ret.id         /**/ = one_or_arr(el.get_str_arr("id"));
  ret.desc       /**/ = el.get_str("desc", ret.desc);
  ret.wait       /**/ = el.get_num("wait") ?? el.get_str("wait");
  ret.facing     /**/ = el.get_num("facing", ret.facing);
  ret.expression /**/ = el.get_str("expression", ret.expression);
  ret.mp         /**/ = el.get_num("mp", ret.mp);
  ret.mp_mode    /**/ = el.get_num("mp_mode", ret.mp_mode);
  ret.hp         /**/ = el.get_num("hp", ret.hp);
  ret.sound      /**/ = non_empty(el.get_str_arr("sound"));
  ret.blink_time /**/ = el.get_num("blink_time", ret.blink_time);
  return delete_undefined(ret);
}
export function xml_x_t_next_frame(xml: IXML, nf: TNextFrame | undefined, tag: string): IXMLElement[] {
  if (!nf) return [];
  const nfs = Array.isArray(nf) ? nf : [nf];
  return nfs.map(v => xml_x_next_frame(xml, v, tag))
}

export function xml_2_t_next_frame(els: IXMLElement[]): TNextFrame | undefined {
  const ret = els.map(v => xml_2_next_frame(v));
  if (ret.length > 1) return ret;
  return ret[0];
}