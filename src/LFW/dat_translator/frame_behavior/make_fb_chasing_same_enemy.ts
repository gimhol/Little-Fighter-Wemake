import { OID as OID } from "../../defines/OID";
import { ChaseLost } from "../../defines/ChaseLost";
import { Defines as D } from "../../defines/defines";
import { FacingFlag as FF } from "../../defines/FacingFlag";
import { HitFlag } from "../../defines/HitFlag";
import type { IFrameInfo } from "../../defines/IFrameInfo";
import { SpeedMode } from "../../defines/SpeedMode";
import { ChaseStrategy } from "../../defines/ChaseStrategy";
export function make_fb_chasing_same_enemy(frame: IFrameInfo, oid: string) {
  frame.facing = FF.VX;
  frame.dvx = 14;
  frame.acc_x = 0.25;
  frame.vxm = SpeedMode.AccTo;
  frame.dvz = D.DEFAULT_OPOINT_SPEED_Z;
  frame.acc_z = 0.25;
  frame.vzm = SpeedMode.AccTo;
  frame.dvy = 8;
  frame.acc_y = -0.25;
  frame.vym = SpeedMode.AccTo;
  frame.ctrl_x = frame.ctrl_z = 1;
  frame.itr?.forEach(itr => {
    switch (oid) {
      case OID.FirzenChasef:
      case OID.FirzenChasei:
        itr.on_hit_ground = { id: "60" };
        break;
      default:
        itr.on_hit_ground = { id: "10" };
        break;
    }
  });
  frame.chase = {
    stratedy: ChaseStrategy.UntilLost,
    flag: HitFlag.EnemyFighter,
    lost: ChaseLost.Hover
  };
}
