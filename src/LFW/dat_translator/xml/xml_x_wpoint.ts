import type { IWpointInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";

export function xml_x_wpoint(xml: IXML, i: IWpointInfo, tag: string): IXMLElement
export function xml_x_wpoint(xml: IXML, i: IWpointInfo | undefined, tag: string): IXMLElement | undefined
export function xml_x_wpoint(xml: IXML, i: IWpointInfo | undefined, tag: string): IXMLElement | undefined {
  if (!i) return void 0;
  const w = xml.create(tag);
  w.set_attr("kind", i.kind);
  w.set_attr("pos", [i.x, i.y, i.z].join());
  w.set_attr("weaponact", i.weaponact);
  w.set_attr("attacking", i.attacking);
  w.set_arr_attr_soft("dv", [i.dvx, i.dvy, i.dvz]);
  return w
}
