import { BotController } from "../bot/BotController";
import { ATTCKING_STATES } from "../defines";
import { BotVal } from "../defines/BotVal";
import type { IValGetter, IValGetterGetter } from "../defines/IExpression";
import { abs } from "../utils";
import { get_val_getter_from_entity } from "./get_val_from_entity";
export const bot_val_getters: Record<BotVal, (e: BotController) => any> = {
  [BotVal.Desire]: e => e.desire("bot_val"),
  [BotVal.BotState]: e => e.fsm.state?.key ?? '',
  [BotVal.EnemyY]: e => e.chasings.get()?.position.y,
  [BotVal.EnemyDiffY]: e => {
    const chasing = e.chasings.get();
    if (!chasing) return NaN;
    return chasing.position.y - e.entity.position.y;
  },
  [BotVal.EnemyX]: e => e.chasings.get()?.position.x,
  [BotVal.EnemyDiffX]: e => {
    const chasing = e.chasings.get();
    if (!chasing) return NaN;
    return e.entity.facing * (chasing.position.x - e.entity.position.x);
  },
  [BotVal.EnemyState]: e => e.chasings.get()?.state,
  [BotVal.Safe]: e => {
    if (e.defends.size) return 0;
    const chasing = e.chasings.get();
    const avoiding = e.avoidings.get();
    if (chasing && abs(chasing.position.x - e.entity.position.x) < 200 && abs(chasing.position.z - e.entity.position.z) < 150) return 0;
    if (chasing && ATTCKING_STATES.some(v => chasing.state === v)) return 0;
    if (avoiding && abs(avoiding.position.x - e.entity.position.x) < 200 && abs(avoiding.position.z - e.entity.position.z) < 150) return 0;
    if (avoiding && ATTCKING_STATES.some(v => avoiding.state === v)) return 0;
    return 1;
  },
  [BotVal.EnemyOutOfRange]: e => e.en_out_of_range ? 1 : 0

}
export const bot_entity_val_getters = new Map<string, IValGetter<BotController>>();

export const get_val_from_bot_ctrl: IValGetterGetter<BotController> = (word) => {
  const val_getter = bot_val_getters[word as BotVal]
  if (val_getter) return val_getter;
  let fallback = bot_entity_val_getters.get(word);
  if (!fallback) {
    const val_getter = get_val_getter_from_entity(word);
    fallback = val_getter ? (e, ...arg) => val_getter(e.entity, ...arg) : () => word
    bot_entity_val_getters.set(word, fallback)
  }
  return fallback;
};
