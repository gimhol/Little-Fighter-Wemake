import type { IClientInfo } from "../LFW/ditto/networking/IClientInfo";
import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { IReq, IResp } from './_Base';
import type { IRespTick } from './IMsg_Tick';
import type { MsgEnum } from './MsgEnum';

export type TRejoinTick = Omit<IRespTick, 'pid' | 'type' | 'is_resp' | 'is_req'>;

export interface IReqRejoin extends IReq<MsgEnum.Rejoin> {
  roomid?: string;
  client_id?: string;
  secret?: string;
  from_seq?: number;
}
export interface IRespRejoin extends IResp<MsgEnum.Rejoin> {
  client?: IClientInfo;
  room?: IRoomInfo;
  next_seq?: number;
  /** 本包（首批）起始帧号 */
  from_seq?: number;
  /** 首批是否已经包含全部需要回放的帧 */
  done?: boolean;
  resps?: TRejoinTick[];
}
