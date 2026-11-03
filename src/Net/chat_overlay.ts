import type { LFW } from "@/LFW";
import type { IKeyboardCallback } from "@/LFW/ditto/keyboard/IKeyboardCallback";
import { chat_store } from "./chat_store";
import { current_connection } from "./current_connection";

/** 聊天浮层独占的 UI 层，压在其他页面之上但不挤掉任何页面 */
export const CHAT_LAYER = 2;

export function is_chat_open(lfw: LFW): boolean {
  const layer = lfw.layers.at(CHAT_LAYER);
  return !!layer && layer.pages.some(page => page.id === "chat");
}

export function open_chat(lfw: LFW): void {
  if (is_chat_open(lfw)) return;
  chat_store.peek = false;
  lfw.layers.push_page({ id: "chat" }, CHAT_LAYER);
}

export function peek_chat(lfw: LFW): void {
  if (is_chat_open(lfw)) return;
  chat_store.peek = true;
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
  if (chat_store.peek) {
    close_chat(lfw);
    open_chat(lfw);
    return;
  }
  close_chat(lfw);
}

const installed = new WeakSet<LFW>();

export function install_chat_hotkey(lfw: LFW): void {
  if (installed.has(lfw)) return;
  installed.add(lfw);
  window.addEventListener("keydown", (e) => {
    if (!is_chat_open(lfw)) return;
    const key = e.key.toLowerCase();
    if (key !== "escape" && key !== "f4") return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close_chat(lfw);
  }, true);
  const key: IKeyboardCallback = {
    on_key_down: (e) => {
      const native = e.native;
      const is_t = !native?.ctrlKey && !native?.metaKey && (e.key === "t" || native?.code === "KeyT");
      if (!is_t) return;
      if (chat_store.peek || is_chat_open(lfw)) {
        toggle_chat(lfw);
        e.interrupt();
        return;
      }
      if (!current_connection.conn) return;
      open_chat(lfw);
      e.interrupt();
    },
  };
  lfw.keyboard.callback.add(key);
}
