import { E_Val as EV, OID, StateEnum, type IEntityData } from "../../defines";
import { CondMaker } from "../CondMaker";

/**
 *
 * @todo
 * @export
 * @param {IEntityData} data
 * @return {IEntityData}
 */
export function make_fighter_data_rudolf(data: IEntityData): IEntityData {
  data.pre_hitkeys ??= {
    ja: {
      reset_keys: 1,
      transfrom_to_another: 1,
      expression: new CondMaker<EV>()
        .add(EV.TransformListSize, '==', 2)
        .and(EV.IsOnGround, '==', 1)
        .and(EV.TransformIndex, '==', 1)
        .done()
    }
  }
  for (const k in data.frames) {
    const frame = data.frames[k]
    frame.opoint?.forEach((opoint) => {
      if (opoint.oid === OID.Rudolf) {
        opoint.hp = opoint.max_hp = 20;
        opoint.mp = opoint.max_mp = 150;
      }
    });
    if (
      frame.state === StateEnum.Standing ||
      frame.state === StateEnum.Walking ||
      frame.state === StateEnum.Defend
    ) {
      frame.seqs = frame.seqs || {}
      frame.seqs[`LRa`] = {
        id: "70",
        mp: 60,
        facing: 1,
      }
      frame.seqs[`RLa`] = {
        id: "70",
        mp: 60,
        facing: -1,
      }
    }
  }

  return data;
}
