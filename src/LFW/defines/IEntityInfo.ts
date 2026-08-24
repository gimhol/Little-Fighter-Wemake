import { any, fields, fields_map_2_fields_obj, flt, int, str } from "../fields";
import type { WorldDataset } from "../WorldDataset";
import { ALL_ENTITY_ENUM, ENTITY_ENUM_DESC_MAP, ENTITY_ENUM_LABEL_MAP, EntityEnum } from "./EntityEnum";
import { ALL_ENTITY_GROUP, ENTITY_GROUP_DESC_MAP, ENTITY_GROUP_LABEL_MAP } from "./EntityGroup";
import type { IArmorInfo } from "./IArmorInfo";
import type { IBotData } from "./IBotData";
import type { IDrinkInfo } from "./IDrinkInfo";
import type { IFramePic } from "./IFramePic";
import type { IModelInfo } from "./IModelInfo";
import type { IOpointInfo } from "./IOpointInfo";
import type { IPictureInfo } from "./IPictureInfo";
import { type IWorldDataset, world_dataset_fields } from "./IWorldDataset";
export interface IEntityInfo extends Partial<IWorldDataset> {
  type?: number;

  /**
   * 实体名称
   * @type {string}
   */
  name: string;

  /**
   * 头像
   * @type {string}
   */
  head?: string;

  /**
   * 缩略图
   * @type {string}
   */
  small?: string;


  /**
   * 强度
   *
   * 用于闯关模式
   *
   * 若一个角色强度等级为3，使用该角色进入闯关，敌方将视此角色为3个人
   *
   * 默认：1
   * @type {?number}
   */
  ce?: number;

  /**
   * 武器重量
   * （也许角色也可以考虑用这个属性？）
   */
  weight?: number

  /**
   * 所属组
   *
   * @see {Defines.EntityGroup}
   */
  group?: string[];

  files?: Record<string, IPictureInfo>;

  models?: Record<string, IModelInfo>;

  /**
   * 物体的弹性
   * - 目前仅用于武器，当武器接触到地面时，有如下速度变化：
   * - ```vy = -vy * bounce```
   *
   * @type {number}
   */
  bounce_x?: number;
  bounce_y?: number;
  bounce_z?: number;
  bounce_min_x?: number;
  bounce_min_y?: number;
  bounce_min_z?: number;
  fast_vx?: number;
  fast_vy?: number;
  fast_vz?: number;

  /**
   * 物体的碎片信息（目前仅用于武器）
   * 当物体的血量归0时，将根据brokens创建一系列物品。
   * 
   * 武器碎片是用这个实现的，
   * 读取数据时，当武器的data不存在brokens，将会根据oid为其添加对应的碎片opoint
   * 见: preprocess_entity_data ==> make_weapon_special
   * 
   * 也许也能用来实现更可怕的效果。
   *
   * @type {?IOpointInfo[]}
   */
  brokens?: IOpointInfo[];

  /**
   * 
   */
  drink?: IDrinkInfo

  /**
   * 落地伤害
   *
   * 目前只有武器会用到
   *
   * @type {?number}
   */
  drop_hurt?: number;

  /**
   * 被打到的声音
   *
   * 替代了：
   *    - LF2原版 ball类的weapon_hit_sound
   *    - LF2原版 weapon类的weapon_hit_sound
   *
   * 注意：
   *    - WEMAKE 中任意实体都支持该值
   *
   * @type {?string[]}
   */
  hit_sounds?: string[];

  /**
   * 落地声音
   *
   * 替代了：
   *    - LF2原版 ball类的weapon_drop_sound
   *    - LF2原版 weapon类的weapon_drop_sound
   *
   * 注意：
   *    - WEMAKE 中任意实体都支持该值
   *
   * @type {?string[]}
   */
  drop_sounds?: string[];

  /**
   * hp降至0时，发出的声音（会随机挑选一个播放）
   *
   * 替代了：
   *    - LF2原版 ball类的weapon_broken_sound
   *    - LF2原版 weapon类的weapon_broken_sound
   *
   * 注意：
   *    - WEMAKE 中任意实体都支持该值
   *
   * @type {?string[]}
   */
  dead_sounds?: string[];

  armor?: IArmorInfo;


  /**
   * BOT数据ID
   *
   * @type {string}
   */
  bot_id?: string;

  /**
   * BOT数据
   *
   * @type {IBotData}
   */
  bot?: IBotData;

  /**
   * 似乎有点想法，但不多
   *
   * @type {?Record<string, IFramePic>}
   */
  portraits?: Record<string, IFramePic>;
}
export function entity_info_new(): IEntityInfo {
  const ret: IEntityInfo = {
    name: "",
    type: EntityEnum.Entity,
  }
  return ret;
}

export const entity_info_fields = fields<IEntityInfo>({
  type: int('类型', {
    nullable: false,
    options: ALL_ENTITY_ENUM.map(v => ({
      value: v,
      label: ENTITY_ENUM_LABEL_MAP[v],
      desc: ENTITY_ENUM_DESC_MAP[v]
    }))
  }),
  name: str('名称', {
    nullable: true,
    maxLength: 16
  }),
  ce: int('强度', '默认：1， 若一个角色强度等级为3，使用该角色进入闯关，将视此角色为3个人', {
    nullable: true, min: 0, max: 8, step: 1
  }),
  head: str('头像'),
  small: str('缩略图'),
  group: str('实体组', '实体组', {
    array: true,
    nullable: true,
    options: ALL_ENTITY_GROUP.map(v => ({
      value: v,
      label: ENTITY_GROUP_LABEL_MAP[v],
      desc: ENTITY_GROUP_DESC_MAP[v]
    }))
  }),
  bounce_y: flt('反弹系数Y', '每次反弹速度都会乘此值', { nullable: true }),
  bounce_x: flt('反弹系数X', '每次反弹速度都会乘此值', { nullable: true }),
  bounce_z: flt('反弹系数Z', '每次反弹速度都会乘此值', { nullable: true }),
  bounce_min_y: flt('最低反弹速Y', '速度低于此值时，将不会反弹', { nullable: true }),
  bounce_min_x: flt('最低反弹速X', '速度低于此值时，将不会反弹', { nullable: true }),
  bounce_min_z: flt('最低反弹速Z', '速度低于此值时，将不会反弹', { nullable: true }),
  fast_vy: flt('武器快速Y', '武器速度超过此值时，会变为投掷状态', { nullable: true }),
  fast_vx: flt('武器快速X', '武器速度超过此值时，会变为投掷状态', { nullable: true }),
  fast_vz: flt('武器快速Z', '武器速度超过此值时，会变为投掷状态', { nullable: true }),
  files: any,
  models: any,
  brokens: any,
  drink: any,
  drop_hurt: any,
  hit_sounds: any,
  drop_sounds: any,
  dead_sounds: any,
  armor: any,
  weight: flt('重量', '目前为武器重量', { nullable: true }),
  bot_id: any,
  bot: any,
  portraits: any,
  ...fields_map_2_fields_obj(world_dataset_fields),
});