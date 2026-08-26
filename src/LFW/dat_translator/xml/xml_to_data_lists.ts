import type { IDataLists } from "../../defines/IDataLists";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_2_dat_index } from "./xml_x_dat_index";


export function xml_2_data_lists(el: IXMLElement): IDataLists {
  return {
    objects: el.children_by_tag("obj").map(xml_2_dat_index),
    backgrounds: el.children_by_tag("background").map(xml_2_dat_index),
    stages: el.children_by_tag("stages").map(xml_2_dat_index),
    bots: el.children_by_tag("bot").map(xml_2_dat_index),
  };
}
