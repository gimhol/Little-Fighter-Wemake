// `bot/` 切片的差分台面（TS 侧，见 `bot.cpp` 顶部注释的约定）。
//
// 和端口不同，TS 的 `BotController` 直接拿 `Entity` 活读，所以场景对象 `me` 就是
// `this.entity`：状态字段直接挂在它上面；`myself` 一侧的两处「形状补齐」（`state`
// 与 `frame.state` 互写、`data.base.type` → 顶层 `base_type`）与 C++ 台面同名实现。

import { BotController } from "../../../../src/LFW/bot/BotController";
import { dummy_updaters } from "../../../../src/LFW/bot/DummyEnum";
import { Ditto } from "../../../../src/LFW/ditto";
import { Expression } from "../../../../src/LFW/base/Expression";
import { get_val_from_bot_ctrl } from "../../../../src/LFW/loader/get_val_from_bot_ctrl";
import { MersenneTwister } from "../../../../src/LFW/utils/math/MersenneTwister";
import { manhattan_xz } from "../../../../src/LFW/helper/manhattan_xz";
import { mt_cases } from "../../../../src/LFW/cases_instances";

import { parseJsStringLiteral, parseValue, readCaseLines, renderValue, splitWs } from "./trace_util";

const log: string[] = [];

function joinLog(): string {
  const s = log.join(",");
  log.length = 0;
  return s;
}

function num(v: number): string {
  return renderValue(v);
}

function makeVector(): Record<string, unknown> {
  return {
    x: 0,
    y: 0,
    z: 0,
    clone(this: { x: number; y: number; z: number }) {
      return { x: this.x, y: this.y, z: this.z };
    },
  };
}

const me: Record<string, any> = {};
me.data = { base: {} };
me.frame = { state: 0 };
me.blockers = new Set();
me.position = makeVector();
me.velocity = makeVector();
me.set_position = (x: number, y: number, z: number): void => {
  log.push(`set_position:${renderValue(x)},${renderValue(y)},${renderValue(z)}`);
};
me.get_next_frame = (nf: unknown): unknown => {
  log.push(`gnf:${String(nf)}`);
  return undefined;
};
me.is_ally = (o: any): boolean => me.team === o.team;

const fixtures = new Map<string, any>();
const datas = new Map<string, any>();
const pupNames: string[] = [];
const stage: Record<string, unknown> = {};
const dataset: Record<string, unknown> = { difficulty: 1 };
let bound: number[] = [];
let hpa = true;
let mt = new MersenneTwister(0);

Ditto.vec3 = ((x = 0, y = 0, z = 0) => ({ x, y, z })) as never;

function nameOf(v: unknown): string {
  if (v === undefined) return "u";
  if (v === null) return "z";
  for (const [n, o] of fixtures) if (o === v) return n;
  return "?";
}

function fxArg(name: string): any {
  if (!fixtures.has(name)) {
    process.stderr.write(`unknown fx '${name}'\n`);
    process.exit(2);
  }
  return fixtures.get(name);
}

function targetsText(nt: any): string {
  const parts: string[] = [];
  for (const t of nt.targets as any[]) {
    parts.push(`${nameOf(t)}:${renderValue(manhattan_xz(ctrl.entity as never, t))}`);
  }
  return "[" + parts.join(",") + "]";
}

function setsText(): string {
  return `ch=${targetsText(ctrl.chasings)} av=${targetsText(ctrl.avoidings)} def=${targetsText(ctrl.defends)}`;
}

function normRef(v: any): void {
  if (!v || typeof v !== "object") return;
  if (v.state !== undefined && !v.frame) v.frame = { state: v.state };
  else if (v.state !== undefined && v.frame && v.frame.state === undefined) v.frame.state = v.state;
  if (v.frame && v.frame.state !== undefined) v.state = v.frame.state;
  const bt = v.data?.base?.type;
  if (bt !== undefined && v.base_type === undefined) v.base_type = bt;
}

function setPath(root: any, segs: string[], at: number, v: unknown): void {
  if (at + 1 === segs.length) {
    root[segs[at]] = v;
    return;
  }
  const key = segs[at];
  if (root[key] === undefined || root[key] === null || typeof root[key] !== "object") {
    if (root === me && key === "position") root[key] = makeVector();
    else if (root === me && key === "velocity") root[key] = makeVector();
    else root[key] = {};
  }
  setPath(root[key], segs, at + 1, v);
}

const world = {
  dataset,
  get stage() {
    return stage;
  },
  get player_l() {
    return (stage as any).player_l;
  },
  get player_r() {
    return (stage as any).player_r;
  },
  get near() {
    return (stage as any).near;
  },
  get far() {
    return (stage as any).far;
  },
  get puppets() {
    const m = new Map<string, any>();
    for (const n of pupNames) {
      const f = fixtures.get(n);
      if (f) m.set(n, f);
    }
    return m;
  },
  get has_players_alive() {
    return hpa;
  },
  get_bound: () => bound,
  bg: { width: 0, near: 0, far: 0 },
};

const lfw = {
  players: new Map<string, any>(),
  get mt() {
    return mt;
  },
  datas: { find_bot: (id: string) => datas.get(id) },
};

me.world = world;
me.lfw = lfw;

let ctrl = new BotController("7", me as never);

function main(): void {
  const casePath = process.argv[2];
  if (!casePath) {
    process.stderr.write("usage: lfw_trace_bot.mjs <case-file>\n");
    process.exit(2);
  }

  const out: string[] = [];

  for (const raw of readCaseLines(casePath)) {
    const t = splitWs(raw);
    if (t.length === 0) continue;
    const op = t[0]!;
    const line = t.join(" ");
    const i: number[] = [1];

    if (op === "mtseed") {
      const seed = parseValue(t, i);
      mt = new MersenneTwister(Number(seed));
      out.push(`${line} ||  | times=${num(mt.times)}`);
    } else if (op === "mtdebug") {
      const v = parseValue(t, i);
      mt.debugging = !!v;
      out.push(`${line} ||  | mark=${renderValue(mt.mark)}`);
    } else if (op === "mtmark") {
      out.push(`${line} ||  | mark=${renderValue(mt.mark)}`);
    } else if (op === "mtcases") {
      const text = mt_cases.submit();
      out.push(`${line} ||  | text=${renderValue(text)} n=${num(mt_cases.cases.length)}`);
    } else if (op === "me") {
      const sub = t[i[0]++]!;
      const v = parseValue(t, i);
      setPath(me, sub.split("."), 0, v);
      normRef(me);
      out.push(`${line} ||  | v=${renderValue(v)}`);
    } else if (op === "meref") {
      const sub = t[i[0]++]!;
      const name = parseJsStringLiteral(t[i[0]++]!);
      setPath(me, sub.split("."), 0, fxArg(name));
      out.push(`${line} ||  | v=${nameOf(fxArg(name))}`);
    } else if (op === "fx") {
      const sub = t[i[0]++]!;
      const name = parseJsStringLiteral(t[i[0]++]!);
      if (sub === "put") {
        const v: any = parseValue(t, i);
        normRef(v);
        fixtures.set(name, v);
        out.push(`${line} ||  | v=${renderValue(v)}`);
      } else {
        fixtures.delete(name);
        out.push(`${line} ||  | v=u`);
      }
    } else if (op === "stage") {
      const key = parseJsStringLiteral(t[i[0]++]!);
      const v = parseValue(t, i);
      stage[key] = v;
      out.push(`${line} ||  | v=${renderValue(v)}`);
    } else if (op === "bg") {
      const key = parseJsStringLiteral(t[i[0]++]!);
      const v = parseValue(t, i);
      (world.bg as any)[key] = v;
      out.push(`${line} ||  | v=${renderValue(v)}`);
    } else if (op === "diff") {
      const v = parseValue(t, i);
      dataset.difficulty = v;
      out.push(`${line} ||  | v=${renderValue(v)}`);
    } else if (op === "bound") {
      bound = [];
      while (i[0] < t.length) bound.push(Number(parseValue(t, i)));
      out.push(`${line} ||  | v=[${bound.map(num).join(",")}]`);
    } else if (op === "hpa") {
      hpa = t[i[0]++] === "1";
      out.push(`${line} ||  | v=${renderValue(hpa)}`);
    } else if (op === "pup") {
      const sub = t[i[0]++]!;
      if (sub === "add") pupNames.push(parseJsStringLiteral(t[i[0]++]!));
      else pupNames.length = 0;
      out.push(`${line} ||  | v=[${pupNames.join(",")}]`);
    } else if (op === "datas") {
      const sub = t[i[0]++]!;
      const id = parseJsStringLiteral(t[i[0]++]!);
      if (sub === "put") {
        const v = parseValue(t, i);
        datas.set(id, v);
        out.push(`${line} ||  | v=${renderValue(v)}`);
      } else {
        datas.delete(id);
        out.push(`${line} ||  | v=u`);
      }
    } else if (op === "make") {
      ctrl = new BotController("7", me as never);
      out.push(
        `${line} ||  | state=${renderValue(ctrl.bot_state)} mark=${renderValue(mt.mark)} ` +
          `idle_x=${num(ctrl.idle_min_x)},${num(ctrl.idle_max_x)} idle_z=${num(ctrl.idle_min_z)},${num(ctrl.idle_max_z)}`,
      );
    } else if (op === "ntclear") {
      const which = t[i[0]++]!;
      const nt = which === "ch" ? ctrl.chasings : which === "av" ? ctrl.avoidings : ctrl.defends;
      nt.clear();
      out.push(`${line} ||  | ${setsText()}`);
    } else if (op === "ntlook") {
      const which = t[i[0]++]!;
      const nt = which === "ch" ? ctrl.chasings : which === "av" ? ctrl.avoidings : ctrl.defends;
      const name = parseJsStringLiteral(t[i[0]++]!);
      const other = fxArg(name);
      nt.look(me as never, other);
      out.push(`${line} ||  | ${setsText()}`);
    } else if (op === "ntdel") {
      const which = t[i[0]++]!;
      const nt = which === "ch" ? ctrl.chasings : which === "av" ? ctrl.avoidings : ctrl.defends;
      const name = parseJsStringLiteral(t[i[0]++]!);
      const target = fxArg(name);
      nt.del((b: any) => b === target);
      out.push(`${line} ||  | ${setsText()}`);
    } else if (op === "ntsnap") {
      const which = t[i[0]++]!;
      const nt = which === "ch" ? ctrl.chasings : which === "av" ? ctrl.avoidings : ctrl.defends;
      const ents = nt.targets.map(nameOf).join(",");
      out.push(`${line} ||  | ${setsText()} ents=[${ents}]`);
    } else if (op === "lookup") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      ctrl.lookup(fxArg(name));
      out.push(`${line} || ${joinLog()} | ${setsText()}`);
    } else if (op === "should_chase") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      const v = ctrl.should_chase(fxArg(name));
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "should_avoid") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      const v = ctrl.should_avoid(fxArg(name));
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "should_defend") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      const v = ctrl.should_defend(fxArg(name));
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "desire" || op === "adesire") {
      const mark = parseJsStringLiteral(t[i[0]++]!);
      const v = op === "desire" ? ctrl.desire(mark) : ctrl.action_desire(mark);
      out.push(`${line} || ${joinLog()} | v=${num(v)}`);
    } else if (op === "guess") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      const v = ctrl.guess_entity_pos(fxArg(name));
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "wtf" || op === "wtc" || op === "backoff" || op === "cornered") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      const target = fxArg(name);
      const v =
        op === "wtf"
          ? ctrl.w_atk_too_far(target)
          : op === "wtc"
            ? ctrl.w_atk_too_close(target)
            : op === "backoff"
              ? ctrl.can_back_off(target)
              : ctrl.cornered(target);
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "srun") {
      const where = parseJsStringLiteral(t[i[0]++]!);
      const name = parseJsStringLiteral(t[i[0]++]!);
      out.push(`${line} || ${joinLog()} | v=${renderValue(ctrl.should_run(where, fxArg(name)))}`);
    } else if (
      op === "enter_goto" ||
      op === "leave_goto" ||
      op === "leave_chase" ||
      op === "enter_avoid" ||
      op === "leave_avoid"
    ) {
      const name = parseJsStringLiteral(t[i[0]++]!);
      const target = fxArg(name);
      const v =
        op === "enter_goto"
          ? ctrl.is_enter_goto_range(target)
          : op === "leave_goto"
            ? ctrl.is_leave_goto_range(target)
            : op === "leave_chase"
              ? ctrl.is_leave_chase_range(target)
              : op === "enter_avoid"
                ? ctrl.is_enter_avoid_zone(target)
                : ctrl.is_leave_avoid_zone(target);
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "selfref") {
      // `me` 是活实体（`ctrl.entity`）⇒ 直接给 `[id, position]`，与端口 `self_ref_of_env`
      // 的投影同形（见 `subjects/bot.cpp`）。
      const p = me.position as { x: number; y: number; z: number };
      const v = [ctrl.entity.id, { x: p.x, y: p.y, z: p.z }];
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "act") {
      const where = parseJsStringLiteral(t[i[0]++]!);
      const action: any = parseValue(t, i);
      if (action?.expression) {
        action.judger = new Expression(action.expression, get_val_from_bot_ctrl);
      }
      const v = ctrl.handle_action(where, action);
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "checkbot") {
      ctrl.check_bot();
      out.push(
        `${line} || ${joinLog()} | bot_id=${renderValue((ctrl as any)._bot_id)} bot=${renderValue(!!(ctrl as any)._bot)}`,
      );
    } else if (op === "dummy") {
      const id = parseValue(t, i);
      ctrl.dummy = id as never;
      dummy_updaters[ctrl.dummy]?.update(ctrl);
      out.push(`${line} || ${joinLog()} | dummy=${renderValue(ctrl.dummy)} mark=${renderValue(mt.mark)}`);
    } else if (op === "ds") {
      const parts: string[] = [];
      while (i[0] < t.length) {
        const key = parseJsStringLiteral(t[i[0]++]!);
        parts.push(`${key}=${renderValue((ctrl as any).dataset[key])}`);
      }
      out.push(`${line} || ${joinLog()} | ${parts.join(" ")}`);
    } else if (op === "fsmreset") {
      const key: any = parseValue(t, i);
      ctrl.fsm.reset(key);
      out.push(`${line} || ${joinLog()} | state=${renderValue(ctrl.bot_state)}`);
    } else if (op === "fsmupdate") {
      const dt = Number(t[i[0]++]);
      ctrl.fsm.update(dt);
      out.push(`${line} || ${joinLog()} | state=${renderValue(ctrl.bot_state)} mark=${renderValue(mt.mark)}`);
    } else if (op === "update") {
      ctrl.update();
      const r = ctrl.result;
      out.push(
        `${line} || ${joinLog()} | state=${renderValue(ctrl.bot_state)} mark=${renderValue(mt.mark)} ${setsText()} ` +
          `res.time=${num(r.time)} res.kind=${renderValue(r.kind)} res.v=${renderValue(r.result)}`,
      );
    } else if (op === "updlookup") {
      const meIdx = Number(t[i[0]++]);
      const entities: any[] = [];
      while (i[0] < t.length) entities.push(fxArg(parseJsStringLiteral(t[i[0]++]!)));
      ctrl.update_lookup(meIdx, entities as never);
      out.push(`${line} || ${joinLog()} | ${setsText()}`);
    } else if (op === "val") {
      const word = String(parseValue(t, i));
      const getter = get_val_from_bot_ctrl(word);
      const v = (getter as any)(ctrl, word);
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "lockstand") {
      const v = ctrl.lock_when_stand_and_rest();
      out.push(`${line} || ${joinLog()} | v=${renderValue(v)}`);
    } else if (op === "follow") {
      const name = parseJsStringLiteral(t[i[0]++]!);
      ctrl.follow(fxArg(name));
      out.push(
        `${line} ||  | following=${nameOf(ctrl.following)} goingto=${renderValue(ctrl.goingto)} behavior=${renderValue(ctrl.behavior)}`,
      );
    } else if (op === "move") {
      ctrl.move();
      out.push(
        `${line} ||  | following=${nameOf(ctrl.following)} goingto=${renderValue(ctrl.goingto)} behavior=${renderValue(ctrl.behavior)}`,
      );
    } else if (op === "stay") {
      ctrl.stay();
      out.push(
        `${line} ||  | following=${nameOf(ctrl.following)} goingto=${renderValue(ctrl.goingto)} behavior=${renderValue(ctrl.behavior)}`,
      );
    } else if (op === "come") {
      const x = Number(t[i[0]++]);
      const y = Number(t[i[0]++]);
      const z = Number(t[i[0]++]);
      ctrl.come(x, y, z);
      out.push(
        `${line} ||  | following=${nameOf(ctrl.following)} goingto=${renderValue(ctrl.goingto)} behavior=${renderValue(ctrl.behavior)}`,
      );
    } else if (op === "get") {
      const field = t[i[0]++]!;
      let payload: string;
      switch (field) {
        case "difficulty": payload = num(ctrl.difficulty); break;
        case "facing": payload = num(ctrl.facing); break;
        case "team": payload = renderValue(ctrl.team); break;
        case "en": payload = nameOf(ctrl.en); break;
        case "av": payload = nameOf(ctrl.av); break;
        case "bot_state": payload = renderValue(ctrl.bot_state); break;
        case "atk_f_x": payload = num(ctrl.atk_f_x); break;
        case "atk_b_x": payload = num(ctrl.atk_b_x); break;
        case "w_atk_f_x": payload = num(ctrl.w_atk_f_x); break;
        case "w_atk_b_x": payload = num(ctrl.w_atk_b_x); break;
        case "r_atk_x": payload = num(ctrl.r_atk_x); break;
        case "d_atk_max_x": payload = num(ctrl.d_atk_max_x); break;
        case "d_atk_min_x": payload = num(ctrl.d_atk_min_x); break;
        case "j_atk_x": payload = num(ctrl.j_atk_x); break;
        case "w_atk_m_x": payload = num(ctrl.w_atk_m_x); break;
        case "w_atk_r_x": payload = num(ctrl.w_atk_r_x); break;
        case "defend_desire": payload = num(ctrl.defend_desire); break;
        case "en_out_of_range": payload = renderValue(ctrl.en_out_of_range); break;
        case "idle_min_x": payload = num(ctrl.idle_min_x); break;
        case "idle_max_x": payload = num(ctrl.idle_max_x); break;
        case "idle_min_z": payload = num(ctrl.idle_min_z); break;
        case "idle_max_z": payload = num(ctrl.idle_max_z); break;
        case "dummy": payload = renderValue(ctrl.dummy); break;
        case "behavior": payload = renderValue(ctrl.behavior); break;
        case "goingto": payload = renderValue(ctrl.goingto); break;
        case "following": payload = nameOf(ctrl.following); break;
        case "watching": payload = nameOf(ctrl.watching); break;
        case "bot_frame": payload = renderValue(ctrl.bot_frame); break;
        case "bot_id": payload = renderValue((ctrl as any)._bot_id); break;
        case "stage_player_l": payload = num(Number((ctrl as any).stage.player_l)); break;
        case "stage_player_r": payload = num(Number((ctrl as any).stage.player_r)); break;
        case "stage_near": payload = num(Number((ctrl as any).stage.near)); break;
        case "stage_far": payload = num(Number((ctrl as any).stage.far)); break;
        case "stage_finish": payload = renderValue(!!(ctrl as any).stage.is_stage_finish); break;
        case "chapter_finish": payload = renderValue(!!(ctrl as any).stage.is_chapter_finish); break;
        case "hpa": payload = renderValue(world.has_players_alive); break;
        case "bound": payload = `[${bound.map(num).join(",")}]`; break;
        default:
          process.stderr.write(`unknown get field '${field}'\n`);
          process.exit(2);
      }
      out.push(`${line} || ${joinLog()} | v=${payload}`);
    } else {
      process.stderr.write(`unknown op '${op}'\n`);
      process.exit(2);
    }
  }
  process.stdout.write(out.join("\n") + "\n");
}

main();
