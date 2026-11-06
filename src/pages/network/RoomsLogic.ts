import type { INetworkingCallbacks, IUINodeRenderer } from "@/LFW";
import { Ditto, LFW } from "@/LFW";
import { LabelButton } from "@/LFW/ui/component/LabelButton";
import { TextInput } from "@/LFW/ui/component/TextInput";
import { UIComponent } from "@/LFW/ui/component/UIComponent";
import type { UINode } from "@/LFW/ui/UINode";
import type { ILFWCallback } from "@/LFW/ILFWCallback";
import type { IRoomInfo } from "@/LFW/ditto/networking/IRoomInfo";
import type { RoomSyncMode } from "@/Net";
import { fit_text, paint } from "./ui_helpers";

const ROOM_PAGE_SIZE = 5;
const AUTO_REFRESH_MS = 3000;
const ROOM_PAGE_ID = "network_room_page";
const CONNECT_PAGE_ID = "network_modal";

const ROOM_NAME = 0;
const ROOM_CODE = 1;
const ROOM_BADGE_BG = 2;
const ROOM_LOCK_BG = 3;
const ROOM_PWD_BG = 4;
const ROOM_JOIN = 5;
const ROOM_OWNER = 6;
const ROOM_META = 7;

/** 房间列表页逻辑：只负责房间列表的请求、分页与渲染 */
export class RoomsLogic extends UIComponent {
  static override readonly TAGS: string[] = ["RoomsLogic"];

  private rooms: IRoomInfo[] = [];
  private page = 0;
  private auto_refresh = true;
  private auto_elapsed = 0;
  private busy = false;
  private bound = false;

  private btn_auto: UINode | undefined;
  private btn_auto_label: UINode | undefined;
  private rooms_total: UINode | undefined;
  private room_rows: UINode[] = [];
  private no_rooms: UINode | undefined;
  private btn_prev: UINode | undefined;
  private btn_next: UINode | undefined;
  private page_label: UINode | undefined;
  private rooms_status: UINode | undefined;
  private top_sub: UINode | undefined;

  private readonly lfw_cb: ILFWCallback = {
    on_lang_changed: () => this.refresh_texts(),
  };

  private readonly net_cb: INetworkingCallbacks = {
    on_register: () => {
      this.busy = false;
      this.clear_status();
      this.update_topbar();
      Ditto.Networking.refresh_rooms(this.page);
    },
    on_close: (reason) => {
      this.busy = false;
      this.update_topbar();
      this.show_connect_modal(reason || "连接已断开，请重新连接。");
    },
    on_ping: () => this.update_topbar(),
    on_rooms_change: (rooms) => {
      if (!this.bound) return;
      this.rooms = [...rooms];
      this.render_rooms();
    },
    on_room_created: () => this.enter_room(),
    on_room_joined: () => this.enter_room(),
    on_room_create_failed: (error) => this.room_failed(error),
    on_room_join_failed: (error) => this.room_failed(error),
  };

  override on_start(): void {
    this.lfw.callbacks.add(this.lfw_cb);
    const q = (id: string) => this.node.search_node(id) ?? undefined;
    this.bound = true;
    this.btn_auto = q("network_btn_auto");
    this.btn_auto_label = this.btn_auto?.find_component(LabelButton)?.props.back_label;
    this.rooms_total = q("network_rooms_total");
    this.no_rooms = q("network_no_rooms");
    this.btn_prev = q("network_btn_prev");
    this.btn_next = q("network_btn_next");
    this.page_label = q("network_page_label");
    this.rooms_status = q("network_rooms_status");
    this.top_sub = q("network_top_sub");
    this.room_rows = q("network_room_rows")?.children.slice() ?? [];

    for (let i = 0; i < this.room_rows.length; i++) {
      const row = this.room_rows[i];
      row.children[ROOM_JOIN]?.callbacks.add({ on_click: () => void this.join_room(i) });
      const input = row.children[ROOM_PWD_BG]?.children[0]?.find_component(TextInput);
      if (input) input.on_submit = () => void this.join_room(i);
    }

    q("network_btn_disconnect")?.callbacks.add({ on_click: () => this.disconnect() });
    q("network_btn_create")?.callbacks.add({ on_click: () => this.create_room() });
    q("network_btn_refresh")?.callbacks.add({ on_click: () => Ditto.Networking.refresh_rooms(this.page) });
    this.btn_auto?.callbacks.add({ on_click: () => this.toggle_auto_refresh() });
    this.btn_prev?.callbacks.add({ on_click: () => this.goto_page(this.page - 1) });
    this.btn_next?.callbacks.add({ on_click: () => this.goto_page(this.page + 1) });

    Ditto.Networking.callbacks.add(this.net_cb);
    this.rooms = [...Ditto.Networking.rooms];
    this.apply_placeholders();
    this.update_auto_button();
    this.update_topbar();
    this.render_rooms();
    if (!Ditto.Networking.opened) {
      this.show_connect_modal("连接已断开，请重新连接。");
      return;
    }
    Ditto.Networking.refresh_rooms(this.page);
  }

  override on_resume(): void {
    this.refresh_texts();
  }

  override on_stop(): void {
    this.bound = false;
    Ditto.Networking.callbacks.del(this.net_cb);
    this.btn_auto = undefined;
    this.btn_auto_label = undefined;
    this.rooms_total = undefined;
    this.room_rows = [];
    this.no_rooms = undefined;
    this.btn_prev = undefined;
    this.btn_next = undefined;
    this.page_label = undefined;
    this.rooms_status = undefined;
    this.top_sub = undefined;
    this.lfw.callbacks.del(this.lfw_cb);
  }

  private create_room(): void {
    if (this.busy) return;
    this.busy = true;
    void LFW.collect_data_infos()
      .then((data_infos) => {
        Ditto.Networking.create_room({ min_players: 1, max_players: 4, lfw_version: LFW.VERSION_NAME, data_infos });
      })
      .catch((e) => {
        this.busy = false;
        this.set_status(this.error_text(e));
      });
  }

  private join_room(index: number): void {
    const room = this.page_rooms()[index];
    if (!Ditto.Networking.opened || !room?.id || this.busy) return;
    const room_id = room.id;
    const row = this.room_rows[index];
    const pwd = this.input_value(row?.children[ROOM_PWD_BG]?.children[0]).trim();
    if (room.need_pwd && !pwd) {
      this.set_status(this.lfw.t("network.enter_pwd"));
      return;
    }
    this.busy = true;
    void LFW.collect_data_infos()
      .then((data_infos) => {
        Ditto.Networking.join_room({ roomid: room_id, pwd: pwd || undefined, lfw_version: LFW.VERSION_NAME, data_infos });
      })
      .catch((e) => {
        this.busy = false;
        this.set_status(this.error_text(e));
      });
  }

  private disconnect(): void {
    this.node.layer?.pop({});
    Ditto.Networking.close();
  }

  /** 在当前页面上弹出连接弹窗，不切换页面 */
  private show_connect_modal(status: string): void {
    const modal = this.lfw.layers.open_modal({ id: CONNECT_PAGE_ID }, 0);
    modal?.search_node("network_connect_status")?.set_text(status);
  }

  private enter_room(): void {
    if (!this.bound) return;
    this.busy = false;
    this.clear_status();
    this.lfw.layers.push_page({ id: ROOM_PAGE_ID }, 0);
  }

  private update_topbar(): void {
    const sub = this.top_sub;
    if (!sub) return;
    const conn = Ditto.Networking;
    if (!conn.opened) {
      sub.set_text("");
      return;
    }
    const info = `${this.lfw.t("network.guest")}\u3000·\u3000${conn.url || ""}\u3000·\u3000${conn.rtt}ms`;
    sub.set_text(fit_text(info, 300, sub));
  }

  private room_failed(error: unknown): void {
    if (!this.bound) return;
    this.busy = false;
    this.set_status(this.error_text(error));
  }

  private goto_page(page: number): void {
    const page_count = Math.max(1, Math.ceil(this.rooms.length / ROOM_PAGE_SIZE));
    this.page = Math.min(Math.max(0, page), page_count - 1);
    this.render_rooms();
  }

  private toggle_auto_refresh(): void {
    this.auto_refresh = !this.auto_refresh;
    this.update_auto_button();
    this.auto_elapsed = 0;
    if (this.auto_refresh) Ditto.Networking.refresh_rooms(this.page);
  }

  override update(dt: number): void {
    if (!this.auto_refresh || !this.bound) return;
    this.auto_elapsed += dt;
    if (this.auto_elapsed < AUTO_REFRESH_MS) return;
    this.auto_elapsed = 0;
    Ditto.Networking.refresh_rooms(this.page);
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
    if (mode === "lockstep") return this.lfw.t("network.sync_lockstep");
    if (mode === "delay") return this.lfw.t("network.sync_delay");
    return this.lfw.t("network.sync_auto");
  }

  private render_rooms(): void {
    const page_count = Math.max(1, Math.ceil(this.rooms.length / ROOM_PAGE_SIZE));
    if (this.page > page_count - 1) this.page = page_count - 1;
    const rooms = this.page_rooms();
    this.rooms_total?.set_text(fit_text(this.lfw.t("network.rooms_total", String(this.rooms.length)), 168, this.rooms_total));
    this.page_label?.set_text(`${this.page + 1} / ${page_count}`);
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
      row.children[ROOM_NAME]?.set_text(fit_text(room.title || `${this.lfw.t("network.room")} ${room.code ?? ""}`, 296, row.children[ROOM_NAME]));
      row.children[ROOM_CODE]?.set_text(fit_text(room.code ? `#${room.code}` : "", 92, row.children[ROOM_CODE]));
      const badge_bg = row.children[ROOM_BADGE_BG];
      const badge = badge_bg?.children[0];
      badge?.set_text(fit_text(room.started ? this.lfw.t("network.running") : this.lfw.t("network.waiting"), 44, badge));
      if (badge_bg) badge_bg.color = room.started ? "#4ade8033" : "#ffffff1f";
      if (badge) paint(badge, { fill_style: room.started ? "#86efac" : "#ffffffc7" });
      const lock_bg = row.children[ROOM_LOCK_BG];
      if (lock_bg) lock_bg.visible = !!room.need_pwd;
      const pwd_bg = row.children[ROOM_PWD_BG];
      if (pwd_bg) pwd_bg.visible = !!room.need_pwd;
      const join = row.children[ROOM_JOIN];
      if (join) join.visible = !room.started;
      row.children[ROOM_OWNER]?.set_text(fit_text(`${this.lfw.t("network.owner")} ${room.owner?.name || "-"}`, 144, row.children[ROOM_OWNER]));
      const meta = [
        `${this.lfw.t("network.player_count")} ${this.room_count_text(room)}`,
        this.sync_label(room.sync_mode),
        room.lfw_version ? `LFW ${this.version_short(room.lfw_version)}` : "",
        room.data_infos?.length ? `${this.lfw.t("network.data_package")}×${room.data_infos.length}` : "",
      ].filter(Boolean).join("\u3000·\u3000");
      row.children[ROOM_META]?.set_text(fit_text(meta, 560, row.children[ROOM_META]));
    }
  }

  private refresh_texts(): void {
    this.apply_placeholders();
    this.update_auto_button();
    this.update_topbar();
    this.render_rooms();
  }

  private apply_placeholders(): void {
    for (const row of this.room_rows) {
      const input = row.children[ROOM_PWD_BG]?.children[0];
      const renderer = input?.renderer as IUINodeRenderer | undefined;
      renderer?.set_input_placeholder?.(this.lfw.t("network.pwd_hint"));
    }
  }

  private set_status(text: string): void {
    this.rooms_status?.set_text(fit_text(text, 440, this.rooms_status));
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

  private input_value(node: UINode | undefined): string {
    if (!node) return "";
    const renderer = node.renderer as IUINodeRenderer;
    const value = renderer.get_input_value?.();
    if (typeof value === "string") return value;
    return node.find_component(TextInput)?.text ?? "";
  }

  private update_auto_button(): void {
    paint(this.btn_auto_label, {
      fill_style: this.auto_refresh ? "#ffffff" : "#a8b9ff",
      underline_color: this.auto_refresh ? "#ffffff" : undefined,
      underline_width: this.auto_refresh ? 1 : 0,
    });
  }

  private truncate(text: string, max: number): string {
    const chars = [...text];
    if (chars.length <= max) return text;
    return chars.slice(0, max - 1).join("") + "…";
  }
}
