import type { EntityEnum } from "../../defines";
import { entity_data_fields, entity_data_new, type IEntityData } from "../../defines/IEntityData";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { reorder_fields } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { xml_2_bdy, xml_x_bdy } from "./xml_x_bdy";
import { xml_2_entity_info, xml_x_entity_info } from "./xml_x_entity_info";
import { xml_2_frame, xml_x_frame } from "./xml_x_frame";
import { xml_2_frame_indexes, xml_x_frame_indexes } from "./xml_x_frame_indexes";
import { xml_2_hit_key_map, xml_x_hit_key_map } from "./xml_x_hit_key_map";
import { xml_2_itr, xml_x_itr } from "./xml_x_itr";
import { xml_2_map, xml_x_map } from "./xml_x_map";
import { xml_2_t_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";

export function xml_x_entity_data(xml: IXML, data: IEntityData, tag: string = 'entity'): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("id", data.id);
  ret.set_attr("type", data.type);
  ret.set_attr("alias_id", data.alias_id);
  ret.insert(xml_x_entity_info(xml, data.base, "base"));
  xml_x_t_next_frame(xml, data.on_dead, 'on_dead', ret)
  xml_x_t_next_frame(xml, data.on_exhaustion, 'on_exhaustion', ret)
  xml_x_map(xml, data.bdy_prefabs, "bdy", xml_x_bdy, ret)
  xml_x_map(xml, data.itr_prefabs, "itr", xml_x_itr, ret)
  ret.insert(xml_x_frame_indexes(xml, data.indexes, "indexes"));
  ret.set_attr("processed", data.processed);
  xml_x_hit_key_map(xml, data.pre_hitkeys, 'pre_hitkey')?.forEach(el => ret.insert(el));
  xml_x_hit_key_map(xml, data.post_hitkeys, 'post_hitkey')?.forEach(el => ret.insert(el));
  xml_x_map(xml, data.frames, "frame", xml_x_frame, ret);
  return ret;
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
  ret.bdy_prefabs   /**/ = xml_2_map(el, ["bdy_prefab", "bdy"], xml_2_bdy)
  ret.itr_prefabs   /**/ = xml_2_map(el, ["itr_prefab", "itr"], xml_2_itr)
  ret.processed     /**/ = el.get_bool("processed", ret.processed) || void 0;
  ret.pre_hitkeys   /**/ = xml_2_hit_key_map(el, 'pre_hitkey')
  ret.post_hitkeys  /**/ = xml_2_hit_key_map(el, 'post_hitkey')
  ret.frames        /**/ = xml_2_map(el, "frame", xml_2_frame) ?? {};
  delete_undefined(ret);
  reorder_fields(ret, entity_data_fields);
  return ret;
}

