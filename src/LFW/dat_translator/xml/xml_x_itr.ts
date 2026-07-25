import { itr_info_new, type IItrInfo } from "../../defines/IItrInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { xml_to_qube } from "./xml_to_qube";
import { xml_to_velocity_info } from "./xml_to_velocity_info";
import { xml_2_colli_action, xml_x_colli_action } from "./xml_x_colli_action";
import { xml_2_t_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";
import { xml_2_non_empty, xml_x_non_empty } from "./xml_x_non_empty";

export function xml_x_itr(xml: IXML, i: IItrInfo, tag: string): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("id", i.id);
  ret.set_attr("name", i.name);
  ret.set_attr("ref", i.ref);
  ret.set_attr("hit_flag", i.hit_flag as number);
  ret.set_attr("motionless", i.motionless);
  ret.set_attr("shaking", i.shaking);
  ret.set_attr("kind", i.kind);
  ret.set_attr("fall", i.fall);
  ret.set_attr("vrest", i.vrest);
  ret.set_attr("arest", i.arest);
  ret.set_attr("bdefend", i.bdefend);
  ret.set_attr("injury", i.injury);
  ret.set_attr("effect", i.effect);
  xml_x_t_next_frame(xml, i.catchingact, 'catchingact').forEach(v => ret.insert(v))
  xml_x_t_next_frame(xml, i.caughtact, 'caughtact').forEach(v => ret.insert(v))
  xml_x_t_next_frame(xml, i.on_hit_ground, 'on_hit_ground').forEach(v => ret.insert(v))
  xml_x_non_empty(xml, i.actions, "action", xml_x_colli_action)?.forEach(v => ret.insert(v))
  ret.set_arr_attr_soft("qube", [i.x, i.y, i.w, i.h, i.z, i.l]);
  ret.set_arr_attr_soft("dv", [i.dvx, i.dvy, i.dvz]);
  ret.set_attr("test", i.test);
  ret.set_attr("code", i.code);
  return ret;
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
  ret.catchingact   /**/ = xml_2_t_next_frame(el.children_by_tag('catchingact'));
  ret.caughtact     /**/ = xml_2_t_next_frame(el.children_by_tag('caughtact'));
  ret.on_hit_ground /**/ = xml_2_t_next_frame(el.children_by_tag('on_hit_ground'));
  ret.actions       /**/ = xml_2_non_empty(el, 'action', xml_2_colli_action)
  ret.test          /**/ = el.get_str("test", ret.test);
  ret.code          /**/ = el.get_num("code", ret.code);
  xml_to_velocity_info(el, ret);
  xml_to_qube(el, ret);
  return delete_undefined(ret);
}

