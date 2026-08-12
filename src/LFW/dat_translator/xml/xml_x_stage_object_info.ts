import { stage_object_info_fields, stage_object_info_new, type IStageObjectInfo } from "../../defines/IStageObjectInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { reorder_keys } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { xml_2_difficulty_map, xml_x_difficulty_map } from "./xml_x_difficulty_map";

export function xml_x_stage_object_info(xml: IXML, o: IStageObjectInfo, tag: string): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", o.id);
  el.set_attr("id_method", o.id_method);
  el.set_attr("x", o.x);
  el.set_attr("y", o.y);
  el.set_attr("z", o.z);
  el.set_attr("act", o.act);
  el.set_attr("facing", o.facing as number);
  el.set_attr("hp", o.hp);
  el.set_attr("mp", o.mp);
  xml_x_difficulty_map(el, "hp", o.hp_map);
  xml_x_difficulty_map(el, "mp", o.mp_map);
  el.set_attr("times", o.times);
  el.set_attr("ratio", o.ratio);
  el.set_attr("is_boss", o.is_boss);
  el.set_attr("is_soldier", o.is_soldier);
  el.set_attr("reserve", o.reserve);
  el.set_attr("join", o.join);
  el.set_attr("join_team", o.join_team);
  el.set_attr("outline_color", o.outline_color);
  return el;
}

export function xml_2_stage_object_info(el: IXMLElement): IStageObjectInfo {
  const ret = stage_object_info_new();
  ret.id            /**/ = el.get_str_arr("id", ret.id);
  ret.id_method     /**/ = el.get_str("id_method", ret.id_method);
  ret.x             /**/ = el.get_num("x", ret.x);
  ret.y             /**/ = el.get_num("y", ret.y);
  ret.z             /**/ = el.get_num("z", ret.z);
  ret.act           /**/ = el.get_str("act", ret.act);
  ret.facing        /**/ = el.get_num("facing", ret.facing);
  ret.hp            /**/ = el.get_num("hp", ret.hp);
  ret.mp            /**/ = el.get_num("mp", ret.mp);
  ret.hp_map        /**/ = xml_2_difficulty_map(el, "hp");
  ret.mp_map        /**/ = xml_2_difficulty_map(el, "mp");
  ret.times         /**/ = el.get_num("times", ret.times);
  ret.ratio         /**/ = el.get_num("ratio", ret.ratio);
  ret.is_boss       /**/ = el.get_bool("is_boss", ret.is_boss);
  ret.is_soldier    /**/ = el.get_bool("is_soldier", ret.is_soldier);
  ret.reserve       /**/ = el.get_num("reserve", ret.reserve);
  ret.join          /**/ = el.get_num("join", ret.join);
  ret.join_team     /**/ = el.get_str("join_team", ret.join_team);
  ret.outline_color /**/ = el.get_str("outline_color", ret.outline_color);
  delete_undefined(ret);
  reorder_keys(ret, stage_object_info_fields);
  return ret;
}

