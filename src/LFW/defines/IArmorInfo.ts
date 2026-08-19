import { any, fields, flt, int, str } from "../fields";
import { ALL_ARMOR_ENUM, ARMOR_ENUM_DESC_MAP, ARMOR_ENUM_LABEL_MAP, ArmorEnum } from "./ArmorEnum";

export interface IArmorInfo {
  /**
   * 护甲 ID（用于引用 / 标识）
   *
   * @type {?string}
   */
  id?: string;

  /**
   * 护甲名称（可读名）
   *
   * @type {?string}
   */
  name?: string;

  /** 
   * 通过什么值来扣除toughness 
   * 
   * @type {ArmorEnum | number}
   * @memberof IArmorInfo
   */
  type?: ArmorEnum | number;

  /**
   * 耐久度
   */
  toughness?: number;

  /** 耐久度恢复度 */
  toughness_r_value?: number;
  
  /** 耐久度恢复频率 */
  toughness_r_tick?: number;
  
  /** 耐久度的恢复冷却 */
  toughness_resting?: number;

  /**
   * 护甲是否防火烧
   * 
   * 默认为false
   * 
   * 例:
   *   Julian，此值为true
   *   Louis与Knight，此值为false
   * 
   * @type {?number}
   * @memberof IArmorInfo
   */
  fireproof?: number;

  /**
   * 护甲是否防冻结
   * 
   * 默认为false
   * 
   * 例:
   *   Julian，此值为true
   *   Louis与Knight，此值为false
   * 
   * @type {?number}
   * @memberof IArmorInfo
   */
  antifreeze?: number;

  /**
   * 是否为全时生效
   * 
   * 默认为true
   * 
   * 例:
   *   Julian与Knight，此值为true
   *   Louis，此值为false
   * 
   * @type {?boolean}
   * @memberof IArmorInfo
   */
  fulltime?: boolean;

  /**
   * 受伤比例
   * 默认: 0.1
   *
   * @type {number}
   * @memberof IArmorInfo
   */
  injury_ratio?: number;

  /**
   * 硬直比例
   * 默认: 3
   *
   * @type {number}
   * @memberof IArmorInfo
   */
  shaking_ratio?: number;

  motionless_ratio?: number;

  /**
   * 护甲被击中的声音
   * 
   * @type {?string[]}
   * @memberof IArmorInfo
   */
  hit_sounds?: string[];

  /**
   * 护甲被击破的声音
   *
   * @type {?string[]}
   * @memberof IArmorInfo
   */
  dead_sounds?: string[];

}

export const armor_Info_fields = fields<IArmorInfo>({
  id: int('ID'),
  name: int('名称'),
  type: int("护甲类型", `
    决定了护甲耐久会根据itr的哪个值来降低
    `.trim(), {
    options: ALL_ARMOR_ENUM.map(v => ({
      value: v,
      label: ARMOR_ENUM_LABEL_MAP[v],
      desc: ARMOR_ENUM_DESC_MAP[v]
    }))
  }),
  toughness: int('耐久'),
  fireproof: int("防火", { options: [{ value: 0, label: 'NO' }, { value: 1, label: 'YES' }] }),
  antifreeze: int("防冻", { options: [{ value: 0, label: 'NO' }, { value: 1, label: 'YES' }] }),
  fulltime: int("全时生效", { options: [{ value: 0, label: 'NO' }, { value: 1, label: 'YES' }] }),
  injury_ratio: flt('受伤比例', '默认: 0.1'),
  shaking_ratio: flt('硬直比例', '默认: 3'),
  motionless_ratio: flt('??比例', '默认: 0.1'),
  hit_sounds: str("", { array: true }),
  dead_sounds: str("", { array: true }),
  toughness_resting: int,
  toughness_r_value: int,
  toughness_r_tick: int,
})
export function armor_Info_new(): IArmorInfo {
  return {
    type: ArmorEnum.Times,
    toughness: 2,
  }
}