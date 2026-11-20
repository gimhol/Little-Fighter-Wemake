import { Buff_Healing } from "../buff/Buff_Healing";
import { grant_buff } from "../buff/grant_buff";
import { Defines } from "../defines/defines";
import { type IFrameInfo } from "../defines/IFrameInfo";
import { type INextFrame } from "../defines/INextFrame";
import { StateEnum } from "../defines/StateEnum";
import type { Entity } from "../entity/Entity";
import { clamp, float_equal } from "../utils";

const MIN_V = 0.5
export class State_Base {
  readonly state: number | string;
  constructor(state: number | string) {
    this.state = state
  }
  pre_update?(e: Entity): void;
  update(e: Entity): void { void e; }
  enter?(e: Entity): void;
  leave(e: Entity): void {
    switch (this.state) {
      case StateEnum.HealSelf:
        grant_buff(
          Buff_Healing.KIND,
          void 0,
          e,
          Buff_Healing.duration_of(e, Defines.STATE_HEAL_SELF_HP),
        );
        break;
    }
  }
  on_dead?(e: Entity): void;
  on_landing?(e: Entity): void;
  get_gravity?(e: Entity): number | undefined | null;

  // TODO: 下面三个，不知为何总觉得有点傻 - Gim
  get_sudden_death_frame?(e: Entity): INextFrame | undefined;
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
      // 这影响了武器触地反弹，如何是好？
      // vy = clamp(e.velocity.y, -MIN_V, MIN_V);
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