import { bg_data_info_fields, bg_data_new, type IBgData } from "../../defines/IBgData";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_keys } from "../../fields";
import { xml_to_bg_info } from "./xml_to_bg_info";
import { xml_to_bg_layer } from "./xml_to_bg_layer";

export function xml_to_bg_data(el: IXMLElement): IBgData {
  const ret = bg_data_new();
  const id = el.get_str("id");
  if (id) ret.id = id;

  // 允许多个 base 标签，同名属性后者覆盖前者
  for (const child of el.children_by_tag("base")) {
    Object.assign(ret.base, xml_to_bg_info(child, ret.id));
  }

  // <dataset> 可选元素
  const dsEl = el.child_by_tag("dataset");
  if (dsEl) ret.dataset = dsEl.as_object() as Partial<IBgData["dataset"]>;

  // <layer> 子元素
  for (const child of el.children_by_tag("layer")) {
    ret.layers ??= [];
    ret.layers.push(xml_to_bg_layer(child, ret.layers.length));
  }

  reorder_keys(ret, bg_data_info_fields);
  return ret;
}
