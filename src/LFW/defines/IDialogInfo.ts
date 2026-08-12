import type { IExpression } from "./IExpression";
import { any, fields, int, str } from "../fields";

export interface IDialogInfo {
  /** 
   * 对话框类型 
   */
  type?: 'left' | 'right'

  /** 
   * 说话的角色ID
   */
  fighter?: string;

  /** 
   * 是否暂停游戏 
   */
  pause?: boolean;

  /**
   * 对话文本
   */
  i18n: string;

  /** 
   * 如果关闭当前对话 
   * 
   * 默认: 'press_a'
   */
  close_by?: string;


  /** 
   * 隐藏状态栏 
   */
  hide_stats?: number;

  /** 
   * 结束判定 
   * 
   * @type {string[]}
   */
  end_test?: string[];

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

export enum DialogCloseBy {
  PRESS_A = 'press_a'
}
export const DialogCloseByDescriptions: Record<DialogCloseBy, string> = {
  [DialogCloseBy.PRESS_A]: "",
}

export const dialog_info_fields = fields<Partial<IDialogInfo>>({
  type: str('位置', 'left 或 right', { options: [{ value: 'left', label: '左' }, { value: 'right', label: '右' }] }),
  fighter: str('说话角色ID'),
  pause: any('暂停游戏'),
  i18n: str('对话文本'),
  close_by: str('关闭方式', '默认 press_a'),
  hide_stats: int('隐藏状态栏'),
  end_test: str('结束判定', { array: true }),
  __end_testers: any('结束测试器', { array: true }),
});