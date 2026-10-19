import localforage from "localforage";
import { LFW } from "@/LFW";
import type { ILFWCallback } from "@/LFW/ILFWCallback";
import type { IPlayerInfoCallback } from "@/LFW";
import type { IWorldCallbacks } from "@/LFW/IWorldCallbacks";
import type { IStyle } from "@/LFW/defines/IStyle";
import { TextInput } from "@/LFW/ui/component/TextInput";
import { UIComponent } from "@/LFW/ui/component/UIComponent";
import { Style } from "@/LFW/ui/Style";
import type { UINode } from "@/LFW/ui/UINode";
import {
  ErrCode,
  MsgEnum,
  clamp_nickname,
  recommend_sync,
  type IRespChat,
  type IRespRoomStart,
  type IRoomInfo,
  type NetSyncMode,
  type RoomSyncMode,
  type TChatTarget,
  type TResp,
} from "@/Net";
import { Connection } from "./Connection";
import { current_connection } from "./current_connection";
import { DelayNetworkDriver } from "./DelayNetworkDriver";
import { LFWNetworkDriver } from "./LFWNetworkDriver";
import { LockstepNetworkDriver } from "./LockstepNetworkDriver";
import { pick_default_nickname } from "./default_nicknames";
import { set_nickname } from "./nickname_store";

type TMode = 'connect' | 'rooms' | 'room' | 'started';
type TConnectMode = 'guest' | 'account';
type TAccountState = 'out' | 'pending' | 'in';
type TLeaver = { id: string; name: string; left: boolean };
type TChatItem = { kind: 'msg'; msg: IRespChat } | { kind: 'sys'; text: string };
type TInputRenderer = {
  get_input_value?(): string;
  set_input_value?(value: string): void;
  set_input_placeholder?(value: string): void;
};

const ROOM_PAGE_SIZE = 5;
const ROOM_ROW_STEP = 56;
const PLAYER_ROW_STEP = 32;
const CHAT_ROW_STEP = 19;
const CHAT_MAX = 100;
const CHAT_SHOW = 15;
const CHAT_COOLDOWN_MS = 800;
const CHAT_BACKOFF_MS = 1200;
const COUNTDOWN_MS = 5000;

const ROOM_NAME = 0;
const ROOM_CODE = 1;
const ROOM_BADGE_BG = 2;
const ROOM_LOCK_BG = 3;
const ROOM_PWD_BG = 4;
const ROOM_JOIN = 5;
const ROOM_OWNER = 6;
const ROOM_META = 7;

const PLAYER_NAME = 0;
const PLAYER_TAGS = 1;
const PLAYER_RTT = 2;
const PLAYER_STATE = 3;
const PLAYER_KICK = 4;

export class NetworkLogic extends UIComponent {
  static override readonly TAGS: string[] = ["NetworkLogic"];

  private mode: TMode = 'connect';
  private connect_mode: TConnectMode = 'guest';
  private account_state: TAccountState = 'out';
  private session_account = false;
  private account_name = 'Gim';
  private account_id = 'gim_1024';
  private conn: Connection | null = null;
  private driver: LFWNetworkDriver | null = null;
  private room: IRoomInfo | undefined;
  private rooms: IRoomInfo[] = [];
  private page = 0;
  private auto_refresh = true;
  private auto_timer = 0;
  private busy = false;
  private connecting = false;
  private address = '';
  private status = '';
  private rtts: Record<string, number> = {};
  private chat_items: TChatItem[] = [];
  private leavers: TLeaver[] = [];
  private reconnecting = 0;
  private rejoin_failed: '' | 'rejected' | 'timeout' = '';
  private all_ready = false;
  private countdown_elapsed = 0;
  private countdown_sec = 5;
  private countdown_sent = false;
  private chat_cooldown_until = 0;

  private bg: UINode | undefined;
  private dim: UINode | undefined;
  private topbar: UINode | undefined;
  private top_title: UINode | undefined;
  private top_sub: UINode | undefined;
  private account_chip_bg: UINode | undefined;
  private account_chip: UINode | undefined;
  private btn_logout: UINode | undefined;
  private btn_create: UINode | undefined;
  private btn_refresh: UINode | undefined;
  private btn_auto: UINode | undefined;
  private btn_disconnect: UINode | undefined;
  private btn_room_refresh: UINode | undefined;
  private btn_leave_top: UINode | undefined;

  private connect_panel: UINode | undefined;
  private address_input: UINode | undefined;
  private nickname_input: UINode | undefined;
  private btn_connect: UINode | undefined;
  private btn_connect_cancel: UINode | undefined;
  private connect_close: UINode | undefined;
  private connect_status: UINode | undefined;
  private tab_guest: UINode | undefined;
  private tab_account: UINode | undefined;
  private guest_body: UINode | undefined;
  private account_body: UINode | undefined;
  private account_address_input: UINode | undefined;
  private account_out: UINode | undefined;
  private account_pending: UINode | undefined;
  private account_in: UINode | undefined;
  private account_name_text: UINode | undefined;
  private account_id_text: UINode | undefined;
  private account_avatar: UINode | undefined;
  private btn_account_login: UINode | undefined;
  private btn_account_mock: UINode | undefined;
  private btn_account_cancel_0: UINode | undefined;
  private btn_account_cancel_1: UINode | undefined;
  private btn_account_enter: UINode | undefined;
  private btn_account_logout: UINode | undefined;

  private rooms_panel: UINode | undefined;
  private rooms_total: UINode | undefined;
  private room_rows: UINode[] = [];
  private no_rooms: UINode | undefined;
  private btn_prev: UINode | undefined;
  private btn_next: UINode | undefined;
  private page_label: UINode | undefined;
  private rooms_status: UINode | undefined;
  private room_status: UINode | undefined;

  private room_panel: UINode | undefined;
  private room_title: UINode | undefined;
  private room_code: UINode | undefined;
  private room_badge: UINode | undefined;
  private room_badge_bg: UINode | undefined;
  private room_count: UINode | undefined;
  private sync_auto: UINode | undefined;
  private sync_lockstep: UINode | undefined;
  private sync_delay: UINode | undefined;
  private recommend: UINode | undefined;
  private room_lfw: UINode | undefined;
  private room_data_0: UINode | undefined;
  private room_data_1: UINode | undefined;
  private pwd_label: UINode | undefined;
  private pwd_bg: UINode | undefined;
  private pwd_input: UINode | undefined;
  private btn_set_pwd: UINode | undefined;
  private pwd_hint: UINode | undefined;
  private player_rows: UINode[] = [];
  private empty_slot: UINode | undefined;
  private countdown: UINode | undefined;
  private btn_leave: UINode | undefined;
  private btn_ready: UINode | undefined;

  private chat_panel: UINode | undefined;
  private chat_target: UINode | undefined;
  private btn_chat_target: UINode | undefined;
  private chat_rows: UINode[] = [];
  private chat_input: UINode | undefined;
  private btn_send: UINode | undefined;

  private overlay_dim: UINode | undefined;
  private overlay_panel: UINode | undefined;
  private overlay_title: UINode | undefined;
  private overlay_line_0: UINode | undefined;
  private overlay_line_1: UINode | undefined;
  private btn_continue_solo: UINode | undefined;
  private btn_back_lobby: UINode | undefined;
  private btn_continue_game: UINode | undefined;

  private watched_players: { player: { callbacks: { del(cb: IPlayerInfoCallback): void } }; cb: IPlayerInfoCallback }[] = [];
  private readonly lfw_cb: ILFWCallback = {
    on_loading_end: () => {
      if (!this.conn) return;
      if (this.lfw.zips.zips.length < 1) return;
      this.conn.send_nowait(MsgEnum.Tick, { seq: 0 });
    },
    on_lang_changed: () => {
      this.refresh_texts();
      this.apply_placeholders();
    },
  };
  private readonly world_cb: IWorldCallbacks = {
    on_dataset_change: (key, value, prev) => this.driver?.on_dataset_change(key, value, prev),
  };

  override on_start(): void {
    const q = (id: string) => this.node.search_node(id) ?? undefined;
    this.bg = q('network_bg');
    this.dim = q('network_dim');
    this.topbar = q('network_topbar');
    this.top_title = q('network_top_title');
    this.top_sub = q('network_top_sub');
    this.account_chip_bg = q('network_account_chip_bg');
    this.account_chip = q('network_account_chip');
    this.btn_logout = q('network_btn_logout');
    this.btn_create = q('network_btn_create');
    this.btn_refresh = q('network_btn_refresh');
    this.btn_auto = q('network_btn_auto');
    this.btn_disconnect = q('network_btn_disconnect');
    this.btn_room_refresh = q('network_btn_room_refresh');
    this.btn_leave_top = q('network_btn_leave_top');

    this.connect_panel = q('network_connect_panel');
    this.address_input = q('network_address_input');
    this.nickname_input = q('network_nickname_input');
    this.btn_connect = q('network_btn_connect');
    this.btn_connect_cancel = q('network_btn_connect_cancel');
    this.connect_close = q('network_connect_close');
    this.connect_status = q('network_connect_status');
    this.tab_guest = q('network_tab_guest');
    this.tab_account = q('network_tab_account');
    this.guest_body = q('network_guest_body');
    this.account_body = q('network_account_body');
    this.account_address_input = q('network_account_address_input');
    this.account_out = q('network_account_out');
    this.account_pending = q('network_account_pending');
    this.account_in = q('network_account_in');
    this.account_name_text = q('network_account_name');
    this.account_id_text = q('network_account_id');
    this.account_avatar = q('network_account_avatar');
    this.btn_account_login = q('network_btn_account_login');
    this.btn_account_mock = q('network_btn_account_mock');
    this.btn_account_cancel_0 = q('network_btn_account_cancel_0');
    this.btn_account_cancel_1 = q('network_btn_account_cancel_1');
    this.btn_account_enter = q('network_btn_account_enter');
    this.btn_account_logout = q('network_btn_account_logout');

    this.rooms_panel = q('network_rooms_panel');
    this.rooms_total = q('network_rooms_total');
    this.no_rooms = q('network_no_rooms');
    this.btn_prev = q('network_btn_prev');
    this.btn_next = q('network_btn_next');
    this.page_label = q('network_page_label');
    this.rooms_status = q('network_rooms_status');
    this.room_status = q('network_room_status');

    this.room_panel = q('network_room_panel');
    this.room_title = q('network_room_title');
    this.room_code = q('network_room_code_label');
    this.room_badge = q('network_room_panel_badge');
    this.room_badge_bg = q('network_room_panel_badge_bg');
    this.room_count = q('network_room_count');
    this.sync_auto = q('network_sync_auto');
    this.sync_lockstep = q('network_sync_lockstep');
    this.sync_delay = q('network_sync_delay');
    this.recommend = q('network_recommend');
    this.room_lfw = q('network_room_lfw');
    this.room_data_0 = q('network_room_data_0');
    this.room_data_1 = q('network_room_data_1');
    this.pwd_label = q('network_pwd_label');
    this.pwd_bg = q('network_pwd_bg');
    this.pwd_input = q('network_pwd_input');
    this.btn_set_pwd = q('network_btn_set_pwd');
    this.pwd_hint = q('network_pwd_hint');
    this.empty_slot = q('network_empty_slot');
    this.countdown = q('network_countdown');
    this.btn_leave = q('network_btn_leave');
    this.btn_ready = q('network_btn_ready');

    this.chat_panel = q('network_chat_panel');
    this.chat_target = q('network_chat_target');
    this.btn_chat_target = q('network_btn_chat_target');
    this.chat_input = q('network_chat_input');
    this.btn_send = q('network_btn_send');

    this.overlay_dim = q('network_overlay_dim');
    this.overlay_panel = q('network_overlay_panel');
    this.overlay_title = q('network_overlay_title');
    this.overlay_line_0 = q('network_overlay_line_0');
    this.overlay_line_1 = q('network_overlay_line_1');
    this.btn_continue_solo = q('network_btn_continue_solo');
    this.btn_back_lobby = q('network_btn_back_lobby');
    this.btn_continue_game = q('network_btn_continue_game');

    this.room_rows = q('network_room_rows')?.children.slice() ?? [];
    this.player_rows = q('network_player_rows')?.children.slice() ?? [];
    this.chat_rows = q('network_chat_rows')?.children.slice() ?? [];
    const chat_box = q('network_chat_rows');
    if (chat_box) chat_box.clip_children = true;

    for (let i = 0; i < this.room_rows.length; i++) {
      const row = this.room_rows[i];
      row.move_to(0, i * ROOM_ROW_STEP, 0);
      this.bind(row.children[ROOM_JOIN], () => void this.join_room(i));
      const pwd_input = row.children[ROOM_PWD_BG]?.children[0];
      const text_input = pwd_input?.find_component(TextInput);
      if (text_input) text_input.on_submit = () => void this.join_room(i);
    }
    for (let i = 0; i < this.player_rows.length; i++) {
      const row = this.player_rows[i];
      row.move_to(0, i * PLAYER_ROW_STEP, 0);
      this.bind(row.children[PLAYER_KICK], () => this.kick_row(i), 'cancel');
    }
    for (let i = 0; i < this.chat_rows.length; i++) {
      this.chat_rows[i].move_to(0, i * CHAT_ROW_STEP, 0);
    }

    this.bind(this.connect_close, () => this.close_page(), 'cancel');
    this.bind(this.btn_connect, () => this.connect());
    this.bind(this.btn_connect_cancel, () => this.cancel_connect(), 'cancel');
    this.bind(this.tab_guest, () => this.set_connect_mode('guest'));
    this.bind(this.tab_account, () => this.set_connect_mode('account'));
    this.bind(this.btn_account_login, () => this.account_login());
    this.bind(this.btn_account_mock, () => this.set_account_state('in'));
    this.bind(this.btn_account_cancel_0, () => this.close_page(), 'cancel');
    this.bind(this.btn_account_cancel_1, () => this.close_page(), 'cancel');
    this.bind(this.btn_account_enter, () => this.account_enter_lobby());
    this.bind(this.btn_account_logout, () => this.account_logout(), 'cancel');
    this.bind(this.btn_logout, () => this.account_logout(), 'cancel');
    this.bind(this.btn_create, () => void this.create_room());
    this.bind(this.btn_refresh, () => this.mode === 'room' ? this.render_room() : this.request_rooms());
    this.bind(this.btn_auto, () => this.toggle_auto_refresh());
    this.bind(this.btn_disconnect, () => this.disconnect(), 'cancel');
    this.bind(this.btn_room_refresh, () => this.render_room());
    this.bind(this.btn_leave_top, () => void this.leave_room(), 'cancel');
    this.bind(this.btn_prev, () => this.goto_page(this.page - 1));
    this.bind(this.btn_next, () => this.goto_page(this.page + 1));
    this.bind(this.btn_leave, () => void this.leave_room(), 'cancel');
    this.bind(this.btn_ready, () => void this.toggle_ready());
    this.bind(this.btn_set_pwd, () => void this.set_pwd());
    this.bind(this.btn_send, () => this.send_chat());
    this.bind(this.sync_auto, () => void this.set_sync('auto'));
    this.bind(this.sync_lockstep, () => void this.set_sync('lockstep'));
    this.bind(this.sync_delay, () => void this.set_sync('delay'));
    this.bind(this.btn_continue_solo, () => this.continue_solo());
    this.bind(this.btn_back_lobby, () => this.back_lobby(), 'cancel');
    this.bind(this.btn_continue_game, () => this.continue_game());

    const address_input = this.address_input?.find_component(TextInput);
    if (address_input) address_input.on_submit = () => this.connect();
    const nickname_input = this.nickname_input?.find_component(TextInput);
    if (nickname_input) nickname_input.on_submit = () => this.connect();
    const account_address_input = this.account_address_input?.find_component(TextInput);
    if (account_address_input) account_address_input.on_submit = () => this.connect();
    const pwd_input = this.pwd_input?.find_component(TextInput);
    if (pwd_input) pwd_input.on_submit = () => void this.set_pwd();
    const chat_input = this.chat_input?.find_component(TextInput);
    if (chat_input) chat_input.on_submit = () => this.send_chat();

    this.set_input(this.address_input, 'lfj.gim.ink');
    this.set_input(this.account_address_input, 'lfj.gim.ink');
    this.set_connect_mode('guest');
    this.set_account_state('out');
    this.lfw.callbacks.add(this.lfw_cb);
    this.lfw.world.callbacks.add(this.world_cb);
    void this.init_nickname();
    this.set_mode('connect');
    this.render_rooms();
    this.render_chat();
    this.update_topbar();
    this.update_overlay();
    this.sync_status_visibility();
    window.requestAnimationFrame(() => this.apply_placeholders());
  }

  override on_resume(): void {
    window.requestAnimationFrame(() => {
      this.refresh_texts();
      this.apply_placeholders();
    });
  }

  /** 语言变化或从设置页返回时，重新生成本页所有动态文字 */
  private refresh_texts(): void {
    this.set_connect_mode(this.connect_mode);
    this.set_account_state(this.account_state);
    this.update_topbar();
    this.update_chat_target();
    this.render_rooms();
    this.render_room();
    this.render_chat();
    this.render_countdown();
    this.update_overlay();
    this.sync_status_visibility();
    this.layout_centered_rows();
  }

  override on_stop(): void {
    this.stop_auto_refresh();
    this.lfw.callbacks.del(this.lfw_cb);
    this.lfw.world.callbacks.del(this.world_cb);
    for (const { player, cb } of this.watched_players) player.callbacks.del(cb);
    this.watched_players.length = 0;
    const conn = this.conn;
    this.conn = null;
    this.room = undefined;
    this.driver = null;
    if (current_connection.conn === conn) current_connection.conn = null;
    current_connection.driver = null;
    if (conn) {
      conn.disable_rejoin();
      conn.close();
    }
    this.room_rows.length = 0;
    this.player_rows.length = 0;
    this.chat_rows.length = 0;
    this.chat_items.length = 0;
  }

  override update(dt: number): void {
    if (this.mode !== 'room' || !this.all_ready) return;
    this.countdown_elapsed += dt;
    const sec = Math.max(0, Math.ceil((COUNTDOWN_MS - this.countdown_elapsed) / 1000));
    if (sec !== this.countdown_sec) {
      this.countdown_sec = sec;
      this.render_countdown();
    }
    if (sec > 0 || this.countdown_sent) return;
    this.countdown_sent = true;
    if (this.is_owner()) this.conn?.send(MsgEnum.RoomStart, {}).catch((e) => this.set_status(this.error_text(e)));
  }

  /**
   * 改文字样式
   *
   * 渲染层只读 `ui.text.style`（`ui.style` 只是数据副本），且按 `TextInfo` 身份判断是否重绘，
   * 所以样式补丁必须写到 text.style 并换上一个新的 `TextInfo` 才会真正生效。
   */
  private paint(node: UINode | undefined, patch: Partial<IStyle>): void {
    if (!node) return;
    const txt = node.text;
    if (!txt) return;
    const src: Partial<IStyle> = txt.style ?? {};
    let changed = false;
    for (const key in patch) {
      if (src[key as keyof IStyle] !== patch[key as keyof IStyle]) { changed = true; break; }
    }
    if (!changed) return;
    const style = txt.style instanceof Style ? txt.style : new Style();
    if (!(txt.style instanceof Style)) style.assign(src);
    style.assign(patch);
    node.set_text(txt.text, style);
  }

  /** 当前渲染实际使用的样式 */
  private paint_style(node: UINode | undefined): IStyle | undefined {
    return node?.text?.style;
  }

  private bind(node: UINode | undefined, fn: () => void, sound: 'ok' | 'cancel' = 'ok'): void {
    if (!node) return;
    const hover_fill = '#eaf1ff';
    const hover_underline_color = '#ffffff';
    const hover_underline_width = 2;
    let hovered = false;
    let pressed = false;
    let fill: string | undefined;
    let underline_color: string | undefined;
    let underline_width: number | undefined;
    let sx = 1;
    let sy = 1;
    let sz = 1;
    const capture = (): void => {
      const style = this.paint_style(node);
      fill = style?.fill_style;
      underline_color = style?.underline_color;
      underline_width = style?.underline_width;
    };
    const restore = (): void => {
      if (!hovered) return;
      hovered = false;
      pressed = false;
      this.paint(node, {
        fill_style: fill,
        underline_color,
        underline_width,
      });
      node.set_scale(sx, sy, sz);
    };
    node.callbacks.add({
      on_pointer_enter: () => {
        if (node.disabled || hovered) return;
        hovered = true;
        capture();
        sx = node.scale.x;
        sy = node.scale.y;
        sz = node.scale.z;
        this.paint(node, {
          fill_style: hover_fill,
          underline_color: hover_underline_color,
          underline_width: hover_underline_width,
        });
        node.set_scale(sx * 1.06, sy * 1.06, sz);
      },
      on_pointer_leave: restore,
      on_hide: restore,
      on_pointer_cancel: restore,
      on_pointer_down: () => {
        if (node.disabled) return;
        pressed = true;
        node.set_scale(sx * 0.96, sy * 0.96, sz);
      },
      on_pointer_up: () => {
        if (!pressed) return;
        pressed = false;
        node.set_scale(
          hovered ? sx * 1.06 : sx,
          hovered ? sy * 1.06 : sy,
          sz
        );
      },
      on_click: () => {
        if (node.disabled) return;
        this.lfw.sounds.play_preset(sound);
        fn();
        if (!hovered) return;
        // 点击可能改变按钮的常态样式（如选中的标签页）；只把“非悬停态”的值记为待恢复状态
        const style = this.paint_style(node);
        if (style?.fill_style !== hover_fill) fill = style?.fill_style;
        if (
          style?.underline_color !== hover_underline_color ||
          style?.underline_width !== hover_underline_width
        ) {
          underline_color = style?.underline_color;
          underline_width = style?.underline_width;
        }
      },
    });
  }

  private t(key: string, ...args: (string | number)[]): string {
    let text = this.lfw.string(key);
    for (let i = 0; i < args.length; i++) text = text.split(`%${i + 1}`).join(`${args[i]}`);
    return text;
  }

  private set_text(node: UINode | undefined, text: string): void {
    if (!node) return;
    if (node.text?.text === text) return;
    node.set_text(text);
  }

  private input_value(node: UINode | undefined): string {
    if (!node) return '';
    const renderer = node.renderer as TInputRenderer;
    const value = renderer.get_input_value?.();
    if (typeof value === 'string') return value;
    return node.find_component(TextInput)?.text ?? '';
  }

  private set_input(node: UINode | undefined, value: string): void {
    if (!node) return;
    const text_input = node.find_component(TextInput);
    if (text_input) text_input.text = value;
    const renderer = node.renderer as TInputRenderer;
    renderer.set_input_value?.(value);
  }

  private set_placeholder(node: UINode | undefined, value: string): void {
    const renderer = node?.renderer as TInputRenderer | undefined;
    renderer?.set_input_placeholder?.(value);
  }

  private apply_placeholders(): void {
    this.set_placeholder(this.pwd_input, this.t('network.pwd_hint'));
    this.set_placeholder(this.chat_input, this.t('network.chat_placeholder'));
    for (const row of this.room_rows) {
      this.set_placeholder(row.children[ROOM_PWD_BG]?.children[0], this.t('network.enter_pwd'));
    }
  }

  private async init_nickname(): Promise<void> {
    let stored = '';
    try {
      stored = (await localforage.getItem<string>('nickname')) ?? '';
    } catch {
      stored = '';
    }
    if (!stored) {
      const players = [...this.lfw.players.values()];
      const player = players.find((p, i) => p.name?.trim() && p.name !== `${i + 1}`);
      stored = player?.name?.trim() || pick_default_nickname(this.lfw.canonical_lang(), navigator.language);
    }
    if (!this.input_value(this.nickname_input)) this.set_input(this.nickname_input, clamp_nickname(stored));
  }

  private set_connect_mode(mode: TConnectMode): void {
    this.connect_mode = mode;
    const guest = mode === 'guest';
    if (guest && this.account_state === 'pending') this.set_account_state('out');
    if (this.guest_body) this.guest_body.visible = guest;
    if (this.account_body) this.account_body.visible = !guest;
    if (this.tab_guest) {
      this.paint(this.tab_guest, {
        fill_style: guest ? '#ffffff' : '#a8b9ff',
        underline_color: guest ? '#ffffff' : void 0,
        underline_width: guest ? 1 : 0,
      });
    }
    if (this.tab_account) {
      this.paint(this.tab_account, {
        fill_style: guest ? '#a8b9ff' : '#ffffff',
        underline_color: guest ? void 0 : '#ffffff',
        underline_width: guest ? 0 : 1,
      });
    }
    this.update_account_chip();
    this.layout_centered_rows();
  }

  private set_account_state(state: TAccountState): void {
    this.account_state = state;
    if (state !== 'in') this.session_account = false;
    if (this.account_out) this.account_out.visible = state === 'out';
    if (this.account_pending) this.account_pending.visible = state === 'pending';
    if (this.account_in) this.account_in.visible = state === 'in';
    this.set_text(this.account_name_text, this.fit(this.account_name, 250, this.account_name_text));
    this.set_text(this.account_id_text, this.fit(`${this.account_id} · ${this.t('network.logged_in')}`, 320, this.account_id_text));
    this.set_text(this.account_avatar, [...this.account_name][0]?.toUpperCase() ?? '?');
    this.update_account_chip();
    this.update_topbar();
    this.layout_centered_rows();
  }

  private update_account_chip(): void {
    const show = this.session_account && this.account_state === 'in' && !!this.conn;
    if (this.account_chip_bg) this.account_chip_bg.visible = show;
    if (this.btn_logout) this.btn_logout.visible = show;
    this.set_text(this.account_chip, this.fit(this.t('network.account_chip', this.account_name), 76, this.account_chip));
  }

  private account_login(): void {
    this.set_account_state('pending');
    window.open('https://gim.ink', '_blank', 'noopener');
  }

  private account_logout(): void {
    this.set_account_state('out');
    this.session_account = false;
    this.add_notice(this.t('network.sys_logout'));
    this.update_account_chip();
  }

  private account_enter_lobby(): void {
    if (this.account_state !== 'in') return;
    this.session_account = true;
    this.connect();
  }

  private connect(): void {
    if (this.conn) return;
    const account = this.connect_mode === 'account';
    if (account && this.account_state !== 'in') {
      this.set_status(this.t('network.login_gim'));
      return;
    }
    const address_node = account ? this.account_address_input : this.address_input;
    const address = (this.input_value(address_node).trim() || 'lfj.gim.ink');
    const nickname = account
      ? clamp_nickname(this.account_name)
      : clamp_nickname(this.input_value(this.nickname_input).trim() || pick_default_nickname(this.lfw.canonical_lang(), navigator.language));
    if (!nickname) {
      this.set_status(this.t('network.nickname'));
      return;
    }
    if (!account) this.set_input(this.nickname_input, nickname);
    set_nickname(nickname);
    this.address = address;
    this.clear_status();
    this.set_connecting(true);
    const conn = new Connection(nickname);
    this.conn = conn;
    current_connection.conn = conn;
    conn.callbacks.add({
      on_register: () => {
        if (this.conn !== conn) return;
        this.set_connecting(false);
        this.clear_status();
        this.session_account = account;
        this.add_notice(this.t('network.sys_connected', address));
        this.update_account_chip();
        this.set_mode('rooms');
        this.watch_player_names(conn);
        this.sync_player_names(conn);
      },
      on_close: () => {
        if (this.conn !== conn) return;
        this.reset_connection();
      },
      on_error: (e) => {
        if (this.conn !== conn) return;
        const code = e?.lfw?.code;
        if (code === ErrCode.ChatTooFrequent || code === ErrCode.ChatMsgEmpty) return;
        this.set_status(this.error_text(e));
      },
      on_message: (resp) => {
        if (this.conn !== conn) return;
        this.on_message(resp, conn);
      },
      on_room_change: (room) => {
        if (this.conn !== conn) return;
        this.on_room_change(room);
      },
      on_rooms_change: (rooms) => {
        if (this.conn !== conn) return;
        this.rooms = rooms;
        this.render_rooms();
      },
      on_ping: (resp) => {
        if (this.conn !== conn) return;
        this.on_ping(resp, conn);
      },
      on_reconnecting: (attempt) => {
        if (this.conn !== conn) return;
        this.reconnecting = attempt;
        this.rejoin_failed = '';
        this.update_overlay();
      },
      on_rejoin: (resp) => {
        if (this.conn !== conn) return;
        this.reconnecting = 0;
        this.rejoin_failed = '';
        this.driver?.begin_rejoin(resp.resps ?? [], resp.next_seq ?? 0);
        this.update_overlay();
      },
      on_rejoin_failed: (reason) => {
        if (this.conn !== conn) return;
        this.reconnecting = 0;
        this.rejoin_failed = reason;
        this.update_overlay();
      },
    });
    conn.open(address);
  }

  private cancel_connect(): void {
    if (this.connecting) {
      this.disconnect();
      return;
    }
    this.close_page();
  }

  private close_page(): void {
    this.disconnect();
    this.node.pop_page();
  }

  private disconnect(): void {
    const conn = this.conn;
    this.reset_connection();
    if (conn) {
      conn.disable_rejoin();
      conn.close();
    }
  }

  private reset_connection(): void {
    this.conn = null;
    this.room = undefined;
    this.driver = null;
    if (current_connection.conn) current_connection.conn = null;
    current_connection.driver = null;
    for (const { player, cb } of this.watched_players) player.callbacks.del(cb);
    this.watched_players.length = 0;
    this.stop_auto_refresh();
    this.rooms = [];
    this.page = 0;
    this.rtts = {};
    this.chat_items.length = 0;
    this.leavers.length = 0;
    this.reconnecting = 0;
    this.rejoin_failed = '';
    this.all_ready = false;
    this.countdown_elapsed = 0;
    this.countdown_sec = 5;
    this.countdown_sent = false;
    this.session_account = false;
    if (this.account_state === 'pending') this.set_account_state('out');
    this.set_connecting(false);
    this.clear_status();
    this.set_mode('connect');
    this.render_rooms();
    this.render_chat();
    this.update_topbar();
    this.update_overlay();
  }

  private on_room_change(room: IRoomInfo | undefined): void {
    this.room = room;
    if (!room) {
      this.driver = null;
      current_connection.driver = null;
      this.rtts = {};
      this.leavers.length = 0;
      this.reconnecting = 0;
      this.rejoin_failed = '';
      this.all_ready = false;
      this.countdown_elapsed = 0;
      this.countdown_sec = 5;
      this.countdown_sent = false;
      this.update_overlay();
      this.set_mode(this.conn ? 'rooms' : 'connect');
      if (this.conn) this.request_rooms();
      return;
    }
    this.set_mode(room.started && this.driver ? 'started' : 'room');
    this.render_room();
  }

  private on_message(resp: TResp, conn: Connection): void {
    switch (resp.type) {
      case MsgEnum.Chat:
        this.add_chat(resp);
        break;
      case MsgEnum.ClientInfo:
        this.driver?.update_client(resp);
        break;
      case MsgEnum.RoomStart:
        this.start_room(resp, conn);
        break;
      case MsgEnum.Dataset:
        this.driver?.update_dataset(resp);
        break;
      case MsgEnum.KeyTick:
      case MsgEnum.Tick:
        this.driver?.on_tick(resp);
        break;
      case MsgEnum.ExitRoom:
      case MsgEnum.Kick:
        if (resp.type === MsgEnum.Kick && resp.client?.name) this.add_notice(this.t('network.sys_kicked', resp.client.name));
        this.on_leaver(resp.client?.id, resp.client?.name, conn);
        break;
      case MsgEnum.Abandon:
        this.on_abandon(resp.client?.id);
        break;
      case MsgEnum.RoomContinue:
        this.leavers.length = 0;
        this.driver?.resume();
        this.add_notice(this.t('network.sys_resumed'));
        this.update_overlay();
        break;
    }
  }

  private start_room(resp: IRespRoomStart, conn: Connection): void {
    this.room = conn.room;
    this.create_driver(resp).on_room_start(resp);
    conn.enable_rejoin(() => this.driver?.rejoin_seq ?? -1);
    this.reconnecting = 0;
    this.rejoin_failed = '';
    this.leavers.length = 0;
    this.all_ready = false;
    this.countdown_elapsed = 0;
    this.countdown_sec = 5;
    this.countdown_sent = false;
    this.set_mode('started');
    this.render_chat();
    this.update_overlay();
  }

  private create_driver(resp: IRespRoomStart): LFWNetworkDriver {
    const conn = this.conn;
    const mode: NetSyncMode = resp.sync_mode ?? 'lockstep';
    const driver = mode === 'delay'
      ? new DelayNetworkDriver(resp.input_delay ?? 2)
      : new LockstepNetworkDriver();
    driver.conn = conn;
    driver.lfw = this.lfw;
    this.driver = driver;
    current_connection.driver = driver;
    return driver;
  }

  private on_leaver(id?: string, name?: string, conn?: Connection): void {
    if (!this.driver || !id) return;
    if (id === conn?.client?.id) return;
    this.driver.suspend();
    if (!this.leavers.some(v => v.id === id)) this.leavers.push({ id, name: name || id, left: false });
    this.update_overlay();
  }

  private on_abandon(id?: string): void {
    if (!id || id === this.conn?.client?.id) return;
    const leaver = this.leavers.find(v => v.id === id);
    if (!leaver || leaver.left) return;
    leaver.left = true;
    this.update_overlay();
  }

  private continue_solo(): void {
    this.driver?.continue_solo();
    this.conn?.give_up();
    this.leavers.length = 0;
    this.reconnecting = 0;
    this.rejoin_failed = '';
    this.node.pop_page();
  }

  private back_lobby(): void {
    this.leavers.length = 0;
    this.reconnecting = 0;
    this.rejoin_failed = '';
    this.conn?.give_up();
    this.update_overlay();
  }

  private continue_game(): void {
    if (!this.is_owner()) return;
    this.conn?.send_nowait(MsgEnum.RoomContinue, {});
    this.leavers.length = 0;
    this.driver?.resume();
    this.update_overlay();
  }

  private async create_room(): Promise<void> {
    const conn = this.conn;
    if (!conn || this.busy) return;
    this.busy = true;
    try {
      const version = { lfw_version: LFW.VERSION_NAME, data_infos: await LFW.collect_data_infos() };
      await conn.send(MsgEnum.CreateRoom, { min_players: 1, max_players: 4, ...version });
      this.add_notice(this.t('network.sys_room_created', conn.room?.code || ''));
      this.clear_status();
    } catch (e) {
      this.set_status(this.error_text(e));
    } finally {
      this.busy = false;
    }
  }

  private async join_room(index: number): Promise<void> {
    const conn = this.conn;
    const room = this.page_rooms()[index];
    if (!conn || !room?.id || this.busy) return;
    const row = this.room_rows[index];
    const pwd = this.input_value(row?.children[ROOM_PWD_BG]?.children[0]).trim();
    if (room.need_pwd && !pwd) {
      this.set_status(this.t('network.enter_pwd'));
      return;
    }
    this.busy = true;
    try {
      const version = { lfw_version: LFW.VERSION_NAME, data_infos: await LFW.collect_data_infos() };
      await conn.send(MsgEnum.JoinRoom, { roomid: room.id, pwd: pwd || void 0, ...version });
      this.add_notice(this.t('network.sys_room_joined', room.code || room.id || ''));
      this.clear_status();
    } catch (e) {
      this.set_status(this.error_text(e));
    } finally {
      this.busy = false;
    }
  }

  private async leave_room(): Promise<void> {
    const conn = this.conn;
    if (!conn) return;
    this.countdown_elapsed = 0;
    this.countdown_sent = true;
    try {
      await conn.send(MsgEnum.ExitRoom, {});
    } catch (e) {
      this.set_status(this.error_text(e));
    }
  }

  private async toggle_ready(): Promise<void> {
    const conn = this.conn;
    const me = this.room?.clients?.find(v => v.id === conn?.client?.id);
    if (!conn || !me) return;
    try {
      await conn.send(MsgEnum.ClientReady, { ready: !me.ready });
    } catch (e) {
      this.set_status(this.error_text(e));
    }
  }

  private async set_sync(mode: RoomSyncMode): Promise<void> {
    const conn = this.conn;
    if (!conn || !this.is_owner() || this.room?.started) return;
    try {
      await conn.send(MsgEnum.RoomSync, { sync_mode: mode });
      this.add_notice(this.t('network.sys_sync_changed', this.sync_label(mode)));
    } catch (e) {
      this.set_status(this.error_text(e));
    }
  }

  private async set_pwd(): Promise<void> {
    const conn = this.conn;
    if (!conn || !this.is_owner()) return;
    const pwd = this.input_value(this.pwd_input).trim();
    try {
      await conn.send(MsgEnum.RoomPwd, { pwd });
      this.set_input(this.pwd_input, '');
    } catch (e) {
      this.set_status(this.error_text(e));
    }
  }

  private kick_row(index: number): void {
    const conn = this.conn;
    const member = this.room?.clients?.[index];
    if (!conn || !member?.id || !this.is_owner()) return;
    if (member.id === conn.client?.id) return;
    conn.send(MsgEnum.Kick, { client_id: member.id }).catch((e) => this.set_status(this.error_text(e)));
  }

  private send_chat(): void {
    const conn = this.conn;
    if (!conn) return;
    const now = Date.now();
    if (now < this.chat_cooldown_until) return;
    const text = this.input_value(this.chat_input).trim();
    if (!text) return;
    const target: TChatTarget = this.room ? 'room' : 'global';
    this.chat_cooldown_until = now + CHAT_COOLDOWN_MS;
    conn.send(MsgEnum.Chat, { target, text }).then(
      () => this.set_input(this.chat_input, ''),
      (e) => {
        const code = e?.lfw?.code;
        if (code === ErrCode.ChatTooFrequent) {
          this.chat_cooldown_until = Date.now() + CHAT_BACKOFF_MS;
          return;
        }
        this.set_status(this.error_text(e));
      },
    );
  }

  private add_chat(msg: IRespChat): void {
    if (this.room && msg.target === 'global') return;
    this.chat_items.push({ kind: 'msg', msg });
    if (this.chat_items.length > CHAT_MAX) this.chat_items.splice(0, this.chat_items.length - CHAT_MAX);
    this.render_chat();
  }

  private add_notice(text: string): void {
    if (!text) return;
    this.chat_items.push({ kind: 'sys', text });
    if (this.chat_items.length > CHAT_MAX) this.chat_items.splice(0, this.chat_items.length - CHAT_MAX);
    this.render_chat();
  }

  private request_rooms(): void {
    const conn = this.conn;
    if (!conn || this.mode !== 'rooms') return;
    conn.send(MsgEnum.ListRooms, {}, { loose: true }).catch(() => void 0);
  }

  private goto_page(page: number): void {
    const page_count = Math.max(1, Math.ceil(this.rooms.length / ROOM_PAGE_SIZE));
    this.page = Math.min(Math.max(0, page), page_count - 1);
    this.render_rooms();
  }

  private toggle_auto_refresh(): void {
    this.auto_refresh = !this.auto_refresh;
    this.update_topbar();
    this.start_auto_refresh();
  }

  private start_auto_refresh(): void {
    this.stop_auto_refresh();
    if (!this.auto_refresh || !this.conn || this.mode !== 'rooms') return;
    this.request_rooms();
    this.auto_timer = window.setInterval(() => this.request_rooms(), 3000);
  }

  private stop_auto_refresh(): void {
    if (!this.auto_timer) return;
    clearInterval(this.auto_timer);
    this.auto_timer = 0;
  }

  private watch_player_names(conn: Connection): void {
    for (const { player, cb } of this.watched_players) player.callbacks.del(cb);
    this.watched_players.length = 0;
    const cb: IPlayerInfoCallback = { on_name_changed: () => this.sync_player_names(conn) };
    for (const player of this.lfw.players.values()) {
      if (!player.local) continue;
      player.callbacks.add(cb);
      this.watched_players.push({ player, cb });
    }
  }

  private sync_player_names(conn: Connection): void {
    if (this.conn !== conn) return;
    const names: string[] = [];
    for (const [, player] of this.lfw.players) {
      if (names.length >= 8) break;
      names.push(player.name);
    }
    conn.set_players(names);
  }

  private on_ping(resp: { client?: string; rtt?: number }, conn: Connection): void {
    const id = resp.client;
    if (!id) return;
    const rtt = id === conn.client?.id ? conn.rtt : resp.rtt;
    if (!rtt || this.rtts[id] === rtt) return;
    this.rtts[id] = rtt;
    this.update_topbar();
    if (this.mode === 'room') {
      this.render_room_players();
      this.render_recommend();
    }
  }

  private is_owner(): boolean {
    return !!this.conn?.client?.id && this.room?.owner?.id === this.conn.client.id;
  }

  private page_rooms(): IRoomInfo[] {
    return this.rooms.slice(this.page * ROOM_PAGE_SIZE, (this.page + 1) * ROOM_PAGE_SIZE);
  }

  private room_count_text(room: IRoomInfo): string {
    return `${room.clients?.length ?? 0}/${room.max_players ?? 4}`;
  }

  private version_short(version: string): string {
    return version.split(' ')[0];
  }

  private sync_label(mode?: RoomSyncMode): string {
    if (mode === 'lockstep') return this.t('network.sync_lockstep');
    if (mode === 'delay') return this.t('network.sync_delay');
    return this.t('network.sync_auto');
  }

  private set_sync_style(node: UINode | undefined, active: boolean): void {
    this.paint(node, {
      fill_style: active ? '#ffffff' : '#a8b9ff',
      underline_color: active ? '#ffffff' : void 0,
      underline_width: active ? 1 : 0,
    });
  }

  private truncate(text: string, max: number): string {
    const chars = [...text];
    if (chars.length <= max) return text;
    return chars.slice(0, max - 1).join('') + '…';
  }

  private measure_ctx: CanvasRenderingContext2D | undefined;

  /** 节点字体的文本宽度（含渲染器默认的左右各 2px padding） */
  private measure_text_width(text: string, node?: UINode): number {
    if (!text) return 0;
    const ctx = this.measure_ctx ??= document.createElement('canvas').getContext('2d')!;
    ctx.font = node?.style.font ?? 'normal 9px system-ui';
    let w = 0;
    for (const line of text.split('\n')) w = Math.max(w, ctx.measureText(line).width);
    return w + 4;
  }

  /** 按像素宽度截断单行文本，避免不同语言下文字溢出并压到相邻控件 */
  private fit(text: string, max_w: number, node?: UINode): string {
    if (!text || this.measure_text_width(text, node) <= max_w) return text;
    const chars = [...text];
    const ellipsis = '…';
    const ellipsis_w = this.measure_text_width(ellipsis, node);
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const w = this.measure_text_width(chars.slice(0, mid).join(''), node);
      if (w + ellipsis_w <= max_w) lo = mid;
      else hi = mid - 1;
    }
    return chars.slice(0, lo).join('').trimEnd() + ellipsis;
  }

  /** 多行文本：逐行按像素截断，并限制行数，避免向下压到按钮 */
  private fit_lines(text: string, max_w: number, node: UINode | undefined, max_lines: number): string {
    const lines = text.split('\n').map(v => this.fit(v, max_w, node));
    if (lines.length <= max_lines) return lines.join('\n');
    const ret = lines.slice(0, max_lines);
    ret[max_lines - 1] = this.fit(`${ret[max_lines - 1]}…`, max_w, node);
    return ret.join('\n');
  }

  /** 把一组按钮按实际文字宽度水平居中排列（不同语言下文字宽度不同） */
  private center_row(nodes: (UINode | undefined)[], center_x: number, gap: number): void {
    const items = nodes.filter((n): n is UINode => !!n && n.visible);
    if (!items.length) return;
    const widths = items.map(n => n.w + (n.text ? 4 : 0));
    const total = widths.reduce((a, b) => a + b, 0) + gap * (items.length - 1);
    let x = center_x - total / 2;
    for (let i = 0; i < items.length; i++) {
      const n = items[i];
      // 保持原有锚点（尤其是带子节点的输入框背景），只按“左边缘”排布
      const pad = n.text ? 2 : 0;
      n.move_to(x + pad + n.center.x * n.w, n.y, n.z);
      x += widths[i] + gap;
    }
  }

  private layout_centered_rows(): void {
    this.center_row([this.btn_connect, this.btn_connect_cancel], 200, 24);
    this.center_row([this.btn_account_login, this.btn_account_cancel_0], 200, 40);
    this.center_row([this.btn_account_mock, this.btn_account_cancel_1], 200, 40);
    this.center_row([this.btn_account_enter, this.btn_account_logout], 200, 40);
    this.center_row([this.btn_prev, this.page_label, this.btn_next], 241, 16);
    this.center_row([this.btn_leave, this.btn_ready], 241, 24);
    this.center_row([this.btn_chat_target, this.chat_input?.parent, this.btn_send], 142, 12);
    this.center_row([this.btn_continue_solo, this.btn_back_lobby], 172, 20);
    if (this.btn_continue_game?.visible) {
      this.btn_continue_game.cx = 0.5;
      this.btn_continue_game.move_to(172, this.btn_continue_game.y, this.btn_continue_game.z);
    }
  }

  private set_status(text: string): void {
    this.status = text;
    if (this.mode === 'connect') {
      this.set_text(this.connect_status, this.fit(text, 370, this.connect_status));
      this.set_text(this.rooms_status, '');
      this.set_text(this.room_status, '');
    } else if (this.mode === 'room' || this.mode === 'started') {
      this.set_text(this.room_status, this.fit(text, 440, this.room_status));
      this.set_text(this.connect_status, '');
      this.set_text(this.rooms_status, '');
    } else {
      this.set_text(this.rooms_status, this.fit(text, 440, this.rooms_status));
      this.set_text(this.connect_status, '');
      this.set_text(this.room_status, '');
    }
    this.sync_status_visibility();
  }

  private clear_status(): void {
    this.status = '';
    this.set_text(this.connect_status, '');
    this.set_text(this.rooms_status, '');
    this.set_text(this.room_status, '');
    this.sync_status_visibility();
  }

  private sync_status_visibility(): void {
    if (this.connect_status) this.connect_status.visible = !!this.connect_status.text?.text;
    if (this.rooms_status) this.rooms_status.visible = !!this.rooms_status.text?.text;
    if (this.room_status) this.room_status.visible = !!this.room_status.text?.text;
  }

  private error_text(e: unknown): string {
    const err = e as { lfw?: { error?: string }; message?: string };
    const text = err?.lfw?.error || err?.message || String(e ?? '');
    return this.truncate(text, 64);
  }

  private set_connecting(value: boolean): void {
    this.connecting = value;
    this.set_text(this.btn_connect, this.t(value ? 'network.connecting' : 'network.connect'));
    if (this.btn_connect) this.btn_connect.disabled = value;
    if (this.btn_account_enter) this.btn_account_enter.disabled = value;
    if (this.btn_account_login) this.btn_account_login.disabled = value;
    this.layout_centered_rows();
  }

  private set_mode(mode: TMode): void {
    if (this.mode !== mode) {
      this.mode = mode;
      this.clear_status();
      this.stop_auto_refresh();
      if (mode === 'rooms') this.start_auto_refresh();
    }
    this.update_visibility();
    this.update_topbar();
    this.update_chat_target();
    if (mode === 'rooms') this.render_rooms();
    if (mode === 'room') this.render_room();
    if (mode !== 'connect') this.render_chat();
    this.layout_centered_rows();
  }

  private update_visibility(): void {
    const mode = this.mode;
    const connected = !!this.conn;
    if (this.bg) this.bg.visible = mode !== 'started';
    if (this.dim) this.dim.visible = mode === 'connect';
    if (this.topbar) this.topbar.visible = mode === 'rooms' || mode === 'room';
    if (this.connect_panel) this.connect_panel.visible = mode === 'connect';
    if (this.rooms_panel) this.rooms_panel.visible = mode === 'rooms';
    if (this.room_panel) this.room_panel.visible = mode === 'room';
    if (this.chat_panel) this.chat_panel.visible = connected && mode !== 'connect';
  }

  private update_topbar(): void {
    this.update_account_chip();
    const conn = this.conn;
    if (!conn || this.mode === 'connect') return;
    const address = this.address || conn.url || '';
    const info = this.mode === 'room' && this.room
      ? `${this.room.title || this.t('network.room')}\u3000·\u3000#${this.room.code ?? ''}\u3000·\u3000${this.session_account ? '' : `${address}\u3000·\u3000`}${conn.rtt}ms`
      : `${this.t(this.session_account ? 'network.account' : 'network.guest')}\u3000·\u3000${address}\u3000·\u3000${conn.rtt}ms`;
    this.set_text(this.top_title, this.fit(this.t(this.mode === 'room' ? 'network.room' : 'network.online'), 68, this.top_title));
    this.set_text(this.top_sub, this.fit(info, 224, this.top_sub));
    if (this.btn_create) this.btn_create.visible = this.mode === 'rooms';
    if (this.btn_refresh) this.btn_refresh.visible = this.mode === 'rooms';
    if (this.btn_auto) {
      this.btn_auto.visible = this.mode === 'rooms';
      this.paint(this.btn_auto, {
        fill_style: this.auto_refresh ? '#ffffff' : '#a8b9ff',
        underline_color: this.auto_refresh ? '#ffffff' : void 0,
        underline_width: this.auto_refresh ? 1 : 0,
      });
    }
    if (this.btn_disconnect) this.btn_disconnect.visible = this.mode === 'rooms';
    if (this.btn_room_refresh) this.btn_room_refresh.visible = this.mode === 'room';
    if (this.btn_leave_top) this.btn_leave_top.visible = this.mode === 'room';
  }

  private update_chat_target(): void {
    const room = !!this.room;
    const text = `[${this.t(room ? 'network.room_chat' : 'network.global')}]`;
    const color = room ? '#ff7b00' : '#ffffff';
    this.set_text(this.chat_target, this.fit(text, 190, this.chat_target));
    this.set_text(this.btn_chat_target, this.fit(text, 52, this.btn_chat_target));
    if (this.chat_target) this.paint(this.chat_target, { fill_style: color });
    if (this.btn_chat_target) this.paint(this.btn_chat_target, { fill_style: color });
    this.layout_centered_rows();
  }

  private render_rooms(): void {
    const page_count = Math.max(1, Math.ceil(this.rooms.length / ROOM_PAGE_SIZE));
    if (this.page > page_count - 1) this.page = page_count - 1;
    const rooms = this.page_rooms();
    this.set_text(this.rooms_total, this.fit(this.t('network.rooms_total', this.rooms.length), 350, this.rooms_total));
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
      this.set_text(row.children[ROOM_NAME], this.fit(room.title || `${this.t('network.room')} ${room.code ?? ''}`, 146, row.children[ROOM_NAME]));
      this.set_text(row.children[ROOM_CODE], room.code ? `#${room.code}` : '');
      const badge_bg = row.children[ROOM_BADGE_BG];
      const badge = badge_bg?.children[0];
      this.set_text(badge, this.fit(room.started ? this.t('network.running') : this.t('network.waiting'), 44, badge));
      if (badge_bg) badge_bg.color = room.started ? '#4ade8033' : '#ffffff1f';
      if (badge) this.paint(badge, { fill_style: room.started ? '#86efac' : '#ffffffc7' });
      const lock_bg = row.children[ROOM_LOCK_BG];
      if (lock_bg) lock_bg.visible = !!room.need_pwd;
      const pwd_bg = row.children[ROOM_PWD_BG];
      if (pwd_bg) pwd_bg.visible = !!room.need_pwd;
      const join = row.children[ROOM_JOIN];
      if (join) join.visible = !room.started;
      this.set_text(row.children[ROOM_OWNER], this.fit(`${this.t('network.owner')} ${room.owner?.name || '-'}`, 144, row.children[ROOM_OWNER]));
      const meta = [
        `${this.t('network.player_count')} ${this.room_count_text(room)}`,
        this.sync_label(room.sync_mode),
        room.lfw_version ? `LFW ${this.version_short(room.lfw_version)}` : '',
        room.data_infos?.length ? `${this.t('network.data_package')}×${room.data_infos.length}` : '',
      ].filter(Boolean).join('\u3000·\u3000');
      this.set_text(row.children[ROOM_META], this.fit(meta, 300, row.children[ROOM_META]));
    }
    this.layout_centered_rows();
  }

  private render_room(): void {
    const room = this.room;
    if (!room) return;
    const clients = room.clients ?? [];
    const max = room.max_players ?? 4;
    const me = clients.find(v => v.id === this.conn?.client?.id);
    const owner = this.is_owner();
    this.set_text(this.room_title, this.fit(room.title || `${this.t('network.room')} ${room.code ?? ''}`, 220, this.room_title));
    this.set_text(this.room_code, room.code ? `#${room.code}` : '');
    this.set_text(this.room_badge, this.fit(room.started ? this.t('network.running') : this.t('network.waiting'), 54, this.room_badge));
    if (this.room_badge_bg) this.room_badge_bg.color = room.started ? '#4ade8033' : '#ffffff1f';
    if (this.room_badge) this.paint(this.room_badge, { fill_style: room.started ? '#86efac' : '#ffffffc7' });
    this.set_text(this.room_count, this.fit(`${this.t('network.player_count')} ${clients.length}/${max}`, 104, this.room_count));
    const mode = room.sync_mode ?? 'auto';
    this.set_sync_style(this.sync_auto, mode === 'auto');
    this.set_sync_style(this.sync_lockstep, mode === 'lockstep');
    this.set_sync_style(this.sync_delay, mode === 'delay');
    if (this.room_lfw) this.room_lfw.visible = !!room.lfw_version;
    this.set_text(this.room_lfw, this.fit(room.lfw_version ? `${this.t('network.lfw_version')}: ${this.version_short(room.lfw_version)}` : '', 440, this.room_lfw));
    const infos = room.data_infos ?? [];
    this.set_text(this.room_data_0, this.fit(infos[0] ? `${this.t('network.data_package')}[1] ${this.data_info_text(infos[0])}` : '', 440, this.room_data_0));
    this.set_text(this.room_data_1, this.fit(infos[1] ? `${this.t('network.data_package')}[2] ${this.data_info_text(infos[1])}` : '', 440, this.room_data_1));
    if (this.room_data_0) this.room_data_0.visible = !!infos[0];
    if (this.room_data_1) this.room_data_1.visible = !!infos[1];
    if (this.pwd_label) this.pwd_label.visible = owner;
    if (this.pwd_bg) this.pwd_bg.visible = owner;
    if (this.btn_set_pwd) this.btn_set_pwd.visible = owner;
    this.set_text(this.pwd_hint, this.fit(this.t('network.owner_only'), 150, this.pwd_hint));
    this.render_room_players();
    if (this.empty_slot) {
      this.empty_slot.visible = clients.length < max;
      this.empty_slot.move_to(241, 158 + clients.length * PLAYER_ROW_STEP + PLAYER_ROW_STEP / 2, 0);
    }
    if (this.btn_leave) this.btn_leave.visible = true;
    if (this.btn_ready) {
      this.btn_ready.visible = !!me;
      this.set_text(this.btn_ready, this.fit(this.t(me?.ready ? 'network.cancel_ready' : 'network.ready'), 100, this.btn_ready));
    }
    const all_ready = clients.length >= (room.min_players ?? 1) && clients.length > 0 && clients.every(v => !!v.ready);
    if (all_ready !== this.all_ready) {
      this.all_ready = all_ready;
      this.countdown_elapsed = 0;
      this.countdown_sec = 5;
      this.countdown_sent = false;
    }
    this.render_countdown();
    this.render_recommend();
    this.layout_centered_rows();
  }

  private data_info_text(info?: { type?: string; title?: string; version?: number; md5?: string }): string {
    if (!info) return '';
    const type = info.type ? `[${info.type}] ` : '';
    const name = info.title || '';
    const version = typeof info.version === 'number' ? ` v${info.version}` : '';
    const md5 = info.md5 ? ` · ${info.md5.slice(0, 8)}` : '';
    return this.truncate(`${type}${name}${version}${md5}`, 52);
  }

  private render_room_players(): void {
    const room = this.room;
    if (!room) return;
    const clients = room.clients ?? [];
    const me = clients.find(v => v.id === this.conn?.client?.id);
    const owner = this.is_owner();
    for (let i = 0; i < this.player_rows.length; i++) {
      const row = this.player_rows[i];
      const member = clients[i];
      row.visible = !!member;
      if (!member) continue;
      this.set_text(row.children[PLAYER_NAME], this.fit(member.name || member.id || '-', 150, row.children[PLAYER_NAME]));
      const tags: string[] = [];
      if (member.id === me?.id) tags.push(`(${this.t('network.you')})`);
      if (member.id === room.owner?.id) tags.push(`(${this.t('network.owner')})`);
      this.set_text(row.children[PLAYER_TAGS], this.fit(tags.join(' '), 80, row.children[PLAYER_TAGS]));
      const rtt = member.id ? this.rtts[member.id] : 0;
      this.set_text(row.children[PLAYER_RTT], rtt ? `${rtt}ms` : '-');
      const state = row.children[PLAYER_STATE];
      this.set_text(state, this.fit(this.t(member.ready ? 'network.ready_done' : 'network.not_ready'), 88, state));
      if (state) this.paint(state, { fill_style: member.ready ? '#9b9bff' : '#ffffff73' });
      const kick = row.children[PLAYER_KICK];
      if (kick) kick.visible = owner && member.id !== me?.id;
    }
  }

  private render_recommend(): void {
    const room = this.room;
    if (!room) return;
    const clients = room.clients ?? [];
    let worst = 0;
    for (const member of clients) worst = Math.max(worst, this.rtts[member.id ?? ''] ?? 0);
    if (!worst) {
      this.set_text(this.recommend, '');
      return;
    }
    const rec = recommend_sync(worst);
    const label = rec.sync_mode === 'delay'
      ? `${this.t('network.sync_delay')} K=${rec.input_delay}`
      : this.t('network.sync_lockstep');
    this.set_text(this.recommend, this.fit(`${this.t('network.recommend')}: ${label} (${Math.round(worst)}ms)`, 225, this.recommend));
  }

  private render_countdown(): void {
    if (!this.countdown) return;
    this.countdown.visible = this.all_ready;
    if (!this.all_ready) return;
    this.set_text(this.countdown, this.fit(this.countdown_sec > 0
      ? this.t('network.countdown', this.countdown_sec)
      : this.t('network.enter_game'), 370, this.countdown));
  }

  private render_chat(): void {
    const items = this.chat_items.filter(item => {
      if (item.kind === 'sys') return true;
      return !this.room || item.msg.target !== 'global';
    }).slice(-CHAT_SHOW);
    for (let i = 0; i < this.chat_rows.length; i++) {
      const row = this.chat_rows[i];
      const item = items[i];
      row.visible = !!item;
      if (!item) continue;
      if (item.kind === 'sys') {
        this.set_text(row, this.fit(item.text, 264, row));
        this.paint(row, { fill_style: '#9b9bff' });
        continue;
      }
      const msg = item.msg;
      const sender = msg.sender?.name || '?';
      this.set_text(row, this.fit(`${sender}: ${msg.text ?? ''}`, 264, row));
      this.paint(row, { fill_style: msg.target === 'private' ? '#C9A0FF' : msg.target === 'room' ? '#ff7b00' : '#ffffff' });
    }
  }

  private update_overlay(): void {
    const failed = !!this.rejoin_failed;
    const reconnecting = this.reconnecting > 0;
    const paused = !failed && !reconnecting && this.leavers.length > 0;
    const show = failed || reconnecting || paused;
    if (this.overlay_dim) this.overlay_dim.visible = show;
    if (this.overlay_panel) this.overlay_panel.visible = show;
    if (!show) return;
    if (failed) {
      this.set_text(this.overlay_title, this.fit(this.t('network.reconnect_failed'), 330, this.overlay_title));
      this.set_text(this.overlay_line_0, this.fit(this.t('network.reconnect_failed_hint'), 330, this.overlay_line_0));
    } else if (reconnecting) {
      this.set_text(this.overlay_title, this.fit(this.t('network.reconnecting'), 330, this.overlay_title));
      this.set_text(this.overlay_line_0, this.fit(this.t('network.reconnect_attempt', this.reconnecting), 330, this.overlay_line_0));
    } else {
      this.set_text(this.overlay_title, this.fit(this.t('network.paused'), 330, this.overlay_title));
      const lines = this.leavers.map(v => this.t(v.left ? 'network.player_left' : 'network.player_disconnected', v.name));
      this.set_text(this.overlay_line_0, this.fit_lines(lines.join('\n'), 330, this.overlay_line_0, 3));
    }
    this.set_text(this.overlay_line_1, '');
    if (this.btn_continue_solo) this.btn_continue_solo.visible = failed || reconnecting;
    if (this.btn_back_lobby) this.btn_back_lobby.visible = failed || reconnecting;
    if (this.btn_continue_game) this.btn_continue_game.visible = paused && this.is_owner();
    this.layout_centered_rows();
  }
}
