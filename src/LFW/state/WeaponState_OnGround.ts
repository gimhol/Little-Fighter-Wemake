import type { Entity } from "../entity/Entity";
import { WeaponState_Base } from "./WeaponState_Base";

export class WeaponState_OnGround extends WeaponState_Base {
  override enter(e: Entity): void {
    e.team = e.lfw.new_team;
  }
  override update(e: Entity): void {
    e.handle_ground_velocity_decay();
  }
}
