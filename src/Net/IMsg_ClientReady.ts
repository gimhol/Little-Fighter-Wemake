import type { IClientInfo } from '../LFW/ditto/networking/IClientInfo';
import type { IReq, IResp } from './_Base';
import type { MsgEnum } from './MsgEnum';

export interface IReqClientReady extends IReq<MsgEnum.ClientReady> {
  ready?: boolean;
}

export interface IRespClientReady extends IResp<MsgEnum.ClientReady> {
  ready?: boolean;
  client?: IClientInfo;
}

