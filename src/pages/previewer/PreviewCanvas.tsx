import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import csses from "./styles.module.scss";
import type { IWorldView } from "./useWorldView";

/** 预览画布：背景 / 角色两个 tab 共用，保证拖拽、滚轮缩放与提示完全一致 */
export function PreviewCanvas({ view, children, on_pointer_down }: {
  view: IWorldView;
  children?: ReactNode;
  /** 在 hook 的按下处理之前追加一点自己的逻辑（如手动拖拽时解除锁定） */
  on_pointer_down?: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
}) {
  const { set_canvas, dragging, zoom, canvas_props } = view;
  return (
    <div className={csses.canvas_box}>
      <canvas
        ref={set_canvas}
        width={794}
        height={450}
        draggable={false}
        className={`${csses.canvas}${dragging ? " " + csses.canvas_dragging : ""}`}
        {...canvas_props}
        onPointerDown={(e) => {
          on_pointer_down?.(e);
          canvas_props.onPointerDown(e);
        }}
        onPointerCancel={canvas_props.onPointerUp}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
      />
      <div className={csses.hint}>拖动平移 · 滚轮缩放 {zoom.toFixed(2)}x</div>
      {children}
    </div>
  );
}
