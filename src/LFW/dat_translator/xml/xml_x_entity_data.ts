import type { EntityEnum } from "../../defines";
import { entity_data_new, type IEntityData } from "../../defines/IEntityData";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { xml_2_frame_indexes } from "./xml_x_frame_indexes";
import { xml_2_bdy, xml_x_bdy } from "./xml_x_bdy";
import { xml_2_entity_info, xml_x_entity_info } from "./xml_x_entity_info";
import { xml_2_frame, xml_x_frame } from "./xml_x_frame";
import { xml_x_frame_indexes } from "./xml_x_frame_indexes";
import { xml_2_itr, xml_x_itr } from "./xml_x_itr";
import { xml_2_map, xml_x_map } from "./xml_x_map";
import { xml_2_t_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";

export function xml_x_entity_data(xml: IXML, data: IEntityData): IXMLElement {
  const el = xml.create("entity");
  el.set_attr("id", data.id);
  el.set_attr("type", data.type);
  el.set_attr("alias_id", data.alias_id);
  el.insert(xml_x_entity_info(xml, data.base, "base"));
  xml_x_t_next_frame(xml, data.on_dead, 'on_dead', el)
  xml_x_t_next_frame(xml, data.on_exhaustion, 'on_exhaustion', el)
  xml_x_map(xml, data.bdy_prefabs, "bdy", xml_x_bdy, el)
  xml_x_map(xml, data.itr_prefabs, "itr", xml_x_itr, el)
  xml_x_map(xml, data.frames, "frame", xml_x_frame, el)
  el.insert(xml_x_frame_indexes(xml, data.indexes, "indexes"));
  el.set_attr("processed", data.processed || void 0);
  return el;
}

export function xml_2_entity_data(el: IXMLElement): IEntityData
export function xml_2_entity_data(el: IXMLElement | undefined): IEntityData | undefined
export function xml_2_entity_data(el: IXMLElement | undefined): IEntityData | undefined {
  if (!el) return void 0;
  const ret         /**/ = entity_data_new();
  ret.id            /**/ = el.get_str("id", ret.id);
  ret.type          /**/ = el.get_num("type", ret.type) as EntityEnum;
  ret.alias_id      /**/ = el.get_str("alias_id", ret.alias_id);
  ret.base          /**/ = xml_2_entity_info(el.child_by_tag("base")!);
  ret.on_dead       /**/ = xml_2_t_next_frame(el.children_by_tag("on_dead"));
  ret.on_exhaustion /**/ = xml_2_t_next_frame(el.children_by_tag("on_exhaustion"));
  ret.indexes       /**/ = xml_2_frame_indexes(el.child_by_tag('indexes'));
  ret.frames        /**/ = xml_2_map(el, "frame", xml_2_frame) ?? {}
  ret.bdy_prefabs   /**/ = xml_2_map(el, ["bdy_prefab", "bdy"], xml_2_bdy)
  ret.itr_prefabs   /**/ = xml_2_map(el, ["itr_prefab", "itr"], xml_2_itr)
  ret.processed     /**/ = el.get_bool("processed", ret.processed) || void 0;
  return delete_undefined(ret);
}

