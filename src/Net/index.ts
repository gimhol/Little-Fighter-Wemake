import type { IMsgReqMap, IMsgRespMap } from "./IMsgMap";

export type TReq = IMsgReqMap[keyof IMsgReqMap]
export type TResp = IMsgRespMap[keyof IMsgRespMap]
export type TInfo<T> = Omit<T, 'pid' | 'type' | 'is_resp' | 'is_req'>
export * from "./_Base";
export * from "./ErrCode";
export * from "./IClientInfo";
export * from "./IConnError";
export * from "./IDataInfo";
export * from "./IJob";
export * from "./IMsg_Chat";
export * from "./IMsg_ClientInfo";
export * from "./IMsg_ClientReady";
export * from "./IMsg_CloseRoom";
export * from "./IMsg_CreateRoom";
export * from "./IMsg_ExitRoom";
export * from "./IMsg_JoinRoom";
export * from "./IMsg_ListRooms";
export * from "./IMsg_RoomPwd";
export * from "./IMsg_RoomStart";
export * from "./IMsg_Tick";
export * from "./IMsgMap";
export * from "./IRoomInfo";
export * from "./ISendOpts";
export * from "./MsgEnum";
export * from "./req_timeout_error";
export * from "./req_unknown_error";
export * from "./resp_error";
export * from "./SystemPlayerInfo";

