import type { IStageInfo } from "../../defines/IStageInfo";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_2_stage_phase_info } from "./xml_x_stage_phase_info";
export { xml_2_stage_phase_info as xml_to_stage_phase_info };

export function xml_to_stage_info(el: IXMLElement): IStageInfo {
  return {
    id: el.attr("id") ?? "",
    name: el.get_str("name") ?? "",
    bg: el.get_str("bg") ?? "",
    phases: el.children_by_tag("phase").map(xml_2_stage_phase_info),
    chapter: el.get_str("chapter"),
    next: el.get_str("next"),
    cond_end: el.get_str("cond_end"),
    act_of_goto_next: el.get_str("act_of_goto_next"),
    is_starting: el.bool_attr("is_starting"),
    starting_name: el.get_str("starting_name"),
    title: el.get_str("title"),
    group: el.strs_attr("group"),
  };
}

/**
 * 解析 <stages> → 返回 IStageInfo 列表
 *
 * 如果 XML 根是 <stages>，迭代 <stage> 子元素；
 * 如果根就是 <stage>，回退到单元素解析
 */
export function xml_to_stage_info_list(el: IXMLElement): IStageInfo[] {
  if (el.tag === "stages") {
    return el.children_by_tag("stage").map(xml_to_stage_info);
  }
  // fallback: 直接就是 <stage> 元素
  if (el.tag === "stage") {
    return [xml_to_stage_info(el)];
  }
  return [];
}
