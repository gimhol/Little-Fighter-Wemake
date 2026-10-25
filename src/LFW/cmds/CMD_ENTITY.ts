import { CMD } from "../defines/CMD";
import { FrameId } from "../defines/FrameId";
import { Ditto } from "../ditto/Instance";
import type { Entity } from "../entity/Entity";
import { EnterFrameResult } from "../entity/EnterFrameResult";
import { is_ball_ctrl, is_human_ctrl } from "../entity/type_check";
import type { World } from "../World";
import { CMDS } from "./CMDS";

const KEY_WIDTH = 10;

const ENTER_FRAME_RESULT_NAMES: Record<number, string> = {
  [EnterFrameResult.Gone]: 'Gone',
  [EnterFrameResult.NotFound]: 'NotFound',
  [EnterFrameResult.Entered]: 'Entered',
  [EnterFrameResult.Fallback]: 'Fallback',
};

/** `A_SET_PROP` 那套属性名 */
const PROPS = [
  'hp', 'hp_r', 'hp_max', 'mp', 'mp_max', 'invisible', 'invulnerable', 'toughness',
  'fallinjury', 'throwinjury', 'motionless', 'shaking', 'facing', 'arest', 'dropping',
  'team', 'reserve', 'stat_bar',
];

function num(v: number | undefined | null): string {
  if (typeof v !== 'number' || !Number.isFinite(v)) return '-';
  return `${Math.round(v * 1000) / 1000}`;
}

function vec3(p: { x: number; y: number; z: number }) { return `(${num(p.x)},${num(p.y)},${num(p.z)})`; }

function usable(text: string) { return !!text && text !== 'undefined'; }

/** `#101` 与 `101` 都认（`ENTITIES` 打出来的就是带 `#` 的）；残影 / 傀儡不在 entity_map 里，再兜一圈 */
function find_entity_any(world: World, raw: string): Entity | undefined {
  const id = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!id) return void 0;
  const direct = world.find_entity(id);
  if (direct) return direct;
  for (const e of world.ghosts) if (e?.id === id) return e;
  for (const e of world.puppets.values()) if (e?.id === id) return e;
  return void 0;
}

/** 命令行的值 → 实体字段的值：能当数字就当数字，`true`/`false` 当 1/0，`null`/`none`（或空）当空 */
function value_of(text: string): number | string | null {
  if (!text || text === 'null' || text === 'none') return null;
  if (text === 'true') return 1;
  if (text === 'false') return 0;
  const n = Number(text);
  return Number.isNaN(n) ? text : n;
}

function ctrl_name(e: Entity): string {
  const ctrl = e.ctrl;
  if (!ctrl) return 'none';
  if (is_human_ctrl(ctrl)) return 'player';
  return is_ball_ctrl(ctrl) ? 'ball' : 'bot';
}

/** 引用类字段的显示：`#101` / `-` */
function entity_ref(e: Entity | null | undefined): string { return e ? `#${e.id}` : '-'; }

/** `holding` / `bearer`：空 ⇒ 断开；其余按实体 id 连起来（`#` 可省），两边一起设（同拾取时的写法） */
function bind_hold(e: Entity, holds: boolean, text: string) {
  const release = !text || text === 'null' || text === 'none';
  const id = text.startsWith('#') ? text.slice(1) : text;
  const target = release ? undefined : e.world.find_entity(id);
  if (!release && !target) return Ditto.warn(`ENTITY: no such entity "${text}"`);
  const old = holds ? e.holding : e.bearer;
  if (old) {
    if (holds) {
      if (old.bearer === e) old.bearer = null;
    } else if (old.holding === e) {
      old.holding = null;
    }
  }
  if (holds) {
    e.holding = target ?? null;
    if (target) target.bearer = e;
  } else {
    e.bearer = target ?? null;
    if (target) target.holding = e;
  }
}

function report(e: Entity): string {
  const lines: string[] = [];
  const add = (key: string, value: string) => lines.push(`  ${key.padEnd(KEY_WIDTH)}${value}`);

  const data_id = `${e.data?.id ?? ''}`;
  add('data', usable(data_id) ? data_id : '-');

  const name = `${e.name ?? ''}`;
  add('name', `${usable(name) ? `"${name}"` : '-'}  visible=${num(e.name_visible)}`);

  const group = `${e.group ?? ''}`;
  add('team', `${e.team}  group=${usable(group) ? group : '-'}`);

  add('position', `${vec3(e.position)}  prev=${vec3(e.prev_position)}`);
  add('velocity', `${vec3(e.velocity)}  prev=${vec3(e.prev_velocity ?? e.velocity)}`);

  // `e.state` 取的是帧自带的 state；`--state` 改的是当前状态（`_state`），两者不一致时补一句
  const cur_state = (e as unknown as { _state?: { state?: number } })._state?.state;
  let frame_line = `${e.frame.id}  state=${num(cur_state)}  wait=${num(e.wait)}`;
  if (`${e.frame.state}` !== `${cur_state}`) frame_line += `  frame_state=${e.frame.state}`;
  add('frame', frame_line);

  add('hp/mp', `${num(e.hp)}/${num(e.hp_max)}  ${num(e.mp)}/${num(e.mp_max)}`);
  add('facing', `${num(e.facing)}  on_ground=${e.is_on_ground ? 1 : 0}`);
  add('flags', `invisible=${num(e.invisible)}  invulnerable=${num(e.invulnerable)}  ` +
    `shaking=${num(e.shaking)}  motionless=${num(e.motionless)}  arest=${num(e.arest)}  ` +
    `reserve=${num(e.reserve)}`);
  add('other', `ctrl=${ctrl_name(e)}  puppet=${e.puppet ? 1 : 0}  ghosted=${num(e.ghosted)}  ` +
    `buffs=${e.buffs.size}  lifetime=${num(e.lifetime)}`);
  add('link', `holding=${entity_ref(e.holding)}  bearer=${entity_ref(e.bearer)}  ` +
    `catching=${entity_ref(e.catching)}  catcher=${entity_ref(e.catcher)}`);

  return [`entity #${e.id}`, ...lines].join('\n');
}

function apply_option(e: Entity, key: string, text: string) {
  if (key === 'x' || key === 'y' || key === 'z') {
    const v = Number(text);
    if (Number.isNaN(v)) return Ditto.warn(`ENTITY: --${key} needs a number, got "${text}"`);
    // 只给一个轴时其余保持原值；`set_position` 内部会按场地边界限制并刷 `ground_y`
    return e.set_position(key === 'x' ? v : null, key === 'y' ? v : null, key === 'z' ? v : null);
  }
  if (key === 'velocity') {
    const v = text.split(',').map(Number);
    if (v.length !== 3 || v.some((it) => Number.isNaN(it)))
      return Ditto.warn(`ENTITY: --velocity needs x,y,z, got "${text}"`);
    e.velocity.x = v[0]!;
    e.velocity.y = v[1]!;
    e.velocity.z = v[2]!;
    e.prev_velocity.x = v[0]!;
    e.prev_velocity.y = v[1]!;
    e.prev_velocity.z = v[2]!;
    return;
  }
  if (key === 'frame') {
    const special = !text || text === FrameId.Auto || text === FrameId.Self || text === FrameId.Gone;
    if (!special) {
      const found = e.find_frame_by_id(text);
      if (!found || `${found.id}` !== text)
        return Ditto.warn(`ENTITY: data ${e.data?.id ?? '-'} has no frame "${text}"`);
    }
    const r = e.enter_frame_by_id(text, false);
    if (r !== EnterFrameResult.Entered)
      return Ditto.warn(`ENTITY: frame "${text}" -> ${ENTER_FRAME_RESULT_NAMES[r] ?? r}`);
    return;
  }
  if (key === 'state') {
    const code = Number(text);
    if (Number.isNaN(code)) return Ditto.warn(`ENTITY: --state needs a number, got "${text}"`);
    const states = (e as unknown as { _states?: { get(k: number): unknown } })._states;
    if (states && !states.get(code)) return Ditto.warn(`ENTITY: no such state code "${text}"`);
    return e.set_state(code);
  }
  if (key === 'name') return void (e.name = text === '' ? null : text);
  if (key === 'name_visible') {
    e.name_visible = Number(value_of(text));
    return;
  }
  if (key === 'holding' || key === 'bearer') return bind_hold(e, key === 'holding', text);
  if (!PROPS.includes(key))
    return Ditto.warn(`ENTITY: unknown option --${key}（\`help entity\` 看支持哪些）`);
  (e as unknown as Record<string, number | string | null>)[key] = value_of(text);
}

const help = `Usage: ENTITY <id> [--<prop>=<value> ...]

Show one entity; every option given is applied first, then the result is printed
显示指定实体的状态；带了选项就先把改动应用掉，再打印改后的状态（id 用 \`ENTITIES\` 里那个，\`#\` 可省）

Geometry / 位置与速度:
  --x=<n> --y=<n> --z=<n>      position（只给其中几个时其余不变）
  --velocity=<x,y,z>           velocity / 速度
Frame & name / 帧与名字:
  --frame=<frame_id>           enter a frame id / 切到数据里的某个帧 id
  --state=<state_code>         set state / 设置状态码（数值）
  --name=<text>                display name / 显示名（空 = 回到数据里的名字）
  --name_visible=<0|1>         draw the name or not / 是否显示名字
Props / 属性（同 \`A_SET_PROP\` 那套）:
  hp hp_r hp_max mp mp_max invisible invulnerable toughness fallinjury
  throwinjury motionless shaking facing arest dropping team reserve stat_bar
  holding / bearer 也可以写实体 id（\`--holding=#102\`）连起来；写数字或空 = 断开`;

CMDS.register(CMD.ENTITY, help, (ctx) => {
  const raw = ctx.str(1);
  if (!raw) return Ditto.warn(`ENTITY failed, must "ENTITY <id> [--prop=value ...]", got: ${ctx.cmd}`);
  const e = find_entity_any(ctx.world, raw);
  if (!e) return Ditto.warn(`ENTITY failed, no such entity: ${raw}（\`ENTITIES --all\` 看有哪些）`);
  for (const word of ctx.words) {
    if (!word.startsWith('--')) continue;
    const eq = word.indexOf('=');
    if (eq <= 2) {
      Ditto.warn(`ENTITY: option needs a value: ${word}（例：--hp=100）`);
      continue;
    }
    apply_option(e, word.slice(2, eq), word.slice(eq + 1));
  }
  Ditto.Log(report(e));
});
