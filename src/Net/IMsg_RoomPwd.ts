import type { IReq, IResp } from "./_Base";
import type { MsgEnum } from "./MsgEnum";

export interface IReqRoomPwd extends IReq<MsgEnum.RoomPwd> {
  pwd: string;
}
export type IRespRoomPwd = IResp<MsgEnum.RoomPwd>;