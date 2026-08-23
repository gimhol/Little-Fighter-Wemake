import { type IBdyInfo, ActionType, C_Val, E_E, HitFlag, I_K, ItrEffect, S_E } from "../defines";
import type { IBdyInfoContext } from "../loader/IEntityDataContext";
import { CondMaker } from "./CondMaker";
import { EditBdy } from "./EditBdy";

/**
 * 拷贝一份bdy，将其改为响应反弹的bdy
 *
 * @export
 * @param {IBdyInfo} bdy 源bdy
 * @return {IBdyInfo} 新的bdy
 */
export function cook_ball_bdy_get_hit_to_frame_30(ctx: IBdyInfoContext): IBdyInfo {
  const { bdy } = ctx;
  return EditBdy.clone(bdy, {
    /* 反弹判定 */
    hit_flag: HitFlag.AllBoth,
    test: new CondMaker<C_Val>()
      .add(C_Val.ItrKind, '==', I_K.JohnShield)
      .or((co) => co
        .one_of(C_Val.ItrKind, I_K.Normal, I_K.CharacterThrew, I_K.WeaponSwing)
        .and(co => co
          .add(co => co
            // 敌队
            .add(C_Val.SameTeam, "==", 0)
            .and(co => co
              // 角色
              .add(C_Val.AttackerType, "==", E_E.Fighter)
              // 持有武器
              .or(co => co
                .add(C_Val.AttackerType, "==", E_E.Weapon)
                .and(C_Val.AttackerState, "==", S_E.Weapon_OnHand)
              )
            )
          ).or((c) => c
            // 同队，攻击必须相向
            .add(C_Val.SameTeam, "==", 1)
            .and(C_Val.SameFacing, "==", 0)
            .and(co => co
              // 角色
              .add(C_Val.AttackerType, "==", E_E.Fighter)
              // 持有武器
              .or(co => co
                .add(C_Val.AttackerType, "==", E_E.Weapon)
                .and(C_Val.AttackerState, "==", S_E.Weapon_OnHand)
              ))
          )
        )
      )
      .done(),
    actions: [{
      type: ActionType.V_NEXT_FRAME,
      data: {
        id: "30"
      }
    }]
  }).confirm()
}
