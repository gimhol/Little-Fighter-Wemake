import { CMD } from "../defines/CMD";
import { Ditto } from "../ditto/Instance";
import { CMDS } from "./CMDS";

const help = `Usage: DEL_PUPPET <player_id>

Remove a player's puppet / 移除指定玩家的傀儡`;

CMDS.register(CMD.DEL_PUPPET, help, (ctx) => {
  const player_id = ctx.str(1);
  if (typeof player_id !== 'string') return Ditto.warn(`DEL_PUPPET failed, must "DEL_PUPPET \${playerId}", got: ${ctx.cmd}`)
  const entity = ctx.world.puppets.get(player_id);
  if (entity) ctx.world.del_entity(entity);
  else Ditto.warn('DEL_PUPPET failed, puppet not found.')
})
