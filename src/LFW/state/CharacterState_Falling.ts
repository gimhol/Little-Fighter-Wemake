import { StateEnum, WeaponEnum, type IFrameInfo, type IVector3 } from "../defines";
import type { Entity } from "../entity/Entity";
import { find_direction } from "../entity/find_frame_direction";
import { abs } from "../utils";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Falling extends CharacterState_Base {
  private _bouncing_frames_map = new Map<string, Set<string>>();
  constructor(state: StateEnum = StateEnum.Falling) {
    super(state)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    e.bounced = false;
    e.ctrl.reset_key_list();
    if (!this._bouncing_frames_map.has(e.data.id) && e.data.indexes?.bouncing) {
      this._bouncing_frames_map.set(
        e.data.id,
        new Set([
          ...e.data.indexes.bouncing[1],
          ...e.data.indexes.bouncing[-1],
        ]),
      );
    }
    e.catcher?.drop_catching()
    e.drop_holding();

    if (e.hp <= 0 && e.fuse_bys?.length) {
      const { x: vx, y: vy, z: vz } = e.velocity;
      let next_vx = vx;
      for (const fighter of e.fuse_bys) {
        next_vx *= -1
        fighter.set_velocity(next_vx, vy, vz)
      }
      e.dismiss_fusion(e.frame.id)
    }
    e.leave_ground();
  }

  is_bouncing_frame(e: Entity) {
    return !!this._bouncing_frames_map.get(e.data.id)?.has(e.frame.id);
  }
  override update(e: Entity): void {
    if (e.shaking > 0) return;
    if (this.is_bouncing_frame(e)) {
      this.update_bouncing(e);
    } else {
      this.update_falling(e);
    }
  }

  update_bouncing(e: Entity): void {
    e.handle_ground_velocity_decay(0.7);
  }

  update_falling(e: Entity): void {
    if (e.wait <= 0) {
      const { x, y } = e.velocity;
      let falling_frame_idx = 1; // ---
      if (y > 3) falling_frame_idx = 0; // ↗
      if (y < -3) falling_frame_idx = 2; // ↘
      const direction = x / e.facing > 0 ? (1 as const) : (-1 as const);
      e.enter_frame({
        id: e.data.indexes?.falling?.[direction][falling_frame_idx],
      });
    }
  }
  override leave(e: Entity, next_frame: IFrameInfo): void {
    super.leave(e, next_frame);
    e.bounced = false;
    e.fall_value = e.fall_value_max;
    e.defend_value = e.defend_value_max;
    e.resting = e.resting_max
    e.fallinjury = 0;
    e.throwinjury = 0;
  }
  override on_landing(e: Entity, velocity: IVector3): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    const {
      facing,
      data: { indexes },
    } = e;
    const f = e.frame;
    const d =
      find_direction(f, indexes?.bouncing) ||
      find_direction(f, indexes?.falling) ||
      find_direction(f, indexes?.critical_hit) ||
      facing;
    const { y: vy, x: vx } = velocity;
    if (
      !e.bounced && (
        vy <= e.world.dataset.cha_bc_tst_spd_y ||
        abs(vx) > e.world.dataset.cha_bc_tst_spd_x
      )
    ) {
      e.enter_frame_by_id(indexes?.bouncing?.[d][1]);
      e.set_velocity_y(e.world.dataset.cha_bc_spd)
      e.bounced = true;
    } else {
      e.enter_frame_by_id(indexes?.lying?.[d]);
    }
  }
}
