import type { LFW } from "./LFW";
import type { ILFWCallback } from "./LFW/ILFWCallback";
import { DanmuGameLogic, type IDanmuViewerStat } from "./LFW/ui/component/DanmuGameLogic";
import type { UIComponent } from "./LFW/ui/component/UIComponent";

const LOG_TAG = "[danmu-bridge]";
const DEFAULT_URL = "ws://127.0.0.1:8066";
const RECONNECT_MS = 3000;
const STATE_INTERVAL_MS = 5000;

const DEFAULT_HINTS: string[] = [
  "发「1」或「报名」加入战斗",
  "发角色名换人：{picks}",
  "发「加油」或「666」应援回血",
  "进入直播间自动上场",
  "战死要重新发弹幕才能再上",
];

const DEFAULT_PICKS: string[] = [
  "拳王", "豆腐", "忍者", "冰佬", "奶妈",
  "弓手", "铁甲", "火人", "腿王", "木头",
];

const PICKS_TOKEN = "{picks}";
const PICKS_COUNT = 3;

function pick_random(pool: readonly string[], count: number): string[] {
  const copy = [...pool];
  for (let i = 0; i < count && i < copy.length; ++i) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy.slice(0, count);
}

class DanmuHints {
  texts: readonly string[] = DEFAULT_HINTS;
  picks: readonly string[] = DEFAULT_PICKS;
  private _tick = -1;
  private _text = "";
  set(texts?: readonly string[], picks?: readonly string[]): void {
    if (texts?.length) this.texts = texts;
    if (picks?.length) this.picks = picks;
    this._tick = -1;
  }
  at(tick: number): string {
    if (tick === this._tick) return this._text;
    this._tick = tick;
    const len = this.texts.length;
    const raw = len ? this.texts[((tick % len) + len) % len] : "";
    this._text = raw.includes(PICKS_TOKEN)
      ? raw.replace(PICKS_TOKEN, pick_random(this.picks, PICKS_COUNT).join("、"))
      : raw;
    return this._text;
  }
}

export const danmu_hints = new DanmuHints();

interface IBridgeAction {
  type?: string;
  uid?: string;
  name?: string;
  oid?: string;
  texts?: string[];
  picks?: string[];
}

function get_bridge_url(): string | null {
  const m = /[?&#]DANMU_WS=([^&#]+)/i.exec(window.location.href);
  if (!m) return null;
  const v = decodeURIComponent(m[1]).trim();
  if (!v) return null;
  if (/^wss?:\/\//i.test(v)) return v;
  if (v === "1" || v.toLowerCase() === "true") return DEFAULT_URL;
  return `ws://${v}`;
}

class DanmuBridge implements ILFWCallback {
  private logic: DanmuGameLogic | null = null;
  private ws: WebSocket | null = null;
  private reconnect_timer: ReturnType<typeof setTimeout> | null = null;
  private state_timer: ReturnType<typeof setInterval> | null = null;
  private warned = false;
  private stats_tick = 0;

  constructor(readonly lfw: LFW, readonly url: string) {
    lfw.callbacks.add(this);
    this.connect();
    this.state_timer = setInterval(() => this.report_state(), STATE_INTERVAL_MS);
  }
  on_component_broadcast(component: UIComponent, msg: string): void {
    if (msg === DanmuGameLogic.BROADCAST_ON_START) this.logic = component as DanmuGameLogic;
    else if (msg === DanmuGameLogic.BROADCAST_ON_STOP) this.logic = null;
  }
  release(): void {
    this.lfw.callbacks.del(this);
    if (this.reconnect_timer !== null) clearTimeout(this.reconnect_timer);
    if (this.state_timer !== null) clearInterval(this.state_timer);
    this.ws?.close();
    this.ws = null;
  }
  private connect(): void {
    const ws = this.ws = new WebSocket(this.url);
    ws.onopen = () => {
      this.warned = false;
      console.log(LOG_TAG, `已连接到弹幕桥 ${this.url}`);
    };
    ws.onmessage = (e) => this.handle(String(e.data));
    ws.onclose = () => {
      if (this.ws !== ws) return;
      this.ws = null;
      if (!this.warned) {
        this.warned = true;
        console.warn(LOG_TAG, `弹幕桥未连接（${this.url}），${RECONNECT_MS / 1000} 秒后重试`);
      }
      this.reconnect_timer = setTimeout(() => this.connect(), RECONNECT_MS);
    };
  }
  private handle(raw: string): void {
    let action: IBridgeAction;
    try {
      action = JSON.parse(raw) as IBridgeAction;
    } catch {
      return;
    }
    if (action.type === "hint") {
      danmu_hints.set(action.texts, action.picks);
      return;
    }
    const logic = this.logic;
    if (!logic) return;
    switch (action.type) {
      case "join":
        if (action.uid && action.name) {
          const joined = logic.join({ uid: action.uid, name: action.name, oid: action.oid });
          if (!joined) logic.switch(action.uid, action.oid);
        }
        break;
      case "enter":
        if (action.uid && action.name) logic.enter({ uid: action.uid, name: action.name });
        break;
      case "cheer":
        if (action.uid) logic.cheer(action.uid);
        break;
      case "touch":
        if (action.uid) logic.touch(action.uid);
        break;
      case "leave":
        if (action.uid) logic.leave(action.uid);
        break;
    }
  }
  private report_state(): void {
    const { ws, logic } = this;
    if (!ws || ws.readyState !== WebSocket.OPEN || !logic) return;
    const stats = logic.viewer_stats();
    ws.send(JSON.stringify({
      type: "state",
      mode: logic.mode,
      queue: logic.join_queue.size,
      on_stage: stats.filter((v) => v.alive).length,
      stage: logic.stage_name,
    }));
    if (++this.stats_tick % 2 === 0) this.report_stats(ws, logic, stats);
  }
  private report_stats(ws: WebSocket, logic: DanmuGameLogic, stats: IDanmuViewerStat[]): void {
    ws.send(JSON.stringify({
      type: "stats",
      mode: logic.mode,
      stats: stats.map((v) => ({
        uid: v.uid,
        name: v.name,
        spawns: v.spawns,
        kills: v.kills,
        deads: v.deads,
        damages: v.damages,
        cheers: v.cheers,
      })),
    }));
  }
}

const installed = new WeakSet<LFW>();

export function install_danmu_bridge_if_requested(lfw: LFW): void {
  const url = get_bridge_url();
  if (!url) return;
  lfw.danmu_available = true;
  if (installed.has(lfw)) return;
  installed.add(lfw);
  new DanmuBridge(lfw, url);
}
