import { BG_INDICATINGS } from "@/DittoImpl/renderer/INDICATINGS";
import { InvalidController } from "@/LFW/controller/InvalidController";
import { Defines, type IBgData, type IBgLayerInfo } from "@/LFW/defines";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreviewer } from "./ctx";
import { PreviewCanvas } from "./PreviewCanvas";
import csses from "./styles.module.scss";
import { useWorldView } from "./useWorldView";

const clamp = (v: number, l: number, h: number) => Math.max(l, Math.min(h, v));

export function BackgroundPreviewer() {
  const { lfw } = usePreviewer();
  const [bgs, set_bgs] = useState<readonly IBgData[]>([]);
  const [keyword, set_keyword] = useState("");
  const [bg_id, set_bg_id] = useState("");
  const [cam, set_cam] = useState({ x: 0, y: 0 });
  const [ents, set_ents] = useState(0);
  const [running, set_running] = useState(true);
  const [bg_flags, set_bg_flags] = useState(0);
  const [overrides, set_overrides] = useState<Record<number, number>>({});
  const [ver, set_ver] = useState(0);
  const originals = useRef(new WeakMap<IBgLayerInfo, number | undefined>());
  const last_opacity = useRef(new Map<number, number>());

  // 相机限制：只能看舞台范围内（可见尺寸含相机 zoom，滚轮缩放后范围跟着变）
  const limits_of = useCallback((view_w: number, view_h: number) => {
    const bg = lfw?.world.bg;
    const stage = lfw?.world.stage;
    if (!bg || !stage) return void 0;
    const x_min = stage.left;
    const x_max = Math.max(x_min, stage.right - view_w);
    const y_max = bg.height <= view_h
      ? 0
      : Math.max(0, Math.min(-0.5 * stage.far, bg.height - view_h));
    return { x: [x_min, x_max], y: [0, y_max] } as const;
  }, [lfw]);

  const view = useWorldView(lfw, { limits: limits_of });
  const { center_on, lock_camera, limits, zoom } = view;
  const bg = lfw?.world.bg;

  const focus_center = useCallback((lf2: NonNullable<typeof lfw>) => {
    // 把舞台中线放到画面正中（center_on 自己会减去半个视口）
    center_on(lf2.world.middle.x, -lf2.world.middle.z / 2);
    const p = lf2.world.camera.position;
    set_cam({ x: p.x, y: p.y });
  }, [center_on]);

  useEffect(() => {
    if (!lfw) return;
    set_bgs(lfw.datas.backgrounds);
    set_bg_id(lfw.world.bg.id);
    focus_center(lfw);
  }, [lfw, focus_center]);

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

  // 离开 tab 时还原图层透明度，避免影响其他预览
  useEffect(() => {
    if (!lfw) return;
    const meta = originals.current;
    return () => {
      for (const layer of lfw.world.bg.layers) {
        const info = layer.info;
        const original = meta.get(info);
        if (original === void 0) delete info.opacity;
        else info.opacity = original;
      }
    };
  }, [lfw]);

  const bounds = useMemo(() => {
    const lim = limits();
    if (!bg || !lim) return undefined;
    return { x_min: lim.x[0], x_max: lim.x[1], y_max: lim.y[1] };
    // zoom 也影响可见尺寸（limits 内部用 view_size），缩放后范围跟着变
  }, [bg, limits, zoom]);

  // 滑杆给的是相机坐标（和 bounds 同一空间），直接铺到相机上
  const move_cam = useCallback((x: number, y: number) => {
    if (!lfw) return;
    lock_camera(x, y);
    const p = lfw.world.camera.position;
    set_cam({ x: p.x, y: p.y });
  }, [lfw, lock_camera]);

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

  const shown_bgs = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    if (!kw) return bgs;
    return bgs.filter((v) => `${v.id} ${v.base?.name ?? ""} ${(v.base?.group ?? []).join(" ")}`.toLowerCase().includes(kw));
  }, [bgs, keyword]);

  const rows = useMemo(() => {
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
  }, [bg]);

  const stage = lfw?.world.stage;

  return (
    <>
      <div className={csses.stage}>
        <PreviewCanvas view={view} />
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
          <button className={csses.btn} onClick={() => set_running((v) => !v)} disabled={!lfw}>
            {running ? "暂停" : "运行"}
          </button>
          <button className={csses.btn} onClick={() => lfw?.world.step()} disabled={!lfw}>单步</button>
          <button className={csses.btn} onClick={() => spawn("row")} disabled={!lfw}>沿线放角色</button>
          <button className={csses.btn} onClick={() => spawn("depth")} disabled={!lfw}>纵深放角色</button>
          <button className={csses.btn} onClick={clear} disabled={!lfw}>清除角色</button>
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
    </>
  );
}
