import type { IDataInfo } from '../LFW/defines/IDataInfo';
import type { IClientInfo } from '../LFW/ditto/networking/IClientInfo';
import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { IReq, IResp } from './_Base';
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
