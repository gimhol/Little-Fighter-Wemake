import { GK, type IFrameInfo, SpeedCtrl, StateEnum } from "../defines";
import { is_bot_ctrl } from "../entity";
import type { Entity } from "../entity/Entity";
import { abs, float_equal, round_float } from "../utils";
import { CharacterState_Base } from "./CharacterState_Base";

export class CharacterState_Jump extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Jump) {
    super(state)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    e.jumping.x = 0
    e.jumping.y = 0
    e.jumping.z = 0
    e.jumping.t = 0
  }
  override update(e: Entity): void {
    e.handle_ground_velocity_decay();
    if (!float_equal(e.position.y, e.ground_y)) return;
    const rf = round_float;
    const { jump_flag } = e.get_prev_frame();
    if (is_bot_ctrl(e.ctrl)) {
      e.jumping.t = rf(e.jumping.t + e.world.dataset.atom_time);
      e.jumping.y = rf(e.jumping.y + e.world.dataset.atom_time);
    } else {
      e.jumping.t = rf(e.jumping.t + e.world.dataset.atom_time);
      if (!e.ctrl.is_end(GK.R)) e.jumping.x = rf(e.jumping.x + e.world.dataset.atom_time);
      if (!e.ctrl.is_end(GK.L)) e.jumping.x = rf(e.jumping.x - e.world.dataset.atom_time);
      if (!e.ctrl.is_end(GK.U)) e.jumping.z = rf(e.jumping.z - e.world.dataset.atom_time);
      if (!e.ctrl.is_end(GK.D)) e.jumping.z = rf(e.jumping.z + e.world.dataset.atom_time);
      if (!e.ctrl.is_end(GK.j)) e.jumping.y = rf(e.jumping.y + e.world.dataset.atom_time);
    }
    if (!jump_flag) return;
    const { LR, UD } = e.ctrl;
    let vy = e.dataset('jump_height') * e.dataset('jump_h_f')
    const vz = e.dataset('jump_distancez') * UD * e.dataset('jump_z_f')
    const vx = LR * (e.dataset('jump_distance') * e.dataset('jump_x_f') - abs(vz / 4));
    const min = 4;
    vy = e.jumping.t ? min + (vy - min) * e.jumping.y / e.jumping.t : min;
    e.set_velocity(vx, vy, vz);
  }
  override on_landing(e: Entity): void {
    const { on_landing } = e.frame;
    if (on_landing) { e.enter_frame(on_landing); return; }
    e.enter_frame_by_id(e.data.indexes?.landing_1);
    e.update_velocity({ dvz: 4, ctrl_z: SpeedCtrl.Control })
  }
}
