import type { IRespChat } from "./IMsg_Chat";

export type TChatItem = { kind: "msg"; msg: IRespChat } | { kind: "sys"; text: string };
export type TChatTarget = "room" | "global";

class ChatStore {
  private _items: TChatItem[] = [];
  private _sender: ((text: string, target: TChatTarget) => void) | null = null;
  private _target: TChatTarget = "room";
  peek = false;

  get items(): readonly TChatItem[] { return this._items; }
  get target(): TChatTarget { return this._target; }

  clear(): void {
    this._items = [];
    this.peek = false;
  }

  set_sender(fn: ((text: string, target: TChatTarget) => void) | null): void {
    this._sender = fn;
  }

  toggle_target(): void {
    this._target = this._target === "room" ? "global" : "room";
  }

  push(item: TChatItem): void {
    this._items.push(item);
    if (this._items.length > 100) this._items.splice(0, this._items.length - 100);
  }

  push_sys(text: string): void { this.push({ kind: "sys", text }); }

  send(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || !this._sender) return false;
    this._sender(trimmed, this._target);
    return true;
  }
}

export const chat_store = new ChatStore();
