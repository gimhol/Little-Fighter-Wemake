import { useSyncExternalStore } from "react";
import { Ditto } from "../../LFW/ditto/Instance";
import type { INetworkingCallbacks } from "../../LFW/ditto/networking/INetworking";

/**
 * 昵称以 `Ditto.Networking` 为唯一真源：这里只订阅变化、转发写入，
 * 持久化与上报（ClientInfo）都由连接自己防抖完成。
 */
const listeners = new Set<() => void>();
let attached = false;

const net_cb: INetworkingCallbacks = {
  on_nickname_change: () => {
    for (const listener of [...listeners]) listener();
  },
};

function subscribe(listener: () => void): () => void {
  if (!attached) {
    attached = true;
    Ditto.Networking.callbacks.add(net_cb);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const get_snapshot = (): string => Ditto.Networking.nickname;

export function set_nickname(next: string): void {
  Ditto.Networking.set_nickname(next);
}

export function useNickname(): [string, (next: string) => void] {
  const nickname = useSyncExternalStore(subscribe, get_snapshot, get_snapshot);
  return [nickname, set_nickname];
}
