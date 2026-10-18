import { BaseController } from "../../../../src/LFW/controller/BaseController";
import { Ditto } from "../../../../src/LFW/ditto";
import { Buff } from "../../../../src/LFW/buff/Buff";
import { Entity } from "../../../../src/LFW/entity/Entity";
import { NSlot, SSlot } from "../../../../src/LFW/entity/EntitySnapshot";
import { summary_mgr } from "../../../../src/LFW/entity/SummaryMgr";
import { State_Base } from "../../../../src/LFW/state/State_Base";
import { States } from "../../../../src/LFW/state/States";
import { WorldDataset } from "../../../../src/LFW/WorldDataset";
import { GameMode } from "../../../../src/LFW/defines";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";
import { Ground } from "../../../../src/LFW/Ground";
import { mt_cases } from "../../../../src/LFW/cases_instances";
import { get_val_getter_from_entity } from "../../../../src/LFW/loader/get_val_from_entity";
import { get_val_geter_from_collision } from "../../../../src/LFW/loader/get_val_from_collision";
import { BallController } from "../../../../src/LFW/controller/BallController";
import { closer_one } from "../../../../src/LFW/helper/closer_one";
import { readCaseLines, parseValue as parseValueRaw, renderValue, splitWs } from "./trace_util";

type Any = never;

const r = (v: unknown): string => renderValue(v);

// TS 的 `Buff` 是抽象类（没有抽象成员），而 `HitByMagicFlute` 只读 `kind`，所以差分里
// 用一个最小子类充当「某个 kind 的 buff」；`run buffset` 会把它塞进 `e.buffs`。
class FakeBuff extends Buff {
  constructor(id: string, kind: unknown) {
    super({ world: worldStub } as never, id, kind as never);
  }
}

// `run ctrl ball` 造的真控制器（`BallController`）。
let ball: BallController | null = null;

// `run ball …` 的观察点：`chase_point` / `dir_*` / `leave_dir` / `gave_up` /
// 六个键的 hit|hold，外加 `LR/UD/jd` —— 与端口 `ball_state()` 逐字对齐。
const ballState = (b: BallController): string => {
  const cp = b.chase_point;
  const flags = (f: (k: never) => boolean): string =>
    ["L", "R", "U", "D", "j", "d"].map((k) => (f(k as never) ? "1" : "0")).join("");
  return (
    ` chasing=${r(idRef(b.chasing as never))} pt=${r(cp.x)}/${r(cp.y)}/${r(cp.z)}` +
    ` dir=${r(b.dir_x)}/${r(b.dir_y)}/${r(b.dir_z)} leave=${r(b.leave_dir)} gaveup=${r(b.gave_up)}` +
    ` lr=${r(b.LR)} ud=${r(b.UD)} jd=${r(b.jd)}` +
    ` hit=${flags((k) => b.is_hit(k))} hold=${flags((k) => b.is_hold(k))}`
  );
};

// `nf.__judger`: the real loader (`preprocess_next_frame`) attaches a compiled
// `Expression`.  The harness carries the marker in `__judge` (a plain key, so both
// sides render it) and hangs a **non-enumerable** `__judger` next to it; the port
// keeps the same plain key and answers through the host seam.
const attachJudgers = (v: unknown): void => {
  if (v === null || typeof v !== "object") return;
  if (Array.isArray(v)) {
    for (const item of v) attachJudgers(item);
    return;
  }
  const o = v as Record<string, unknown>;
  if (Object.prototype.hasOwnProperty.call(o, "__judge")) {
    const marker = o.__judge;
    Object.defineProperty(o, "__judger", {
      enumerable: false,
      value: {
        run: (_e: unknown): unknown => {
          log.push("judge:" + r(marker));
          return marker;
        },
      },
    });
  }
  for (const k of Object.keys(o)) attachJudgers(o[k]);
};

const parseValue = (t: string[], idx: number[]): unknown => {
  const v = parseValueRaw(t, idx);
  attachJudgers(v);
  return v;
};

// `const enum` is erased at runtime, so the harness spells the four results out.
const ENTER_FRAME_RESULT: Record<number, string> = {
  0: "Gone",
  1: "NotFound",
  2: "Entered",
  3: "Fallback",
};

const out: string[] = [];
const log: string[] = [];

// The host side of `Entity`: TS reads `this.world` / `this.lfw`, so the harness hands
// over the same shape with spies.  `world.dataset` is the real `WorldDataset` on both
// sides; `bg.data.dataset` is a plain layer like the port's `IEntityHost::bg_dataset`.
const dataset = new WorldDataset();
const bgDataset: Record<string, unknown> = Object.create(null);

// `world.restrict` answer (`run restrict`); `undefined` means "no clamp".
let restrictResult: unknown = undefined;

class HumanController extends BaseController {
  readonly __is_human_ctrl__ = true;
}

class BotController extends BaseController {
  readonly __is_bot_ctrl__ = true;
}

let idCounter = 0;
let team = "1";

const worldStub = {
  dataset,
  bg: { data: { dataset: bgDataset }, zoom_x: 1 },
  mark_players_alive: (_e: unknown, alive: boolean): void => {
    log.push("mark_players_alive:" + r(alive));
  },
  restrict: (e: Entity): unknown => {
    if (restrictResult === undefined || restrictResult === null) return e.position;
    const v = restrictResult as { x?: unknown; y?: unknown; z?: unknown };
    return Ditto.vec3(Number(v.x ?? 0), Number(v.y ?? 0), Number(v.z ?? 0));
  },
  broadcast: (m: unknown): void => {
    log.push("broadcast:" + r(m));
  },
  sounds: { play: (): void => undefined },
  entity_map: new Map<string, Any>(),
  // `spawn` 的三个世界读点：`entities.length + ghosts.length`（unimportant 门）、
  // `world.add_entities(this)`（attach）与 `world.game_time`（`_spawn_time`）。
  entities: [] as unknown[],
  ghosts: [] as unknown[],
  game_time: 0,
  add_entities: (e: Entity): void => {
    log.push("add_entities:" + e.id + ":" + r(e.spawn_time));
  },
  // `world.list_entities(key, predicate)`：候选名单由 `env ents …` 指定，谓词由端口侧
  // （TS 这里是真实 `Entity.apply_opoints`）提供。真实 `World` 按 key 缓存一份数组、
  // 同名第二次不再过谓词 —— 那层属于 World 切片，差分里不建模。
  // 名单只记 token：`run make` / `run buddy` 会换掉实体，而真实 `World` 每次筛的是
  // 「当前」世界里的实体，所以这里也必须每次现查。
  list_entities: (key: string, predicate: (o: Entity) => boolean): Entity[] => {
    const out = candidateTokens
      .map((tok) => candidateOf(tok))
      .filter((e): e is Entity => !!e && predicate(e));
    log.push("list_entities:" + key + ":" + out.length);
    return out;
  },
  // `update()` 的四个宿主输入：puppets 名单、舞台边界、`ground.step`、
  // `lfw.game_mode`（后者挂在 `lfwStub` 上）。
  puppets: new Map<string, Entity>(),
  stage: {} as Record<string, unknown>,
  ground: { step: 10 },
};

// `world.puppets.values()`：`env puppets …` 指的名单（token 与 `env ents` 同款）。
let puppetTokens: string[] = [];
let groundStep = 10;
let rankMode = false;
// `world.lfw.survival_rank_available`（`env rankavail b 1`）与 `lfw.is_cheat(name)` 的
// 开关集合（`env cheat <名字> b 1`）。
let rankAvail = false;
const cheatSet = new Set<string>();
Object.defineProperty(worldStub, "puppets", {
  get: () => {
    log.push("puppets:" + puppetTokens.join(","));
    const m = new Map<string, Entity>();
    for (const tok of puppetTokens) {
      const e = candidateOf(tok);
      if (e) m.set(e.id, e);
    }
    return m;
  },
});
Object.defineProperty(worldStub.ground, "step", { get: () => groundStep });

// `env ents …` 的候选名单（`self` / `buddy` / `sp<N>`）与 `env ballctrl b 1` 的开关。
let candidateTokens: string[] = [];
let ballCtrl = false;
const spawnedList: Entity[] = [];

function candidateOf(tok: string): Entity | undefined {
  if (tok === "self") return ent;
  if (tok === "buddy") return buddy;
  if (tok.startsWith("sp")) return spawnedList[Number(tok.slice(2))];
  return undefined;
}

// `world.entity_map.get(id)` must always see the current ids, so it is answered from
// the live harness entities instead of a table that `reset` would invalidate.
worldStub.entity_map.get = ((id: string) => {
  if (ent !== undefined && ent.id === id) return ent;
  if (buddy !== undefined && buddy.id === id) return buddy;
  return undefined;
}) as never;

// `world.find_entity(id)` 就是 `entity_map.get(id)`（`World.ts:925`），所以同一个实现。
(worldStub as unknown as { find_entity: (id: string) => unknown }).find_entity = (id: string) =>
  worldStub.entity_map.get(id);

// `lfw.datas.find(id)`, filled by `env data`.
const dataTable = new Map<string, Any>();

// Snapshot buffers shared by `run snap|snapbuf|snappoke|snapapply`.
let gSnapNums: unknown[] = new Array<unknown>(Number(NSlot.COUNT));
let gSnapStrs: unknown[] = new Array<unknown>(Number(SSlot.COUNT));

// `{id}` (or `null`) so `catching` / `catcher` / `bearer` / `holding` print the same
// thing as the port without dumping a whole entity.
// `run keys` / `run bkeys` 的尾部单键名（`a` / `j` / `d` / …）：`check_fusion_dismissing`
// 的 `sametime_keys_test("dja")` / `sequence_keys_test("ja")` 需要 `a`，三个方向参数
// 表达不了它。返回拼好的命令后缀（`" a j"`）。
const KEY_NAMES = new Set(["L", "R", "U", "D", "d", "j", "a"]);
function hitExtraKeys(
  keys: Record<string, { hit: (t?: number) => void }>,
  t: string[],
  i: number,
): string {
  let out = "";
  for (; i < t.length; i++) {
    const name = t[i]!;
    if (!KEY_NAMES.has(name)) {
      process.stderr.write(`unknown key '${name}'\n`);
      process.exit(2);
    }
    keys[name]!.hit(1);
    out += " " + name;
  }
  return out;
}

const idRef = (e: Entity | null | undefined): unknown => (e ? { id: e.id } : null);

// --- `loader/get_val_from_collision` 的驱动器 ---------------------------------
// TS 的 `Collision` 就是 `{attacker, victim, itr, bdy, aframe, bframe}`，其中
// `attacker` / `victim` 是那两个**活**实体、`aframe` / `bframe` 取它们的 `frame`；
// 端口的 `Collision` 只有 `CollisionActor` 快照，实体按 `id` 从 `CollisionValEnv` 找回来。
// `none` 给一个世界外的 `{id}`：读实体的项于是取到 `undefined`（TS 真实世界此时会是
// `TypeError`，端口按缺口给 `undefined`，见 DESIGN）。
let cv: Record<string, unknown> = {};

const cvEntityOf = (tok: string): Entity | null =>
  tok === "none" ? null : tok === "buddy" ? buddy : ent;

const cvIdOf = (tok: string): string => {
  if (tok === "none") return "__outside__";
  const e = cvEntityOf(tok);
  return e ? String(e.id) : "-";
};

// TS 的 `collision.itr` / `.bdy` / `.aframe` / `.bframe` 永远是对象，所以 `cv` 里也一律
// 放对象（端口那边同理塞空对象）：读不到的字段在两边都是 `undefined`。
const cvFrameOf = (e: Entity | null): unknown => {
  const f = e ? (e as unknown as { frame?: unknown }).frame : undefined;
  return f && typeof f === "object" ? f : {};
};

const cvReset = (): void => {
  cv = { attacker: { id: "__outside__" }, victim: { id: "__outside__" }, itr: {}, bdy: {}, aframe: {}, bframe: {} };
};

cvReset();

// 七个键的 `is_hit` / `is_start` / `is_db_hit` 掩码（`run cvkey` 的回显）。
const cvKeyState = (c: BaseController): string => {
  const names = ["L", "R", "U", "D", "d", "j", "a"];
  const flags = (f: (k: never) => boolean): string =>
    names.map((k) => (f(k as never) ? "1" : "0")).join("");
  return (
    `t=${r(c.time)} hit=${flags((k) => c.is_hit(k))} start=${flags((k) => c.is_start(k))}` +
    ` db=${flags((k) => c.is_db_hit(k))}`
  );
};

// `marks` is a `Map`, so the dump keeps the insertion order the port's `std::map`
// cannot promise — sort by key to make both sides print the same text.
const marksText = (e: Entity): string =>
  [...(e as unknown as { marks: Map<string, string> }).marks.entries()]
    .map(([k, v]) => `${k}:${v}`)
    .sort()
    .join(",");

const renderNums = (nums: unknown[]): string =>
  Array.from({ length: nums.length }, (_v, k) => r(nums[k])).join(",");

const renderStrs = (strs: unknown[]): string =>
  Array.from({ length: strs.length }, (_v, k) => r(strs[k])).join(",");

type CollisionLike = { itr?: { kind?: unknown }; rest?: unknown };

// The `vrests` / `blockers` / `superpunchs` maps render as `["w1":14:3,…]`; sorted by
// key because the port's `std::map` cannot keep the `Map` insertion order.
const dumpCollisions = (e: Entity, key: "vrests" | "blockers" | "superpunchs"): string =>
  "[" +
  [...(e as unknown as Record<typeof key, Map<string, CollisionLike>>)[key].entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${r(k)}:${r(v.itr?.kind)}:${r(v.rest)}`)
    .join(",") +
  "]";

// The four relation slots on both harness entities, so a back-pointer write on the
// *other* entity (`clean_holding` / `drop_catching`) is visible in the trace.
const relProbe = (): string =>
  [
    ent?.holding,
    ent?.bearer,
    ent?.catching,
    ent?.catcher,
    buddy?.holding,
    buddy?.bearer,
    buddy?.catching,
    buddy?.catcher,
  ]
    .map((v) => r(!!v))
    .join(" ");

const lfwStub = {
  players: new Map<string, Any>(),
  mt: new MersenneTwister(0),
  // `lfw.game_mode`（`env rankmode b 1`；`update_catching` 的 -1 投掷分支）。
  get game_mode(): GameMode | undefined {
    return rankMode ? GameMode.SurvivalRank1P : undefined;
  },
  // `world.lfw.survival_rank_available`（`env rankavail b 1`）。
  get survival_rank_available(): boolean {
    return rankAvail;
  },
  // `lfw.is_cheat(name)`：`is_cheat_type(name) && !!world.dataset[name]`；名字只可能是
  // `LF2_NET` / `HERO_FT` / `GIM_INK`（表里写死的），dataset 用开关集合代替。
  is_cheat: (name: string): boolean => cheatSet.has(name),
  broadcast: (m: unknown): void => {
    log.push("broadcast:" + r(m));
  },
  datas: { find: (id: string): Any => dataTable.get(id) },
  get new_team(): string {
    return team;
  },
  get new_id(): string {
    idCounter += 1;
    return "e" + idCounter;
  },
  factory: {
    acquire_ctrl: (cls: new (pid: string, e: Any) => BaseController, pid: string, e: Any) => {
      log.push("acquire_ctrl");
      const c = new cls(pid, e);
      // `env ballctrl b 1` ⇒ 新实体的控制器声称自己是 ball ctrl（`__is_ball_ctrl__`）。
      if (ballCtrl) (c as unknown as { __is_ball_ctrl__: boolean }).__is_ball_ctrl__ = true;
      return c;
    },
    release_ctrl: (c: BaseController | undefined): void => {
      log.push("release_ctrl:" + ctrlMark(c));
    },
    create_ctrl: (id: string, pid: string, e: Entity): BaseController => {
      log.push("create_ctrl:" + r(id) + ":" + r(pid));
      return new BaseController("", e);
    },
    create_entity_with_bot: (_bot: string, world: unknown, data: unknown): Entity | undefined => {
      log.push("create_entity_with_bot:" + r(data));
      spawned = new Entity(world as never, data as never, states as never);
      // 端口侧的实体天然带宿主缝；TS 实例是把宿主方法替换成 spy，所以这里也要绑一次，
      // 否则生成出来的实体走的是真实 `play_sound`（什么都不记）。回调不绑：端口侧生成出来的
      // 实体在宿主里没人注册回调，保持两侧观测面一致。
      bindHostSpies(spawned);
      spawnedList.push(spawned);
      return spawned;
    },
  },
};

(worldStub as unknown as { lfw: unknown }).lfw = lfwStub;

// `Entity.set_position` reads the ground height through `world.ground.y(terrain, x, z)`;
// `y` is a pure by-segment lookup, so the real `Ground` answers it and the case only has
// to supply the terrain.
//
// `world.ground.step` 在端口侧是 `IEntityHost::ground_step`（harness 的 `env groundstep`），
// 但真 `Ground` 的 `step` 是个 `readonly` 字段 ⇒ 这里按实例重定义成读 harness 变量，
// 否则 `update_landable` 会一直用 `Ground` 自带的 10。
const groundObj = new Ground(worldStub as never);
Object.defineProperty(groundObj, "step", { get: () => groundStep });
(worldStub as unknown as { ground: unknown }).ground = groundObj;

// `Ditto.warn` is a console warning; the port drops it (no trace effect), so the stub
// only has to exist.
Ditto.warn = (() => undefined) as never;

// `Entity` builds its vectors through the host.
Ditto.vec3 = (x = 0, y = 0, z = 0) => {  const v = { x, y, z } as { x: number; y: number; z: number; set: unknown };
  // The real `IVector3` keeps `set` off the own-key list; `Object.keys` (and so
  // `renderValue`) must only see x/y/z.
  Object.defineProperty(v, "set", {
    enumerable: false,
    value: (nx: number, ny: number, nz: number): void => {
      v.x = nx;
      v.y = ny;
      v.z = nz;
    },
  });
  Object.defineProperty(v, "copy", {
    enumerable: false,
    value: (src: { x: number; y: number; z: number }): void => {
      v.x = src.x;
      v.y = src.y;
      v.z = src.z;
    },
  });
  return v as never;
};

let ent: Entity | undefined = undefined;
let buddy: Entity | undefined = undefined;

// --- state registry + the fake state (the 9g wiring) -------------------------
// The hooks are no longer poked onto a stub object: they live on a state that
// `set_state` selects, so a scene must `run reg` + `run setstate` before
// `run hook ...` can be observed — exactly like the real game, where `set_state` is
// the only way a state becomes active.
const states = new States();
// `spawn` / `attach` 的双件状态：最后创建的实体、`env gen` 注册的表达式字段常量。
let spawned: Entity | undefined = undefined;
const gens = new Map<string, unknown>();

function spawnDump(e: Entity | undefined): string {
  if (!e) return "none";
  return (
    `id=${e.id} pos=${r(e.position)} pv=${r(e.prev_position)} v=${r(e.velocity)} ` +
    `pvv=${r(e.prev_velocity)} team=${r(e.team)} facing=${r(e.facing)} ` +
    `frame=${r(e.frame?.id)} motionless=${r(e.motionless)} hp=${r(e.hp)} hp_r=${r(e.hp_r)} ` +
    `hp_max=${r(e.hp_max)} mp=${r(e.mp)} mp_max=${r(e.mp_max)} emitters=${r([...e.emitters])} ` +
    `bearer=${r(idRef(e.bearer))} holding=${r(idRef(e.holding))} mounted=${r(e.mounted)} ` +
    `ghosted=${r(e.ghosted)} spawn_time=${r(e.spawn_time)} ground_y=${r(e.ground_y)} ` +
    `on_ground=${r(e.is_on_ground)} ` +
    // `is_ball_ctrl(ctrl)` 与 `ctrl.chasing`：两个都打（`chasing` 不因「不是 ball ctrl」
    // 而隐藏，否则「往基控制器上写 chasing」这类变异看不见）。
    `ball=${r(!!(e as unknown as { ctrl?: { __is_ball_ctrl__?: boolean } }).ctrl?.__is_ball_ctrl__)} ` +
    `chasing=${r(idRef((e as unknown as { ctrl?: { chasing?: Entity } }).ctrl?.chasing))}`
  );
}

// `this._opoints` 的记账转储：`interval_id:tick` 对（`interval_id` 缺失写成 `-`）。
const dumpOpoints = (e: Entity): string =>
  (e as unknown as { _opoints: [Record<string, unknown>, number][] })._opoints
    .map((pair) => `${pair[0]?.interval_id === void 0 ? "-" : r(pair[0].interval_id)}:${r(pair[1])}`)
    .join(",");

// `run update` / `run updateg` 的观察点（与 C++ 侧 `dump_tick` 逐字段对齐）。
const fidOrNull = (f: unknown): string =>
  f === null ? "z" : r((f as { id?: unknown } | undefined)?.id);
const dumpTick = (e: Entity): string => {
  const priv = e as unknown as {
    _atom_time: number;
    _lifetime: number;
    _motionless_ticks: number;
    _invisible: number;
    _invulnerable: number;
    _after_blink: string | null;
    prev_cpoint_a: unknown;
    fuse_bys: unknown[] | null;
  };
  return (
    // `_atom_time` 在 TS 里可以保持 `null`（`dataset.atom_time` 是 `null` 时）；端口是
    // `double` + `num_of`（nullish ⇒ 0）⇒ 这一格按 0 归一化（两者的算术、比较都同值）。
    `at=${r(priv._atom_time ?? 0)} life=${r(priv._lifetime)} wait=${r(e.wait)} mticks=${r(
      priv._motionless_ticks,
    )} blink=${r(e.blinking)} after=${priv._after_blink === null ? "z" : r(priv._after_blink)}` +
    ` inv=${r(priv._invisible)} invu=${r(priv._invulnerable)} arest=${r(e.arest)} catch=${r(
      (e as unknown as { _catch_time: number })._catch_time,
    )} throwinj=${r(e.throwinjury)} fallinj=${r(e.fallinjury)} on_ground=${r(e.is_on_ground)}` +
    ` landing=${fidOrNull((e as unknown as { _landing_frame: unknown })._landing_frame)} prev_cp=${r(
      priv.prev_cpoint_a,
    )} fuse=${r(priv.fuse_bys?.length ?? 0)}` +
    ` aabb=${r(e.aabb_min_x)},${r(e.aabb_max_x)},${r(e.aabb_min_z)},${r(e.aabb_max_z)} lr=${r(
      e.l_len ?? NaN,
    )},${r(e.r_len ?? NaN)}` +
    ` frame=${r((e.frame as { id?: unknown }).id)} pos=${r(e.position)} pv=${r(
      e.prev_position,
    )} v=${r(e.velocity)} pvv=${r(e.prev_velocity)}` +
    ` hp=${r(e.hp)} hp_r=${r(e.hp_r)} mp=${r(e.mp)} team=${r(e.team)} facing=${r(e.facing)}` +
    ` motionless=${r(e.motionless)} shaking=${r(e.shaking)} catcher=${r(idRef(e.catcher))}` +
    ` catching=${r(idRef(e.catching))} fromwait=${r(
      (e as unknown as { _from_wait_block: boolean })._from_wait_block,
    )}` +
    ` n=${(e as unknown as { _opoints: unknown[] })._opoints.length} itv=${dumpOpoints(e)}`
  );
};

// 第二个实体的观察点（与 C++ 侧 `dump_buddy` 逐字段对齐）：`update` 里只写对方的那几处
// （`check_fusion_dismissing` / `dismiss_fusion` 的成员循环、`update_catching` 的
// `caught->*`、`follow_catcher`）。
const dumpBuddy = (b: Entity | null): string => {
  if (!b) return "z";
  const priv = b as unknown as { _invisible: number; _invulnerable: number; prev_cpoint_a: unknown };
  return (
    `hp=${r(b.hp)} hp_r=${r(b.hp_r)} mp=${r(b.mp)} frame=${r((b.frame as { id?: unknown }).id)}` +
    ` pos=${r(b.position)} v=${r(b.velocity)} facing=${r(b.facing)} inv=${r(priv._invisible)}` +
    ` invu=${r(priv._invulnerable)} ml=${r(b.motionless)} prev_cp=${r(priv.prev_cpoint_a)}` +
    ` catcher=${r(idRef(b.catcher))} catching=${r(idRef(b.catching))}`
  );
};

// `opoint.__gen_x?.get(emitter)`：TS 侧是真函数对象，场景用 `env gen` 注册常量。
function applyGens(opoint: unknown): void {
  const o = opoint as Record<string, unknown>;
  for (const [kind, v] of gens) {
    const gen = { get: (): unknown => v };
    o[kind] = gen;
    const action = o["action"];
    if (action && typeof action === "object") {
      (action as Record<string, unknown>)[kind] = gen;
    }
  }
}


// What `run hook ...` configures.  A hook that is "off" returns `undefined` without
// logging, which is what a missing TS callback does (`this._state?.get_gravity?.(…)`).
const hooks = {
  dead: false,
  gravity: false,
  gravity_value: undefined as unknown,
  find: false,
  find_echo: false,
  find_value: undefined as unknown,
  auto_frame: false,
  auto_frame_value: undefined as unknown,
  sudden: false,
  sudden_value: undefined as unknown,
  caught: false,
  caught_value: undefined as unknown,
  // `run hook view*`: the fake state drives the three `EntityStateView` forwards that
  // nothing else in this subject reaches.  `view_busy` keeps a view-driven frame swap
  // from re-entering the state and looping forever.
  view_position: false,
  view_frame: false,
  view_enter: false,
  view_busy: false,
  // `run hook viewdata|viewdismiss`: the lookup forwards (`dataset` / `world_dataset`)
  // and the fusion-split forward (`dismiss_fusion`) that only the real state code
  // reaches; `viewdata` logs both lookups side by side.
  view_data: false,
  view_dismiss: false,
  // `update()` 走的那四个状态钩子（`run hook preupdate|stateupdate|landing|leaveground`）。
  pre_update: false,
  state_update: false,
  landing: false,
  leave_ground: false,
};

const fid = (frame: unknown): string =>
  r((frame as { id?: unknown } | undefined | null)?.id);

const prevId = (e: Entity): string =>
  fid((e as unknown as { get_prev_frame(): unknown }).get_prev_frame());

class HarnessState extends State_Base {
  constructor(state: number | string) {
    super(state);
    this.enter = (e: Entity, prev: unknown): void => {
      log.push(
        `${r(this.state)}>enter:${e.id}:${fid(e.frame)}:${fid(prev)}:hp=${r(e.hp)}` +
          `:hmax=${r(e.hp_max)}:mp=${r(e.mp)}:ml=${r(e.motionless)}:sh=${r(e.shaking)}` +
          `:st=${r(e.state)}:og=${r(e.is_on_ground)}:team=${r(e.team)}:dt=${r(e.data.type)}` +
          `:jx=${r(e.jumping.x)}:vx=${r(e.velocity.x)}:vy=${r(e.velocity.y)}:vz=${r(e.velocity.z)}` +
          `:pos=${r(e.position.x)}/${r(e.position.y)}/${r(e.position.z)}:pf=${prevId(e)}`,
      );
      // The state touches the entity on entry so the setters stay observable.
      e.motionless = e.motionless;
      e.hp_r = e.hp_r;
      if (!hooks.view_busy) {
        hooks.view_busy = true;
        if (hooks.view_position) e.set_position(1, 2, 3);
        // a *different* frame object, so the swap is visible (`set_frame` reads `v.id`)
        if (hooks.view_frame) {
          e.set_frame({ ...(e.frame as Record<string, unknown>), id: "w2" } as never);
        }
        if (hooks.view_enter) e.enter_frame_by_id("auto");
        if (hooks.view_data) {
          const lookup = e as unknown as { dataset(k: string): unknown };
          const world = (e as unknown as { world: { dataset: Record<string, unknown> } }).world;
          log.push(
            `state_view_dataset:${r(lookup.dataset("probe_key"))}:world=${r(world.dataset.probe_key)}`,
          );
        }
        if (hooks.view_dismiss) {
          (e as unknown as { dismiss_fusion(id: string): void }).dismiss_fusion("112");
          log.push(`state_view_dismiss:${fid(e.frame)}`);
        }
        hooks.view_busy = false;
      }
    };
    this.on_dead = (e: Entity): void => {
      if (!hooks.dead) return;
      log.push(`state_on_dead:${e.id}:${r(e.hp_r)}`);
    };
    this.on_restrict = (e: Entity, x: number, y: number, z: number): void => {
      log.push(`state_on_restrict:${e.id}:${r(x)}:${r(y)}:${r(z)}`);
    };
    this.get_gravity = (): unknown => (hooks.gravity ? hooks.gravity_value : undefined);
    this.find_frame_by_id = (_e: Entity, id: unknown): unknown =>
      hooks.find ? (hooks.find_echo ? id : hooks.find_value) : undefined;
    this.get_auto_frame = (): unknown =>
      hooks.auto_frame ? hooks.auto_frame_value : undefined;
    this.get_sudden_death_frame = (): unknown =>
      hooks.sudden ? hooks.sudden_value : undefined;
    this.get_caught_end_frame = (): unknown =>
      hooks.caught ? hooks.caught_value : undefined;
    // `update()` 走的那四个状态钩子（与 C++ `HarnessState` 对齐）。
    this.pre_update = (e: Entity): void => {
      if (!hooks.pre_update) return;
      log.push(`state_pre_update:${e.id}:${r(e.hp)}`);
    };
    this.on_landing = (e: Entity, v: unknown): void => {
      if (!hooks.landing) return;
      log.push(`state_on_landing:${e.id}:${r(v)}`);
    };
    this.on_leave_ground = (e: Entity): void => {
      if (!hooks.leave_ground) return;
      log.push(`state_on_leave_ground:${e.id}`);
    };
  }

  leave(e: Entity, next: unknown): void {
    log.push(`${r(this.state)}>leave:${e.id}:${fid(next)}`);
  }

  update(e: Entity): void {
    if (!hooks.state_update) return;
    log.push(`state_update:${e.id}:${r(e.hp)}`);
  }
}

const dumpStates = (): string =>
  [...states.map.entries()]
    .map(([k, v]) => `${r(k)}:${(v as object).constructor.name}`)
    .join(",");

const ctrlMark = (c: unknown): string => {
  if (!c) return "u";
  const c0 = c as { __is_human_ctrl__?: boolean; __is_bot_ctrl__?: boolean };
  if (c0.__is_human_ctrl__) return "human";
  if (c0.__is_bot_ctrl__) return "bot";
  return "base";
};

const who = (e: unknown): string => (e === ent ? "self" : "?");

const makeCtrl = (kind: string): BaseController | undefined => {
  if (kind === "none") return undefined;
  if (kind === "human") {
    const c = new HumanController("7", ent as never);
    c.player = { id: 7, name: "P7" } as never;
    return c;
  }
  if (kind === "human_bare") {
    const c = new HumanController("9", ent as never);
    c.player = { id: 9 } as never;
    return c;
  }
  if (kind === "bot") return new BotController("7", ent as never);
  if (kind === "base_released") {
    const c = new BaseController("", ent as never);
    (c.keys.d as unknown as { hit: (t?: number) => void }).hit(1);
    return c;
  }
  return new BaseController("", ent as never);
};

// The host seams (`IEntityHost`) are shared by every entity on the port side, so the TS
// side spies them on each instance it creates — the buddy included.
function bindHostSpies(e: Entity): void {
  const spies = e as unknown as Record<string, unknown>;
  // `play_sound(sounds, pos = this.position)`: the spy stands in for the real method,
  // so it repeats that default parameter (the port passes the position explicitly).
  spies.play_sound = (s: unknown, pos: unknown = (e as unknown as { position: unknown }).position): void => {
    log.push("play_sound:" + r(s) + "@" + r(pos));
  };
}

function bindCallbacks(e: Entity): void {
  bindHostSpies(e);
  const on = (key: string, fn: (...args: Any[]) => void): void => {
    (e.callbacks as unknown as { on: (k: string, f: unknown) => void }).on(key, fn);
  };
  on("on_hp_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_hp_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_hp_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_hp_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_mp_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_mp_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_mp_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_mp_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_hp_r_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_hp_r_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_team_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_team_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_name_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_name_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_dead", (e2: unknown) => {
    log.push(`on_dead:${who(e2)}`);
  });
  on("on_ctrl_changed", (v: unknown, prev: unknown, e2: unknown) => {
    log.push(`on_ctrl_changed:${ctrlMark(v)}:${ctrlMark(prev)}:${who(e2)}`);
  });
  on("on_reserve_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_reserve_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_resting_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_resting_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_resting_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_resting_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_fall_value_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_fall_value_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_fall_value_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_fall_value_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_defend_value_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_defend_value_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_defend_value_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_defend_value_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_toughness_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_toughness_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_toughness_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_toughness_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
  on("on_catch_time_max_changed", (e2: unknown, v: unknown, o: unknown) => {
    log.push(`on_catch_time_max_changed:${who(e2)}:${r(v)}:${r(o)}`);
  });
}

// The peek at the stat slots TS keeps private (`_catch_time`, the recovery ticks, …),
// mirroring `Entity::stat_slots()` in the port.
const statSlots = (e: Entity): Record<string, unknown> => {
  const p = e as unknown as Record<string, { max: number } | number>;
  return {
    catch_time: p._catch_time,
    toughness_r_value: p._toughness_r_value,
    fall_r_value: p._fall_r_value,
    defend_r_value: p._defend_r_value,
    toughness_r_tick_max: (p._toughness_r_tick as { max: number }).max,
    hp_r_tick_max: (p._hp_r_tick as { max: number }).max,
    mp_r_tick_max: (p._mp_r_tick as { max: number }).max,
    fall_r_tick_max: (p._fall_r_tick as { max: number }).max,
    defend_r_tick_max: (p._defend_r_tick as { max: number }).max,
  };
};

const roleProbe = (e: Entity): unknown[] => [e.name_visible, e.wakeup_invuln, e.dead_gone];

const NUMERIC_FIELDS = new Set([
  "lifetime", "spawn_time", "render_effect_time", "outline_alpha", "outline_width",
  "mix_strength", "greyscale", "ground_y", "mounted", "ghosted", "reserve",
  "toughness_resting_max", "resting_max", "resting", "fall_value", "toughness",
  "toughness_max", "toughness_resting", "catch_time_max", "fall_value_max",
  "defend_value", "defend_value_max", "defend_ratio", "mp", "hp_r", "hp", "mp_max",
  "hp_max", "blinking", "invisible", "invulnerable", "arest", "gravity",
  "itr_motionless", "weight", "base_type", "type", "variant", "wait", "stat_bar",
  "facing", "motionless", "shaking", "fallinjury", "throwinjury", "name_visible",
  "wakeup_invuln", "dead_gone", "ctrl_visible", "puppet", "is_on_ground",
  "transform_index",
  "jumping.x", "jumping.y", "jumping.z", "jumping.t", "aabb_min_x", "aabb_max_x",
  "l_len", "r_len", "atom_time", "from_wait_block", "catch_time",
]);

const VALUE_FIELDS = new Set([
  "outline_color", "mix_color", "outline_enabled", "name", "team", "origin_data_id",
  "group", "bot_ignore", "state", "armor", "dead_join", "transforms", "itr", "bdy",
  "frame", "prev_frame", "data", "emitter", "src_emitter", "drink", "ref", "ctrl", "id",
  "velocity", "prev_velocity", "position", "prev_position", "dvx", "dvy", "dvz",
  "landing_frame", "dismiss_time", "dismiss_data",
  "catching", "catcher", "bearer", "holding",
]);

const getNum = (e: Entity, name: string): number => {
  const p = e as unknown as Record<string, number>;
  switch (name) {
    case "lifetime":
      return e.lifetime;
    case "spawn_time":
      return e.spawn_time;
    case "render_effect_time":
      return e.render_effect_time;
    case "outline_alpha":
      return e.outline_alpha;
    case "outline_width":
      return e.outline_width;
    case "mix_strength":
      return e.mix_strength;
    case "greyscale":
      return e.greyscale;
    case "ground_y":
      return e.ground_y;
    case "mounted":
      return e.mounted;
    case "ghosted":
      return e.ghosted;
    case "reserve":
      return e.reserve;
    case "toughness_resting_max":
      return e.toughness_resting_max;
    case "resting_max":
      return e.resting_max;
    case "resting":
      return e.resting;
    case "fall_value":
      return e.fall_value;
    case "toughness":
      return e.toughness;
    case "toughness_max":
      return e.toughness_max;
    case "toughness_resting":
      return e.toughness_resting;
    case "catch_time_max":
      return e.catch_time_max;
    case "fall_value_max":
      return e.fall_value_max;
    case "defend_value":
      return e.defend_value;
    case "defend_value_max":
      return e.defend_value_max;
    case "defend_ratio":
      return e.defend_ratio;
    case "mp":
      return e.mp;
    case "hp_r":
      return e.hp_r;
    case "hp":
      return e.hp;
    case "mp_max":
      return e.mp_max;
    case "hp_max":
      return e.hp_max;
    case "blinking":
      return e.blinking;
    case "invisible":
      return e.invisible;
    case "invulnerable":
      return e.invulnerable;
    case "arest":
      return e.arest;
    case "catch_time":
      return (e as unknown as { _catch_time: number })._catch_time;
    case "gravity":
      return e.gravity;
    case "itr_motionless":
      return e.itr_motionless;
    case "weight":
      return e.weight;
    case "base_type":
      return e.base_type;
    case "type":
      return e.type;
    case "variant":
      return e.variant;
    case "wait":
      return e.wait;
    case "stat_bar":
      return e.stat_bar;
    case "facing":
      return e.facing;
    case "motionless":
      return e.motionless;
    case "shaking":
      return e.shaking;
    case "fallinjury":
      return e.fallinjury;
    case "throwinjury":
      return e.throwinjury;
    case "name_visible":
      return e.name_visible;
    case "wakeup_invuln":
      return e.wakeup_invuln;
    case "dead_gone":
      return e.dead_gone;
    case "ctrl_visible":
      return e.ctrl_visible;
    case "puppet":
      return e.puppet ? 1 : 0;
    case "is_on_ground":
      return e.is_on_ground ? 1 : 0;
    case "transform_index":
      return e.transform_index;
    case "jumping.x":
      return e.jumping.x;
    case "jumping.y":
      return e.jumping.y;
    case "jumping.z":
      return e.jumping.z;
    case "jumping.t":
      return e.jumping.t;
    case "aabb_min_x":
      return e.aabb_min_x;
    case "aabb_max_x":
      return e.aabb_max_x;
    case "l_len":
      return e.l_len;
    case "r_len":
      return e.r_len;
    case "atom_time":
      return (e as unknown as { _atom_time: number })._atom_time;
    case "from_wait_block":
      return (e as unknown as { _from_wait_block: boolean })._from_wait_block ? 1 : 0;
    default:
      void p;
      return undefined;
  }
};

const getValue = (e: Entity, name: string): unknown => {
  switch (name) {
    case "outline_color":
      return e.outline_color;
    case "mix_color":
      return e.mix_color;
    case "outline_enabled":
      return e.outline_enabled;
    case "name":
      return e.name;
    case "team":
      return e.team;
    case "origin_data_id":
      return e.origin_data_id;
    case "group":
      return e.group;
    case "bot_ignore":
      return e.bot_ignore;
    case "state":
      return e.state;
    case "armor":
      return e.armor;
    case "dead_join":
      return e.dead_join;
    case "transforms":
      return e.transforms;
    case "itr":
      return e.itr;
    case "bdy":
      return e.bdy;
    case "frame":
      return e.frame;
    case "prev_frame":
      return (e as unknown as { _prev_frame: unknown })._prev_frame;
    case "data":
      return e.data;
    case "emitter":
      return e.emitter;
    case "src_emitter":
      return e.src_emitter;
    case "drink":
      return e.drink ? true : undefined;
    case "id":
      return e.id;
    case "ref":
      return { id: e.id };
    case "velocity":
      return e.velocity;
    case "prev_velocity":
      return e.prev_velocity;
    case "position":
      return e.position;
    case "prev_position":
      return e.prev_position;
    case "dvx":
      return e.dvx;
    case "dvy":
      return e.dvy;
    case "dvz":
      return e.dvz;
    case "landing_frame":
      return (e as unknown as { _landing_frame: unknown })._landing_frame;
    case "dismiss_time":
      return e.dismiss_time ?? null;
    case "dismiss_data":
      return e.dismiss_data;
    case "catching":
      return idRef(e.catching);
    case "catcher":
      return idRef(e.catcher);
    case "bearer":
      return idRef(e.bearer);
    case "holding":
      return idRef(e.holding);
    case "ctrl":
      return e.ctrl ? ctrlMark(e.ctrl) : undefined;
    default:
      return undefined;
  }
};

const setNum = (e: Entity, name: string, v: number): boolean => {
  const p = e as unknown as Record<string, number>;
  switch (name) {
    case "atom_time":
      (e as unknown as { _atom_time: number })._atom_time = v;
      return true;
    case "outline_alpha":
      e.outline_alpha = v;
      return true;
    case "outline_width":
      e.outline_width = v;
      return true;
    case "mix_strength":
      e.mix_strength = v;
      return true;
    case "greyscale":
      e.greyscale = v;
      return true;
    case "ghosted":
      p._ghosted = v;
      return true;
    case "reserve":
      e.reserve = v;
      return true;
    case "toughness_resting_max":
      e.toughness_resting_max = v;
      return true;
    case "resting_max":
      e.resting_max = v;
      return true;
    case "resting":
      e.resting = v;
      return true;
    case "fall_value":
      e.fall_value = v;
      return true;
    case "toughness":
      e.toughness = v;
      return true;
    case "toughness_max":
      e.toughness_max = v;
      return true;
    case "toughness_resting":
      e.toughness_resting = v;
      return true;
    case "catch_time_max":
      e.catch_time_max = v;
      return true;
    case "fall_value_max":
      e.fall_value_max = v;
      return true;
    case "defend_value":
      e.defend_value = v;
      return true;
    case "defend_value_max":
      e.defend_value_max = v;
      return true;
    case "defend_ratio":
      e.defend_ratio = v;
      return true;
    case "mp":
      e.mp = v;
      return true;
    case "hp_r":
      e.hp_r = v;
      return true;
    case "hp":
      e.hp = v;
      return true;
    case "mp_max":
      e.mp_max = v;
      return true;
    case "hp_max":
      e.hp_max = v;
      return true;
    case "blinking":
      e.blinking = v;
      return true;
    case "invisible":
      e.invisible = v;
      return true;
    case "invulnerable":
      e.invulnerable = v;
      return true;
    case "arest":
      e.arest = v;
      return true;
    case "catch_time":
      e.set_catch_time(v as never);
      return true;
    case "variant":
      e.variant = v;
      return true;
    case "wait":
      e.wait = v;
      return true;
    case "stat_bar":
      e.stat_bar = v;
      return true;
    case "facing":
      e.facing = v as never;
      return true;
    case "motionless":
      e.motionless = v;
      return true;
    case "shaking":
      e.shaking = v;
      return true;
    case "fallinjury":
      e.fallinjury = v;
      return true;
    case "throwinjury":
      e.throwinjury = v;
      return true;
    case "name_visible":
      e.name_visible = v;
      return true;
    case "wakeup_invuln":
      e.wakeup_invuln = v;
      return true;
    case "dead_gone":
      e.dead_gone = v;
      return true;
    case "ctrl_visible":
      e.ctrl_visible = v;
      return true;
    case "puppet":
      e.puppet = !!v;
      return true;
    case "is_on_ground":
      e.is_on_ground = !!v;
      return true;
    case "transform_index":
      e.transform_index = v;
      return true;
    case "jumping.x":
      e.jumping.x = v;
      return true;
    case "jumping.y":
      e.jumping.y = v;
      return true;
    case "jumping.z":
      e.jumping.z = v;
      return true;
    case "jumping.t":
      e.jumping.t = v;
      return true;
    default:
      void p;
      return false;
  }
};

const setValue = (e: Entity, name: string, v: unknown): boolean => {
  switch (name) {
    case "outline_color":
      e.outline_color = String(v);
      return true;
    case "mix_color":
      e.mix_color = String(v);
      return true;
    case "outline_enabled":
      e.outline_enabled = v as never;
      return true;
    case "name":
      e.name = v as never;
      return true;
    case "team":
      e.team = String(v);
      return true;
    case "dismiss_time":
      e.dismiss_time = v as never;
      return true;
    case "dismiss_data":
      e.dismiss_data = v as never;
      return true;
    case "landing_frame":
      (e as unknown as { _landing_frame: unknown })._landing_frame = v;
      return true;
    case "transforms":
      e.transforms = v as never;
      return true;
    case "dead_join":
      e.dead_join = v as never;
      return true;
    default:
      return false;
  }
};

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) {
    process.stderr.write("usage: lfw_trace_entity.mjs <case-file>\n");
    process.exit(2);
  }

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;
    let i = 1;
    log.length = 0;
    if (op === "env") {
      const sub = t[i++]!;
      if (sub === "dataset") {
        const idx = [i];
        const key = String(parseValue(t, idx));
        dataset[key as keyof WorldDataset] = parseValue(t, idx) as never;
      } else if (sub === "bg") {
        const idx = [i];
        const key = String(parseValue(t, idx));
        bgDataset[key] = parseValue(t, idx);
      } else if (sub === "team") {
        team = String(parseValue(t, [i]));
      } else if (sub === "data") {
        const idx = [i];
        const id = String(parseValue(t, idx));
        dataTable.set(id, parseValue(t, idx));
      } else if (sub === "ecount") {
        const n = Number(parseValue(t, [i]));
        (worldStub as unknown as { entities: unknown[] }).entities = new Array<unknown>(n);
      } else if (sub === "gtime") {
        (worldStub as unknown as { game_time: number }).game_time = Number(parseValue(t, [i]));
      } else if (sub === "gen") {
        const idx = [i];
        const kind = String(parseValue(t, idx));
        gens.set(kind, parseValue(t, idx));
      } else if (sub === "genclear") {
        gens.clear();
      } else if (sub === "ents") {
        candidateTokens = t.slice(i);
        log.push("ents:" + candidateTokens.join(","));
      } else if (sub === "ballctrl") {
        const flag = t[i++]!;
        const v = t[i++]!;
        ballCtrl = flag === "b" && v === "1";
      } else if (sub === "puppets") {
        // `world.puppets.values()` 的名单（token 与 `env ents` 同款）。
        puppetTokens = t.slice(i);
        log.push("puppets:" + puppetTokens.join(","));
      } else if (sub === "stage") {
        // `env stage <key> <值>`：舞台边界（`player_l` / `player_r` / `far` / `near`）。
        const idx = [i];
        const key = String(parseValue(t, idx));
        (worldStub.stage as Record<string, unknown>)[key] = parseValue(t, idx);
      } else if (sub === "groundstep") {
        groundStep = Number(parseValue(t, [i]));
      } else if (sub === "rankmode") {
        const flag = t[i++]!;
        const v = t[i++]!;
        rankMode = flag === "b" && v === "1";
      } else if (sub === "rankavail") {
        const flag = t[i++]!;
        const v = t[i++]!;
        rankAvail = flag === "b" && v === "1";
      } else if (sub === "cheat") {
        // `lfw.is_cheat(name)` 的第二段：`world.dataset` 里有没有这个作弊键。
        const idx = [i];
        const name = String(parseValue(t, idx));
        const flag = t[idx[0]++]!;
        const v = t[idx[0]++]!;
        if (flag === "b" && v === "1") cheatSet.add(name);
        else cheatSet.delete(name);
      } else {
        process.stderr.write(`unknown env '${sub}'\n`);
        process.exit(2);
      }
      out.push(`env ${sub}`);
      continue;
    }
    if (op === "run") {
      const what = t[i++]!;
      if (what === "make") {
        ent = new Entity(worldStub as never, parseValue(t, [i]) as never, states as never);
        bindCallbacks(ent);
        out.push(`run make || id=${ent.id} | ${log.join(",")}`);
      } else if (what === "reset") {
        ent!.reset(parseValue(t, [i]) as never);
        out.push(`run reset || id=${ent!.id} | ${log.join(",")}`);
      } else if (what === "resetstates") {
        // `reset(data, states)`: the registry switch is observable, so the scene can
        // tell the default `ENTITY_STATES` apart from the harness registry.
        ent!.reset(parseValue(t, [i]) as never, states as never);
        out.push(`run resetstates || id=${ent!.id} | ${log.join(",")}`);
      } else if (what === "get") {
        const name = t[i++]!;
        let v: unknown = undefined;
        if (NUMERIC_FIELDS.has(name)) v = getNum(ent!, name);
        else if (VALUE_FIELDS.has(name)) v = getValue(ent!, name);
        else {
          process.stderr.write(`unknown get '${name}'\n`);
          process.exit(2);
        }
        out.push(`run get ${name} || ${log.join(",")} | v=${r(v)}`);
      } else if (what === "set") {
        const name = t[i++]!;
        const inV = parseValue(t, [i]);
        let ok = false;
        let outV: unknown = undefined;
        if (VALUE_FIELDS.has(name) && setValue(ent!, name, inV)) {
          ok = true;
          outV = getValue(ent!, name);
        } else if (NUMERIC_FIELDS.has(name) && setNum(ent!, name, Number(inV))) {
          ok = true;
          outV = getNum(ent!, name);
        }
        if (!ok) {
          process.stderr.write(`unknown set '${name}'\n`);
          process.exit(2);
        }
        out.push(`run set ${name} ${r(inV)} || ${log.join(",")} | v=${r(outV)}`);
      } else if (what === "slots") {
        out.push(`run slots || ${log.join(",")} | v=${r(statSlots(ent!))}`);
      } else if (what === "armor") {
        ent!.reset_armor();
        out.push(`run armor || ${log.join(",")} | v=${r(statSlots(ent!))}`);
      } else if (what === "catch") {
        ent!.set_catch_time(Number(parseValue(t, [i])));
        out.push(`run catch || ${log.join(",")} | v=${r(statSlots(ent!))}`);
      } else if (what === "addcatch") {
        ent!.add_catch_time(Number(parseValue(t, [i])));
        out.push(`run addcatch || ${log.join(",")} | v=${r(statSlots(ent!))}`);
      } else if (what === "catching") {
        ent!.set_catching(null);
        out.push(`run catching || ${log.join(",")}`);
      } else if (what === "role") {
        ent!.as_key_role(parseValue(t, [i]));
        out.push(`run role || ${log.join(",")} | v=${r(roleProbe(ent!))}`);
      } else if (what === "autorole") {
        ent!.auto_key_role();
        out.push(`run autorole || ${log.join(",")} | v=${r(roleProbe(ent!))}`);
      } else if (what === "dataset") {
        const key = String(parseValue(t, [i]));
        out.push(
          `run dataset ${r(key)} || ${log.join(",")} | v=${r(ent!.dataset(key as never))}`,
        );
      } else if (what === "itrfall") {
        const itr = parseValue(t, [i]);
        out.push(
          `run itrfall ${r(itr)} || ${log.join(",")} | v=${r(ent!.itr_fall(itr as never))}`,
        );
      } else if (what === "ctrl") {
        const kind = t[i++]!;
        if (kind === "none") ent!.ctrl = undefined;
        else if (kind === "same") ent!.ctrl = ent!.ctrl;
        else if (kind === "ball") {
          // 真控制器（端口那边同样是 `new BallController()`）。
          // harness 里实体的 `position` 是轻量对象（有 `set`，没有真 `Vector3` 的
          // `clone`/`copy`），而 `BallController.chase_point` 的惰性初始化要用到它们
          // ⇒ 就地补一份（值语义的副本，跟端口的 `Vector3` 一致）。
          const pos = (ent as unknown as { position: Record<string, unknown> }).position;
          const mk = (x: number, y: number, z: number): Record<string, unknown> => {
            const o: Record<string, unknown> = { x, y, z };
            o.set = (nx: number, ny: number, nz: number): void => {
              o.x = nx;
              o.y = ny;
              o.z = nz;
            };
            o.copy = (v: { x: number; y: number; z: number }): void => {
              o.x = v.x;
              o.y = v.y;
              o.z = v.z;
            };
            o.clone = (): Record<string, unknown> =>
              mk(o.x as number, o.y as number, o.z as number);
            return o;
          };
          Object.defineProperty(pos, "clone", {
            enumerable: false,
            configurable: true,
            value: (): Record<string, unknown> =>
              mk(pos.x as number, pos.y as number, pos.z as number),
          });
          ball = new BallController("p0", ent! as never);
          ball.reset("p0", ent! as never);
          (ent as unknown as { ctrl: unknown }).ctrl = ball;
          out.push(`run ctrl ball || ${log.join(",")} | v=ball`);
          continue;
        } else ent!.ctrl = makeCtrl(kind);
        out.push(`run ctrl ${kind} || ${log.join(",")} | v=${ctrlMark(ent!.ctrl)}`);
      } else if (what === "ball") {
        // `BallController` 的驱动器（`run ctrl ball` 已经把真控制器挂上去了）。
        const sub = t[i++]!;
        if (!ball) {
          process.stderr.write("run ball without `run ctrl ball`\n");
          process.exit(2);
        }
        const b = ball!;
        let head = `run ball ${sub}`;
        if (sub === "point") {
          const idx = [i];
          const x = Number(parseValue(t, idx));
          const y = Number(parseValue(t, idx));
          const z = Number(parseValue(t, idx));
          b.set_chase_point(x, y, z);
          head += ` ${r(x)} ${r(y)} ${r(z)}`;
        } else if (sub === "aim") {
          const tok = t[i++]!;
          head += ` ${tok}`;
          const other = candidateOf(tok);
          const idx = [i];
          if (idx[0] < t.length) {
            const oy = Number(parseValue(t, idx));
            head += ` ${r(oy)}`;
            b.aim_at(other as never, oy);
          } else {
            b.aim_at(other as never);
          }
        } else if (sub === "lookup") {
          const meTok = t[i++]!;
          head += ` ${meTok}`;
          const list = candidateTokens.map((tk) => candidateOf(tk)).filter((e) => !!e);
          b.update_lookup(candidateTokens.indexOf(meTok), list as never);
        } else if (sub === "should") {
          const tok = t[i++]!;
          head += ` ${tok}`;
          out.push(
            `${head} || ${log.join(",")} | v=${r(b.should_chase(candidateOf(tok) as never) ? 1 : 0)}`,
          );
          continue;
        } else if (sub === "closer") {
          // 直连 `helper/closer_one`（端口那边调真函数）：`s` / `t1` / `t2` 都用 token，
          // `z` / `nil` 给 `null`，认不出的 token 给 `undefined`。
          const sTok = t[i++]!;
          const aTok = t[i++]!;
          const bTok = t[i++]!;
          head += ` ${sTok} ${aTok} ${bTok}`;
          const refOf = (tk: string): Entity | null | undefined =>
            tk === "z" || tk === "nil" ? null : candidateOf(tk);
          out.push(
            `${head} || ${log.join(",")} | v=${r(
              idRef(closer_one(refOf(sTok) as never, refOf(aTok) as never, refOf(bTok) as never)),
            )}`,
          );
          continue;
        } else if (sub === "dir") {
          const idx = [i];
          const delta = Number(parseValue(t, idx));
          const over = Number(parseValue(t, idx));
          const prev = Number(parseValue(t, idx));
          head += ` ${r(delta)} ${r(over)} ${r(prev)}`;
          out.push(`${head} || ${log.join(",")} | v=${r(b.calc_dir(delta, over, prev as never))}`);
          continue;
        } else if (sub === "stop") {
          b.stop_chasing();
        } else if (sub === "update") {
          b.update();
        } else {
          process.stderr.write(`unknown ball '${sub}'\n`);
          process.exit(2);
        }
        out.push(`${head} || ${log.join(",")} |${ballState(b)}`);
      } else if (what === "frame") {
        ent!.frame = parseValue(t, [i]) as never;
        out.push(`run frame ${r(ent!.frame)} || ${log.join(",")} | v=${r(ent!.frame)}`);
      } else if (what === "pos") {
        const idx = [i];
        const x = Number(parseValue(t, idx));
        const y = Number(parseValue(t, idx));
        const z = Number(parseValue(t, idx));
        ent!.position.set(x, y, z);
        out.push(`run pos ${r(x)} ${r(y)} ${r(z)} || ${log.join(",")} | p=${r(ent!.position)}`);
      } else if (what === "ground") {
        const y = Number(parseValue(t, [i]));
        (ent as unknown as { _ground_y: number })._ground_y = y;
        out.push(`run ground ${r(y)} || ${log.join(",")} | g=${r(ent!.ground_y)}`);
      } else if (what === "link") {
        const field = t[i++]!;
        const to = t[i++]!;
        const v = to === "self" ? (ent as unknown) : to === "buddy" ? (buddy as unknown) : null;
        if (field === "bearer") ent!.bearer = v as never;
        else if (field === "catcher") ent!.catcher = v as never;
        else if (field === "holding") ent!.holding = v as never;
        else if (field === "catching") ent!.catching = v as never;
        else {
          process.stderr.write(`unknown link '${field}'\n`);
          process.exit(2);
        }
        out.push(
          `run link ${field} ${to} || ${log.join(",")} | b=${r(!!ent!.bearer)} c=${r(!!ent!.catcher)}`,
        );
      } else if (what === "fuseby") {
        const tok = t[i++]!;
        const e = candidateOf(tok);
        if (!e) {
          process.stderr.write(`unknown fuseby '${tok}'\n`);
          process.exit(2);
        }
        const fus = (ent as unknown as { fuse_bys: Entity[] | null }).fuse_bys;
        if (fus) fus.push(e);
        else (ent as unknown as { fuse_bys: Entity[] }).fuse_bys = [e];
        const len = (ent as unknown as { fuse_bys: Entity[] | null }).fuse_bys?.length ?? 0;
        out.push(`run fuseby ${tok} || ${log.join(",")} | n=${len}`);
      } else if (what === "fuseclear") {
        (ent as unknown as { fuse_bys: Entity[] | null }).fuse_bys = null;
        out.push(`run fuseclear || ${log.join(",")} | n=0`);
      } else if (what === "buddyframe") {
        const v = parseValue(t, [i]);
        buddy!.set_frame(v as never);
        out.push(
          `run buddyframe ${r(v)} || ${log.join(",")} | f=${r((buddy!.frame as { id?: unknown }).id)}`,
        );
      } else if (what === "linkb") {
        const field = t[i++]!;
        const to = t[i++]!;
        const v = to === "self" ? (ent as unknown) : to === "buddy" ? (buddy as unknown) : null;
        if (field === "bearer") buddy!.bearer = v as never;
        else if (field === "catcher") buddy!.catcher = v as never;
        else if (field === "holding") buddy!.holding = v as never;
        else if (field === "catching") buddy!.catching = v as never;
        else {
          process.stderr.write(`unknown linkb '${field}'\n`);
          process.exit(2);
        }
        out.push(`run linkb ${field} ${to} || ${log.join(",")} | ${relProbe()}`);
      } else if (what === "gv") {
        // `get_val_getter_from_entity(word)` 查表再调用；`has` 区分表里有没有这一项
        // （TS 那边的 `undefined` 不能被调用，所以表里没有时只能印 `v=-`）。
        const word = String(parseValue(t, [i]));
        const getter = get_val_getter_from_entity(word);
        if (!getter) {
          out.push(`run gv ${r(word)} || ${log.join(",")} | has=0 v=-`);
        } else {
          const v = getter(ent! as never, word as never, undefined as never);
          out.push(`run gv ${r(word)} || ${log.join(",")} | has=1 v=${r(v)}`);
        }
      } else if (what === "cvwho") {
        const aTok = t[i++]!;
        const vTok = t[i++]!;
        const a = cvEntityOf(aTok);
        const v = cvEntityOf(vTok);
        cv = {
          attacker: a ?? { id: "__outside__" },
          victim: v ?? { id: "__outside__" },
          itr: cv.itr ?? {},
          bdy: cv.bdy ?? {},
          aframe: cvFrameOf(a),
          bframe: cvFrameOf(v),
        };
        out.push(
          `run cvwho ${aTok} ${vTok} || ${log.join(",")} | a=${cvIdOf(aTok)} v=${cvIdOf(vTok)}` +
            ` af=${fid(cv.aframe)} bf=${fid(cv.bframe)}`,
        );
      } else if (what === "cvclear") {
        cvReset();
        out.push(`run cvclear || ${log.join(",")} | v=1`);
      } else if (what === "cvset") {
        const field = t[i++]!;
        const idx = [i];
        const v = parseValue(t, idx);
        if (field === "itr") cv.itr = v;
        else if (field === "bdy") cv.bdy = v;
        else if (field === "aframe") cv.aframe = v;
        else if (field === "bframe") cv.bframe = v;
        else if (field === "aid") cv.attacker = { id: String(v) };
        else if (field === "vid") cv.victim = { id: String(v) };
        else {
          process.stderr.write(`unknown cvset '${field}'\n`);
          process.exit(2);
        }
        out.push(`run cvset ${field} ${r(v)} || ${log.join(",")} | v=${r(v)}`);
      } else if (what === "cvkey") {
        // `hit` = `keys[k].hit(1)`（`_d_time = 1`）、`start` = `keys[k].hit()`（默认参数
        // ⇒ `_d_time = ctrl.time`，`is_start` 为真）、`db` =
        // `dbc[k].press(ctrl.time, undefined, 1000)`（`is_db_hit` 为真）。
        const who = t[i++]!;
        const mode = t[i++]!;
        const target = who === "buddy" ? buddy : ent;
        const c = target?.ctrl as BaseController | undefined;
        if (!c) {
          process.stderr.write(`run cvkey without a controller\n`);
          process.exit(2);
        }
        const keys = c.keys as unknown as Record<string, { hit: (t?: number) => void }>;
        const dbc = c.dbc as unknown as Record<
          string,
          { press: (t: number, data?: unknown, interval?: number) => void }
        >;
        for (; i < t.length; i++) {
          const name = t[i]!;
          if (!KEY_NAMES.has(name)) {
            process.stderr.write(`unknown key '${name}'\n`);
            process.exit(2);
          }
          if (mode === "hit") keys[name]!.hit(1);
          else if (mode === "start") keys[name]!.hit();
          else if (mode === "db") dbc[name]!.press(c.time, void 0, 1000);
          else {
            process.stderr.write(`unknown cvkey mode '${mode}'\n`);
            process.exit(2);
          }
        }
        out.push(`run cvkey ${who} ${mode} || ${log.join(",")} | ${cvKeyState(c)}`);
      } else if (what === "cv") {
        // `get_val_geter_from_collision(word)` 查表再调用；`has` 区分表里有没有这一项。
        const word = String(parseValue(t, [i]));
        const getter = get_val_geter_from_collision(word);
        if (!getter) {
          out.push(`run cv ${r(word)} || ${log.join(",")} | has=0 v=-`);
        } else {
          const v = getter(cv as never, word as never, undefined as never);
          out.push(`run cv ${r(word)} || ${log.join(",")} | has=1 v=${r(v)}`);
        }
      } else if (what === "supern") {
        // `e.superpunchs.size`（`RequireSuperPunch`）：清空后塞 n 条。
        const n = Number(parseValue(t, [i]));
        ent!.superpunchs.clear();
        for (let k = 0; k < n; ++k) ent!.superpunchs.set("s" + k, {} as never);
        out.push(`run supern ${r(n)} || ${log.join(",")} | n=${ent!.superpunchs.size}`);
      } else if (what === "buffset") {
        // `e.buffs.values()`（`HitByMagicFlute`）：清空后按行尾给出的 kind 逐个插入。
        ent!.buffs.clear();
        const idx = [i];
        let k = 0;
        while (idx[0] < t.length) {
          const id = "b" + k;
          ent!.buffs.set(id, new FakeBuff(id, parseValue(t, idx)));
          ++k;
        }
        out.push(`run buffset || ${log.join(",")} | n=${ent!.buffs.size}`);
      } else if (what === "addcoll") {
        // `collided_list` / `collision_list` 追加一项：`aframe` / `itr` / `bframe` 用对象
        // 字面量，`attacker` / `victim` 只给 `data.type`（TS 的 type_check 只读它）。
        const which = t[i++]!;
        const idx = [i];
        const dtA = Number(parseValue(t, idx));
        const dtV = Number(parseValue(t, idx));
        const aframe = parseValue(t, idx);
        const itr = parseValue(t, idx);
        const bframe = parseValue(t, idx);
        const item = {
          attacker: { data: { type: dtA } },
          victim: { data: { type: dtV } },
          aframe,
          itr,
          bframe,
        };
        if (which === "collided") ent!.collided_list.push(item as never);
        else if (which === "collision") ent!.collision_list.push(item as never);
        else {
          process.stderr.write(`unknown addcoll '${which}'\n`);
          process.exit(2);
        }
        out.push(
          `run addcoll ${which} || ${log.join(",")} | nc=${ent!.collided_list.length} no=${ent!.collision_list.length}`,
        );
      } else if (what === "collclear") {
        const which = t[i++]!;
        if (which === "collided" || which === "both") (ent!.collided_list as unknown[]).length = 0;
        if (which === "collision" || which === "both") (ent!.collision_list as unknown[]).length = 0;
        if (which !== "collided" && which !== "collision" && which !== "both") {
          process.stderr.write(`unknown collclear '${which}'\n`);
          process.exit(2);
        }
        out.push(
          `run collclear ${which} || ${log.join(",")} | nc=${ent!.collided_list.length} no=${ent!.collision_list.length}`,
        );
      } else if (what === "setvel") {
        const idx = [i];
        const x = parseValue(t, idx);
        const y = parseValue(t, idx);
        const z = parseValue(t, idx);
        ent!.set_velocity(x as never, y as never, z as never);
        out.push(
          `run setvel ${r(x)} ${r(y)} ${r(z)} || ${log.join(",")} | v=${r(ent!.velocity)} pv=${r(ent!.prev_velocity)} g=${r(ent!.is_on_ground)}`,
        );
      } else if (what === "leaveground") {
        ent!.leave_ground();
        out.push(
          `run leaveground || ${log.join(",")} | p=${r(ent!.position)} g=${r(ent!.is_on_ground)}`,
        );
      } else if (what === "gravity") {
        ent!.handle_gravity();
        out.push(`run gravity || ${log.join(",")} | v=${r(ent!.velocity)}`);
      } else if (what === "gdecay") {
        const factor = parseValue(t, [i]);
        if (factor === undefined) ent!.handle_ground_velocity_decay();
        else ent!.handle_ground_velocity_decay(Number(factor));
        out.push(
          `run gdecay ${r(factor)} || ${log.join(",")} | v=${r(ent!.velocity)} pv=${r(ent!.prev_velocity)}`,
        );
      } else if (what === "vdecay") {
        const idx = [i];
        const accx = parseValue(t, idx);
        const accz = parseValue(t, idx);
        const factor = parseValue(t, idx);
        ent!.handle_velocity_decay(accx as never, accz as never, factor as never);
        out.push(
          `run vdecay ${r(accx)} ${r(accz)} ${r(factor)} || ${log.join(",")} | v=${r(ent!.velocity)} pv=${r(ent!.prev_velocity)}`,
        );
      } else if (what === "velocity") {
        const vinfo = parseValue(t, [i]);
        ent!.update_velocity(vinfo as never);
        out.push(
          `run velocity ${r(vinfo)} || ${log.join(",")} | v=${r(ent!.velocity)} pv=${r(ent!.prev_velocity)} g=${r(ent!.is_on_ground)}`,
        );
      } else if (what === "land") {
        const self = t[i] === "self";
        const v = self ? ent!.frame : parseValue(t, [i]);
        (ent as unknown as { _landing_frame: unknown })._landing_frame = v;
        out.push(
          `run land ${self ? "self" : r(v)} || ${log.join(",")} | v=${r((ent as unknown as { _landing_frame: unknown })._landing_frame)}`,
        );
      } else if (what === "keys") {
        const lr = Number(t[i++]);
        const ud = Number(t[i++]);
        const jd = Number(t[i++]);
        const c = makeCtrl("base")!;
        const keys = (c as unknown as { keys: Record<string, { hit: (t?: number) => void }> })
          .keys;
        if (lr > 0) keys.R!.hit(1);
        else if (lr < 0) keys.L!.hit(1);
        if (ud > 0) keys.D!.hit(1);
        else if (ud < 0) keys.U!.hit(1);
        if (jd > 0) keys.j!.hit(1);
        else if (jd < 0) keys.d!.hit(1);
        const extra = hitExtraKeys(keys, t, i);
        ent!.ctrl = c;
        out.push(
          `run keys ${r(lr)} ${r(ud)} ${r(jd)}${extra} || ${log.join(",")} | lr=${c.LR} ud=${c.UD} jd=${c.jd}`,
        );
      } else if (what === "bkeys") {
        // `keys` for the buddy: `follow_catcher` / `follow_bearer` scale one velocity
        // term by the *other* entity's controller direction.
        const lr = Number(t[i++]);
        const ud = Number(t[i++]);
        const jd = Number(t[i++]);
        const c = makeCtrl("base")!;
        const keys = (c as unknown as { keys: Record<string, { hit: (t?: number) => void }> })
          .keys;
        if (lr > 0) keys.R!.hit(1);
        else if (lr < 0) keys.L!.hit(1);
        if (ud > 0) keys.D!.hit(1);
        else if (ud < 0) keys.U!.hit(1);
        if (jd > 0) keys.j!.hit(1);
        else if (jd < 0) keys.d!.hit(1);
        const extra = hitExtraKeys(keys, t, i);
        if (buddy) buddy.ctrl = c;
        out.push(
          `run bkeys ${r(lr)} ${r(ud)} ${r(jd)}${extra} || ${log.join(",")} | lr=${c.LR} ud=${c.UD} jd=${c.jd}`,
        );
      } else if (what === "buddy") {
        // Replacing the buddy detaches every relation that pointed at the old one, so the
        // two sides compare the same scene (the port would otherwise free it).
        if (buddy) {
          const a = ent as unknown as {
            holding: unknown;
            catching: unknown;
            bearer: unknown;
            catcher: unknown;
          };
          if (a.holding === buddy) a.holding = null;
          if (a.catching === buddy) a.catching = null;
          if (a.bearer === buddy) a.bearer = null;
          if (a.catcher === buddy) a.catcher = null;
        }
        buddy = new Entity(worldStub as never, parseValue(t, [i]) as never, states as never);
        bindHostSpies(buddy);
        out.push(`run buddy || id=${buddy.id} | ${log.join(",")}`);
      } else if (what === "buddyset") {
        const name = t[i++]!;
        const inV = parseValue(t, [i]);
        let outV: unknown = undefined;
        if (VALUE_FIELDS.has(name) && setValue(buddy!, name, inV)) outV = getValue(buddy!, name);
        else if (NUMERIC_FIELDS.has(name) && setNum(buddy!, name, Number(inV))) {
          outV = getNum(buddy!, name);
        } else {
          process.stderr.write(`unknown buddyset '${name}'\n`);
          process.exit(2);
        }
        out.push(`run buddyset ${name} ${r(inV)} || ${log.join(",")} | v=${r(outV)}`);
      } else if (what === "prev") {
        const v = parseValue(t, [i]);
        (ent as unknown as { _prev_frame: unknown })._prev_frame = v;
        out.push(`run prev ${r(v)} || ${log.join(",")} | v=${r(ent!.get_prev_frame())}`);
      } else if (what === "findframe") {
        const id = parseValue(t, [i]);
        out.push(
          `run findframe ${r(id)} || ${log.join(",")} | v=${r(ent!.find_frame_by_id(id as never))}`,
        );
      } else if (what === "autoframe") {
        out.push(`run autoframe || ${log.join(",")} | v=${r(ent!.find_auto_frame())}`);
      } else if (what === "align") {
        const idx = [i];
        const fid = parseValue(t, idx);
        const src = parseValue(t, idx);
        const dst = parseValue(t, idx);
        out.push(
          `run align ${r(fid)} ${r(src)} ${r(dst)} || ${log.join(",")} | v=${r(ent!.find_align_frame(String(fid), src as never, dst as never))}`,
        );
      } else if (what === "suddenframe") {
        out.push(
          `run suddenframe || ${log.join(",")} | v=${r(ent!.get_sudden_death_frame())}`,
        );
      } else if (what === "caughtframe") {
        const v = ent!.get_caught_end_frame();
        out.push(
          `run caughtframe || ${log.join(",")} | v=${r(v)} p=${r(ent!.position)}`,
        );
      } else if (what === "facingflag") {
        const f = parseValue(t, [i]);
        out.push(
          `run facingflag ${r(f)} || ${log.join(",")} | v=${r(ent!.handle_facing_flag(f as never))} f=${r(ent!.facing)}`,
        );
      } else if (what === "waitflag") {
        const idx = [i];
        const w = parseValue(t, idx);
        const f = parseValue(t, idx);
        out.push(
          `run waitflag ${r(w)} ${r(f)} || ${log.join(",")} | v=${r(ent!.handle_wait_flag(w as never, f as never))} w=${r(ent!.wait)}`,
        );
      } else if (what === "framewait") {
        const f = parseValue(t, [i]);
        out.push(
          `run framewait ${r(f)} || ${log.join(",")} | v=${r(ent!.get_frame_wait(f as never))}`,
        );
      } else if (what === "waitblock") {
        const b = Number(t[i++]);
        (ent as unknown as { _from_wait_block: boolean })._from_wait_block = b !== 0;
        out.push(
          `run waitblock ${r(b)} || ${log.join(",")} | v=${r((ent as unknown as { _from_wait_block: boolean })._from_wait_block ? 1 : 0)}`,
        );
      } else if (what === "summaries") {
        const m = summary_mgr as unknown as {
          _items: Map<string, { hp_lost: number; mp_usage: number; picking_sum: number }>;
          _graves: unknown[];
        };
        let s = "";
        let picks = "";
        for (const [id, sum] of m._items) {
          s += ` ${id}:${r(sum.hp_lost)}/${r(sum.mp_usage)}`;
          picks += ` ${id}:${r(sum.picking_sum)}`;
        }
        out.push(
          `run summaries || ${log.join(",")} | graves=${m._graves.length} items${s} p${picks}`,
        );
      } else if (what === "mark" || what === "delmark") {
        const idx = [i];
        const key = parseValue(t, idx);
        const hasValue = what === "mark";
        const value = hasValue ? parseValue(t, idx) : undefined;
        const hasGuard = idx[0] < t.length;
        const guard = hasGuard ? parseValue(t, idx) : undefined;
        const e = ent as unknown as {
          set_mark(k: string, v: string, prev?: unknown): boolean;
          del_mark(k: string, prev?: unknown): boolean;
        };
        const ok =
          what === "mark"
            ? e.set_mark(String(key), String(value), guard)
            : e.del_mark(String(key), guard);
        out.push(
          `run ${what} ${r(key)} ${hasValue ? r(value) : "-"} ${hasGuard ? r(guard) : "-"} || ${log.join(",")} | v=${r(ok)} marks=${marksText(ent!)}`,
        );
      } else if (what === "ally") {
        const which = t[i++]!;
        const other = which === "buddy" ? buddy : ent;
        out.push(
          `run ally ${which} || ${log.join(",")} | v=${r(ent!.is_ally(other!))} team=${r(ent!.team)} other=${other ? r(other.team) : "-"}`,
        );
      } else if (what === "emit") {
        const idx = Number(t[i++]!);
        const idValue = parseValue(t, [i]);
        const list = (ent as unknown as { emitters: string[] }).emitters;
        list[idx] = String(idValue);
        out.push(
          `run emit ${idx} ${r(idValue)} || ${log.join(",")} | n=${list.length}`,
        );
      } else if (what === "emitid") {
        const idxToken = t[i++]!;
        const which = t[i++]!;
        const idx = Number(idxToken);
        const target = which === "buddy" ? buddy : ent;
        const eid = target !== undefined ? target.id : "";
        const list = (ent as unknown as { emitters: string[] }).emitters;
        list[idx] = eid;
        out.push(
          `run emitid ${idxToken} ${which} || ${log.join(",")} | n=${list.length}`,
        );
      } else if (what === "getemitter") {
        const idx = Number(t[i++]!);
        const found = ent!.get_emitter(idx);
        out.push(
          `run getemitter ${idx} || ${log.join(",")} | v=${found === undefined ? "u" : r(idRef(found))}`,
        );
      } else if (what === "rec") {
        const which = t[i++]!;
        const e = ent!;
        if (which === "stat") e.stat_recovering();
        else if (which === "hp") e.hp_recovering();
        else if (which === "mp") e.mp_recovering();
        else if (which === "toughness") e.toughness_recovering();
        else if (which === "fall") e.fall_value_recovering();
        else if (which === "defend") e.defend_value_recovering();
        else {
          process.stderr.write(`unknown rec '${which}'\n`);
          process.exit(2);
        }
        out.push(
          `run rec ${which} || ${log.join(",")} | hp=${r(e.hp)} hpr=${r((e as unknown as { _hp_r: number })._hp_r)} mp=${r(e.mp)} mpmax=${r(e.mp_max)} r=${r(e.resting)} t=${r(e.toughness)} tr=${r(e.toughness_resting)} fv=${r(e.fall_value)} dv=${r(e.defend_value)}`,
        );
      } else if (what === "snap" || what === "snapbuf" || what === "snapapply") {
        if (what === "snapapply") ent!.read_snapshot(gSnapNums as never, gSnapStrs as never);
        const nums = new Array<unknown>(Number(NSlot.COUNT));
        const strs = new Array<unknown>(Number(SSlot.COUNT));
        ent!.to_snapshot(nums as never, strs as never);
        if (what === "snapbuf") {
          gSnapNums = nums;
          gSnapStrs = strs;
        }
        out.push(
          `run ${what} || ${log.join(",")} | n=${renderNums(nums)} s=${renderStrs(strs)}`,
        );
      } else if (what === "snappoke") {
        const name = t[i++]!;
        const idx = Number((NSlot as unknown as Record<string, number>)[name]);
        if (!Number.isFinite(idx)) {
          process.stderr.write(`unknown nslot '${name}'\n`);
          process.exit(2);
        }
        gSnapNums[idx] = parseValue(t, [i]);
        out.push(
          `run snappoke ${name} ${r(gSnapNums[idx])} || ${log.join(",")} | v=${r(gSnapNums[idx])}`,
        );
      } else if (what === "snappokestr") {
        const name = t[i++]!;
        const idx = Number((SSlot as unknown as Record<string, number>)[name]);
        if (!Number.isFinite(idx)) {
          process.stderr.write(`unknown sslot '${name}'\n`);
          process.exit(2);
        }
        gSnapStrs[idx] = parseValue(t, [i]);
        out.push(
          `run snappokestr ${name} ${r(gSnapStrs[idx])} || ${log.join(",")} | v=${r(gSnapStrs[idx])}`,
        );
      } else if (what === "snappokeid") {
        const name = t[i++]!;
        const which = t[i++]!;
        const target = which === "buddy" ? buddy : ent;
        const pokeId = target !== undefined ? target.id : "";
        const idx = Number((SSlot as unknown as Record<string, number>)[name]);
        if (!Number.isFinite(idx)) {
          process.stderr.write(`unknown sslot '${name}'\n`);
          process.exit(2);
        }
        gSnapStrs[idx] = pokeId;
        out.push(
          `run snappokeid ${name} ${which} || ${log.join(",")} | v=${r(pokeId)}`,
        );
      } else if (what === "copy") {
        const v = parseValue(t, [i]);
        const cid = String(v);
        const set = (ent as unknown as { copies: Set<string> }).copies;
        const added = !set.has(cid);
        set.add(cid);
        out.push(`run copy ${r(v)} || ${log.join(",")} | added=${r(added)}`);
      } else if (what === "hook") {
        const sub = t[i++]!;
        if (sub === "dead") {
          hooks.dead = true;
        } else if (sub === "gravity") {
          hooks.gravity = true;
          hooks.gravity_value = parseValue(t, [i]);
        } else if (sub === "frameid") {
          hooks.find = true;
          if (t[i] === "echo") {
            i++;
            hooks.find_echo = true;
          } else {
            hooks.find_echo = false;
            hooks.find_value = parseValue(t, [i]);
          }
        } else if (sub === "autoframe") {
          hooks.auto_frame = true;
          hooks.auto_frame_value = parseValue(t, [i]);
        } else if (sub === "sudden") {
          hooks.sudden = true;
          hooks.sudden_value = parseValue(t, [i]);
        } else if (sub === "caught") {
          hooks.caught = true;
          hooks.caught_value = parseValue(t, [i]);
        } else if (sub === "viewpos") {
          hooks.view_position = true;
        } else if (sub === "viewframe") {
          hooks.view_frame = true;
        } else if (sub === "viewenter") {
          hooks.view_enter = true;
        } else if (sub === "viewdata") {
          hooks.view_data = true;
        } else if (sub === "viewdismiss") {
          hooks.view_dismiss = true;
        } else if (sub === "preupdate") {
          hooks.pre_update = true;
        } else if (sub === "stateupdate") {
          hooks.state_update = true;
        } else if (sub === "landing") {
          hooks.landing = true;
        } else if (sub === "leaveground") {
          hooks.leave_ground = true;
        } else if (sub === "none") {
          hooks.dead = false;
          hooks.gravity = false;
          hooks.find = false;
          hooks.find_echo = false;
          hooks.auto_frame = false;
          hooks.sudden = false;
          hooks.caught = false;
          hooks.view_position = false;
          hooks.view_frame = false;
          hooks.view_enter = false;
          hooks.view_data = false;
          hooks.view_dismiss = false;
          hooks.pre_update = false;
          hooks.state_update = false;
          hooks.landing = false;
          hooks.leave_ground = false;
        } else {
          process.stderr.write(`unknown hook '${sub}'\n`);
          process.exit(2);
        }
        out.push(`run hook ${sub} || ${log.join(",")}`);
      } else if (what === "reg" || what === "regbare" || what === "regkey") {
        const bare = what === "regbare";
        const key: unknown = what === "regkey" ? parseValue(t, [i]) : Number(t[i++]);
        states.set(
          key as never,
          (bare ? new State_Base(key as never) : new HarnessState(key as never)) as never,
        );
        out.push(`run ${what} ${r(key)} || ${log.join(",")} | n=${states.map.size}`);
      } else if (what === "lastcollided") {
        const idx = [i];
        const aid = parseValue(t, idx);
        const team = parseValue(t, idx);
        (ent as Any).lastest_collided = { attacker: { id: aid, team } };
        out.push(
          `run lastcollided ${r(aid)} ${r(team)} || ${log.join(",")} | a=${r(aid)} t=${r(team)}`,
        );
      } else if (what === "setstate" || what === "setstateb") {
        const code = Number(t[i++]!);
        const e = (what === "setstateb" ? buddy : ent)!;
        e.set_state(code);
        out.push(
          `run ${what} ${r(code)} || ${log.join(",")} | n=${states.map.size} st=${r(
            (e as unknown as { _state: unknown })._state != null,
          )}`,
        );
      } else if (what === "vrest" || what === "vrestget" || what === "vrestdel") {
        const idx = [i];
        const aidValue = parseValue(t, idx);
        const aid = String(aidValue);
        let head = `run ${what} ${r(aidValue)}`;
        if (what === "vrest") {
          const kind = parseValue(t, idx);
          const rest = parseValue(t, idx);
          head += ` ${r(kind)} ${r(rest)}`;
          // The port builds its `Collision` struct directly; only `aid`, `itr.kind`
          // and `rest` are read by the three v_rest entry points.  `drop_holding` hands
          // the record to `collision_clone`, which mints an id from `src.lfw`; that id is
          // never read (nothing keys on `Collision.id`), so the stub keeps the *real* id
          // counter untouched and the port copies the record as-is (DESIGN §52.4).
          const entry = { aid, itr: { kind }, rest: Number(rest) } as Record<string, unknown>;
          let cloneIds = 0;
          Object.defineProperty(entry, "lfw", {
            enumerable: false,
            value: {
              get new_id(): string {
                cloneIds += 1;
                return "clone" + cloneIds;
              },
            },
          });
          ent!.add_v_rest(entry as never);
        } else if (what === "vrestdel") {
          ent!.del_v_rest(aid);
        }
        const sizes = ent as unknown as {
          vrests: Map<string, CollisionLike>;
          blockers: Map<string, CollisionLike>;
          superpunchs: Map<string, CollisionLike>;
        };
        out.push(
          `${head} || ${log.join(",")} | n=${sizes.vrests.size} b=${sizes.blockers.size} s=${
            sizes.superpunchs.size
          } g=${r(ent!.get_v_rest(aid))}`,
        );
      } else if (what === "vratt") {
        const idx = [i];
        const aid = String(parseValue(t, idx));
        const ax = Number(parseValue(t, idx));
        const az = Number(parseValue(t, idx));
        const maps = ent as unknown as {
          vrests: Map<string, { attacker?: { position?: { x?: number; z?: number } } }>;
          blockers: Map<string, { attacker?: { position?: { x?: number; z?: number } } }>;
        };
        for (const m of [maps.vrests, maps.blockers]) {
          const c = m.get(aid);
          if (c) {
            c.attacker ??= {};
            c.attacker.position ??= {};
            c.attacker.position.x = ax;
            c.attacker.position.z = az;
          }
        }
        out.push(
          `run vratt ${r(aid)} ${r(ax)} ${r(az)} || ${log.join(",")} | ax=${r(ax)} az=${r(az)}`,
        );
      } else if (what === "setframe") {
        const v = parseValue(t, [i]);
        ent!.set_frame(v as never);
        const pairs = (ent as unknown as { _opoints: [Record<string, unknown>, number][] })
          ._opoints;
        const ids = pairs.map((p) => r(p[0].interval_id)).join(",");
        out.push(
          `run setframe ${r(v)} || ${log.join(",")} | f=${fid(ent!.frame)} pf=${prevId(
            ent!,
          )} lf=${r((ent as unknown as { _landing_frame: unknown })._landing_frame)} ar=${r(
            ent!.arest,
          )} mt=${r((ent as unknown as { _motionless_ticks: number })._motionless_ticks)} in=${r(
            ent!.invisible,
          )} bl=${r(ent!.blinking)} iv=${r(ent!.invulnerable)} op=[${ids}] p=${r(
            ent!.position,
          )} bp=${buddy ? r(buddy.position) : "z"} ${relProbe()}`,
        );
      } else if (what === "buddydump") {
        out.push(`run buddydump || ${log.join(",")} | ${dumpBuddy(buddy)}`);
      } else if (what === "vrestdump") {
        out.push(
          `run vrestdump || ${log.join(",")} | n=${dumpCollisions(ent!, "vrests")} b=${dumpCollisions(
            ent!,
            "blockers",
          )} s=${dumpCollisions(ent!, "superpunchs")}`,
        );
      } else if (what === "flag") {
        const which = t[i++]!;
        const other = which === "buddy" ? (buddy as Entity) : (ent as Entity);
        out.push(
          `run flag ${which} || ${log.join(",")} | v=${r(ent!.get_flag(other))} t=${r(
            ent!.team,
          )} ot=${r(other.team)} ty=${r(ent!.type)} h=${r(ent!.hp)}`,
        );
      } else if (what === "cleanhold" || what === "cleancatch") {
        if (what === "cleanhold") ent!.clean_holding();
        else ent!.clean_catching();
        out.push(`run ${what} || ${log.join(",")} | ${relProbe()}`);
      } else if (what === "dropcatch") {
        const dropped = ent!.drop_catching();
        out.push(
          `run dropcatch || ${log.join(",")} | v=${r(dropped)} ${relProbe()} f=${fid(ent!.frame)}`,
        );
      } else if (what === "blinkgone" || what === "blinkrespawn") {
        const d = parseValue(t, [i]);
        if (what === "blinkgone") ent!.blink_and_gone(Number(d));
        else ent!.blink_and_respawn(Number(d));
        out.push(
          `run ${what} ${r(d)} || ${log.join(",")} | bl=${r(ent!.blinking)} ab=${r(
            (ent as unknown as { _after_blink: unknown })._after_blink,
          )}`,
        );
      } else if (what === "itrground") {
        const itrs = parseValue(t, [i]);
        ent!.update_itr_bdy_hit_ground(itrs as never);
        out.push(
          `run itrground ${r(itrs)} || ${log.join(",")} | p=${r(ent!.position)} g=${r(
            ent!.ground_y,
          )} f=${fid(ent!.frame)} w=${r(ent!.wait)}`,
        );
      } else if (what === "restrict") {
        const sub = t[i++]!;
        if (sub === "none") restrictResult = undefined;
        else {
          i--;
          restrictResult = parseValue(t, [i]);
        }
        out.push(`run restrict ${sub} || ${log.join(",")} | v=${r(restrictResult)}`);
      } else if (what === "mtseed") {
        const seed = Number(parseValue(t, [i]));
        lfwStub.mt = new MersenneTwister(seed);
        out.push(
          `run mtseed ${r(seed)} || ${log.join(",")} | times=${r(lfwStub.mt.times)}`,
        );
      } else if (what === "mtdebug") {
        const v = parseValue(t, [i]);
        lfwStub.mt.debugging = Boolean(v);
        out.push(`run mtdebug ${r(v)} || ${log.join(",")} | mark=${r(lfwStub.mt.mark)}`);
      } else if (what === "mtmark") {
        out.push(`run mtmark || ${log.join(",")} | mark=${r(lfwStub.mt.mark)}`);
      } else if (what === "mtcases") {
        const text = mt_cases.submit();
        out.push(
          `run mtcases || ${log.join(",")} | text=${r(text)} n=${r(mt_cases.cases.length)}`,
        );
      } else if (what === "spawn" || what === "spawnv") {
        const idx = [i];
        const opoint = parseValue(t, idx);
        applyGens(opoint);
        let made: Entity | undefined;
        if (what === "spawnv") {
          const ox = Number(parseValue(t, idx));
          const oy = Number(parseValue(t, idx));
          const oz = Number(parseValue(t, idx));
          const facing = Number(parseValue(t, idx));
          made = ent!.spawn(
            opoint as never,
            Ditto.vec3(ox, oy, oz) as never,
            facing as never,
          );
        } else {
          made = ent!.spawn(opoint as never);
        }
        spawned = made;
        out.push(
          `run ${what} || ${log.join(",")} | ${spawnDump(made)} | copies=${r([...ent!.copies])}`,
        );
      } else if (what === "spawndump") {
        out.push(`run spawndump || ${log.join(",")} | ${spawnDump(spawned)}`);
      } else if (what === "attach") {
        const ghost = parseValue(t, [i]);
        ent!.attach(ghost as never);
        out.push(`run attach ${r(ghost)} || ${log.join(",")} | ${spawnDump(ent)}`);
      } else if (what === "setpos") {
        const idx = [i];
        const x = parseValue(t, idx);
        const y = parseValue(t, idx);
        const z = parseValue(t, idx);
        ent!.set_position(x as never, y as never, z as never);
        out.push(
          `run setpos ${r(x)} ${r(y)} ${r(z)} || ${log.join(",")} | p=${r(ent!.position)} pv=${r(
            ent!.prev_position,
          )} g=${r(ent!.ground_y)}`,
        );
      } else if (what === "terrain") {
        const seg = parseValue(t, [i]);
        ent!.terrain = seg as never;
        out.push(`run terrain ${r(seg)} || ${log.join(",")} | g=${r(ent!.ground_y)}`);
      } else if (what === "updatepos") {
        ent!.update_position();
        out.push(
          `run updatepos || ${log.join(",")} | p=${r(ent!.position)} pv=${r(ent!.prev_velocity)} v=${r(
            ent!.velocity,
          )}`,
        );
      } else if (what === "update") {
        ent!.update();
        out.push(`run update || ${log.join(",")} | ${dumpTick(ent!)}`);
      } else if (what === "updateg") {
        ent!.update_ghost();
        out.push(`run updateg || ${log.join(",")} | ${dumpTick(ent!)}`);
      } else if (what === "seedop") {
        // 直接塞 `_opoints`（9i 的 `set_frame` 区间过滤场景用），不走 `apply_opoints`。
        const list = parseValue(t, [i]);
        const pairs = Array.isArray(list) ? list.map((o) => [o, 0]) : [];
        (ent as unknown as { _opoints: unknown })._opoints = pairs;
        out.push(`run seedop ${r(list)} || ${log.join(",")} | n=${pairs.length} itv=${dumpOpoints(ent!)}`);
      } else if (what === "opoints") {
        // `this.apply_opoints(list)`：记账 + multi 计数 + spreading + 逐个 spawn。
        const list = parseValue(t, [i]);
        // 打印用的是**原始**字面量（`env gen` 会往对象上挂生成器，挂完再渲染就多出字段）。
        const listText = r(list);
        // `__gen_*` 是端口侧的宿主缝（常驻 `g_gen`）⇒ TS 侧要逐个 opoint 挂一次生成器，
        // 否则 `spawn` / `apply_opoints` 读不到（`run spawn` 分支就是这么做的）。
        if (Array.isArray(list)) for (const o of list) applyGens(o);
        spawned = undefined;
        ent!.apply_opoints(list as never);
        out.push(
          `run opoints ${listText} || ${log.join(",")} | n=${
            (ent as unknown as { _opoints: unknown[] })._opoints.length
          } itv=${dumpOpoints(ent!)} | ${spawnDump(spawned)}`,
        );
      } else if (what === "enter" || what === "enternext" || what === "enterid") {
        const idx = [i];
        let arg: unknown;
        let argText: string;
        let fallback = false;
        if (what === "enter" || what === "enterid") {
          arg = parseValue(t, idx);
          argText = r(arg);
          i = idx[0]!;
        } else {
          arg = (ent!.frame as { next?: unknown }).next;
          argText = r(arg);
        }
        if (t[i] === "b") {
          const flagIdx = [i];
          fallback = !!parseValue(t, flagIdx);
          i = flagIdx[0]!;
          if (fallback) argText += " b1";
        }
        const result =
          what === "enternext"
            ? ent!.enter_frame(arg as never, fallback)
            : what === "enterid"
              ? ent!.enter_frame_by_id(arg as never, fallback)
              : ent!.enter_frame(arg as never, fallback);
        out.push(
          `run ${what} ${argText} || ${log.join(",")} | r=${ENTER_FRAME_RESULT[result]} f=${fid(
            ent!.frame,
          )} w=${r(ent!.wait)} fa=${r(ent!.facing)} bl=${r(ent!.blinking)} pf=${prevId(
            ent!,
          )} ar=${r(ent!.arest)} mt=${r((ent as unknown as { _motionless_ticks: number })._motionless_ticks)}`,
        );
      } else if (what === "followbearer" || what === "followcatcher") {
        if (what === "followbearer") ent!.follow_bearer();
        else ent!.follow_catcher();
        out.push(
          `run ${what} || ${log.join(",")} | p=${r(ent!.position)} pv=${r(
            ent!.prev_position,
          )} v=${r(ent!.velocity)} fa=${r(ent!.facing)} team=${r(ent!.team)} f=${fid(
            ent!.frame,
          )} dr=${r((ent as unknown as { dropping: unknown }).dropping)}`,
        );
      } else if (what === "drop") {
        ent!.drop_holding();
        const b = buddy as unknown as
          | {
              position: unknown;
              team: unknown;
              dropping: unknown;
              bearer: unknown;
              holding: unknown;
              vrests: Map<string, unknown>;
              frame: unknown;
              prev_position: unknown;
            }
          | undefined;
        const held = b
          ? `${r(b.position)} ${r(b.team)} ${r(b.dropping)} ${r(b.bearer != null)} ${r(
              b.holding != null,
            )} ${r(b.vrests.size)} bf=${fid(b.frame)} bpv=${r(b.prev_position)}`
          : "z";
        out.push(`run drop || ${log.join(",")} | ${relProbe()} held=[${held}]`);
      } else if (what === "pick") {
        if (buddy) ent!.pick(buddy);
        out.push(
          `run pick || ${log.join(",")} | ${relProbe()} vrests=${(buddy as unknown as { vrests: Map<string, unknown> } | undefined)?.vrests.size ?? 0} bdr=${r((buddy as unknown as { dropping: unknown } | undefined)?.dropping)} bf=${buddy ? fid(buddy.frame) : "z"}`,
        );
      } else if (what === "copyself") {
        const set = (ent as unknown as { copies: Set<string> }).copies;
        const added = !set.has(ent!.id);
        set.add(ent!.id);
        out.push(`run copyself || ${log.join(",")} | added=${r(added)}`);
      } else if (what === "frameb") {
        const v = parseValue(t, [i]);
        if (buddy) (buddy as unknown as { frame: unknown }).frame = v;
        out.push(`run frameb ${r(v)} || ${log.join(",")}`);
      } else if (what === "transform" || what === "transnext") {
        let head = "run " + what;
        let ok = false;
        if (what === "transform") {
          const data = parseValue(t, [i]);
          head += " " + r(data);
          ent!.transform(data as never);
        } else {
          ok = ent!.transfrom_to_another();
        }
        out.push(
          `${head} || ${log.join(",")} | v=${r(ok)} idx=${r(ent!.transform_index)} data=${r(
            ent!.data.id,
          )} tr=${r(ent!.transforms)} cp=${r([...((ent as unknown as { copies: Set<string> }).copies ?? [])])}`,
        );
      } else if (what === "statesdump") {
        out.push(`run statesdump || ${log.join(",")} | v=${dumpStates()}`);
      } else {
        process.stderr.write(`unknown run '${what}'\n`);
        process.exit(2);
      }
      continue;
    }
    process.stderr.write(`unknown op '${op}'\n`);
    process.exit(2);
  }

  process.stdout.write(out.join("\n") + "\n");
}

main();
