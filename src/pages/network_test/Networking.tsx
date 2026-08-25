
import { GK, is_bot_ctrl, LFW, LFWKeyEvent, PlayerInfo, world_dataset_fields, type IWorldDataset } from "@/LFW";
import { bot_cases, mt_cases, sus_cases } from "@/LFW/cases_instances";
import { MsgEnum, type IKeyEvent, type IReqTick, type IRespClientInfo, type IRespDataset, type IRespRoomStart, type IRespTick, type TInfo } from "@/Net";
import type { IRespKeyTick } from "@/Net/IMsg_KeyTick";
import { useStateRef } from "@fimagine/dom-hooks/dist/useStateRef";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChatBox } from "./ChatBox";
import { Connection } from "./Connection";
import { ConnectionBox } from "./ConnectionBox";
import { RoomBox } from "./RoomBox";
import { RoomsBox } from "./RoomsBox";
import styles from "./styles.module.scss";
import { TriState } from "./TriState";
import { useCallbacks } from "./useCallbacks";
import { useRoom } from "./useRoom";
export interface INetworkingProps {
  lf2?: LFW | undefined | null;
}

class Tester<V> {
  private s = false
  private v1: V;
  private v0: V;
  private comparer = (a: V, b: V) => a === b;
  debugging = false
  constructor(first: V, comparer?: typeof this.comparer) {
    this.v1 = this.v0 = first;
    if (comparer) this.comparer = comparer;
  }
  reset() {
    this.v1 = this.v0;
    this.s = false
  }
  test(value: V): boolean {
    if (!this.debugging) return true;
    if (!this.s) {
      this.s = true;
      this.v1 = value;
      return true;
    }
    return this.v1 === value
  }
}

class Lf2NetworkDriver {
  conn?: Connection | null;
  lf2?: LFW | null;
  resp?: IRespTick | IRespKeyTick | null;
  _f: boolean = false;
  _r = new Tester<string | null | undefined>(null);
  _p = new Tester<string | null | undefined>(null);
  _a = new Tester<string | null | undefined>(null);
  _s = new Tester<string | null | undefined>(null);
  protected _applying_dataset = false;
  protected _reverting = false;
  is_owner() {
    const { conn } = this;
    if (!conn) return false
    const { room, client: me } = conn;
    if (!room || !me) return false;
    return room.owner?.id === me.id;
  }

  on_dataset_change(k?: keyof IWorldDataset, _value?: unknown, prev?: unknown) {
    const { conn, lf2 } = this;
    if (!conn || !lf2) return;
    if (this.is_owner()) {
      conn.send(MsgEnum.Dataset, { dataset: lf2.world.dataset.dump_dataset() }).catch(() => void 0)
      return;
    }
    if (this._applying_dataset || this._reverting) return;
    if (typeof k === 'undefined') return;
    this._reverting = true;
    (lf2.world.dataset as any)[k] = prev;
    this._reverting = false;
    console.warn(`仅房主可修改世界数据集: ${String(k)} 已回滚`)
  }

  on_room_start(resp: IRespRoomStart) {
    const { conn, lf2 } = this;
    const me = conn?.client;
    if (!conn || !lf2 || !me) return;
    lf2.world.sleep();
    const clients = conn.room?.clients
    if (clients?.length) {
      for (const client of clients) {
        for (let i = 1; i <= 4; i++) {
          const id = `${client.id}#${i}`;
          const name = client.players?.[i] ?? i.toString();
          const player = new PlayerInfo(id, name, false, client.id === me.id);
          lf2.players.set(id, player)
        }
      }
    }
    const debugging = !0
    lf2.mt.debugging = debugging;
    bot_cases.debug(debugging);
    mt_cases.debug(debugging)
    sus_cases.debug(debugging)
    this._p.debugging = debugging
    this._a.debugging = debugging
    this._r.debugging = debugging
    this._s.debugging = debugging
    lf2.world.dataset.UPS = 30;
    lf2.world.dataset.atom_time = 2;
    lf2.load(...LFW.ZIPS)
    lf2.set_ui({ id: "network_loading" })
    lf2.pointings.enabled = false
    lf2.keyboard.enabled = false
    lf2.mt.reset(resp.seed ?? 0, debugging)

    if (this.is_owner())
      this.on_dataset_change()
  }
  update_dataset(resp: IRespDataset) {
    const { lf2 } = this;
    if (!lf2) return;
    const incoming = resp.dataset;
    if (!incoming) return;
    const { dataset } = lf2.world;
    const local_only = new Set<keyof IWorldDataset>(['sync_render']);
    this._applying_dataset = true;
    for (const key of world_dataset_fields.keys()) {
      if (local_only.has(key)) continue;
      const value = (incoming as any)[key];
      if (typeof value !== 'undefined')
        (dataset as any)[key] = value;
    }
    this._applying_dataset = false;
  }
  update_client(resp: IRespClientInfo) {
    const { lf2 } = this;
    const { client } = resp
    if (!client) return;
    if (!lf2) return;

    for (let i = 1; i <= 4; i++) {
      const id = `${client.id}#${i}`;
      const name = client.players?.[i] ?? i.toString();
      const player = lf2.players.get(id)
      if (!player) continue;
      player.set_name(name, true)
    }
  }
  on_tick(resp: IRespTick | IRespKeyTick) {
    const { conn, lf2 } = this;
    if (!conn || !lf2) return;
    if (typeof resp.seq !== 'number') return;
    if (resp.seq === 0) {
      lf2.keyboard.enabled = true
      lf2.world.after_update = this.after_update
      lf2.world.before_update = this.before_update
      lf2.set_ui({ id: "main_page" });
      lf2.world.reset_game_time()
    }
    this.resp = resp;
    lf2.world.awake()
  }
  before_update = () => {
    const { lf2, conn, resp } = this;
    if (!lf2 || !conn || !resp) return;
    const { reqs, seq } = resp
    const me = conn.client;
    if (!me || typeof seq !== 'number' || !reqs?.length) return;
    const req_events: IKeyEvent[] = lf2.events.map<IKeyEvent>(r => ({
      client_id: me.id,
      player_id: me.id + '#' + r.player,
      game_key: r.game_key,
      pressed: r.pressed,
    }))
    const req: TInfo<IReqTick> = {
      seq: seq + 1,
      cmds: lf2.cmds,
      events: req_events
    }
    if (this._r.debugging) req._r = mt_cases.submit()
    if (this._p.debugging) req._p = Array.from(lf2.world.entities).map((e, i) => {
      const { x, y, z } = e.position;
      const b = is_bot_ctrl(e.ctrl) ? (e.ctrl.fsm.state?.key ?? '') : 'b';
      return '[' + [i, e.frame.id, b, x, y, z].join(', ') + ']'
    }).join(', ')
    if (this._a.debugging) req._a = bot_cases.submit();
    if (this._s.debugging) req._s = sus_cases.submit();
    if (!this._f) conn.send(MsgEnum.Tick, req);
    lf2.cmds.length = 0;
    lf2.events.length = 0;

    this._p.reset()
    this._r.reset()
    this._a.reset()
    this._s.reset()

    for (const req of reqs) {
      const { cmds, events, _r, _p, _a, _s } = req;
      if (!this._a.test(_a)) {
        console.error(`bot acations not equal!`, reqs.map(v => v._a))
        this._f = true
      }
      if (!this._r.test(_r)) {
        console.error(`randoms not equal!`, reqs.map(v => v._r))
        this._f = true
      }
      if (!this._p.test(_p)) {
        console.error(`positons not equal!`, reqs.map(v => v._p))
        this._f = true
      }
      if (!this._s.test(_s)) {
        console.error(`suspicious not equal!`, reqs.map(v => v._s))
        this._f = true
      }
      if (this._f) { debugger; break; }
      if (cmds?.length) cmds.forEach(cmd => lf2.push_cmd(cmd))
      if (!events?.length) continue;
      for (const { player_id, pressed = false, game_key = '' } of events) {
        if (!player_id) continue;
        const gk = game_key as GK
        const le = new LFWKeyEvent(player_id, pressed, gk, gk)
        lf2.events.push(le)
      }
    }
  }
  after_update = () => this.lf2?.world.sleep()
}


export function Networking(props: INetworkingProps) {
  const { lf2 } = props;
  const ref_lf2 = useRef(lf2);
  ref_lf2.current = lf2;
  const [conn_state, set_conn_state] = useState<TriState>(TriState.False);
  const [conn, set_conn] = useStateRef<Connection | null>(null)
  const { room } = useRoom(conn)
  const updater = useMemo(() => new Lf2NetworkDriver(), [])
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