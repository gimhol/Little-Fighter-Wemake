import { model_info_new, type IModelInfo, type IPictureInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";
import { xml_x_map, xml_2_map } from "./xml_x_map";

export function xml_x_model_info(xml: IXML, f: IModelInfo, tag: string) {
  const ret = xml.create(tag);
  ret.set_attr("id", f.id);
  ret.set_attr("path", f.path);
  ret.set_attr("variants", f.variants?.join());
  return ret;
}export function xml_2_model_info(el: IXMLElement): IModelInfo {
  const ret = model_info_new();
  ret.id /**/ = el.get_str('id', ret.id);
  ret.path /**/ = el.get_str('path', ret.path);
  ret.variants /**/ = el.get_str_arr('variants', ret.variants);
  return ret;
}
export function xml_2_model_info_map(el: IXMLElement, tag: string): Record<string, IPictureInfo> | undefined {
  return xml_2_map(el, tag, xml_2_model_info);
}
export function xml_x_model_info_map(xml: IXML, map: Record<string, IPictureInfo> | undefined, tag: string) {
  return xml_x_map(xml, map, tag, xml_x_model_info);
}

