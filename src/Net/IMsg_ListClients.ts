import type { IClientInfo } from "../LFW/ditto/networking/IClientInfo";
import type { IReq, IResp } from "./_Base";
import type { MsgEnum } from "./MsgEnum";

export type IReqListClients = IReq<MsgEnum.ListClients> 
export interface IRespListClients extends IResp<MsgEnum.ListClients> {
  clients: IClientInfo[]
}