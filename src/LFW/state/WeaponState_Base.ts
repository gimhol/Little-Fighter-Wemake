import { Defines, type IFrameInfo, type IVector3, SE, WT } from "../defines";
import type { Entity } from "../entity/Entity";
import { round_float } from "../utils";
import { State_Base } from "./State_Base";

export class WeaponState_Base extends State_Base {
  /**
   * 用于确保丢出的武器只受一次跌落伤害
   * @protected
   * @type {Set<Entity>}
   */
  protected _hit_ground_weapons: Set<Entity> = new Set<Entity>();
  override get_auto_frame(e: Entity): IFrameInfo | undefined {
    const { frames, indexes } = e.data;
    if (!indexes) return void 0;
    if (e.is_on_ground) return frames[indexes.on_ground!];
    return frames[indexes.in_the_skys?.[0]!];
  }

  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    const { indexes } = e.data;
    e.enter_frame_by_id(indexes?.on_ground);
  }

  override update(e: Entity): void {
    e.handle_ground_velocity_decay();
  }

  hit_ground_rebouncing(e: Entity, nf: string | undefined, velocity: IVector3) {

    const { y: vy, x: vx, z: vz } = velocity;
    const { base, indexes } = e.data;
    const wt = e.base_type as WT

    const bounce_x = base.bounce_x ?? Defines.WT_BOUNCE_X[wt] ?? 0.5;
    const bounce_y = base.bounce_y ?? Defines.WT_BOUNCE_Y[wt] ?? 0.5;
    const bounce_z = base.bounce_z ?? Defines.WT_BOUNCE_Z[wt] ?? 0.5;

    const bounce_min_x = base.bounce_min_x ?? Defines.WT_BOUNCE_MIN_X[wt] ?? 99;
    const bounce_min_y = base.bounce_min_y ?? Defines.WT_BOUNCE_MIN_Y[wt] ?? 0.5;
    const bounce_min_z = base.bounce_min_z ?? Defines.WT_BOUNCE_MIN_Z[wt] ?? 99;

    const fast_x = base.fast_vx ?? Defines.WT_FAST_X[wt] ?? 99;
    const fast_y = base.fast_vy ?? Defines.WT_FAST_Y[wt] ?? 99;
    const fast_z = base.fast_vz ?? Defines.WT_FAST_Z[wt] ?? 99;

    const dvy = round_float(-vy * bounce_y);
    const dvx = round_float(vx * bounce_x);
    const dvz = round_float(vz * bounce_z);

    if (this._hit_ground_weapons.has(e)) {
      this._hit_ground_weapons.delete(e);
      if (base.drop_hurt) {
        e.hp = e.hp - base.drop_hurt;
        e.hp_r = e.hp_r - base.drop_hurt;
      }
    }
    const is_bounce =
      dvy >= bounce_min_y ||
      dvx >= bounce_min_x || dvx < -bounce_min_x ||
      dvx >= bounce_min_z || dvx < -bounce_min_z

    if (!is_bounce) { // 非反弹
      e.enter_frame_by_id(nf);
      return;
    }

    // 反弹
    e.set_velocity(dvx, dvy, dvz);
    e.leave_ground();
    if (
      e.state == SE.Weapon_Throwing &&
      dvy > -fast_y && dvy < fast_y &&
      dvx > -fast_x && dvx < fast_x &&
      dvz > -fast_z && dvz < fast_z
    ) {
      // 从throwing帧 进入 对应in_the_sky帧
      const nf = e.find_align_frame(
        e.frame.id,
        indexes?.throwings,
        indexes?.in_the_skys
      )
      if (nf) e.enter_frame(nf);
    }
  }
  override on_leave_ground(e: Entity): void {
    e.enter_frame(Defines.NEXT_FRAME_AUTO);
  }
}
