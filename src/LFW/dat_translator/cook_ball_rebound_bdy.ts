import { type IBdyInfo, ActionType, CollisionVal as C_Val, EntityEnum, HitFlag, ItrEffect, ItrKind, StateEnum } from "../defines";
import { CondMaker } from "./CondMaker";
import { EditBdy } from "./EditBdy";
import { set_hit_flag } from "./set_hit_flag";

export function cook_ball_rebound_bdy(bdy: IBdyInfo) {
  return EditBdy.clone(bdy, {
    /* 反弹判定 */
    ...set_hit_flag({}, HitFlag.AllBoth),
    test: new CondMaker<C_Val>()
      .wrap((c) => c
        // 敌方角色的攻击反弹气功波
        .add(C_Val.SameTeam, "==", 0)
        .and(C_Val.AttackerType, "==", EntityEnum.Fighter)
        .and(C_Val.ItrEffect, "!=", ItrEffect.Ice)
        .and(C_Val.ItrEffect, "!=", ItrEffect.MFire1)
      )
      .or((c) => c
        // 队友角色的攻击必须相向才能反弹气功波
        .add(C_Val.SameTeam, "==", 1)
        .and(C_Val.AttackerType, "==", EntityEnum.Fighter)
        .and(C_Val.SameFacing, "==", 0)
        .and(C_Val.ItrEffect, "!=", ItrEffect.Ice)
      )
      .or(C_Val.ItrKind, "==", ItrKind.JohnShield)
      .or((c) => c
        // 队友角色的攻击 挥动武器(必须相向) 反弹气功波
        .add(C_Val.SameTeam, "==", 1)
        .and(C_Val.SameFacing, "==", 0)
        .and(C_Val.AttackerType, "==", EntityEnum.Weapon)
        .and(C_Val.AttackerState, "==", StateEnum.Weapon_OnHand)
      )
      .or((c) => c
        // 敌人角色的攻击 挥动武器 反弹气功波
        .add(C_Val.SameTeam, "==", 0)
        .and(C_Val.AttackerType, "==", EntityEnum.Weapon)
        .and(C_Val.AttackerState, "==", StateEnum.Weapon_OnHand)
      )
      .and().not_in(
        C_Val.ItrKind,
        ItrKind.Block,
        ItrKind.MagicFlute,
        ItrKind.MagicFlute2,
        ItrKind.Pick,
        ItrKind.PickSecretly
      )
      .and().not_in(
        C_Val.ItrEffect,
        ItrEffect.Ice2,
        ItrEffect.MFire1
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
