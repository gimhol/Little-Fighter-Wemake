import json5 from "json5";
import { write_file } from "./write_file";
import path from "path";
import { mkdir } from "fs/promises";
import type { IBgData, IDataLists, IEntityData, IStageInfo } from "../../../src/LFW/defines";
import { xml_from_bg_data } from "../../../src/LFW/dat_translator/xml/xml_from_bg_data";
import { xml_from_data_lists } from "../../../src/LFW/dat_translator/xml/xml_from_data_lists";
import { xml_x_entity_data } from "../../../src/LFW/dat_translator/xml/xml_x_entity_data";
import { xml_from_stage_info } from "../../../src/LFW/dat_translator/xml/xml_from_stage_info";
import { XML } from "../xml/ToolXML";

export async function write_obj_file(dst_path: string, content: any) {
  let file_content: string;
  if (dst_path.endsWith('.xml')) {
    file_content = obj_to_xml(dst_path, content);
  } else if (dst_path.endsWith('.json5')) {
    file_content = json5.stringify(content, { quote: '"', space: 2 });
  } else {
    file_content = JSON.stringify(content, null, 2);
  }
  await mkdir(path.parse(dst_path).dir, { recursive: true });
  return await write_file(dst_path, file_content);
}

function obj_to_xml(dst_path: string, content: any): string {
  if (dst_path.endsWith('.bg.xml') && content && content.type === 'background') {
    return xml_from_bg_data(XML, content as IBgData);
  }
  if (dst_path.endsWith('.obj.xml') && content && content.id !== undefined) {
    return xml_x_entity_data(XML, content as IEntityData).stringify();
  }
  if (dst_path.endsWith('.stage.xml') && Array.isArray(content)) {
    return xml_from_stage_info(XML, content as IStageInfo[]);
  }
  if (dst_path.endsWith('.index.xml') && content && 'objects' in content) {
    return xml_from_data_lists(XML, content as IDataLists).stringify();
  }
  // fallback — JSON wrapped in a root tag
  const tag = path.basename(dst_path).replace(/\.xml$/i, "");
  return `<?xml version="1.0" encoding="utf-8"?>\n<${tag}>\n  ${JSON.stringify(content, null, 2).split("\n").join("\n  ")}\n</${tag}>\n`;
}