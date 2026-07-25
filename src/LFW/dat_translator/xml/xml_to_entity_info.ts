import { entity_info_new, type IEntityInfo } from "../../defines/IEntityInfo";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { xml_to_armor_info } from "./xml_to_armor_info";
import { xml_to_drink_info } from "./xml_to_drink_info";
import { xml_to_opoint } from "./xml_to_opoint";
import { xml_to_world_dataset } from "./xml_to_world_dataset";


export function xml_to_entity_info(el: IXMLElement | undefined): IEntityInfo {
  const ret = entity_info_new();
  if (!el) return ret;

  ret.name = el.get_str("name", ret.name);
  ret.head = el.get_str("head", ret.head);
  ret.small = el.get_str("small", ret.small);

  // type
  const type = el.get_num("type") ?? el.get_str("type") as any;
  if (type !== void 0) ret.type = type;

  ret.ce = el.get_num("ce", ret.ce);
  ret.weight = el.get_num("weight", ret.weight);
  ret.strength = el.get_num("strength", ret.strength);

  // bounce / bounce_min / fast 支持 nums_attr_soft 快捷属性 (x,y,z 顺序)
  const apply3 = (prefix: string, keyX: keyof IEntityInfo, keyY: keyof IEntityInfo, keyZ: keyof IEntityInfo) => {
    const nums = el.nums_attr_soft(prefix);
    if (nums) {
      if (nums[0] !== void 0) (ret as any)[keyX] = nums[0];
      if (nums[1] !== void 0) (ret as any)[keyY] = nums[1];
      if (nums[2] !== void 0) (ret as any)[keyZ] = nums[2];
    }
  };
  apply3("bounce", "bounce_x", "bounce_y", "bounce_z");
  apply3("bounce_min", "bounce_min_x", "bounce_min_y", "bounce_min_z");
  apply3("fast", "fast_vx", "fast_vy", "fast_vz");
  ret.bounce_y = el.get_num("bounce_y") ?? ret.bounce_y;
  ret.bounce_x = el.get_num("bounce_x") ?? ret.bounce_x;
  ret.bounce_z = el.get_num("bounce_z") ?? ret.bounce_z;
  ret.bounce_min_y = el.get_num("bounce_min_y") ?? ret.bounce_min_y;
  ret.bounce_min_x = el.get_num("bounce_min_x") ?? ret.bounce_min_x;
  ret.bounce_min_z = el.get_num("bounce_min_z") ?? ret.bounce_min_z;
  ret.fast_vy = el.get_num("fast_vy") ?? ret.fast_vy;
  ret.fast_vx = el.get_num("fast_vx") ?? ret.fast_vx;
  ret.fast_vz = el.get_num("fast_vz") ?? ret.fast_vz;
  ret.drop_hurt = el.get_num("drop_hurt");
  ret.resting_max = el.get_num("resting_max");

  // string arrays
  ret.group = el.strs_attr("group");
  ret.hit_sounds = el.strs_attr("hit_sounds");
  ret.drop_sounds = el.strs_attr("drop_sounds");
  ret.dead_sounds = el.strs_attr("dead_sounds");

  // bot_id (text attr or child element)
  ret.bot_id = el.get_str("bot_id") ?? el.child_by_tag("bot")?.get_str("id");

  // files
  const files: Record<string, any> = {};
  for (const f of el.children_by_tag("file")) {
    const name = f.get_str("name") ?? f.get_str("id") ?? "";
    files[name] = {
      id: f.get_str("id") ?? name,
      path: f.get_str("path") ?? f.get_str("src") ?? "",
      row: f.get_num("row"),
      col: f.get_num("col"),
      cell_w: f.get_num("cell_w"),
      cell_h: f.get_num("cell_h"),
      variants: f.get_str_arr("variants"),
    };
  }
  if (Object.keys(files).length) ret.files = files as any;


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
  if (drinkEl) ret.drink = xml_to_drink_info(drinkEl);
  const armorEl = el.child_by_tag("armor");
  if (armorEl) ret.armor = xml_to_armor_info(armorEl);

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
    ret.brokens = opointEls.map(v => xml_to_opoint(v));
  }

  // dataset overrides
  const ds = xml_to_world_dataset(el.child_by_tag("dataset"));
  for (const k of Object.keys(ds)) (ret as any)[k] = (ds as any)[k];

  return ret;
}
