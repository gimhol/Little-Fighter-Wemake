import type { IStagePhaseInfo } from "../../defines/IStagePhaseInfo";
import type { IXMLElement, IXML } from "../../ditto/xml";
import { write_diff_map } from "./diff_map_utils";
import { xml_from_dialog_info } from "./xml_from_dialog_info";
import { xml_from_stage_object_info } from "./xml_from_stage_object_info";

/**
 * 序列化 <phase>
 */
export function xml_from_stage_phase_info(xml: IXML, p: IStagePhaseInfo): IXMLElement {
  const el = xml.create("phase");

  el.set_attr("title", p.title);
  el.set_attr("desc", p.desc);
  el.set_attr("music", p.music);

  el.set_attr("bound", p.bound);
  el.set_attr("player_l", p.player_l);
  el.set_attr("player_r", p.player_r);
  el.set_attr("camera_l", p.camera_l);
  el.set_attr("camera_r", p.camera_r);
  el.set_attr("enemy_l", p.enemy_l);
  el.set_attr("enemy_r", p.enemy_r);
  el.set_attr("drink_l", p.drink_l);
  el.set_attr("drink_r", p.drink_r);
  el.set_attr("cam_jump_to_x", p.cam_jump_to_x);
  el.set_attr("player_jump_to_x", p.player_jump_to_x);
  el.set_attr("player_jump_to_z", p.player_jump_to_z);
  el.set_attr("player_facing", p.player_facing as number);

  write_diff_map(el, "respawn", p.respawn as Record<number, number>);
  write_diff_map(el, "respawn_r", p.respawn_r as Record<number, number>);
  write_diff_map(el, "respawn_x", p.respawn_x as Record<number, number>);
  write_diff_map(el, "health_up", p.health_up as Record<number, number>);
  write_diff_map(el, "mp_up", p.mp_up as Record<number, number>);

  el.set_attr("end_test", p.end_test);
  el.set_attr("on_start", p.on_start);
  el.set_attr("on_end", p.on_end);
  el.set_attr("hide_stats", p.hide_stats);
  el.set_attr("world_pause", p.world_pause);
  el.set_attr("control_disabled", p.control_disabled);
  el.set_attr("weapon_rain_disabled", p.weapon_rain_disabled);

  if (p.sounds?.length) {
    const soundsEl = xml.create("sounds");
    for (const s of p.sounds) {
      const sEl = xml.create("sound");
      sEl.set_attr("path", s.path);
      if (s.x !== void 0) sEl.set_attr("x", s.x);
      if (s.y !== void 0) sEl.set_attr("y", s.y);
      if (s.z !== void 0) sEl.set_attr("z", s.z);
      soundsEl.insert(sEl);
    }
    el.insert(soundsEl);
  }

  if (p.objects?.length) {
    for (const o of p.objects) {
      el.insert(xml_from_stage_object_info(xml, o));
    }
  }

  if (p.dialogs?.length) {
    for (const d of p.dialogs) {
      el.insert(xml_from_dialog_info(xml, d));
    }
  }

  return el;
}
