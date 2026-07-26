import type { IWorldDataset } from "../../defines/IWorldDataset";
import { world_dataset_fields } from "../../defines/IWorldDataset";
import type { IXML, IXMLElement } from "../../ditto/xml";

/**
 * 将 IWorldDataset 字段写入 <dataset> 元素
 */
export function xml_from_world_dataset(xml: IXML, data: Partial<IWorldDataset>, tag: string = "dataset"): IXMLElement | undefined {
  const item: [string, unknown][] = [];
  for (const k of world_dataset_fields.keys()) {
    const v = data[k];
    if (v !== void 0) item.push([k, v]);
  }
  if (!item.length) return void 0;
  return xml.from_object(Object.fromEntries(item), tag);
}
