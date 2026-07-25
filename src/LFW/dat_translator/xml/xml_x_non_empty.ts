import type { IXMLElement } from "../../ditto";

export function xml_2_non_empty<T>(
  el: IXMLElement,
  tag: string,
  parser: (child: IXMLElement) => T): T[] | undefined {
  return el.children_by_tag(tag).map(parser);
}
