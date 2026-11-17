import type { IReq, IResp } from "./_Base";
import type { MsgEnum } from "./MsgEnum";

export type NetSyncMode = 'lockstep' | 'delay';
/** 房主可选的同步模式：auto 由服务器按延迟决定，其余直接作为实际模式 */
export type RoomSyncMode = 'auto' | NetSyncMode;

export type IReqRoomStart = IReq<MsgEnum.RoomStart>;
export interface IRespRoomStart extends IResp<MsgEnum.RoomStart> {
  seed?: number;
  sync_mode?: NetSyncMode;
  input_delay?: number;
}

