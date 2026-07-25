import type { IFrameInfo } from "../../defines/IFrameInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { xml_x_itr as xml_x_itr } from "./xml_x_itr";
import { xml_from_key_collection } from "./xml_from_key_collection";
import { xml_from_t_next_frame } from "./xml_from_next_frame";
import { xml_x_bdy } from "./xml_x_bdy";
import { xml_x_bpoint } from "./xml_x_bpoint";
import { xml_x_cpoint } from "./xml_x_cpoint";
import { xml_x_frame_pic } from "./xml_x_frame_pic";
import { xml_x_opoint } from "./xml_x_opoint";
import { xml_x_wpoint } from "./xml_x_wpoint";


export function xml_x_frame(xml: IXML, id: string, f: IFrameInfo): IXMLElement | null {
  const el = xml.create("frame");
  el.set_attr("id", id);
  el.set_attr("name", f.name)
  if (f.pic) el.insert(xml_x_frame_pic(xml, f.pic, 'pic'))
  if (f.pics) f.pics.forEach(pic => el.insert(xml_x_frame_pic(xml, pic, 'pic')))
  el.set_attr("state", f.state)
  el.set_attr("wait", f.wait)

  xml_from_t_next_frame(xml, f.next, 'next').forEach(v => el.insert(v))

  el.set_attr("center", [f.centerx, f.centery].join())
  el.set_attr("size", [f.width, f.height].join())
  el.set_attr("sound", f.sound)
  el.set_attr("hp", f.hp)
  el.set_attr("mp", f.mp)

  el.set_attr("invisible", f.invisible)
  el.set_attr("no_shadow", f.no_shadow)
  el.set_attr("jump_flag", f.jump_flag)
  el.set_attr("behavior", f.behavior)
  el.set_attr("landable", f.landable)
  el.set_attr("facing", f.facing)


  if (f.hit) xml_from_key_collection(xml, f.hit, 'hit').forEach(v => el.insert(v))
  if (f.hold) xml_from_key_collection(xml, f.hold, 'hold').forEach(v => el.insert(v))
  if (f.key_down) xml_from_key_collection(xml, f.key_down, 'key_down').forEach(v => el.insert(v))
  if (f.key_up) xml_from_key_collection(xml, f.key_up, 'key_up').forEach(v => el.insert(v))

  f.bdy?.map(v => xml_x_bdy(xml, v, "bdy")).forEach(v => el.insert(v))
  f.itr?.map(v => xml_x_itr(xml, v, "itr")).forEach(v => el.insert(v))
  f.opoint?.map(v => xml_x_opoint(xml, v, "opoint")).forEach(v => el.insert(v))

  el.insert(xml_x_bpoint(xml, f.bpoint, 'bpoint'));
  el.insert(xml_x_wpoint(xml, f.wpoint, "wpoint"));
  el.insert(xml_x_cpoint(xml, f.cpoint, "cpoint"));

  return el;
}
