// `World`（`src/LFW/World.ts`）的 TS 侧台面。C++ 侧是 `subjects/world.cpp`，op 一一对应。
//
// 用例：`cases/world/*.txt`。op：
//   wnew                                  建世界（假 `lfw` + 假 `renderer`）
//   wdump                                 世界状态摘要
//   wds <键> <值> | wdsdump               `dataset.set` / `dataset.dump_dataset()`
//   wbgdata <值> | wstagedata <值>        假 `lfw.datas` 里登记数据（背景按 `id` 扫，舞台是数组）
//   wrandbg <值…>                         假 `datas.get_random_bg` 的返回值脚本（跑完重复最后一个）
//   wdatas <oid> <值>                     假 `datas.find(oid)`
//   wplayer <id>                          假 `lfw.players` 里登记真 `PlayerInfo`
//   wcheat <名> <0|1> | wmtseed <n> | wlayer <0|1> | wcmds <0|1>
//   wbg <值> | wstage <值>                `change_bg` / `change_stage`
//   wadd <标签> <数据> | wreadd <标签>     `new Entity` + `add_entities`
//   went <标签> <字段> …                   改实体字段（hp / hpr / team / puppet / ghosted /
//                                          facing / pos / ctrl / frame / gone / ground / llen / rlen）
//   wpred <0|1>… | wlist <名>              `list_entities`（连调两次看按名缓存）
//   wdel <标签> | wdels <标签>…
//   wteam <come|move|stay|follow> <队> [<x> <y> <z> | <标签>]
//   wmark <标签> <0|1> | wgame <0|1> | wcount <键> <n> | wcountsdump
//   wclockset <ms> | wtick <ms>           假时钟（`Ditto.Clock` / `Ditto.Render`）
//   wrender <dt> | wcam | wcamdest <x> <y> | wui | wpause <0|1|2> | wfnlock <0|1>
//   wsleep | wawake | wstopupdate | wrstart | wrstop | wbase | wfps
//   wbound <标签> | wrestrict <标签> | wbounding <标签> <frame 值> <info 值>
//   wsection <x> | wrandx [exclude] | wcnt <x> | wgsadd <section> <n> | wgsdump
//   wspark <x> <y> <z> <f> | wetc <x> <y> <z> <f> | wfill <n>
//   wcol <id> <aid> <vid> <dist> | wcolsdump | wcolq <aid> <vid> | wfind <id>
//   whandle | wclear | wdispose | wreset
import { CMDS } from "../../../../src/LFW/cmds";
import { GONE_FRAME_INFO } from "../../../../src/LFW/defines";
import { Ditto } from "../../../../src/LFW/ditto/Instance";
import { Entity } from "../../../../src/LFW/entity/Entity";
import { PlayerInfo } from "../../../../src/LFW/PlayerInfo";
import { States } from "../../../../src/LFW/state/States";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";
import { World } from "../../../../src/LFW/World";

import { esc, keyOf, numHex, parseValue, readCaseLines, renderValue, splitWs } from "./trace_util";

const log: string[] = [];

function fail(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(2);
}

function num(d: unknown): string {
  return numHex(Number(d));
}
function vstr(v: unknown): string {
  return renderValue(v);
}
function flag(b: unknown): string {
  return b ? "1" : "0";
}

// `_render_worker_id`：TS 里没装渲染时是 `undefined`，端口用 0 表示「没有句柄」
// （`clock_add` 在槽为空时也回 0）⇒ 两边都打成 `u`。
function handle_str(h: number | undefined): string {
  return h === undefined || h === 0 ? "u" : num(h);
}

type Bag = Record<string, any>;

// ---------------------------------------------------------------- 假件

class FakeVector2 {
  x: number;
  y: number;
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }
}
class FakeVector3 {
  x: number;
  y: number;
  z: number;
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  set(x = 0, y = 0, z = 0): void {
    this.x = x;
    this.y = y;
    this.z = z;
  }
  copy(src: { x: number; y: number; z: number }): void {
    this.x = src.x;
    this.y = src.y;
    this.z = src.z;
  }
}

// `Ditto.Clock`：`now()` 可设、`add`/`del` 记日志；`Ditto.Render` 直通它（端口侧 `Render` 与
// `Clock` 共用一个槽）。
const clock = {
  ms: 0,
  next: 1,
  handles: new Map<number, () => void>(),
  now(): number {
    return clock.ms;
  },
  add(h: () => void): number {
    const id = clock.next++;
    clock.handles.set(id, h);
    log.push(`h:clockadd=${id}`);
    return id;
  },
  del(id: number): void {
    log.push(`h:clockdel=${id}`);
    clock.handles.delete(id);
  },
  hidden(): boolean {
    return false;
  },
};

// `Ditto.Render`（`DittoImpl/Render.ts`）：raf 式的**重复**回调 ⇒ `add` 一次、每帧都跑，
// `del` 才摘。`World.start_render` 的渲染循环按这个语义写。
const fakeRenderScheduler = {
  next: 1,
  handles: new Map<number, (time?: number) => void>(),
  add(h: (time?: number) => void): number {
    const id = fakeRenderScheduler.next++;
    fakeRenderScheduler.handles.set(id, h);
    log.push(`h:renderadd=${id}`);
    return id;
  },
  del(id: number): void {
    log.push(`h:renderdel=${id}`);
    fakeRenderScheduler.handles.delete(id);
  },
  frame(): void {
    for (const h of Array.from(fakeRenderScheduler.handles.values())) h(clock.ms);
  },
};
const fakeRender = {
  add: (h: () => void) => fakeRenderScheduler.add(h),
  del: (id: number) => fakeRenderScheduler.del(id),
};

// `Ditto.Timeout`：`Ticker` 的 `schedule()` 走这一支（`delay > sleep_threshold` 时）。
// `add(handler, timeout)` 是**一次性**的（`setTimeout` 语义）⇒ 到点跑完就摘掉。
const fakeTimeout = {
  next: 1,
  handles: new Map<number, { at: number; fn: () => void }>(),
  add(fn: () => void, timeout: number): number {
    const id = fakeTimeout.next++;
    fakeTimeout.handles.set(id, { at: clock.ms + timeout, fn });
    log.push(`h:timeoutadd=${id}:${numHex(timeout)}`);
    return id;
  },
  del(id: number): void {
    log.push(`h:timeoutdel=${id}`);
    fakeTimeout.handles.delete(id);
  },
  tickDue(): void {
    const due: Array<() => void> = [];
    for (const [id, h] of [...fakeTimeout.handles]) {
      if (h.at <= clock.ms) {
        due.push(h.fn);
        fakeTimeout.handles.delete(id);
      }
    }
    for (const h of due) h();
  },
};

// `Ditto.WorldRender`：构造里只是 `new` 一下，随后就被换掉 ⇒ 什么都不做（不记日志）。
class FakeWorldRender {
  constructor(_world: unknown) {}
  add_entity(): void {}
  del_entity(): void {}
  render(): void {}
  dispose(): void {}
}

// 世界构造后换上的假渲染器（端口侧是注入的 `IWorldRenderer`）。
const renderer = {
  add_entity: (e: Entity) => log.push(`h:radd=${e.id}`),
  del_entity: (e: Entity) => log.push(`h:rdel=${e.id}`),
  // 真渲染器要花时间：假件按「第 i 次渲染花 3 + 2i 毫秒」推进假时钟 ⇒ `render_once` 量到的
  // `spent` 非 0（否则 `render_cost` 恒 0，平滑那两行就永远等价）。
  render: (dt: number) => {
    log.push(`h:render=${numHex(dt)}`);
    clock.ms += 3 + 2 * render_calls;
    render_calls += 1;
  },
  dispose: () => log.push(`h:rdispose`),
};
let render_calls = 0;

const mt = new MersenneTwister(0);
let id_counter = 0;
let team_counter = 0;
const bg_datas: any[] = [];
const stage_datas: any[] = [];
const datas_find = new Map<string, unknown>();
const players = new Map<string, PlayerInfo>();
const cheats = new Set<string>();
const layers: { ui: unknown }[] = [];
let randbg_script: unknown[] = [];
let randbg_cursor = 0;
let cmds: string[] = [];
let devFlag = false;
const created: Entity[] = [];

// 假控制器：`is_bot_ctrl` / `is_human_ctrl` / `is_ball_ctrl` 读的是三个布尔字段。
let ctrl_counter = 0;
const ctrl_ids = new Map<object, number>();
const ctrl_kinds = new Map<object, string>();
function make_ctrl(kind: string): unknown {
  if (kind === "none") return null;
  const id = ++ctrl_counter;
  const base: Bag = {
    __is_base_ctrl__: true,
    player_id: kind === "base" ? "" : "7",
    player: { id: 7, name: "P7", mine: true },
    // `Entity.update` 会 `const { result, keys } = this.ctrl.update()`：没按键的基类控制器
    // 给 `result = undefined`（端口那侧是真 `BaseController::update()`，同样落空）。
    update: () => ({ result: undefined, keys: undefined }),
    come: (x: number, y: number, z: number) =>
      log.push(`h:come=${id}:${numHex(x)},${numHex(y)},${numHex(z)}`),
    move: () => log.push(`h:movectl=${id}`),
    stay: () => log.push(`h:stay=${id}`),
    follow: (_t: unknown) => log.push(`h:follow=${id}`),
    update_lookup: (i: number) => log.push(`h:lookup=${id}:${numHex(i)}`),
  };
  if (kind === "bot") {
    base.__is_bot_ctrl__ = true;
    base.goingto = true;
  }
  if (kind === "human") base.__is_human_ctrl__ = true;
  if (kind === "ball") base.__is_ball_ctrl__ = true;
  ctrl_ids.set(base, id);
  ctrl_kinds.set(base, kind);
  return base;
}

// `wbulk` 用的最小实体数据（`base` 给 `reset`，`frames` 给 `update`）。
function bulkData(): Bag {
  return {
    type: 8,
    base: { name: "BULK", resting_max: 5 },
    frames: { 0: { id: "0", state: 1, wait: 2 } },
  };
}

function ctrl_id_of(c: unknown): string {
  const id = c !== null && c !== undefined ? ctrl_ids.get(c as object) : undefined;
  return id === undefined ? "-1" : String(id);
}

// `lfw`：TS 侧用对象字面量假件（与端口侧台面的假 `lfw` 一一对应）。
const fakeLfw: Bag = {
  // `Stage` 里有几处读 `this.lfw.world.*`（`dispose` 的玩家队伍表）；真 `LFW.world` 就是那个
  // 世界 ⇒ 假件把它接回来（端口侧对应 `IStageWorld` 视图）。
  get world(): unknown {
    return world;
  },
  get new_id(): string {
    id_counter += 1;
    log.push(`h:newid=${id_counter}`);
    return "e" + id_counter;
  },
  get new_team(): string {
    team_counter += 1;
    return "t" + team_counter;
  },
  mt,
  // `LFW.acquire_collision()`（`LFW.ts:890`）从 `Graves` 取，而池子**没有任何回收者**
  // ⇒ 永远 `undefined`（调用点 `|| {}` 兜住）。端口那边这个池子是宿主私有的（不经过
  // 测试台）⇒ 这里必须**静默**，否则两边日志对不上。
  acquire_collision: () => undefined,
  players: {
    get: (pid: unknown) => {
      log.push(`h:player=${vstr(pid)}`);
      return players.get(String(pid));
    },
    has: (pid: unknown) => players.has(String(pid)),
  },
  datas: {
    backgrounds: {
      // `Stage` / `World` 里读的是 `datas.backgrounds.find(v => v.id === bid)`（数组的 `find`）；
      // 端口那边是同义的 `datas_backgrounds_find(bid)` ⇒ 两边都记 `h:bgfind=`，语义都是**第一个**匹配。
      find: (predicate: (v: unknown) => boolean) => {
        for (const d of bg_datas) {
          if (predicate(d)) {
            log.push(`h:bgfind=${vstr((d as Bag).id)}`);
            return d;
          }
        }
        log.push(`h:bgfind=u`);
        return undefined;
      },
    },
    stages: {
      find: (predicate: (v: unknown) => boolean) => {
        for (const d of stage_datas) {
          if (predicate(d)) {
            log.push(`h:stagefind=${vstr((d as Bag).id)}`);
            return d;
          }
        }
        log.push(`h:stagefind=u`);
        return undefined;
      },
    },
    find: (oid: unknown) => {
      log.push(`h:datasfind=${vstr(oid)}`);
      return datas_find.get(String(oid));
    },
    find_background: (bid: unknown) => {
      for (const d of bg_datas) {
        if ((d as Bag).id === bid) {
          log.push(`h:bgfind=${vstr((d as Bag).id)}`);
          return d;
        }
      }
      log.push(`h:bgfind=u`);
      return undefined;
    },
    get_random_bg: (groups: unknown[]) => {
      log.push(`h:randbg=${groups.map(vstr).join(",")}`);
      if (randbg_script.length === 0) return undefined;
      const v = randbg_script[Math.min(randbg_cursor, randbg_script.length - 1)];
      if (randbg_cursor < randbg_script.length - 1) randbg_cursor++;
      return v;
    },
  },
  factory: {
    // `lfw.factory.create_buff(kind, lfw, id)`：碰撞的 buff 缝（`handle_itr_kind_magic_flute`
    // / `grant_buff`）。端口由宿主回答（`IWorldLfw::create_buff`），测试台默认「造不出」。
    create_buff: () => undefined,
    create_entity: (w: unknown, data: unknown) => {
      const e = new Entity(w as never, data as never, states as never);
      created.push(e);
      log.push(`h:create=${e.id}`);
      return e;
    },
    recycle_entity: (e: Entity) => log.push(`h:recycle=${e.id}`),
    recycle_buff: () => log.push(`h:recyclebuff`),
    acquire_ctrl: () => {
      log.push(`h:acquire`);
      return make_ctrl("base");
    },
    release_ctrl: (c: unknown) => log.push(`h:release=${ctrl_id_of(c)}`),
    create_ctrl: (data_id: unknown, pid: unknown) =>
      log.push(`h:createctrl=${vstr(data_id)}:${vstr(pid)}`),
  },
  layers,
  cmds: [] as string[],
  is_cheat: (name: unknown) => {
    log.push(`h:cheat=${vstr(name)}`);
    return cheats.has(String(name));
  },
  game_mode: undefined,
  survival_rank_available: false,
  broadcasts: [] as unknown[],
  broadcast: (m: unknown) => log.push(`h:broadcast=${vstr(m)}`),
  warn: (...args: unknown[]) => log.push(`h:warn=${esc(String(args[0]))}`),
  sounds: {
    play_bgm: (m: unknown) => {
      log.push(`h:playbgm=${vstr(m)}`);
      return () => log.push(`h:stopbgm`);
    },
    stop_bgm: () => log.push(`h:stopbgm_now`),
    play: (...args: unknown[]) => log.push(`h:sound=${args.map(vstr).join(",")}`),
  },
  end_testers: () => [],
  datas_randoming_by_group: () => undefined,
  create_entity_with_bot: () => undefined,
};


// ---------------------------------------------------------------- 世界

let states: States;
let world: World;
let ents = new Map<string, Entity>();
let preds: boolean[] = [];

function w(): Bag {
  return world as unknown as Bag;
}

function ent_of(label: string): Entity {
  const e = ents.get(label);
  if (!e) fail(`no such entity '${label}'`);
  return e!;
}

function list_of(v: unknown[]): string {
  if (v.length === 0) return "-";
  return v.map((e) => (e ? (e as Entity).id : "z")).join(",");
}

function terr(v: unknown): string {
  const o = (v ?? {}) as Bag;
  return (
    `${esc(String(o.id))},${esc(String(o.name))},${num(o.type)}` +
    `,${num(o.x1)},${num(o.x2)},${num(o.z1)},${num(o.z2)},${num(o.h1)},${num(o.h2)}`
  );
}

function dump_entity(e: Entity | null): string {
  if (!e) return "z";
  const b = e as Bag;
  return (
    `${e.id}:${esc(String(e.team))}:${num(e.hp)}:${vstr((e.frame as Bag)?.id)}` +
    `:${flag(e.ghosted)}:${flag(e.puppet)}:${num(e.position.x)}:${num(e.position.y)}` +
    `:${num(e.position.z)}:${vstr(e.state)}:${num(b.aabb_min_x)}` +
    // 碰撞那一刀（4L）要的观测量：硬直 / 抖动、抓与被抓、持有、vrest 与两张碰撞表。
    `:${num(b.motionless)}:${num(b.shaking)}:${id_ref(b.catching)}:${id_ref(b.catcher)}` +
    `:${id_ref(b.holding)}:${num((b.vrests as Bag)?.size)}:${num(b.collided_list?.length)}` +
    `:${num(b.collision_list?.length)}:${num(b.resting)}:${num(b.fall_value)}` +
    `:${flag(e.is_on_ground)}:${num(b.arest)}` +
    // 4P：`Whirlwind` / `weapon_is_hit` / `ball_*` / `handle_injury` 的效果都落在速度上
    // （位置要等下一帧才动）⇒ 把速度也当观测量。
    `:${num(e.velocity.x)}:${num(e.velocity.y)}:${num(e.velocity.z)}` +
    `:${num(e.prev_velocity.x)}:${num(e.prev_velocity.y)}:${num(e.prev_velocity.z)}`
  );
}

// `catching` / `catcher` / `holding`：没有给 `-`，有就给 id（`esc` 过）。
function id_ref(e: Bag | null | undefined): string {
  return e ? esc(String(e.id)) : "-";
}

// `wfill` 会往幽灵表里塞 null（只为了让 `entities.length + ghosts.length` 变大）⇒ 跳过。
function dump_list(list: Entity[]): string {
  const parts: string[] = [];
  for (const e of list) if (e) parts.push(dump_entity(e));
  return parts.join(";") || "-";
}

function dump(): void {
  const b = w();
  const em = world.entity_map as Map<string, Entity>;
  const pup = world.puppets as Map<string, Entity>;
  const cols = b.collisions as Map<string, Bag>;
  const counts = b._counts as Map<string, number>;
  const talive = b.team_alive_counts as Map<string, number>;
  const gwc = world.ground_weapon_counts as Map<number, number>;
  const cam = world.camera.position;
  log.push(
    `dump|bg=${vstr(world.bg?.id)}|st=${vstr(world.stage?.id)}` +
      `|z=${num(world.transform.scale_x)},${num(world.transform.scale_y)},${num(world.transform.scale_z)}` +
      `|cam=${num(cam.x)},${num(cam.y)}` +
      `|n=${world.entities.length}|g=${world.ghosts.length}` +
      `|map=${[...em.keys()].join(",") || "-"}` +
      `|pup=${[...pup.entries()].map(([k, v]) => `${k}:${v?.id ?? "z"}`).join(",") || "-"}` +
      `|pt=${[...(b.puppet_teams as Set<string>)].join(",") || "-"}` +
      `|col=${cols.size}|talive=${[...talive.entries()].map(([k, v]) => `${k}:${num(v)}`).join(",") || "-"}` +
      `|alive=${b._alive_players.size}|hpa=${flag(world.has_players_alive)}` +
      `|paused=${num(b._paused)}|fn=${num(b._fn_locked)}|sleep=${flag(b._sleeping)}` +
      `|needf=${flag(b._need_FPS)}|needu=${flag(b._need_UPS)}` +
      `|life=${num(world.lifetime)}|time=${num(world.game_time)}|TU=${num(world.TU)}|es=${num(world.extra_steps)}` +
      `|rc=${num(world.render_cost)}|pc=${num(world.pairs_compared)}|fps=${num(b._FPS.value)}` +
      `|ticker=${flag(!!b._update_worker)}|worker=${handle_str(b._render_worker_id)}` +
      `|cmds=${cmds.length}|bc=${(fakeLfw.broadcasts as unknown[]).length}` +
      `|cnt=${[...counts.entries()].map(([k, v]) => `${esc(k)}:${num(v)}`).join(",") || "-"}` +
      `|gwc=${[...gwc.entries()].map(([k, v]) => `${num(k)}:${num(v)}`).join(",") || "-"}` +
      `|ents=${dump_list(world.entities)}` +
      `|ghosts=${dump_list(world.ghosts)}` +
      `|bd=${num(world.player_l)},${num(world.player_r)},${num(world.left)},${num(world.right)},` +
      `${num(world.near)},${num(world.far)},${num(world.width)},${num(world.depth)},` +
      `${num(world.middle?.x)},${num(world.middle?.z)}` +
      `|lim=${flag(world.stage_limit)}|wp=${flag(world.stage.world_pause)}` +
      `|sf=${flag(world.stage.is_stage_finish)}|cf=${flag(world.stage.is_chapter_finish)}` +
      `|spt=${num(world.stage.phase_time)}|sft=${num(world.stage.time)}|bgu=${num((world.bg as unknown as Bag)._update_times)}`,
  );
}

function make_world(): void {
  world = new World(fakeLfw as never);
  (world as unknown as Bag).renderer = renderer;
  log.push(`new|bg=${vstr(world.bg?.id)}|st=${vstr(world.stage?.id)}|r=${flag(!!world.renderer)}`);
}

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) fail("usage: lfw_trace_world.mjs <case-file>");

  Ditto.setup({
    Vector2: FakeVector2,
    Vector3: FakeVector3,
    Clock: clock,
    Render: fakeRender,
    WorldRender: FakeWorldRender,
    // `Ditto.warn` 是全局告警：两参形式是 `Stage` 的那一处（端口对应 `Stage::set_warn`），
    // 单参形式是世界自己发的（端口对应 `IWorldLfw::warn`）。
    warn: (...args: unknown[]) => {
      if (args.length > 1) log.push(`warn:${String(args[0])}:${String(args[1])}`);
      else log.push(`h:warn=${esc(String(args[0]))}`);
    },
    Cache: {
      get: () => new Promise(() => {}),
      del: () => new Promise(() => {}),
      put: () => new Promise(() => {}),
      list: () => new Promise(() => {}),
    },
    JSON5: { parse: (t: string) => JSON.parse(t), stringify: (v: unknown) => JSON.stringify(v) },
    debug: (msg: unknown) => log.push(`h:debug=${String(msg)}`),
    Timeout: fakeTimeout,
    DEV: false,
  } as never);

  // `CMDS.handle` 在端口侧是宿主缝（`IWorldLfw::handle_cmds`）⇒ 用一个探针命令把「到底有没有
  // 被调到」变成一条同样的日志。
  CMDS.register("__probe__", "", () => log.push("h:handlecmds"));

  states = new States();

  // `World::on_step_error` 在 TS 里读 `Date.now()`；端口把 `Date.now()` 收进时钟槽（`Ditto.Clock`）
  // ⇒ 台面把 `Date.now` 接到同一个假时钟上。
  (Date as unknown as Bag).now = () => clock.ms;

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;
    const i = [1];
    const b = () => w();

    if (op === "wnew") {
      make_world();
    } else if (op === "wdump") {
      dump();
    } else if (op === "wds") {
      const key = keyOf(t[i[0]!++]!);
      // TS 侧 `dataset` 是个带 setter 拦截的对象（`make_private_properties`）⇒ 直接赋值；
      // 端口把那次拦截收成 `dataset.set(key, value)`（见 DESIGN「WorldDataset」一节）。
      (world.dataset as Bag)[key] = parseValue(t, i);
    } else if (op === "wdsdump") {
      log.push(`ds|${vstr(world.dataset.dump_dataset())}`);
    } else if (op === "wbgdata") {
      bg_datas.push(parseValue(t, i));
    } else if (op === "wstagedata") {
      stage_datas.push(parseValue(t, i));
    } else if (op === "wrandbg") {
      randbg_script = [];
      randbg_cursor = 0;
      while (i[0]! < t.length) randbg_script.push(parseValue(t, i));
    } else if (op === "wdatas") {
      const oid = keyOf(t[i[0]!++]!);
      datas_find.set(oid, parseValue(t, i));
    } else if (op === "wplayer") {
      const pid = keyOf(t[i[0]!++]!);
      players.set(pid, new PlayerInfo(pid, undefined as never, undefined as never, undefined as never));
    } else if (op === "wplayerfighter") {
      const pid = keyOf(t[i[0]!++]!);
      const p = players.get(pid);
      log.push(`pfighter|${p?.fighter ? p.fighter.id : "-"}`);
    } else if (op === "wcheat") {
      const name = keyOf(t[i[0]!++]!);
      const on = t[i[0]!++]!;
      if (on === "1") cheats.add(name);
      else cheats.delete(name);
    } else if (op === "wmtseed") {
      mt.reset(Number(parseValue(t, i)));
    } else if (op === "wlayer") {
      const disabled = t[i[0]!++]!;
      const index = layers.length;
      layers.push({
        ui: {
          disabled: disabled === "1",
          update: (dt: number) => log.push(`h:ui=${index}:${numHex(dt)}`),
        },
      });
    } else if (op === "wcmds") {
      cmds = t[i[0]!++]! === "1" ? ["__probe__"] : [];
      fakeLfw.cmds = cmds;
    } else if (op === "wbcpush") {
      (fakeLfw.broadcasts as unknown[]).push(t[i[0]!++]!);
      log.push(`bcpush=${(fakeLfw.broadcasts as unknown[]).length}`);
    } else if (op === "wbg") {
      world.change_bg(parseValue(t, i) as never);
    } else if (op === "wstage") {
      world.change_stage(parseValue(t, i) as never);
    } else if (op === "wmk") {
      const label = t[i[0]!++]!;
      const e = new Entity(world as never, parseValue(t, i) as never, states as never);
      ents.set(label, e);
      log.push(`mk|${label}|id=${e.id}`);
    } else if (op === "wadd") {
      const label = t[i[0]!++]!;
      const e = new Entity(world as never, parseValue(t, i) as never, states as never);
      ents.set(label, e);
      world.add_entities(e);
      log.push(`add|${label}|id=${e.id}`);
    } else if (op === "wreadd") {
      const e = ent_of(t[i[0]!++]!);
      world.add_entities(e);
      log.push(`readd|${e.id}`);
    } else if (op === "wgeom") {
      // 与 C++ 的 `EntityCollisionView::frame_centery/frame_height/frame_pic_h` 同读法。
      const label = t[i[0]!++]!;
      const e = ent_of(label);
      const f = (e.frame ?? {}) as Record<string, unknown>;
      const pic = f["pic"] as Record<string, unknown> | undefined;
      log.push(
        `geom|${label}|cy=${num(f["centery"] ?? 0)}|ht=${num(f["height"] ?? 0)}|ph=${num(pic?.["h"] ?? 0)}`,
      );
    } else if (op === "wattach") {
      // `Entity.attach`（`Buff::show_effect` 的 `effect.attach(true)` 同路）。
      const label = t[i[0]!++]!;
      const on = t[i[0]!++]! === "1";
      const e = ent_of(label);
      e.attach(on);
      log.push(
        `attach|${label}|mounted=${num((e as unknown as Bag)._mounted)}|n=${num(world.entities.length)}|g=${num(world.ghosts.length)}`,
      );
    } else if (op === "went") {
      const e = ent_of(t[i[0]!++]!);
      const field = t[i[0]!++]!;
      if (field === "hp") e.hp = Number(parseValue(t, i));
      else if (field === "hpr") e.hp_r = Number(parseValue(t, i));
      else if (field === "team") e.team = keyOf(t[i[0]!++]!);
      else if (field === "puppet") e.puppet = t[i[0]!++]! === "1";
      else if (field === "ghosted") (e as unknown as Bag)._ghosted = t[i[0]!++]! === "1" ? 1 : 0;
      else if (field === "facing") e.facing = Number(parseValue(t, i));
      else if (field === "pos") {
        e.position.set(Number(parseValue(t, i)), Number(parseValue(t, i)), Number(parseValue(t, i)));
      } else if (field === "ctrl") e.ctrl = make_ctrl(t[i[0]!++]!) as never;
      else if (field === "pid") (e.ctrl as Bag).player_id = keyOf(t[i[0]!++]!);
      else if (field === "mine") (e.ctrl as Bag).player.mine = t[i[0]!++]! === "1";
      else if (field === "frame") e.set_frame(parseValue(t, i) as never);
      else if (field === "gone") e.set_frame(GONE_FRAME_INFO as never);
      else if (field === "ground") e.is_on_ground = t[i[0]!++]! === "1";
      else if (field === "llen") (e as unknown as Bag).l_len = Number(parseValue(t, i));
      else if (field === "rlen") (e as unknown as Bag).r_len = Number(parseValue(t, i));
      else if (field === "bearer") {
        const tok = t[i[0]!++]!;
        (e as unknown as Bag).bearer = tok === "none" ? null : ent_of(tok);
      } else if (field === "catcher") {
        const tok = t[i[0]!++]!;
        (e as unknown as Bag).catcher = tok === "none" ? null : ent_of(tok);
      } else fail(`unknown entity field '${field}'`);
      log.push(`ent|${e.id}|${field}`);
    } else if (op === "wentump") {
      const e = ent_of(t[i[0]!++]!);
      log.push(`entdump|${e.id}|${dump_entity(e)}`);
    } else if (op === "wteamsame") {
      const e = ent_of(t[i[0]!++]!);
      e.team = String(world.stage?.team);
      log.push(`teamsame|${e.id}|${esc(e.team)}`);
    } else if (op === "wpred") {
      preds = [];
      while (i[0]! < t.length) preds.push(t[i[0]!++]! === "1");
    } else if (op === "wlist") {
      const name = t[i[0]!++]!;
      const script = preds;
      const r1 = world.list_entities(name, (o) => {
        const v = script.length ? script.shift()! : false;
        log.push(`p:${o.id}=${flag(v)}`);
        return v;
      });
      const r2 = world.list_entities(name, (o) => {
        log.push(`q:${o.id}`);
        return true;
      });
      log.push(`list|${esc(name)}|r1=${list_of(r1 as never)}|r2=${list_of(r2 as never)}`);
    } else if (op === "wdel") {
      const e = ent_of(t[i[0]!++]!);
      world.del_entity(e);
      log.push(`del|${e.id}`);
    } else if (op === "wdels") {
      const list: Entity[] = [];
      while (i[0]! < t.length) list.push(ent_of(t[i[0]!++]!));
      world.del_entities(list);
      log.push(`dels|${list.length}`);
    } else if (op === "wteam") {
      const what = t[i[0]!++]!;
      const team = keyOf(t[i[0]!++]!);
      if (what === "come") {
        const x = Number(parseValue(t, i));
        const y = Number(parseValue(t, i));
        const z = Number(parseValue(t, i));
        world.team_come(team, x, y, z);
      } else if (what === "move") world.team_move(team);
      else if (what === "stay") world.team_stay(team);
      else if (what === "follow") world.team_follow(ent_of(t[i[0]!++]!));
      else fail(`bad team op '${what}'`);
      log.push(`team|${what}|${esc(team)}`);
    } else if (op === "wmark") {
      const e = ent_of(t[i[0]!++]!);
      const alive = t[i[0]!++]! === "1";
      world.mark_players_alive(e, alive);
      log.push(`mark|${e.id}|${flag(alive)}|${flag(world.has_players_alive)}|${b()._alive_players.size}`);
    } else if (op === "wgame") {
      const refresh = t[i[0]!++]! === "1";
      const r = world.game_result(refresh);
      log.push(
        `game=${r === "" ? "-" : esc(String(r))}` +
          `|talive=${[...(b().team_alive_counts as Map<string, number>).entries()]
            .map(([k, v]) => `${esc(k)}:${num(v)}`)
            .join(",") || "-"}` +
          `|pt=${[...(b().puppet_teams as Set<string>)].join(",") || "-"}`,
      );
    } else if (op === "wcount") {
      const key = keyOf(t[i[0]!++]!);
      world.add_count(key, Number(parseValue(t, i)));
    } else if (op === "wcountsdump") {
      log.push(
        `counts|${[...(b()._counts as Map<string, number>).entries()]
          .map(([k, v]) => `${esc(k)}:${num(v)}`)
          .join(",") || "-"}`,
      );
    } else if (op === "wclockset") {
      clock.ms = Number(parseValue(t, i));
      log.push(`clock=${num(clock.ms)}`);
    } else if (op === "wtick") {
      const ms = Number(parseValue(t, i));
      clock.ms += ms;
      log.push(`clock=${num(clock.ms)}`);
      // 真 `Clock.ts` 的 `flush`：待发批次跑一遍就清空（一次性）。
      const batch = Array.from(clock.handles.values());
      clock.handles.clear();
      // 真渲染循环把**当前时间**当第一个参数交给回调（端口侧的回调自己读时钟槽）
      for (const h of batch) h(clock.ms);
      fakeTimeout.tickDue();
      fakeRenderScheduler.frame();
    } else if (op === "wrender") {
      world.render_once(Number(parseValue(t, i)));
      log.push(`rc=${num(world.render_cost)}`);
    } else if (op === "wcam") {
      world.update_camera();
    } else if (op === "wcamdest") {
      world.camera.destination.x = Number(parseValue(t, i));
      world.camera.destination.y = Number(parseValue(t, i));
      log.push(`camdest=${num(world.camera.destination.x)},${num(world.camera.destination.y)}`);
    } else if (op === "wcamt") {
      log.push(`camt=${num(world.camera.destination.x)},${num(world.camera.destination.y)}`);
    } else if (op === "wtrscaleto") {
      const x = Number(parseValue(t, i));
      const y = Number(parseValue(t, i));
      const z = Number(parseValue(t, i));
      const rate = Number(parseValue(t, i));
      world.transform.scale_to(x, y, z, { rate } as never);
      log.push(
        `trscale=${num(world.transform.scale_x)},${num(world.transform.scale_y)},${num(
          world.transform.scale_z,
        )}`,
      );
    } else if (op === "wui") {
      (b().update_ui as () => void).call(world);
    } else if (op === "wpause") {
      (b().set_paused as (v: number) => void).call(world, Number(parseValue(t, i)));
      log.push(`paused=${num(b()._paused)}`);
    } else if (op === "wfnlock") {
      (b().set_fn_locked as (v: number) => void).call(world, Number(parseValue(t, i)));
      log.push(`fnlock=${num(b()._fn_locked)}`);
    } else if (op === "wsleep") {
      world.sleep();
      log.push(`sleep=${flag(b()._sleeping)}`);
    } else if (op === "wawake") {
      world.awake();
      log.push(`sleep=${flag(b()._sleeping)}`);
    } else if (op === "wstopupdate") {
      world.stop_update();
      log.push(`ticker=${flag(!!b()._update_worker)}`);
    } else if (op === "wstep") {
      world.step();
    } else if (op === "wupdate") {
      (b().update_once as (dt: number) => void).call(world, Number(parseValue(t, i)));
    } else if (op === "wcatchup") {
      (b().catch_up as () => void).call(world);
    } else if (op === "wrupdate") {
      world.start_update();
      log.push(`ticker=${flag(!!b()._update_worker)}`);
    } else if (op === "wticker") {
      const tk = b()._update_worker as Bag | undefined;
      if (!tk) log.push("tk=-");
      else
        log.push(
          `tk=${flag(tk._running)}:${flag(tk._pending)}:${flag(tk._paused)}` +
            `:${num(tk._base)}:${num(tk._span)}:${num(tk._deadline)}:${num(tk._last_step)}` +
            `:${num(tk._rate)}:${num(tk.cost)}:${num(b().TU)}`,
        );
    } else if (op === "whook") {
      const which = t[i[0]!++]!;
      b().before_update = which === "none" ? undefined : () => { log.push("h:before"); };
      b().after_update = which === "after" || which === "both" ? () => { log.push("h:after"); } : undefined;
      if (which === "sleep") {
        b().before_update = () => {
          log.push("h:before");
          (b().sleep as () => void).call(world);
        };
      }
      if (which === "setsync") {
        b().before_update = () => {
          (world.dataset as unknown as Bag).sync_render = 0;
          log.push("h:setsync");
        };
      }
      log.push(`hook=${which}`);
    } else if (op === "wextra") {
      b().extra_steps = Number(parseValue(t, i));
      log.push(`es=${num(b().extra_steps)}`);
    } else if (op === "wexbudget") {
      b().extra_step_budget_ms = Number(parseValue(t, i));
      log.push(`exbudget=${num(b().extra_step_budget_ms)}`);
    } else if (op === "wdev") {
      devFlag = t[i[0]!++]! === "1";
      Ditto.DEV = devFlag;
      log.push(`dev=${flag(devFlag)}`);
    } else if (op === "wbulk") {
      // 只为把 `entities` 撑过 `MAX_DEBUG_ENTITIES`（356）⇒ 造 n 个同数据的真实体，不记日志。
      const n = Number(parseValue(t, i));
      for (let k = 0; k < n; k++) {
        const e = new Entity(world, bulkData(), states as never);
        (e as Bag).ctrl = make_ctrl("base");
        world.add_entities(e);
      }
      log.push(`bulk=${world.entities.length}`);
    } else if (op === "wneedfps") {
      b()._need_FPS = t[i[0]!++]! === "1";
      log.push(`needf=${flag(b()._need_FPS)}`);
    } else if (op === "wneedups") {
      b()._need_UPS = t[i[0]!++]! === "1";
      log.push(`needu=${flag(b()._need_UPS)}`);
    } else if (op === "wrstart") {
      world.start_render();
      log.push(`worker=${handle_str(b()._render_worker_id)}`);
    } else if (op === "wrstop") {
      world.stop_render();
      log.push(`worker=${handle_str(b()._render_worker_id)}`);
    } else if (op === "wbase") {
      log.push(`base=${num((b().base_step_ms as () => number).call(world))}`);
    } else if (op === "wfps") {
      const f = world.FPS;
      log.push(`fps=${f === undefined || Number.isNaN(f) ? "u" : num(f)}`);
    } else if (op === "wbound") {
      const e = ent_of(t[i[0]!++]!);
      const r = world.get_bound(e);
      log.push(`bound|${e.id}|${r.map(num).join(",")}`);
    } else if (op === "wrestrict") {
      const e = ent_of(t[i[0]!++]!);
      const r = world.restrict(e);
      log.push(
        `restrict|${e.id}|${num(r.x)},${num(r.y)},${num(r.z)}` +
          `|pos=${num(e.position.x)},${num(e.position.y)},${num(e.position.z)}` +
          `|fid=${vstr((e.frame as Bag)?.id)}` +
          `|terr=${terr(e.terrain)}`,
      );
    } else if (op === "wbounding") {
      const e = ent_of(t[i[0]!++]!);
      const f = parseValue(t, i);
      const info = parseValue(t, i);
      const r = world.get_bounding(e, f as never, info as never);
      log.push(
        `bounding|${e.id}|${num(r.left)},${num(r.right)},${num(r.top)},` +
          `${num(r.bottom)},${num(r.far)},${num(r.near)}`,
      );
    } else if (op === "wsection") {
      log.push(`section=${num(world.weapon_section_at(Number(parseValue(t, i))))}`);
    } else if (op === "wrandx") {
      const ex = i[0]! < t.length ? Number(parseValue(t, i)) : undefined;
      log.push(`randx=${num(world.random_weapon_x(ex))}`);
    } else if (op === "wcnt") {
      log.push(`wcnt=${num(world.weapon_count_at(Number(parseValue(t, i))))}`);
    } else if (op === "wgsadd") {
      const section = Number(parseValue(t, i));
      const count = Number(parseValue(t, i));
      (world.ground_weapon_counts as Map<number, number>).set(section, count);
    } else if (op === "wgsdump") {
      log.push(
        `gwc|${[...(world.ground_weapon_counts as Map<number, number>).entries()]
          .map(([k, v]) => `${num(k)}:${num(v)}`)
          .join(",") || "-"}`,
      );
    } else if (op === "wspark") {
      const x = Number(parseValue(t, i));
      const y = Number(parseValue(t, i));
      const z = Number(parseValue(t, i));
      const f = String(parseValue(t, i));
      const before = created.length;
      world.spark(x, y, z, f);
      const e = created.length > before ? created[created.length - 1]! : undefined;
      log.push(
        e
          ? `spark|${e.id}|${num(e.outline_alpha)},${num(e.outline_width)},${esc(String(e.outline_color))}` +
            `|pos=${num(e.position.x)},${num(e.position.y)},${num(e.position.z)}` +
            `|fid=${vstr((e.frame as Bag)?.id)}|ghosted=${flag(e.ghosted)}`
          : "spark|none",
      );
    } else if (op === "wetc") {
      const x = Number(parseValue(t, i));
      const y = Number(parseValue(t, i));
      const z = Number(parseValue(t, i));
      const f = String(parseValue(t, i));
      const before = created.length;
      world.etc(x, y, z, f);
      const e = created.length > before ? created[created.length - 1]! : undefined;
      log.push(
        e
          ? `etc|${e.id}|pos=${num(e.position.x)},${num(e.position.y)},${num(e.position.z)}` +
            `|fid=${vstr((e.frame as Bag)?.id)}`
          : "etc|none",
      );
    } else if (op === "wfill") {
      const n = Number(parseValue(t, i));
      const g = w().ghosts as unknown[];
      g.length = 0;
      for (let k = 0; k < n; k++) g.push(null);
      log.push(`fill=${g.length}`);
    } else if (op === "wcol") {
      const id = keyOf(t[i[0]!++]!);
      const aid = keyOf(t[i[0]!++]!);
      const vid = keyOf(t[i[0]!++]!);
      const dist = Number(parseValue(t, i));
      (b().add_collision as (c: unknown) => void).call(world, {
        id,
        aid,
        vid,
        m_distance: dist,
      });
      log.push(`col|${esc(id)}`);
    } else if (op === "wcolsdump") {
      const cols = b().collisions as Map<string, Bag>;
      log.push(
        `cols|${[...cols.entries()]
          .map(([k, v]) => `${esc(k)}:${esc(String(v.aid))}:${esc(String(v.vid))}:${num(v.m_distance)}`)
          .join(",") || "-"}`,
      );
    } else if (op === "wcolq") {
      const aid = keyOf(t[i[0]!++]!);
      const vid = keyOf(t[i[0]!++]!);
      const c = world.get_collision(aid, vid);
      const all = world.get_collisions(aid, vid);
      log.push(
        `colq|${esc(aid)},${esc(vid)}|one=${c ? esc(String(c.id)) + ":" + num(c.m_distance) : "-"}` +
          `|has=${flag(world.has_collision(aid, vid))}` +
          `|all=${all.map((x) => esc(String(x.id))).join(",") || "-"}`,
      );
    } else if (op === "wfind") {
      const e = world.find_entity(keyOf(t[i[0]!++]!));
      log.push(`find=${e ? e.id : "-"}`);
    } else if (op === "whandle") {
      (b().handle_cmds as () => void).call(world);
    } else if (op === "wserr") {
      const n = Number(parseValue(t, i));
      const errs = t[i[0]!++]! === "1";
      // TS 的 `on_step_error(e)` 读 `e.errors` 与 `Date.now()`；端口把 `Date.now()` 收进时钟槽、
      // 并把「有没有 errors」收成一个布尔（记在偏差表）⇒ 台面喂一个 `toString` 给消息、
      // `errors` 给那句固定文本的假错误对象。
      const e = errs
        ? { errors: "[World::start_update] errors", toString: () => "boom" }
        : { toString: () => "boom" };
      for (let k = 0; k < n; k++) (b().on_step_error as (e: unknown) => void).call(world, e);
      log.push(
        `serr|n=${num(n)}|errs=${flag(errs)}|count=${num(b()._step_error_count)}` +
          `|ticker=${flag(!!world.ticker)}`,
      );
    } else if (op === "wcb") {
      const name = t[i[0]!++]!;
      const cb = world.callbacks as unknown as {
        on(k: string, f: (...a: unknown[]) => void): void;
      };
      if (name === "on_stage_change") {
        cb.on(name, (v, o) =>
          log.push(`cb:on_stage_change=${vstr((v as Bag)?.id)},${vstr((o as Bag)?.id)}`),
        );
      } else if (name === "on_cam_move") {
        cb.on(name, (x, y) => log.push(`cb:on_cam_move=${num(x)},${num(y)}`));
      } else if (name === "on_pause_change") {
        cb.on(name, (v) => log.push(`cb:on_pause_change=${flag(v)}`));
      } else if (name === "on_fn_locked_change") {
        cb.on(name, (v) => log.push(`cb:on_fn_locked_change=${num(v)}`));
      } else if (name === "on_fps_update") {
        cb.on(name, (v) => log.push(`cb:on_fps_update=${num(v)}`));
      } else if (name === "on_fighter_add") {
        cb.on(name, (e) => log.push(`cb:on_fighter_add=${(e as Entity).id}`));
      } else if (name === "on_puppet_add") {
        cb.on(name, (pid) => log.push(`cb:on_puppet_add=${vstr(pid)}`));
      } else if (name === "on_dataset_change") {
        cb.on(name, (k, curr, prev) =>
          log.push(`cb:on_dataset_change=${esc(String(k))}:${vstr(curr)}:${vstr(prev)}`),
        );
      } else if (name === "on_ups_update") {
        cb.on(name, (rate, _t, factor) =>
          log.push(`cb:on_ups_update=${num(rate)}:${num(_t)}:${num(factor)}`),
        );
      } else if (name === "on_fighter_del") {
        cb.on(name, (e) => log.push(`cb:on_fighter_del=${e ? (e as Entity).id : "z"}`));
      } else if (name === "on_puppet_del") {
        cb.on(name, (pid) => log.push(`cb:on_puppet_del=${vstr(pid)}`));
      } else if (name === "on_counts") {
        cb.on(name, () => log.push("cb:on_counts"));
      } else if (name === "on_disposed") {
        cb.on(name, () => log.push("cb:on_disposed"));
      } else {
        fail(`unknown callback '${name}'`);
      }
    } else if (op === "wclear") {
      world.clear();
      log.push(`clear|fn=${num(b()._fn_locked)}|cnt=${(b()._counts as Map<string, number>).size}`);
    } else if (op === "wdispose") {
      world.dispose();
      log.push(`dispose`);
    } else if (op === "wreset") {
      world.reset_game_time();
      log.push(`time=${num(world.game_time)}`);
    } else {
      fail(`unknown op '${op}'`);
    }

    if (i[0] !== t.length) fail(`trailing token(s): ${raw}`);
    while (log.length) process.stdout.write(log.shift() + "\n");
  }
}

main();
