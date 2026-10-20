// bot 变异规格（`bot/` 切片：`BotController` + `bot/state/*` + `get_val_from_bot_ctrl`）。
//
// 见 `bot.cpp` 台面顶部的约定：`me`/`fx` 场景 + `CtrlEnv` 缝。用例：
//   basic（Idle 初始化 + 抽签）、targets（should_* / lookup / 区间）、actions（handle_action +
//   bot_val 词表）、fsm（六状态迁移）、update（check_bot / 数据集 / update 全流程）、
//   state_keys（各状态 update 的按键流）、dummy_queue（`set dummy` 的 Object.values 队列）。
//
// 不可变异类（记录，不计入）：
//   1. `bot_dataset.cpp` 的 `Default()` 里 `switch`/`set` 的**顺序**：`Object.assign` 语义
//      只按 key 写值，条目顺序影响不到任何观测（`ds` 按名字读）。
//   2. `get_val_from_bot_ctrl` 里 `val_bot_state` 的 `st != nullptr` 守卫：FSM 一旦 reset 就
//      有状态，`''` 分支在台面到不了。
//   3. `val_entity_fallback` 的末行 `return Value(word);`（缝没绑时的回落）：台面总把
//      `CtrlEnv::entity_val` 绑上（带 `hp`/`x`/`y`/`z` 等仿词），该行到不了。
export default {
  subject: "bot",
  mutations: [
    {
      note: "desire 下界 0 变成 1",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  return m->range(0, defines::num(u"Defines.MAX_AI_DESIRE"));`,
      to: `  return m->range(1, defines::num(u"Defines.MAX_AI_DESIRE"));`,
    },
    {
      note: "lock_when_stand_and_rest 的 x 用 bg_far",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `      e->set_position(Value(e->bg_width / 2), Value(NullTag{}),`,
      to: `      e->set_position(Value(e->bg_far / 2), Value(NullTag{}),`,
    },
    {
      note: "lock_when_stand_and_rest 的 z 用 bg_far（丢掉 stage.far）",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `                      Value((e->bg_near + stage_far()) / 2));`,
      to: `                      Value((e->bg_near + e->bg_far) / 2));`,
    },
    {
      note: "lock_when_stand_and_rest 的 resting 判定 <= 变 <",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  if (frame_state_is(*e, StateEnum::Standing) && e->resting <= 0) {`,
      to: `  if (frame_state_is(*e, StateEnum::Standing) && e->resting < 0) {`,
    },
    {
      note: "should_chase 的 catching 直通变成恒 false",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  if (e->catching != nullptr) return e->catching == &e_handle;`,
      to: `  if (e->catching != nullptr) return false;`,
    },
    {
      note: "w_atk_m_x 误读 w_atk_r_x（持握物数据字段串了）",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `    v = field_or(field_or(field_or(ref_of(*e->holding), u"data"), u"base"), u"w_atk_m_x");`,
      to: `    v = field_or(field_or(field_or(ref_of(*e->holding), u"data"), u"base"), u"w_atk_r_x");`,
    },
    {
      note: "should_chase 的 catching 直通变成恒 true",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  if (e->catching != nullptr) return e->catching == &e_handle;`,
      to: `  if (e->catching != nullptr) return true;`,
    },
    {
      note: "handle_action 的 desire 比较方向反了",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  if (!truthy(Value(desire_v)) || action_desire_v > desire_v) return Value(false);`,
      to: `  if (!truthy(Value(desire_v)) || action_desire_v < desire_v) return Value(false);`,
    },
    {
      note: "handle_action 的 F/B 映射左右互换",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `        out.push_back(Value(std::u16string(facing() > 0 ? u"R" : u"L")));`,
      to: `        out.push_back(Value(std::u16string(facing() > 0 ? u"L" : u"R")));`,
    },
    {
      note: "handle_action 只映射 F、漏掉 B",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `      if (s == u"F" || s == u"B") {`,
      to: `      if (s == u"F") {`,
    },
    {
      note: "handle_action 的 mark 回落丢掉 frame",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  const Value mark_part = keys_is_array ? Value(join_commas(keys_v)) : frame;`,
      to: `  const Value mark_part = keys_is_array ? Value(join_commas(keys_v)) : Value(std::u16string(u"f"));`,
    },
    {
      note: "update 的 bot_target 前缀不做一元 +（丢掉 \"0\"/\"NaN\" 前缀）",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `    std::u16string msg = to_string(Value(to_number(Value(a_str))));`,
      to: `    std::u16string msg = a_str;`,
    },
    {
      note: "update 里 chasings.del 的条件丢掉了取反",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `      chasings.del([this](const Entity& t) { return !should_chase(t); });`,
      to: `      chasings.del([this](const Entity& t) { return should_chase(t); });`,
    },
    {
      note: "update 的 bot_keys 队列判定反了",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  if (m != nullptr && m->debugging && !queue.empty()) {`,
      to: `  if (m != nullptr && m->debugging && queue.empty()) {`,
    },
    {
      note: "_false 的载荷写成 ret=true",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `    all.push_back(Value(u"ret=false"));`,
      to: `    all.push_back(Value(u"ret=true"));`,
    },
    {
      note: "set_dummy 用了 AGK（7 项）而不是 Object.values（14 项）",
      file: "native/lfw/bot/bot_controller.cpp",
      from: `  for (const char16_t* k : lfw::object_values_game_keys()) all.emplace_back(k);`,
      to: `  for (const char16_t* k : lfw::all_game_keys()) all.emplace_back(k);`,
    },
    {
      note: "bot_val desire 的 mark 写错",
      file: "native/lfw/loader/get_val_from_bot_ctrl.cpp",
      from: `  return Value(c.desire(u"bot_val"));`,
      to: `  return Value(c.desire(u"bot_val2"));`,
    },
    {
      note: "enemy_diff_x 的差用 enemy 的 y 做减数",
      file: "native/lfw/loader/get_val_from_bot_ctrl.cpp",
      from: `               (to_number(field_or(field_or(en, u"position"), u"x")) - env_px(c)));`,
      to: `               (to_number(field_or(field_or(en, u"position"), u"x")) - env_py(c)));`,
    },
    {
      note: "enemy_out_of_range 的 0/1 反了",
      file: "native/lfw/loader/get_val_from_bot_ctrl.cpp",
      from: `  return Value(c.en_out_of_range ? 1.0 : 0.0);`,
      to: `  return Value(c.en_out_of_range ? 0.0 : 1.0);`,
    },
    {
      note: "safe 的最终返回值 1 改成 0",
      file: "native/lfw/loader/get_val_from_bot_ctrl.cpp",
      from: `  return Value(1.0);`,
      to: `  return Value(0.0);`,
    },
    {
      note: "Idle 初始化 idle_min_x 的范围参数调头",
      file: "native/lfw/bot/state/bot_state_idle.cpp",
      from: `    c.idle_min_x = round(m->range(player_l, midx));`,
      to: `    c.idle_min_x = round(m->range(midx, player_l));`,
    },
    {
      note: "Idle 初始化 idle_min_z 用了 near",
      file: "native/lfw/bot/state/bot_state_idle.cpp",
      from: `    c.idle_min_z = round(m->range(far_v, midz));`,
      to: `    c.idle_min_z = round(m->range(near_v, midz));`,
    },
    {
      note: "Idle 的右越界分支条件写成了左越界",
      file: "native/lfw/bot/state/bot_state_idle.cpp",
      from: `  } else if (my_x > c.idle_max_x) {`,
      to: `  } else if (my_x < c.idle_min_x) {`,
    },
    {
      note: "Chasing 的随机跳条件丢掉了 !",
      file: "native/lfw/bot/state/bot_state_chasing.cpp",
      from: `  if ((!x_ok || !z_ok) &&`,
      to: `  if ((x_ok || z_ok) &&`,
    },
    {
      note: "数据集默认 r_stop_desire 10 改 11",
      file: "native/lfw/bot/bot_dataset.cpp",
      from: `  o.set(u"r_stop_desire", Value(10.0));`,
      to: `  o.set(u"r_stop_desire", Value(11.0));`,
    },
    {
      note: "数据集默认 r_x_min 100 改 101",
      file: "native/lfw/bot/bot_dataset.cpp",
      from: `  o.set(u"r_x_min", Value(100.0));`,
      to: `  o.set(u"r_x_min", Value(101.0));`,
    },
    {
      note: "数据集默认 defend_desire_step 1800 改回 2500（TS 4d209569b 降过一次）",
      file: "native/lfw/bot/bot_dataset.cpp",
      from: `  o.set(u"defend_desire_step", Value(1800.0));`,
      to: `  o.set(u"defend_desire_step", Value(2500.0));`,
    },
  ],
};
