import type { NoEmitCallbacks } from "../../base";
import type { IDataInfo } from "../../defines/IDataInfo";
import type { IClientInfo } from "./IClientInfo";
import type { IRoomInfo } from "./IRoomInfo";
export interface IConnectServerOpts {
  address?: string;
  nickname?: string;
}
export type TNetworkingChatTarget = 'global' | 'room' | 'private';
export type TNetworkingSyncMode = 'auto' | 'lockstep' | 'delay';
export interface INetworkingChatMessage {
  seq?: number;
  date: number;
  sender?: IClientInfo;
  target: TNetworkingChatTarget;
  to?: string;
  text: string;
}
export type TNetworkingChatItem =
  | { kind: 'msg'; msg: INetworkingChatMessage }
  | { kind: 'sys'; text: string };
export interface ICreateRoomOpts {
  title?: string;
  min_players?: number;
  max_players?: number;
  pwd?: string;
  lfw_version?: string;
  data_infos?: IDataInfo[];
}
export interface IJoinRoomOpts {
  roomid?: string;
  pwd?: string;
  lfw_version?: string;
  data_infos?: IDataInfo[];
}
export interface INetworkingError {
  readonly __is_networking_error__: true;
  name: string;
  message: string;
  type: string;
  pid: string;
  code: number;
  error: string;
};
export interface INetworkingCallbacks {
  once?: boolean;
  on_open?(conn: INetworking): void;
  on_close?(reason: string, conn: INetworking): void;
  on_register?(resp: IClientInfo, conn: INetworking): void;
  on_error?(error: INetworkingError, conn: INetworking): void;
  on_room_change?(room: IRoomInfo | undefined, conn: INetworking): void;
  on_room_created?(room: IRoomInfo, conn: INetworking): void;
  on_room_joined?(room: IRoomInfo, conn: INetworking): void;
  on_room_leaved?(conn: INetworking): void;
  on_room_create_failed?(error: unknown, conn: INetworking): void;
  on_room_join_failed?(error: unknown, conn: INetworking): void;
  on_ping?(client_id: string | undefined, rtt: number | undefined, conn: INetworking): void;
  on_rooms_change?(rooms: IRoomInfo[], conn: INetworking): void;
  on_messages_change?(messages: readonly TNetworkingChatItem[], conn: INetworking): void;
}

export interface INetworking {
  readonly callbacks: NoEmitCallbacks<INetworkingCallbacks>

  get rtt(): number;
  get lead(): number | undefined;
  get nickname(): string;
  get room(): IRoomInfo | undefined;
  get rooms(): IRoomInfo[];
  get messages(): readonly TNetworkingChatItem[];
  get client(): IClientInfo | undefined;
  get url(): string | undefined;
  get opened(): boolean;

  set_nickname(nickname: string): void;
  set_players(players: string[]): void;
  open(opts: IConnectServerOpts): void
  close(): void;

  refresh_rooms(page: number): void;
  create_room(opts?: ICreateRoomOpts): void;
  join_room(opts: IJoinRoomOpts): void;
  leave_room(): void;
  start_room(): void;
  set_ready(ready: boolean): void;
  set_room_pwd(pwd: string): void;
  set_room_sync(mode: TNetworkingSyncMode): void;
  kick(client_id: string): void;
  send_chat(text: string, target?: TNetworkingChatTarget, to?: string): Promise<void>;
  add_notice(text: string): void;
  clear_messages(): void;
}