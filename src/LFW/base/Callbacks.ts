import { NoEmitCallbacks } from "./NoEmitCallbacks";
export class Callbacks<F extends {}> extends NoEmitCallbacks<F> {
  /**
   * 触发回调
   *
   * @template K
   * @param {K} fn_name 回调函数名
   * @param {...Parameters<Extract<F[K], (...args: any) => any>>} args 回调参数
   * @memberof Callbacks
   */
  call<K extends keyof F>(fn_name: K, ...args: Parameters<Extract<F[K], (...args: any) => any>>): void {
    this._map.get(fn_name)?.emit(args);
  }
}
