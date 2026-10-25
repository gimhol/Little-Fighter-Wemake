import { Ditto } from "../ditto/Instance";
import { CMD } from "../defines/CMD";
import { GK } from "../defines/GameKey";
import type { IWorldDataset } from "../defines/IWorldDataset";
import type { Entity } from "../entity/Entity";
import type { World } from "../World";
import { CMDS } from "./CMDS";

const FIELD_WIDTH = 11;

function text(v: unknown): string {
  return v === undefined || v === null ? '-' : `${v}`;
}

/** `#101` 与 `101` 都认；残影 / 傀儡不在 entity_map 里，再兜一圈 */
function find_entity_any(world: World, raw: string): Entity | undefined {
  const id = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!id) return void 0;
  const direct = world.find_entity(id);
  if (direct) return direct;
  for (const e of world.ghosts) if (e?.id === id) return e;
  for (const e of world.puppets.values()) if (e?.id === id) return e;
  return void 0;
}

function record(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

const help_dataset = `Usage: DATASET [<key>] [--entity=<id>]

No <key>: list the current background's dataset (the map's own gravity / gravity_d …)
With <key>: print that key's layers (frame → data → bg → world) and the value in use
不写 <key>：列当前背景的数据集（地图自己的 gravity / gravity_d …）
给 <key>：按 frame → 实体数据 → 背景 → 世界 打印这一键的各层值与真正生效的值

Options:
  --entity=<id>   include that entity's layers + the value it actually uses / 连实体那一层一起看`;

CMDS.register(CMD.DATASET, help_dataset, (ctx) => {
  const world = ctx.world;
  const key = ctx.str(1);
  const entity_arg = ctx.str_arg('--entity');

  const bg = world.bg;
  const bg_dataset = record(bg?.data.dataset);
  let bg_label = '-';
  if (bg) {
    bg_label = text(bg.id);
    const name = `${bg.name ?? ''}`;
    if (name && name !== 'undefined' && name !== bg_label) bg_label += ` (${name})`;
  }

  if (!key) {
    const keys = Object.keys(bg_dataset);
    let out = bg
      ? `bg ${bg_label} dataset (${keys.length}):`
      : 'bg dataset: -（当前没有背景）';
    for (const k of keys) {
      const label = k.length < FIELD_WIDTH ? k.padEnd(FIELD_WIDTH) : `${k}  `;
      out += `\n  ${label}${text(bg_dataset[k])}`;
    }
    if (bg && !keys.length) out += '\n  （空：这个地图没有覆盖任何 world dataset 字段）';
    out += `\nworld dataset: ${Object.keys(world.dataset).length} keys` +
      '（默认值；`DATASET <key> [--entity=#101]` 看单个键的解析链）';
    return Ditto.Log(out);
  }

  const entity = entity_arg ? find_entity_any(world, entity_arg) : void 0;
  if (entity_arg && !entity) {
    return Ditto.warn(`DATASET failed, no such entity: ${entity_arg}（\`ENTITIES --all\` 看有哪些）`);
  }

  const world_dataset = record(world.dataset);
  const data_base = record(entity?.data.base);
  const frame_dataset = record(entity?.frame.dataset);

  // 解析顺序与 `Entity.dataset` 一致：frame → data → bg → world
  let effective = world_dataset[key];
  let source = 'world';
  if (bg_dataset[key] != null) {
    effective = bg_dataset[key];
    source = 'bg';
  }
  if (data_base[key] != null) {
    effective = data_base[key];
    source = 'data';
  }
  if (frame_dataset[key] != null) {
    effective = frame_dataset[key];
    source = 'frame';
  }

  const lines: string[] = [];
  const add = (label: string, value: string) => lines.push(`${label.padEnd(FIELD_WIDTH)}${value}`);
  add('frame', text(frame_dataset[key]));
  add('data', text(data_base[key]));
  add('bg', text(bg_dataset[key]) + (bg_dataset[key] == null ? '' : `  ${bg_label}`));
  add('world', text(world_dataset[key]));
  add('effective', `${text(effective)}  <- ${source}`);
  if (entity) {
    let ent = `#${entity.id}`;
    if (key === 'gravity' || key === 'gravity_d') {
      const defending = entity.ctrl.is_end(GK.Defend);
      ent += `  gravity()=${entity.gravity}`;
      ent += `  defending=${defending ? 1 : 0}`;
      ent += `  key=${defending ? 'gravity' : 'gravity_d'}`;
    } else {
      ent += `  dataset=${text(entity.dataset(key as keyof IWorldDataset))}`;
    }
    add('entity', ent);
  }

  return Ditto.Log(`${key}:\n  ${lines.join('\n  ')}`);
});
