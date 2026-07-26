import { fields, int } from "../fields";

/**
 * 饮料数据
 *
 * @export
 * @interface IDrinkInfo
 */
export interface IDrinkInfo {
  /**
   * 饮料 ID（用于引用 / 标识）
   *
   * @type {?string}
   */
  id?: string;

  /**
   * 饮料名称（可读名）
   *
   * @type {?string}
   */
  name?: string;

  /**
   * 最多能恢复多少HP
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  hp_h_total?: number;

  /**
   * 每次恢复多少HP
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  hp_h_value?: number;

  /**
   * 间隔多少帧触发一次HP恢复
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  hp_h_ticks?: number;

  /**
   * 该饮料最多能恢复多少暗HP
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  hp_r_total?: number;

  /**
   * 每次恢复恢复多少暗HP
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  hp_r_value?: number;

  /**
   * 间隔多少帧触发一次暗HP恢复
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  hp_r_ticks?: number;

  /**
   * 最多能恢复多少MP
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  mp_h_total?: number;

  /**
   * 每次恢复恢复多少MP
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  mp_h_value?: number;

  /**
   * 间隔多少帧触发一次MP恢复
   *
   * @type {number}
   * @memberof IDrinkInfo
   */
  mp_h_ticks?: number;
}

export function drink_info_new(): IDrinkInfo {
  return {}
}

export const drink_Info_fields = fields<IDrinkInfo>({
  id: int('ID'),
  name: int('名称'),
  hp_h_total: int('', '最多能恢复多少HP'),
  hp_h_value: int('', '每次恢复多少HP'),
  hp_h_ticks: int('', '间隔多少帧触发一次HP恢复'),
  hp_r_total: int('', '最多能恢复多少暗HP'),
  hp_r_value: int('', '每次恢复多少暗HP'),
  hp_r_ticks: int('', '间隔多少帧触发一次暗HP恢复'),
  mp_h_total: int('', '最多能恢复多少MP'),
  mp_h_value: int('', '每次恢复多少MP'),
  mp_h_ticks: int('', '间隔多少帧触发一次MP恢复'),
})