import { type IBdyInfo, ActionType, C_Val, E_E, I_K, OID, S_E } from "../defines";
import type { IBdyInfoContext } from "../loader/IEntityDataContext";
import { CondMaker } from "./CondMaker";
import { EditBdy } from "./EditBdy";

/**
 * 被打跳转20的bdy
 * 
 * NOTE: 
 *    冰柱(id=212, state=3000) 
 *      能被相同朝向的自己队伍打到, 
 *    冰柱(id=212, state=15) 
 *      能被相同朝向的自己队伍打到,
 *      却不会被自己的(id=212, state=15)打到
 *    应该是特殊ID硬编码 
 *      -Gim
 */
export function cook_ball_bdy_get_hit_to_frame_20(ctx: IBdyInfoContext): IBdyInfo {
  const { bdy } = ctx;

  /* 被打消失的条件 */
  const co = new CondMaker<C_Val>()
  if (ctx.data.id == OID.FreezeColumn) {
    co.add(C_Val.AEmitter, "!=", C_Val.VEmitter)
      .and(C_Val.ItrKind, '==', I_K.Normal)
  } else {
    co.add(C_Val.ItrKind, '==', I_K.Normal)
      .and((c) => {
        /* 被 ball 打 */
        c.add(C_Val.AttackerType, "==", E_E.Ball)
        c.or(C_Val.AttackerType, "==", E_E.Entity)
        /* 被 武器 打 */
        c.or(c => c
          .add(C_Val.AttackerType, "==", E_E.Weapon)
          .and(C_Val.AttackerState, "!=", S_E.Weapon_OnHand)
        )
        /* 被 “火跑” 打 */
        c.or(c => c
          .add(C_Val.AttackerType, "==", E_E.Fighter)
          .and(C_Val.AttackerState, "==", S_E.BurnRun)
        )
      });
  }
  if (ctx.data.id === OID.FreezeBall)
    co.and(C_Val.AttackerIsFreezableBall, '!=', 1);
  return EditBdy.clone(bdy, {
    /* 受攻击判定 */
    test: co.done(),
    actions: [{
      type: ActionType.V_NEXT_FRAME,
      data: {
        id: "20"
      }
    }]
  }).confirm();
}
