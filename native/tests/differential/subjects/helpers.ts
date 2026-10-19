// `helper/` 家族 + `Keys` + `JoinQueue` 的 TS 侧台面，op 与 `subjects/helpers.cpp` 一一对应。
//
// `lfw` 是脚本化假件（helper 家族 / `Keys` 要的那一面），实体也是假件（带 `data` / `id` /
// `team` / `ctrl` / `attach()`）；C++ 侧用真 `Entity` + 假 `IEntityHost`（`attach` 的观测量
// 从宿主的 `add_entities` 出）。两边日志逐字节对齐。
//
// op 一览见 `subjects/helpers.cpp` 头部。
import { BallsHelper } from "../../../../src/LFW/helper/BallsHelper";
import { CharactersHelper } from "../../../../src/LFW/helper/CharactersHelper";
import { ObjectsHelper } from "../../../../src/LFW/helper/EntitiesHelper";
import { JoinQueue, pick_join_team } from "../../../../src/LFW/helper/JoinQueue";
import { UIHelper } from "../../../../src/LFW/helper/UIHelper";
import { WeaponsHelper } from "../../../../src/LFW/helper/WeaponsHelper";
import { Keys } from "../../../../src/LFW/Keys";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";
import { eval_number } from "../../../../src/LFW/utils/eval_number";

import { keyOf, parseValue, readCaseLines, splitWs } from "./trace_util";

type Rec = Record<string, any>;

const log: string[] = [];
// `eval_number` 的具名量上下文（`evctx` op 填，跨行保留）。
const ev_ctx: Record<string, number> = {};
function push(s: string): void {
  log.push(s);
}
function fail(msg: string): never {
  process.stderr.write(msg + "\n");
  process.exit(2);
}

const mt = new MersenneTwister(12345);

const world_ents: Rec[] = [];
const world_ghosts: Rec[] = [];
const fdatas: Rec[] = [];
const wdatas: Rec[] = [];

let id_counter = 0;
let team_counter = 8;
let cfail_left = 0;

function fmt_team(v: unknown): string {
  return typeof v === "string" && v.length ? v : "u";
}
function fmt_id(v: unknown): string {
  return typeof v === "string" && v.length ? v : "u";
}

function fake_entity(data: Rec): Rec {
  const e: Rec = {
    data,
    id: `e${++id_counter}`,
    team: undefined,
    ctrl: null,
    attach() {
      push(`attach|${fmt_id(e.id)}|${fmt_team(e.team)}`);
      world_ents.push(e);
    },
  };
  push(`create|${String(data?.["id"] ?? "u")}`);
  return e;
}

function type_num(t: string): number {
  if (t === "Fighter") return 8;
  if (t === "Weapon") return 16;
  if (t === "Ball") return 32;
  return Number(t);
}

function mk_entity(id: string, type: string, target: string): void {
  ++id_counter;
  const e: Rec = {
    data: { type: type_num(type), id },
    id,
    team: undefined,
    ctrl: null,
    attach() {
      push(`attach|${fmt_id(e.id)}|${fmt_team(e.team)}`);
      world_ents.push(e);
    },
  };
  if (target === "g") world_ghosts.push(e);
  else world_ents.push(e);
}

const fake_lfw = {
  mt,
  world: {
    entities: world_ents,
    ghosts: world_ghosts,
    del_entities(list: Rec[]) {
      push(`del:${list.map((v) => fmt_id(v.id)).join(",")}`);
      for (const v of list) {
        const i = world_ents.indexOf(v);
        if (i >= 0) world_ents.splice(i, 1);
        const j = world_ghosts.indexOf(v);
        if (j >= 0) world_ghosts.splice(j, 1);
      }
    },
    get lifetime() {
      push("lifetime");
      return 33;
    },
  },
  datas: {
    fighters: fdatas,
    weapons: wdatas,
    find_fighter: (id: string) => fdatas.find((v) => v.id === id),
    find_weapon: (id: string) => wdatas.find((v) => v.id === id),
  },
  factory: {
    create_entity(_w: unknown, data: Rec) {
      if (cfail_left > 0) {
        --cfail_left;
        push("create|fail");
        return undefined;
      }
      return fake_entity(data);
    },
    create_ctrl(oid: unknown, pid: string, _e: unknown) {
      push(`ctrl|${String(oid ?? "u")}|${pid}`);
      return null;
    },
  },
  get new_team() {
    return `team_${++team_counter}`;
  },
  random_entity_info(e: Rec) {
    push(`randominfo|${fmt_id(e.id)}|${fmt_team(e.team)}`);
  },
  regist_keys(_k: unknown) {
    push("regist");
  },
  recycle_keys(_k: unknown) {
    push("recycle");
  },
  layers: {
    push_page(page: Rec, stack_idx: number) {
      push(`push|${fmt_id(page.id)}|${stack_idx}`);
    },
    set_page(page: Rec, stack_idx: number) {
      push(`set|${fmt_id(page.id)}|${stack_idx}`);
    },
  },
};

let ob: ObjectsHelper;
let ba: BallsHelper;
let ch: CharactersHelper;
let we: WeaponsHelper;
let ui: UIHelper;
let keys: Keys;
const jqs: JoinQueue[] = [];

function join_or_u(v: unknown): string {
  return v === undefined || v === null ? "u" : String(v);
}

function all_ids(list: Rec[]): string {
  return list.map((v) => fmt_id(v?.id)).join(",");
}

function install(): void {
  const lfw = fake_lfw as never;
  ob = new ObjectsHelper(lfw);
  ba = new BallsHelper(lfw);
  ch = new CharactersHelper(lfw);
  we = new WeaponsHelper(lfw);
  ui = new UIHelper(lfw);
  keys = new Keys(lfw);
  (fake_lfw as Rec)["entities"] = ob;
}

function team_token(t: string): string | undefined {
  if (t === "-") return undefined;
  if (t === "q") return "?";
  if (t === "empty") return "";
  return t;
}

function dump_created(list: Rec[]): string {
  return list.map((v) => `${fmt_id(v.id)}:${fmt_team(v.team)}`).join(",");
}

function csv_pairs(s: string): [string, number][] {
  const out: [string, number][] = [];
  for (const part of s.split(",")) {
    const [k, v] = part.split(":");
    out.push([k!, Number(v)]);
  }
  return out;
}

function main(): void {
  install();

  for (const line of readCaseLines(process.argv[2]!)) {
    const t = splitWs(line);
    if (t.length === 0) continue;
    const op = t[0]!;
    const i = [1];
    const next = (): string => t[i[0]!++]!;
    const nextKey = (): string => keyOf(next());

    if (op === "mk") {
      const id = nextKey();
      const type = nextKey();
      const target = t[i[0]!++]!;
      mk_entity(id, type, target);
    } else if (op === "fdata") {
      const id = nextKey();
      fdatas.push({ type: 8, id });
    } else if (op === "wdata") {
      const id = nextKey();
      const groups = nextKey();
      wdatas.push({
        type: 16,
        id,
        base: { group: groups === "-" ? undefined : groups.split("|") },
      });
    } else if (op === "dumpents") {
      push(`ents:${all_ids(world_ents)}|ghosts:${all_ids(world_ghosts)}`);
    } else if (op === "ob.all") {
      push(`ob.all:${all_ids(ob.all)}`);
    } else if (op === "ba.all") {
      push(`ba.all:${all_ids(ba.all)}`);
    } else if (op === "ch.all") {
      push(`ch.all:${all_ids(ch.all)}`);
    } else if (op === "we.all") {
      push(`we.all:${all_ids(we.all)}`);
    } else if (op === "ob.at") {
      push(`ob.at:${fmt_id(ob.at(Number(nextKey()))?.id)}`);
    } else if (op === "ob.a") {
      push(`ob.a:${fmt_id(ob.a?.id)}`);
    } else if (op === "ob.b") {
      push(`ob.b:${fmt_id(ob.b?.id)}`);
    } else if (op === "ob.add") {
      const n = Number(nextKey());
      const team = team_token(t[i[0]!++]!);
      const type = nextKey();
      const id = nextKey();
      const ret = ob.add({ type: type_num(type), id }, n, team);
      push(`ob.add:${dump_created(ret as Rec[])}`);
    } else if (op === "ch.add") {
      const n = Number(nextKey());
      const team = team_token(t[i[0]!++]!);
      const id = nextKey();
      const ret = ch.add(id, n, team);
      push(`ch.add:${dump_created(ret as Rec[])}`);
    } else if (op === "ch.addr") {
      const n = Number(nextKey());
      const team = team_token(t[i[0]!++]!);
      const f = t[i[0]!++]!;
      const ret = ch.add_random(n, team, f === "-" ? undefined : (v: Rec) => v.id === f);
      push(`ch.addr:${dump_created(ret as Rec[])}`);
    } else if (op === "we.add") {
      const n = Number(nextKey());
      const team = team_token(t[i[0]!++]!);
      const id = nextKey();
      const ret = we.add(id, n, team);
      push(`we.add:${dump_created(ret as Rec[])}`);
    } else if (op === "we.rand") {
      const groups = nextKey();
      const dup = t[i[0]!++]! === "d";
      const r1 = we.randoms(groups, dup);
      const r2 = we.randoms(groups, dup);
      if (r1 === undefined || r1 === null) {
        push("we.rand:u");
      } else {
        const src = (r1 as unknown as Rec)["src"] as Rec[];
        push(
          `we.rand|${String((r1 as unknown as Rec)["name"])}|${all_ids(src)}|${r1 === r2 ? 1 : 0}`,
        );
      }
    } else if (op === "we.addr") {
      const n = Number(nextKey());
      const dup = t[i[0]!++]! === "d";
      const groups = nextKey();
      const ret = we.add_random(n, dup, groups);
      push(`we.addr:${dump_created(ret as Rec[])}`);
    } else if (op === "ob.delall") {
      ob.del_all();
      push(`after.del:${all_ids(world_ents)}|${all_ids(world_ghosts)}`);
    } else if (op === "cfail") {
      cfail_left = Number(nextKey());
    } else if (op === "ob.tr") {
      const r = ob.team_randoming as unknown as Rec;
      push(
        `ob.tr|${String(r["name"])}|${(r["_src"] as unknown[]).map((v) => String(v)).join(",")}|${String(r.get())}`,
      );
    } else if (op === "keys.mount") {
      keys.mount();
    } else if (op === "keys.unmount") {
      keys.unmount();
    } else if (op === "keys.time") {
      push(`keys.time:${keys.time}`);
    } else if (op === "keys.get") {
      const k = nextKey();
      const st = (keys as unknown as Rec)[k] as Rec | undefined;
      push(`keys.get:${st === undefined ? "u" : String(st["key"])}`);
    } else if (op === "keys.list") {
      push(`keys.list:${Object.keys(keys).filter((k) => k.length === 1).join(",")}`);
    } else if (op === "keys.hit") {
      const k = nextKey();
      const tv = t[i[0]!++]!;
      const st = (keys as unknown as Rec)[k] as Rec;
      if (tv === "-") st.hit();
      else st.hit(Number(tv));
    } else if (op === "keys.end") {
      const st = (keys as unknown as Rec)[nextKey()] as Rec;
      st.end();
    } else if (op === "keys.isstart") {
      const st = (keys as unknown as Rec)[nextKey()] as Rec;
      push(`keys.isstart:${st.is_start() ? 1 : 0}`);
    } else if (op === "keys.isend") {
      const st = (keys as unknown as Rec)[nextKey()] as Rec;
      push(`keys.isend:${st.is_end() ? 1 : 0}`);
    } else if (op === "keys.use") {
      const st = (keys as unknown as Rec)[nextKey()] as Rec;
      push(`keys.use:${st.use()}`);
    } else if (op === "keys.reset") {
      const st = (keys as unknown as Rec)[nextKey()] as Rec;
      st.reset();
    } else if (op === "keys.ts") {
      const st = (keys as unknown as Rec)[nextKey()] as Rec;
      push(`keys.ts:${st.time}|${st.u_time}|${st.used}`);
    } else if (op === "ui.add") {
      const items: Rec[] = [];
      while (i[0]! < t.length) items.push({ id: keyOf(t[i[0]!++]!) });
      ui.add(...(items as never[]));
      push(`ui.all:${(ui.all as unknown as Rec[]).map((v) => String(v.id)).join(",")}`);
    } else if (op === "ui.clear") {
      ui.clear();
      push("ui.all:");
    } else if (op === "ui.all") {
      push(`ui.all:${(ui.all as unknown as Rec[]).map((v) => String(v.id)).join(",")}`);
    } else if (op === "ui.push") {
      const id = nextKey();
      const idx = Number(nextKey());
      (ui as unknown as Rec)["push_" + id](idx);
    } else if (op === "ui.set") {
      const id = nextKey();
      const idx = Number(nextKey());
      (ui as unknown as Rec)["switch_" + id](idx);
    } else if (op === "jq.new") {
      jqs.push(new JoinQueue(Number(nextKey())));
      push(`jq.new:${jqs.length - 1}`);
    } else if (op === "jq.enq") {
      const q = jqs[Number(nextKey())]!;
      const uid = nextKey();
      const name = nextKey();
      const oid = nextKey();
      const ok = q.enqueue(oid === "-" ? { uid, name } : { uid, name, oid });
      push(`jq.enq:${ok ? 1 : 0}`);
    } else if (op === "jq.deq") {
      const q = jqs[Number(nextKey())]!;
      const e = q.dequeue();
      push(`jq.deq:${join_or_u(e?.uid)}|${join_or_u(e?.name)}|${join_or_u(e?.oid)}`);
    } else if (op === "jq.rm") {
      const q = jqs[Number(nextKey())]!;
      push(`jq.rm:${q.remove(nextKey()) ? 1 : 0}`);
    } else if (op === "jq.has") {
      const q = jqs[Number(nextKey())]!;
      push(`jq.has:${q.has(nextKey()) ? 1 : 0}`);
    } else if (op === "jq.size") {
      const q = jqs[Number(nextKey())]!;
      push(`jq.size:${q.size}`);
    } else if (op === "jq.all") {
      const q = jqs[Number(nextKey())]!;
      push(`jq.all:${q.all.map((v) => v.uid).join(",")}`);
    } else if (op === "jq.clear") {
      const q = jqs[Number(nextKey())]!;
      q.clear();
      push(`jq.size:${q.size}`);
    } else if (op === "pick") {
      const order = nextKey().split(",");
      const counts = csv_pairs(nextKey());
      const caps = csv_pairs(nextKey());
      const fallen = nextKey();
      const ret = pick_join_team(
        new Map(counts),
        new Map(caps),
        fallen === "-" ? undefined : fallen,
        order,
      );
      push(`pick:${ret === undefined ? "u" : ret}`);
    } else if (op === "evctx") {
      const name = nextKey();
      const v = Number(next());
      ev_ctx[name] = v;
      push(`evctx:${name}=${v}`);
    } else if (op === "evn") {
      const v = parseValue(t, i);
      try {
        push(`evn:${eval_number(v as never, ev_ctx)}`);
      } catch {
        push("evn:err");
      }
    } else {
      fail(`unknown op '${op}'`);
    }
  }

  process.stdout.write(log.join("\n") + "\n");
}

main();
