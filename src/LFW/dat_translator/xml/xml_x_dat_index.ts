import { dat_index_fields, dat_index_new, DatTypeEnum, type IDatIndex } from "../../defines/IDatIndex";
import type { IXML } from "../../ditto/xml/IXML";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_keys } from "../../fields";
import { delete_undefined } from "./delete_undefined";

export function xml_x_dat_index(xml: IXML, idx: IDatIndex, tag: string = "dat_index"): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("id", idx.id);
  el.set_attr("type", idx.type);
  el.set_attr("file", idx.file);
  el.set_attr("hash", idx.hash);
  el.set_attr("alias", idx.alias);
  el.set_attr("groups", idx.groups);
  el.set_attr("skipped", idx.skipped);
  el.set_attr("bot", idx.bot);
  return el;
}

export function xml_2_dat_index(el: IXMLElement): IDatIndex {
  const ret = dat_index_new();
  ret.id       /**/ = el.get_str("id", ret.id)
  ret.type     /**/ = el.get_str("type", ret.type) as DatTypeEnum
  ret.file     /**/ = el.get_str("file", ret.file)
  ret.hash     /**/ = el.get_str("hash")
  ret.alias    /**/ = el.get_str("alias")
  ret.groups   /**/ = el.strs_attr("groups")
  ret.skipped  /**/ = el.get_str("skipped")
  ret.bot      /**/ = el.get_str("bot")
  delete_undefined(ret);
  reorder_keys(ret, dat_index_fields);
  return ret;
}


