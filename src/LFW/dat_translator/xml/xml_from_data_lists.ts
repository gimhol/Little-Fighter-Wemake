import type { IDataLists } from "../../defines/IDataLists";
import type { IDatIndex } from "../../defines/IDatIndex";
import type { IDirectorIndex } from "../../defines/IDirectorIndex";
import type { IXMLElement, IXML } from "../../ditto/xml";
import { xml_x_dat_index } from "./xml_x_dat_index";
import { xml_x_director_index } from "./xml_x_director";

/**
 * 序列化整个数据索引列表为 XML
 *
 * <data>
 *    
 *   // 读取多个obj，IDataLists.objects
 *   <obj .../>
 *   <obj .../>
 *   <obj .../>
 *   <obj .../>
 * 
 * 
 *   // 读取多个background，成为IDataLists.backgrounds
 *   <background .../>
 *   <background .../>
 *   <background .../>
 *   <background .../>
 *   <background .../>
 * 
 *   // 读取多个stages，成为IDataLists.stages
 *   <stages .../>
 *   <stages .../>
 *   <stages .../>
 *   <stages .../>
 *   <stages .../>
 * 
 *   // 读取多个bots，成为IDataLists.bots
 *   <bot .../>
 *   <bot .../>
 * </data>
 */
export function xml_from_data_lists(xml: IXML, lists: IDataLists): IXMLElement {
  const root = xml.create("data");

  const groups: [string, (IDatIndex | IDirectorIndex)[] | undefined][] = [
    ["obj", lists.objects],
    ["background", lists.backgrounds],
    ["stages", lists.stages],
    ["bot", lists.bots],
    ["moves", lists.moves],
    ["directors", lists.directors],
  ];

  for (const [tag, items] of groups) {
    if (!items?.length) continue;
    for (const item of items) {
      root.insert(tag === "directors"
        ? xml_x_director_index(xml, item as IDirectorIndex, tag)
        : xml_x_dat_index(xml, item as IDatIndex, tag));
    }
  }

  return root;
}
