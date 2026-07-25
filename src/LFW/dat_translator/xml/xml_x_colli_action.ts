import type { TAction } from "../../defines/actions/TAction";
import type { IXML } from "../../ditto/xml/IXML";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";

export function xml_x_colli_action(xml: IXML, action: TAction, tag: string): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("type", action.type);
  ret.set_attr("test", action.test);
  ret.set_attr("pretest", action.pretest);
  const data = xml.from_object(action.data, "data");
  ret.insert(data);
  return ret;
}

export function xml_2_colli_action(el: IXMLElement): TAction {
  const ret: any = {}
  ret.test    /**/ = el.get_str("test");
  ret.pretest /**/ = el.get_bool("pretest");
  ret.type    /**/ = el.get_str("type");
  ret.data    /**/ = el.get_obj("data");
  return ret;
}