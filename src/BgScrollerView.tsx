import { useCallback, useEffect, useRef } from "react";
import csses from "./BgScrollerView.module.scss";
import { Button } from "./Component/Buttons/Button";
import { CMD, floor, LFW, max, min } from "./LFW";
import { Defines } from "./LFW/defines/defines";
import { useCallbacks } from "./pages/network_test/useCallbacks";

function to_world_cam_x(screen_x: number, lfw: LFW, canvas: HTMLCanvasElement) {
  const { left, width } = canvas.getBoundingClientRect();
  const s_width = lfw.world.stage.width;
  const w = floor((width * Defines.CLASSIC_SCREEN_WIDTH) / s_width);
  const x = min(width - w - 3, max(0, floor(screen_x - left - w / 2)));
  return (s_width * x) / width;
}

function from_world_cam_x(world_x: number, lfw: LFW, canvas: HTMLCanvasElement): number {
  const { left, width } = canvas.getBoundingClientRect();
  const s_width = lfw.world.stage.width;
  const w = floor((width * Defines.CLASSIC_SCREEN_WIDTH) / s_width);
  const max_x = width - w - 3;
  let x = (world_x * width) / s_width;
  x = max(0, min(max_x, x));
  return x + left + w / 2;
}

export function BgScrollerView(props: { lfw?: LFW }) {
  const { lfw } = props;
  const world = lfw?.world
  const ref_cavnas = useRef<HTMLCanvasElement>(null)

  const draw_cam_bar = useCallback((x: number) => {
    const canvas = ref_cavnas.current;
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !world) return;
    const background_w = world.stage.width;
    const screen_w = Defines.CLASSIC_SCREEN_WIDTH;
    const { width, height } = canvas;
    const { player_l, player_r } = world.stage;
    const x_l = floor((width * player_l) / background_w);
    const x_r = floor((width * player_r) / background_w);
    const hh = 2.5;
    const w = floor((width * screen_w) / background_w) - hh;
    const h = height - hh * 2;
    ctx.fillStyle = ctx.strokeStyle = "#FF000055";
    ctx.fillRect(0, 0, x_l, height);
    ctx.fillRect(x_r, 0, width - x_r, height);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#FFFFFF55";
    ctx.strokeRect(x + hh, hh, w, h);
    if (typeof world.camera.locked?.x === 'number') {
      ctx.fillStyle = "#FFFFFF88";
      ctx.fillRect(x + hh, hh, w, h);
    }
  }, [lfw])

  useEffect(() => {
    draw_cam_bar(world?.camera.position.x ?? 0)
  }, [draw_cam_bar, world])

  useCallbacks(world?.callbacks, {
    on_cam_move: (cam_x) => {
      const canvas = ref_cavnas.current;
      if (!world || !canvas) return;
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
      const s_width = world.stage.width;
      const x = (cam_x * width) / s_width;
      draw_cam_bar(x);
    }
  })

  const _pointer_down = useCallback((e: React.PointerEvent) => {
    if (!e.isPrimary || !lfw) return;
    const canvas = ref_cavnas.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const ox = from_world_cam_x(lfw.world.camera.locked?.x ?? lfw.world.camera.position.x, lfw, canvas) - e.pageX

    const handle_pointer_event = (e: React.PointerEvent | PointerEvent) => {
      const output_x = to_world_cam_x(e.pageX + ox, lfw, canvas);
      lfw.push_cmd(CMD.LOCK_CAM, `${output_x}`)
    }
    handle_pointer_event(e);

    const _pointer_move = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      handle_pointer_event(e);
    };
    const _pointer_up = (e: PointerEvent) => {
      if (!e.isPrimary) return;
      window.removeEventListener("pointermove", _pointer_move);
      window.removeEventListener("pointerup", _pointer_up);
      window.removeEventListener("pointercancel", _pointer_up);
    };
    window.addEventListener("pointermove", _pointer_move);
    window.addEventListener("pointerup", _pointer_up);
    window.addEventListener("pointercancel", _pointer_up);
  }, [lfw]);

  const on_click_free_cam = useCallback(() => {
    if (!lfw) return;
    const lock_cam_x = lfw.world.camera.locked?.x;
    if (typeof lock_cam_x != 'number') return;
    draw_cam_bar(lock_cam_x);
    lfw.push_cmd(CMD.LOCK_CAM, '')
  }, [lfw, draw_cam_bar])

  return (
    <div className={csses.bg_scroller_view}>
      <canvas className={csses.canvas + ' ' + Button.default_class_name} ref={ref_cavnas} onPointerDown={_pointer_down} />
      <Button className={csses.btn_free} onClick={on_click_free_cam}>释放</Button>
    </div>
  );

}
