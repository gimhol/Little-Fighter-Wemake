import type { IXML, IXMLElement } from "../../ditto";


export function xml_2_map<T>(el: IXMLElement, tag: string | string[], reader: (el: IXMLElement) => T | undefined | null): Record<string, T> | undefined {
  const ret: Record<string, T> = {};
  const tags = Array.isArray(tag) ? tag : [tag];
  for (const tag of tags) {
    for (const child of el.children_by_tag(tag)) {
      const value = reader(child);
      if (!value) continue;
      const key = child.get_str("id") ?? child.get_str("key");
      if (!key) continue;
      ret[key] = value;
    }
  }
  return Object.keys(ret).length ? ret : void 0;
}

export function xml_x_map<T, K extends string | number | symbol = string | number | symbol>(xml: IXML, map: { [x in K]?: T | undefined } | undefined, tag: string, writer: (xml: IXML, value: T, tag: string) => IXMLElement | undefined | null, parent?: IXMLElement | null) {
  const ret: IXMLElement[] = [];
  for (const [key, value] of Object.entries(map ?? {})) {
    if (value == void 0) continue;
    const el = writer(xml, value as any, tag);
    if (!el) continue;
    if (!el.get_str("id")) el.get_str("id", key);
    if (!el.get_str("key")) el.get_str("key", key);
    parent?.insert(el);
    ret.push(el);
  }
  return ret.length ? ret : void 0;
}

