import type { IXML, IXMLElement } from "../../ditto";


export function xml_2_map<T>(el: IXMLElement, tag: string, reader: (el: IXMLElement) => T | undefined | null): Record<string, T> | undefined {
  const ret: Record<string, T> = {};
  for (const child of el.children_by_tag(tag)) {
    const value = reader(child);
    if (!value) continue;
    const key = child.get_str("id") ?? child.get_str("key");
    if (!key) continue;
    ret[key] = value;
  }
  return Object.keys(ret).length ? ret : void 0;
}export function xml_x_map<T>(xml: IXML, map: Record<string, T> | undefined, tag: string, writer: (xml: IXML, value: T, tag: string) => IXMLElement | undefined | null) {
  const ret: IXMLElement[] = [];
  for (const [key, value] of Object.entries(map ?? {})) {
    const el = writer(xml, value, tag);
    if (!el) continue;
    if (!el.get_str("id")) el.get_str("id", key);
    if (!el.get_str("key")) el.get_str("key", key);
    ret.push(el);
  }
  return ret.length ? ret : void 0;
}

