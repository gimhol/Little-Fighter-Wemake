import { any, fields, str } from "../fields";
import { make_schema } from "../utils/schema";
import type { IStagePhaseInfo } from "./IStagePhaseInfo";
/**
 * 关卡信息
 */
export interface IStageInfo {
  /**
   * 关卡ID
   *
   * @type {string}
   * @memberof IStageInfo
   */
  id: string;

  /**
   * 关卡使用的背景ID
   * 
   * @type {string}
   * @memberof IStageInfo
   */
  bg: string;

  name: string;

  /**
   * 所属章ID
   * 
   * @type {string}
   * @memberof IStageInfo
   */
  chapter?: string;

  /**
   * 下一关卡ID
   */
  next?: string;

  /**
   * 关卡结束判定
   *
   * 默认是全部阶段已结束
   *
   * @type {?string}
   */
  cond_end?: string;

  /**
   * 关卡结束后，如何才进入下一关卡
   *
   * 默认是玩家跑到场景的最右边
   *
   * @type {?string}
   */
  act_of_goto_next?: string;

  /**
   * 是否为首个小关
   * 
   * @type {boolean}
   * @memberof IStageInfo
   */
  is_starting?: boolean;

  /**
   * 起点名称
   */
  starting_name?: string;

  /**
   * 大标题
   *
   * @type {string}
   * @memberof IStageInfo
   */
  title?: string;

  group?: string[];
  
  phases: IStagePhaseInfo[];
}

export function stage_info_new(): IStageInfo {
  return {
    id: "",
    bg: "",
    name: "",
    phases: []
  }
}

export const stage_info_fields = fields<IStageInfo>({
  id: str('关卡ID'),
  bg: str('背景ID'),
  name: str('名称'),
  chapter: str('所属章节'),
  next: str('下一关'),
  group: str('分组', { array: true }),
  cond_end: str('结束条件', '默认全部阶段结束'),
  act_of_goto_next: str('通过动作', '默认玩家跑到场景最右边'),
  is_starting: any('初始关卡', { options: [{ value: true, label: 'YES' }, { value: false, label: 'NO' }] }),
  starting_name: str('起点名称'),
  title: str('大标题'),
  phases: any('阶段列表', { array: true }),
});

export const Schema_IStageInfo = make_schema<IStageInfo>({
  key: "IStageInfo",
  type: "object",
  properties: {
    id: { type: 'string' },
    bg: { type: 'string' },
    name: { type: 'string' },
    phases: { type: 'array', items: { type: 'object' } },
    chapter: { type: 'string', nullable: true },
    next: { type: 'string', nullable: true },
    cond_end: { type: 'string', nullable: true },
    act_of_goto_next: { type: 'string', nullable: true },
    is_starting: { type: 'boolean', nullable: true },
    starting_name: { type: 'string', nullable: true },
    title: { type: 'string', nullable: true },
    group: { type: 'array', items: { type: 'string' }, nullable: true },
  },
});
