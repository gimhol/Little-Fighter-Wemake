import { useEffect, useRef } from "react";
import { clamp } from "./clamp";
import styles from "./useFloating.module.scss";

// ===== 拉伸手柄（四边 + 四角）=====
const HANDLE_DIRS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'] as const;
type THandleDir = typeof HANDLE_DIRS[number];

export interface IUseFloatingOpts {
  responser?: HTMLElement | HTMLElement[] | null;
  target?: HTMLElement | null;
  is_excluded?(e: HTMLElement): boolean;
  pivot_x?: number;
  pivot_y?: number;
  followEdge?: boolean;
  followPercent?: boolean;
  resizable?: boolean;
  full_edge?: boolean;
  min_width?: number;
  min_height?: number;
  handle_size?: number;
}
export function useFloating(opts: IUseFloatingOpts) {
  const {
    responser, target = Array.isArray(responser) ? responser[0] : responser,
    is_excluded, pivot_x = 0, pivot_y = 0, followEdge = false, followPercent = false,
    resizable = false, full_edge = true, min_width = 20, min_height = 20, handle_size = 8,
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

    // ===== 拉伸（四边 + 四角）=====
    let resizing = false;
    let resize_dir: THandleDir = 'n';
    let resize_start = { x: 0, y: 0, left: 0, top: 0, width: 0, height: 0 };
    const resize_pointerdown = (dir: THandleDir, e: PointerEvent) => {
      if (working || resizing) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = target.getBoundingClientRect();
      resize_dir = dir;
      resize_start = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top, width: rect.width, height: rect.height };
      resizing = true;
      document.addEventListener('pointermove', resize_pointermove);
      document.addEventListener('pointerup', resize_pointerup);
      document.addEventListener('pointercancel', resize_pointerup);
    };
    const resize_pointermove = (e: PointerEvent) => {
      if (!resizing) return;
      const dx = e.clientX - resize_start.x;
      const dy = e.clientY - resize_start.y;
      const dir = resize_dir;
      const s = resize_start;
      const max_x = window.innerWidth;
      const max_y = window.innerHeight;
      // 以对边为固定边计算新矩形，并钳制在屏幕内（不超出屏幕）
      let left = s.left;
      let top = s.top;
      let width = s.width;
      let height = s.height;
      if (dir.includes('e')) {
        const right = clamp(s.left + s.width + dx, s.left + min_width, max_x);
        width = right - s.left;
      }
      if (dir.includes('s')) {
        const bottom = clamp(s.top + s.height + dy, s.top + min_height, max_y);
        height = bottom - s.top;
      }
      if (dir.includes('w')) {
        const right = s.left + s.width;
        const l = clamp(s.left + dx, 0, right - min_width);
        left = l;
        width = right - l;
      }
      if (dir.includes('n')) {
        const bottom = s.top + s.height;
        const t = clamp(s.top + dy, 0, bottom - min_height);
        top = t;
        height = bottom - t;
      }
      target.style.left = left + 'px';
      target.style.top = top + 'px';
      target.style.width = width + 'px';
      target.style.height = height + 'px';
      target.style.bottom = target.style.right = 'unset';
      // 拉伸会触发 on_target_resize（ResizeObserver），同步稳定坐标避免被拉回
      stable_x = left;
      stable_y = top;
      const max_x2 = Math.max(0, window.innerWidth - width);
      const max_y2 = Math.max(0, window.innerHeight - height);
      reach_max_x = left >= max_x2;
      reach_max_y = top >= max_y2;
      percent_x = max_x2 ? left / max_x2 : 0;
      percent_y = max_y2 ? top / max_y2 : 0;
      prev_rect = target.getBoundingClientRect();
      update_handles();
    };
    const resize_pointerup = () => {
      resizing = false;
      document.removeEventListener('pointermove', resize_pointermove);
      document.removeEventListener('pointerup', resize_pointerup);
      document.removeEventListener('pointercancel', resize_pointerup);
    };
    // 创建 8 个拉伸手柄（fixed 挂到 body，避免被 React 重渲染清掉）
    const handles: HTMLDivElement[] = [];
    const is_edge_dir = (dir: THandleDir) => dir === 'n' || dir === 's' || dir === 'e' || dir === 'w';
    const update_handles = () => {
      if (!handles.length) return;
      const display = visible ? 'block' : 'none';
      const rect = target.getBoundingClientRect();
      const positions: Record<THandleDir, [number, number]> = {
        n: [rect.left + rect.width / 2, rect.top],
        s: [rect.left + rect.width / 2, rect.top + rect.height],
        e: [rect.left + rect.width, rect.top + rect.height / 2],
        w: [rect.left, rect.top + rect.height / 2],
        ne: [rect.left + rect.width, rect.top],
        nw: [rect.left, rect.top],
        se: [rect.left + rect.width, rect.top + rect.height],
        sw: [rect.left, rect.top + rect.height],
      };
      handles.forEach((el, i) => {
        const dir = HANDLE_DIRS[i];
        el.style.display = display;
        // 整边模式：四条边拉成整条条带，角上维持方块
        if (full_edge && is_edge_dir(dir)) {
          switch (dir) {
            case 'n':
              el.style.left = rect.left + 'px';
              el.style.top = (rect.top - handle_size / 2) + 'px';
              el.style.width = rect.width + 'px';
              el.style.height = handle_size + 'px';
              break;
            case 's':
              el.style.left = rect.left + 'px';
              el.style.top = (rect.top + rect.height - handle_size / 2) + 'px';
              el.style.width = rect.width + 'px';
              el.style.height = handle_size + 'px';
              break;
            case 'e':
              el.style.left = (rect.left + rect.width - handle_size / 2) + 'px';
              el.style.top = rect.top + 'px';
              el.style.width = handle_size + 'px';
              el.style.height = rect.height + 'px';
              break;
            case 'w':
              el.style.left = (rect.left - handle_size / 2) + 'px';
              el.style.top = rect.top + 'px';
              el.style.width = handle_size + 'px';
              el.style.height = rect.height + 'px';
              break;
          }
          return;
        }
        const [x, y] = positions[dir];
        el.style.left = (x - handle_size / 2) + 'px';
        el.style.top = (y - handle_size / 2) + 'px';
        el.style.width = handle_size + 'px';
        el.style.height = handle_size + 'px';
      });
    };
    if (resizable) {
      for (const dir of HANDLE_DIRS) {
        const el = document.createElement('div');
        el.className = [
          styles.handle,
          styles[dir],
          full_edge && is_edge_dir(dir) ? styles.edge : '',
        ].filter(Boolean).join(' ');
        // 尺寸仍由 handle_size 动态控制
        el.style.width = handle_size + 'px';
        el.style.height = handle_size + 'px';
        el.addEventListener('pointerdown', (e) => resize_pointerdown(dir, e));
        document.body.appendChild(el);
        handles.push(el);
      }
      update_handles();
    }

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
      update_handles();
    }
    const pointerdown = (e: PointerEvent) => {
      if (working || resizing) return;
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
      update_handles();
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
      update_handles();
    }

    // 面板自身尺寸变化：若超出屏幕则重新钳制到屏幕内（保持贴边/比例语义不变）。
    // 例如 ChatBox 收到新消息后高度自然变大，应保持底部贴屏幕底而不超出。
    const on_target_resize = () => {
      if (!visible) return;
      const rect = target.getBoundingClientRect()
      const [x, y] = clamp_to_screen(rect.left, rect.top, rect.width, rect.height)
      if (x !== rect.left || y !== rect.top) {
        target.style.left = (x) + 'px';
        target.style.top = (y) + 'px';
        target.style.bottom = target.style.right = 'unset';
        stable_x = x;
        stable_y = y;
        const max_x = Math.max(0, window.innerWidth - rect.width);
        const max_y = Math.max(0, window.innerHeight - rect.height);
        reach_max_x = x >= max_x;
        reach_max_y = y >= max_y;
        percent_x = max_x ? x / max_x : 0;
        percent_y = max_y ? y / max_y : 0;
      }
      prev_rect = target.getBoundingClientRect();
      update_handles();
    }

    responsers.map(v => v.addEventListener('pointerdown', pointerdown));
    const resize_ob = new ResizeObserver(on_target_resize)
    const intersection_ob = new IntersectionObserver(on_target_resize)
    const mutation_ob = new MutationObserver((mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const v = is_show();
          // 显示状态未变化时跳过；变化时才更新 visible 并重新初始化
          if (v === visible) continue;
          visible = v;
          if (visible) setTimeout(() => { init(); update_handles(); }, 1)
          else update_handles();
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
    window.addEventListener('scroll', update_handles, true)
    init();
    update_handles();
    return () => {
      window.removeEventListener('resize', on_window_resize)
      window.removeEventListener('scroll', update_handles, true)
      responsers.map(v => v.removeEventListener('pointerdown', pointerdown));
      document.removeEventListener('pointermove', pointermove);
      document.removeEventListener('pointerup', pointerup);
      document.removeEventListener('pointercancel', pointerup);
      document.removeEventListener('pointermove', resize_pointermove);
      document.removeEventListener('pointerup', resize_pointerup);
      document.removeEventListener('pointercancel', resize_pointerup);
      handles.forEach(el => el.remove());
      resize_ob.disconnect()
      intersection_ob.disconnect()
    };
  }, [responser, target, pivot_x, pivot_y, followEdge, followPercent, resizable, full_edge, min_width, min_height, handle_size]);
}
