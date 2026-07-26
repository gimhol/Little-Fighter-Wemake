import type { IDatIndex } from "../../defines/IDatIndex";
import type { IXMLElement, IXML } from "../../ditto/xml";

/**
 * 序列化 <dat_index>（标签名可由 tag 参数覆盖）
 */
export function xml_from_dat_index(xml: IXML, idx: IDatIndex, tag: string = "dat_index"): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", idx.id);
  el.set_attr("type", idx.type);
  el.set_attr("file", idx.file);
  if (idx.hash) el.set_attr("hash", idx.hash);
  if (idx.alias) el.set_attr("alias", idx.alias);
  if (idx.groups?.length) el.set_attr("groups", idx.groups);
  if (idx.skipped) el.set_attr("skipped", idx.skipped);
  if (idx.bot) el.set_attr("bot", idx.bot);
  return el;
}
