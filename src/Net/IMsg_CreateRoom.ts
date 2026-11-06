import type { IDataInfo } from '../LFW/defines/IDataInfo';
import type { IClientInfo } from '../LFW/ditto/networking/IClientInfo';
import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { TNetworkingSyncMode } from "../LFW/ditto/networking/INetworking";
import type { IReq, IResp } from './_Base';
import type { MsgEnum } from './MsgEnum';

export interface IReqCreateRoom extends IReq<MsgEnum.CreateRoom> {
  title?: string;
  client?: IClientInfo
  min_players?: number;
  max_players?: number;
  pwd?: string;
  lfw_version?: string;
  data_infos?: IDataInfo[];
  sync_mode?: TNetworkingSyncMode;
}
export interface IRespCreateRoom extends IResp<MsgEnum.CreateRoom> {
  room?: IRoomInfo;
  error?: string;
}
