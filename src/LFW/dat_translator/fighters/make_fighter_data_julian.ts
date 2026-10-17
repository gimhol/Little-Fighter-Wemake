import { ArmorEnum, OID, Defines, EntityGroup, type IEntityData } from "../../defines";
import { ensure } from "../../utils";

export function make_fighter_data_julian(data: IEntityData) {
  data.base.group = ensure(data.base.group, EntityGroup.Boss);
  data.base.mp_r_ratio = 2;
  data.base.ce = 3;
  data.base.bg_face ??= "sprite/MENU_BACK10.png";
  data.base.armor = {
    fireproof: 1,
    antifreeze: 1,
    hit_sounds: ["data/002.wav.mp3"],
    type: ArmorEnum.Defend,
    toughness: 60,
    toughness_resting: 18,
  };
  for (const k in data.frames) {
    data.frames[k].opoint?.forEach((opoint) => {
      if (opoint.oid === OID.Julian) {
        opoint.hp = opoint.max_hp = 20;
        opoint.mp = opoint.max_mp = 150;
      }
      if (opoint.oid === OID.JulianBall2) {
        // D>J 的球：发射时按住上下键给它一个 Z 初速（`Entity.on_spawn` 里的 `speedz * ud`），
        // 没按上下键时 `ud` 为 0 ⇒ 还是直着飞
        opoint.speedz = Defines.DEFAULT_OPOINT_SPEED_Z;
      }
    });
  }
  return data;
}
