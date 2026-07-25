import { EntityEnum } from "../../defines/EntityEnum";
import { entity_data_new, type IEntityData, type TBdyPrefabs, type TItrPrefabs } from "../../defines/IEntityData";
import type { IFrameInfo } from "../../defines/IFrameInfo";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_2_frame } from "./xml_2_frame";
import { xml_to_entity_info } from "./xml_to_entity_info";
import { xml_to_frame_indexes } from "./xml_to_frame_indexes";
import { xml_2_bdy } from "./xml_x_bdy";
import { xml_2_itr } from "./xml_x_itr";
import { xml_2_t_next_frame } from "./xml_x_next_frame";


export function xml_to_entity_data(el: IXMLElement | undefined): IEntityData {
  const ret: IEntityData = entity_data_new();
  if (!el) return ret;

  ret.id = el.get_str("id", ret.id);
  ret.type = el.get_num("type", ret.type) as EntityEnum;
  ret.alias_id = el.get_str("alias_id", ret.alias_id);
  ret.base = xml_to_entity_info(el.child_by_tag("base")!);

  ret.on_dead = xml_2_t_next_frame(el.children_by_tag("on_dead"));
  if (!ret.on_dead) delete ret.on_dead;

  ret.on_exhaustion = xml_2_t_next_frame(el.children_by_tag("on_exhaustion"));
  if (!ret.on_exhaustion) delete ret.on_exhaustion;

  ret.indexes = xml_to_frame_indexes(el.child_by_tag('indexes'))
  if (ret.indexes) delete ret.indexes

  const frames: Record<string, IFrameInfo> = {};
  for (const child of el.children_by_tag("frame")) {
    const fi = xml_2_frame(child);
    frames[fi.id] = fi;
  }

  const bdy: TBdyPrefabs = {};
  for (const tag of ["bdy_prefab", "bdy"]) {
    for (const child of el.children_by_tag(tag)) {
      const prefab = xml_2_bdy(child);
      prefab.id = child.get_str("id", "");
      bdy[prefab.id] = prefab;
    }
  }
  if (Object.keys(bdy).length) ret.bdy_prefabs = bdy;

  const itr: TItrPrefabs = {};
  for (const tag of ["itr_prefab", "itr"]) {
    for (const child of el.children_by_tag(tag)) {
      const prefab = xml_2_itr(child);
      prefab.id = child.get_str("id", "");
      itr[prefab.id] = prefab;
    }
  }
  
  if (Object.keys(itr).length) ret.itr_prefabs = itr;
  ret.processed = el.get_bool("processed", ret.processed);
  return ret;
}


