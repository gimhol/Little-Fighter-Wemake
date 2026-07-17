import { any, fields, flt, int, str } from "../fields";
import { make_schema } from "../utils/schema";
import type { TAction } from "./actions";
import { ALL_FACING_FLAG, FACING_FLAG_DESC_MAP, FACING_FLAG_LABEL_MAP, FacingFlag } from "./FacingFlag";
import { ALL_FRAME_BEHAVIOR, FRAME_BEHAVIOR_DESC_MAP, FRAME_BEHAVIOR_LABEL_MAP, FrameBehavior } from "./FrameBehavior";
import type { IBdyInfo } from "./IBdyInfo";
import type { IBpointInfo } from "./IBpointInfo";
import type { IChaseInfo } from "./IChaseInfo";
import type { ICpointInfo } from "./ICpointInfo";
import type { IFramePictureInfo } from "./IFramePictureInfo";
import type { IHitKeyCollection } from "./IHitKeyCollection";
import type { IHoldKeyCollection } from "./IHoldKeyCollection";
import type { IItrInfo } from "./IItrInfo";
import type { TNextFrame } from "./INextFrame";
import type { IOpointInfo } from "./IOpointInfo";
import type { IQubePair } from "./IQubePair";
import type { IVelocityInfo } from "./IVelocityInfo";
import { type IWorldDataset, Schema_IWorldDataset_Partial, world_dataset_fields } from "./IWorldDataset";
import type { IWpointInfo } from "./IWpointInfo";
import type { StateEnum } from "./StateEnum";

/**
 * 实体的帧信息
 *
 * @export
 * @interface IFrameInfo
 */
export interface IFrameInfo extends Partial<IWorldDataset>, IVelocityInfo {

  /**
   * 帧ID
   * 
   * 每个实体的帧ID不允许重复
   *
   * 对应LF2 数据里`<frame> id name` 的 `id`;
   * 
   * LF2 的 `frame.id` 只能是 >= 0 && <= 399 的整帧数；
   * 
   * LFW 的 `frame.id` 则为字符串
   * 
   * @type {string}
   */
  id: string;

  /**
   * 帧名
   * 
   * 对应LF2数据里 `<frame> id name` 的 `name`；
   * 
   * 似乎仅仅用来方便人看的；
   * 
   * @type {string}
   */
  name: string;


  /**
   * 帧切图
   * 
   * LF2中, 这是个切图网格的索引数字；
   * 
   * LFW中，已改为通过图片ID+切图矩形表示；
   * 
   * @type {?IFramePictureInfo}
   */
  pic?: IFramePictureInfo;

  /**
   *
   * @see {StateEnum}
   * @type {number}
   */
  state: number | StateEnum;

  /**
   * 帧等待数
   * 
   * 本帧持续多长时间
   * 
   * @type {number}
   */
  wait: number;

  /**
   * wait end, what next?
   *
   * @type {TNextFrame}
   */
  next: TNextFrame;

  /**
   * 脚点x坐标（相对帧切图的x）
   * 
   * 简单的来说：
   * 
   * 角色地面接触时，玩家可见“帧切图”的 centerx, centery 将位于影子的中心
   * 
   * @type {number}
   */
  centerx: number;

  /**
   * 脚点y坐标（相对帧切图的y）
   * 
   * 简单的来说：
   * 
   * 角色地面接触时，玩家可见“帧切图”的 centerx, centery 将位于影子的中心
   * 
   * @type {number}
   */
  centery: number;

  width: number;
  height: number;

  /**
   * 进入此帧时播放的声音
   *
   * @type {?string}
   */
  sound?: string;

  /**
   * 此frame消耗的血量，每帧都会扣
   *
   * 原版的角色消耗mp与hp见INextFrame
   *
   * @see {INextFrame}
   */
  hp_max?: number;

  hold?: IHoldKeyCollection;
  hit?: IHitKeyCollection;
  key_down?: IHoldKeyCollection;
  key_up?: IHoldKeyCollection;
  seqs?: { [x in string]?: TNextFrame; };
  bdy?: IBdyInfo[];
  itr?: IItrInfo[];
  wpoint?: IWpointInfo;
  bpoint?: IBpointInfo;
  opoint?: IOpointInfo[];
  cpoint?: ICpointInfo;
  /**
   * 隐身多少帧
   * 
   * @type {?number}
   */
  invisible?: number;
  /**
   * 是否有影子
   * 
   * @type {?number} 1=有影子 0=没影子
   */
  no_shadow?: number;

  /**
   * 起跳标志（角色专用）
   *
   * 从state为```StateEnum.Jump```的frame，
   * 跳至state为```StateEnum.Jump```的frame时，
   * 若前（frame.jump_flag == 1）且后（frame.jump_flag == 0）或空。
   * 此时将会计算跳跃速度，让角色跳起来。
   *
   * @see {StateEnum.Jump}
   * @type {?number}
   */
  jump_flag?: number;

  /**
   * 死亡后跳转
   *
   * hp从正数降至小于等于0时，跳转至on_dead中符合条件的帧
   *
   * @type {?TNextFrame}
   */
  on_dead?: TNextFrame;

  on_exhaustion?: TNextFrame;

  /**
   * Description placeholder
   *
   * @type {?TNextFrame}
   */
  on_landing?: TNextFrame;

  /**
   * 原ball的hit_Fa
   * 
   * 跟踪效果改由chase决定
   *
   * @type {?number}
   * @see {FrameBehavior}
   */
  behavior?: number | FrameBehavior;


  chase?: IChaseInfo;

  /**
   * 是否响应重力
   */
  gravity_enabled?: boolean;

  /**
   * 这个好像不太好
   */
  broadcasts?: string[];

  facing?: FacingFlag;


  /**
   * 决定了帧的落地行为
   * 
   * - ball.frame.landable 默认为 0
   * - weapon.frame.landable 默认为 1
   * - fighter.frame.landable 默认为 1
   * 
   * - 可用值: 
   *    - 0 = 不与地面反应，将掉落到地面以下
   *    - 1 = 与地面接触时，y速度归0，进入frame.on_landing，播放drop_sounds
   *
   * @type {?number}
   */
  landable?: number;

  on_restrict?: TNextFrame;
  on_x_restrict?: TNextFrame;
  on_y_restrict?: TNextFrame;
  on_z_restrict?: TNextFrame;

  /* 运行时使用，为Debug预留的玩意 */
  __indicator_info?: IQubePair;
  /* 运行时使用，为渲染层预留的玩意 */
  __tex?: any;
  /* 运行时使用，为碰撞检测预留的玩意 */
  __aabb_x1?: number;
  __aabb_x2?: number;
  __aabb_z1?: number;
  __aabb_z2?: number;
  /** 运行时使用，根据seqs生成 */
  __seq_map?: Map<string, TNextFrame>;

  /** 加载时生成，当itr存在on_hit_ground，会加到此 */
  __hit_ground_itrs?: IItrInfo[];
  /** 加载时生成，当bdy存在on_hit_ground，会加到此 */
  __hit_ground_bdys?: IBdyInfo[];
}

export function frame_info_new(): IFrameInfo {
  const ret: IFrameInfo = {
    id: "",
    name: "",
    state: 0,
    wait: 0,
    next: { id: "" },
    centerx: 0,
    centery: 0,
    width: 0,
    height: 0,
  };
  return ret;
}

export const frame_info_fields = fields<IFrameInfo>(
  {
    id: str("帧ID", { nullable: false, maxLength: 32 }),
    name: str("帧名", { nullable: false, maxLength: 32 }),
    pic: any,
    state: int("状态", { nullable: false }),
    wait: int("等待帧数", { nullable: false, min: 0 }),
    next: any,
    centerx: int("中心X", { nullable: false }),
    centery: int("中心Y", { nullable: false }),
    width: int("宽度", { nullable: false, min: 1 }),
    height: int("高度", { nullable: false, min: 1 }),
    sound: str("进入音效", { nullable: true }),
    hold: any,
    hit: any,
    key_down: any,
    key_up: any,
    seqs: any,
    bdy: any,
    itr: any,
    wpoint: any,
    bpoint: any,
    opoint: any,
    cpoint: any,
    invisible: int("隐身帧数", { nullable: true }),
    no_shadow: int("有否影子", "1=有影子 0=没影子", {
      nullable: true,
      options: [
        { value: 0, label: "没影子" },
        { value: 1, label: "有影子" },
      ],
    }),
    jump_flag: int("起跳标志", "下一帧将拥有向上的跳越速度，仅用于跳越", { nullable: true }),
    on_dead: any,
    on_exhaustion: any,
    on_landing: any,
    behavior: int("行为标志", {
      nullable: true,
      options: ALL_FRAME_BEHAVIOR.map(v => ({
        value: v,
        label: FRAME_BEHAVIOR_LABEL_MAP[v],
        desc: FRAME_BEHAVIOR_DESC_MAP[v],
      })),
    }),
    chase: any,
    gravity_enabled: any,
    broadcasts: any,
    facing: int("朝向标志", {
      nullable: true,
      options: ALL_FACING_FLAG.map(v => ({
        value: v,
        label: FACING_FLAG_LABEL_MAP[v],
        desc: FACING_FLAG_DESC_MAP[v],
      })),
    }),
    landable: int("落地行为", "0=穿透地面, 1=落地触发", {
      nullable: true,
      min: 0, max: 1,
      options: [
        { value: 0, label: "穿透地面" },
        { value: 1, label: "落地触发" },
      ],
    }),
    // IVelocityInfo 字段
    dvx: flt("默认速度X", { nullable: true }),
    dvy: flt("默认速度Y", { nullable: true }),
    dvz: flt("默认速度Z", { nullable: true }),
    vxm: int("速度模式X", { nullable: true }),
    vym: int("速度模式Y", { nullable: true }),
    vzm: int("速度模式Z", { nullable: true }),
    acc_x: flt("加速度X", { nullable: true }),
    acc_y: flt("加速度Y", { nullable: true }),
    acc_z: flt("加速度Z", { nullable: true }),
    ctrl_x: int("控制模式X", { nullable: true }),
    ctrl_y: int("控制模式Y", { nullable: true }),
    ctrl_z: int("控制模式Z", { nullable: true }),

    // 内部/渲染用字段
    __seq_map: any,
    __indicator_info: any,
    __tex: any,
    __aabb_x1: any,
    __aabb_x2: any,
    __aabb_z1: any,
    __aabb_z2: any,
    __hit_ground_itrs: any,
    __hit_ground_bdys: any,
  },
  world_dataset_fields
);

export const Schema_IFrameInfo = make_schema<IFrameInfo>({
  key: "IFrameInfo",
  type: "object",
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    state: { type: 'number' },
    wait: { type: 'number' },
    dvx: { type: 'number', nullable: true },
    dvy: { type: 'number', nullable: true },
    dvz: { type: 'number', nullable: true },
    acc_x: { type: 'number', nullable: true },
    acc_y: { type: 'number', nullable: true },
    acc_z: { type: 'number', nullable: true },
    vxm: { type: 'number', nullable: true },
    vym: { type: 'number', nullable: true },
    vzm: { type: 'number', nullable: true },
    centerx: { type: 'number' },
    centery: { type: 'number' },
    sound: { type: 'string', nullable: true },
    invisible: { type: 'number', number: { int: true, nagetive: false }, nullable: true },
    no_shadow: { type: 'number', oneof: [0, 1], nullable: true },
    jump_flag: { type: 'number', oneof: [0, 1], nullable: true },
    pic: { type: 'object', nullable: true },// TODO!
    next: { type: 'object' },// TODO!
    width: { type: 'number' },
    height: { type: 'number' },
    hold: { type: 'object', nullable: true },// TODO!
    hit: { type: 'object', nullable: true },// TODO!
    key_down: { type: 'object', nullable: true },// TODO!
    key_up: { type: 'object', nullable: true },// TODO!
    seqs: { type: 'object', nullable: true },// TODO!
    bdy: { type: 'array', nullable: true, items: { type: 'object' } }, // TODO!
    itr: { type: 'array', nullable: true, items: { type: 'object' } }, // TODO!
    wpoint: { type: 'object', nullable: true },// TODO!
    bpoint: { type: 'object', nullable: true },// TODO!
    opoint: { type: 'array', nullable: true, items: { type: 'object' } },// TODO!
    cpoint: { type: 'object', nullable: true },// TODO!
    on_dead: { type: 'object', nullable: true },// TODO!
    on_exhaustion: { type: 'object', nullable: true },// TODO!
    on_landing: { type: 'object', nullable: true },// TODO!
    on_restrict: { type: 'object', nullable: true },// TODO!
    on_x_restrict: { type: 'object', nullable: true },// TODO!
    on_y_restrict: { type: 'object', nullable: true },// TODO!
    on_z_restrict: { type: 'object', nullable: true },// TODO!
    behavior: { type: 'number', nullable: true },
    chase: { type: 'object', nullable: true },// TODO!
    gravity_enabled: { type: 'boolean', nullable: true },
    broadcasts: { type: 'array', nullable: true, items: { type: 'string' } },
    facing: { type: 'number', nullable: true },
    landable: { type: 'number', nullable: true },

    ctrl_x: { type: 'number', nullable: true },
    ctrl_y: { type: 'number', nullable: true },
    ctrl_z: { type: 'number', nullable: true },

    __tex: { type: 'object', nullable: true },
    __indicator_info: { type: 'object', nullable: true },
    __aabb_x1: { type: 'number', nullable: true },
    __aabb_x2: { type: 'number', nullable: true },
    __aabb_z1: { type: 'number', nullable: true },
    __aabb_z2: { type: 'number', nullable: true },
    __seq_map: { type: 'object', nullable: true },
    __hit_ground_itrs: { type: 'object', nullable: true },
    __hit_ground_bdys: { type: 'object', nullable: true },
    ...Schema_IWorldDataset_Partial.properties!
  },
});

