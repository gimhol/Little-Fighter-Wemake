import type { IClientInfo } from '../LFW/ditto/networking/IClientInfo';
import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { IReq, IResp } from './_Base';
import type { MsgEnum } from "./MsgEnum";

export type IReqExitRoom = IReq<MsgEnum.ExitRoom> 
export interface IRespExitRoom extends IResp<MsgEnum.ExitRoom> {
  client?: IClientInfo;
  room?: IRoomInfo;
}

export interface IReqKick extends IReq<MsgEnum.Kick> {
  client_id?: IClientInfo['id'];
}
export interface IRespKick extends IResp<MsgEnum.Kick> {
  client?: IClientInfo;
  room?: IRoomInfo;
}
