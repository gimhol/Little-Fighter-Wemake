import { opoint_info_new, type IOpointInfo } from "../../defines/IOpointInfo";
import { opoint_multi_new, type IOpointMulti } from "../../defines/IOpointMulti";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { one_or_arr } from "./one_or_arr";
import { xml_2_t_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";

export function xml_2_opoint_multi(el: IXMLElement): IOpointMulti;
export function xml_2_opoint_multi(el: IXMLElement | undefined): IOpointMulti | undefined;
export function xml_2_opoint_multi(el: IXMLElement | undefined): IOpointMulti | undefined {
  if (!el) return void 0;
  const ret = opoint_multi_new();
  ret.type = el.get_num("type", ret.type);
  ret.skip_zero = el.get_bool("skip_zero", ret.skip_zero);
  ret.min = el.get_num("min");
  ret.max = el.get_num("max");
  return delete_undefined(ret);
}
export function xml_x_opoint_multi(xml: IXML, o: IOpointMulti, tag: string): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("type", o.type);
  ret.set_attr("skip_zero", o.skip_zero);
  ret.set_attr("min", o.min);
  ret.set_attr("max", o.max);
  return ret;
}

export function xml_x_opoint(xml: IXML, o: IOpointInfo, tag: string): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", o.id);
  el.set_attr("name", o.name);
  el.set_attr("kind", o.kind as number);
  el.set_attr("oid", o.oid);
  el.set_arr_attr_soft("pos", [o.x, o.y, o.z]);
  el.set_attr("pos_type", o.pos_type);
  xml_x_t_next_frame(xml, o.action, 'action').forEach(v => el.insert(v))
  el.set_arr_attr_soft("dv", [o.dvx, o.dvy, o.dvz]);

  if (typeof o.multi === "number") el.set_attr("multi", o.multi);
  if (typeof o.multi === "object") el.insert(xml_x_opoint_multi(xml, o.multi, "multi"));

  el.set_attr("max_hp", o.max_hp);
  el.set_attr("hp", o.hp);
  el.set_attr("max_mp", o.max_mp);
  el.set_attr("mp", o.mp);
  el.set_attr("speedz", o.speedz);
  el.set_attr("spreading", o.spreading);

  el.set_attr("ghost", o.ghost);
  el.set_attr("interval", o.interval);
  el.set_attr("interval_id", o.interval_id);
  el.set_attr("interval_mode", o.interval_mode);
  el.set_attr("motionless", o.motionless);
  el.set_attr("spreading_x", o.spreading_x?.join());
  el.set_attr("spreading_y", o.spreading_y?.join());
  el.set_attr("spreading_z", o.spreading_z?.join());
  el.set_attr("unimportant", o.unimportant);
  el.set_attr("delay", o.delay);
  el.set_arr_attr_soft("inherit_speed", [o.inherit_speed_x, o.inherit_speed_y, o.inherit_speed_z]);
  return el;
}

export function xml_2_opoint(el: IXMLElement): IOpointInfo {
  const ret = opoint_info_new();
  ret.id   /**/ = el.get_str("id");
  ret.name /**/ = el.get_str("name");
  ret.kind /**/ = el.get_num("kind", ret.kind);
  ret.oid  /**/ = one_or_arr(el.get_str_arr('oid')) ?? ''

  const pos = el.nums_attr_soft("pos")
  ret.x        /**/ = el.get_num("x", pos?.[0] ?? ret.x);
  ret.y        /**/ = el.get_num("y", pos?.[1] ?? ret.y);
  ret.z        /**/ = el.get_num("z", pos?.[2] ?? ret.z);
  ret.pos_type /**/ = el.get_num("pos_type");
  ret.action   /**/ = xml_2_t_next_frame(el.children_by_tag("action")) ?? ret.action

  const dv = el.nums_attr_soft("dv")
  ret.dvx = el.get_num("dvx", dv?.[0] ?? ret.dvx);
  ret.dvy = el.get_num("dvy", dv?.[1] ?? ret.dvy);
  ret.dvz = el.get_num("dvz", dv?.[2] ?? ret.dvz);

  ret.multi           /**/ = xml_2_opoint_multi(el.child_by_tag("multi")) ?? el.get_num("multi") ?? ret.multi;
  ret.max_hp          /**/ = el.get_num("max_hp", ret.max_hp);
  ret.hp              /**/ = el.get_num("hp", ret.hp);
  ret.max_mp          /**/ = el.get_num("max_mp", ret.max_mp);
  ret.mp              /**/ = el.get_num("mp", ret.mp);
  ret.speedz          /**/ = el.get_num("speedz", ret.speedz);
  ret.spreading       /**/ = el.get_num("spreading", ret.spreading);
  ret.ghost           /**/ = el.get_bool("ghost", ret.ghost);
  ret.interval        /**/ = el.get_num("interval", ret.interval);
  ret.interval_id     /**/ = el.get_str("interval_id", ret.interval_id);
  ret.interval_mode   /**/ = el.get_num("interval_mode", ret.interval_mode);
  ret.motionless      /**/ = el.get_num("motionless", ret.motionless);
  ret.spreading_x     /**/ = el.get_num_arr("spreading_x", ret.spreading_x);
  ret.spreading_y     /**/ = el.get_num_arr("spreading_y", ret.spreading_y);
  ret.spreading_z     /**/ = el.get_num_arr("spreading_z", ret.spreading_z);
  ret.unimportant     /**/ = el.get_num("unimportant", ret.unimportant);
  ret.delay           /**/ = el.get_num("delay", ret.delay);
  ret.inherit_speed_x /**/ = el.get_num("inherit_speed_x", ret.inherit_speed_x);
  ret.inherit_speed_y /**/ = el.get_num("inherit_speed_y", ret.inherit_speed_y);
  ret.inherit_speed_z /**/ = el.get_num("inherit_speed_z", ret.inherit_speed_z);
  return delete_undefined(ret);
}

