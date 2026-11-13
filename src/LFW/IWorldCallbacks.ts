import type { IWorldDataset } from "./defines/IWorldDataset";
import type { ISettings } from "./defines/ISettings";
import type { World } from "./World";
import type { Entity } from './entity/Entity';
import type { Stage } from "./stage/Stage";

export interface IWorldCallbacks {
  on_disposed?(): void;

  /**
   * 场景被修改
   *
   * @param {Stage} curr 新场景
   * @param {Stage} prev 前一场景
   */
  on_stage_change?(curr: Stage, prev: Stage): void;

  /**
   *
   * @todo 这个回调比较高频似乎不应该放在此处
   * @param {number} x
   * @param {number} y
   */
  on_cam_move?(x: number, y: number): void;

  on_pause_change?(pause: boolean): void;

  on_puppet_add?(player_id: string): void;
  on_puppet_del?(player_id: string): void;

  /**
   * 渲染帧率变化回调
   *
   * @param {number} fps
   */
  on_fps_update?(fps: number): void;

  /**
   * 更新帧率变化回调
   *
   * @param {number} fps
   * @param {number} score 性能评分[0,100]
   */
  on_ups_update?(fps: number, score: number, speed?: number): void;

  on_dataset_change?<T extends keyof IWorldDataset>(
    key: T,
    value: IWorldDataset[T],
    prev: IWorldDataset[T],
    zworld: World
  ): void;

  /**
   * 客户端本地设置被修改
   *
   * 联机时这些设置不同步，也不会被房主覆盖。
   */
  on_settings_change?<T extends keyof ISettings>(
    key: T,
    value: ISettings[T],
    prev: ISettings[T],
    zworld: World
  ): void;

  on_fighter_add?(entity: Entity): void;
  on_fighter_del?(entity: Entity): void;
  on_fn_locked_change?(locked: 0 | 1): void;
  on_counts?(): void;
}
