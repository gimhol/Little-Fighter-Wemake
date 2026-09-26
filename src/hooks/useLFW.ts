import { LFW } from "@/LFW";
import type { IZip } from "@/LFW/ditto";
import { useCallbacks } from "@/pages/network_test/useCallbacks";
import { useEffect, useRef, useState } from "react";

export interface IUseLFWOptions {
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

export interface IUseLFWResult {
  lfw?: LFW;
  /** 数据包加载完成 */
  ready: boolean;
  error?: string;
}

/**
 * 创建并持有 LFW 实例：挂到 window、加载数据包、卸载时销毁。
 *
 * `debug`/`zips`/`setup` 只在建实例时读一次；
 * `muted`/`hide_ui`/`on_progress` 每次取最新，可以放心传内联箭头函数。
 */
export function useLFW(options: IUseLFWOptions = {}): IUseLFWResult {
  const { enabled = true, recreate_key, hide_ui } = options;
  const opts = useRef(options);
  useEffect(() => { opts.current = options });

  const [lfw, set_lfw] = useState<LFW>();
  const [error, set_error] = useState<string>();
  const [ready, set_ready] = useState(false);
  const ready_ref = useRef(false);

  // 建实例 / 销毁
  useEffect(() => {
    if (!enabled) return;
    const lf2 = new LFW(opts.current.debug);
    Object.assign(window, { LFW, lf2, world: lf2.world });
    set_lfw(lf2);
    return () => {
      ready_ref.current = false;
      set_ready(false);
      lf2.dispose();
    };
  }, [enabled, recreate_key]);

  // 进度 / UI
  useCallbacks(lfw?.callbacks, () => ({
    on_progress: (content, value) => opts.current.on_progress?.(content, value),
    on_ui_changed: (curr) => { if (hide_ui && !ready_ref.current && curr) lfw?.layers.set_ui({}) },
  }), [hide_ui]);

  // 接线 + 加载
  useEffect(() => {
    if (!lfw) return;
    let disposed = false;
    const unsetup = opts.current.setup?.(lfw);
    (async () => {
      try {
        await lfw.load(...(opts.current.zips ?? LFW.ZIPS));
      } catch (e) {
        if (!disposed) set_error(`${e}`);
        return;
      }
      if (disposed) return;
      if (opts.current.hide_ui) lfw.layers.set_ui({});
      if (opts.current.muted) lfw.sounds.set_muted(true);
      ready_ref.current = true;
      set_ready(true);
    })();
    return () => { disposed = true; unsetup?.(); };
  }, [lfw]);

  return { lfw, ready, error };
}
