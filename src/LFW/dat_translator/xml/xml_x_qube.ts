import type { IQube } from "../../defines/IQube";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { delete_undefined } from "./delete_undefined";

export function xml_2_qube(el: IXMLElement, out: IQube): IQube;
export function xml_2_qube(el: IXMLElement, out?: Partial<IQube>): Partial<IQube>;
export function xml_2_qube(el: IXMLElement, out: Partial<IQube> = {}): Partial<IQube> {
  const a = el.nums_attr_soft("rect");
  const b = el.nums_attr_soft("qube");
  const temp: Partial<IQube> = {}
  temp.x = el.get_num("x", a?.[0] ?? b?.[0] ?? out.x);
  temp.y = el.get_num("y", a?.[1] ?? b?.[1] ?? out.y);
  temp.w = el.get_num("w", a?.[2] ?? b?.[2] ?? out.w);
  temp.h = el.get_num("h", a?.[3] ?? b?.[3] ?? out.h);
  temp.z = el.get_num("z", a?.[4] ?? b?.[4] ?? out.z);
  temp.l = el.get_num("l", a?.[5] ?? b?.[5] ?? out.l);
  delete_undefined(out);
  Object.assign(out, temp);
  return out;
}
