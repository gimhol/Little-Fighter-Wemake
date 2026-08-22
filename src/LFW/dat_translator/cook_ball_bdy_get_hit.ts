import { type IBdyInfo, CollisionVal as C_Val, ItrKind, EntityEnum, StateEnum, OID, ActionType } from "../defines";
import type { IBdyInfoContext } from "../loader/IEntityDataContext";
import { CondMaker } from "./CondMaker";
import { EditBdy } from "./EditBdy";


export function cook_ball_bdy_get_hit(ctx: IBdyInfoContext): IBdyInfo {
  const { bdy } = ctx;

  /* 被打消失的条件 */
  const cond = new CondMaker<C_Val>()
  cond.add(C_Val.ItrKind, '==', ItrKind.Normal)
  cond.and((c) => {
    /* 被 ball 打 */
    c.add(C_Val.AttackerType, "==", EntityEnum.Ball)
    /* 被 武器 打 */
    c.or(c => c
      .add(C_Val.AttackerType, "==", EntityEnum.Weapon)
      .and(C_Val.AttackerState, "!=", StateEnum.Weapon_OnHand)
    )
    if (ctx.data.id == OID.FreezeColumn) {
      /* 
      NOTE: 冰柱能被自己队伍物品相同朝向的 打到似乎是特殊ID的缘故 -Gim
      */
      c.or(C_Val.AttackerType, "==", EntityEnum.Fighter)
    } else {
      /* 被 “火跑” 打 */
      c.or(c => c
        .add(C_Val.AttackerType, "==", EntityEnum.Fighter)
        .and(C_Val.AttackerState, "==", StateEnum.BurnRun)
      )
    }
    return c;
  });
  if (ctx.data.id === OID.FreezeBall)
    cond.and(C_Val.AttackerIsFreezableBall, '!=', 1);

  return EditBdy.clone(bdy, {
    /* 受攻击判定 */
    test: cond.done(),
    actions: [{
      type: ActionType.V_NEXT_FRAME,
      data: {
        id: "20"
      }
    }]
  }).confirm();
}
