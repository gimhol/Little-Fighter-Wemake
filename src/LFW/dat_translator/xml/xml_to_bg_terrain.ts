import { type ITerrainInfo, terrain_info_new, terrain_info_fields } from "../../defines/ITerrainInfo";
import type { IXMLElement } from "../../ditto";
import { reorder_keys } from "../../fields";


export function xml_to_bg_terrain(el: IXMLElement): ITerrainInfo {
  const ret = terrain_info_new();
  ret.type = el.get_num('type', 0);
  ret.name = el.get_str('name');
  ret.x1 = el.get_num('x1', 0);
  ret.x2 = el.get_num('x2', 0);
  ret.z1 = el.get_num('z1', 0);
  ret.z2 = el.get_num('z2', 0);
  ret.h1 = el.get_num('h1', 0);
  ret.h2 = el.get_num('h2', 0);
  reorder_keys(ret, terrain_info_fields);
  return ret;
}
