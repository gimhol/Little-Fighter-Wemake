import { bg_data_fields, bg_data_new, type IBgData } from "../../defines/IBgData";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_keys } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { merge_by_tag } from "./merge_by_tag";
import { xml_to_bg_terrain } from "./xml_to_bg_terrain";
import { xml_2_bg_info, xml_x_bg_info } from "./xml_x_bg_info";
import { xml_2_bg_layer, xml_x_bg_layer } from "./xml_x_bg_layer";
import { xml_2_non_empty, xml_x_non_empty } from "./xml_x_non_empty";
import { xml_2_partial_world_dataset, xml_x_partial_world_dataset } from "./xml_x_partial_world_dataset";

export function xml_2_bg_data(el: IXMLElement): IBgData {
  const ret = bg_data_new();
  ret.id       /**/ = el.get_str("id", ret.id);
  ret.alias_id /**/ = el.get_str("alias_id", ret.alias_id);
  ret.type     /**/ = "background";
  ret.base     /**/ = merge_by_tag(el, 'base', xml_2_bg_info, ret.base);
  ret.dataset  /**/ = merge_by_tag(el, 'dataset', xml_2_partial_world_dataset, ret.dataset);
  ret.layers   /**/ = xml_2_non_empty(el, "layer", xml_2_bg_layer);
  ret.terrain  /**/ = xml_2_non_empty(el, "terrain", xml_to_bg_terrain);

  delete_undefined(ret);
  reorder_keys(ret, bg_data_fields);
  return ret;
}

export function xml_x_bg_data(xml: IXML, data: IBgData, tag: string = "background"): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("id", data.id);
  ret.insert(xml_x_bg_info(xml, data.base, "base"));
  ret.insert(xml_x_partial_world_dataset(xml, data.dataset, 'dataset'));
  xml_x_non_empty(xml, data.layers, "layer", xml_x_bg_layer, ret);
  return ret;
}

