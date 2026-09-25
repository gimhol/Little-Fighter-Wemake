import { __Pointings } from "@/DittoImpl";
import { ENTITY_INDICATINGS } from "@/DittoImpl/renderer/INDICATINGS";
import type { WorldRenderer } from "@/DittoImpl/renderer/WorldRenderer";
import type { Entity, IEntityData, IFrameInfo } from "@/LFW";
import { Defines, FrameId, TeamEnum } from "@/LFW/defines";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePreviewer } from "./ctx";
import csses from "./styles.module.scss";

/** 表演用的空白背景（与游戏内招式表一致）：无图层、zoom = 1 */
const DEMO_BG = "bg_move_table";
const DEMO_HP = 9999;
const DEMO_MP = 1000000;
/** 滞空时抬到的高度 */
const HOVER_Y = 200;

/** 本 tab 上次用的预览实体 id：切 tab 不清场，回来能接着演同一个 */
let last_preview_id = "";

type TDatas = NonNullable<ReturnType<typeof usePreviewer>["lfw"]>["datas"];

const TYPES: ReadonlyArray<{ id: string; label: string; pick: (d: TDatas) => readonly IEntityData[] }> = [
  { id: "all", label: "全部", pick: (d) => d.objects },
  { id: "fighter", label: "角色", pick: (d) => d.fighters },
  { id: "weapon", label: "武器", pick: (d) => d.weapons },
  { id: "ball", label: "弹道", pick: (d) => d.balls },
  { id: "entity", label: "实体", pick: (d) => d.entities },
];

const INDICATORS: ReadonlyArray<{ key: keyof typeof ENTITY_INDICATINGS; label: string }> = [
  { key: "frame", label: "帧框" },
  { key: "bdy", label: "bdy" },
  { key: "itr", label: "itr" },
  { key: "ft", label: "脚点" },
  { key: "opoint", label: "发射点" },
  { key: "wpoint", label: "持械点" },
  { key: "cpoint", label: "抓取点" },
  { key: "bpoint", label: "吐血点" },
];

interface IMotion {
  name: string;
  frames: readonly IFrameInfo[];
}

function get_next_id(frame: IFrameInfo | undefined): string | undefined {
  const next = frame?.next;
  if (!next) return;
  const n = (Array.isArray(next) ? next[0] : next) as unknown;
  const id = typeof n === "string" ? n : (n as { id?: string } | undefined)?.id;
  return id ?? void 0;
}

/**
 * 动作链上的下一帧 id；返回 undefined 表示这一套动作结束
 * （`auto` 表示回到默认帧，`self`/`gone`/空 同样是终点）
 */
function chain_next(frame: IFrameInfo): string | undefined {
  const id = get_next_id(frame);
  if (id === void 0
    || id === ""
    || id === FrameId.Auto
    || id === FrameId.Self
    || id === FrameId.Gone
    || id === FrameId.Respawn) return;
  return id;
}

/**
 * 按 `next` 链把帧切成一套一套动作。
 *
 * 链的起点 = 没有被任何帧 `next` 指向的帧；`auto` / `self` / `gone` 视为动作结束，
 * 所以每套动作就是 攻击/移动/... 这一串帧本身，不含回到默认帧后的待机循环。
 */
function build_motions(data: IEntityData): readonly IMotion[] {
  const all = Object.values(data.frames);
  const pointed = new Set<string>();
  for (const f of all) {
    const id = chain_next(f);
    if (id) pointed.add(id);
  }
  const remain = new Set(all);
  const motions: IMotion[] = [];
  for (const head of all) {
    if (pointed.has(head.id)) continue;
    const frames: IFrameInfo[] = [];
    let cur: IFrameInfo | undefined = head;
    while (cur && remain.has(cur)) {
      remain.delete(cur);
      frames.push(cur);
      const id = chain_next(cur);
      if (!id) break;
      cur = data.frames[id];
    }
    if (frames.length) motions.push({ name: head.name || head.id, frames });
  }
  // 自成环、链走不到的帧单独列出，避免漏帧
  for (const f of all) if (remain.has(f)) motions.push({ name: f.name || f.id, frames: [f] });
  return motions;
}

function motion_ids(m: IMotion): string {
  const first = m.frames[0].id;
  const last = m.frames[m.frames.length - 1].id;
  return m.frames.length > 1 ? `${first}..${last}` : first;
}

export function EntityPreviewer() {
  const { lfw } = usePreviewer();
  const [type, set_type] = useState("all");
  const [keyword, set_keyword] = useState("");
  const [data_id, set_data_id] = useState("");
  const [entity, set_entity] = useState<Entity>();
  /** -1 = 全部帧，否则是动作下标 */
  const [motion_i, set_motion_i] = useState(-1);
  const [running, set_running] = useState(true);
  const [locked, set_locked] = useState(false);
  const [hover, set_hover] = useState(false);
  const [gravity, set_gravity] = useState(true);
  const [flags, set_flags] = useState(ENTITY_INDICATINGS.ft | ENTITY_INDICATINGS.frame);
  const [canvas, set_canvas] = useState<HTMLCanvasElement | null>(null);
  const [cur_frame_id, set_cur_frame_id] = useState("");
  const [, set_ver] = useState(0);
  // 滞空开关：recenter 里按这个 ref 决定贴地还是抬到 HOVER_Y（用 ref 免于让 recenter 换身份）
  const hover_ref = useRef(hover);
  useEffect(() => { hover_ref.current = hover });

  const list = useMemo(() => {
    if (!lfw) return [];
    const all = TYPES.find((v) => v.id === type)?.pick(lfw.datas) ?? [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return all;
    return all.filter((v) => `${v.id} ${v.base?.name ?? ""} ${(v.base?.group ?? []).join(" ")}`.toLowerCase().includes(kw));
  }, [lfw, type, keyword]);

  const data = useMemo(() => lfw?.datas.find(data_id), [lfw, data_id]);
  const motions = useMemo(() => (data ? build_motions(data) : []), [data]);
  const all_frames = useMemo(() => (data ? Object.values(data.frames) : []), [data]);
  const motion = motion_i >= 0 ? motions[motion_i] : undefined;
  const shown_frames = motion?.frames ?? all_frames;

  const frame = entity?.frame;
  const next_id = get_next_id(frame);
  const next_text = !frame ? "-" : next_id === void 0 || next_id === "" ? "无" : next_id;

  const focus = useCallback((e: Entity | undefined) => {
    if (!lfw || !e) return;    const { world } = lfw;
    const { bg } = world;
    const sw = world.dataset.screen_w;
    const sh = Defines.MODERN_SCREEN_HEIGHT;
    const zx = bg.zoom_x || 1;
    const zy = bg.zoom_y || 1;
    // 实体的渲染 y = position.y - position.z / 2（见 EntityRenderer.update_position）
    const render_y = e.position.y - e.position.z / 2;
    world.camera.lock(e.position.x - sw / 2 / zx, render_y - sh / 2 / zy);
  }, [lfw]);

  /** 归中：实体放回舞台中线（滞空时抬离地面），相机重新对准（动作开演前 / 刚生成时） */
  const recenter = useCallback((e: Entity | undefined) => {
    if (!lfw || !e) return;
    const { world } = lfw;
    e.set_position(world.middle.x, 0, world.middle.z);
    e.set_position(null, hover_ref.current ? HOVER_Y : e.ground_y, null);
    focus(e);
  }, [lfw, focus]);

  /** 新建实体并归中；返回新实体。只退休自己上次那个，不动别人的实体/背景 */
  const spawn_entity = useCallback((data: IEntityData): Entity | undefined => {
    if (!lfw) return;
    const { world } = lfw;
    const old = last_preview_id ? world.entity_map.get(last_preview_id) : void 0;
    if (old) world.del_entity(old);
    const e = lfw.factory.create_entity(world, data);
    if (!e) return;
    last_preview_id = e.id;
    e.team = TeamEnum.Team_1;
    e.key_role = false;
    e.name_visible = false;
    e.ctrl_visible = false;
    e.hp_max = e.hp = DEMO_HP;
    e.mp_max = e.mp = DEMO_MP;
    recenter(e);
    e.attach();
    set_entity(e);
    return e;
  }, [lfw, recenter]);

  /** 取当前可用的实体：有些动作会让实体消失（gone 帧 / 已被世界移除），这时重建一个再演 */
  const ensure_entity = useCallback((): Entity | undefined => {
    if (!lfw || !data) return;
    if (entity && entity.frame.id !== FrameId.Gone && entity.mounted)
      return entity;
    return spawn_entity(data);
  }, [lfw, data, entity, spawn_entity]);

  useEffect(() => {
    if (!lfw || !canvas) return;
    (lfw.pointings as __Pointings).set_element(canvas);
    (lfw.world.renderer as WorldRenderer).set_canvas(canvas);
  }, [lfw, canvas]);

  useEffect(() => {
    if (!lfw) return;
    lfw.world.dataset.entity_flags = flags;
  }, [lfw, flags]);

  // 重力开关：关掉时把世界重力系数压 0，恢复时还原（本 tab 独占这个世界）
  useEffect(() => {
    if (!lfw || gravity) return;
    const d = lfw.world.dataset;
    const { gravity: g, gravity_d: gd } = d;
    d.gravity = 0;
    d.gravity_d = 0;
    return () => {
      d.gravity = g;
      d.gravity_d = gd;
    };
  }, [lfw, gravity]);

  useEffect(() => {
    if (!lfw || !running) return;
    lfw.world.start_update();
    return () => lfw.world.stop_update();
  }, [lfw, running]);

  // 轮询实时帧：列表高亮 + 信息刷新
  useEffect(() => {
    if (!lfw) return;
    const timer = window.setInterval(() => {
      set_cur_frame_id(entity?.frame.id ?? "");
      set_ver((v) => v + 1);
    }, 100);
    return () => window.clearInterval(timer);
  }, [lfw, entity]);

  // 锁定在中间：每帧把相机重新对准实体，动作跑起来角色也停在画面正中
  useEffect(() => {
    if (!lfw || !locked || !entity) return;
    let raf = 0;
    const tick = () => {
      raf = window.requestAnimationFrame(tick);
      focus(entity);
    };
    raf = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(raf);
  }, [lfw, locked, entity, focus]);

  /** 换数据：只换自己的预览实体，背景/别人的实体都不碰 */
  const select_data = useCallback((id: string) => {
    set_data_id(id);
    set_motion_i(-1);
    const d = lfw?.datas.find(id);
    if (d) set_cur_frame_id(spawn_entity(d)?.frame.id ?? "");
  }, [lfw, spawn_entity]);

  // 进入本 tab：上次那个预览实体还在就接着演它（切 tab 不清场），否则选列表第一个
  useEffect(() => {
    if (!lfw || data_id) return;
    const kept = last_preview_id ? lfw.world.entity_map.get(last_preview_id) : void 0;
    if (kept && kept.mounted && kept.frame.id !== FrameId.Gone) {
      set_entity(kept);
      set_motion_i(-1);
      set_data_id(kept.data.id);
      set_cur_frame_id(kept.frame.id);
      focus(kept);
      return;
    }
    // 背景归用户管：只有还没背景时才给一张空背景当底
    if (lfw.world.bg.id === Defines.VOID_BG.id && lfw.datas.find_background(DEMO_BG))
      lfw.change_bg(DEMO_BG);
    const first = list[0] ?? lfw.datas.objects[0];
    if (first) select_data(first.id);
  }, [lfw, list, data_id, select_data, focus]);

  const play_motion = (i: number) => {
    set_motion_i(i);
    const m = motions[i];
    const e = ensure_entity();
    if (!e || !m) return;
    recenter(e);
    e.enter_frame_by_id(m.frames[0].id, true);
  };

  const play_frame = (f: IFrameInfo) => {
    const e = ensure_entity();
    if (!e) return;
    recenter(e);
    e.enter_frame_by_id(f.id, true);
  };

  const replay = () => {
    if (motion) play_motion(motion_i);
    else if (frame) play_frame(frame);
  };

  const mirror = () => {
    if (entity) entity.facing = entity.facing > 0 ? -1 : 1;
  };

  return (
    <>
      <div className={csses.stage}>
        <div className={csses.canvas_box}>
          <canvas
            ref={set_canvas}
            width={794}
            height={450}
            draggable={false}
            className={csses.canvas}
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          />
          {!entity && <div className={csses.center_text}>未选择数据</div>}
          {entity && entity.frame.id === FrameId.Gone && (
            <div className={csses.center_text}>实体已消失（点动作或帧可重建）</div>
          )}
        </div>
        <div className={csses.toolbar}>
          <button className={csses.btn} onClick={() => set_running((v) => !v)} disabled={!entity}>
            {running ? "暂停" : "运行"}
          </button>
          <button className={csses.btn} onClick={() => lfw?.world.step()} disabled={!entity}>单步</button>
          <button className={csses.btn} onClick={replay} disabled={!entity}>重播</button>
          <button className={csses.btn} onClick={mirror} disabled={!entity}>镜像</button>
          <label className={csses.check}>
            <input
              type="checkbox"
              checked={locked}
              onChange={(e) => set_locked(e.target.checked)}
            />
            锁定在中间
          </label>
          <label className={csses.check}>
            <input
              type="checkbox"
              checked={hover}
              onChange={(e) => set_hover(e.target.checked)}
            />
            滞空
          </label>
          <label className={csses.check}>
            <input
              type="checkbox"
              checked={gravity}
              onChange={(e) => set_gravity(e.target.checked)}
            />
            重力
          </label>
          <div className={csses.spacer} />
          {INDICATORS.map((v) => (
            <label className={csses.check} key={v.key}>
              <input
                type="checkbox"
                checked={!!(flags & ENTITY_INDICATINGS[v.key])}
                onChange={() => set_flags((f) => f ^ ENTITY_INDICATINGS[v.key])}
              />
              {v.label}
            </label>
          ))}
        </div>
        <div className={`${csses.section} ${csses.section_fill}`}>
          <div className={csses.section_title}>
            帧列表（{shown_frames.length}）{motion ? ` · ${motion.name}` : " · 全部帧"}
          </div>
          <div className={csses.frame_list}>
            {shown_frames.map((f, i) => (
              <button
                key={f.id + "#" + i}
                className={`${csses.frame_btn}${f.id === cur_frame_id ? " " + csses.frame_btn_active : ""}`}
                title={f.name}
                onClick={() => play_frame(f)}
              >
                {f.id}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className={csses.side}>
        <div className={csses.section}>
          <div className={csses.section_title}>数据列表（{list.length}）</div>
          <div className={csses.tabs}>
            {TYPES.map((v) => (
              <button
                key={v.id}
                className={`${csses.tab}${v.id === type ? " " + csses.tab_active : ""}`}
                onClick={() => set_type(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className={csses.search_row}>
            <input
              className={csses.search}
              placeholder="搜索 id / 名称 / 分组"
              value={keyword}
              onChange={(e) => set_keyword(e.target.value)}
            />
          </div>
          <div className={csses.bg_list}>
            {list.map((v) => (
              <button
                key={v.id}
                className={`${csses.bg_item}${v.id === data_id ? " " + csses.bg_item_active : ""}`}
                onClick={() => select_data(v.id)}
              >
                <span className={csses.bg_name}>{v.base?.name || v.id}</span>
                <span className={csses.muted}>{v.id}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={`${csses.section} ${csses.section_fill}`}>
          <div className={csses.section_title}>动作列表（{motions.length}）</div>
          <div className={csses.motion_list}>
            <button
              className={`${csses.bg_item}${motion_i < 0 ? " " + csses.bg_item_active : ""}`}
              onClick={() => set_motion_i(-1)}
            >
              <span className={csses.bg_name}>全部帧</span>
              <span className={csses.muted}>{all_frames.length}</span>
            </button>
            {motions.map((m, i) => (
              <button
                key={m.name + "#" + i}
                className={`${csses.bg_item}${i === motion_i ? " " + csses.bg_item_active : ""}`}
                onClick={() => play_motion(i)}
              >
                <span className={csses.bg_name}>{m.name}</span>
                <span className={csses.muted}>{motion_ids(m)}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={csses.section}>
          <div className={csses.section_title}>信息</div>
          <div className={csses.info}>
            {entity && frame ? (
              <>
                <div className={csses.info_row}><span>数据</span><b>{entity.data.id} {entity.data.base?.name || ""}</b></div>
                <div className={csses.info_row}><span>帧</span><b>{frame.id} / {frame.name || "-"}</b></div>
                <div className={csses.info_row}><span>状态</span><b>{frame.state_name ?? frame.state}</b></div>
                <div className={csses.info_row}><span>wait</span><b>{entity.wait} / {frame.wait}</b></div>
                <div className={csses.info_row}><span>下一帧</span><b>{next_text}</b></div>
                <div className={csses.info_row}><span>模型</span><b>{frame.model?.id ?? "-"}</b></div>
                <div className={csses.info_row}><span>坐标</span><b>{Math.round(entity.position.x)}, {Math.round(entity.position.y)}, {Math.round(entity.position.z)}</b></div>
              </>
            ) : (
              <div className={csses.muted}>未选择数据</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
