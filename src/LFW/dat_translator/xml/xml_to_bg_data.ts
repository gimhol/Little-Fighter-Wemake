import { bg_data_info_fields, bg_data_new, type IBgData } from "../../defines/IBgData";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_keys } from "../../fields";
import { xml_to_bg_info } from "./xml_to_bg_info";
import { xml_to_bg_layer } from "./xml_to_bg_layer";
import { xml_to_bg_terrain } from "./xml_to_bg_terrain";

export function xml_to_bg_data(el: IXMLElement): IBgData {
  const ret = bg_data_new();
  const id = el.get_str("id");
  if (id) ret.id = id;

  for (const child of el.children_by_tag("base")) {
    Object.assign(ret.base, xml_to_bg_info(child, ret.id));
  }

  const dsEl = el.child_by_tag("dataset");
  if (dsEl) ret.dataset = dsEl.as_object() as Partial<IBgData["dataset"]>;

  for (const child of el.children_by_tag("layer")) {
    ret.layers ??= [];
    ret.layers.push(xml_to_bg_layer(child, ret.layers.length));
  }

  for (const child of el.children_by_tag('terrain')) {
    ret.terrain ??= []
    ret.terrain.push(xml_to_bg_terrain(child));
  }

  reorder_keys(ret, bg_data_info_fields);
  return ret;
}
