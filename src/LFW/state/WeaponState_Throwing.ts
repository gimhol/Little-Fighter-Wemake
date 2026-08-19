import type { IFrameInfo, IVector3 } from "../defines";
import type { Entity } from "../entity/Entity";
import { WeaponState_Base } from "./WeaponState_Base";

export class WeaponState_Throwing extends WeaponState_Base {
  override get_gravity(e: Entity) {
    return e.dataset('weapon_throwing_gravity');
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    e.leave_ground();
    this._hit_ground_weapons.add(e);
  }
  override leave(e: Entity, next_frame: IFrameInfo): void {
    this._hit_ground_weapons.delete(e);
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
