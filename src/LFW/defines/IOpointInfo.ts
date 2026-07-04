import { any, fields, flt, int, str } from "../fields";
import type { FacingFlag } from "./FacingFlag";
import type { TNextFrame } from "./INextFrame";
import type { IQubePair } from "./IQubePair";
import { OpointKind } from "./OpointKind";
import { OpointMultiEnum } from "./OpointMultiEnum";
import { OpointSpreading } from "./OpointSpreading";
export type __KEEP_FacingFlag = FacingFlag;

export interface IOpointMulti {
  /** 生成数量的决定方式 */
  type: OpointMultiEnum | number;
  /**
   * 依据数量零时，将不生成（数量需参见决定方式）
   * @see {OpointMultiEnum.AccordingEnemies}
   *
   * - 当：
   *   - multi.type == OpointMultiEnum.AccordingEnemies。
   *   - multi.skip_zero == true
   *   - 场上无敌人
   * - 则：
   *   - 该Opoint将不会生成东西（即使设置了min/max）
   */
  skip_zero?: boolean;
  /** 至少产生多少个 */
  min?: number;
  /** 至多产生多少个 */
  max?: number;
}

export interface IOpointInfo {
  /**
   * opoint ID（用于引用 / 标识）
   *
   * @type {?string}
   */
  id?: string;

  /**
   * opoint 名称（可读名）
   *
   * @type {?string}
   */
  name?: string;

  /**
   *
   * @type {number}
   * @memberof IOpointInfo
   * @see {OpointKind}
   */
  kind: number | OpointKind;

  /**
   * 实体产生的X坐标（相对frame矩形左上角）
   * @type {number}
   */
  x: number;

  /**
   * 实体产生的Y坐标（相对frame矩形左上角）
   * @type {number}
   */
  y: number;

  origin_type?: number;

  z?: number;
  /**
   * 实体数据ID
   *
   * @type {string | string[]}
   */
  oid: string | string[];

  /**
   * 用于：
   * * [X] LF2
   * * [X] WEMAKE
   *
   * 生成物体处于哪一帧
   *
   * - 在原版中：
   *    - action仅仅是个数字，指向某个帧.
   *
   * - 在WEMAKE中：
   *    - action是INextFrame(或多个INextFrame)
   *
   * @type {TNextFrame}
   */
  action: TNextFrame;

  /**
   * 发射初速度X
   */
  dvx?: number;

  /**
   * 发射初速度Y
   */
  dvy?: number;

  /**
   * 发射初速度Z
   */
  dvz?: number;

  /**
   * 用于：
   * * [ ] LF2
   * * [X] WEMAKE
   *
   * 生成数量。
   *
   * - 在原版中：
   *    - 生成物体的数量是通过facing实现的，facing的十位数以上为数量（数量=facing整除10）
   *    - 个位数为方向，0表示与发射者朝向相同，1表示与发射者朝向相反
   *
   * - 在WEMAKE中：
   *    - multi即代表生成数量，默认为1，若小于1，则什么都不会生成。
   *    - 生成物的朝向见通过action的facing决定
   *
   * @see {FacingFlag}
   * @type {?number}
   */
  multi?: number | IOpointMulti;

  /**
   * 最大血量
   * 将覆盖原实体的最大血量
   */
  max_hp?: number;

  /**
   * 生成后的血量
   * 将覆盖原实体的血量
   */
  hp?: number;

  /**
   * 生成后的最大蓝量
   * 将覆盖原实体的最大蓝量
   */
  max_mp?: number;

  /**
   * 生成后的蓝量
   * 将覆盖原实体的蓝量
   */
  mp?: number;

  /**
   * 按着上或下时，生成物被额外赋予的初速度Z
   */
  speedz?: number;

  /**
   * 用于：
   * * [ ] LF2
   * * [X] WEMAKE
   *
   * 扩散模式
   *
   * 当multi大于1，扩散模式生效。
   * @see OpointSpreading
   */
  spreading?: number | OpointSpreading;

  /**
   * 
   */
  is_entity?: boolean;

  interval?: number;
  interval_id?: string;
  interval_mode?: 1 | 0;
  motionless?: number;

  spreading_x?: number[];
  spreading_y?: number[];
  spreading_z?: number[];

  unimportant?: number;
  delay?: number;


  /* 从发射者继承多少速度 */
  inherit_speed_x?: number;
  inherit_speed_y?: number;
  inherit_speed_z?: number;

  
  __indicator_info?: IQubePair;
  /** 运行时生成 */
  __spreading_random_x?: { take(): number };
  /** 运行时生成 */
  __spreading_random_y?: { take(): number };
  /** 运行时生成 */
  __spreading_random_z?: { take(): number };
}

const ALL_OPOINT_KIND = Object.values(OpointKind).filter(v => typeof v === 'number') as number[];
const ALL_OPOINT_SPREADING = Object.values(OpointSpreading).filter(v => typeof v === 'number') as number[];
const ALL_OPOINT_MULTI_ENUM = Object.values(OpointMultiEnum).filter(v => typeof v === 'number') as number[];

export function opoint_info_new(): IOpointInfo {
  return {
    kind: OpointKind.Normal,
    x: 0,
    y: 0,
    oid: "",
    action: { id: "" },
  };
}

export const opoint_info_fields = fields<IOpointInfo>({
  id: int('ID'),
  name: int('名称'),
  kind: int("类型", {
    options: ALL_OPOINT_KIND.map(v => ({
      value: v,
      label: OpointKind[v],
    })),
  }),
  x: int("X"),
  y: int("Y"),
  origin_type: any,
  z: int("Z"),
  oid: str("实体数据ID"),
  action: any,
  dvx: flt("初速度X"),
  dvy: flt("初速度Y"),
  dvz: flt("初速度Z"),
  multi: any,
  max_hp: int("最大血量"),
  hp: int("血量"),
  max_mp: int("最大蓝量"),
  mp: int("蓝量"),
  speedz: flt("额外初速度Z"),
  spreading: int("扩散模式", {
    options: ALL_OPOINT_SPREADING.map(v => ({
      value: v,
      label: OpointSpreading[v],
    })),
  }),
  is_entity: any,
  interval: int("间隔帧数"),
  interval_id: str("间隔ID"),
  interval_mode: int("间隔模式", {
    options: [
      { value: 0, label: "模式0" },
      { value: 1, label: "模式1" },
    ],
  }),
  motionless: int("停顿值"),
  spreading_x: any,
  spreading_y: any,
  spreading_z: any,
  unimportant: int("不重要标记"),
  delay: int("延迟帧数"),
  inherit_speed_x: flt("继承速度X"),
  inherit_speed_y: flt("继承速度Y"),
  inherit_speed_z: flt("继承速度Z"),


  __spreading_random_x: any,
  __spreading_random_y: any,
  __spreading_random_z: any,
  __indicator_info: any,
})
