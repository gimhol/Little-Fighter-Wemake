import type { TNextFrame } from "../../defines";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_2_next_frame } from "./xml_x_next_frame";

export function xml_to_key_collection(el: IXMLElement, tag: string): Record<string, TNextFrame> | undefined {
  const ret: Record<string, TNextFrame> = {};
  for (const child of el.children_by_tag(tag)) {
    const key = child.get_str('key');
    if (!key) continue;
    ret[key] = xml_2_next_frame(child);
  }

  return Object.keys(ret).length ? ret : void 0;
}
