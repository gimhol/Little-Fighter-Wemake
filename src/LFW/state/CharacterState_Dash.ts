import { StateEnum, type IFrameInfo } from "../defines";
import type { Entity } from "../entity/Entity";
import { CharacterState_Base } from "./CharacterState_Base";
export class CharacterState_Dash extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Dash) {
    super(state)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    if (e.position.y > e.ground_y && e.velocity.y !== 0) return;
    const { x: vx, z: vz } = e.velocity;
    let next_vx = vx;
    let next_vz = vz;
    const dx = e.dataset('dash_distance') * e.dataset('dash_x_f')
    const dz = e.dataset('dash_distancez') * e.dataset('dash_z_f')
    const vy = e.dataset('dash_height') * e.dataset('dash_h_f')
    const { UD, LR } = e.ctrl;
    if (UD) next_vz = UD * dz;
    if (prev_frame.state === StateEnum.Running) {
      next_vx = e.facing * dx;
    } else if (LR) next_vx = LR * dx;
    else if (vx > 0) next_vx = dx;
    else if (vx < 0) next_vx = -dx;
    else next_vx = e.facing * dx;
    e.set_velocity(next_vx, vy, next_vz)
  }
}
