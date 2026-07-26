import type { IStageObjectInfo } from "../../defines/IStageObjectInfo";
import type { IXMLElement, IXML } from "../../ditto/xml";
import { write_diff_map } from "./diff_map_utils";

/**
 * 序列化 <object>（关卡物件）
 */
export function xml_from_stage_object_info(xml: IXML, o: IStageObjectInfo): IXMLElement {
  const el = xml.create("object");

  el.set_attr("id", o.id);
  el.set_attr("id_method", o.id_method);
  el.set_attr("x", o.x);
  el.set_attr("y", o.y);
  el.set_attr("z", o.z);
  el.set_attr("act", o.act);
  el.set_attr("facing", o.facing as number);
  el.set_attr("hp", o.hp);
  el.set_attr("mp", o.mp);
  write_diff_map(el, "hp", o.hp_map as Record<number, number>);
  write_diff_map(el, "mp", o.mp_map as Record<number, number>);
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
