import { cpoint_info_fields, cpoint_new, type ICpoint } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";
import { reorder_keys } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { xml_2_t_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";

export function xml_x_cpoint(xml: IXML, i: ICpoint, tag: string): IXMLElement
export function xml_x_cpoint(xml: IXML, i: ICpoint | undefined, tag: string): IXMLElement | undefined
export function xml_x_cpoint(xml: IXML, i: ICpoint | undefined, tag: string): IXMLElement | undefined {
  if (!i) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("kind", i.kind);
  ret.set_arr_attr_soft("pos", [i.x, i.y, i.z]);
  xml_x_t_next_frame(xml, i.vaction, "vaction").forEach(v => ret.insert(v))
  ret.set_attr("injury", i.injury);
  ret.set_attr("hurtable", i.hurtable);
  ret.set_attr("decrease", i.decrease);
  ret.set_arr_attr_soft("throwv", [i.throwvx, i.throwvy, i.throwvz]);
  ret.set_attr("throwinjury", i.throwinjury);
  ret.set_attr("fronthurtact", i.fronthurtact);
  ret.set_attr("backhurtact", i.backhurtact);
  ret.set_attr("shaking", i.shaking);
  ret.set_attr("motionless", i.motionless);
  return ret
}
export function xml_2_cpoint(el: IXMLElement): ICpoint {
  const ret = cpoint_new();
  const pos        /**/ = el.nums_attr_soft("pos");
  const throwv     /**/ = el.nums_attr_soft("throwv");
  ret.kind         /**/ = el.get_num("kind", ret.kind)
  ret.x            /**/ = el.get_num("x", pos?.[0] ?? ret.x);
  ret.y            /**/ = el.get_num("y", pos?.[1] ?? ret.y);
  ret.z            /**/ = el.get_num("z", pos?.[2] ?? ret.z);
  ret.vaction      /**/ = xml_2_t_next_frame(el.children_by_tag('vaction'))
  ret.injury       /**/ = el.get_num("injury", ret.injury)
  ret.hurtable     /**/ = el.get_num("hurtable", ret.hurtable)
  ret.decrease     /**/ = el.get_num("decrease", ret.decrease)
  ret.throwvx      /**/ = el.get_num("throwvx", throwv?.[0] ?? ret.throwvx);
  ret.throwvy      /**/ = el.get_num("throwvy", throwv?.[1] ?? ret.throwvy);
  ret.throwvz      /**/ = el.get_num("throwvz", throwv?.[2] ?? ret.throwvz);
  ret.fronthurtact /**/ = el.get_str("fronthurtact", ret.fronthurtact);
  ret.backhurtact  /**/ = el.get_str("backhurtact", ret.backhurtact);
  ret.shaking      /**/ = el.get_num("shaking", ret.shaking)
  ret.motionless   /**/ = el.get_num("motionless", ret.motionless)

  delete_undefined(ret);
  reorder_keys(ret, cpoint_info_fields);
  return ret;
}

