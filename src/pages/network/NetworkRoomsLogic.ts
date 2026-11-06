import type { INetworkingCallbacks, IUINodeRenderer } from "@/LFW";
import { Ditto, LFW } from "@/LFW";
import { TextInput } from "@/LFW/ui/component/TextInput";
import { UIComponent } from "@/LFW/ui/component/UIComponent";
import type { UINode } from "@/LFW/ui/UINode";
import type { ILFWCallback } from "@/LFW/ILFWCallback";
import type { IRoomInfo } from "@/LFW/ditto/networking/IRoomInfo";
import type { RoomSyncMode } from "@/Net";
import { chat_store } from "@/Net/chat_store";
import { bind_button, fit_text, net_connection, paint } from "./ui_helpers";

const ROOM_PAGE_SIZE = 5;

const ROOM_NAME = 0;
const ROOM_CODE = 1;
const ROOM_BADGE_BG = 2;
const ROOM_LOCK_BG = 3;
const ROOM_PWD_BG = 4;
const ROOM_JOIN = 5;
const ROOM_OWNER = 6;
const ROOM_META = 7;

/** 房间列表页逻辑：只负责房间列表的请求、分页与渲染 */
export class NetworkRoomsLogic extends UIComponent {
  static override readonly TAGS: string[] = ["NetworkRoomsLogic"];

  private rooms: IRoomInfo[] = [];
  private page = 0;
  private auto_refresh = true;
  private auto_timer = 0;
  private busy = false;
  private bound = false;

  private btn_auto: UINode | undefined;
  private rooms_total: UINode | undefined;
  private room_rows: UINode[] = [];
  private no_rooms: UINode | undefined;
  private btn_prev: UINode | undefined;
  private btn_next: UINode | undefined;
  private page_label: UINode | undefined;
  private rooms_status: UINode | undefined;

  private readonly lfw_cb: ILFWCallback = {
    on_lang_changed: () => this.refresh_texts(),
  };

  private readonly net_cb: INetworkingCallbacks = {
    on_rooms_change: (rooms) => {
      if (!this.bound) return;
      this.rooms = [...rooms];
      this.render_rooms();
    },
  };

  override on_start(): void {
    this.lfw.callbacks.add(this.lfw_cb);
    const q = (id: string) => this.node.search_node(id) ?? undefined;
    this.bound = true;
    this.btn_auto = q("network_btn_auto");
    this.rooms_total = q("network_rooms_total");
    this.no_rooms = q("network_no_rooms");
    this.btn_prev = q("network_btn_prev");
    this.btn_next = q("network_btn_next");
    this.page_label = q("network_page_label");
    this.rooms_status = q("network_rooms_status");
    this.room_rows = q("network_room_rows")?.children.slice() ?? [];

    for (let i = 0; i < this.room_rows.length; i++) {
      const row = this.room_rows[i];
      bind_button(this.lfw, row.children[ROOM_JOIN], () => void this.join_room(i));
      const input = row.children[ROOM_PWD_BG]?.children[0]?.find_component(TextInput);
      if (input) input.on_submit = () => void this.join_room(i);
    }

    bind_button(this.lfw, q("network_btn_create"), () => void this.create_room());
    bind_button(this.lfw, q("network_btn_refresh"), () => this.request_rooms());
    bind_button(this.lfw, this.btn_auto, () => this.toggle_auto_refresh());
    bind_button(this.lfw, this.btn_prev, () => this.goto_page(this.page - 1));
    bind_button(this.lfw, this.btn_next, () => this.goto_page(this.page + 1));

    Ditto.Networking.callbacks.add(this.net_cb);
    this.rooms = [...Ditto.Networking.rooms];
    this.apply_placeholders();
    this.update_auto_button();
    this.render_rooms();
    this.start_auto_refresh();
  }

  override on_resume(): void {
    this.refresh_texts();
  }

  override on_stop(): void {
    this.bound = false;
    this.stop_auto_refresh();
    Ditto.Networking.callbacks.del(this.net_cb);
    this.btn_auto = undefined;
    this.rooms_total = undefined;
    this.room_rows = [];
    this.no_rooms = undefined;
    this.btn_prev = undefined;
    this.btn_next = undefined;
    this.page_label = undefined;
    this.rooms_status = undefined;
    this.lfw.callbacks.del(this.lfw_cb);
  }

  private request_rooms(): void {
    const conn = net_connection();
    if (!conn || conn.room || !this.bound) return;
    conn.refresh_rooms(this.page);
  }

  private async create_room(): Promise<void> {
    const conn = net_connection();
    if (!conn || this.busy) return;
    this.busy = true;
    try {
      const version = { lfw_version: LFW.VERSION_NAME, data_infos: await LFW.collect_data_infos() };
      await conn.create_room({ min_players: 1, max_players: 4, ...version });
      this.add_notice(this.t("network.sys_room_created", conn.room?.code || ""));
      this.clear_status();
    } catch (e) {
      this.set_status(this.error_text(e));
    } finally {
      this.busy = false;
    }
  }

  private async join_room(index: number): Promise<void> {
    const conn = net_connection();
    const room = this.page_rooms()[index];
    if (!conn || !room?.id || this.busy) return;
    const row = this.room_rows[index];
    const pwd = this.input_value(row?.children[ROOM_PWD_BG]?.children[0]).trim();
    if (room.need_pwd && !pwd) {
      this.set_status(this.t("network.enter_pwd"));
      return;
    }
    this.busy = true;
    try {
      const version = { lfw_version: LFW.VERSION_NAME, data_infos: await LFW.collect_data_infos() };
      await conn.join_room({ roomid: room.id, pwd: pwd || undefined, ...version });
      this.add_notice(this.t("network.sys_room_joined", room.code || room.id));
      this.clear_status();
    } catch (e) {
      this.set_status(this.error_text(e));
    } finally {
      this.busy = false;
    }
  }

  private goto_page(page: number): void {
    const page_count = Math.max(1, Math.ceil(this.rooms.length / ROOM_PAGE_SIZE));
    this.page = Math.min(Math.max(0, page), page_count - 1);
    this.render_rooms();
  }

  private toggle_auto_refresh(): void {
    this.auto_refresh = !this.auto_refresh;
    this.update_auto_button();
    this.start_auto_refresh();
  }

  private start_auto_refresh(): void {
    this.stop_auto_refresh();
    if (!this.auto_refresh || !this.bound) return;
    void this.request_rooms();
    this.auto_timer = window.setInterval(() => void this.request_rooms(), 3000);
  }

  private stop_auto_refresh(): void {
    if (!this.auto_timer) return;
    clearInterval(this.auto_timer);
    this.auto_timer = 0;
  }

  private page_rooms(): IRoomInfo[] {
    return this.rooms.slice(this.page * ROOM_PAGE_SIZE, (this.page + 1) * ROOM_PAGE_SIZE);
  }

  private room_count_text(room: IRoomInfo): string {
    return `${room.clients?.length ?? 0}/${room.max_players ?? 4}`;
  }

  private version_short(version: string): string {
    return version.split(" ")[0];
  }

  private sync_label(mode?: RoomSyncMode): string {
    if (mode === "lockstep") return this.t("network.sync_lockstep");
    if (mode === "delay") return this.t("network.sync_delay");
    return this.t("network.sync_auto");
  }

  private render_rooms(): void {
    const page_count = Math.max(1, Math.ceil(this.rooms.length / ROOM_PAGE_SIZE));
    if (this.page > page_count - 1) this.page = page_count - 1;
    const rooms = this.page_rooms();
    this.set_text(this.rooms_total, fit_text(this.t("network.rooms_total", this.rooms.length), 168, this.rooms_total));
    this.set_text(this.page_label, `${this.page + 1} / ${page_count}`);
    if (this.no_rooms) this.no_rooms.visible = this.rooms.length === 0;
    if (this.btn_prev) {
      this.btn_prev.visible = true;
      this.btn_prev.disabled = this.page <= 0;
      this.btn_prev.set_opacity(this.page <= 0 ? 0.4 : 1);
    }
    if (this.btn_next) {
      this.btn_next.visible = true;
      this.btn_next.disabled = this.page >= page_count - 1;
      this.btn_next.set_opacity(this.page >= page_count - 1 ? 0.4 : 1);
    }
    for (let i = 0; i < this.room_rows.length; i++) {
      const row = this.room_rows[i];
      const room = rooms[i];
      row.visible = !!room;
      if (!room) continue;
      this.set_text(row.children[ROOM_NAME], fit_text(room.title || `${this.t("network.room")} ${room.code ?? ""}`, 296, row.children[ROOM_NAME]));
      this.set_text(row.children[ROOM_CODE], fit_text(room.code ? `#${room.code}` : "", 92, row.children[ROOM_CODE]));
      const badge_bg = row.children[ROOM_BADGE_BG];
      const badge = badge_bg?.children[0];
      this.set_text(badge, fit_text(room.started ? this.t("network.running") : this.t("network.waiting"), 44, badge));
      if (badge_bg) badge_bg.color = room.started ? "#4ade8033" : "#ffffff1f";
      if (badge) paint(badge, { fill_style: room.started ? "#86efac" : "#ffffffc7" });
      const lock_bg = row.children[ROOM_LOCK_BG];
      if (lock_bg) lock_bg.visible = !!room.need_pwd;
      const pwd_bg = row.children[ROOM_PWD_BG];
      if (pwd_bg) pwd_bg.visible = !!room.need_pwd;
      const join = row.children[ROOM_JOIN];
      if (join) join.visible = !room.started;
      this.set_text(row.children[ROOM_OWNER], fit_text(`${this.t("network.owner")} ${room.owner?.name || "-"}`, 144, row.children[ROOM_OWNER]));
      const meta = [
        `${this.t("network.player_count")} ${this.room_count_text(room)}`,
        this.sync_label(room.sync_mode),
        room.lfw_version ? `LFW ${this.version_short(room.lfw_version)}` : "",
        room.data_infos?.length ? `${this.t("network.data_package")}×${room.data_infos.length}` : "",
      ].filter(Boolean).join("\u3000·\u3000");
      this.set_text(row.children[ROOM_META], fit_text(meta, 560, row.children[ROOM_META]));
    }
  }

  private refresh_texts(): void {
    this.apply_placeholders();
    this.update_auto_button();
    this.render_rooms();
  }

  private apply_placeholders(): void {
    for (const row of this.room_rows) {
      const input = row.children[ROOM_PWD_BG]?.children[0];
      const renderer = input?.renderer as IUINodeRenderer | undefined;
      renderer?.set_input_placeholder?.(this.t("network.pwd_hint"));
    }
  }

  private set_status(text: string): void {
    this.set_text(this.rooms_status, fit_text(text, 440, this.rooms_status));
    if (this.rooms_status) this.rooms_status.visible = !!text;
  }

  private clear_status(): void {
    this.set_status("");
  }

  private error_text(e: unknown): string {
    const err = e as { lfw?: { error?: string }; message?: string };
    const text = err?.lfw?.error || err?.message || String(e ?? "");
    return this.truncate(text, 64);
  }

  private add_notice(text: string): void {
    if (text) chat_store.push_sys(text);
  }

  private input_value(node: UINode | undefined): string {
    if (!node) return "";
    const renderer = node.renderer as IUINodeRenderer;
    const value = renderer.get_input_value?.();
    if (typeof value === "string") return value;
    return node.find_component(TextInput)?.text ?? "";
  }

  private update_auto_button(): void {
    paint(this.btn_auto, {
      fill_style: this.auto_refresh ? "#ffffff" : "#a8b9ff",
      underline_color: this.auto_refresh ? "#ffffff" : undefined,
      underline_width: this.auto_refresh ? 1 : 0,
    });
  }

  private t(key: string, ...args: (string | number)[]): string {
    let text = this.lfw.string(key);
    for (let i = 0; i < args.length; i++) text = text.split(`%${i + 1}`).join(`${args[i]}`);
    return text;
  }

  private set_text(node: UINode | undefined, text: string): void {
    if (node?.text?.text !== text) node?.set_text(text);
  }

  private truncate(text: string, max: number): string {
    const chars = [...text];
    if (chars.length <= max) return text;
    return chars.slice(0, max - 1).join("") + "…";
  }
}
