import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { IReq, IResp } from "./_Base";
import type { MsgEnum } from "./MsgEnum";

/**
 * 请求消息: 房间列表
 * 
 * @export
 * @interface IReqListRooms
 * @extends {IReq<MsgEnum.ListRooms>}
 */
export interface IReqListRooms extends IReq<MsgEnum.ListRooms> {
  /**
   * 偏移量
   *
   * @type {number}
   * @memberof IReqListRooms
   */
  offset?: number;

  /**
   * 限制数量
   *
   * @type {number}
   * @memberof IReqListRooms
   */
  limit?: number;

  /**
   * 是否返回全部同步模式的房间（缺省时服务器只返回非延迟房间）
   *
   * @type {boolean}
   * @memberof IReqListRooms
   */
  show_all?: boolean;
}

/**
 * 返回消息: 房间列表
 *
 * @export
 * @interface IRespListRooms
 * @extends {IResp<MsgEnum.ListRooms>}
 */
export interface IRespListRooms extends IResp<MsgEnum.ListRooms> {
  /**
   * 偏移量
   *
   * @type {number}
   * @memberof IRespListRooms
   */
  offset?: number;

  /** 
   * 限制数量
   *
   * @type {number}
   * @memberof IRespListRooms
   */
  limit?: number;

  /**
   * 房间列表
   *
   * @type {IRoomInfo[]}
   * @memberof IRespListRooms
   */
  rooms?: IRoomInfo[];

  /**
   * 总数
   *
   * @type {number}
   * @memberof IRespListRooms
   */
  total?: number;
}