import { ActionType, ArmorEnum, EntityVal, HitFlag, type IAction_VBuff, type IEntityData } from "../../defines";
import { traversal } from "../../utils";
import { CondMaker } from "../CondMaker";

/**
 *
 * @export
 * @param {IEntityData} data
 * @return {IEntityData} 
 */
export function make_fighter_data_louis(data: IEntityData): IEntityData {
  data.base.armor = {
    hit_sounds: ["data/085.wav.mp3"],
    type: ArmorEnum.Times,
    fulltime: false,
    toughness: 1,
    toughness_resting: 90,
  };

  traversal(data.frames, (k, frame) => {
    const n = Number(k);
    if (n >= 85 && n <= 95) {
      // run-atk ~ dash-atk
      frame.itr?.forEach(itr => {
        if (itr.kind !== 0) return;
        if (itr.effect) return;
        const action: IAction_VBuff = {
          type: ActionType.V_BUFF,
          data: {
            hitflag: HitFlag.EnemyFighter | HitFlag.AllyFighter,
            duration: 200,
            buff: "Electroshock"
          }
        }
        itr.actions ||= []
        itr.actions.push(action)
      })
    }

    const ja = frame.seqs?.["ja"];
    if (ja) {
      const jas = Array.isArray(ja) ? ja : [ja]
      for (const ja of jas) {
        if (!("id" in ja) || ja.id !== "300")
          continue;
        ja.expression = new CondMaker()
          .add(EntityVal.HP_P, "<=", 33)
          .or(EntityVal.LF2_NET_ON, "==", 1)
          .done();
      }
    }
  })
  return data;
}


