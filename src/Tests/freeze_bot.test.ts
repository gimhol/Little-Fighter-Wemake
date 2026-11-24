import { make_bot_data_freeze } from "@/LFW/dat_translator/bots/make_bot_data_freeze";
import { BotVal, StateEnum } from "@/LFW/defines";

describe("Freeze bot", () => {
  it("d>j 忽略已被冻结的敌人", () => {
    const action = make_bot_data_freeze().bot.actions["d>j"]!;
    expect(action).toBeDefined();
    expect(action.expression).toBe(
      `mp>=150&&${BotVal.EnemyState}!=${StateEnum.Frozen}`
    );
    // 三个方向的射线检测仍然保留
    expect(action.e_ray?.length).toBe(3);
  });
});
