import type { IReq, IResp } from './_Base';
import type { IClientInfo } from './IClientInfo';
import type { IDataInfo } from './IDataInfo';
import type { IRoomInfo } from './IRoomInfo';
import type { MsgEnum } from './MsgEnum';

export interface IReqCreateRoom extends IReq<MsgEnum.CreateRoom> {
  title?: string;
  client?: IClientInfo
  min_players?: number;
  max_players?: number;
  pwd?: string;
  lfw_version?: string;
  data_infos?: IDataInfo[];
}
export interface IRespCreateRoom extends IResp<MsgEnum.CreateRoom> {
  room?: IRoomInfo;
  error?: string;
}
