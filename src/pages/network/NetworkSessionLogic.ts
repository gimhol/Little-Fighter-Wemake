import { Ditto, type IPlayerInfoCallback } from "@/LFW";
import type { UINode } from "@/LFW/ui/UINode";
import { UIComponent } from "@/LFW/ui/component/UIComponent";
import { MsgEnum, type TResp } from "@/Net";
import { peek_chat } from "@/Net/chat_overlay";
import { chat_store } from "@/Net/chat_store";
import { current_connection } from "@/Net/current_connection";
import { SystemPlayerInfo } from "@/Net/SystemPlayerInfo";
import type { Connection, IConnectionCallbacks } from "./Connection";
import { bind_button, fit_text } from "./ui_helpers";

const ROOM_PAGE_ID = "network_room_page";
const ENTRY_PAGE_ID = "entry";
const CONNECT_PAGE_ID = "network_modal";

/**
 * 大厅联机会话逻辑：只负责连接本身
 * （连接生命周期、聊天、玩家名同步、页面跳转），不碰房间列表数据。
 */
export class NetworkSessionLogic extends UIComponent {
  static override readonly TAGS: string[] = ["NetworkSessionLogic"];

  private conn: Connection | null = null;
  private callbacks_attached = false;
  private top_sub: UINode | undefined;

  private watched_players: {
    player: { callbacks: { del(cb: IPlayerInfoCallback): void } };
    cb: IPlayerInfoCallback;
  }[] = [];

  private readonly conn_cb: IConnectionCallbacks = {
    on_close: (reason, conn) => {
      const active = this.conn;
      if (active && conn === active) this.on_close(reason, active);
    },
    on_room_change: (room, conn) => {
      if (conn !== this.conn || !room) return;
      this.lfw.layers.set_page({ id: ROOM_PAGE_ID }, 0);
    },
    on_message: (resp, conn) => {
      const active = this.conn;
      if (active && conn === active) this.on_message(resp, active);
    },
    on_ping: (_resp, conn) => {
      if (conn === this.conn) this.update_topbar();
    },
  };

  override on_start(): void {
    this.bind_page(this.node);
  }

  override on_stop(): void {
    this.unbind_page();
  }

  override on_resume(): void {
    this.update_topbar();
  }

  private bind_page(node: UINode): void {
    this.top_sub = node.search_node("network_top_sub") ?? undefined;
    bind_button(this.lfw, node.search_node("network_btn_disconnect") ?? undefined, () => this.disconnect(), "cancel");
    chat_store.set_in_room(false);

    const conn = current_connection.conn;
    if (!conn) {
      Ditto.warn(`[${NetworkSessionLogic.TAG}::bind_page] no active connection`);
      this.open_connect_modal("连接已断开，请重新连接。");
      return;
    }
    this.attach_connection(conn);
    conn.set_players(this.player_names());
    this.update_topbar();
  }

  private unbind_page(): void {
    this.detach_connection();
    this.unwatch_player_names();
    this.top_sub = undefined;
  }

  private attach_connection(conn: Connection): void {
    if (this.conn !== conn) {
      this.detach_connection();
      this.unwatch_player_names();
      this.conn = conn;
    }
    if (this.callbacks_attached) return;
    conn.callbacks.add(this.conn_cb);
    this.callbacks_attached = true;
    this.watch_player_names(conn);
    chat_store.set_sender((text, target) => {
      this.conn?.send(MsgEnum.Chat, { target, text }).catch(() => void 0);
    });
  }

  private detach_connection(): void {
    if (this.conn && this.callbacks_attached) this.conn.callbacks.del(this.conn_cb);
    this.callbacks_attached = false;
  }

  private on_close(reason: string, conn: Connection): void {
    if (conn !== this.conn) return;
    this.detach_connection();
    this.unwatch_player_names();
    this.conn = null;
    if (current_connection.conn === conn) current_connection.conn = null;
    this.open_connect_modal(reason || "连接已断开，请重新连接。");
  }

  /** 断开后回到入口页并弹回连接弹窗 */
  private open_connect_modal(status: string): void {
    this.lfw.layers.set_page({ id: ENTRY_PAGE_ID }, 0);
    const modal = this.lfw.layers.open_modal({ id: CONNECT_PAGE_ID }, 0);
    modal?.search_node("network_connect_status")?.set_text(status);
  }

  private disconnect(): void {
    const conn = this.conn;
    if (!conn) return;
    this.detach_connection();
    this.unwatch_player_names();
    this.conn = null;
    if (current_connection.conn === conn) current_connection.conn = null;
    conn.disable_rejoin();
    conn.close();
    this.open_connect_modal("");
  }

  private on_message(resp: TResp, conn: Connection): void {
    if (conn !== this.conn || resp.type !== MsgEnum.Chat || resp.target === "room") return;
    chat_store.push({ kind: "msg", msg: resp });
    if (resp.sender?.id !== SystemPlayerInfo.id) peek_chat(this.lfw);
  }

  private watch_player_names(conn: Connection): void {
    this.unwatch_player_names();
    const cb: IPlayerInfoCallback = {
      on_name_changed: () => {
        if (this.conn === conn) conn.set_players(this.player_names());
      },
    };
    for (const player of this.lfw.players.values()) {
      if (!player.local) continue;
      player.callbacks.add(cb);
      this.watched_players.push({ player, cb });
    }
  }

  private unwatch_player_names(): void {
    for (const { player, cb } of this.watched_players) player.callbacks.del(cb);
    this.watched_players.length = 0;
  }

  private player_names(): string[] {
    const names: string[] = [];
    for (const player of this.lfw.players.values()) {
      if (names.length >= 8) break;
      names.push(player.name);
    }
    return names;
  }

  private update_topbar(): void {
    if (!this.top_sub) return;
    const conn = this.conn;
    if (!conn) {
      this.set_text(this.top_sub, "");
      return;
    }
    const address = conn.url || "";
    const info = `${this.t("network.guest")}\u3000·\u3000${address}\u3000·\u3000${conn.rtt}ms`;
    this.set_text(this.top_sub, fit_text(info, 300, this.top_sub));
  }

  private set_text(node: UINode | undefined, text: string): void {
    if (node?.text?.text !== text) node?.set_text(text);
  }

  private t(key: string, ...args: (string | number)[]): string {
    let text = this.lfw.string(key);
    for (let i = 0; i < args.length; i++) text = text.split(`%${i + 1}`).join(`${args[i]}`);
    return text;
  }
}
