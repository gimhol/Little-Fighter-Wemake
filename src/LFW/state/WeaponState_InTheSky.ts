
import { Defines, type IFrameInfo, type IVector3, WT } from "../defines";
import type { Entity } from "../entity/Entity";
import { WeaponState_Base } from "./WeaponState_Base";

export class WeaponState_InTheSky extends WeaponState_Base {
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    e.drop_hurted = false;
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    const { indexes } = e.data;
    this.hit_ground_rebouncing(e, indexes?.just_on_ground, velocity)
  }
  override update(e: Entity): void {
    e.handle_ground_velocity_decay();

    const { y: vy, x: vx, z: vz } = e.velocity;
    const { base, indexes } = e.data;
    const wt = e.base_type as WT
    const fast_x = base.fast_vx ?? Defines.WT_FAST_X[wt] ?? 99;
    const fast_y = base.fast_vy ?? Defines.WT_FAST_Y[wt] ?? 99;
    const fast_z = base.fast_vz ?? Defines.WT_FAST_Z[wt] ?? 99;

    // 速度太快的，变为throwing
    if (
      wt != WT.Heavy && (
        vy < -fast_y || vy > fast_y ||
        vx < -fast_x || vx > fast_x ||
        vz < -fast_z || vz > fast_z
      )
    ) {
      const nf = e.find_align_frame(
        e.frame.id,
        indexes?.in_the_skys,
        indexes?.throwings
      )
      if (nf) e.enter_frame(nf);
    }
  }
}