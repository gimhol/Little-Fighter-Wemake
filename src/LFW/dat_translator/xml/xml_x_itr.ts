import { itr_info_new, type IItrInfo } from "../../defines/IItrInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { xml_from_t_next_frame } from "./xml_from_next_frame";
import { xml_to_t_next_frame } from "./xml_to_next_frame";
import { xml_to_qube } from "./xml_to_qube";
import { xml_to_velocity_info } from "./xml_to_velocity_info";
import { xml_2_colli_action, xml_x_colli_action } from "./xml_x_colli_action";
import { xml_2_non_empty } from "./xml_x_non_empty";

export function xml_x_itr(xml: IXML, i: IItrInfo, tag: string): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", i.id);
  el.set_attr("name", i.name);
  el.set_attr("ref", i.ref);
  el.set_attr("hit_flag", i.hit_flag as number);
  el.set_attr("motionless", i.motionless);
  el.set_attr("shaking", i.shaking);
  el.set_attr("kind", i.kind);
  el.set_attr("fall", i.fall);
  el.set_attr("vrest", i.vrest);
  el.set_attr("arest", i.arest);
  el.set_attr("bdefend", i.bdefend);
  el.set_attr("injury", i.injury);
  el.set_attr("effect", i.effect);

  xml_from_t_next_frame(xml, i.catchingact, 'catchingact').forEach(v => {
    el.insert(v);
  })
  xml_from_t_next_frame(xml, i.caughtact, 'caughtact').forEach(v => {
    el.insert(v);
  })
  xml_from_t_next_frame(xml, i.on_hit_ground, 'on_hit_ground').forEach(v => {
    el.insert(v);
  })
  i.actions?.map(v => xml_x_colli_action(xml, v, "action")).forEach(v => {
    el.insert(v);
  })
  el.set_arr_attr_soft("qube", [i.x, i.y, i.w, i.h, i.z, i.l]);
  el.set_arr_attr_soft("dv", [i.dvx, i.dvy, i.dvz]);
  el.set_attr("test", i.test);
  el.set_attr("code", i.code);
  return el;
}

export function xml_2_itr(el: IXMLElement): IItrInfo {
  const ret = itr_info_new();
  ret.id            /**/ = el.get_str("id", ret.id);
  ret.name          /**/ = el.get_str("name", ret.name);
  ret.ref           /**/ = el.get_str("ref") ?? el.get_str("prefab_id") ?? ret.ref;
  ret.hit_flag      /**/ = el.get_num("hit_flag", ret.hit_flag);
  ret.motionless    /**/ = el.get_num("motionless", ret.motionless);
  ret.shaking       /**/ = el.get_num("shaking", ret.shaking);
  ret.kind          /**/ = el.get_num("kind", ret.kind);
  ret.fall          /**/ = el.get_num("fall", ret.fall);
  ret.vrest         /**/ = el.get_num("vrest", ret.vrest);
  ret.arest         /**/ = el.get_num("arest", ret.arest);
  ret.bdefend       /**/ = el.get_num("bdefend", ret.bdefend);
  ret.injury        /**/ = el.get_num("injury", ret.injury);
  ret.effect        /**/ = el.get_num("effect", ret.effect);
  ret.catchingact   /**/ = xml_to_t_next_frame(el.children_by_tag('catchingact'));
  ret.caughtact     /**/ = xml_to_t_next_frame(el.children_by_tag('caughtact'));
  ret.on_hit_ground /**/ = xml_to_t_next_frame(el.children_by_tag('on_hit_ground'));
  ret.actions       /**/ = xml_2_non_empty(el, 'action', xml_2_colli_action)
  ret.test          /**/ = el.get_str("test", ret.test);
  ret.code          /**/ = el.get_num("code", ret.code);
  xml_to_velocity_info(el, ret);
  xml_to_qube(el, ret);
  return delete_undefined(ret);
}

