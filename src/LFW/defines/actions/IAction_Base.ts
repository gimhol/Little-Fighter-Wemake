import type { IExpression } from "../IExpression";

/**
 * 条件动作
 *
 * 简单的来说，就是满足条件时，做点什么
 */
export interface IAction_Base {
  /**
   * 条件表达式
   *
   * @type {string}
   * @memberof IAction_Base
   */
  test?: string;

  /**
   * 条件测试器
   *
   * 一般应该在读取数据时，通过test生成
   *
   * 当test不存在，tester也不存在
   *
   * 无条件测试器时，一般视为测试通过。
   *
   * @see {IAction_Base.test}
   * @type {?IExpression<any>}
   */
  tester?: IExpression<any>;

  /**
   * 是否在碰撞响应前判定？
   * 
   * @type {?boolean} 默认true
   */
  pretest?: boolean;

  /** 子类数据，任意object */
  data?: object;

  /** 开发者描述 */
  desc?: string;
}
