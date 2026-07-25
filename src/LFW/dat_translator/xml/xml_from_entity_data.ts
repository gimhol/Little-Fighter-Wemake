import type { IEntityData } from "../../defines/IEntityData";
import type { IXML } from "../../ditto/xml";
import { xml_from_bdy_info } from "./xml_from_bdy_info";
import { xml_from_entity_info } from "./xml_from_entity_info";
import { xml_from_frame_indexes } from "./xml_from_frame_indexes";
import { xml_from_frame_info } from "./xml_from_frame_info";
import { xml_from_itr_info } from "./xml_from_itr_info";
import { xml_from_next_frame } from "./xml_from_next_frame";
export { xml_from_entity_info };


export function xml_from_entity_data(xml: IXML, data: IEntityData): string {
  const el = xml.create("entity");
  el.set_attr("id", data.id);
  el.set_attr("type", data.type);
  el.set_attr("alias_id", data.alias_id);
  el.insert(xml_from_entity_info(xml, data.base));

  // on_dead / on_exhaustion (可能为数组)
  if (data.on_dead) {
    const list = Array.isArray(data.on_dead) ? data.on_dead : [data.on_dead];
    for (const nf of list) el.insert(xml_from_next_frame(xml, nf, "on_dead"));
  }
  if (data.on_exhaustion) {
    const list = Array.isArray(data.on_exhaustion) ? data.on_exhaustion : [data.on_exhaustion];
    for (const nf of list) el.insert(xml_from_next_frame(xml, nf, "on_exhaustion"));
  }

  // bdy_prefabs
  if (data.bdy_prefabs && Object.keys(data.bdy_prefabs).length) {
    for (const [k, v] of Object.entries(data.bdy_prefabs)) {
      if (!v) continue;
      el.insert(xml_from_bdy_info(xml, v, "bdy_prefab"));
    }
  }

  // itr_prefabs
  if (data.itr_prefabs && Object.keys(data.itr_prefabs).length) {
    for (const [k, v] of Object.entries(data.itr_prefabs)) {
      if (!v) continue;
      el.insert(xml_from_itr_info(xml, v, "itr_prefab"));
    }
  }

  // frames
  for (const [fid, frame] of Object.entries(data.frames)) {
    const fEl = xml_from_frame_info(xml, fid, frame);
    if (fEl) el.insert(fEl);
  }

  // indexes
  const indexes = xml_from_frame_indexes(xml, data.indexes);
  if (indexes) el.insert(indexes);

  return el.stringify();
}
