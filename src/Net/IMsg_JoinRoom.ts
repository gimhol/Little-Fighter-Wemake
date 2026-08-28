import type { IReq, IResp } from './_Base';
import type { IClientInfo } from './IClientInfo';
import type { IDataInfo } from './IDataInfo';
import type { IRoomInfo } from './IRoomInfo';
import type { MsgEnum } from './MsgEnum';

export interface IReqJoinRoom extends IReq<MsgEnum.JoinRoom> {
  roomid?: string;
  client?: IClientInfo;
  pwd?: string;
  lfw_version?: string;
  data_infos?: IDataInfo[];
}
export interface IRespJoinRoom extends IResp<MsgEnum.JoinRoom> {
  room?: IRoomInfo;
  client?: IClientInfo;
}
