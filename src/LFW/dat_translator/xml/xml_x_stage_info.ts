import { stage_info_fields, stage_info_new, type IStageInfo } from "../../defines/IStageInfo";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_fields } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { xml_2_non_empty, xml_x_non_empty } from "./xml_x_non_empty";
import { xml_2_stage_phase_info, xml_x_stage_phase_info } from "./xml_x_stage_phase_info";
export { xml_2_stage_phase_info as xml_to_stage_phase_info };

export function xml_2_stage_info(el: IXMLElement): IStageInfo {
  const ret = stage_info_new();
  ret.id               /**/ = el.get_str("id", ret.id)
  ret.name             /**/ = el.get_str("name", ret.name)
  ret.bg               /**/ = el.get_str("bg", ret.bg)
  ret.phases           /**/ = xml_2_non_empty(el, "phase", xml_2_stage_phase_info) ?? []
  ret.chapter          /**/ = el.get_str("chapter", ret.chapter)
  ret.next             /**/ = el.get_str("next", ret.next)
  ret.cond_end         /**/ = el.get_str("cond_end", ret.cond_end)
  ret.act_of_goto_next /**/ = el.get_str("act_of_goto_next", ret.act_of_goto_next)
  ret.is_starting      /**/ = el.get_bool("is_starting", ret.is_starting)
  ret.starting_name    /**/ = el.get_str("starting_name", ret.starting_name)
  ret.title            /**/ = el.get_str("title", ret.title)
  ret.group            /**/ = el.get_str_arr("group", ret.group)
  delete_undefined(ret);
  reorder_fields(ret, stage_info_fields);
  return ret;
}

export function xml_x_stage_info(xml: IXML, s: IStageInfo, tag: string): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", s.id);
  el.set_attr("bg", s.bg);
  el.set_attr("name", s.name);
  el.set_attr("chapter", s.chapter);
  el.set_attr("next", s.next);
  el.set_attr("cond_end", s.cond_end);
  el.set_attr("act_of_goto_next", s.act_of_goto_next);
  el.set_attr("is_starting", s.is_starting);
  el.set_attr("starting_name", s.starting_name);
  el.set_attr("title", s.title);
  el.set_attr("group", s.group);
  xml_x_non_empty(xml, s.phases, 'phase', xml_x_stage_phase_info, el);
  return el;
}

export function xml_to_stage_info_list(el: IXMLElement): IStageInfo[] {
  if (el.tag === "stages") {
    return el.children_by_tag("stage").map(xml_2_stage_info);
  }
  // fallback: 直接就是 <stage> 元素
  if (el.tag === "stage") {
    return [xml_2_stage_info(el)];
  }
  return [];
}
