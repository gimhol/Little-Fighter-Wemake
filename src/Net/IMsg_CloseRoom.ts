import type { IReq, IResp } from "./_Base";
import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { MsgEnum } from "./MsgEnum";
export type IReqCloseRoom = IReq<MsgEnum.CloseRoom>
export interface IRespCloseRoom extends IResp<MsgEnum.CloseRoom> {
  room?: IRoomInfo
}