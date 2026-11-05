import type { IClientInfo } from '../LFW/ditto/networking/IClientInfo';
import type { IReq, IResp } from './_Base';
import type { MsgEnum } from './MsgEnum';

export interface IReqAbandon extends IReq<MsgEnum.Abandon> {
  roomid?: string;
  client_id?: string;
  secret?: string;
}
export interface IRespAbandon extends IResp<MsgEnum.Abandon> {
  client?: IClientInfo;
}
