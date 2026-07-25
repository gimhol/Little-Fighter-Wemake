import { frame_info_new, type IFrameInfo } from "../../defines/IFrameInfo";
import type { IHitKeyCollection } from "../../defines/IHitKeyCollection";
import type { IHoldKeyCollection } from "../../defines/IHoldKeyCollection";
import type { IQube } from "../../defines/IQube";
import type { IXMLElement } from "../../ditto/xml";
import { xml_to_chase } from "./xml_to_chase";
import { xml_to_key_collection } from "./xml_to_key_collection";
import { xml_to_velocity_info } from "./xml_to_velocity_info";
import { xml_to_world_dataset } from "./xml_to_world_dataset";
import { xml_2_bdy } from "./xml_x_bdy";
import { xml_2_bpoint } from "./xml_x_bpoint";
import { xml_2_cpoint } from "./xml_x_cpoint";
import { xml_2_frame_pic } from "./xml_x_frame_pic";
import { xml_2_itr } from "./xml_x_itr";
import { xml_2_t_next_frame } from "./xml_x_next_frame";
import { xml_2_non_empty } from "./xml_x_non_empty";
import { xml_2_opoint } from "./xml_x_opoint";
import { xml_2_wpoint } from "./xml_x_wpoint";

/**
 * 解析快捷属性：rect="x,y,w,h" 或 qube="x,y,w,h" 或 qube="x,y,w,h,z,l"
 */
export function parse_rect_qube(el: IXMLElement): Partial<IQube> {
  const rect = el.nums_attr("rect");
  if (rect && rect.length >= 4) {
    return { x: rect[0], y: rect[1], w: rect[2], h: rect[3], z: rect[4], l: rect[5] };
  }
  const qube = el.nums_attr("qube");
  if (qube && qube.length >= 4) {
    return { x: qube[0], y: qube[1], w: qube[2], h: qube[3], z: qube[4], l: qube[5] };
  }
  return {};
}


/**
 * 获取合并后首个结果（多个同名 tag 时 Object.assign 合并，后者覆盖前者）
 * @param el      父元素
 * @param tag     标签名
 * @param parser  解析函数
 * @return 合并后的解析结果，无匹配时 undefined
 */
export function merge_by_tag<T extends Record<string, any>>(
  el: IXMLElement,
  tag: string,
  parser: (child: IXMLElement) => T,
): T | undefined {
  const children = el.children_by_tag(tag);
  if (!children.length) return void 0;
  let ret: T = parser(children[0]);
  for (let i = 1; i < children.length; i++) {
    ret = Object.assign(ret, parser(children[i]));
  }
  return ret;
}

export function xml_2_frame(el: IXMLElement): IFrameInfo {
  const ret = frame_info_new();
  ret.id = el.get_str("id", ret.id);
  ret.name = el.get_str("name", ret.name);

  const pics = el.children_by_tag('pic').map(v => xml_2_frame_pic(v))
  if (pics.length > 0) ret.pic = pics[0]
  if (pics.length > 1) ret.pics = pics.slice(1)
  ret.state = el.get_num("state", ret.state);
  ret.wait = el.get_num("wait", ret.wait);

  const center = el.nums_attr("center");
  ret.centerx = el.get_num("centerx") ?? center?.[0] ?? 0;
  ret.centery = el.get_num("centery") ?? center?.[1] ?? 0;

  const size = el.nums_attr("size");
  ret.width = el.get_num("width") ?? size?.[0] ?? 0;
  ret.height = el.get_num("height") ?? size?.[1] ?? 0;
  ret.sound = el.get_str("sound");

  ret.hp = el.get_num("hp");
  ret.mp = el.get_num("mp");
  ret.invisible = el.get_num("invisible");
  ret.no_shadow = el.get_num("no_shadow");
  ret.jump_flag = el.get_num("jump_flag");
  ret.behavior = el.get_num("behavior");
  ret.landable = el.get_num("landable");
  ret.facing = el.get_num("facing");

  ret.gravity_enabled = el.get_bool("gravity_enabled");

  xml_to_velocity_info(el, ret as any);

  ret.next          /**/ = xml_2_t_next_frame(el.children_by_tag("next"));
  ret.on_dead       /**/ = xml_2_t_next_frame(el.children_by_tag("on_dead"));
  ret.on_landing    /**/ = xml_2_t_next_frame(el.children_by_tag("on_landing"));
  ret.on_exhaustion /**/ = xml_2_t_next_frame(el.children_by_tag("on_exhaustion"));
  ret.bdy           /**/ = xml_2_non_empty(el, "bdy", xml_2_bdy);
  ret.itr           /**/ = xml_2_non_empty(el, "itr", xml_2_itr);
  ret.opoint        /**/ = xml_2_non_empty(el, "opoint", xml_2_opoint);
  ret.wpoint        /**/ = merge_by_tag(el, "wpoint", xml_2_wpoint);
  ret.bpoint        /**/ = merge_by_tag(el, "bpoint", xml_2_bpoint);
  ret.cpoint        /**/ = merge_by_tag(el, "cpoint", xml_2_cpoint);
  ret.chase         /**/ = merge_by_tag(el, "chase", xml_to_chase);
  ret.hit           /**/ = xml_to_key_collection(el, "hit") as IHitKeyCollection;
  ret.hold          /**/ = xml_to_key_collection(el, "hold") as IHoldKeyCollection;
  ret.key_down      /**/ = xml_to_key_collection(el, "key_down") as IHoldKeyCollection;
  ret.key_up        /**/ = xml_to_key_collection(el, "key_up") as IHoldKeyCollection;
  ret.seqs          /**/ = xml_to_key_collection(el, "seqs");
  ret.dataset       /**/ = xml_to_world_dataset(el.child_by_tag("dataset"))
  return ret;
}
