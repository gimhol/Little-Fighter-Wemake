import type { IFrameInfo } from "../../defines/IFrameInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { xml_from_bdy_info } from "./xml_from_bdy_info";
import { xml_from_itr_info } from "./xml_from_itr_info";
import { xml_from_hit_key, xml_from_hold_key } from "./xml_from_key_collection";
import { xml_from_t_next_frame } from "./xml_from_next_frame";
import { xml_from_opoint } from "./xml_from_opoint";
import { xml_from_pic, xml_to_pic } from "./xml_to_pic";

/**
 * 序列化 <frame>
 */
export function xml_from_frame_info(xml: IXML, id: string, f: IFrameInfo): IXMLElement | null {
  const el = xml.create("frame");
  el.set_attr("id", id);
  el.set_attr("name", f.name)
  if (f.pic) el.insert(xml_from_pic(xml, f.pic))
  if (f.pics) f.pics.forEach(pic => el.insert(xml_from_pic(xml, pic)))
  el.set_attr("state", f.state)
  el.set_attr("wait", f.wait)
  
  el.set_arr_attr("center", [f.centerx, f.centery])
  el.set_arr_attr("size", [f.width, f.height])
  el.set_attr("sound", f.hp)





  xml_from_t_next_frame(xml, f.next, 'next')?.forEach(v => {
    el.insert(v);
  })

  // hit / hold / key_down / key_up
  if (f.hit) {
    el.insert(xml_from_hit_key(xml, f.hit));
  }
  if (f.hold) {
    el.insert(xml_from_hold_key(xml, f.hold));
  }
  if (f.key_down) {
    el.insert(xml_from_hold_key(xml, f.key_down));
  }
  if (f.key_up) {
    el.insert(xml_from_hold_key(xml, f.key_up));
  }

  // bpoint / wpoint / cpoint (single)
  if (f.bpoint) {
    const b = xml.create("bpoint");
    b.set_attr("x", f.bpoint.x);
    b.set_attr("y", f.bpoint.y);
    b.set_attr("z", f.bpoint.z);
    b.set_attr("r", f.bpoint.r);
    el.insert(b);
  }
  if (f.wpoint) {
    const w = xml.create("wpoint");
    w.set_attr("kind", f.wpoint.kind as number);
    w.set_attr("x", f.wpoint.x);
    w.set_attr("y", f.wpoint.y);
    w.set_attr("z", f.wpoint.z);
    w.set_attr("weaponact", f.wpoint.weaponact);
    w.set_attr("attacking", f.wpoint.attacking);
    w.set_arr_attr_soft("dv", [f.wpoint.dvx, f.wpoint.dvy, f.wpoint.dvz]);
    el.insert(w);
  }
  if (f.cpoint) {
    const c = xml.create("cpoint");
    c.set_attr("kind", f.cpoint.kind);
    c.set_attr("x", f.cpoint.x);
    c.set_attr("y", f.cpoint.y);
    c.set_attr("z", f.cpoint.z);
    c.set_attr("injury", f.cpoint.injury);
    c.set_attr("hurtable", f.cpoint.hurtable);
    c.set_attr("decrease", f.cpoint.decrease);
    c.set_arr_attr_soft("throwv", [f.cpoint.throwvx, f.cpoint.throwvy, f.cpoint.throwvz]);
    c.set_attr("throwinjury", f.cpoint.throwinjury);
    c.set_attr("fronthurtact", f.cpoint.fronthurtact);
    c.set_attr("backhurtact", f.cpoint.backhurtact);
    c.set_attr("shaking", f.cpoint.shaking);
    el.insert(c);
  }

  // bdy[]
  if (f.bdy) {
    for (const b of f.bdy) {
      el.insert(xml_from_bdy_info(xml, b));
    }
  }

  // itr[]
  if (f.itr) {
    for (const i of f.itr) {
      el.insert(xml_from_itr_info(xml, i));
    }
  }

  // opoint[]
  if (f.opoint) {
    for (const o of f.opoint) {
      el.insert(xml_from_opoint(xml, o));
    }
  }

  return el;
}
