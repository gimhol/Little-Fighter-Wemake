import { __Pointings } from "@/DittoImpl";
import { BG_INDICATINGS } from "@/DittoImpl/renderer/INDICATINGS";
import type { WorldRenderer } from "@/DittoImpl/renderer/WorldRenderer";
import { LFW } from "@/LFW";
import { InvalidController } from "@/LFW/controller/InvalidController";
import { Defines, type IBgData, type IBgLayerInfo } from "@/LFW/defines";
import { Paths } from "@/Paths";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import csses from "./styles.module.scss";

const clamp = (v: number, l: number, h: number) => Math.max(l, Math.min(h, v));

export default function BgPreviewPage() {
  const nav = useNavigate();
  const [lfw, set_lfw] = useState<LFW>();
  const [error, set_error] = useState<string>();
  const [progress, set_progress] = useState("");
  const [ready, set_ready] = useState(false);
  const [bgs, set_bgs] = useState<readonly IBgData[]>([]);
  const [keyword, set_keyword] = useState("");
  const [bg_id, set_bg_id] = useState("");
  const [cam, set_cam] = useState({ x: 0, y: 0 });
  const [ents, set_ents] = useState(0);
  const [running, set_running] = useState(true);
  const [bg_flags, set_bg_flags] = useState(0);
  const [overrides, set_overrides] = useState<Record<number, number>>({});
  const [ver, set_ver] = useState(0);
  const [canvas, set_canvas] = useState<HTMLCanvasElement | null>(null);
  const [dragging, set_dragging] = useState(false);
  const originals = useRef(new WeakMap<IBgLayerInfo, number | undefined>());
  const last_opacity = useRef(new Map<number, number>());
  const drag_ref = useRef<{ px: number; py: number; cam_x: number; cam_y: number } | null>(null);
  const ready_ref = useRef(false);

  const focus_center = useCallback((lf2: LFW) => {
    const bg = lf2.world.bg;
    const stage = lf2.world.stage;
    const sw = lf2.world.dataset.screen_w;
    const sh = Defines.MODERN_SCREEN_HEIGHT;
    const zx = bg.zoom_x || 1;
    const zy = bg.zoom_y || 1;
    const x_min = stage.left;
    const x_max = Math.max(x_min, stage.right - sw / zx);
    const y_max = bg.height <= sh ? 0 : Math.max(0, Math.min(-0.5 * stage.far, bg.height - sh / zy));
    const x = clamp(lf2.world.middle.x - sw / 2 / zx, x_min, x_max);
    const y = clamp(-lf2.world.middle.z / 2 - sh / 2 / zy, 0, y_max);
    lf2.world.camera.lock(x, y);
    set_cam({ x, y });
  }, []);

  useEffect(() => {
    const lf2 = new LFW();
    ;(window as any).lfw = lf2;
    ;(window as any).world = lf2.world;
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
      set_bgs(lf2.datas.backgrounds);
      ready_ref.current = true;
      set_ready(true);
      focus_center(lf2);
    })();
    return () => {
      disposed = true;
      del_callback();
      lf2.dispose();
    };
  }, []);

  useEffect(() => {
    if (!lfw || !canvas) return;
    (lfw.pointings as __Pointings).set_element(canvas);
    (lfw.world.renderer as WorldRenderer).set_canvas(canvas);
  }, [lfw, canvas]);

  useEffect(() => {
    if (!lfw) return;
    const timer = window.setInterval(() => {
      const p = lfw.world.camera.position;
      set_cam((prev) => Math.round(prev.x) === Math.round(p.x) && Math.round(prev.y) === Math.round(p.y) ? prev : { x: p.x, y: p.y });
      set_ents(lfw.world.entities.length);
    }, 200);
    return () => window.clearInterval(timer);
  }, [lfw]);

  useEffect(() => {
    if (!lfw || !running) return;
    lfw.world.start_update();
    return () => lfw.world.stop_update();
  }, [lfw, running]);

  useEffect(() => {
    if (!lfw) return;
    lfw.world.dataset.bg_flags = bg_flags;
  }, [lfw, bg_flags]);

  useEffect(() => {
    if (!lfw) return;
    for (const layer of lfw.world.bg.layers) {
      const info = layer.info;
      if (!originals.current.has(info)) originals.current.set(info, info.opacity);
      const v = overrides[layer.data_index];
      if (v === void 0) {
        const original = originals.current.get(info);
        if (original === void 0) delete info.opacity;
        else info.opacity = original;
      } else {
        info.opacity = v;
      }
    }
  }, [lfw, overrides, ver]);

  const bounds = useMemo(() => {
    const bg = lfw?.world.bg;
    if (!lfw || !bg) return undefined;
    const { left, right, far } = lfw.world.stage;
    const sw = lfw.world.dataset.screen_w;
    const zx = bg.zoom_x || 1;
    const zy = bg.zoom_y || 1;
    const x_min = left;
    const x_max = Math.max(x_min, right - sw / zx);
    const y_max = bg.height <= Defines.MODERN_SCREEN_HEIGHT
      ? 0
      : Math.max(0, Math.min(-0.5 * far, bg.height - Defines.MODERN_SCREEN_HEIGHT / zy));
    return { x_min, x_max, y_max, zx, zy };
  }, [lfw, ver]);

  const move_cam = useCallback((x: number, y: number) => {
    if (!lfw || !bounds) return;
    const nx = clamp(x, bounds.x_min, bounds.x_max);
    const ny = clamp(y, 0, bounds.y_max);
    lfw.world.camera.lock(nx, ny);
    set_cam({ x: nx, y: ny });
  }, [lfw, bounds]);

  const select_bg = (id: string) => {
    if (!lfw || id === bg_id) return;
    lfw.change_bg(id);
    set_bg_id(lfw.world.bg.id);
    set_overrides({});
    last_opacity.current.clear();
    focus_center(lfw);
    set_ver((v) => v + 1);
  };

  const set_override = (index: number, value: number | undefined) => {
    if (value !== void 0 && value > 0) last_opacity.current.set(index, value);
    set_overrides((prev) => {
      const next = { ...prev };
      if (value === void 0) delete next[index];
      else next[index] = value;
      return next;
    });
  };

  const toggle_layer = (index: number, visible: boolean) => {
    set_override(index, visible ? last_opacity.current.get(index) : 0);
  };

  const spawn = (mode: "row" | "depth") => {
    if (!lfw) return;
    const data = lfw.datas.find_object("30") ?? lfw.datas.fighters[0];
    if (!data) return;
    const sw = lfw.world.dataset.screen_w;
    const sh = Defines.MODERN_SCREEN_HEIGHT;
    const stage = lfw.world.stage;
    const zx = lfw.world.bg.zoom_x || 1;
    const zy = lfw.world.bg.zoom_y || 1;
    const view_w = sw / zx;
    const cam = lfw.world.camera.position;
    const count = 6;
    for (let i = 0; i < count; i++) {
      const x = mode === "row"
        ? cam.x + view_w * (i + 0.5) / count
        : cam.x + view_w / 2;
      const z = mode === "row"
        ? lfw.world.middle.z
        : clamp(-2 * (sh * (1 - (i + 0.5) / count) / zy + cam.y), stage.far + 20, stage.near - 20);
      const [e] = lfw.fighters.add(data, 1, "1");
      if (!e) continue;
      e.ctrl = new InvalidController("", e);
      e.set_position(x, 0, z);
      e.set_position(null, e.ground_y, null);
    }
    set_ver((v) => v + 1);
  };

  const clear = () => {
    if (!lfw) return;
    lfw.fighters.del_all();
    set_ver((v) => v + 1);
  };

  const on_pointer_down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!lfw) return;
    drag_ref.current = {
      px: e.clientX,
      py: e.clientY,
      cam_x: lfw.world.camera.position.x,
      cam_y: lfw.world.camera.position.y,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    set_dragging(true);
  };

  const on_pointer_move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = drag_ref.current;
    if (!lfw || !bounds || !drag) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const content_w = Math.max(1, Math.min(rect.width, rect.height * (lfw.world.dataset.screen_w / Defines.MODERN_SCREEN_HEIGHT)));
    const scale = lfw.world.dataset.screen_w / content_w;
    const dx = (e.clientX - drag.px) * scale / bounds.zx;
    const dy = (e.clientY - drag.py) * scale / bounds.zy;
    move_cam(drag.cam_x - dx, drag.cam_y + dy);
  };

  const on_pointer_up = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drag_ref.current = null;
    set_dragging(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const shown_bgs = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return bgs;
    return bgs.filter((v) => `${v.id} ${v.base?.name ?? ""} ${(v.base?.group ?? []).join(" ")}`.toLowerCase().includes(kw));
  }, [bgs, keyword]);

  const rows = useMemo(() => {
    const bg = lfw?.world.bg;
    if (!bg) return [];
    const map = new Map<number, { info: IBgLayerInfo; copies: number }>();
    for (const layer of bg.layers) {
      const found = map.get(layer.data_index);
      if (found) found.copies++;
      else map.set(layer.data_index, { info: layer.info, copies: 1 });
    }
    return [...map.entries()]
      .map(([index, v]) => ({ index, info: v.info, copies: v.copies }))
      .sort((a, b) => a.info.z - b.info.z);
  }, [lfw, ver]);

  const bg = lfw?.world.bg;
  const stage = lfw?.world.stage;

  return (
    <div className={csses.page}>
      <div className={csses.header}>
        <div className={csses.title}>背景预览</div>
        <div className={csses.spacer} />
        <div className={csses.muted}>{progress}</div>
        <button className={csses.btn} onClick={() => set_running((v) => !v)} disabled={!ready}>
          {running ? "运行中" : "已暂停"}
        </button>
        <button className={csses.btn} onClick={() => lfw?.world.step()} disabled={!ready}>单步</button>
        <button className={csses.btn} onClick={() => window.location.reload()}>刷新</button>
        <button className={csses.btn} onClick={() => nav(Paths.All.game, { replace: true })}>返回游戏</button>
      </div>
      <div className={csses.body}>
        <div className={csses.stage}>
          <div className={csses.canvas_box}>
            <canvas
              ref={set_canvas}
              width={794}
              height={450}
              draggable={false}
              className={`${csses.canvas}${dragging ? " " + csses.canvas_dragging : ""}`}
              onPointerDown={on_pointer_down}
              onPointerMove={on_pointer_move}
              onPointerUp={on_pointer_up}
              onPointerCancel={on_pointer_up}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            />
            {!ready && !error && <div className={csses.center_text}>数据包加载中…（首次约 30MB）</div>}
            {!!error && <div className={csses.center_text}>{error}</div>}
            {ready && <div className={csses.hint}>拖动画面可平移相机</div>}
          </div>
          <div className={csses.cam_row}>
            <span className={csses.label}>相机 X</span>
            <input
              type="range"
              min={bounds?.x_min ?? 0}
              max={bounds?.x_max ?? 0}
              step={1}
              value={cam.x}
              onChange={(e) => move_cam(Number(e.target.value), cam.y)}
            />
            <input
              className={csses.num}
              type="number"
              value={Math.round(cam.x)}
              onChange={(e) => move_cam(Number(e.target.value), cam.y)}
            />
          </div>
          <div className={csses.cam_row}>
            <span className={csses.label}>相机 Y</span>
            <input
              type="range"
              min={0}
              max={bounds?.y_max ?? 0}
              step={1}
              value={cam.y}
              onChange={(e) => move_cam(cam.x, Number(e.target.value))}
            />
            <input
              className={csses.num}
              type="number"
              value={Math.round(cam.y)}
              onChange={(e) => move_cam(cam.x, Number(e.target.value))}
            />
          </div>
          <div className={csses.actions}>
            <button className={csses.btn} onClick={() => spawn("row")} disabled={!ready}>沿线放角色</button>
            <button className={csses.btn} onClick={() => spawn("depth")} disabled={!ready}>纵深放角色</button>
            <button className={csses.btn} onClick={clear} disabled={!ready}>清除角色</button>
            <label className={csses.check}>
              <input
                type="checkbox"
                checked={!!(bg_flags & BG_INDICATINGS.layer)}
                onChange={(e) => set_bg_flags((v) => e.target.checked ? v | BG_INDICATINGS.layer : v & ~BG_INDICATINGS.layer)}
              />
              图层框
            </label>
            <label className={csses.check}>
              <input
                type="checkbox"
                checked={!!(bg_flags & BG_INDICATINGS.terrain)}
                onChange={(e) => set_bg_flags((v) => e.target.checked ? v | BG_INDICATINGS.terrain : v & ~BG_INDICATINGS.terrain)}
              />
              地形框
            </label>
            <div className={csses.spacer} />
            <div className={csses.muted}>实体 {ents}</div>
          </div>
        </div>
        <div className={csses.side}>
          <div className={csses.section}>
            <div className={csses.section_title}>背景列表（{shown_bgs.length}/{bgs.length}）</div>
            <div className={csses.search_row}>
              <input
                className={csses.search}
                placeholder="搜索 id / 名称 / 分组"
                value={keyword}
                onChange={(e) => set_keyword(e.target.value)}
              />
            </div>
            <div className={csses.bg_list}>
              {shown_bgs.map((v) => (
                <button
                  key={v.id}
                  className={`${csses.bg_item}${v.id === bg_id ? " " + csses.bg_item_active : ""}`}
                  onClick={() => select_bg(v.id)}
                >
                  <span className={csses.bg_name}>{v.base?.name ?? v.id}</span>
                  <span className={csses.muted}>{v.id}</span>
                  {(v.base?.group ?? []).map((g) => <span key={g} className={csses.badge}>{g}</span>)}
                </button>
              ))}
            </div>
          </div>
          <div className={csses.section}>
            <div className={csses.section_title}>信息</div>
            <div className={csses.info}>
              {bg && stage ? (
                <>
                  <div className={csses.info_row}><span>名称</span><b>{bg.name}</b></div>
                  <div className={csses.info_row}><span>ID</span><b>{bg.id}</b></div>
                  <div className={csses.info_row}><span>范围 X</span><b>{Math.round(stage.left)} ~ {Math.round(stage.right)}</b></div>
                  <div className={csses.info_row}><span>范围 Z</span><b>{Math.round(stage.far)} ~ {Math.round(stage.near)}</b></div>
                  <div className={csses.info_row}><span>高度</span><b>{bg.height}</b></div>
                  <div className={csses.info_row}><span>缩放</span><b>{bg.zoom_x} / {bg.zoom_y} / {bg.zoom_z}</b></div>
                  <div className={csses.info_row}><span>相机</span><b>{Math.round(cam.x)}, {Math.round(cam.y)}</b></div>
                </>
              ) : (
                <div className={csses.muted}>未选择背景</div>
              )}
            </div>
          </div>
          <div className={`${csses.section} ${csses.section_fill}`}>
            <div className={csses.section_title}>图层（{rows.length}）</div>
            <div className={csses.layer_list}>
              {rows.map((row) => {
                const opacity = row.info.opacity ?? 1;
                return (
                  <div className={csses.layer_row} key={row.index}>
                    <input
                      type="checkbox"
                      checked={opacity > 0}
                      onChange={(e) => toggle_layer(row.index, e.target.checked)}
                    />
                    <div className={csses.layer_main}>
                      <div className={csses.layer_head}>
                        <span className={csses.layer_index}>#{row.index}{row.copies > 1 ? ` ×${row.copies}` : ""}</span>
                        {row.info.color !== void 0 && <span className={csses.swatch} style={{ background: "" + row.info.color }} />}
                        <span className={csses.layer_name}>{row.info.file ?? row.info.color ?? "(空)"}</span>
                        {row.info.z > 0 && <span className={csses.badge} data-warn="1">前景</span>}
                        {!!row.info.absolute && <span className={csses.badge}>绝对</span>}
                        {!!row.info.uv_loop && <span className={csses.badge}>UV</span>}
                        {!!row.info.loop && <span className={csses.badge}>loop {row.info.loop}</span>}
                      </div>
                      <div className={csses.layer_meta}>
                        z={row.info.z} · xy=({row.info.x}, {row.info.y}) · w/h={row.info.w || row.info.width}×{row.info.h || row.info.height}
                      </div>
                    </div>
                    <input
                      className={csses.opacity}
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={opacity}
                      onChange={(e) => set_override(row.index, Number(e.target.value))}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
