import { type IFrameInfo, StateEnum } from "../defines";
import { Entity } from "../entity/Entity";
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
    if (
      e.position.x !== x &&
      e.frame.state >= StateEnum.Ball_Flying &&
      e.frame.state <= StateEnum.Ball_3006
    ) {
      e.enter_frame({ id: "20" })
      e.play_sound(e.data.base.hit_sounds)
    } else {
      super.on_restrict?.(e, x, y, z);
    }
  }
}
