import type { IClientInfo } from "./IClientInfo";
import type { IDataInfo } from "./IDataInfo";
import type { IRoomClientInfo } from "./IRoomClientInfo";

/**
 * 房间信息
 *
 * @export
 * @interface IRoomInfo
 */
export interface IRoomInfo {
  /**
   * 房间编号
   *
   * @type {string}
   * @memberof IRoomInfo
   */
  title?: string;

  /**
   * 房间ID
   *
   * @type {string}
   * @memberof IRoomInfo
   */
  id?: string;

  /**
   * 房间编号
   *
   * @type {string}
   * @memberof IRoomInfo
   */
  code?: string;

  /**
   * 房主
   *
   * @type {Required<IClientInfo>}
   * @memberof IRoomInfo
   */
  owner?: Required<IClientInfo>;

  /**
   * 房间内客户端
   *
   * @type {Required<IRoomClientInfo>[]}
   * @memberof IRoomInfo
   */
  clients?: Required<IRoomClientInfo>[];

  /**
   * 最小玩家数
   *
   * @type {number}
   * @memberof IRoomInfo
   */
  min_players?: number;

  /**
   * 最大玩家数
   *
   * @type {number}
   * @memberof IRoomInfo
   */
  max_players?: number;

  /**
   * 房间是否已开始
   * 
   * @type {boolean}
   * @memberof IRoomInfo
   */
  started?: boolean;

  /**
   * 房间是否需要密码
   * 
   * @type {boolean}
   * @memberof IRoomInfo
   */
  need_pwd?: boolean;

  /**
   * 房主创建房间时的 LFW 版本号
   *
   * @type {string}
   * @memberof IRoomInfo
   */
  lfw_version?: string;

  /**
   * 房主创建房间时的数据包信息列表（每个数据包含 MD5 等元数据）
   *
   * @type {IDataInfo[]}
   * @memberof IRoomInfo
   */
  data_infos?: IDataInfo[];
}
