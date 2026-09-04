import { CMD } from "../defines/CMD";
import { CMDS } from "./CMDS";

const help = `Usage: DESPAWN <entity_id> ...

Remove entities directly by id / 按 id 直接移除实体`;

CMDS.register(CMD.DESPAWN, help, (c) => {
  for (const id of c.words.slice(1)) {
    if (!id) continue;
    const e = c.world.find_entity(id);
    if (!e) continue;
    c.world.del_entity(e)
  }
})
