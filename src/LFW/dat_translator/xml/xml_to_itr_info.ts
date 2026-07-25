import { type IItrInfo, itr_info_new } from "../../defines/IItrInfo";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_2_colli_action } from "./xml_to_colli_action";
import { xml_to_t_next_frame } from "./xml_to_next_frame";
import { xml_to_qube } from "./xml_to_qube";
import { xml_to_velocity_info } from "./xml_to_velocity_info";

export function xml_to_itr_info(el: IXMLElement): IItrInfo {
  const ret = itr_info_new();
  ret.id = el.get_str("id", ret.id);
  ret.name = el.get_str("name", ret.name);
  ret.ref = el.get_str("ref") ?? el.get_str("prefab_id") ?? ret.ref;
  ret.hit_flag = el.get_num("hit_flag", ret.hit_flag);
  ret.motionless = el.get_num("motionless", ret.motionless);
  ret.shaking = el.get_num("shaking", ret.shaking);
  ret.kind = el.get_num("kind", ret.kind);
  ret.fall = el.get_num("fall", ret.fall);
  ret.vrest = el.get_num("vrest", ret.vrest);
  ret.arest = el.get_num("arest", ret.arest);
  ret.bdefend = el.get_num("bdefend", ret.bdefend);
  ret.injury = el.get_num("injury", ret.injury);
  ret.effect = el.get_num("effect", ret.effect);
  ret.catchingact = xml_to_t_next_frame(el.children_by_tag('catchingact'))
  ret.caughtact = xml_to_t_next_frame(el.children_by_tag('caughtact'))
  ret.on_hit_ground = xml_to_t_next_frame(el.children_by_tag('on_hit_ground'))
  ret.actions = el.children_by_tag('action').map(xml_2_colli_action)
  if (!ret.actions.length) delete ret.actions;
  ret.test = el.get_str("test", ret.test);
  ret.code = el.get_num("code", ret.code);

  xml_to_velocity_info(el, ret);
  xml_to_qube(el, ret);

  for (const k in ret) {
    if ((ret as any)[k] == void 0) {
      delete (ret as any)[k];
    }
  }
  return ret;
}
