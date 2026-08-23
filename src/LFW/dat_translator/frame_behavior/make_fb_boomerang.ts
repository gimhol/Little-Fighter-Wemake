import { SpeedCtrl } from "../../defines/SpeedCtrl";
import { ChaseLost } from "../../defines/ChaseLost";
import { HitFlag } from "../../defines/HitFlag";
import type { IFrameInfo } from "../../defines/IFrameInfo";
import { SpeedMode } from "../../defines/SpeedMode";
export function make_fb_boomerang(frame: IFrameInfo) {
  frame.dvx = 20;
  frame.acc_x = 0.2;
  frame.vxm = SpeedMode.AccTo;
  frame.ctrl_x = SpeedCtrl.Control;

  frame.dvz = 1.8;
  frame.acc_z = 0.1;
  frame.vzm = SpeedMode.AccTo;
  frame.ctrl_z = SpeedCtrl.Control;

  // frame.dvy = -2;
  // frame.vym = SpeedMode.AccTo;
  // frame.ctrl_y = SpeedCtrl.Control;

  frame.chase = { flag: HitFlag.EnemyFighter, lost: ChaseLost.Leave };
}
