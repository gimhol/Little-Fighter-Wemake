import type { IStageInfo } from "../../defines/IStageInfo";
import type { IXML } from "../../ditto/xml";
import { xml_x_stage_info } from "./xml_x_stage_info";

/**
 * 序列化关卡信息列表为 XML（<stages> 包裹多个 <stage>）
 */
export function xml_from_stage_info_list(xml: IXML, stages: IStageInfo[]): string {
  const root = xml.create("stages");
  for (const s of stages) {
    root.insert(xml_x_stage_info(xml, s, 'stage'));
  }
  return root.stringify();
}

