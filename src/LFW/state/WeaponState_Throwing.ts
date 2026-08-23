import { FrameBehavior, type IFrameInfo, type IVector3 } from "../defines";
import type { Entity } from "../entity/Entity";
import { round_float } from "../utils";
import { WeaponState_Base } from "./WeaponState_Base";

export class WeaponState_Throwing extends WeaponState_Base {
  override get_gravity(e: Entity) {
    if (e.frame.behavior == FrameBehavior.Boomerang) {
      // ... dont hard-code ? -Gim
      return round_float(e.dataset('weapon_throwing_gravity') / 4);
    }
    return e.dataset('weapon_throwing_gravity');
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    e.leave_ground();
    e.drop_hurted = false;
    if (e.frame.behavior == FrameBehavior.Boomerang) {
      // ... dont hard-code ? -Gim
      e.set_velocity(e.velocity.x * 0.6)
    }
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    const { indexes } = e.data;
    this.hit_ground_rebouncing(e, indexes?.throw_on_ground || indexes?.just_on_ground, velocity);
  }
  override update(e: Entity): void {
    e.handle_ground_velocity_decay();
  }
}
