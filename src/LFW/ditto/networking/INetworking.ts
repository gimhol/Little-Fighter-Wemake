import type { IClientInfo } from "./IClientInfo";
import type { IRoomInfo } from "./IRoomInfo";

export interface INetworking {
  get rtt(): number;
  get nickname(): string;
  get room(): IRoomInfo | undefined;
  get rooms(): IRoomInfo[];
  get client(): IClientInfo | undefined;
  set_nickname(nickname: string): void;
  set_players(players: string[]): void;
}