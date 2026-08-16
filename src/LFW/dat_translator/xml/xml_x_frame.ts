import { FRAME_BEHAVIOR_LABEL_MAP, StateEnumNames, type IHitKeyMap } from "../../defines";
import { frame_info_new, type IFrameInfo } from "../../defines/IFrameInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";
import { merge_by_tag } from "./merge_by_tag";
import { one_or_arr } from "./one_or_arr";
import { xml_from_key_collection } from "./xml_from_key_collection";
import { xml_to_key_collection } from "./xml_to_key_collection";
import { xml_to_velocity_info } from "./xml_to_velocity_info";
import { xml_to_world_dataset } from "./xml_to_world_dataset";
import { xml_2_bdy, xml_x_bdy } from "./xml_x_bdy";
import { xml_2_bpoint, xml_x_bpoint } from "./xml_x_bpoint";
import { xml_2_chase, xml_x_chase } from "./xml_x_chase";
import { xml_2_cpoint, xml_x_cpoint } from "./xml_x_cpoint";
import { xml_2_frame_pic, xml_x_frame_pic } from "./xml_x_frame_pic";
import { xml_2_itr, xml_x_itr } from "./xml_x_itr";
import { xml_2_t_next_frame, xml_x_t_next_frame } from "./xml_x_next_frame";
import { xml_2_non_empty } from "./xml_x_non_empty";
import { xml_2_opoint, xml_x_opoint } from "./xml_x_opoint";
import { xml_2_wpoint, xml_x_wpoint } from "./xml_x_wpoint";

export function xml_x_frame(xml: IXML, f: IFrameInfo, tag: string): IXMLElement | null {
  const ret = xml.create(tag);
  ret.set_attr("id", f.id);
  ret.set_attr("name", f.name)
  if (f.pic) ret.insert(xml_x_frame_pic(xml, f.pic, 'pic'))
  if (f.pics) f.pics.forEach(pic => ret.insert(xml_x_frame_pic(xml, pic, 'pic')))
  ret.set_attr("state", f.state)
  ret.set_attr("wait", f.wait)

  xml_x_t_next_frame(xml, f.next, 'next').forEach(v => ret.insert(v))

  ret.set_attr("center", [f.centerx, f.centery].join())
  ret.set_attr("size", [f.width, f.height].join())

  const sounds = Array.isArray(f.sound) ? f.sound : f.sound ? [f.sound] : void 0;
  sounds?.forEach(sound => {
    const el = xml.create('sound');
    el.set_attr("value", sound)
    ret.insert(el)
  })
  ret.set_attr("hp", f.hp)
  ret.set_attr("mp", f.mp)

  ret.set_attr("invisible", f.invisible)
  ret.set_attr("no_shadow", f.no_shadow)
  ret.set_attr("jump_flag", f.jump_flag)
  ret.set_attr("behavior", f.behavior)
  ret.set_attr("landable", f.landable)
  ret.set_attr("facing", f.facing)


  if (f.hit) xml_from_key_collection(xml, f.hit, 'hit').forEach(v => ret.insert(v))
  if (f.hold) xml_from_key_collection(xml, f.hold, 'hold').forEach(v => ret.insert(v))
  if (f.key_down) xml_from_key_collection(xml, f.key_down, 'key_down').forEach(v => ret.insert(v))
  if (f.key_up) xml_from_key_collection(xml, f.key_up, 'key_up').forEach(v => ret.insert(v))

  f.bdy?.map(v => xml_x_bdy(xml, v, "bdy")).forEach(v => ret.insert(v))
  f.itr?.map(v => xml_x_itr(xml, v, "itr")).forEach(v => ret.insert(v))
  f.opoint?.map(v => xml_x_opoint(xml, v, "opoint")).forEach(v => ret.insert(v))
  ret.insert(xml_x_bpoint(xml, f.bpoint, 'bpoint'));
  ret.insert(xml_x_wpoint(xml, f.wpoint, "wpoint"));
  ret.insert(xml_x_cpoint(xml, f.cpoint, "cpoint"));
  ret.insert(xml_x_chase(xml, f.chase, "chase"))

  if (f.behavior != void 0) {
    const label = (FRAME_BEHAVIOR_LABEL_MAP as any)[f.behavior];
    if (label) ret.set_attr("behavior_label", label)
  }
  if (f.state != void 0) {
    const label = (StateEnumNames as any)[f.state];
    if (label) ret.set_attr("state_label", label)
  }
  return ret;
}

export function xml_2_frame(el: IXMLElement): IFrameInfo {
  const ret = frame_info_new();
  ret.id   /**/ = el.get_str("id", ret.id);
  ret.name /**/ = el.get_str("name", ret.name);

  const pics = el.children_by_tag('pic').map(v => xml_2_frame_pic(v));
  if (pics.length > 0) ret.pic = pics[0];
  if (pics.length > 1) ret.pics = pics.slice(1);

  ret.state           /**/ = el.get_num("state", ret.state);
  ret.wait            /**/ = el.get_num("wait", ret.wait);
  const center        /**/ = el.nums_attr("center");
  ret.centerx         /**/ = el.get_num("centerx", center?.[0] ?? ret.centerx);
  ret.centery         /**/ = el.get_num("centery", center?.[1] ?? ret.centery);
  const size          /**/ = el.nums_attr("size");
  ret.width           /**/ = el.get_num("width", size?.[0] ?? ret.width);
  ret.height          /**/ = el.get_num("height", size?.[1] ?? ret.height);
  ret.sound           /**/ = one_or_arr(el.get_str_arr("sound"));
  ret.hp              /**/ = el.get_num("hp", ret.hp);
  ret.mp              /**/ = el.get_num("mp", ret.mp);
  ret.invisible       /**/ = el.get_num("invisible");
  ret.no_shadow       /**/ = el.get_num("no_shadow");
  ret.jump_flag       /**/ = el.get_num("jump_flag");
  ret.behavior        /**/ = el.get_num("behavior");
  ret.landable        /**/ = el.get_num("landable");
  ret.facing          /**/ = el.get_num("facing");
  ret.gravity_enabled /**/ = el.get_bool("gravity_enabled");

  xml_to_velocity_info(el, ret as any);

  ret.next /**/ = xml_2_t_next_frame(el.children_by_tag("next"));
  ret.on_dead /**/ = xml_2_t_next_frame(el.children_by_tag("on_dead"));
  ret.on_landing /**/ = xml_2_t_next_frame(el.children_by_tag("on_landing"));
  ret.on_exhaustion /**/ = xml_2_t_next_frame(el.children_by_tag("on_exhaustion"));
  ret.bdy /**/ = xml_2_non_empty(el, "bdy", xml_2_bdy);
  ret.itr /**/ = xml_2_non_empty(el, "itr", xml_2_itr);
  ret.opoint /**/ = xml_2_non_empty(el, "opoint", xml_2_opoint);
  ret.wpoint /**/ = merge_by_tag(el, "wpoint", xml_2_wpoint);
  ret.bpoint /**/ = merge_by_tag(el, "bpoint", xml_2_bpoint);
  ret.cpoint /**/ = merge_by_tag(el, "cpoint", xml_2_cpoint);
  ret.chase /**/ = merge_by_tag(el, "chase", xml_2_chase);
  ret.hit /**/ = xml_to_key_collection(el, "hit") as IHitKeyMap;
  ret.hold /**/ = xml_to_key_collection(el, "hold") as IHitKeyMap;
  ret.key_down /**/ = xml_to_key_collection(el, "key_down") as IHitKeyMap;
  ret.key_up /**/ = xml_to_key_collection(el, "key_up") as IHitKeyMap;
  ret.seqs /**/ = xml_to_key_collection(el, "seqs");
  ret.dataset /**/ = xml_to_world_dataset(el.child_by_tag("dataset"));

  return delete_undefined(ret);
}

