import type { TFrameIdListPair, TFrameIdPair } from "./defines";

export interface IFrameIndexes {
  /** 默认动作 */
  default?: string;
  /** 举重步行首帧 */
  heavy_obj_walk?: string;
  landing_2?: string;
  landing_1?: string;

  /**
   * 角色眩晕动作的首个帧ID
   */
  dizzy?: string;

  in_the_skys?: string[];
  throwings?: string[];
  on_hands?: string[];

  falling?: TFrameIdListPair;

  /**
   * 速度叫快的摔到地上时，需要弹起来
   *
   * - "-1": 角色面部朝上
   * - "1": 角色面部朝下
   */
  bouncing?: TFrameIdListPair;

  critical_hit?: TFrameIdListPair;
  /**
   * 角色受伤的帧ID
   */
  injured?: TFrameIdPair;
  grand_injured?: TFrameIdListPair;

  /**
   * 角色躺在地上的帧ID
   * 
   * -1: 角色面部朝上
   * 1: 角色面部朝下
   */
  lying?: TFrameIdPair;

  fire?: string[];
  ice?: string;


  on_ground?: string;

  just_on_ground?: string;

  /**
   * for weapon
   *
   * @type {string}
   */
  throw_on_ground?: string;
}

export function frame_indexes_new(): IFrameIndexes {
  return {};
} 