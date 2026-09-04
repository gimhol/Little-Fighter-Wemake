import { CMD } from "../defines/CMD";
import { is_fighter } from "../entity";
import { CMDS } from "./CMDS";

const help = `Usage: KILL <entity_id> ... | KILL --team=<team>

Kill entities, sets hp to 0 (triggers death flow) / 击杀实体（hp=0，触发死亡流程）

Options:
  --team=<team>   kill all fighters of a team / 击杀该队全部 fighter`;

CMDS.register(CMD.KILL, help, (ctx) => {
  const team = ctx.str_arg('--team');
  if (team) {
    for (const e of ctx.world.entities)
      if (is_fighter(e) && e.team === team) e.hp = 0;
    return;
  }
  for (const token of ctx.words.slice(1)) {
    if (!token || token.startsWith('--')) continue;
    const e = ctx.world.find_entity(token);
    if (!e) continue;
    e.hp = 0;
  }
})
