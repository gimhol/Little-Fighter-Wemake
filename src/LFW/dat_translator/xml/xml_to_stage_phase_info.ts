import type { IStagePhaseInfo } from "../../defines/IStagePhaseInfo";
import type { IXMLElement } from "../../ditto/xml/IXMLElement";
import { parse_diff_map } from "./diff_map_utils";
import { xml_to_dialog_info } from "./xml_to_dialog_info";
import { xml_to_stage_object_info } from "./xml_to_stage_object_info";

/**
 * 解析 <phase> → IStagePhaseInfo
 */
export function xml_to_stage_phase_info(el: IXMLElement): IStagePhaseInfo {
  const ret: IStagePhaseInfo = {
    bound: el.num_attr("bound") ?? 0,
  };

  ret.title = el.get_str("title");
  ret.desc = el.get_str("desc");
  ret.music = el.get_str("music");

  ret.player_l = el.num_attr("player_l");
  ret.player_r = el.num_attr("player_r");
  ret.camera_l = el.num_attr("camera_l");
  ret.camera_r = el.num_attr("camera_r");
  ret.enemy_l = el.num_attr("enemy_l");
  ret.enemy_r = el.num_attr("enemy_r");
  ret.drink_l = el.num_attr("drink_l");
  ret.drink_r = el.num_attr("drink_r");
  ret.cam_jump_to_x = el.num_attr("cam_jump_to_x");
  ret.player_jump_to_x = el.num_attr("player_jump_to_x");
  ret.player_jump_to_z = el.num_attr("player_jump_to_z");
  ret.player_facing = el.num_attr("player_facing") as (1 | -1) | undefined;

  ret.end_test = el.strs_attr("end_test");
  ret.on_start = el.strs_attr("on_start");
  ret.on_end = el.strs_attr("on_end");
  ret.hide_stats = el.num_attr("hide_stats");
  ret.world_pause = el.num_attr("world_pause");
  ret.control_disabled = el.num_attr("control_disabled");
  ret.weapon_rain_disabled = el.num_attr("weapon_rain_disabled");

  // sounds
  const soundsEl = el.child_by_tag("sounds");
  if (soundsEl) {
    const soundEls = soundsEl.children_by_tag("sound");
    if (soundEls.length) {
      ret.sounds = soundEls.map(s => ({
        path: s.get_str("path") ?? "",
        x: s.num_attr("x"),
        y: s.num_attr("y"),
        z: s.num_attr("z"),
      }));
    }
  }

  // objects
  const objs = el.children_by_tag("object");
  if (objs.length) {
    ret.objects = objs.map(o => xml_to_stage_object_info(o));
  }

  // dialogs
  const dialogEls = el.children_by_tag("dialog");
  if (dialogEls.length) {
    ret.dialogs = dialogEls.map(d => xml_to_dialog_info(d));
  }

  // difficulty maps
  ret.respawn = parse_diff_map(el, "respawn");
  ret.respawn_r = parse_diff_map(el, "respawn_r");
  ret.respawn_x = parse_diff_map(el, "respawn_x");
  ret.health_up = parse_diff_map(el, "health_up");
  ret.mp_up = parse_diff_map(el, "mp_up");

  return ret;
}
