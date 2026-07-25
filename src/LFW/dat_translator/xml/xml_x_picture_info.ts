import { picture_info_new, type IPictureInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";
import { xml_x_map, xml_2_map } from "./xml_x_map";

export function xml_2_picture_info(el: IXMLElement): IPictureInfo {
  const ret = picture_info_new();
  ret.id       /**/ = el.get_str('id', ret.id)
  ret.path     /**/ = el.get_str('path', ret.path)
  ret.variants /**/ = el.get_str_arr('variants', ret.variants)
  ret.row      /**/ = el.get_num('row', ret.row)
  ret.col      /**/ = el.get_num('col', ret.col)
  ret.cell_w   /**/ = el.get_num('cell_w', ret.cell_w)
  ret.cell_h   /**/ = el.get_num('cell_h', ret.cell_h)
  return ret;
}
export function xml_x_picture_info(xml: IXML, f: IPictureInfo, tag: string) {
  const ret = xml.create(tag);
  ret.set_attr("id", f.id);
  ret.set_attr("path", f.path);
  ret.set_attr("variants", f.variants?.join());
  ret.set_attr("row", f.row);
  ret.set_attr("col", f.col);
  ret.set_attr("cell_w", f.cell_w);
  ret.set_attr("cell_h", f.cell_h);
  return ret;
}

export function xml_2_picture_info_map(el: IXMLElement, tag: string): Record<string, IPictureInfo> | undefined {
  return xml_2_map(el, tag, xml_2_picture_info)
}
export function xml_x_picture_info_map(xml: IXML, map: Record<string, IPictureInfo> | undefined, tag: string) {
  return xml_x_map(xml, map, tag, xml_x_picture_info);
}
