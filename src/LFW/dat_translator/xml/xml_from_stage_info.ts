import type { IStageInfo } from "../../defines/IStageInfo";
import type { IXML } from "../../ditto/xml";
import { xml_from_stage_phase_info } from "./xml_from_stage_phase_info";

/**
 * 序列化关卡信息列表为 XML（<stages> 包裹多个 <stage>）
 */
export function xml_from_stage_info(xml: IXML, stages: IStageInfo[]): string {
  const root = xml.create("stages");
  for (const s of stages) {
    const el = xml.create("stage");
    el.set_attr("id", s.id);
    if (s.name) el.set_attr("name", s.name);
    if (s.bg) el.set_attr("bg", s.bg);
    if (s.chapter) el.set_attr("chapter", s.chapter);
    if (s.next) el.set_attr("next", s.next);
    if (s.cond_end) el.set_attr("cond_end", s.cond_end);
    if (s.act_of_goto_next) el.set_attr("act_of_goto_next", s.act_of_goto_next);
    if (s.is_starting) el.set_attr("is_starting", s.is_starting);
    if (s.starting_name) el.set_attr("starting_name", s.starting_name);
    if (s.title) el.set_attr("title", s.title);
    if (s.group?.length) el.set_attr("group", s.group);

    for (const phase of s.phases) {
      el.insert(xml_from_stage_phase_info(xml, phase));
    }

    root.insert(el);
  }
  return root.stringify();
}
