
import { LFW } from "@/LFW";
import { MsgEnum } from "@/Net";
import { useStateRef } from "@fimagine/dom-hooks/dist/useStateRef";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBox } from "./ChatBox";
import { Connection } from "./Connection";
import { ConnectionBox } from "./ConnectionBox";
import { LFWNetworkDriver } from "./LFWNetworkDriver";
import { RoomBox } from "./RoomBox";
import { RoomsBox } from "./RoomsBox";
import styles from "./styles.module.scss";
import { TriState } from "./TriState";
import { useCallbacks } from "./useCallbacks";
import { useRoom } from "./useRoom";
export interface INetworkingProps {
  lf2?: LFW | undefined | null;
}

export function Networking(props: INetworkingProps) {
  const { lf2 } = props;
  const ref_lf2 = useRef(lf2);
  ref_lf2.current = lf2;
  const [conn_state, set_conn_state] = useState<TriState>(TriState.False);
  const [conn, set_conn] = useStateRef<Connection | null>(null)
  const { room } = useRoom(conn)
  const updater = useMemo(() => new LFWNetworkDriver(), [])
  updater.conn = conn;
  updater.lf2 = lf2;
  const [started, set_started] = useState(false)
  useCallbacks(conn?.callbacks, {
    on_message: (resp, conn) => {
      const me = conn.client;
      if (!lf2 || !me) return;
      switch (resp.type) {
        case MsgEnum.ClientInfo:
          updater.update_client(resp);
          break;
        case MsgEnum.RoomStart:
          updater.on_room_start(resp);
          set_started(true)
          break;
        case MsgEnum.Dataset:
          updater.update_dataset(resp)
          break;
        case MsgEnum.KeyTick:
        case MsgEnum.Tick: {
          updater.on_tick(resp);
          break;
        }
      }
    }
  }, [lf2])

  useCallbacks(lf2?.callbacks, {
    on_loading_end: () => {
      if (!lf2 || !conn) return;
      if (lf2.zips.length < 1) return;
      conn?.send(MsgEnum.Tick, { seq: 0 });
    }
  }, [lf2, conn])

  useCallbacks(lf2?.world.callbacks, {
    on_dataset_change: (k, value, prev) => updater.on_dataset_change(k, value, prev),
  }, [lf2, conn])

  useEffect(() => {
    const player_names: string[] = []
    if (lf2)
      for (const [, { name }] of lf2.players)
        if (player_names.length < 8)
          player_names.push(name)
    if (conn)
      conn.set_players(player_names)
  }, [lf2, conn])


  return <>
    <ConnectionBox
      lf2={lf2}
      on_conn_change={set_conn}
      on_state_change={set_conn_state}
      className={styles.rooms_box}
      style={display_or_not(!conn_state)} />
    <RoomsBox
      conn={conn}
      conn_state={conn_state}
      style={display_or_not(conn_state && !room)} />
    <RoomBox
      conn={conn}
      className={styles.rooms_box}
      style={display_or_not(conn_state && room && !started)} />
    <ChatBox
      conn={conn}
      className={styles.chat_box}
      style={display_or_not(false && conn_state)} />
  </>
}

const display_or_not = (v: any) => ({ display: v ? void 0 : 'none' })