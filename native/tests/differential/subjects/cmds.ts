// `cmds/` 家族（4X/4Y）的 TS 侧台面。C++ 侧是 `subjects/cmds.cpp`，op 与输出一一对应。
// 用例：`cases/cmds/*.txt`，op 说明见 C++ 侧头注。
//
// 台面私货：两侧同样注册一条 `__probe__` 命令（`CMDS.register`），把 `ctx.words` /
// `positionals` / `str` / `num` / `nums` / `*_arg` 的结果打出来 —— 解析层全靠它做差分。
import { CMDS } from "../../../../src/LFW/cmds";
import { Ditto } from "../../../../src/LFW/ditto/Instance";
import { Entity } from "../../../../src/LFW/entity/Entity";
import { is_fighter, is_weapon } from "../../../../src/LFW/entity";
import { LocalController } from "../../../../src/LFW/controller/LocalController";
import { PlayerInfo } from "../../../../src/LFW/PlayerInfo";
import { States } from "../../../../src/LFW/state/States";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";
import { UILayers } from "../../../../src/LFW/ui/UILayer";
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

type Bag = Record<string, any>;

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

// `Ditto.WorldRender`：构造里只是 `new` 一下，随后就被换掉 ⇒ 什么都不做（不记日志）。
class FakeWorldRender {
  constructor(_world: unknown) {}
  add_entity(): void {}
  del_entity(): void {}
  render(): void {}
  dispose(): void {}
}

const renderer = {
  add_entity: (e: Entity) => log.push(`h:radd=${e.id}`),
  del_entity: (e: Entity) => log.push(`h:rdel=${e.id}`),
  render: (dt: number) => log.push(`h:render=${num(dt)}`),
  dispose: () => log.push(`h:rdispose`),
};

const mt = new MersenneTwister(0);
let id_counter = 0;
let team_counter = 0;
const bg_datas: unknown[] = [];
const stage_datas: unknown[] = [];
const all_datas: unknown[] = [];
const fighter_datas: unknown[] = [];
const weapon_datas: unknown[] = [];
const player_map = new Map<string, PlayerInfo>();
const cheats = new Set<string>();
let cmds: string[] = [];

const fakeLfw: Bag = {
  // `Stage` 里有几处读 `this.lfw.world.*`（`dispose` 的玩家队伍表）⇒ 假件把世界接回来。
  get world(): unknown {
    return world;
  },
  mt,
  get new_id(): string {
    id_counter += 1;
    log.push(`h:newid=${id_counter}`);
    return "e" + id_counter;
  },
  get new_team(): string {
    team_counter += 1;
    return "t" + team_counter;
  },
  players: {
    get: (pid: unknown) => {
      log.push(`h:player=${vstr(pid)}`);
      return player_map.get(String(pid)) ?? null;
    },
    has: () => false,
  },
  datas: {
    backgrounds: {
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
      for (const d of all_datas) if ((d as Bag).id === oid) return d;
      return undefined;
    },
    fighters: {
      find: (predicate: (v: unknown) => boolean) => {
        for (const d of fighter_datas) {
          if (predicate(d)) {
            log.push(`h:fdatafind=${vstr((d as Bag).id)}`);
            return d;
          }
        }
        log.push(`h:fdatafind=u`);
        return undefined;
      },
    },
    get_weapons_of_group: (group: unknown) => {
      log.push(`h:wpgroup=${vstr(group)}`);
      return [...weapon_datas];
    },
    get_random_bg: (groups: unknown[]) => {
      log.push(`h:randbg=${groups.map(vstr).join(",")}`);
      return undefined;
    },
  },
  factory: {
    create_entity: (w: unknown, data: unknown) => {
      const e = new_fake_entity(w as World, data);
      log.push(`h:create=${e.id}`);
      return e;
    },
    create_entity_with_player: (pid: unknown, w: unknown, data: unknown) => {
      log.push(`h:ceplayer=${vstr(pid)}`);
      return new_fake_entity(w as World, data);
    },
    create_entity_with_bot: (pid: unknown, w: unknown, data: unknown) => {
      log.push(`h:cebot=${vstr(pid)}`);
      return new_fake_entity(w as World, data);
    },
    recycle_entity: (e: Entity) => log.push(`h:recycle=${e.id}`),
    recycle_buff: () => log.push(`h:recyclebuff`),
    acquire_ctrl: (Cls: unknown, pid: unknown, _entity: unknown) => {
      if (Cls === LocalController) {
        log.push(`h:acqlocal=${vstr(pid)}`);
        return { __is_human_ctrl__: true, player_id: pid };
      }
      log.push(`h:acquire`);
      return {
        __is_base_ctrl__: true,
        player_id: "",
        player: { id: 7, name: "P7", mine: true },
      };
    },
    release_ctrl: () => log.push(`h:release`),
    create_ctrl: (id: unknown, pid: unknown) =>
      log.push(`h:createctrl=${vstr(id)}:${vstr(pid)}`),
  },
  entities: {
    add: (data: unknown, n: unknown) =>
      log.push(`h:entadd=${vstr((data as Bag).id)}|${num(n)}`),
  },
  random_entity_info: (e: Entity) => log.push(`h:randominfo=${e.id}`),
  callbacks: {
    call: (_name: unknown, cmd: unknown, enabled: unknown) =>
      log.push(`h:cheatchanged=${vstr(cmd)}|${enabled ? 1 : 0}`),
  },
  get cmds(): string[] {
    return cmds;
  },
  set cmds(v: string[]) {
    cmds = v;
  },
  is_cheat: (name: unknown) => {
    log.push(`h:cheat=${vstr(name)}`);
    return cheats.has(String(name));
  },
  game_mode: undefined,
  survival_rank_available: false,
  broadcasts: [] as unknown[],
  broadcast: (m: unknown) => log.push(`h:broadcast=${vstr(m)}`),
  // `IWorldLfw::warn` / `IWorldLfw::debug` 的两面（`Ditto.warn` 单参 / `Ditto.debug`）。
  warn: (...args: unknown[]) => log.push(`h:warn=${esc(String(args[0]))}`),
  debug: (msg: unknown) => log.push(`h:debug=${String(msg)}`),
  // TS 的真 `LFW` 构造里就有 `layers`（`F4` / `KEY_EVENT` / `POINTER_*` 直接读）⇒ 假件也得有，
  // 否则命令会 `undefined.at(...)` 抛。这里给一份**空**的层栈（端口侧假 `lfw` 派生真 `LFW`，
  // 它有一层但页数 ≤ 1 ⇒ 两侧同样什么都不做）。
  layers: new UILayers(null as never),
  // 同理：`KEY_EVENT` 还会读 `lfw.world` 与 `lfw.mounted_keys`。`world` 用 getter（真 `World`
  // 晚于本字面量建）；`mounted_keys` 给空表（端口侧的假 `lfw` 没有挂载过按键）。
  get world(): World {
    return world;
  },
  mounted_keys: [] as unknown[],
  sounds: {
    play_bgm: (m: unknown) => {
      log.push(`h:playbgm=${vstr(m)}`);
      return () => log.push(`h:stopbgm`);
    },
    stop_bgm: () => log.push(`h:stopbgm_now`),
    play: (...args: unknown[]) => log.push(`h:sound=${args.map(vstr).join(",")}`),
    play_with_load: (p: unknown) => log.push(`h:loadplay=${vstr(p)}`),
  },
  end_testers: () => [],
  datas_randoming_by_group: () => undefined,
  create_entity_with_bot: () => undefined,
};

let states: States;
let world: World;

function w(): Bag {
  return world as unknown as Bag;
}

const ents = new Map<string, Entity>();

// 台面实体工厂：`add` op 与假 `factory.create_entity*` 共用。
function new_fake_entity(w: World, data: unknown): Entity {
  return new Entity(w as never, data as never, states as never);
}

function ent_of(label: string): Entity {
  const e = ents.get(label);
  if (!e) fail(`no such entity '${label}'`);
  return e!;
}

function dump_entity(e: Entity | null): string {
  if (!e) return "z";
  return (
    `${e.id}:${num(e.hp)}:${num(e.hp_r)}:${num(e.mp)}:${esc(e.team)}` +
      `:${flag(is_fighter(e))}:${flag(is_weapon(e))}:${flag(e.puppet)}` +
      `:fr=${vstr((e.frame as Bag).id)}` +
      `:pos=${num(e.position.x)},${num(e.position.y)},${num(e.position.z)}` +
      `:fc=${num(e.facing)}:nm=${vstr(e.name)}` +
      `:did=${vstr((e.data as Bag)?.id)}`
  );
}

function dump_list(list: (Entity | null)[]): string {
  const parts: string[] = [];
  for (const e of list) if (e) parts.push(dump_entity(e));
  return parts.join(";") || "-";
}

function vec2_or_z(v: Bag | null | undefined): string {
  return v ? `${num(v.x)},${num(v.y)}` : "z";
}

function dump(): void {
  const b = w();
  const cam = world.camera as unknown as Bag;
  const counts = b._counts as Map<string, number>;
  const pup = world.puppets as Map<string, Entity>;
  log.push(
    `dump|paused=${num(b._paused)}|fn=${num(b._fn_locked)}` +
      `|diff=${vstr(world.dataset.difficulty)}|playrate=${vstr(world.dataset.playrate)}` +
      `|inf=${vstr(world.dataset.infinity_mp)}` +
      `|cam=${num(cam.position.x)},${num(cam.position.y)}` +
      `|lock=${vec2_or_z(cam.locked)}|dest=${vec2_or_z(cam.dested)}` +
      `|lim=${flag(world.stage_limit)}|st=${vstr(world.stage?.id)}|bg=${vstr(world.bg?.id)}` +
      `|cnt=${[...counts.entries()].map(([k, v]) => `${esc(k)}:${num(v)}`).join(",") || "-"}` +
      `|pup=${[...pup.entries()].map(([k, v]) => `${k}:${v?.id ?? "z"}`).join(",") || "-"}` +
      `|ents=${dump_list(world.entities)}|ghosts=${dump_list(world.ghosts)}` +
      `|cmds=${cmds.length}`,
  );
}

// 解析层探针（两侧同名同输出）。
  const probeNames = ["--a", "--a=", "x", "--", "-", "--eq", "=y"];
  CMDS.register("__PROBE__", "", (ctx) => {
  log.push(`p|${esc(ctx.cmd)}`);
  for (let i = 0; i < ctx.words.length; i++) log.push(`pw|${i}|${esc(ctx.words[i]!)}`);
  for (let i = 0; i < ctx.positionals.length; i++) {
    log.push(`pp|${i}|${esc(ctx.positionals[i]!)}`);
  }
  for (let i = 0; i < 6; i++) {
    const s = ctx.str(i);
    log.push(`ps|${i}|${s === undefined ? "u" : esc(s)}`);
    const d = ctx.num(i);
    log.push(`pn|${i}|${d === undefined ? "u" : vstr(d)}`);
    const ns = ctx.nums(i);
    log.push(`pns|${i}|${ns === undefined ? "u" : vstr(ns)}`);
  }
  for (const name of probeNames) {
    const s = ctx.str_arg(name);
    const d = ctx.num_arg(name);
    const ns = ctx.nums_arg(name);
    log.push(
      `pa|${esc(name)}|${s === undefined ? "u" : esc(s)}` +
        `|${d === undefined ? "u" : vstr(d)}|${ns === undefined ? "u" : vstr(ns)}`,
    );
  }
});

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) fail("usage: lfw_trace_cmds.mjs <case-file>");

  Ditto.setup({
    Vector2: FakeVector2,
    Vector3: FakeVector3,
    WorldRender: FakeWorldRender,
    warn: (...args: unknown[]) => {
      if (args.length > 1) log.push(`warn:${String(args[0])}:${String(args[1])}`);
      else log.push(`h:warn=${esc(String(args[0]))}`);
    },
    debug: (msg: unknown) => log.push(`h:debug=${String(msg)}`),
    DEV: false,
    Cache: {
      get: () => new Promise(() => {}),
      del: () => new Promise(() => {}),
      put: () => new Promise(() => {}),
      list: () => new Promise(() => {}),
    },
  } as never);

  states = new States();

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;
    const i = [1];
    const next = (): string => t[i[0]!++]!;

    if (op === "wnew") {
      world = new World(fakeLfw as never);
      (world as unknown as Bag).renderer = renderer;
      log.push(`new|bg=${vstr(world.bg?.id)}|st=${vstr(world.stage?.id)}`);
    } else if (op === "hdump") {
      dump();
    } else if (op === "ds") {
      const key = keyOf(next());
      (world.dataset as Bag)[key] = parseValue(t, i);
    } else if (op === "bdata") {
      bg_datas.push(parseValue(t, i));
    } else if (op === "sdata") {
      stage_datas.push(parseValue(t, i));
    } else if (op === "data") {
      all_datas.push(parseValue(t, i));
    } else if (op === "fdata") {
      fighter_datas.push(parseValue(t, i));
    } else if (op === "wdata") {
      weapon_datas.push(parseValue(t, i));
    } else if (op === "player") {
      const pid = keyOf(next());
      const pname = keyOf(next());
      player_map.set(pid, new PlayerInfo(pid, pname));
    } else if (op === "bg") {
      world.change_bg(parseValue(t, i) as never);
    } else if (op === "stage") {
      world.change_stage(parseValue(t, i) as never);
    } else if (op === "cheat") {
      const name = keyOf(next());
      const on = next();
      if (on === "1") cheats.add(name);
      else cheats.delete(name);
    } else if (op === "mk" || op === "add") {
      const label = next();
      const e = new Entity(world as never, parseValue(t, i) as never, states as never);
      ents.set(label, e);
      if (op === "add") world.add_entities(e);
      log.push(`${op}|${label}|id=${e.id}`);
    } else if (op === "ent") {
      const e = ent_of(next());
      const field = next();
      if (field === "hp") e.hp = Number(parseValue(t, i));
      else if (field === "hpr") e.hp_r = Number(parseValue(t, i));
      else if (field === "mp") e.mp = Number(parseValue(t, i));
      else if (field === "team") e.team = keyOf(next());
      else fail(`unknown entity field '${field}'`);
      log.push(`ent|${e.id}|${field}`);
    } else if (op === "pup") {
      const pid = keyOf(next());
      const e = ent_of(next());
      (world.puppets as Map<string, Entity>).set(pid, e);
      log.push(`pup|${pid}|${e.id}`);
    } else if (op === "ctrl") {
      const e = ent_of(next());
      const kind = next();
      const pid = keyOf(next());
      e.ctrl = {
        __is_base_ctrl__: true,
        __is_human_ctrl__: kind === "human",
        player_id: pid,
        player: { id: 7, name: "P7", mine: true },
      } as never;
    } else if (op === "cmd") {
      const text = parseValue(t, i) as string;
      CMDS.handle(world, [String(text)]);
    } else if (op === "wcmds") {
      const list: string[] = [];
      while (i[0]! < t.length) list.push(String(parseValue(t, i)));
      cmds = list;
      log.push(`wcmds|${cmds.length}`);
    } else if (op === "handlecmds") {
      (w().handle_cmds as () => void).call(world);
    } else if (op === "h") {
      const key = String(parseValue(t, i));
      log.push(`h|${esc(key)}|${flag(CMDS.handler(key) != null)}`);
    } else {
      fail(`unknown op '${op}'`);
    }
  }

  process.stdout.write(log.join("\n") + (log.length ? "\n" : ""));
}

main();
