import type { IDialogInfo } from "../../defines/IDialogInfo";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";

/**
 * 解析 <dialog> → IDialogInfo
 */
export function xml_to_dialog_info(el: IXMLElement): IDialogInfo {
  return {
    i18n: el.get_str("i18n") ?? "",
    type: el.get_str("type") as IDialogInfo["type"],
    fighter: el.get_str("fighter"),
    pause: el.bool_attr("pause"),
    close_by: el.get_str("close_by"),
    hide_stats: el.num_attr("hide_stats"),
    end_test: el.strs_attr("end_test"),
  };
}
