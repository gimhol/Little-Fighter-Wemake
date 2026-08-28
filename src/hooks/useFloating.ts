import { useEffect, useRef } from "react";
import { clamp } from "./clamp";
export interface IUseFloatingOpts {
  responser?: HTMLElement | HTMLElement[] | null;
  target?: HTMLElement | null;
  is_excluded?(e: HTMLElement): boolean;
  pivot_x?: number;
  pivot_y?: number;
  followEdge?: boolean;
  followPercent?: boolean;
}
export function useFloating(opts: IUseFloatingOpts) {
  const {
    responser, target = Array.isArray(responser) ? responser[0] : responser,
    is_excluded, pivot_x = 0, pivot_y = 0, followEdge = false, followPercent = false
  } = opts;
  const ref_is_excluded = useRef(is_excluded)
  ref_is_excluded.current = is_excluded;
  useEffect(() => {
    if (!target) return;
    const is_show = () => window.getComputedStyle(target).display !== 'none'
    const responsers = Array.isArray(responser) ? responser : responser ? [responser] : null;
    if (!responsers?.length) return
    let offset_x = 0;
    let offset_y = 0;
    let prev_rect = target.getBoundingClientRect();
    let working = false;
    let reach_max_x = false;
    let reach_max_y = false;
    let percent_x = 0;
    let percent_y = 0;
    let stable_x = 0;
    let stable_y = 0;
    let visible = is_show()
    const init = () => {
      if (!visible) return;
      const rect = target.getBoundingClientRect()
      let { x, y, width, height } = rect;
      [x, y] = clamp_to_screen(x, y, width, height);
      const max_x = Math.max(0, window.innerWidth - width);
      const max_y = Math.max(0, window.innerHeight - height);
      reach_max_x = x == max_x;
      reach_max_y = y == max_y;
      percent_x = max_x ? x / max_x : 0;
      percent_y = max_y ? y / max_y : 0;
      target.style.left = (x) + 'px';
      target.style.top = (y) + 'px';
      target.style.bottom = target.style.right = 'unset';
      stable_x = x;
      stable_y = y;
      prev_rect = rect;
    }
    const pointerdown = (e: PointerEvent) => {
      if (working) return;
      if (ref_is_excluded.current?.(e.target as HTMLElement)) return;
      const { x, y } = target.getBoundingClientRect();
      offset_x = x - e.clientX;
      offset_y = y - e.clientY;
      document.addEventListener('pointermove', pointermove);
      document.addEventListener('pointerup', pointerup);
      document.addEventListener('pointercancel', pointerup);
      prev_rect = target.getBoundingClientRect();
      working = true
    };
    const pointermove = (e: PointerEvent) => {
      const { width, height } = target.getBoundingClientRect();
      const [x, y] = clamp_to_screen(e.clientX + offset_x, e.clientY + offset_y, width, height)
      const max_x = Math.max(0, window.innerWidth - width);
      const max_y = Math.max(0, window.innerHeight - height);
      reach_max_x = x == max_x
      reach_max_y = y == max_y
      percent_x = max_x ? x / max_x : 0;
      percent_y = max_y ? y / max_y : 0;
      target.style.left = (x) + 'px';
      target.style.top = (y) + 'px';
      target.style.bottom = target.style.right = 'unset'
      stable_x = x;
      stable_y = y;
      prev_rect = target.getBoundingClientRect();
    };
    const pointerup = (e: PointerEvent) => {
      document.removeEventListener('pointermove', pointermove);
      document.removeEventListener('pointerup', pointerup);
      document.removeEventListener('pointercancel', pointerup);
      working = false
    };
    const clamp_to_screen = (x: number, y: number, width: number, height: number) => {
      const max_x = window.innerWidth - width;
      const max_y = window.innerHeight - height;
      // 面板尺寸超出屏幕（该轴放不下）时不做钳制，保持原坐标，避免拉伸时坐标被错误移动
      const cx = max_x > 0 ? clamp(x, 0, max_x) : x;
      const cy = max_y > 0 ? clamp(y, 0, max_y) : y;
      return [cx, cy] as const
    }

    // 窗口尺寸变化：按 followPercent / followEdge 重新定位
    // 面板某轴超出屏幕（放不下）时该轴不做移动，避免因显示限制（如出现滚动条触发 resize）导致坐标被错误改变
    const on_window_resize = () => {
      if (!visible) return;
      const rect = target.getBoundingClientRect()
      let x = rect.x
      let y = rect.y
      const max_x = window.innerWidth - rect.width;
      const max_y = window.innerHeight - rect.height;
      if (followPercent) {
        if (max_x > 0) x = Math.floor(percent_x * max_x);
        if (max_y > 0) y = Math.floor(percent_y * max_y);
      } else if (followEdge) {
        if (max_x > 0 && reach_max_x) x = max_x;
        if (max_y > 0 && reach_max_y) y = max_y;
      }
      [x, y] = clamp_to_screen(x, y, rect.width, rect.height)
      target.style.left = (x) + 'px';
      target.style.top = (y) + 'px';
      target.style.bottom = target.style.right = 'unset';
      stable_x = x;
      stable_y = y;
      prev_rect = target.getBoundingClientRect();
    }

    // 面板自身尺寸变化：坐标完全不动。
    // 若浏览器因显示限制（拉伸超出屏幕）移动了内联 left/top，恢复为稳定位置；仅刷新 prev_rect
    const on_target_resize = () => {
      if (!visible) return;
      const left = parseFloat(target.style.left)
      const top = parseFloat(target.style.top)
      if (
        (Number.isFinite(left) && left !== stable_x) ||
        (Number.isFinite(top) && top !== stable_y)
      ) {
        target.style.left = (stable_x) + 'px';
        target.style.top = (stable_y) + 'px';
        target.style.bottom = target.style.right = 'unset';
      }
      prev_rect = target.getBoundingClientRect();
    }

    responsers.map(v => v.addEventListener('pointerdown', pointerdown));
    const resize_ob = new ResizeObserver(on_target_resize)
    const intersection_ob = new IntersectionObserver(on_target_resize)
    const mutation_ob = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const v = is_show();
          if (v !== visible) continue;
          visible = v;
          if (visible) setTimeout(() => init(), 1)
        }
      }
    })
    mutation_ob.observe(target, {
      attributes: true, // 开启属性变化监听
      attributeFilter: ['style'], // 只监听style属性（缩小监听范围，提升性能）
      childList: false, // 不监听子元素变化
      subtree: false // 不监听后代元素变化
    })
    intersection_ob.observe(target)
    resize_ob.observe(target)
    window.addEventListener('resize', on_window_resize)
    init();
    return () => {
      window.removeEventListener('resize', on_window_resize)
      responsers.map(v => v.removeEventListener('pointerdown', pointerdown));
      document.removeEventListener('pointermove', pointermove);
      document.removeEventListener('pointerup', pointerup);
      document.removeEventListener('pointercancel', pointerup);
      resize_ob.disconnect()
      intersection_ob.disconnect()
    };
  }, [responser, target, pivot_x, pivot_y, followEdge, followPercent]);
}
