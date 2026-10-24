
import type { IPlayerInfoCallback } from "@/LFW";
import { LFW } from "@/LFW";
import { MsgEnum, type IRespRoomStart, type NetSyncMode } from "@/Net";
import { useStateRef } from "@/hooks/useStateRef";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ChatBox } from "./ChatBox";
import { Connection } from "./Connection";
import { ConnectionBox } from "./ConnectionBox";
import { current_connection } from "@/Net/current_connection";
import { DelayNetworkDriver } from "./DelayNetworkDriver";
import { LFWNetworkDriver } from "./LFWNetworkDriver";
import { LockstepNetworkDriver } from "./LockstepNetworkDriver";
import { MatchPauseNotice } from "./MatchPauseNotice";
import { RoomBox } from "./RoomBox";
import { RoomsBox } from "./RoomsBox";
import styles from "./styles.module.scss";
import { TriState } from "./TriState";
import { useCallbacks } from "./useCallbacks";
import { useRoom } from "./useRoom";
export interface INetworkingProps {
  lfw?: LFW | undefined | null;
  on_close?(): void;
  /** 调试用：强制同步模式，缺省时听服务器下发 */
  sync_mode?: NetSyncMode;
  /** 调试用：强制提前帧数 */
  input_delay?: number;
  /** 调试用：房间列表返回全部同步模式的房间 */
  show_all_rooms?: boolean;
}

export function Networking(props: INetworkingProps) {
  const { lfw, on_close, sync_mode, input_delay, show_all_rooms } = props;
  const { t } = useTranslation();
  const ref_lfw = useRef(lfw);
  ref_lfw.current = lfw;
  const [conn_state, set_conn_state] = useState<TriState>(TriState.False);
  const [conn, set_conn] = useStateRef<Connection | null>(null)
  const [reconnecting, set_reconnecting] = useState(0)
  const [rejoin_failed, set_rejoin_failed] = useState<'' | 'rejected' | 'timeout'>('')
  const { room } = useRoom(conn)
  const ref_updater = useRef<LFWNetworkDriver | null>(null);
  const create_driver = (resp: IRespRoomStart) => {
    const mode = sync_mode ?? resp.sync_mode ?? 'lockstep';
    const driver = mode === 'delay'
      ? new DelayNetworkDriver(input_delay ?? resp.input_delay ?? 2)
      : new LockstepNetworkDriver();
    driver.conn = conn;
    driver.lfw = lfw;
    ref_updater.current = driver;
    current_connection.driver = driver;
    return driver;
  };
  useEffect(() => {
    current_connection.conn = conn;
    if (!conn) {
      set_reconnecting(0);
      set_rejoin_failed('');
    }
    return () => {
      current_connection.conn = null;
      current_connection.driver = null;
      conn?.disable_rejoin();
    };
  }, [conn]);
  const [started, set_started] = useState(false)
  const [leavers, set_leavers] = useState<{ name: string; left?: boolean }[]>([])
  const chat_style = use_fade_style(!!conn_state)
  useCallbacks(conn?.callbacks, {
    on_message: (resp, conn) => {
      const me = conn.client;
      if (!lfw || !me) return;
      switch (resp.type) {
        case MsgEnum.ClientInfo:
          ref_updater.current?.update_client(resp);
          break;
        case MsgEnum.RoomStart:
          create_driver(resp).on_room_start(resp);
          conn.enable_rejoin(() => ref_updater.current?.rejoin_seq ?? -1);
          set_started(true)
          break;
        case MsgEnum.Dataset:
          ref_updater.current?.update_dataset(resp)
          break;
        case MsgEnum.KeyTick:
        case MsgEnum.Tick: {
          ref_updater.current?.on_tick(resp);
          break;
        }
        case MsgEnum.ExitRoom:
        case MsgEnum.Kick: {
          const driver = ref_updater.current;
          const leaver = resp.client;
          if (!driver || !leaver || leaver.id === conn.client?.id) break;
          driver.suspend();
          const name = leaver.name || leaver.id;
          if (!name) break;
          set_leavers(prev => (prev.some(l => l.name === name) ? prev : [...prev, { name }]));
          break;
        }
        case MsgEnum.Rejoin: {
          const joined = resp.client;
          if (!joined || joined.id === conn.client?.id) break;
          // 归队方还在回放追帧：先不解除暂停，等它追上（服务端广播 RoomContinue）再一起继续
          break;
        }
        case MsgEnum.Abandon: {
          const left = resp.client;
          if (!left || left.id === conn.client?.id) break;
          const name = left.name || left.id;
          if (!name) break;
          set_leavers(prev => prev.map(l => (l.name === name && !l.left) ? { ...l, left: true } : l));
          break;
        }
        case MsgEnum.RoomContinue: {
          // 有人点了「继续游戏」：全员解除暂停，掉线者的角色已由服务端交给电脑
          set_leavers([]);
          ref_updater.current?.resume();
          break;
        }
      }
    },
    on_reconnecting: (attempt) => {
      set_reconnecting(attempt);
      set_rejoin_failed('');
    },
    on_rejoin: (resp) => {
      set_reconnecting(0);
      set_rejoin_failed('');
      ref_updater.current?.begin_rejoin(resp.resps ?? [], resp.next_seq ?? 0);
    },
    on_rejoin_failed: (reason) => {
      set_reconnecting(0);
      set_rejoin_failed(reason);
    }
  }, [lfw])

  useCallbacks(lfw?.callbacks, {
    on_loading_end: () => {
      if (!lfw || !conn) return;
      if (lfw.zips.zips.length < 1) return;
      conn?.send(MsgEnum.Tick, { seq: 0 });
    }
  }, [lfw, conn])

  useCallbacks(lfw?.world.callbacks, {
    on_dataset_change: (k, value, prev) => ref_updater.current?.on_dataset_change(k, value, prev),
  }, [lfw, conn])

  useEffect(() => {
    if (!lfw) return;
    const sync_player_names = () => {
      if (!conn) return;
      const player_names: string[] = []
      for (const [, { name }] of lfw.players)
        if (player_names.length < 8)
          player_names.push(name)
      conn.set_players(player_names)
    }
    const callback: IPlayerInfoCallback = { on_name_changed: sync_player_names }
    const watched = Array.from(lfw.players.values()).filter(v => v.local)
    for (const player of watched) player.callbacks.add(callback)
    sync_player_names()
    return () => {
      for (const player of watched) player.callbacks.del(callback)
    }
  }, [lfw, conn])


  return createPortal(<>
    <ConnectionBox
      lfw={lfw}
      on_conn_change={set_conn}
      on_state_change={set_conn_state}
      on_close={on_close}
      className={styles.rooms_box}
      style={{ ...overlay_style, ...display_or_not(!conn_state) }} />
    <RoomsBox
      conn={conn}
      conn_state={conn_state}
      show_all_rooms={show_all_rooms}
      style={{ ...overlay_style, ...display_or_not(conn_state && !room) }} />
    <RoomBox
      conn={conn}
      className={styles.rooms_box}
      style={{ ...overlay_style, ...display_or_not(conn_state && room && !started) }} />
    <ChatBox
      conn={conn}
      className={styles.chat_box}
      style={chat_style} />
    {rejoin_failed ? (
      <MatchPauseNotice
        title={t("reconnect_failed")}
        lines={[]}
        actions={[
          {
            text: t("continue_solo"),
            onClick: () => {
              set_rejoin_failed('');
              set_reconnecting(0);
              ref_updater.current?.continue_solo();
              conn?.give_up();
              // 转入单机后整个联机界面（房间/聊天等）一律收起
              on_close?.();
            }
          },
          {
            text: t("back_to_lobby"),
            onClick: () => {
              set_rejoin_failed('');
              conn?.close();
            }
          },
        ]} />
    ) : reconnecting > 0 ? (
      <MatchPauseNotice
        title={t("reconnecting")}
        lines={[t("reconnect_attempt").replace("%1", "" + reconnecting)]}
        actions={[
          {
            text: t("continue_solo"),
            onClick: () => {
              set_reconnecting(0);
              ref_updater.current?.continue_solo();
              conn?.give_up();
              // 转入单机后整个联机界面（房间/聊天等）一律收起
              on_close?.();
            }
          },
          { text: t("back_to_lobby"), onClick: () => conn?.give_up() },
        ]} />
    ) : leavers.length > 0 ? (
      <MatchPauseNotice
        title={t("match_paused")}
        lines={leavers.map(l => t(l.left ? "player_left" : "player_disconnected").replace("%1", l.name))}
        actions={room?.owner?.id === conn?.client?.id ? [{
          text: t("continue_game"),
          onClick: () => {
            conn?.send_nowait(MsgEnum.RoomContinue, {});
            set_leavers([]);
            ref_updater.current?.resume();
          }
        }] : []} />
    ) : null}
  </>, document.body)
}

const overlay_style: CSSProperties = { position: 'fixed', padding: 0 };

const display_or_not = (v: any) => ({ display: v ? void 0 : 'none' })

/** 淡入淡出：隐藏时先过渡 opacity，之后再 display:none，避免瞬间消失 */
function use_fade_style(visible: boolean): CSSProperties | undefined {
  const [style, set_style] = useState<CSSProperties | undefined>(() => visible ? void 0 : { display: 'none' })
  useEffect(() => {
    if (visible) {
      set_style({ opacity: 0 })
      let raf2 = 0
      const raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => set_style({ opacity: 1 }))
      })
      return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
    }
    set_style({ opacity: 0 })
    const tid = setTimeout(() => set_style({ display: 'none' }), 160)
    return () => clearTimeout(tid)
  }, [visible])
  return style
}