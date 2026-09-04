import { LocalController } from "../controller/LocalController";
import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { is_human_ctrl } from "../entity";
import { CMDS } from "./CMDS";

const help = `Usage: SET_PUPPET --player_id=<id> --oid=<fighter> [--team=<team>]

Create or update a player's puppet / 创建或更新指定玩家的傀儡

Options:
  --player_id=<id>    player id (required) / 玩家 id（必填）
  --oid=<fighter>     fighter oid (required) / 角色 oid（必填）
  --team=<team>       team / 队伍`;

CMDS.register(CMD.SET_PUPPET, help, (ctx) => {
  const player_id = ctx.str_arg('--player_id');
  const oid = ctx.str_arg('--oid');
  const team = ctx.str_arg('--team');

  if (!player_id || !oid)
    return Ditto.warn(`SET_PUPPET failed, must "SET_PUPPET --player_id=1 --oid=deep [--team=...]", got: ${ctx.cmd}`)

  const lfw = ctx.world.lfw;
  const player_info = lfw.players.get(player_id);
  if (!player_info)
    return Ditto.warn(`SET_PUPPET failed, player not found: ${player_id}`)

  const data = lfw.datas.fighters.find((v) => v.id === oid);
  if (!data)
    return Ditto.warn(`SET_PUPPET failed, fighter oid not found: ${oid}`)

  let f = ctx.world.puppets.get(player_id);

  if (!f) {
    f = lfw.factory.create_entity(ctx.world, data)
    if (!f)
      return Ditto.warn(`SET_PUPPET failed to create puppet: ${oid}`)
    const { x, z } = lfw.world.stage.middle;
    f.set_position(x, 450, z);
  }

  f.name = player_info.name;
  if (team) f.team = team;
  if (f.data !== data) f.transform(data);
  if (!is_human_ctrl(f.ctrl) || f.ctrl.player_id != player_id)
    f.ctrl = new LocalController(player_id, f);
  f.attach();
  return f.id;
})
