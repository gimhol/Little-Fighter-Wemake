import type { IXML, IXMLElement } from "../../ditto";

export interface IElementParser<T> {
  (element: IXMLElement, index: number, array: IXMLElement[]): T
}
export interface IElementCreator<T> {
  (xml: IXML, data: T, tag: string): IXMLElement | undefined | null
}
export function xml_2_arr<T>(el: IXMLElement, tag: string, parser: IElementParser<T>): T[] {
  return el.children_by_tag(tag).map(parser);
}
export function xml_2_non_empty<T>(el: IXMLElement, tag: string, parser: IElementParser<T>): T[] | undefined {
  const ret = xml_2_arr(el, tag, parser);
  return ret.length ? ret : void 0;
}

export function xml_x_non_empty<T>(
  xml: IXML,
  arr: T[] | undefined | null,
  tag: string,
  creator: IElementCreator<T>,
  parent?: IXMLElement
): IXMLElement[] | undefined {
  const ret: IXMLElement[] = [];
  if (!arr?.length) return void 0;
  for (const a of arr) {
    const e = creator(xml, a, tag)
    if (e) ret.push(e)
  }
  if (parent) ret.forEach(v => parent.insert(v))
  return ret;
}


