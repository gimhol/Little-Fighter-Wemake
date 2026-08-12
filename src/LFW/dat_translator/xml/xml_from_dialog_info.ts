import type { IDialogInfo } from "../../defines/IDialogInfo";
import type { IXMLElement, IXML } from "../../ditto/xml";

/**
 * 序列化 <dialog>
 */
export function xml_x_dialog_info(xml: IXML, d: IDialogInfo, tag = 'dialog'): IXMLElement {
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
