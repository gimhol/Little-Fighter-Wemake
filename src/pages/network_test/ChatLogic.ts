import { chat_store, type TChatItem, type TChatTarget } from "@/Net/chat_store";
import type { IUIKeyEvent } from "@/LFW/ui/IUIKeyEvent";
import { Flex } from "@/LFW/ui/component/Flex";
import { TextInput } from "@/LFW/ui/component/TextInput";
import { UIComponent } from "@/LFW/ui/component/UIComponent";
import type { UINode } from "@/LFW/ui/UINode";

const PEEK_HOLD_MS = 10000;
const PEEK_FADE_MS = 1500;
const ROW_W = 442;
const ROW_H = 18;
const ROW_GAP = 1;
const NAME_GAP = 4;
const LIST_LEFT = 10;
const LIST_BOTTOM_TYPING = 420;
const LIST_BOTTOM_PEEK = 446;
const LIST_MAX_H = 250;
/** 单条消息最多占几行（超出部分用省略号） */
const MAX_LINES = 3;
/** 名字最多占用的行宽比例，避免超长昵称把正文挤没 */
const NAME_MAX_RATIO = 0.55;
const BG_W = 640;
/** 消息遮罩比消息列表多出的高度（收在输入框分割线之上） */
const BG_EXTRA_H = 4;
const ELLIPSIS = "…";
/** 不能出现在行首的字符（中文收尾标点、英文标点等） */
const NO_LINE_START = "，。、！？；：）】」』》〉〕｝”’…‥·,.!?;:)]}>%";
/** 不能出现在行尾的字符（中文开头标点） */
const NO_LINE_END = "（【「『《〈〔｛“‘([{<";
const BODY_COLOR = "#f4f4f4";
const SYSTEM_COLOR = "#ffd76e";
const CHANNEL_COLOR: Record<TChatTarget, string> = { room: "#7fc4ff", global: "#ffb44d" };

type TRow = { name: UINode; body: UINode };

type TInputRenderer = {
  get_input_value?(): string;
  set_input_value?(value: string): void;
  focus_input?(): void;
  blur_input?(): void;
};

export class ChatLogic extends UIComponent {
  static override readonly TAGS: string[] = ["ChatLogic"];

  private _rows: TRow[] = [];
  private _list?: UINode;
  private _input_node?: UINode;
  private _input?: TextInput;
  private _hold = 0;
  private _alpha = 1;
  private _closing = false;
  private _seen = -1;
  private _target: TChatTarget | undefined;
  private _focus_pending = false;
  private _focus_frames = 0;

  override on_start(): void {
    const q = (id: string) => this.node.search_node(id) ?? undefined;
    this.node.pointer_through = true;
    this._list = q("chat_rows");
    this._rows = (this._list?.children ?? []).map((row) => ({
      name: row.children[0],
      body: row.children[1],
    }));
    this._input_node = q("chat_input");
    this._input = this._input_node?.find_component(TextInput) ?? undefined;
    if (this._input) {
      this._input.on_submit = () => this.send();
      this._input.on_cancel = () => this.close();
    }

    q("chat_close")?.callbacks.add({ on_click: () => this.close() });
    q("chat_send")?.callbacks.add({ on_click: () => this.send() });
    q("chat_input_bg")?.callbacks.add({ on_click: () => this.focus_input() });

    this._hold = chat_store.peek ? PEEK_HOLD_MS : 0;
    this.set_input_visible(!chat_store.peek);
    this._seen = chat_store.items.length;
    this.render();
    this._focus_pending = !chat_store.peek;
    this._focus_frames = 0;
  }

  override update(dt: number): void {
    if (this._closing) return;
    if (this._focus_pending) {
      if (this._input?.node.focused || ++this._focus_frames > 30) this._focus_pending = false;
      else this.input_renderer()?.focus_input?.();
    }
    if (chat_store.items.length !== this._seen) {
      this._seen = chat_store.items.length;
      this._hold = PEEK_HOLD_MS;
      this._alpha = 1;
      this.node.set_opacity(1);
      this.render();
    } else if (chat_store.target !== this._target) {
      // 进/出房间后发送频道会变，标签需要跟着刷新
      this.render();
    }
    if (!chat_store.peek) return;
    if (this._hold > 0) {
      this._hold -= dt;
      return;
    }
    this._alpha -= dt / PEEK_FADE_MS;
    this.node.set_opacity(Math.max(0, this._alpha));
    if (this._alpha <= 0) this.close();
  }

  override on_key_down(e: IUIKeyEvent): void {
    if (e.key !== "escape" || chat_store.peek) return;
    this.close();
    e.stop_immediate_propagation();
  }

  send(): void {
    if (!this._input) return;
    const renderer = this.input_renderer();
    const text = renderer?.get_input_value?.() ?? this._input.text;
    if (!chat_store.send(text)) {
      this.close();
      return;
    }
    this._input.text = "";
    renderer?.set_input_value?.("");
    chat_store.peek = true;
    this._hold = PEEK_HOLD_MS;
    this._alpha = 1;
    this.set_input_visible(false);
    this.render();
  }

  close(): void {
    if (this._closing) return;
    this._closing = true;
    this.blur_input();
    this.node.set_opacity(1);
    this.node.pop_page();
  }

  /** 点击输入行任意位置都让输入框获得焦点（peek 状态下顺带唤回输入行） */
  focus_input(): void {
    if (chat_store.peek) {
      chat_store.peek = false;
      this._hold = 0;
      this._alpha = 1;
      this.node.set_opacity(1);
      this.set_input_visible(true);
      this.render();
    }
    this._focus_pending = true;
    this._focus_frames = 0;
  }

  private input_renderer(): TInputRenderer | undefined {
    return this._input_node?.renderer as TInputRenderer | undefined;
  }

  private channel_label(target: TChatTarget): string {
    const key = target === "room" ? "network.room_chat" : "network.global";
    return `[${this.lfw.string(key)}]`;
  }

  private set_input_visible(visible: boolean): void {
    this.node.search_node("chat_bg")?.set_visible(visible);
    this.node.search_node("chat_input_bg")?.set_visible(visible);
    this.node.search_node("chat_input_divider")?.set_visible(visible);
    if (!visible) this.blur_input();
    else if (!chat_store.peek) this._focus_pending = true;
  }

  private blur_input(): void {
    this._input?.node.blur();
    this._focus_pending = false;
    this.input_renderer()?.blur_input?.();
  }

  private fit(text: string, max_w: number, node: UINode): string {
    if (max_w <= 8) return "";
    const measure = (s: string) => this.lfw.images.measure_text(s, node.style).w ?? 0;
    if (measure(text) <= max_w) return text;
    const chars = [...text];
    let lo = 0;
    let hi = chars.length;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (measure(chars.slice(0, mid).join("") + ELLIPSIS) <= max_w) lo = mid;
      else hi = mid - 1;
    }
    return chars.slice(0, lo).join("") + ELLIPSIS;
  }

  /** 折行：按可用宽度把文本切成多行，超过 max_lines 时末行加省略号 */
  private wrap_lines(text: string, max_w: number, node: UINode, max_lines: number): string {
    if (max_w <= 8 || !text) return "";
    const measure = (s: string) => this.lfw.images.measure_text(s, node.style).w ?? 0;
    if (measure(text) <= max_w) return text;
    const chars = [...text];
    const lines: string[] = [];
    let i = 0;
    while (i < chars.length && lines.length < max_lines) {
      while (i < chars.length && chars[i] === " ") i++;
      if (i >= chars.length) break;
      const last = lines.length === max_lines - 1;
      let lo = 1;
      let hi = chars.length - i;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        const s = chars.slice(i, i + mid).join("");
        if (measure(last ? s + ELLIPSIS : s) <= max_w) lo = mid;
        else hi = mid - 1;
      }
      let take = Math.max(1, lo);
      if (i + take < chars.length && !last) {
        // 优先在空格处断行，避免把英文单词劈开（中文没有空格，走字符断行）
        const seg = chars.slice(i, i + take);
        for (let k = seg.length - 1; k >= seg.length >> 1; k--) {
          if (seg[k] === " ") {
            take = k + 1;
            break;
          }
        }
        // 中文禁则：行首不留收尾标点，行尾不留开头标点
        while (take > 1 && NO_LINE_START.includes(chars[i + take])) take--;
        while (take > 1 && NO_LINE_END.includes(chars[i + take - 1])) take--;
      }
      const line = chars.slice(i, i + take).join("");
      i += take;
      lines.push(i < chars.length ? (last ? line.trimEnd() + ELLIPSIS : line.trimEnd()) : line);
    }
    return lines.join("\n");
  }

  private render_row(row: TRow, item: TChatItem): number {
    const { name, body } = row;
    if (item.kind === "msg") {
      const target: TChatTarget = item.msg.target === "global" ? "global" : "room";
      const color = CHANNEL_COLOR[target];
      const sender = item.msg.sender?.name ?? "?";
      if (name.style.fill_style !== color) name.style.fill_style = color;
      name.set_visible(true);
      const name_text = `${this.channel_label(target)} ${sender}:`;
      name.set_text(this.fit(name_text, ROW_W * NAME_MAX_RATIO, name));
      if (body.style.fill_style !== BODY_COLOR) body.style.fill_style = BODY_COLOR;
      const body_w = ROW_W - name.w - NAME_GAP;
      body.set_text(this.wrap_lines(item.msg.text ?? "", body_w, body, MAX_LINES));
      return Math.max(name.h, body.h, ROW_H);
    }
    name.set_visible(false);
    if (body.style.fill_style !== SYSTEM_COLOR) body.style.fill_style = SYSTEM_COLOR;
    body.set_text(this.wrap_lines(item.text, ROW_W, body, MAX_LINES));
    return Math.max(body.h, ROW_H);
  }

  private render(): void {
    const items = chat_store.items;
    const typing = !chat_store.peek;
    this.node.set_disabled(!typing);
    let used = 0;
    let slot = this._rows.length - 1;
    for (let i = items.length - 1; i >= 0 && slot >= 0; i--) {
      if (used + ROW_H > LIST_MAX_H) break;
      const node = this._list?.children[slot];
      const row_h = Math.ceil(this.render_row(this._rows[slot], items[i]));
      node?.resize(ROW_W, row_h);
      node?.set_visible(true);
      used += row_h + ROW_GAP;
      slot--;
    }
    for (let i = slot; i >= 0; i--) this._list?.children[i]?.set_visible(false);

    this._list?.resize(ROW_W, used).move_to(LIST_LEFT, typing ? LIST_BOTTOM_TYPING : LIST_BOTTOM_PEEK);
    if (typing) this.node.search_node("chat_bg")?.resize(BG_W, used + BG_EXTRA_H);

    const target = chat_store.target;
    this._target = target;
    const tag = this.node.search_node("chat_target");
    if (tag) {
      const color = CHANNEL_COLOR[target];
      if (tag.style.fill_style !== color) tag.style.fill_style = color;
      tag.set_text(this.channel_label(target));
    }
    this.layout();
  }

  private layout(): void {
    const list = this._list;
    if (!list) return;
    for (const row of list.children) if (row.visible) row.find_component(Flex)?.apply();
    list.find_component(Flex)?.apply();
  }
}
