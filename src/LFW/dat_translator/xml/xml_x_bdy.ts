import { bdy_info_new, type IBdyInfo } from "../../defines/IBdyInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { xml_2_qube } from "./xml_x_qube";
import { xml_2_colli_action, xml_x_colli_action } from "./xml_x_colli_action";
import { xml_2_non_empty, xml_x_non_empty } from "./xml_x_non_empty";

export function xml_x_bdy(xml: IXML, b: IBdyInfo, tag: string): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("id", b.id);
  ret.set_attr("name", b.name);
  ret.set_attr("ref", b.ref);
  ret.set_attr("kind", b.kind);
  ret.set_attr("hit_flag", b.hit_flag);
  ret.set_arr_attr_soft("qube", [b.x, b.y, b.w, b.h, b.z, b.l]);
  xml_x_non_empty(xml, b.actions, "action", xml_x_colli_action, ret)
  ret.set_attr("test", b.test);
  ret.set_attr("code", b.code);
  return ret;
}

export function xml_2_bdy(el: IXMLElement): IBdyInfo {
  const ret    /**/ = bdy_info_new();
  ret.id       /**/ = el.get_str("id", ret.id);
  ret.name     /**/ = el.get_str("name", ret.name);
  ret.ref      /**/ = el.get_str("ref") ?? el.get_str("prefab_id") ?? ret.ref;
  ret.kind     /**/ = el.get_num("kind", ret.kind);
  ret.hit_flag /**/ = el.get_num("hit_flag", ret.hit_flag);
  xml_2_qube(el, ret);
  ret.actions /**/ = xml_2_non_empty(el, 'action', xml_2_colli_action)
  ret.test    /**/ = el.get_str("test", ret.test);
  ret.code    /**/ = el.get_num("code", ret.code);
  return delete_undefined(ret);
}

