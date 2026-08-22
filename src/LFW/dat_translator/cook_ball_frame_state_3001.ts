import { OID, StateEnum } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { CollisionVal as C_Val } from "../defines/CollisionVal";
import { EntityEnum } from "../defines/EntityEnum";
import type { IBdyInfo } from "../defines/IBdyInfo";
import type { IItrInfo } from "../defines/IItrInfo";
import { ItrEffect } from "../defines/ItrEffect";
import { ItrKind } from "../defines/ItrKind";
import type { IFrameInfoContext } from "../loader/IEntityDataContext";
import { ensure } from "../utils";
import { CondMaker } from "./CondMaker";
import { cook_ball_bdy_rebound } from "./cook_ball_bdy_rebound";
import { EditBdy } from "./EditBdy";
export function cook_ball_frame_state_3001(ctx: IFrameInfoContext) {
  const { data: e, frame } = ctx;
  const bdy_list = frame.bdy ? frame.bdy : (frame.bdy = []);
  const new_bdy: IBdyInfo[] = [];
  for (const bdy of bdy_list) {
    const cond = new CondMaker<C_Val>()
      .add(C_Val.ItrKind, "!=", ItrKind.JohnShield)
      .and(C_Val.ItrKind, "!=", ItrKind.Block)
      .and((c) => c
        .add(C_Val.AttackerType, "==", EntityEnum.Ball).or((c) => c
          /** 被武器s击中 */
          .add(C_Val.AttackerType, "==", EntityEnum.Weapon)
          .and(C_Val.AttackerState, "!=", StateEnum.Weapon_OnHand),
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
    EditBdy.edit(bdy, {
      /* 受攻击判定 */
      test: cond.done(),
      actions: [{
        type: ActionType.V_NEXT_FRAME,
        data: {
          id: "20"
        }
      }]
    })
    new_bdy.push(cook_ball_bdy_rebound({ ...ctx, bdy, index: -1 }));
  }
  bdy_list.push(...new_bdy);

  const itr_list = frame.itr ? frame.itr : (frame.itr = []);
  const new_itr: IItrInfo[] = [];
  for (const itr of itr_list) {
    switch (itr.kind) {
      case ItrKind.Normal:
        itr.actions = ensure(itr.actions, {
          type: ActionType.A_NEXT_FRAME,
          test: new CondMaker<C_Val>()
            .add(C_Val.AttackerType, '==', EntityEnum.Ball)
            .done(),
          data: { id: "10" }
        });
        break;
    }
  }
  itr_list.push(...new_itr);
}
