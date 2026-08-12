import { any, fields, flt, int, str } from "../fields";
import { make_schema } from "../utils/schema";
import type { Difficulty } from "./Difficulty";
import type { IDialogInfo } from "./IDialogInfo";
import type { IExpression } from "./IExpression";
import type { IStageObjectInfo } from "./IStageObjectInfo";

export interface ISoundPlayInfo {
  path: string;
  x?: number;
  y?: number;
  z?: number;
  desc?: string;
}
export function sound_play_info_new(): ISoundPlayInfo {
  return { path: '' }
}
export const sound_play_info_fields = fields<ISoundPlayInfo>({
  path: str,
  x: int,
  y: int,
  z: int,
  desc: str
})




/**
 * 关卡阶段信息
 *
 * @export
 * @interface IStagePhaseInfo
 */
export interface IStagePhaseInfo {
  title?: string;
  /** @deprecated */
  bound?: number;
  /** 玩家左边界 */
  player_l?: number;
  /** 玩家右边界 */
  player_r?: number;
  /** 相机左边界 */
  camera_l?: number;
  /** 相机右边界 */
  camera_r?: number;
  /** 敌人左边界 */
  enemy_l?: number;
  /** 敌人右边界 */
  enemy_r?: number;
  /** 饮料左边界 */
  drink_l?: number;
  /** 饮料右边界 */
  drink_r?: number;
  /** 关卡描述 */
  desc?: string;

  /** 
   * 背景音乐 
   * 
   * 设为空字符将停止播放当前正在播放的背景音乐
   * @type {string}
   */
  music?: string;

  /**
   * 相机跳至位置
   *
   * @type {?number}
   */
  cam_jump_to_x?: number;

  /**
   * 玩家跳至位置
   *
   * @type {?number}
   */
  player_jump_to_x?: number;
  player_jump_to_z?: number;

  /**
   * 玩家朝向
   *
   * @type {?number}
   */
  player_facing?: number;

  /** 
   * 结束判定 
   * 
   * @type {string[]}
   */
  end_test?: string[];
  on_start?: string[];
  on_end?: string[];

  /** 隐藏状态栏 */
  hide_stats?: number;

  world_pause?: number;
  control_disabled?: number;
  weapon_rain_disabled?: number;

  respawn?: { [x in Difficulty]?: number };
  respawn_r?: { [x in Difficulty]?: number };
  respawn_x?: { [x in Difficulty]?: number };
  health_up?: { [x in Difficulty]?: number },
  mp_up?: { [x in Difficulty]?: number },
  /**
   * 播放音效
   * 
   * @type {string}
   */
  sounds?: ISoundPlayInfo[]
  objects?: IStageObjectInfo[];
  dialogs?: IDialogInfo[];

  /**
   * 结束测试器
   * 读取数据时，通过end_test生成
   * 
   * 当end_test不存在，end_tester也不存在
   * 
   * 无结束测试器时, 对话框完毕，且敌人被清空视为结束
   */
  __end_testers?: IExpression<any>[];
}
export function stage_phase_info_new(): IStagePhaseInfo {
  return {}
}

export const stage_phase_info_fields = fields<Partial<IStagePhaseInfo>>({
  title: str('标题'),
  bound: int('边界(旧)', '已弃用'),
  player_l: int('玩家左边界'),
  player_r: int('玩家右边界'),
  camera_l: int('相机左边界'),
  camera_r: int('相机右边界'),
  enemy_l: int('敌人左边界'),
  enemy_r: int('敌人右边界'),
  drink_l: int('饮料左边界'),
  drink_r: int('饮料右边界'),
  desc: str('描述'),
  objects: any('物件列表', { array: true }),
  music: str('背景音乐'),
  sounds: any('音效', { array: true }),
  respawn: any('重生'),
  respawn_r: any('重生(右)'),
  respawn_x: any('重生X'),
  health_up: any('血量补给'),
  mp_up: any('蓝量补给'),
  cam_jump_to_x: flt('相机跳至X'),
  player_jump_to_x: flt('玩家跳至X'),
  player_jump_to_z: flt('玩家跳至Z'),
  player_facing: int('玩家朝向', { options: [{ value: -1, label: '左' }, { value: 1, label: '右' }] }),
  end_test: str('结束判定', { array: true }),
  __end_testers: any('结束测试器', { array: true }),
  on_start: str('开始时动作', { array: true }),
  on_end: str('结束时动作', { array: true }),
  dialogs: any('对话框', { array: true }),
  hide_stats: int('隐藏状态栏'),
  world_pause: int('世界暂停'),
  control_disabled: int('禁用控制'),
  weapon_rain_disabled: int('禁用武器雨'),
});

type PhaseCheckable = Pick<IStagePhaseInfo, 'bound' | 'desc'>;

export const Schema_IStagePhaseInfo = make_schema<PhaseCheckable>({
  key: "IStagePhaseInfo",
  type: "object",
  properties: {
    bound: { type: 'number' },
    desc: { type: 'string', nullable: true },
  },
});
