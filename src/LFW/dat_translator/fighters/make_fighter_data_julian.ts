import { ArmorEnum, OID, Defines, EntityGroup, type IEntityData } from "../../defines";
import { ensure } from "../../utils";

export function make_fighter_data_julian(data: IEntityData) {
  data.base.strength = Defines.FIGHTER_STREAGTH_STRONG
  data.base.group = ensure(data.base.group, EntityGroup.Boss);
  data.base.mp_r_ratio = 2;
  data.base.ce = 3;
  data.base.armor = {
    fireproof: 1,
    antifreeze: 1,
    hit_sounds: ["data/002.wav.mp3"],
    type: ArmorEnum.Fall,
    toughness: 41,
    toughness_resting: 1,
  };
  for (const k in data.frames) {
    data.frames[k].opoint?.forEach((opoint) => {
      if (opoint.oid === OID.Julian) {
        opoint.hp = opoint.max_hp = 20;
        opoint.mp = opoint.max_mp = 150;
      }
    });
  }
  return data;
}
