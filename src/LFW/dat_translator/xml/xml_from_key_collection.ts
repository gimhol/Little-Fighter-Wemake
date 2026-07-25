import type { IHoldKeyCollection } from "../../defines/IHoldKeyCollection";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { xml_from_t_next_frame } from "./xml_from_next_frame";

export function xml_from_key_collection(xml: IXML, collection: IHoldKeyCollection, tag: string): IXMLElement[] {
  const ret: IXMLElement[] = []
  for (const key in collection) {
    const els = xml_from_t_next_frame(xml, (collection as any)[key], tag)
    for (const el of els) {
      el.set_attr('key', key)
      ret.push(el)
    }
  }
  return ret;
}
