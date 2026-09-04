import { LocalController } from "../controller/LocalController";
import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: SPAWN --oid=<oid> [options]

Spawn entity into the world / 生成实体到世界

Options:
  --oid=<oid>          data id (required) / 数据 oid（必填）
  --team=<team>        team / 队伍
  --name=<name>        display name / 显示名
  --player_id=<id>     control by the local player / 交给本地玩家控制
  --facing=<1|-1>      facing direction / 朝向
  --x, --y, --z=<n>    position, omit for random / 坐标，省略则随机落位
  --hp=<n>             hit points / 生命值
  --mp=<n>             mana points / 魔力值
  --count=<n>          amount to spawn, default 1 / 生成数量，默认 1`;

CMDS.register(CMD.SPAWN, help, (ctx) => {
  const oid = ctx.str_arg('--oid');
  const team = ctx.str_arg('--team');
  const name = ctx.str_arg('--name');
  const player_id = ctx.str_arg('--player_id');
  const facing = ctx.num_arg('--facing');
  const x = ctx.num_arg('--x');
  const y = ctx.num_arg('--y');
  const z = ctx.num_arg('--z');
  const hp = ctx.num_arg('--hp');
  const mp = ctx.num_arg('--mp');
  const count = ctx.num_arg('--count') ?? 1;
  if (!oid)
    return Ditto.warn(`SPAWN failed, must "SPAWN --oid=xxx [--team=...] [--count=n]", got: ${ctx.cmd}`)

  const lfw = ctx.world.lfw;
  const data = lfw.datas.find(oid);
  if (!data)
    return Ditto.warn(`SPAWN failed, oid not found: ${oid}`)

  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const e = lfw.factory.create_entity(ctx.world, data);
    if (!e) continue;
    e.team = team || lfw.new_team;
    if (name) e.name = name;
    if (facing === 1 || facing === -1) e.facing = facing;
    if (player_id)
      e.ctrl = new LocalController(player_id, e);
    else
      e.ctrl = lfw.factory.create_ctrl(data.id, '', e) ?? e.ctrl;

    if (x != void 0)
      e.position.set(x, y ?? e.position.y, z ?? e.position.z);
    else
      lfw.random_entity_info(e);

    if (hp != void 0) e.hp = hp;
    if (mp != void 0) e.mp = mp;
    e.attach();
    ids.push(e.id);
  }
  return ids.join(',');
})
