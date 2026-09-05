import { frame_model_new, type IFrameModel, type IFrameModelPose } from "../../defines";
import type { IXML } from "../../ditto/xml/IXML";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { delete_undefined } from "./delete_undefined";

/**
 * 帧级 `<model>` 的 XML 读写。
 *
 * 序列化示例：
 *
 * ```xml
 * <model id="hero" anim="Spin" loop="1" time_scale="1" rad="1.0471975511965976">
 *   <pose bones="root,arm_L" pos="0,0,0,1,2,3" rot="0,0,0,1,0,0,0,1" scl="1,1,1,1,1,1"/>
 * </model>
 * ```
 */
export function xml_2_frame_model(el: IXMLElement | undefined): IFrameModel | undefined {
  if (!el) return void 0;
  const ret = frame_model_new();
  ret.id = el.get_str("id", ret.id);
  ret.anim = el.get_str("anim");
  ret.loop = el.get_bool("loop");
  ret.time_scale = el.get_num("time_scale");
  ret.rad = el.get_num("rad");
  const rotation = el.nums_attr_soft("rotation");
  if (rotation?.some(v => v != null)) {
    const s: { x?: number; y?: number; z?: number } = {};
    if (rotation[0] != null) s.x = rotation[0] as number;
    if (rotation[1] != null) s.y = rotation[1] as number;
    if (rotation[2] != null) s.z = rotation[2] as number;
    ret.rotation = s;
  }
  const scale = el.nums_attr_soft("scale");
  if (scale?.some(v => v != null)) {
    const s: { x?: number; y?: number; z?: number } = {};
    if (scale[0] != null) s.x = scale[0] as number;
    if (scale[1] != null) s.y = scale[1] as number;
    if (scale[2] != null) s.z = scale[2] as number;
    ret.scale = s;
  }
  const offset = el.nums_attr_soft("offset");
  if (offset?.some(v => v != null)) {
    const s: { x?: number; y?: number; z?: number } = {};
    if (offset[0] != null) s.x = offset[0] as number;
    if (offset[1] != null) s.y = offset[1] as number;
    if (offset[2] != null) s.z = offset[2] as number;
    ret.offset = s;
  }

  const pose_el = el.child_by_tag("pose");
  if (pose_el) {
    const pose: IFrameModelPose = {};
    const bones = pose_el.get_str_arr("bones");
    if (bones?.length) pose.bones = bones;
    const pos = pose_el.get_num_arr("pos");
    if (pos?.length) pose.pos = pos;
    const rot = pose_el.get_num_arr("rot");
    if (rot?.length) pose.rot = rot;
    const scl = pose_el.get_num_arr("scl");
    if (scl?.length) pose.scl = scl;
    ret.pose = pose;
  }
  return delete_undefined(ret);
}

export function xml_x_frame_model(xml: IXML, m: IFrameModel | undefined, tag: string): IXMLElement | undefined {
  if (!m) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("id", m.id);
  ret.set_attr("anim", m.anim);
  ret.set_attr("loop", m.loop);
  ret.set_attr("time_scale", m.time_scale);
  ret.set_attr("rad", m.rad);
  if (m.rotation) ret.set_arr_attr_soft("rotation", [m.rotation.x, m.rotation.y, m.rotation.z]);
  if (m.scale) ret.set_arr_attr_soft("scale", [m.scale.x, m.scale.y, m.scale.z]);
  if (m.offset) ret.set_arr_attr_soft("offset", [m.offset.x, m.offset.y, m.offset.z]);
  if (m.pose) {
    const pe = xml.create("pose");
    pe.set_attr("bones", m.pose.bones);
    pe.set_attr("pos", m.pose.pos);
    pe.set_attr("rot", m.pose.rot);
    pe.set_attr("scl", m.pose.scl);
    ret.insert(pe);
  }
  return ret;
}
