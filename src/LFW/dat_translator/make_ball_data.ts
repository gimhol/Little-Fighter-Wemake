import { FrameBehavior } from "../defines";
import { EntityEnum } from "../defines/EntityEnum";
import type { IDatContext } from "../defines/IDatContext";
import type { IEntityData } from "../defines/IEntityData";
import { SpeedMode } from "../defines/SpeedMode";
import { round_float } from "../utils";
import { traversal } from "../utils/container_help/traversal";
import { to_num } from "../utils/type_cast/to_num";
import { get_next_frame_by_raw_id } from "./get_the_next";
import { take, take_str } from "./take";

export function make_ball_data(ctx: IDatContext): IEntityData {
  const { base: info, frames, index: datIndex } = ctx

  info.name = datIndex.hash ?? datIndex.file.split('/').slice(-1)[0].replace(/[^a-z|A-Z|0-9|_]/g, "-").replace(/-obj-json5$/, '');
  info.hp_max = 500;

  let weapon_broken_sound = take_str(info, "weapon_broken_sound");
  if (weapon_broken_sound) {
    weapon_broken_sound = (weapon_broken_sound + ".mp3").replace(/\\/g, '/');
    info.dead_sounds = [weapon_broken_sound];
  }

  let weapon_hit_sound = take_str(info, "weapon_hit_sound");
  if (weapon_hit_sound) {
    weapon_hit_sound = (weapon_hit_sound + ".mp3").replace(/\\/g, '/');
    info.hit_sounds = [weapon_hit_sound];
  }

  const ret: IEntityData = {
    id: datIndex.id,
    type: EntityEnum.Ball,
    base: info,
    frames: frames,
    processed: false,
  };
  traversal(ret.frames, (_, frame) => {
    const hit_j = take(frame, "hit_j");
    if (hit_j !== 0) {
      frame.vzm = SpeedMode.Extra
      frame.acc_z = round_float((to_num(hit_j, 50) - 50));
    }
    const hit_a = take(frame, "hit_a");
    if (hit_a) frame.hp = round_float(hit_a / 2, 10);

    const hit_d = take(frame, "hit_d");
    if (hit_d && hit_d !== frame.id)
      frame.on_dead = get_next_frame_by_raw_id(hit_d, 'frame');
    const hit_Fa = take(frame, "hit_Fa");
    if (hit_Fa) {
      frame.behavior = hit_Fa;
      (frame as any).behavior_name = `FrameBehavior.` + FrameBehavior[hit_Fa];
    }
  });

  return ret;
}

