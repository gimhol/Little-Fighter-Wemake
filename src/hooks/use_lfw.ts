import { LFW } from "@/LFW";
import type { IZip } from "@/LFW/ditto";
import { useEffect, useRef, useState } from "react";

export interface IUseLfwOptions {
  /** 为 false 时不创建实例（App 里要等本地设置就绪） */
  enabled?: boolean;
  /** 重建键：值变化时销毁旧实例再建一个；不传则只在 enabled 变 true 时建一次 */
  recreate_key?: unknown;
  /** 传给 `new LFW(debug)` */
  debug?: boolean;
  /** 要加载的数据包，默认 `LFW.ZIPS` */
  zips?: readonly (IZip | string)[];
  /** 加载完成后静音（预览用） */
  muted?: boolean;
  /** 不让游戏 UI 显示出来（预览用） */
  hide_ui?: boolean;
  /** 构造后、load 前调用（同步接线）；返回值作为卸载清理 */
  setup?(lfw: LFW): void | (() => void);
  /** 加载进度 */
  on_progress?(content: string, value: number): void;
}

export interface IUseLfwResult {
  lfw?: LFW;
  /** 数据包加载完成 */
  ready: boolean;
  error?: string;
}

/**
 * 创建并持有 LFW 实例：挂到 window、加载数据包、卸载时销毁。
 *
 * `debug`/`zips`/`muted`/`hide_ui`/`setup` 只在（重）建实例时读一次，
 * 但 `on_progress` 每次都取最新的，可以放心传内联箭头函数。
 */
export function use_lfw(options: IUseLfwOptions = {}): IUseLfwResult {
  const { enabled = true, recreate_key } = options;
  const opts = useRef(options);
  opts.current = options;

  const [lfw, set_lfw] = useState<LFW>();
  const [error, set_error] = useState<string>();
  const [ready, set_ready] = useState(false);
  const ready_ref = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const o = opts.current;
    const lf2 = new LFW(o.debug);
    Object.assign(window, { LFW, lf2, world: lf2.world });
    set_lfw(lf2);
    const del_progress = o.on_progress
      ? lf2.callbacks.add({
        on_progress: (content, value) => opts.current.on_progress?.(content, value),
      })
      : void 0;
    const del_ui = o.hide_ui
      ? lf2.callbacks.add({
        on_ui_changed: (curr) => { if (!ready_ref.current && curr) lf2.set_ui({}); },
      })
      : void 0;
    const unsetup = o.setup?.(lf2);

    let disposed = false;
    (async () => {
      try {
        await lf2.load(...(o.zips ?? LFW.ZIPS));
      } catch (e) {
        if (!disposed) set_error(`${e}`);
        return;
      }
      if (disposed) return;
      if (o.hide_ui) lf2.set_ui({});
      if (o.muted) lf2.sounds.set_muted(true);
      ready_ref.current = true;
      set_ready(true);
    })();

    return () => {
      disposed = true;
      ready_ref.current = false;
      del_progress?.();
      del_ui?.();
      unsetup?.();
      lf2.dispose();
    };
  }, [enabled, recreate_key]);

  return { lfw, ready, error };
}
