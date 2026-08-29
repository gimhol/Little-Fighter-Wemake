import { any, fields, flt, int, str } from "../fields";
import { Difficulty } from "./Difficulty";

export interface IStageObjectInfo {
  /** 物件ID的生成方式（TODO: 待实现） */
  id_method?: string; // TODO
  /** 物件类型ID列表，可为具体角色/物品ID或随机组ID */
  id?: string[];
  /** 生成位置的X坐标（水平） */
  x?: number;
  /** 生成位置的Y坐标（垂直） */
  y?: number;
  /** 生成位置的Z坐标（深度） */
  z?: number;
  /** 生成时的初始动作 */
  act?: string;
  /** 生成时的朝向：-1为左，1为右 */
  facing?: number;
  /** 血量 */
  hp?: number;
  /** 蓝量 */
  mp?: number;
  /** 不同难度下的血量 */
  hp_map?: { [x in Difficulty]?: number }
  /** 不同难度下的蓝量 */
  mp_map?: { [x in Difficulty]?: number }

  range_x?: number;
  range_y?: number;
  range_z?: number;

  /**
   * 出现次数
   * 
   * 当: times >= 0 && is_soldier != true
   * 物件死亡后将会重新创建, 然后times -= 1
   * 
   * 当：times 未设置 && is_soldier != true
   * 物件仅创建一次
   * 
   * 当：times 未设置 && is_soldier == true && boss exists
   * 物件死亡后将重新创建（不限次数）
   * 
   * 当: times >= 0 && is_soldier == true && boss exists
   * 物件死亡后将会重新创建, 然后times -= 1
   * 
   * 当：is_soldier == true && boss not exists
   * 物件死亡后将不重新创建
   *
   * @see {IStageObjectInfo.is_boss}
   * 
   * @type {number}
   * @memberof IStageObjectInfo
   */
  times?: number;
  /**
   * 生成比例系数。
   * 最终生成数量 = ceil(玩家数量 × 难度系数 × ratio)。
   * 未设置时默认生成1个。
   */
  ratio?: number;
  /** 是否为Boss，Boss存在时士兵可无限重生 */
  is_boss?: boolean;
  /** 是否为士兵，士兵在Boss存活时可无限重生 */
  is_soldier?: boolean;
  /** 备用数量，显示为 xN 标识 */
  reserve?: number;

  /**
   * 敌人被击败后，归降后的血量。
   * 若无此字段，敌人不会归降
   *
   * @type {?number}
   */
  join?: number;
  /** 归降后加入的队伍，默认为Team_1 */
  join_team?: string;
  join_reserve?: number;
  /** 自定义描边颜色，如 '#FF0000'。未设置时使用队伍默认颜色 */
  outline_color?: string;
}
export function stage_object_info_new(): IStageObjectInfo {
  return {}
}
export const stage_object_info_fields = fields<IStageObjectInfo>({
  id_method: str('ID生成方式'),
  id: str('物件ID', { array: true }),
  x: int('X坐标'),
  y: int('Y坐标'),
  z: int('Z坐标'),
  range_x: int('随机范围X'),
  range_y: int('随机范围Y'),
  range_z: int('随机范围Z'),
  act: str('初始动作'),
  facing: int('朝向', { options: [{ value: -1, label: '左' }, { value: 1, label: '右' }] }),
  hp: int('血量'),
  mp: int('蓝量'),
  hp_map: any('血量(按难度)'),
  mp_map: any('蓝量(按难度)'),
  times: int('出现次数'),
  ratio: flt('比例系数'),
  is_boss: any('是否为Boss'),
  is_soldier: any('是否为士兵'),
  reserve: int('备用数量'),
  join: int('归降血量'),
  join_team: str('归降队伍'),
  join_reserve: int('归降后复活次数'),
  outline_color: str('描边颜色'),
});
