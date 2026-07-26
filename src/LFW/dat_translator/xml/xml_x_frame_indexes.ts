import type { IFrameIndexes } from "../../defines/IFrameIndexes";
import type { IXML, IXMLElement } from "../../ditto/xml";

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
  ret.set_attr("picking_heavy", indexes.picking_heavy);
  ret.set_attr("picking_light", indexes.picking_light);
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
