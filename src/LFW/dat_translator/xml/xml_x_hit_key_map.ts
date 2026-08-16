import type { TNextFrame } from "../../defines";
import type { IHitKeyMap } from "../../defines/IHitKeyMap";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { xml_2_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";

export function xml_x_hit_key_map(xml: IXML, map: IHitKeyMap | undefined | null, tag: string): IXMLElement[] | undefined {
  if (!map) return void 0;
  const ret: IXMLElement[] = []
  for (const key in map) {
    const els = xml_x_t_next_frame(xml, (map as any)[key], tag)
    for (const el of els) {
      el.set_attr('key', key)
      ret.push(el)
    }
  }
  return ret.length ? ret : void 0;
}

export function xml_2_hit_key_map(el: IXMLElement, tag: string): Record<string, TNextFrame> | undefined {
  const ret: Record<string, TNextFrame> = {};
  for (const child of el.children_by_tag(tag)) {
    const key = child.get_str('key');
    if (!key) continue;
    ret[key] = xml_2_next_frame(child);
  }
  return Object.keys(ret).length ? ret : void 0;
}

