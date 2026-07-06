import { Defines, type IFrameInfo, type INextFrame, type IVector3, StateEnum, WeaponEnum } from "../defines";
import type { Entity } from "../entity/Entity";
import { clamp } from "../utils/math/clamp";
import { State_Base } from "./State_Base";

export class CharacterState_Base extends State_Base {
  override pre_update(e: Entity): void {
    switch (this.state) {
      case StateEnum.Falling:
      case StateEnum.Caught:
      case StateEnum.Injured:
      case StateEnum.Frozen:
      case StateEnum.Burning:
        break;
      default:
        e.stat_recovering();
    }
  }
  override update(e: Entity): void {
    super.update(e)
    e.handle_ground_velocity_decay();
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    e.enter_frame_by_id(e.data.indexes?.landing_2);
  }
  override get_auto_frame(e: Entity): IFrameInfo | undefined {
    let fid: string | undefined;
    if (e.holding?.base_type === WeaponEnum.Heavy) {
      fid = e.data.indexes?.heavy_obj_walk;
    } else if (e.position.y > e.ground_y) {
      fid = e.data.indexes?.in_the_skys?.[0];
    } else if (e.hp > 0) {
      fid = e.data.indexes?.default;
    }
    if (!fid) return void 0;
    return e.data.frames[fid];
  }

  override get_sudden_death_frame(target: Entity): INextFrame | undefined {
    target.set_velocity(2 * target.facing, 2)
    if (target.data.indexes?.falling)
      return { id: target.data.indexes?.falling[1][1] };
    return void 0;
  }

  override get_caught_end_frame(e: Entity): INextFrame | undefined {
    const cvx = e.dataset('cvx_d')
    const cvy = e.dataset('cvy_d')
    e.set_velocity(-1 * cvx * e.facing, cvy)
    if (e.data.indexes?.falling)
      return { id: e.data.indexes.falling[-1][1] };
    return void 0;
  }
  override on_leave_ground(e: Entity): void {
    e.is_on_ground = false;
    switch (e.state) {
      case StateEnum.Running:
      case StateEnum.Walking:
      case StateEnum.Standing:
      case StateEnum.Rowing:
        if (e.holding?.base_type === WeaponEnum.Heavy)
          e.drop_holding();
        e.enter_frame(Defines.NEXT_FRAME_AUTO);
        break;
    }
  }

  override on_restrict(e: Entity, x: number, y: number, z: number): void {
    let vx: number | null = null;
    let vz: number | null = null;
    let vy: number | null = null;
    if (x != e.position.x) vx = clamp(e.velocity.x, -0.1, 0.1);
    if (y != e.position.x) vy = clamp(e.velocity.y, -0.1, 0.1);
    if (z != e.position.x) vz = clamp(e.velocity.z, -0.1, 0.1);
    if (vx !== null || vz !== null || vy !== null)
      e.set_velocity(vx, vy, vz)
    super.on_restrict?.(e, x, y, z);
  }
}
