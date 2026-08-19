import { Defines, type IFrameInfo, type INextFrame, type IVector3, StateEnum, WeaponEnum } from "../defines";
import { Entity } from "../entity/Entity";
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
    } else if (e.is_on_ground) {
      fid = e.data.indexes?.default;
    } else if (e.hp > 0) {
      fid = e.data.indexes?.in_the_skys?.[0];
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
}
