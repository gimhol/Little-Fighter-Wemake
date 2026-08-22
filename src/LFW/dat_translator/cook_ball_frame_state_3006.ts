import { FrameBehavior, OID } from "../defines";
import { ActionType } from "../defines/actions/ActionType";
import { CollisionVal as C_Val } from "../defines/CollisionVal";
import { ItrKind } from "../defines/ItrKind";
import { StateEnum } from "../defines/StateEnum";
import type { IFrameInfoContext } from "../loader/IEntityDataContext";
import { ensure } from "../utils";
import { foreach } from "../utils/container_help/foreach";
import { CondMaker } from "./CondMaker";

export function cook_ball_frame_state_3006(ctx: IFrameInfoContext) {
  const { data: e, frame } = ctx;
  foreach(frame.bdy, bdy => {
    if (
      frame.behavior == FrameBehavior.JohnChase ||
      frame.behavior == FrameBehavior.JohnBiscuitLeaving ||
      e.id == OID.JohnBiscuit
    ) {
      bdy.actions = ensure([], {
        type: ActionType.V_REBOUND_VX,
        test: new CondMaker<C_Val>()
          .or(C_Val.ItrKind, "==", ItrKind.JohnShield)
          .done(),
      }, {
        type: ActionType.V_TURN_FACE,
        test: new CondMaker<C_Val>()
          .or(C_Val.ItrKind, "==", ItrKind.JohnShield)
          .done(),
      }, {
        type: ActionType.V_TURN_TEAM,
        test: new CondMaker<C_Val>()
          .or(C_Val.ItrKind, "==", ItrKind.JohnShield)
          .done(),
      }, {
        type: ActionType.V_NEXT_FRAME,
        test: new CondMaker<C_Val>()
          .one_of(C_Val.AttackerState, StateEnum.Ball_3005, StateEnum.Ball_3006)
          .and(C_Val.ItrKind, "!=", ItrKind.JohnShield)
          .done(),
        data: {
          id: "20"
        }
      })
    } else {
      bdy.actions = ensure(bdy.actions, {
        type: ActionType.V_NEXT_FRAME,
        test: new CondMaker<C_Val>()
          .one_of(C_Val.AttackerState, StateEnum.Ball_3005, StateEnum.Ball_3006)
          .or(C_Val.ItrKind, "==", ItrKind.JohnShield)
          .done(),
        data: {
          id: "20"
        }
      })
    }
  })
  foreach(frame.itr, itr => {
    if (itr.kind === ItrKind.Normal)
      itr.actions = ensure(itr.actions, {
        type: ActionType.A_NEXT_FRAME,
        test: new CondMaker<C_Val>()
          .one_of(C_Val.VictimState, StateEnum.Ball_3005, StateEnum.Ball_3006)
          .done(),
        data: {
          id: "20"
        }
      })
  })
}
