import type { IXML, IXMLElement } from "../../ditto";

export function xml_2_non_empty<T>(
  el: IXMLElement,
  tag: string,
  parser: (child: IXMLElement) => T): T[] | undefined {
  return el.children_by_tag(tag).map(parser);
}

export function xml_x_non_empty<T>(xml: IXML, arr: T[] | undefined, tag: string, parser: (xml: IXML, v: T, tag: string) => IXMLElement | undefined | null) {
  const ret: IXMLElement[] = [];
  if (!arr?.length) return void 0;
  for (const a of arr) {
    const e = parser(xml, a, tag)
    if (e) ret.push(e)
  }
  return ret;
}


