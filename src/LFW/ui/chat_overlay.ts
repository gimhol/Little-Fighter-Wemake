import type { LFW } from "../LFW";

/** 聊天浮层独占的 UI 层，压在其他页面之上但不挤掉任何页面 */
export const CHAT_LAYER = 2;

/** 只读浏览模式：不显示输入框，一段时间后自动淡出关闭 */
let peeking = false;

export function is_chat_peek(): boolean {
  return peeking;
}

export function set_chat_peek(v: boolean): void {
  peeking = v;
}

export function is_chat_open(lfw: LFW): boolean {
  const layer = lfw.layers.at(CHAT_LAYER);
  return !!layer && layer.pages.some(page => page.id === "chat");
}

export function open_chat(lfw: LFW): void {
  if (is_chat_open(lfw)) return;
  set_chat_peek(false);
  lfw.layers.push_page({ id: "chat" }, CHAT_LAYER);
}

export function peek_chat(lfw: LFW): void {
  if (is_chat_open(lfw)) return;
  set_chat_peek(true);
  lfw.layers.push_page({ id: "chat" }, CHAT_LAYER);
}

export function close_chat(lfw: LFW): void {
  if (!is_chat_open(lfw)) return;
  lfw.layers.pop_page({}, CHAT_LAYER);
}

export function toggle_chat(lfw: LFW): void {
  if (!is_chat_open(lfw)) {
    open_chat(lfw);
    return;
  }
  if (is_chat_peek()) {
    close_chat(lfw);
    open_chat(lfw);
    return;
  }
  close_chat(lfw);
}

let escape_in_input: (() => void) | undefined;

export function set_chat_escape_handler(fn: (() => void) | undefined): void {
  escape_in_input = fn;
}

/** Esc：输入中交还输入控制，否则关闭聊天页 */
export function handle_chat_escape(lfw: LFW): void {
  if (!is_chat_peek() && escape_in_input) escape_in_input();
  else close_chat(lfw);
}
