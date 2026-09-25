import { LFW } from "@/LFW";
import { useEffect, useRef, useState } from "react";

export interface IUseLfwResult {
  lfw?: LFW;
  ready: boolean;
  error?: string;
  progress: string;
}

/**
 * 加载一个供预览使用的 LFW 实例，并在卸载时销毁。
 *
 * 多个预览 tab 共用同一个实例，因此只在页面外壳里调用一次。
 */
export function use_lfw(): IUseLfwResult {
  const [lfw, set_lfw] = useState<LFW>();
  const [error, set_error] = useState<string>();
  const [progress, set_progress] = useState("");
  const [ready, set_ready] = useState(false);
  const ready_ref = useRef(false);

  useEffect(() => {
    const lf2 = new LFW();
    (window as any).lfw = lf2;
    (window as any).world = lf2.world;
    set_lfw(lf2);
    let disposed = false;
    const del_callback = lf2.callbacks.add({
      on_progress: (content, value) => set_progress(`${content} ${Math.round(value)}%`),
      on_ui_changed: (curr) => { if (!ready_ref.current && curr) lf2.set_ui({}); },
    });
    (async () => {
      try {
        await lf2.load(...LFW.ZIPS);
      } catch (e) {
        if (!disposed) set_error("" + e);
        return;
      }
      if (disposed) return;
      lf2.set_ui({});
      lf2.sounds.set_muted(true);
      ready_ref.current = true;
      set_ready(true);
    })();
    return () => {
      disposed = true;
      del_callback();
      lf2.dispose();
    };
  }, []);

  return { lfw, ready, error, progress };
}
