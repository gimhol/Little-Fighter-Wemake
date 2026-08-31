import { sound_play_info_new, stage_phase_info_fields, stage_phase_info_new, type ISoundPlayInfo, type IStagePhaseInfo } from "../../defines/IStagePhaseInfo";
import type { IXML, IXMLElement } from "../../ditto/xml";
import { reorder_fields } from "../../fields";
import { delete_undefined } from "./delete_undefined";
import { xml_2_dialog_info, xml_x_dialog_info } from "./xml_x_dialog_info";
import { xml_2_difficulty_map, xml_x_difficulty_map } from "./xml_x_difficulty_map";
import { xml_2_non_empty, xml_x_non_empty } from "./xml_x_non_empty";
import { xml_2_stage_object_info, xml_x_stage_object_info } from "./xml_x_stage_object_info";

export function xml_x_sound_play_info(xml: IXML, s: ISoundPlayInfo, tag: string): IXMLElement
export function xml_x_sound_play_info(xml: IXML, s: ISoundPlayInfo | undefined | null, tag: string): IXMLElement | undefined
export function xml_x_sound_play_info(xml: IXML, s: ISoundPlayInfo | undefined | null, tag: string): IXMLElement | undefined {
  if (!s || s.path.trim()) return;
  const el = xml.create(tag);
  el.set_attr("path", s.path);
  el.set_attr("x", s.x);
  el.set_attr("y", s.y);
  el.set_attr("z", s.z);
  el.set_attr("desc", s.desc);
  return el;
}
export function xml_2_sound_play_info(el: IXMLElement): ISoundPlayInfo {
  const ret = sound_play_info_new();
  ret.path /**/ = el.get_str("path", ret.path);
  ret.x    /**/ = el.get_num("x", ret.x);
  ret.y    /**/ = el.get_num("y", ret.y);
  ret.z    /**/ = el.get_num("z", ret.z);
  ret.desc /**/ = el.get_str("desc", ret.desc);
  return ret;
}


export function xml_x_stage_phase_info(xml: IXML, p: IStagePhaseInfo, tag: string): IXMLElement {
  const el = xml.create(tag);
  el.set_attr("title", p.title);
  el.set_attr("desc", p.desc);
  el.set_attr("bound", p.bound);
  el.set_attr("player_l", p.player_l);
  el.set_attr("player_r", p.player_r);
  el.set_attr("camera_l", p.camera_l);
  el.set_attr("camera_r", p.camera_r);
  el.set_attr("enemy_l", p.enemy_l);
  el.set_attr("enemy_r", p.enemy_r);
  el.set_attr("drink_l", p.drink_l);
  el.set_attr("drink_r", p.drink_r);
  el.set_attr("music", p.music);

  el.set_attr("cam_jump_to_x", p.cam_jump_to_x);
  el.set_attr("player_jump_to_x", p.player_jump_to_x);
  el.set_attr("player_jump_to_z", p.player_jump_to_z);
  el.set_attr("player_facing", p.player_facing);

  el.set_attr("end_test", p.end_test);
  el.set_attr("on_start", p.on_start);
  el.set_attr("on_end", p.on_end);
  el.set_attr("hide_stats", p.hide_stats);
  el.set_attr("world_pause", p.world_pause);
  el.set_attr("control_disabled", p.control_disabled);
  el.set_attr("weapon_rain_disabled", p.weapon_rain_disabled);

  xml_x_difficulty_map(el, "respawn", p.respawn);
  xml_x_difficulty_map(el, "respawn_r", p.respawn_r);
  xml_x_difficulty_map(el, "respawn_x", p.respawn_x);
  xml_x_difficulty_map(el, "health_up", p.health_up);
  xml_x_difficulty_map(el, "mp_up", p.mp_up);
  xml_x_non_empty(xml, p.sounds, "sound", xml_x_sound_play_info, el)
  xml_x_non_empty(xml, p.objects, "object", xml_x_stage_object_info, el);
  xml_x_non_empty(xml, p.dialogs, "dialog", xml_x_dialog_info, el);
  return el;
}

export function xml_2_stage_phase_info(el: IXMLElement): IStagePhaseInfo {
  const ret = stage_phase_info_new();
  ret.title    /**/ = el.get_str("title", ret.title);
  ret.desc     /**/ = el.get_str("desc", ret.desc);
  ret.music    /**/ = el.get_str("music", ret.music);
  ret.bound    /**/ = el.get_num("bound", ret.bound);
  ret.player_l /**/ = el.get_num("player_l", ret.player_l);
  ret.player_r /**/ = el.get_num("player_r", ret.player_r);
  ret.camera_l /**/ = el.get_num("camera_l", ret.camera_l);
  ret.camera_r /**/ = el.get_num("camera_r", ret.camera_r);
  ret.enemy_l  /**/ = el.get_num("enemy_l", ret.enemy_l);
  ret.enemy_r  /**/ = el.get_num("enemy_r", ret.enemy_r);
  ret.drink_l  /**/ = el.get_num("drink_l", ret.drink_l);
  ret.drink_r  /**/ = el.get_num("drink_r", ret.drink_r);

  ret.cam_jump_to_x    /**/ = el.get_num("cam_jump_to_x", ret.cam_jump_to_x);
  ret.player_jump_to_x /**/ = el.get_num("player_jump_to_x", ret.player_jump_to_x);
  ret.player_jump_to_z /**/ = el.get_num("player_jump_to_z", ret.player_jump_to_z);
  ret.player_facing    /**/ = el.get_num("player_facing", ret.player_facing);

  ret.end_test             /**/ = el.get_str_arr("end_test", ret.end_test);
  ret.on_start             /**/ = el.get_str_arr("on_start", ret.on_start);
  ret.on_end               /**/ = el.get_str_arr("on_end", ret.on_end);
  ret.hide_stats           /**/ = el.get_num("hide_stats", ret.hide_stats);
  ret.world_pause          /**/ = el.get_num("world_pause", ret.world_pause);
  ret.control_disabled     /**/ = el.get_num("control_disabled", ret.control_disabled);
  ret.weapon_rain_disabled /**/ = el.get_num("weapon_rain_disabled", ret.weapon_rain_disabled);

  // difficulty maps
  ret.respawn   /**/ = xml_2_difficulty_map(el, "respawn");
  ret.respawn_r /**/ = xml_2_difficulty_map(el, "respawn_r");
  ret.respawn_x /**/ = xml_2_difficulty_map(el, "respawn_x");
  ret.health_up /**/ = xml_2_difficulty_map(el, "health_up");
  ret.mp_up     /**/ = xml_2_difficulty_map(el, "mp_up");

  xml_2_non_empty(el, "sound", xml_2_sound_play_info);
  xml_2_non_empty(el, "object", xml_2_stage_object_info);
  xml_2_non_empty(el, "dialog", xml_2_dialog_info);

  delete_undefined(ret);
  reorder_fields(ret, stage_phase_info_fields);
  return ret;
}

