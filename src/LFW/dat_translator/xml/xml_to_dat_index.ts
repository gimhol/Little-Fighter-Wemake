import { DatTypeEnum, type IDatIndex } from "../../defines/IDatIndex";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";

/**
 * 解析 <dat_index>
 */
export function xml_to_dat_index(el: IXMLElement): IDatIndex {
  return {
    id: el.get_str("id") ?? "",
    type: (el.get_str("type") ?? "") as DatTypeEnum,
    file: el.get_str("file") ?? "",
    hash: el.get_str("hash"),
    alias: el.get_str("alias"),
    groups: el.strs_attr("groups"),
    skipped: el.get_str("skipped"),
    bot: el.get_str("bot"),
  };
}
