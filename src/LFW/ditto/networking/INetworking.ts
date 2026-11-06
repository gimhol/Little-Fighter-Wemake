import type { NoEmitCallbacks } from "../../base";
import type { IDataInfo } from "../../defines/IDataInfo";
import type { IClientInfo } from "./IClientInfo";
import type { IRoomInfo } from "./IRoomInfo";
export interface IConnectServerOpts {
  address?: string;
  nickname?: string;
}
export type TNetworkingChatTarget = 'global' | 'room' | 'private';
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
  on_rooms_change?(rooms: IRoomInfo[], conn: INetworking): void;
}

export interface INetworking {
  readonly callbacks: NoEmitCallbacks<INetworkingCallbacks>

  get rtt(): number;
  get nickname(): string;
  get room(): IRoomInfo | undefined;
  get rooms(): IRoomInfo[];
  get client(): IClientInfo | undefined;
  get url(): string | undefined;
  get opened(): boolean;

  set_nickname(nickname: string): void;
  set_players(players: string[]): void;
  open(opts: IConnectServerOpts): void
  close(): void;

  refresh_rooms(page: number): void;
  create_room(opts?: ICreateRoomOpts): Promise<IRoomInfo | undefined>;
  join_room(opts: IJoinRoomOpts): Promise<IRoomInfo | undefined>;
  send_chat(text: string, target?: TNetworkingChatTarget): Promise<void>;
}