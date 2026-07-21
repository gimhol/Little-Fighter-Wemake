import { Defines, StateEnum, type IFrameInfo, type INextFrame, type IVector3 } from "../defines";
import type { Entity } from "../entity/Entity";
import { clamp, float_equal, round } from "../utils";
import { spawn_buring_smoke } from "./spawn_buring_smoke";

const MIN_V = 0.5
export class State_Base {
  readonly state: number | string;
  constructor(state: number | string) {
    this.state = state
  }
  pre_update?(e: Entity): void;
  update(e: Entity): void {
    switch (e.state) {
      case StateEnum.Burning:
        if (round(e.lifetime % 2)) e.apply_opoints([spawn_buring_smoke(e, 1)]);
        break;
      case StateEnum.BurnRun:
        if (round(e.lifetime % 2)) e.apply_opoints([spawn_buring_smoke(e, 2)]);
        break;
    }
  }
  enter?(e: Entity, prev_frame: IFrameInfo): void;
  leave(e: Entity, next_frame: IFrameInfo): void {
    switch (this.state) {
      case StateEnum.HealSelf:
        e.healing = Defines.STATE_HEAL_SELF_HP;
        break;
    }
  }
  on_dead?(e: Entity): void;
  on_landing?(e: Entity, velocity: IVector3): void;
  get_gravity?(e: Entity): number | undefined | null;

  // TODO: 下面四个，不知为何总觉得有点傻 - Gim
  get_sudden_death_frame?(e: Entity): INextFrame | undefined;
  get_caught_end_frame?(e: Entity): INextFrame | undefined;
  get_auto_frame?(e: Entity): IFrameInfo | undefined;
  find_frame_by_id?(e: Entity, id: string | undefined): IFrameInfo | undefined;

  /** "病毒就关闭了" */
  on_leave_ground?(e: Entity): void;

  /**
   * 实体将被被地形限制位置
   *
   * @param {Entity} e 实体
   * @param {number} x 新位置 X
   * @param {number} y 新位置 Y
   * @param {number} z 新位置 Z
   * @memberof State_Base
   */
  on_restrict(e: Entity, x: number, y: number, z: number): void {
    let vx: number | null = null;
    let vz: number | null = null;
    let vy: number | null = null;
    // 留点速度，方便贴着地形的角色能跳上高台
    if (!float_equal(x, e.position.x))
      vx = clamp(e.velocity.x, -MIN_V, MIN_V);
    if (!float_equal(z, e.position.z))
      vz = clamp(e.velocity.z, -MIN_V, MIN_V);
    if (!float_equal(y, e.position.y)) {
      vy = clamp(e.velocity.y, -MIN_V, MIN_V);
      vx = clamp(e.velocity.x, -MIN_V, MIN_V);
      vz = clamp(e.velocity.z, -MIN_V, MIN_V);
    }
    if (vx !== null || vz !== null || vy !== null)
      e.set_velocity(vx, vy, vz);
    e.position.x = x;
    e.position.y = y;
    e.position.z = z;
  }
}