import localforage from "localforage";
import { useEffect, useState } from "react";
import { clamp_nickname } from "../../Net";

const FORAGE_KEY = "nickname";

type TListener = (value: string) => void;

const listeners = new Set<TListener>();
let current = "";
let ready = false;
let touched = false;
let loading: Promise<void> | undefined;

function emit(): void {
  for (const listener of [...listeners]) listener(current);
}

export function set_nickname(next: string): void {
  const value = clamp_nickname(next);
  touched = true;
  if (value === current) return;
  current = value;
  localforage.setItem(FORAGE_KEY, value).catch(() => void 0);
  emit();
}

function load_nickname(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      try {
        const stored = await localforage.getItem<string>(FORAGE_KEY);
        if (!touched && typeof stored === "string") current = clamp_nickname(stored);
      } catch { }
      ready = true;
      emit();
    })();
  }
  return loading;
}

export function useNickname(): [string, (next: string) => void, boolean] {
  const [value, set_value] = useState(current);
  const [is_ready, set_is_ready] = useState(ready);
  useEffect(() => {
    set_value(current);
    set_is_ready(ready);
    const listener: TListener = (v) => set_value(v);
    listeners.add(listener);
    load_nickname().then(() => set_is_ready(true)).catch(() => void 0);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return [value, set_nickname, is_ready];
}
