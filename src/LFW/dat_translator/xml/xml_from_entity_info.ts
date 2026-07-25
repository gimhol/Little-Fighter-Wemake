import type { IEntityInfo } from "../../defines/IEntityInfo";
import type { IXMLElement, IXML } from "../../ditto/xml";
import { xml_from_drink_info } from "./xml_from_drink_info";
import { xml_from_armor_info } from "./xml_from_armor_info";
import { xml_from_opoint } from "./xml_from_opoint";
import { xml_from_world_dataset } from "./xml_from_world_dataset";

/**
 * 序列化 <base>
 */
export function xml_from_entity_info(xml: IXML, info: IEntityInfo, tag: string = "base"): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("name", info.name);
  ret.set_attr("head", info.head);
  ret.set_attr("small", info.small);
  ret.set_attr("bot_id", info.bot_id);
  ret.set_attr("type", info.type);
  ret.set_attr("ce", info.ce);
  ret.set_attr("weight", info.weight);
  ret.set_attr("strength", info.strength);
  ret.set_arr_attr_soft("bounce", [info.bounce_x, info.bounce_y, info.bounce_z]);
  ret.set_arr_attr_soft("bounce_min", [info.bounce_min_x, info.bounce_min_y, info.bounce_min_z]);
  ret.set_arr_attr_soft("fast", [info.fast_vx, info.fast_vy, info.fast_vz]);
  ret.set_attr("drop_hurt", info.drop_hurt);
  ret.set_attr("resting_max", info.resting_max);
  ret.set_arr_attr("group", info.group);
  ret.set_arr_attr("hit_sounds", info.hit_sounds);
  ret.set_arr_attr("drop_sounds", info.drop_sounds);
  ret.set_arr_attr("dead_sounds", info.dead_sounds);


  for (const [name, f] of Object.entries(info.files ?? {})) {
    const el = xml.create("file");
    el.set_attr("name", name);
    el.set_attr("path", f.path);
    el.set_attr("row", f.row);
    el.set_attr("col", f.col);
    el.set_attr("cell_w", f.cell_w);
    el.set_attr("cell_h", f.cell_h);
    el.set_arr_attr("variants", (f as any).variants);
    ret.insert(el);
  }
  for (const [name, p] of Object.entries(info.portraits ?? {})) {
    const el = xml.create("portrait");
    el.set_attr("name", name);
    el.set_attr("tex", p.tex);
    el.set_attr("x", p.x);
    el.set_attr("y", p.y);
    el.set_attr("w", p.w);
    el.set_attr("h", p.h);
    ret.insert(el);
  }
  if (info.drink)
    ret.insert(xml_from_drink_info(xml, info.drink));

  if (info.armor)
    ret.insert(xml_from_armor_info(xml, info.armor));

  for (const [name, m] of Object.entries(info.models ?? {})) {
    const el = xml.create("model");
    el.set_attr("name", name);
    el.set_attr("id", m.id);
    el.set_attr("path", m.path);
    el.set_arr_attr("variants", m.variants);
    if (m.scale) el.set_arr_attr_soft("scale", [m.scale.x, m.scale.y, m.scale.z]);
    if (m.quaternion) el.set_arr_attr_soft("quaternion", [m.quaternion.x, m.quaternion.y, m.quaternion.z, m.quaternion.w]);
    ret.insert(el);
  }
  if (info.brokens?.length) {
    for (const broken of info.brokens) {
      ret.insert(xml_from_opoint(xml, broken));
    }
  }

  const ds = xml_from_world_dataset(xml, info);
  if (ds) ret.insert(ds);

  return ret;
}
