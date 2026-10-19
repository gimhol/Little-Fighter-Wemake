import type { IReq, IResp } from "./_Base";
import type { IClientInfo } from "./IClientInfo";
import type { MsgEnum } from "./MsgEnum";

/**
 * 聊天目标对象
 * - global: 全服（大厅）
 * - room: 当前房间
 * - private: 私聊，必须同时提供 to
 */
export type TChatTarget = 'global' | 'room' | 'private';

export interface IReqChat extends IReq<MsgEnum.Chat> {
  /**
   * 聊天目标对象
   *
   * @type {TChatTarget}
   * @memberof IReqChat
   */
  target?: TChatTarget;

  /**
   * 私聊目标客户端 id
   * target === 'private' 时必填；
   * 缺失返回 ChatTargetIncorrect，目标不存在返回 ChatRecipientNotFound
   *
   * @type {IClientInfo['id']}
   * @memberof IReqChat
   */
  to?: IClientInfo['id'];

  /**
   * 玩家发送的消息
   *
   * @type {string}
   * @memberof IReqChat
   */
  text?: string;
}

export interface IRespChat extends IResp<MsgEnum.Chat> {
  seq?: number;
  /** 发送人 */
  sender?: IClientInfo;
  /** 发送时间 */
  date?: number;
  /** 聊天目标对象 */
  target?: TChatTarget;

  /**
   * 私聊目标客户端 id
   * 仅 target === 'private' 时出现
   *
   * @type {IClientInfo['id']}
   * @memberof IRespChat
   */
  to?: IClientInfo['id'];

  text?: string;
}

