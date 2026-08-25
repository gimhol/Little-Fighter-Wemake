import type { IWorldDataset } from '../LFW/defines/IWorldDataset';
import type { IReq, IResp } from './_Base';
import type { IClientInfo } from './IClientInfo';
import type { MsgEnum } from './MsgEnum';

export interface IReqClientInfo extends IReq<MsgEnum.ClientInfo> {
  name?: string;
  players?: string[];
  dataset?: IWorldDataset;
}
export interface IRespClientInfo extends IResp<MsgEnum.ClientInfo> {
  client?: Required<IClientInfo>;
}

export interface IReqDataset extends IReq<MsgEnum.Dataset> {
  dataset?: IWorldDataset;
}
export interface IRespDataset extends IResp<MsgEnum.Dataset> {
  dataset?: IWorldDataset;
}

