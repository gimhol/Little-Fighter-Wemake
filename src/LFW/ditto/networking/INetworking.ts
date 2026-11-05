import type { NoEmitCallbacks } from "../../base";
import type { IClientInfo } from "./IClientInfo";
import type { IRoomInfo } from "./IRoomInfo";
export interface IConnectServerOpts {
  address?: string;
  nickname?: string;
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
  set_nickname(nickname: string): void;
  set_players(players: string[]): void;
  open(opts: IConnectServerOpts): void
  close(): void;
}