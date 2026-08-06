import { type ITerrainInfo, terrain_info_new, terrain_info_fields } from "../../defines/ITerrainInfo";
import type { IXMLElement } from "../../ditto";
import { reorder_keys } from "../../fields";


export function xml_to_bg_terrain(el: IXMLElement): ITerrainInfo {
  const ret = terrain_info_new();
  ret.type = el.get_num('type', ret.type);
  ret.name = el.get_str('name');
  ret.x1 = el.get_num('x1', ret.x1);
  ret.x2 = el.get_num('x2', ret.x2);
  ret.z1 = el.get_num('z1', ret.z1);
  ret.z2 = el.get_num('z2', ret.z2);
  ret.h1 = el.get_num('h1', ret.h1);
  ret.h2 = el.get_num('h2', ret.h2);
  reorder_keys(ret, terrain_info_fields);
  return ret;
}
