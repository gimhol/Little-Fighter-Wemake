import { BotVal, EntityVal, OID, StateEnum } from "../../defines";
import { bot_ball_dfa } from "./bot_ball_dfa";
import { bot_ball_dfj } from "./bot_ball_dfj";
import { bot_chasing_skill_action } from "./bot_chasing_skill_action";
import { bot_explosion_duj } from "./bot_explosion_duj";
import { BotMaker } from "./BotMaker";
import { DESIRE_RATIO_X_3 } from "./constants";
import { frames } from "./frames";


export function make_bot_data_freeze(): BotMaker {
  return new BotMaker(OID.Freeze).set_actions(
    // d>a
    bot_ball_dfa(100, void 0, 50)(e => {
      e.e_ray?.push(
        { ...e.e_ray![0], z: 0.3 },
        { ...e.e_ray![0], z: -0.3 }
      );
      return e;
    }),

    // d>j
    bot_ball_dfj(150, void 0, 50, 300)((a, c) => {
      a.e_ray?.push(
        { ...a.e_ray![0], z: 0.2 },
        { ...a.e_ray![0], z: -0.2 }
      );
      a.expression = c
        .and(BotVal.EnemyState, '!=', StateEnum.Frozen)
        .and(BotVal.EnemyState, '!=', StateEnum.Falling)
        .done();
      return a;
    }),

    // dvj
    bot_chasing_skill_action('dvj', void 0, 150, 1 / 180)((action, cond) => {
      action.expression = cond
        .and(EntityVal.HoldingHeavy, '!=', 1)
        .and(EntityVal.HoldingOID, '!=', OID.Weapon_IceSword)
        .done()
      return action
    }),

    // d^j
    bot_explosion_duj(300, DESIRE_RATIO_X_3, -110, 150, 1600),

  ).set_frames(
    [
      ...frames.standings,
      ...frames.walkings
    ],
    ['d>a', 'd>j', 'd^j', 'dvj']
  );
}

BotMaker.register(OID.Freeze, make_bot_data_freeze)