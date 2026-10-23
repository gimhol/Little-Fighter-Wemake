import { Ditto } from "../ditto/Instance";
import { CMD } from "../defines/CMD";
import type { Entity } from "../entity/Entity";
import type { LFW } from "../LFW";
import type { UINode } from "../ui/UINode";
import { CMDS } from "./CMDS";

const COLUMN_MIN = 2;
const COLUMN_MAX = 24;
const FIELD_WIDTH = 11;

/** 数据表里取用得到的字段（每种数据只需要这几项） */
interface IDataLike {
  id?: string;
  name?: string;
  title?: string;
  base?: { name?: string };
}

/** `name` → `title` → `base.name`；数据里没名字就返回空串 */
function label_of(data: IDataLike | undefined): string {
  if (!data) return '';
  const pick = (v: unknown): string => (typeof v === 'string' && v && v !== 'undefined' ? v : '');
  return pick(data.name) || pick(data.title) || pick(data.base?.name);
}

function rows_of(ids: string[], labels: string[]): string {
  let longest = 0;
  for (const id of ids) longest = Math.max(longest, id.length);
  const width = Math.min(COLUMN_MAX, Math.max(COLUMN_MIN, longest + 2));
  return ids.map((id, i) => `\n  ${id.padEnd(width)}${labels[i] ?? ''}`).join('');
}

function vec2(x: number, y: number) { return `(${x},${y})`; }

function vec3(p: { x: number; y: number; z: number }) { return `(${p.x},${p.y},${p.z})`; }

/** `LFW.VERSION_NAME` 是静态字段：从实例的 constructor 上取，避免反向 import 出环形依赖 */
function version_of(lfw: object): string {
  const ctor = (lfw as { constructor?: { VERSION_NAME?: string } }).constructor;
  return ctor?.VERSION_NAME ?? 'v0.0.0';
}

interface IListKind {
  name: string;
  get(lfw: LFW): readonly IDataLike[];
  alias?: boolean;
}

const LIST_KINDS: IListKind[] = [
  { name: 'fighters', get: (l) => l.datas.fighters },
  { name: 'weapons', get: (l) => l.datas.weapons },
  { name: 'balls', get: (l) => l.datas.balls },
  { name: 'objects', get: (l) => l.datas.objects },
  { name: 'entities', get: (l) => l.datas.entities },
  { name: 'bots', get: (l) => l.datas.bots },
  { name: 'moves', get: (l) => l.datas.moves },
  { name: 'stages', get: (l) => l.datas.stages },
  { name: 'bg', get: (l) => l.datas.backgrounds },
  { name: 'backgrounds', get: (l) => l.datas.backgrounds, alias: true },
  { name: 'directors', get: (l) => l.datas.directors },
];

const KIND_NAMES = LIST_KINDS.filter((it) => !it.alias).map((it) => it.name).join('|');

const help_list = `Usage: LIST <kind> [filter]

List data ids of one kind; 'filter' matches id or name (case-insensitive)
列出某一类数据的所有 id；filter 按 id / 名称做（大小写不敏感的）子串匹配

Kinds: ${KIND_NAMES}`;

CMDS.register(CMD.LIST, help_list, (ctx) => {
  const which = ctx.str(1);
  if (!which) {
    return Ditto.warn(
      `LIST failed, must "LIST <kind> [filter]", kinds: ${KIND_NAMES}, got: ${ctx.cmd}`,
    );
  }
  const hit = LIST_KINDS.find((it) => it.name === which.toLowerCase());
  if (!hit) {
    return Ditto.warn(
      `LIST failed, unknown kind "${which}", kinds: ${KIND_NAMES}（用 \`help list\` 看说明）`,
    );
  }

  const all = hit.get(ctx.world.lfw) ?? [];
  const filter = (ctx.str(2) ?? '').toLowerCase();
  const ids: string[] = [];
  const labels: string[] = [];
  for (const data of all) {
    const id = `${data?.id ?? ''}`;
    const label = label_of(data);
    if (filter && !id.toLowerCase().includes(filter) && !label.toLowerCase().includes(filter))
      continue;
    ids.push(id);
    labels.push(label === id ? '' : label);
  }

  let head = `${hit.name} (${ids.length}`;
  if (filter) head += `/${all.length}`;
  head += '):';
  if (!ids.length) return Ditto.warn(`${head}（没有匹配 "${filter}" 的项）`);
  Ditto.Log(head + rows_of(ids, labels));
});

const help_entities = `Usage: ENTITIES [--team=<team>] [--all]

List live entities: id, data id, team, hp/mp, position
列出场上实体：id、数据 id、队伍、血量/魔力、坐标

Options:
  --team=<team>   only that team / 只看这一队
  --all           include ghosts and puppets / 连残影与傀儡一起列`;

CMDS.register(CMD.ENTITIES, help_entities, (ctx) => {
  const team = ctx.str_arg('--team') ?? '';
  const with_all = ctx.str_arg('--all') !== void 0;
  const world = ctx.world;

  const list: Entity[] = [];
  const take = (src: readonly Entity[]) => {
    for (const e of src) {
      if (!e) continue;
      if (team && e.team !== team) continue;
      if (list.includes(e)) continue; // 傀儡也在 entities 里
      list.push(e);
    }
  };
  take(world.entities);
  if (with_all) {
    take(world.ghosts);
    take([...world.puppets.values()]);
  }

  if (!list.length) {
    return Ditto.Log(`entities (0):${team ? `（没有 team=${team} 的实体）` : ''}`);
  }
  const lines = list.map((e) => {
    let line = `#${e.id}`;
    const data_id = `${e.data?.id ?? ''}`;
    if (data_id && data_id !== 'undefined') line += ` ${data_id}`;
    const name = `${e.name ?? ''}`;
    if (name && name !== 'undefined') line += ` "${name}"`;
    line += `  team=${e.team}`;
    line += `  hp=${e.hp}/${e.hp_max}`;
    line += `  mp=${e.mp}/${e.mp_max}`;
    line += `  pos=${vec3(e.position)}`;
    return line;
  });
  Ditto.Log([`entities (${list.length}):`, ...lines.map((it) => `  ${it}`)].join('\n'));
});

const help_info = `Usage: INFO

Show the current world summary: stage, background, difficulty, entities, players
显示当前世界概要：关卡、背景、难度、实体数、玩家`;

CMDS.register(CMD.INFO, help_info, (ctx) => {
  const world = ctx.world;
  const lfw = world.lfw;

  let stage = world.stage?.id || '-';
  if (world.stage?.name) stage += ` (${world.stage.name})`;

  let bg = '-';
  if (world.bg) {
    bg = world.bg.id || '-';
    const name = world.bg.name;
    if (name && name !== bg) bg += ` (${name})`;
  }

  const players = [...lfw.players.values()]
    .filter((it) => it.fighter)
    .map((it) => {
      let text = it.id;
      if (it.name && it.name !== it.id) text += `(${it.name})`;
      if (it.is_com) text += '[com]';
      return text;
    });

  let camera = vec2(world.camera.position.x, world.camera.position.y);
  if (world.camera.locked) camera += ' locked';

  const lines: [string, string][] = [
    ['stage', stage],
    ['bg', bg],
    ['difficulty', `${world.dataset.difficulty}`],
    ['paused', `${world.paused}`],
    ['camera', camera],
    [
      'entities',
      `${world.entities.length}  ghosts=${world.ghosts.length}  puppets=${world.puppets.size}`,
    ],
    ['players', players.length ? players.join(', ') : '-'],
    ['lang', lfw.lang],
    ['version', version_of(lfw)],
  ];
  Ditto.Log(lines.map(([k, v]) => `${k.padEnd(FIELD_WIDTH)}${v}`).join('\n'));
});

const help_ui = `Usage: UI [layer] [--depth=<n>]

List UI layers, or one layer's node tree — its child indices are what POINTER_* '--paths' takes
列出 UI 各层，或某一层的节点树（子节点下标就是 POINTER_* 的 --paths 要的序号）

Options:
  --depth=<n>   tree depth of \`UI <layer>\`, default 3 / 节点树深度，默认 3`;

function node_label(node: UINode): string {
  const id = node.id;
  if (id && id !== 'undefined') return id;
  const name = node.name;
  return name && name !== 'undefined' ? name : '?';
}

function node_count(node: UINode): number {
  let n = 1;
  for (const child of node.children) n += node_count(child);
  return n;
}

function node_marks(node: UINode): string {
  let marks = '';
  if (!node.visible) marks += ' [hidden]';
  if (node.disabled) marks += ' [disabled]';
  return marks;
}

function node_line(node: UINode): string {
  let line = node_label(node);
  if (node.children.length) line += ` (${node.children.length})`;
  return line + node_marks(node);
}

function dump_tree(node: UINode, depth: number, max_depth: number, out: string[]): void {
  if (depth >= max_depth) return;
  const indent = '  '.repeat(depth + 1);
  for (let i = 0; i < node.children.length; i++) {
    const child = node.children[i];
    if (!child) continue;
    out.push(`${indent}${i} ${node_line(child)}`);
    dump_tree(child, depth + 1, max_depth, out);
  }
}

CMDS.register(CMD.UI, help_ui, (ctx) => {
  const lfw = ctx.world.lfw;
  const layers = lfw.layers;
  const all = layers?.all ?? [];
  const which = ctx.str(1);

  if (!which) {
    const lines = [`ui layers (${all.length}):`];
    for (const layer of all) {
      const page = layer.ui;
      lines.push(
        `  [${layer.index}] ${page ? node_label(page) : '-'}` +
          `  pages=${layer.pages.length}` +
          `  nodes=${page ? node_count(page) : 0}`,
      );
    }
    if (all.length) lines.push('（`ui <layer>` 看节点树，`--depth=<n>` 调深度）');
    return Ditto.Log(lines.join('\n'));
  }

  const index = Number(which);
  const found = all.find((it) => it.index === index);
  if (!found) return Ditto.warn(`UI failed, layer not found: ${which}（用 \`ui\` 看有哪些层）`);
  const page = found.ui;
  if (!page) return Ditto.warn(`UI failed, layer ${which} has no page`);

  const depth_arg = ctx.num_arg('--depth') ?? 3;
  const max_depth = Math.max(0, Math.min(32, Math.floor(depth_arg)));
  const out = [`[${found.index}] ${node_line(page)}`];
  dump_tree(page, 0, max_depth, out);
  Ditto.Log(out.join('\n'));
});
