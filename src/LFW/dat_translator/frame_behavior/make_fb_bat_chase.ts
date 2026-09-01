import { ChaseLost } from "../../defines/ChaseLost";
import { Defines as D } from "../../defines/defines";
import { FacingFlag as FF } from "../../defines/FacingFlag";
import { HitFlag } from "../../defines/HitFlag";
import type { IFrameInfo } from "../../defines/IFrameInfo";
import { SpeedMode } from "../../defines/SpeedMode";
import { ChaseStrategy } from "../../defines/ChaseStrategy";
export function make_fb_bat_chase(frame: IFrameInfo) {
  frame.facing = FF.VX;
  frame.dvx = 14;
  frame.acc_x = 0.25;
  frame.vxm = SpeedMode.AccTo;
  frame.dvz = D.DEFAULT_OPOINT_SPEED_Z;
  frame.acc_z = 0.125;
  frame.vzm = SpeedMode.AccTo;
  frame.dvy = -0.5;
  frame.acc_y = 0.125;
  frame.vym = SpeedMode.AccTo;
  frame.ctrl_x = frame.ctrl_y = frame.ctrl_z = 1;
  frame.chase = { flag: HitFlag.EnemyFighter, stratedy: ChaseStrategy.UntilLost, lost: ChaseLost.Hover };
}
