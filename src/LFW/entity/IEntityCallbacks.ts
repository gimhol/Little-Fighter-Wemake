import { BaseController } from "../controller";
import type { IEntityData } from "../defines";
import type { Unsafe } from "../utils/type_check/Unsafe";
import type { Entity } from "./Entity";

export interface IEntityCallbacks<E extends Entity = Entity> {
  on_ctrl_changed?(v: BaseController, prev: BaseController, e: Entity): void;

  /**
   * 最大血量变化
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_hp_max_changed?(e: E, value: number, prev: number): void;

  /**
   * 最大气量变化
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_mp_max_changed?(e: E, value: number, prev: number): void;

  /**
   * 血量变化
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_hp_changed?(e: E, value: number, prev: number): void;

  /**
   * 气量变化
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_mp_changed?(e: E, value: number, prev: number): void;

  /**
   * 队伍变化
   *
   * @param {E} e
   * @param {string} value
   * @param {string} prev
   */
  on_team_changed?(e: E, value: string, prev: string): void;

  /**
   * 玩家名变化
   *
   * @param e
   * @param value
   * @param prev
   */
  on_name_changed?(e: E, value: string, prev: string | null): void;

  /**
   * 角色倒地死亡回调
   *
   * 当角色hp为0，且状态处于Lying时触发
   *
   * @see {StateEnum.Lying}
   * @param {E} e
   */
  on_dead?(e: E): void;

  on_disposed?(e: E): void;

  /**
   *
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_fall_value_max_changed?(e: E, value: number, prev: number): void;

  /**
   *
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_fall_value_changed?(e: E, value: number, prev: number): void;

  /**
   *
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_defend_value_max_changed?(e: E, value: number, prev: number): void;

  /**
   *
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_defend_value_changed?(e: E, value: number, prev: number): void;

  /**
   *
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_resting_max_changed?(e: E, value: number, prev: number): void;

  /**
   *
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_resting_changed?(e: E, value: number, prev: number): void;

  on_resting_max_changed?(e: E, value: number, prev: number): void;

  /**
   * 
   *
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_hp_r_changed?(e: E, value: number, prev: number): void;


  /**
   * 
   * @param {E} e
   * @param {number} value 当前值
   * @param {number} prev 上一次值
   */
  on_healing_changed?(e: E, value: number, prev: number): void;


  on_toughness_changed?(e: E, value: number, prev: number): void;
  on_toughness_max_changed?(e: E, value: number, prev: number): void;
  on_reserve_changed?(e: E, value: number, prev: number): void;
  on_catch_time_max_changed?(e: E, value: number, prev: number): void;

  on_data_changed?(value: IEntityData, prev: IEntityData, e: E): void;
}