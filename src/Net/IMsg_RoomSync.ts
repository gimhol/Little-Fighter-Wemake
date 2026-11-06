import type { IRoomInfo } from '../LFW/ditto/networking/IRoomInfo';
import type { TNetworkingSyncMode } from "../LFW/ditto/networking/INetworking";
import type { IReq, IResp } from "./_Base";
import type { MsgEnum } from "./MsgEnum";

export interface IReqRoomSync extends IReq<MsgEnum.RoomSync> {
  sync_mode?: TNetworkingSyncMode;
}
export interface IRespRoomSync extends IResp<MsgEnum.RoomSync> {
  room?: IRoomInfo;
}
