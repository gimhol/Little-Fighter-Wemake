import type { INextFrame, TNextFrame } from "../../defines";
import type { IXMLElement } from "../../ditto";
import { xml_to_velocity_info } from "./xml_to_velocity_info";


export function xml_to_next_frame(el: IXMLElement): INextFrame {
  const nf: TNextFrame = { id: el.get_str("id") ?? "" };
  const wait = el.num_attr("wait");
  if (wait !== void 0) nf.wait = wait;
  const facing = el.num_attr("facing");
  if (facing !== void 0) nf.facing = facing;
  const mp = el.num_attr("mp");
  if (mp !== void 0) nf.mp = mp;
  const hp = el.num_attr("hp");
  if (hp !== void 0) nf.hp = hp;
  const expression = el.get_str("expression") ?? el.child_by_tag("expression")?.text;
  if (expression) nf.expression = expression;
  const blink = el.num_attr("blink_time");
  if (blink !== void 0) nf.blink_time = blink;
  xml_to_velocity_info(el, nf as any);
  return nf;
}

export function xml_to_t_next_frame(els: IXMLElement[]): TNextFrame | undefined {
  if (els.length > 1) return els.map(v => xml_to_next_frame(v));
  if (els.length === 1) return xml_to_next_frame(els[0]);
  return void 0
}