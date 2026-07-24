import { frame_info_new, type IFrameInfo } from "../../defines/IFrameInfo";
import type { IHitKeyCollection } from "../../defines/IHitKeyCollection";
import type { IHoldKeyCollection } from "../../defines/IHoldKeyCollection";
import type { IQube } from "../../defines/IQube";
import type { IXMLElement } from "../../ditto/xml";
import { xml_to_bdy_info } from "./xml_to_bdy_info";
import { xml_to_bpoint } from "./xml_to_bpoint";
import { xml_to_chase } from "./xml_to_chase";
import { xml_to_cpoint } from "./xml_to_cpoint";
import { xml_to_itr_info } from "./xml_to_itr_info";
import { xml_to_key_collection } from "./xml_to_key_collection";
import { xml_to_next_frame } from "./xml_to_next_frame";
import { xml_to_opoint } from "./xml_to_opoint";
import { xml_to_pic } from "./xml_to_pic";
import { xml_to_velocity_info } from "./xml_to_velocity_info";
import { xml_to_world_dataset } from "./xml_to_world_dataset";
import { xml_to_wpoint } from "./xml_to_wpoint";

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

/**
 * 按标签名合并解析数组（用于 bdy/itr/opoint 等）
 */
function merge_array_by_tag<T>(
  el: IXMLElement,
  tag: string,
  parser: (child: IXMLElement) => T,
): T[] {
  return el.children_by_tag(tag).map(parser);
}

export function xml_to_frame_info(el: IXMLElement): IFrameInfo {
  const ret = frame_info_new();

  // 基础属性
  ret.id = el.get_str("id", ret.id);
  ret.name = el.get_str("name", ret.name);
  ret.state = el.get_num("state", ret.state);
  ret.wait = el.get_num("wait", ret.wait);

  // center="x,y" 快捷属性
  const center = el.nums_attr("center");
  ret.centerx = el.num_attr("centerx") ?? center?.[0] ?? 0;
  ret.centery = el.num_attr("centery") ?? center?.[1] ?? 0;
  ret.width = el.num_attr("width") ?? 0;
  ret.height = el.num_attr("height") ?? 0;

  // 可选属性
  const sound = el.str_attr("sound");
  if (sound !== void 0) ret.sound = sound;
  ret.hp_max = el.num_attr("hp_max");
  const invisible = el.num_attr("invisible");
  if (invisible !== void 0) ret.invisible = invisible;
  const noShadow = el.num_attr("no_shadow");
  if (noShadow !== void 0) ret.no_shadow = noShadow;
  const jumpFlag = el.num_attr("jump_flag");
  if (jumpFlag !== void 0) ret.jump_flag = jumpFlag;
  const behavior = el.num_attr("behavior");
  if (behavior !== void 0) ret.behavior = behavior;
  const landable = el.num_attr("landable");
  if (landable !== void 0) ret.landable = landable;
  const facing = el.num_attr("facing");
  if (facing !== void 0) ret.facing = facing;
  const gravity = el.num_attr("gravity_enabled") ?? el.num_attr("gravity");
  if (gravity !== void 0) ret.gravity_enabled = !!gravity;
  xml_to_velocity_info(el, ret as any);

  ret.pic = merge_by_tag(el, "pic", xml_to_pic);
  const pic = el.children_by_tag('pic')
  for (let i = 0; i < pic.length; i++) {
    const p = xml_to_pic(pic[i])
    if (!i) {
      ret.pic = p
      continue;
    }
    ret.pics ||= []
    ret.pics[i - 1] = p
  }

  const mergedNext = merge_array_by_tag(el, "next", xml_to_next_frame);
  ret.next = mergedNext.length === 1 ? mergedNext[0] : mergedNext.length ? mergedNext : { id: "" };
  const onDead = merge_array_by_tag(el, "on_dead", xml_to_next_frame);
  ret.on_dead = onDead.length === 1 ? onDead[0] : onDead.length ? onDead : void 0;
  const onLanding = merge_array_by_tag(el, "on_landing", xml_to_next_frame);
  ret.on_landing = onLanding.length === 1 ? onLanding[0] : onLanding.length ? onLanding : void 0;
  const onExhaustion = merge_array_by_tag(el, "on_exhaustion", xml_to_next_frame);
  ret.on_exhaustion = onExhaustion.length === 1 ? onExhaustion[0] : onExhaustion.length ? onExhaustion : void 0;

  // arrays (仅非空时覆盖)
  const bdys = merge_array_by_tag(el, "bdy", xml_to_bdy_info);
  if (bdys.length) ret.bdy = bdys;
  const itrs = merge_array_by_tag(el, "itr", xml_to_itr_info);
  if (itrs.length) ret.itr = itrs;
  const opoints = merge_array_by_tag(el, "opoint", xml_to_opoint);
  if (opoints.length) ret.opoint = opoints;

  // single nested elements
  ret.wpoint = merge_by_tag(el, "wpoint", xml_to_wpoint);
  ret.bpoint = merge_by_tag(el, "bpoint", xml_to_bpoint);
  ret.cpoint = merge_by_tag(el, "cpoint", xml_to_cpoint);
  ret.chase = merge_by_tag(el, "chase", xml_to_chase);

  // key collections
  ret.hit = merge_by_tag(el, "hit", xml_to_key_collection) as IHitKeyCollection;
  ret.hold = merge_by_tag(el, "hold", xml_to_key_collection) as IHoldKeyCollection;
  ret.key_down = merge_by_tag(el, "key_down", xml_to_key_collection) as IHoldKeyCollection;
  ret.key_up = merge_by_tag(el, "key_up", xml_to_key_collection) as IHoldKeyCollection;
  ret.seqs = merge_by_tag(el, "seqs", xml_to_key_collection);

  // dataset overrides
  const ds = xml_to_world_dataset(el.child_by_tag("dataset"));
  for (const k of Object.keys(ds)) (ret as any)[k] = (ds as any)[k];

  return ret;
}
