import { type IFrameInfo, StateEnum } from "../defines";
import { Entity } from "../entity/Entity";
import { clamp } from "../utils/math/clamp";
import { State_Base } from "./State_Base";

export class BallState_Base extends State_Base {
  override enter(e: Entity, _prev_frame: IFrameInfo): void {
    switch (e.state) {
      case StateEnum.Ball_Hitting:
      case StateEnum.Ball_Hit:
      case StateEnum.Ball_Rebounding:
      case StateEnum.Ball_Disappear:
        e.shaking = 0;
        e.motionless = 0;
        e.set_velocity(0, 0, 0)
        break;
    }
  }
  override on_restrict(e: Entity, x: number, y: number, z: number): void {

    let vx: number | null = null;
    let vz: number | null = null;
    let vy: number | null = null;
    if (x != e.position.x) vx = 0;
    if (y != e.position.x) vy = 0;
    if (z != e.position.x) vz = 0;
    if (
      e.position.x !== x &&
      e.frame.state >= StateEnum.Ball_Flying &&
      e.frame.state <= StateEnum.Ball_3006
    ) {
      e.enter_frame({ id: "20" }) // stupid hard-code
      e.play_sound(e.data.base.hit_sounds)
      e.set_position(
        e.position.x - e.velocity.x,
        e.position.y - e.velocity.y,
        e.position.z - e.velocity.z
      );
    } else {
      super.on_restrict?.(e, x, y, z);
    }
    if (vx !== null || vz !== null || vy !== null) {
      e.set_velocity(vx, vy, vz)
    }
  }
}
