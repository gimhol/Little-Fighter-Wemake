import { bg_data_fields, bg_data_new, type IBgData } from "../../defines/IBgData";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_keys } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { merge_by_tag } from "./merge_by_tag";
import { non_empty } from "./one_or_arr";
import { xml_to_bg_terrain } from "./xml_to_bg_terrain";
import { xml_2_bg_info, xml_x_bg_info } from "./xml_x_bg_info";
import { xml_2_bg_layer, xml_x_bg_layer } from "./xml_x_bg_layer";
import { xml_2_partial_world_dataset, xml_x_partial_world_dataset } from "./xml_x_partial_world_dataset";

export function xml_2_bg_data(el: IXMLElement): IBgData {
  const ret = bg_data_new();
  ret.id = el.get_str("id") ?? ret.id;
  merge_by_tag(el, 'base', xml_2_bg_info, ret.base);
  ret.dataset = merge_by_tag(el, 'dataset', xml_x_partial_world_dataset);

  for (const child of el.children_by_tag("layer")) {
    ret.layers ??= [];
    ret.layers.push(xml_2_bg_layer(child, ret.layers.length));
  }

  for (const child of el.children_by_tag('terrain')) {
    ret.terrain ??= []
    ret.terrain.push(xml_to_bg_terrain(child));
  }
  delete_undefined(ret);
  reorder_keys(ret, bg_data_fields);
  return ret;
}

export function xml_x_bg_data(xml: IXML, data: IBgData, tag: string = "background"): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("id", data.id);
  ret.insert(xml_x_bg_info(xml, data.base, "base"));
  ret.insert(xml_2_partial_world_dataset(xml, data.dataset));
  data.layers?.forEach(l => ret.insert(xml_x_bg_layer(xml, l, "layer")))
  return ret;
}

