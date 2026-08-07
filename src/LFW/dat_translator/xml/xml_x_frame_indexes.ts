import { frame_indexes_new, type IFrameIndexes } from "../../defines/IFrameIndexes";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { delete_undefined } from "./delete_undefined";

export function xml_x_frame_indexes(xml: IXML, indexes: IFrameIndexes, tag: string): IXMLElement
export function xml_x_frame_indexes(xml: IXML, indexes: IFrameIndexes | undefined, tag: string): IXMLElement | undefined;
export function xml_x_frame_indexes(xml: IXML, indexes: IFrameIndexes | undefined, tag: string): IXMLElement | undefined {
  if (!indexes) return void 0;
  const ret = xml.create(tag);
  ret.set_attr("default", indexes.default);
  ret.set_attr("heavy_obj_walk", indexes.heavy_obj_walk);
  ret.set_attr("landing_1", indexes.landing_1);
  ret.set_attr("landing_2", indexes.landing_2);
  ret.set_attr("dizzy", indexes.dizzy);
  ret.set_attr("in_the_skys", indexes.in_the_skys);
  ret.set_attr("throwings", indexes.throwings);
  ret.set_attr("on_hands", indexes.on_hands);
  ret.set_attr("falling_1", indexes.falling?.[1]);
  ret.set_attr("falling_2", indexes.falling?.[-1]);
  ret.set_attr("bouncing_1", indexes.bouncing?.[1]);
  ret.set_attr("bouncing_2", indexes.bouncing?.[-1]);
  ret.set_attr("critical_hit_1", indexes.critical_hit?.[1]);
  ret.set_attr("critical_hit_2", indexes.critical_hit?.[-1]);
  ret.set_attr("injured_1", indexes.injured?.[1]);
  ret.set_attr("injured_2", indexes.injured?.[-1]);
  ret.set_attr("grand_injured_1", indexes.grand_injured?.[1]);
  ret.set_attr("grand_injured_2", indexes.grand_injured?.[-1]);
  ret.set_attr("lying_1", indexes.lying?.[1]);
  ret.set_attr("lying_2", indexes.lying?.[-1]);
  ret.set_attr("fire", indexes.fire);
  ret.set_attr("ice", indexes.ice);
  ret.set_attr("on_ground", indexes.on_ground);
  ret.set_attr("just_on_ground", indexes.just_on_ground);
  ret.set_attr("throw_on_ground", indexes.throw_on_ground);
  return ret;
}

export function xml_2_frame_indexes(el: IXMLElement | undefined): IFrameIndexes | undefined {
  if (!el) return void 0;
  const ret          /**/ = frame_indexes_new();
  ret.default        /**/ = el.get_str("default", ret.default);
  ret.heavy_obj_walk /**/ = el.get_str("heavy_obj_walk", ret.heavy_obj_walk);
  ret.landing_1      /**/ = el.get_str("landing_1", ret.landing_1);
  ret.landing_2      /**/ = el.get_str("landing_2", ret.landing_2);
  ret.dizzy          /**/ = el.get_str("dizzy", ret.dizzy);
  ret.in_the_skys    /**/ = el.get_str_arr("in_the_skys", ret.in_the_skys);
  ret.throwings      /**/ = el.get_str_arr("throwings", ret.throwings);
  ret.on_hands       /**/ = el.get_str_arr("on_hands", ret.on_hands);
  {
    const a = el.get_str_arr("falling_1");
    const b = el.get_str_arr("falling_2");
    if (!a || !b) return;
    ret.falling = { [1]: a, [-1]: b };
  }
  {
    const a = el.get_str_arr("bouncing_1");
    const b = el.get_str_arr("bouncing_2");
    if (!a || !b) return;
    ret.bouncing = { [1]: a, [-1]: b };
  }
  {
    const a = el.get_str_arr("critical_hit_1");
    const b = el.get_str_arr("critical_hit_2");
    if (!a || !b) return;
    ret.critical_hit = { [1]: a, [-1]: b };
  }
  {
    const a = el.get_str("injured_1");
    const b = el.get_str("injured_2");
    if (!a || !b) return;
    ret.injured = { [1]: a, [-1]: b };
  }
  {
    const a = el.get_str_arr("grand_injured_1");
    const b = el.get_str_arr("grand_injured_2");
    if (!a || !b) return;
    ret.grand_injured = { [1]: a, [-1]: b };
  }
  {
    const a = el.get_str("lying_1");
    const b = el.get_str("lying_2");
    if (!a || !b) return;
    ret.lying = { [1]: a, [-1]: b };
  }
  ret.fire            /**/ = el.get_str_arr("fire", ret.fire);
  ret.ice             /**/ = el.get_str("ice", ret.ice);
  ret.on_ground       /**/ = el.get_str("on_ground", ret.on_ground);
  ret.just_on_ground  /**/ = el.get_str("just_on_ground", ret.just_on_ground);
  ret.throw_on_ground /**/ = el.get_str("throw_on_ground", ret.throw_on_ground);
  return delete_undefined(ret);
}
