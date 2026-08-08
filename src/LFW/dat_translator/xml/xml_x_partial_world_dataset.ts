import type { IWorldDataset } from "../../defines/IWorldDataset";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";



export function xml_x_partial_world_dataset(el: IXMLElement | undefined): Partial<IWorldDataset> | undefined;
export function xml_x_partial_world_dataset(el: IXMLElement): Partial<IWorldDataset>;
export function xml_x_partial_world_dataset(el: IXMLElement | undefined): Partial<IWorldDataset> | undefined {
  return el?.as_object();
}

export function xml_2_partial_world_dataset(xml: IXML, i: Partial<IWorldDataset> | undefined, tag: string = 'dataset'): IXMLElement | undefined {
  if (!i) return void 0;
  const pairs = Object.entries(i);
  if (!pairs.length) return void 0;
  const ret = xml.create(tag);
  for (const [k, v] of pairs)
    ret.insert(xml.from_number(v, k));
  return ret;
}
