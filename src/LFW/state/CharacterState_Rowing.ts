import { type IFrameInfo, SE, SpeedMode, StateEnum } from "../defines";
import { calc_v } from "../entity/calc_v";
import { Entity } from "../entity/Entity";
import { CharacterState_Base } from "./CharacterState_Base";

/** 
 * mmp为什么要用同个state
 * 
 * - 跑滚
 * - 受身
 */
export class CharacterState_Rowing extends CharacterState_Base {
  constructor(state: StateEnum = StateEnum.Rowing) {
    super(state)
  }
  override enter(e: Entity, prev_frame: IFrameInfo): void {
    if (prev_frame.state !== SE.Falling) return;
    const vx = e.dataset('rowing_distance') * e.dataset('bfall_x_f')
    const vy = e.dataset('rowing_height') * e.dataset('bfall_h_f')
    const { x: prev_vx, y: prev_vy } = e.velocity;
    const next_vx = prev_vx >= 0 ? vx : -vx;
    const next_vy = calc_v(prev_vy, vy, SpeedMode.Default, 0)
    e.set_velocity(next_vx, next_vy);
  }
  override on_landing(e: Entity): void {
    const { on_landing } = e.frame;
    if (on_landing) {
      e.enter_frame(on_landing);
      return;
    }
    e.enter_frame_by_id(e.data.indexes?.landing_1);
  }
}
