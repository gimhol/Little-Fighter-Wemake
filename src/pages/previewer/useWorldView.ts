import { __Pointings } from "@/DittoImpl";
import type { OrthographicCamera } from "@/DittoImpl/_t";
import type { WorldRenderer } from "@/DittoImpl/renderer/WorldRenderer";
import type { LFW } from "@/LFW";
import { Defines } from "@/LFW/defines";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, PointerEvent as ReactPointerEvent, SetStateAction, WheelEvent as ReactWheelEvent } from "react";

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 8;
const ZOOM_STEP = 1.1;

/** 相机允许范围（世界单位 / 相机自身的 y 空间） */
export interface IWorldViewLimits {
  x: readonly [number, number];
  y: readonly [number, number];
}

export interface IWorldViewOptions {
  /** 由当前可见世界尺寸推出相机允许范围；返回 undefined 表示不限制 */
  limits?(view_w: number, view_h: number): IWorldViewLimits | undefined;
}

export interface IWorldView {
  canvas: HTMLCanvasElement | null;
  set_canvas: Dispatch<SetStateAction<HTMLCanvasElement | null>>;
  zoom: number;
  dragging: boolean;
  /** 视口里可见的世界尺寸（含世界 scale 与相机 zoom） */
  view_size(): { w: number; h: number };
  /** 当前相机允许范围（给滑杆等 UI 用） */
  limits(): IWorldViewLimits | undefined;
  /** 让世界点 (x, y) 落在画面正中；y 用渲染空间（实体是 position.y - position.z / 2） */
  center_on(x: number, y: number): void;
  /** 直接指定相机位置（会套 limits），坐标就是相机自身的 x / y */
  lock_camera(x: number, y: number): void;
  /** 直接铺到 <canvas> 上的指针/滚轮处理 */
  canvas_props: {
    onPointerDown(e: ReactPointerEvent<HTMLCanvasElement>): void;
    onPointerMove(e: ReactPointerEvent<HTMLCanvasElement>): void;
    onPointerUp(e: ReactPointerEvent<HTMLCanvasElement>): void;
    onWheel(e: ReactWheelEvent<HTMLCanvasElement>): void;
  };
}

interface IDrag {
  px: number;
  py: number;
  cam_x: number;
  cam_y: number;
}

/** 画布像素 → 世界单位（含 letterbox 换算、世界 scale 与相机 zoom） */
function canvas_scale(
  cv: HTMLCanvasElement,
  sw: number,
  sh: number,
  sx: number,
  sy: number,
  zoom: number,
): [number, number] {
  const rect = cv.getBoundingClientRect();
  const content_w = Math.max(1, Math.min(rect.width, rect.height * (sw / sh)));
  const k = sw / content_w;
  return [k / (sx * zoom || 1), k / (sy * zoom || 1)];
}

/**
 * 预览画布统一的视角操作：拖拽平移 + 滚轮缩放（背景 / 角色两个 tab 共用一套手感与换算）。
 *
 * 缩放改渲染相机的 `zoom`：背景与实体用的是同一套相机，一起缩放因此不会错位。
 * three 的正交 zoom 绕视锥中心缩放，视口中心不动，所以缩放时不需要额外调相机。
 */
export function useWorldView(lfw: LFW | undefined, options: IWorldViewOptions = {}): IWorldView {
  const opts = useRef(options);
  useEffect(() => { opts.current = options });

  const [canvas, set_canvas] = useState<HTMLCanvasElement | null>(null);
  const [zoom, set_zoom] = useState(1);
  const [dragging, set_dragging] = useState(false);
  const drag_ref = useRef<IDrag | null>(null);

  useEffect(() => {
    if (!lfw || !canvas) return;
    (lfw.pointings as __Pointings).set_element(canvas);
    (lfw.world.renderer as WorldRenderer).set_canvas(canvas);
  }, [lfw, canvas]);

  useEffect(() => {
    if (!lfw) return;
    const r = lfw.world.renderer as WorldRenderer;
    const cams = [r.camera as OrthographicCamera, r.bg_camera, r.fg_camera];
    for (const c of cams) {
      c.zoom = zoom;
      c.updateProjectionMatrix();
    }
    return () => {
      for (const c of cams) {
        c.zoom = 1;
        c.updateProjectionMatrix();
      }
    };
  }, [lfw, zoom]);

  const view_size = useCallback((): { w: number; h: number } => {
    if (!lfw) return { w: 0, h: 0 };
    const { world } = lfw;
    const r = world.renderer as WorldRenderer;
    const k = (r.camera as OrthographicCamera).zoom || 1;
    return {
      w: world.dataset.screen_w / (world.transform.scale_x || 1) / k,
      h: Defines.MODERN_SCREEN_HEIGHT / (world.transform.scale_y || 1) / k,
    };
  }, [lfw]);

  const limits = useCallback((): IWorldViewLimits | undefined => {
    const { w, h } = view_size();
    return opts.current.limits?.(w, h);
  }, [view_size]);

  const lock_camera = useCallback((x: number, y: number) => {
    if (!lfw) return;
    const lim = limits();
    lfw.world.camera.lock(
      lim ? Math.max(lim.x[0], Math.min(lim.x[1], x)) : x,
      lim ? Math.max(lim.y[0], Math.min(lim.y[1], y)) : y,
    );
  }, [lfw, limits]);

  const center_on = useCallback((x: number, y: number) => {
    if (!lfw) return;
    // 相机位置 = 视口中心对应的世界点 - 半个视口；正交 zoom 不影响这个换算
    const { world } = lfw;
    const sw = world.dataset.screen_w;
    const sh = Defines.MODERN_SCREEN_HEIGHT;
    lock_camera(
      x - sw / 2 / (world.transform.scale_x || 1),
      y - sh / 2 / (world.transform.scale_y || 1),
    );
  }, [lfw, lock_camera]);

  const on_pointer_down = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!lfw) return;
    const cam = lfw.world.camera.position;
    drag_ref.current = { px: e.clientX, py: e.clientY, cam_x: cam.x, cam_y: cam.y };
    e.currentTarget.setPointerCapture(e.pointerId);
    set_dragging(true);
  };

  const on_pointer_move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = drag_ref.current;
    if (!lfw || !drag) return;
    const { world } = lfw;
    const r = world.renderer as WorldRenderer;
    const [kx, ky] = canvas_scale(
      e.currentTarget,
      world.dataset.screen_w,
      Defines.MODERN_SCREEN_HEIGHT,
      world.transform.scale_x || 1,
      world.transform.scale_y || 1,
      (r.camera as OrthographicCamera).zoom || 1,
    );
    lock_camera(
      drag.cam_x - (e.clientX - drag.px) * kx,
      drag.cam_y + (e.clientY - drag.py) * ky,
    );
  };

  const on_pointer_up = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    drag_ref.current = null;
    set_dragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const on_wheel = (e: ReactWheelEvent<HTMLCanvasElement>) => {
    const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom * (e.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP)));
    if (next !== zoom) set_zoom(next);
  };

  return {
    canvas,
    set_canvas,
    zoom,
    dragging,
    view_size,
    limits,
    center_on,
    lock_camera,
    canvas_props: {
      onPointerDown: on_pointer_down,
      onPointerMove: on_pointer_move,
      onPointerUp: on_pointer_up,
      onWheel: on_wheel,
    },
  };
}
