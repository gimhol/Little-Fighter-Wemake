import { ActionType } from "../defines/actions/ActionType";
import { CollisionVal as C_Val } from "../defines/CollisionVal";
import { ItrKind } from "../defines/ItrKind";
import { StateEnum } from "../defines/StateEnum";
import type { IFrameInfoContext } from "../loader/IEntityDataContext";
import { ensure } from "../utils";
import { foreach } from "../utils/container_help/foreach";
import { CondMaker } from "./CondMaker";

export function cook_ball_frame_state_3005(ctx: IFrameInfoContext) {
  const { frame } = ctx;
  if (frame.bdy) {
    for (const bdy of frame.bdy) {
      bdy.actions = bdy.actions || [];
      bdy.actions.push({
        type: ActionType.V_NEXT_FRAME,
        test: new CondMaker<C_Val>()
          .add(C_Val.AttackerState, "==", StateEnum.Ball_3005)
          .or(C_Val.ItrKind, "==", ItrKind.JohnShield)
          .done(),
        data: {
          id: "20"
        }
      })
    }
  }
  foreach(frame.itr, itr => {
    if (itr.kind === ItrKind.Normal)
      itr.actions = ensure(itr.actions, {
        type: ActionType.A_NEXT_FRAME,
        test: new CondMaker<C_Val>()
          .add(C_Val.VictimState, "==", StateEnum.Ball_3005)
          .done(),
        data: { id: "20" }
      })
  })
}
