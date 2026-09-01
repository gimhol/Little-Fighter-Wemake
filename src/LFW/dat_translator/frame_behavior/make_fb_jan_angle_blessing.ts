import { ChaseLost } from "../../defines/ChaseLost";
import { ChaseStrategy } from "../../defines/ChaseStrategy";
import { Defines as D } from "../../defines/defines";
import { FacingFlag as FF } from "../../defines/FacingFlag";
import { HitFlag } from "../../defines/HitFlag";
import type { IFrameInfo } from "../../defines/IFrameInfo";
import { SpeedMode } from "../../defines/SpeedMode";
import { ensure } from "../../utils/container_help/ensure";
import { CondMaker } from "../CondMaker";
import { set_hit_flag } from "../set_hit_flag";
import { ItrKind } from "../../defines/ItrKind";
import { ActionType } from "../../defines/actions/ActionType";
import { CollisionVal as C_Val } from "../../defines/CollisionVal";

export function make_fb_jan_angle_blessing(frame: IFrameInfo) {
  frame.facing = FF.VX;
  frame.dvx = 14;
  frame.acc_x = 0.25;
  frame.vxm = SpeedMode.AccTo;
  frame.dvz = D.DEFAULT_OPOINT_SPEED_Z;
  frame.acc_z = 0.25;
  frame.vzm = SpeedMode.AccTo;
  frame.dvy = -0.5;
  frame.acc_y = 0.25;
  frame.vym = SpeedMode.AccTo;
  frame.ctrl_x = frame.ctrl_y = frame.ctrl_z = 1;
  frame.itr = ensure(frame.itr, {
    kind: ItrKind.Heal,
    x: 25,
    y: 13,
    w: 32,
    h: 34,
    injury: 100,
    ...set_hit_flag({}, HitFlag.AllyFighter),
    actions: [
      {
        type: ActionType.A_NEXT_FRAME,
        data: {
          id: "60"
        }
      }
    ],
    test: new CondMaker().and(C_Val.VictimIsChasing, "==", 1).done()
  });
  frame.chase = {
    stratedy: ChaseStrategy.StopOnLost,
    flag: HitFlag.AllyFighter,
    lost: ChaseLost.Leave
  };
}
