import { FrameId, Defines, FrameBehavior, SpeedMode, WeaponEnum } from "../defines";
import { EntityEnum } from "../defines/EntityEnum";
import type { IDatContext } from "../defines/IDatContext";
import type { IEntityData } from "../defines/IEntityData";
import type { IFrameIndexes } from "../defines/IFrameIndexes";
import { traversal } from "../utils/container_help/traversal";
import { round_float } from "../utils/math/round_float";
import { to_num } from "../utils/type_cast/to_num";
import { get_next_frame_by_raw_id } from "./get_the_next";
import { make_itr_prefabs } from "./make_itr_prefabs";
import { take } from "./take";

const indexes_map: Record<WeaponEnum, IFrameIndexes> = {
  [WeaponEnum.None]: {
    on_ground: "",
    just_on_ground: "",
    throw_on_ground: "",
  },
  [WeaponEnum.Stick]: {
    on_ground: "60",
    just_on_ground: "70",
    throw_on_ground: "71",
  },
  [WeaponEnum.Heavy]: {
    on_ground: "20",
    just_on_ground: "21",
    throw_on_ground: "71",
  },
  [WeaponEnum.Knife]: {
    on_ground: "60",
    just_on_ground: "70",
    throw_on_ground: "71",
  },
  [WeaponEnum.Baseball]: {
    on_ground: "60",
    just_on_ground: "70",
    throw_on_ground: "71",
  },
  [WeaponEnum.Drink]: {
    on_ground: "60",
    just_on_ground: "70",
    throw_on_ground: "71",
  },
};

export function make_weapon_data(ctx: IDatContext): IEntityData {
  const { base: info, frames, text: full_str, index: datIndex } = ctx
  info.name = datIndex.hash ?? datIndex.file.split('/').slice(-1)[0].replace(/[^a-z|A-Z|0-9|_]/g, "-").replace(/-obj-json5$/, '');
  switch ('' + datIndex.type) {
    case "1":
      info.type = {
        "120": WeaponEnum.Knife, // Knife
        "124": WeaponEnum.Knife, // Boomerang
      }["" + datIndex.id] ?? WeaponEnum.Stick;
      break;
    case "2":
      info.type = WeaponEnum.Heavy;
      break;
    case "4":
      info.type = WeaponEnum.Baseball;
      break;
    case "6":
      info.type = WeaponEnum.Drink;
      break;
  }

  const itr_prefabs = make_itr_prefabs(full_str);
  const indexes =
    indexes_map[info.type as WeaponEnum] ??
    indexes_map[WeaponEnum.None];
  const sound_1 = take(info, "weapon_broken_sound");
  if (sound_1) info.dead_sounds = [sound_1.replace(/\\/g, '/') + ".mp3"];

  const sound_2 = take(info, "weapon_drop_sound");
  if (sound_2) info.drop_sounds = [sound_2.replace(/\\/g, '/') + ".mp3"];

  const sound_3 = take(info, "weapon_hit_sound");
  if (sound_3) info.hit_sounds = [sound_3.replace(/\\/g, '/') + ".mp3"];

  const drop_hurt = take(info, "weapon_drop_hurt");
  if (drop_hurt && Number(drop_hurt)) info.drop_hurt = Number(drop_hurt);

  const weapon_hp = take(info, "weapon_hp");
  if (weapon_hp && Number(weapon_hp)) info.hp_max = Number(weapon_hp);

  traversal(frames, (k, frame) => {
    const hit_j = take(frame, "hit_j");
    if (hit_j !== 0) {
      frame.vzm = SpeedMode.Extra
      frame.acc_z = round_float((to_num(hit_j, 50) - 50) / 2);
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
  })

  const ret: IEntityData = {
    id: datIndex.id,
    on_dead: Defines.NEXT_FRAME_GONE,
    type: EntityEnum.Weapon,
    base: info,
    itr_prefabs,
    frames,
    indexes,
    processed: false,
  };
  return ret;
}
