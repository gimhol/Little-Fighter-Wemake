import { NoEmitCallbacks } from "@/LFW";
import { type DependencyList, useEffect, useRef } from "react";


export function useCallbacks<F extends {}>(
  callbacks: NoEmitCallbacks<F> | undefined | null,
  fn: F | (() => F),
  deps: DependencyList = []
) {
  const ref_fn = useRef(fn);
  ref_fn.current = fn;
  useEffect(() => {
    if (!callbacks) return;
    const c = callbacks.add(typeof fn === 'function' ? (fn as any)() : fn);
    return () => c();
  }, [callbacks, ...deps]);
}
