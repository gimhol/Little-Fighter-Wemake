import type { IWorldDataset } from "../../defines/IWorldDataset";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";



export function xml_2_partial_world_dataset(el: IXMLElement | undefined): Partial<IWorldDataset> | undefined;
export function xml_2_partial_world_dataset(el: IXMLElement): Partial<IWorldDataset>;
export function xml_2_partial_world_dataset(el: IXMLElement | undefined): Partial<IWorldDataset> | undefined {
  return el?.as_object();
}

export function xml_x_partial_world_dataset(xml: IXML, i: Partial<IWorldDataset> | undefined, tag: string): IXMLElement | undefined {
  if (!i) return void 0;
  if (!Object.keys(i).length) return void 0;
  return xml.from_object(i, tag);
}
