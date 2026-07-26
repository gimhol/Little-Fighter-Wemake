import type { IEntityData } from "../../defines/IEntityData";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { xml_x_bdy } from "./xml_x_bdy";
import { xml_x_entity_info } from "./xml_x_entity_info";
import { xml_x_frame_indexes } from "./xml_x_frame_indexes";
import { xml_x_frame } from "./xml_x_frame";
import { xml_x_itr } from "./xml_x_itr";
import { xml_x_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";
import { xml_x_map } from "./xml_x_map";
export { xml_x_entity_info as xml_from_entity_info };


export function xml_x_entity_data(xml: IXML, data: IEntityData): IXMLElement {
  const el = xml.create("entity");
  el.set_attr("id", data.id);
  el.set_attr("type", data.type);
  el.set_attr("alias_id", data.alias_id);
  el.insert(xml_x_entity_info(xml, data.base, "base"));
  xml_x_t_next_frame(xml, data.on_dead, 'on_dead').forEach(v => el.insert(v))
  xml_x_t_next_frame(xml, data.on_exhaustion, 'on_exhaustion').forEach(v => el.insert(v))
  xml_x_map(xml, data.bdy_prefabs, "bdy_prefab", xml_x_bdy)?.forEach(v => el.insert(v))
  xml_x_map(xml, data.itr_prefabs, "itr_prefab", xml_x_itr)?.forEach(v => el.insert(v))
  xml_x_map(xml, data.frames, "frame", xml_x_frame)?.forEach(v => el.insert(v))
  el.insert(xml_x_frame_indexes(xml, data.indexes, "indexes"));
  el.set_attr("processed", data.processed);

  return el;
}
