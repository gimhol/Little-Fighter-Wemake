import type { ICpointInfo } from "../../defines";
import type { IXML, IXMLElement } from "../../ditto";

export function xml_x_cpoint(xml: IXML, i: ICpointInfo, tag: string): IXMLElement
export function xml_x_cpoint(xml: IXML, i: ICpointInfo | undefined, tag: string): IXMLElement | undefined
export function xml_x_cpoint(xml: IXML, i: ICpointInfo | undefined, tag: string): IXMLElement | undefined {
  if (!i) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("kind", i.kind);
  ret.set_arr_attr_soft("pos", [i.x, i.y, i.z]);
  ret.set_attr("injury", i.injury);
  ret.set_attr("hurtable", i.hurtable);
  ret.set_attr("decrease", i.decrease);
  ret.set_arr_attr_soft("throwv", [i.throwvx, i.throwvy, i.throwvz]);
  ret.set_attr("throwinjury", i.throwinjury);
  ret.set_attr("fronthurtact", i.fronthurtact);
  ret.set_attr("backhurtact", i.backhurtact);
  ret.set_attr("shaking", i.shaking);
  return ret
}
