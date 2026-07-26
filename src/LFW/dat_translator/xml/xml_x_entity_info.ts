import { entity_info_new, type IEntityInfo } from "../../defines/IEntityInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { xml_from_world_dataset } from "./xml_from_world_dataset";
import { xml_to_world_dataset } from "./xml_to_world_dataset";
import { xml_2_armor_info, xml_x_armor_info } from "./xml_x_armor_info";
import { xml_2_drink_info, xml_x_drink_info } from "./xml_x_drink_info";
import { xml_x_frame_pic } from "./xml_x_frame_pic";
import { xml_x_map } from "./xml_x_map";
import { xml_2_model_info_map, xml_x_model_info_map } from "./xml_x_model_info";
import { xml_x_non_empty } from "./xml_x_non_empty";
import { xml_2_opoint, xml_x_opoint } from "./xml_x_opoint";
import { xml_2_picture_info_map, xml_x_picture_info_map } from "./xml_x_picture_info";

export function xml_x_entity_info(xml: IXML, info: IEntityInfo, tag: string): IXMLElement {
  const ret = xml.create(tag);
  ret.set_attr("type", info.type);
  ret.set_attr("name", info.name);
  ret.set_attr("head", info.head);
  ret.set_attr("small", info.small);
  ret.set_attr("ce", info.ce);
  ret.set_attr("weight", info.weight);
  ret.set_attr("strength", info.strength);
  ret.set_attr("group", info.group?.join());
  xml_x_picture_info_map(xml, info.files, "file")?.forEach(v => ret.insert(v))
  xml_x_model_info_map(xml, info.models, "model")?.forEach(v => ret.insert(v))
  ret.set_arr_attr_soft("bounce", [info.bounce_x, info.bounce_y, info.bounce_z]);
  ret.set_arr_attr_soft("bounce_min", [info.bounce_min_x, info.bounce_min_y, info.bounce_min_z]);
  ret.set_arr_attr_soft("fast", [info.fast_vx, info.fast_vy, info.fast_vz]);
  xml_x_non_empty(xml, info.brokens, "broken", xml_x_opoint, ret)
  ret.insert(xml_x_armor_info(xml, info.armor, 'armor'));
  ret.insert(xml_x_drink_info(xml, info.drink, "drink"));
  ret.set_attr("drop_hurt", info.drop_hurt);
  ret.set_attr("hit_sounds", info.hit_sounds);
  ret.set_attr("drop_sounds", info.drop_sounds);
  ret.set_attr("dead_sounds", info.dead_sounds);
  ret.set_attr("bot_id", info.bot_id);
  xml_x_map(xml, info.portraits, "portrait", xml_x_frame_pic, ret)
  ret.insert(xml_from_world_dataset(xml, info, "dataset"));
  return ret;
} 

export function xml_2_entity_info(el: IXMLElement): IEntityInfo {
  const ret = entity_info_new();

  ret.type /**/ = el.get_num("type", ret.type);
  ret.name /**/ = el.get_str("name", ret.name);
  ret.head /**/ = el.get_str("head", ret.head);
  ret.small /**/ = el.get_str("small", ret.small);
  ret.ce /**/ = el.get_num("ce", ret.ce);
  ret.weight /**/ = el.get_num("weight", ret.weight);
  ret.strength /**/ = el.get_num("strength", ret.strength);
  ret.group /**/ = el.get_str_arr("group");
  ret.files /**/ = xml_2_picture_info_map(el, 'file');
  ret.models /**/ = xml_2_model_info_map(el, 'model');

  const bounce = el.nums_attr_soft("bounce");
  ret.bounce_x = el.get_num("bounce_x", bounce?.[0] ?? ret.bounce_x);
  ret.bounce_y = el.get_num("bounce_y", bounce?.[1] ?? ret.bounce_y);
  ret.bounce_z = el.get_num("bounce_z", bounce?.[2] ?? ret.bounce_z);

  const bounce_min = el.nums_attr_soft("bounce_min");
  ret.bounce_min_y = el.get_num("bounce_min_y", bounce_min?.[0] ?? ret.bounce_min_y);
  ret.bounce_min_x = el.get_num("bounce_min_x", bounce_min?.[1] ?? ret.bounce_min_x);
  ret.bounce_min_z = el.get_num("bounce_min_z", bounce_min?.[2] ?? ret.bounce_min_z);

  const fast_v = el.nums_attr_soft("fast_v");
  ret.fast_vy = el.get_num("fast_vy", fast_v?.[0] ?? ret.fast_vy);
  ret.fast_vx = el.get_num("fast_vx", fast_v?.[1] ?? ret.fast_vx);
  ret.fast_vz = el.get_num("fast_vz", fast_v?.[2] ?? ret.fast_vz);




  ret.drop_hurt /**/ = el.get_num("drop_hurt");
  ret.hit_sounds /**/ = el.get_str_arr("hit_sounds");
  ret.drop_sounds /**/ = el.get_str_arr("drop_sounds");
  ret.dead_sounds /**/ = el.get_str_arr("dead_sounds");

  ret.bot_id = el.get_str("bot_id") ?? el.child_by_tag("bot")?.get_str("id");


  // portraits
  const portraits: Record<string, any> = {};
  for (const p of el.children_by_tag("portrait")) {
    const name = p.get_str("name") ?? "";
    portraits[name] = {
      tex: p.get_str("tex") ?? "0",
      x: p.get_num("x") ?? 0,
      y: p.get_num("y") ?? 0,
      w: p.get_num("w") ?? 0,
      h: p.get_num("h") ?? 0
    };
  }
  if (Object.keys(portraits).length) ret.portraits = portraits as any;


  // drink / armor
  const drinkEl = el.child_by_tag("drink");
  if (drinkEl) ret.drink = xml_2_drink_info(drinkEl);
  const armorEl = el.child_by_tag("armor");
  if (armorEl) ret.armor = xml_2_armor_info(armorEl);

  // models
  const models: Record<string, any> = {};
  for (const m of el.children_by_tag("model")) {
    const name = m.get_str("name") ?? m.get_str("id") ?? "";
    const model: any = {
      id: m.get_str("id") ?? name,
      path: m.get_str("path") ?? "",
      variants: m.strs_attr("variants"),
    };
    const scale = m.nums_attr_soft("scale");
    if (scale?.some(v => v !== void 0)) model.scale = { x: scale[0], y: scale[1], z: scale[2] };
    const quat = m.nums_attr_soft("quaternion");
    if (quat?.some(v => v !== void 0)) model.quaternion = { x: quat[0], y: quat[1], z: quat[2], w: quat[3] };
    models[name] = model;
  }
  if (Object.keys(models).length) ret.models = models as any;


  // brokens (<opoint> children)
  const opointEls = el.children_by_tag("opoint");
  if (opointEls.length) {
    ret.brokens = opointEls.map(v => xml_2_opoint(v));
  }

  // dataset overrides
  const ds = xml_to_world_dataset(el.child_by_tag("dataset"));
  for (const k of Object.keys(ds)) (ret as any)[k] = (ds as any)[k];

  return ret;
}

