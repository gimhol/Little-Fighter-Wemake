import { dialog_info_fields, dialog_info_new, type IDialogInfo } from "../../defines/IDialogInfo";
import type { IXML } from "../../ditto";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { reorder_fields } from "../../fields";
import { delete_undefined } from "./delete_undefined";

export function xml_2_dialog_info(el: IXMLElement): IDialogInfo {
  const ret = dialog_info_new();
  ret.type       /**/ = el.get_str("type", ret.type);
  ret.fighter    /**/ = el.get_str("fighter", ret.fighter);
  ret.pause      /**/ = el.get_bool("pause", ret.pause);
  ret.i18n       /**/ = el.get_str("i18n", ret.i18n);
  ret.close_by   /**/ = el.get_str("close_by", ret.close_by);
  ret.hide_stats /**/ = el.get_num("hide_stats", ret.hide_stats);
  ret.end_test   /**/ = el.get_str_arr("end_test", ret.end_test);
  delete_undefined(ret);
  reorder_fields(ret, dialog_info_fields);
  return ret;
}
export function xml_x_dialog_info(xml: IXML, d: IDialogInfo, tag: string): IXMLElement
export function xml_x_dialog_info(xml: IXML, d: IDialogInfo | undefined | null, tag: string): IXMLElement | undefined
export function xml_x_dialog_info(xml: IXML, d: IDialogInfo | undefined | null, tag: string): IXMLElement | undefined {
  if (!d) return void 0;
  const el = xml.create(tag);
  el.set_attr("type", d.type);
  el.set_attr("fighter", d.fighter);
  el.set_attr("pause", d.pause);
  el.set_attr("i18n", d.i18n);
  el.set_attr("close_by", d.close_by);
  el.set_attr("hide_stats", d.hide_stats);
  el.set_attr("end_test", d.end_test);
  return el;
}

