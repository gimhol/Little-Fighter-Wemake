import { Ditto, type INetworkingCallbacks } from "@/LFW";
import type { ILFWCallback } from "@/LFW/ILFWCallback";
import type { IRoomInfo } from "@/LFW/ditto/networking/IRoomInfo";
import { LabelButton } from "@/LFW/ui/component/LabelButton";
import { TextInput } from "@/LFW/ui/component/TextInput";
import { UIComponent } from "@/LFW/ui/component/UIComponent";
import type { UINode } from "@/LFW/ui/UINode";
import { recommend_sync, type RoomSyncMode } from "@/Net";
import { fit_text, paint } from "./ui_helpers";

const PLAYER_ROW_STEP = 32;
const COUNTDOWN_SEC = 5;

const PLAYER_NAME = 0;
const PLAYER_TAGS = 1;
const PLAYER_RTT = 2;
const PLAYER_STATE = 3;
const PLAYER_KICK = 4;

/** 房间内页逻辑：房间信息、成员列表、同步模式、准备与离开 */
export class RoomLogic extends UIComponent {
  static override readonly TAGS: string[] = ["RoomLogic"];

  private bound = false;
  private room: IRoomInfo | undefined;
  private rtts: Record<string, number> = {};
  private all_ready = false;
  private countdown_elapsed = 0;
  private countdown_sec = COUNTDOWN_SEC;
  private countdown_sent = false;

  private top_sub: UINode | undefined;
  private room_title: UINode | undefined;
  private room_code: UINode | undefined;
  private room_badge: UINode | undefined;
  private room_badge_bg: UINode | undefined;
  private room_count: UINode | undefined;
  private recommend: UINode | undefined;
  private room_lfw: UINode | undefined;
  private room_data_0: UINode | undefined;
  private room_data_1: UINode | undefined;
  private pwd_label: UINode | undefined;
  private pwd_bg: UINode | undefined;
  private pwd_input: UINode | undefined;
  private pwd_hint: UINode | undefined;
  private empty_slot: UINode | undefined;
  private countdown: UINode | undefined;
  private room_status: UINode | undefined;
  private btn_ready: UINode | undefined;
  private btn_ready_label: UINode | undefined;
  private player_rows: UINode[] = [];
  private sync_buttons: { mode: RoomSyncMode; node?: UINode; label?: UINode }[] = [];

  private readonly lfw_cb: ILFWCallback = {
    on_lang_changed: () => this.render_room(),
  };

  private readonly net_cb: INetworkingCallbacks = {
    on_room_change: (room) => this.on_room_change(room),
    on_room_leaved: () => this.back_to_rooms(),
    on_ping: (client_id, rtt) => this.update_rtt(client_id, rtt),
    on_error: (error) => this.set_status(this.error_text(error)),
  };

  override on_start(): void {
    Ditto.Networking.callbacks.add(this.net_cb);
    this.lfw.callbacks.add(this.lfw_cb);
    const q = (id: string) => this.node.search_node(id) ?? undefined;
    this.bound = true;

    this.top_sub = q("network_top_sub");
    this.room_title = q("network_room_title");
    this.room_code = q("network_room_code_label");
    this.room_badge = q("network_room_panel_badge");
    this.room_badge_bg = q("network_room_panel_badge_bg");
    this.room_count = q("network_room_count");
    this.recommend = q("network_recommend");
    this.room_lfw = q("network_room_lfw");
    this.room_data_0 = q("network_room_data_0");
    this.room_data_1 = q("network_room_data_1");
    this.pwd_label = q("network_pwd_label");
    this.pwd_bg = q("network_pwd_bg");
    this.pwd_input = q("network_pwd_input");
    this.pwd_hint = q("network_pwd_hint");
    this.empty_slot = q("network_empty_slot");
    this.countdown = q("network_countdown");
    this.room_status = q("network_room_status");
    this.btn_ready = q("network_btn_ready");
    this.btn_ready_label = this.btn_ready?.find_component(LabelButton)?.props.back_label;
    this.player_rows = q("network_player_rows")?.children.slice() ?? [];

    for (let i = 0; i < this.player_rows.length; i++) {
      this.player_rows[i].move_to(0, i * PLAYER_ROW_STEP, 0);
      this.player_rows[i].children[PLAYER_KICK]?.callbacks.add({ on_click: () => this.kick(i) });
    }

    q("network_btn_room_refresh")?.callbacks.add({ on_click: () => this.render_room() });
    q("network_btn_leave_top")?.callbacks.add({ on_click: () => Ditto.Networking.leave_room() });
    q("network_btn_leave")?.callbacks.add({ on_click: () => Ditto.Networking.leave_room() });
    this.btn_ready?.callbacks.add({ on_click: () => this.toggle_ready() });
    this.sync_buttons = (["auto", "lockstep", "delay"] as const).map((mode) => {
      const node = q(`network_sync_${mode}`);
      node?.callbacks.add({ on_click: () => this.set_sync(mode) });
      return { mode, node, label: node?.find_component(LabelButton)?.props.back_label };
    });

    const pwd_input = this.pwd_input?.find_component(TextInput);
    if (pwd_input) pwd_input.on_submit = () => this.set_pwd();

    this.room = Ditto.Networking.room;
    this.update_topbar();
    this.render_room();
  }

  override on_stop(): void {
    this.bound = false;
    Ditto.Networking.callbacks.del(this.net_cb);
    this.lfw.callbacks.del(this.lfw_cb);
    this.room = undefined;
    this.rtts = {};
    this.sync_buttons = [];
    this.player_rows = [];
    this.top_sub = undefined;
    this.room_title = undefined;
    this.room_code = undefined;
    this.room_badge = undefined;
    this.room_badge_bg = undefined;
    this.room_count = undefined;
    this.recommend = undefined;
    this.room_lfw = undefined;
    this.room_data_0 = undefined;
    this.room_data_1 = undefined;
    this.pwd_label = undefined;
    this.pwd_bg = undefined;
    this.pwd_input = undefined;
    this.pwd_hint = undefined;
    this.empty_slot = undefined;
    this.countdown = undefined;
    this.room_status = undefined;
    this.btn_ready = undefined;
    this.btn_ready_label = undefined;
  }

  override update(dt: number): void {
    if (!this.all_ready) return;
    this.countdown_elapsed += dt;
    const sec = Math.max(0, Math.ceil((COUNTDOWN_SEC * 1000 - this.countdown_elapsed) / 1000));
    if (sec !== this.countdown_sec) {
      this.countdown_sec = sec;
      this.render_countdown();
    }
    if (sec > 0 || this.countdown_sent) return;
    this.countdown_sent = true;
    if (this.is_owner()) Ditto.Networking.start_room();
  }

  private on_room_change(room: IRoomInfo | undefined): void {
    this.room = room;
    if (!room) {
      this.back_to_rooms();
      return;
    }
    const all_ready = this.check_all_ready(room);
    if (all_ready !== this.all_ready) {
      this.all_ready = all_ready;
      this.countdown_elapsed = 0;
      this.countdown_sec = COUNTDOWN_SEC;
      this.countdown_sent = false;
    }
    this.render_room();
  }

  private update_rtt(client_id: string | undefined, rtt: number | undefined): void {
    if (!client_id) return;
    const value = client_id === Ditto.Networking.client?.id ? Ditto.Networking.rtt : rtt;
    if (!value || this.rtts[client_id] === value) return;
    this.rtts[client_id] = value;
    this.update_topbar();
    this.render_players();
    this.render_recommend();
  }

  private toggle_ready(): void {
    const conn = Ditto.Networking;
    const me = this.room?.clients?.find((v) => v.id === conn.client?.id);
    if (!me) return;
    conn.set_ready(!me.ready);
  }

  private set_pwd(): void {
    if (!this.is_owner()) return;
    const pwd = this.input_value(this.pwd_input).trim();
    Ditto.Networking.set_room_pwd(pwd);
    this.set_input(this.pwd_input, "");
  }

  private set_sync(mode: RoomSyncMode): void {
    if (!this.is_owner() || this.room?.started) return;
    Ditto.Networking.set_room_sync(mode);
  }

  private kick(index: number): void {
    const member = this.room?.clients?.[index];
    if (!member?.id || !this.is_owner() || member.id === Ditto.Networking.client?.id) return;
    Ditto.Networking.kick(member.id);
  }

  private back_to_rooms(): void {
    if (!this.bound) return;
    this.node.layer?.pop({});
  }

  private render_room(): void {
    const room = this.room;
    if (!room) return;
    const clients = room.clients ?? [];
    const max = room.max_players ?? 4;
    const me = this.find_me();
    const owner = this.is_owner();
    this.set_text(this.room_title, fit_text(room.title || `${this.lfw.t("network.room")} ${room.code ?? ""}`, 220, this.room_title));
    this.set_text(this.room_code, room.code ? `#${room.code}` : "");
    this.set_text(this.room_badge, fit_text(room.started ? this.lfw.t("network.running") : this.lfw.t("network.waiting"), 54, this.room_badge));
    if (this.room_badge_bg) this.room_badge_bg.color = room.started ? "#4ade8033" : "#ffffff1f";
    paint(this.room_badge, { fill_style: room.started ? "#86efac" : "#ffffffc7" });
    this.set_text(this.room_count, fit_text(`${this.lfw.t("network.player_count")} ${clients.length}/${max}`, 104, this.room_count));
    this.render_sync(room.sync_mode ?? "auto");
    this.render_infos(room);
    this.render_pwd(owner);
    this.render_players();
    if (this.empty_slot) {
      this.empty_slot.visible = clients.length < max;
      this.empty_slot.move_to(397, 178 + clients.length * PLAYER_ROW_STEP + PLAYER_ROW_STEP / 2, 0);
    }
    if (this.btn_ready) this.btn_ready.visible = !!me;
    this.set_text(this.btn_ready_label, fit_text(this.lfw.t(me?.ready ? "network.btn_cancel_ready" : "network.ready"), 100, this.btn_ready_label));
    this.render_countdown();
    this.render_recommend();
  }

  private render_sync(mode: RoomSyncMode): void {
    for (const { mode: m, label } of this.sync_buttons) {
      paint(label, {
        fill_style: m === mode ? "#ffffff" : "#a8b9ff",
        underline_color: m === mode ? "#ffffff" : void 0,
        underline_width: m === mode ? 1 : 0,
      });
    }
  }

  private render_infos(room: IRoomInfo): void {
    const infos = room.data_infos ?? [];
    if (this.room_lfw) this.room_lfw.visible = !!room.lfw_version;
    this.set_text(this.room_lfw, fit_text(room.lfw_version ? `${this.lfw.t("network.lfw_version")}: ${this.version_short(room.lfw_version)}` : "", 600, this.room_lfw));
    if (this.room_data_0) this.room_data_0.visible = !!infos[0];
    if (this.room_data_1) this.room_data_1.visible = !!infos[1];
    this.set_text(this.room_data_0, fit_text(infos[0] ? `${this.lfw.t("network.data_package")}[1] ${this.data_info_text(infos[0])}` : "", 600, this.room_data_0));
    this.set_text(this.room_data_1, fit_text(infos[1] ? `${this.lfw.t("network.data_package")}[2] ${this.data_info_text(infos[1])}` : "", 600, this.room_data_1));
  }

  private render_pwd(owner: boolean): void {
    if (this.pwd_label) this.pwd_label.visible = owner;
    if (this.pwd_bg) this.pwd_bg.visible = owner;
    this.set_text(this.pwd_hint, fit_text(this.lfw.t("network.owner_only"), 150, this.pwd_hint));
    if (!owner) this.set_input(this.pwd_input, "");
  }

  private render_players(): void {
    const room = this.room;
    if (!room) return;
    const clients = room.clients ?? [];
    const me = this.find_me();
    const owner = this.is_owner();
    for (let i = 0; i < this.player_rows.length; i++) {
      const row = this.player_rows[i];
      const member = clients[i];
      row.visible = !!member;
      if (!member) continue;
      this.set_text(row.children[PLAYER_NAME], fit_text(member.name || member.id || "-", 190, row.children[PLAYER_NAME]));
      const tags: string[] = [];
      if (member.id === me?.id) tags.push(`(${this.lfw.t("network.you")})`);
      if (member.id === room.owner?.id) tags.push(`(${this.lfw.t("network.owner")})`);
      this.set_text(row.children[PLAYER_TAGS], fit_text(tags.join(" "), 150, row.children[PLAYER_TAGS]));
      const rtt = member.id ? this.rtts[member.id] : 0;
      this.set_text(row.children[PLAYER_RTT], rtt ? `${rtt}ms` : "-");
      const state = row.children[PLAYER_STATE];
      this.set_text(state, fit_text(this.lfw.t(member.ready ? "network.ready_done" : "network.not_ready"), 88, state));
      paint(state, { fill_style: member.ready ? "#9b9bff" : "#ffffff73" });
      const kick = row.children[PLAYER_KICK];
      if (kick) kick.visible = owner && member.id !== me?.id;
    }
  }

  private render_recommend(): void {
    const clients = this.room?.clients ?? [];
    let worst = 0;
    for (const member of clients) worst = Math.max(worst, this.rtts[member.id ?? ""] ?? 0);
    if (!worst) {
      this.set_text(this.recommend, "");
      return;
    }
    const rec = recommend_sync(worst);
    const label = rec.sync_mode === "delay"
      ? `${this.lfw.t("network.sync_delay")} K=${rec.input_delay}`
      : this.lfw.t("network.sync_lockstep");
    this.set_text(this.recommend, fit_text(`${this.lfw.t("network.recommend")}: ${label} (${Math.round(worst)}ms)`, 225, this.recommend));
  }

  private render_countdown(): void {
    if (!this.countdown) return;
    this.countdown.visible = this.all_ready;
    if (!this.all_ready) return;
    const key = this.countdown_sec > 0 ? "network.countdown" : "network.enter_game";
    const text = this.countdown_sec > 0
      ? this.lfw.t(key, String(this.countdown_sec))
      : this.lfw.t(key);
    this.set_text(this.countdown, fit_text(text, 370, this.countdown));
  }

  private check_all_ready(room: IRoomInfo): boolean {
    const clients = room.clients ?? [];
    if (room.started || !clients.length) return false;
    if (clients.length < (room.min_players ?? 1)) return false;
    return clients.every((v) => !!v.ready);
  }

  private update_topbar(): void {
    const sub = this.top_sub;
    if (!sub) return;
    const conn = Ditto.Networking;
    const address = conn.url || "";
    sub.set_text(fit_text(`${address}\u3000·\u3000${conn.rtt}ms`, 300, sub));
  }

  private find_me() {
    const id = Ditto.Networking.client?.id;
    return id ? this.room?.clients?.find((v) => v.id === id) : undefined;
  }

  private is_owner(): boolean {
    const id = Ditto.Networking.client?.id;
    return !!id && this.room?.owner?.id === id;
  }

  private version_short(version: string): string {
    return version.split(" ")[0];
  }

  private data_info_text(info?: { type?: string; title?: string; version?: number; md5?: string }): string {
    if (!info) return "";
    const type = info.type ? `[${info.type}] ` : "";
    const name = info.title || "";
    const version = typeof info.version === "number" ? ` v${info.version}` : "";
    const md5 = info.md5 ? ` · ${info.md5.slice(0, 8)}` : "";
    return this.truncate(`${type}${name}${version}${md5}`, 52);
  }

  private set_status(text: string): void {
    this.set_text(this.room_status, fit_text(text, 620, this.room_status));
    if (this.room_status) this.room_status.visible = !!text;
  }

  private error_text(e: unknown): string {
    const err = e as { error?: string; message?: string };
    return this.truncate(err?.error || err?.message || String(e ?? ""), 64);
  }

  private input_value(node: UINode | undefined): string {
    if (!node) return "";
    const renderer = node.renderer as { get_input_value?: () => string | undefined };
    const value = renderer.get_input_value?.();
    if (typeof value === "string") return value;
    return node.find_component(TextInput)?.text ?? "";
  }

  private set_input(node: UINode | undefined, value: string): void {
    if (!node) return;
    const renderer = node.renderer as { set_input_value?: (v: string) => void };
    if (renderer.set_input_value) {
      renderer.set_input_value(value);
      return;
    }
    node.find_component(TextInput)?.set_text(value);
  }

  private set_text(node: UINode | undefined, text: string): void {
    node?.set_text(text);
  }

  private truncate(text: string, max: number): string {
    const chars = [...text];
    if (chars.length <= max) return text;
    return chars.slice(0, max - 1).join("") + "…";
  }
}
