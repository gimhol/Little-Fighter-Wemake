import { model_info_new, type IModelInfo, type IPictureInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";
import { xml_x_map, xml_2_map } from "./xml_x_map";

export function xml_x_model_info(xml: IXML, f: IModelInfo, tag: string) {
  const ret = xml.create(tag);
  ret.set_attr("id", f.id);
  ret.set_attr("path", f.path);
  ret.set_attr("variants", f.variants?.join());
  if (f.scale) ret.set_arr_attr_soft("scale", [f.scale.x, f.scale.y, f.scale.z]);
  return ret;
}export function xml_2_model_info(el: IXMLElement): IModelInfo {
  const ret = model_info_new();
  ret.id /**/ = el.get_str('id', ret.id);
  ret.path /**/ = el.get_str('path', ret.path);
  ret.variants /**/ = el.get_str_arr('variants', ret.variants);
  const scale = el.nums_attr_soft('scale');
  if (scale?.some(v => v != null)) {
    const s: { x?: number; y?: number; z?: number } = {};
    if (scale[0] != null) s.x = scale[0] as number;
    if (scale[1] != null) s.y = scale[1] as number;
    if (scale[2] != null) s.z = scale[2] as number;
    ret.scale = s;
  }
  return ret;
}
export function xml_2_model_info_map(el: IXMLElement, tag: string): Record<string, IPictureInfo> | undefined {
  return xml_2_map(el, tag, xml_2_model_info);
}
export function xml_x_model_info_map(xml: IXML, map: Record<string, IPictureInfo> | undefined, tag: string) {
  return xml_x_map(xml, map, tag, xml_x_model_info);
}

