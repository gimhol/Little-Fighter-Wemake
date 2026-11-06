import type { LFW } from "@/LFW/LFW";
import type { IKeyboardCallback } from "@/LFW/ditto/keyboard/IKeyboardCallback";
import { Ditto } from "@/LFW/ditto";
import {
  handle_chat_escape,
  is_chat_open,
  is_chat_peek,
  open_chat,
  toggle_chat,
} from "@/LFW/ui/chat_overlay";

const installed = new WeakSet<LFW>();

/**
 * 聊天热键：`T` 开/关聊天，`Esc` 退出输入或关闭聊天。
 *
 * 放在宿主侧（LFW 内不允许使用 `window`）：聊天输入框是 DOM `<input>`，
 * 在其中按键不会进 LFW 的键盘回调，所以 Esc 必须用捕获阶段的 DOM 监听。
 */
export function install_chat_hotkey(lfw: LFW): void {
  if (installed.has(lfw)) return;
  installed.add(lfw);
  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !is_chat_open(lfw)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    handle_chat_escape(lfw);
  }, true);
  const key: IKeyboardCallback = {
    on_key_down: (e) => {
      const native = e.native;
      const is_t = !native?.ctrlKey && !native?.metaKey && (e.key === "t" || native?.code === "KeyT");
      if (!is_t) return;
      if (is_chat_peek() || is_chat_open(lfw)) {
        toggle_chat(lfw);
        e.interrupt();
        return;
      }
      if (!Ditto.Networking.opened) return;
      open_chat(lfw);
      e.interrupt();
    },
  };
  lfw.keyboard.callback.add(key);
}
