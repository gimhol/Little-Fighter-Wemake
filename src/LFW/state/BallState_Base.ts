import { StateEnum } from "../defines";
import { Entity } from "../entity/Entity";
import { State_Base } from "./State_Base";

export class BallState_Base extends State_Base {
  override enter(e: Entity): void {
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
}
