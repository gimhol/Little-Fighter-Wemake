import { OID, StateEnum } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { CollisionVal as C_Val } from "../defines/CollisionVal";
import { EntityEnum } from "../defines/EntityEnum";
import { HitFlag } from "../defines/HitFlag";
import type { IBdyInfo } from "../defines/IBdyInfo";
import type { IEntityData } from "../defines/IEntityData";
import type { IFrameInfo } from "../defines/IFrameInfo";
import type { IItrInfo } from "../defines/IItrInfo";
import { ItrEffect } from "../defines/ItrEffect";
import { ItrKind } from "../defines/ItrKind";
import { ensure } from "../utils";
import { CondMaker } from "./CondMaker";
import { cook_ball_rebound_bdy } from "./cook_ball_rebound_bdy";
import { edit_bdy_info } from "./edit_bdy_info";
import { set_hit_flag } from "./set_hit_flag";


export function cook_ball_frame_state_3000(e: IEntityData, frame: IFrameInfo) {
  const bdy_list = frame.bdy ? frame.bdy : (frame.bdy = []);
  const new_bdy: IBdyInfo[] = [];
  for (const bdy of bdy_list) {
    const cond = new CondMaker<C_Val>()
      .add(C_Val.ItrKind, "!=", ItrKind.JohnShield)
      .and(C_Val.ItrKind, "!=", ItrKind.Block)
      .and((c) => c
        .add(C_Val.AttackerType, "==", EntityEnum.Ball)
        .or(c => c
          /** 被武器击中 */
          .add(C_Val.AttackerType, "==", EntityEnum.Weapon)
          .and(C_Val.AttackerState, "!=", StateEnum.Weapon_OnHand),
        ).or(c => c
          /**  */
          .add(C_Val.AttackerType, "==", EntityEnum.Fighter)
          .and(C_Val.AttackerState, "==", StateEnum.BurnRun),
        ),
      ).and().not_in(
        C_Val.ItrKind,
        ItrKind.Block,
        ItrKind.MagicFlute,
        ItrKind.MagicFlute2,
        ItrKind.Pick,
        ItrKind.PickSecretly,
      )
      .and().not_in(
        C_Val.ItrEffect,
        ItrEffect.Ice2,
        ItrEffect.MFire1
      )
    if (e.id === OID.FreezeBall)
      cond.and(C_Val.AttackerIsFreezableBall, '!=', 1)

    edit_bdy_info(bdy, {
      /* 受攻击判定 */
      test: cond.done(),
      actions: [{
        type: ActionType.V_NEXT_FRAME,
        data: {
          id: "20"
        }
      }]
    });

    new_bdy.push(cook_ball_rebound_bdy(bdy));
  }
  bdy_list.push(...new_bdy);

  const itr_list = frame.itr ? frame.itr : (frame.itr = []);
  const new_itr: IItrInfo[] = [];
  for (const itr of itr_list) {
    switch (itr.kind) {
      case ItrKind.Normal:
        // 命中跳转至10
        itr.actions = ensure(itr.actions, {
          type: ActionType.A_NEXT_FRAME,
          data: { id: "10" }
        });
        break;
      case ItrKind.Block:
        bdy_list.length = 0;
        bdy_list.push({
          kind: 0,
          ...set_hit_flag({}, HitFlag.AllBoth),
          test: new CondMaker<C_Val>()
            .one_of(
              C_Val.ItrKind,
              ItrKind.Normal,
              ItrKind.JohnShield
            )
            .and().not_in(
              C_Val.ItrEffect,
              ItrEffect.Ice2,
              ItrEffect.MFire1
            )
            .done(),
          z: itr.z,
          l: itr.l,
          x: itr.x,
          y: itr.y,
          w: itr.w,
          h: itr.h,
          actions: [{
            type: ActionType.V_NEXT_FRAME,
            data: {
              id: "30"
            }
          }, {
            type: ActionType.V_SOUND,
            data: { path: e.base.dead_sounds || [] }
          }]
        })
        break
    }
  }
  itr_list.push(...new_itr);
}
