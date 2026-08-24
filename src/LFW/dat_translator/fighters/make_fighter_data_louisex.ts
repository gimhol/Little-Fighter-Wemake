import { ActionType, Defines, EntityGroup, HitFlag, type IAction_VBuff, type IEntityData } from "../../defines";
import { ensure, traversal } from "../../utils";

/**
 * @param data 
 * @returns 
 */
export function make_fighter_data_louisex(data: IEntityData): IEntityData {
  data.base.group = ensure(data.base.group, EntityGroup.Boss);

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
            duration: 400,
            buff: "Electroshock"
          }
        }
        itr.actions ||= []
        itr.actions.push(action)
      })
    }
  })
  return data;
}
