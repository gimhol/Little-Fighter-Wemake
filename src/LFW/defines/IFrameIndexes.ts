import { fields, obj, str } from "../fields";
import type { IPairByFace } from "./IPairByFace";
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

/** 面向朝向的成对帧ID字段（{1: 朝下, -1: 朝上}） */
const frame_id_pair_fields = fields<IPairByFace<string>>({
  [1]: str('朝下(1)', { nullable: true }),
  [-1]: str('朝上(-1)', { nullable: true }),
});

/** 面向朝向的成对帧ID数组字段（{1: 朝下, -1: 朝上}） */
const frame_id_list_pair_fields = fields<IPairByFace<string[]>>({
  [1]: str('朝下(1)', { nullable: true, array: true }),
  [-1]: str('朝上(-1)', { nullable: true, array: true }),
});

export const frame_indexes_fields = fields<IFrameIndexes>({
  default: str('默认动作', { nullable: true }),
  heavy_obj_walk: str('举重步行首帧', { nullable: true }),
  landing_1: str('落地帧1', { nullable: true }),
  landing_2: str('落地帧2', { nullable: true }),
  dizzy: str('眩晕首帧', { nullable: true }),
  in_the_skys: str('空中帧', { nullable: true, array: true }),
  throwings: str('投掷帧', { nullable: true, array: true }),
  on_hands: str('手持帧', { nullable: true, array: true }),
  falling: obj('摔落帧', { nullable: true, fields: frame_id_list_pair_fields }),
  bouncing: obj('弹跳帧', { nullable: true, fields: frame_id_list_pair_fields }),
  critical_hit: obj('会心一击帧', { nullable: true, fields: frame_id_list_pair_fields }),
  injured: obj('受伤帧', { nullable: true, fields: frame_id_pair_fields }),
  grand_injured: obj('重伤帧', { nullable: true, fields: frame_id_list_pair_fields }),
  lying: obj('倒地帧', { nullable: true, fields: frame_id_pair_fields }),
  fire: str('火焰帧', { nullable: true, array: true }),
  ice: str('冰冻帧', { nullable: true }),
  on_ground: str('落地帧', { nullable: true }),
  just_on_ground: str('刚落地帧', { nullable: true }),
  throw_on_ground: str('投掷落地帧', { nullable: true }),
})