import { BotStateEnum } from "./BotStateEnum";
import type { LGK } from "./GameKey";
import type { IBotRay } from "./IBotRay";
import type { IExpression } from "./IExpression";

/**
 * BOT动作
 *
 * @export
 * @interface IBotAction
 */
export interface IBotAction {
  action_id: string;
  /**
   * 动作欲望值，范围 [0, 10000]
   *
   * 只有当前随机到的欲望值小于desire时，该Action才可能触发
   */
  desire?: number;
  desire_base?: number;
  desire_step?: number;

  /**
   * 针对敌人的XZ射线检测
   *
   * 需要符合其中之一时，该Action才可能触发
   */
  e_ray?: IBotRay[];

  /**
   * 判定式
   *
   * 判定成立时，该Action才可能触发
   *
   * ``` typescript
   * // 用代码来生成的例子
   * action.expression = new CondMaker<EntityVal | BotVal>().add(EntityVal.Shaking,">",0).done()
   * ```
   *
   * @type {(string)}
   * @memberof IBotAction
   */
  expression?: string ;

  /**
   * 判定器
   * 在读取数据时，根据判定式生成
   *
   * @type {IExpression<any>}
   * @memberof IBotAction
   */
  judger?: IExpression<any>;

  status?: BotStateEnum[];

  /**
   * 该action触发时，bot按下的键
   *
   * @type {(('F' | 'B' | LGK)[])}
   * @memberof IBotAction
   */
  keys?: ('F' | 'B' | LGK)[];

  frame?: string;
}
