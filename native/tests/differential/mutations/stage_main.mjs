// 切片 4I：`stage/Stage` 的变异名单（subject `stage`，只跑 `cases/stage/stage.txt` —— 那 1045 行
// 全是为这个类写的；`expr` / `bg` / `item` 三个用例的变异在 `mutations/stage.mjs`）。
//
// **有意不覆盖**（都在 DESIGN §75.4）：
//   - `_disposers`：TS 里没有任何 `push` 点（声明了但永远为空）⇒ 摘不掉、也测不到。
//   - `Stage::warn` 的 sink 未安装时（`if (sink)`）无法观察。
//   - `DialogState` 的 `list` 是值拷贝（TS 是 `{...prev, list}`）⇒ 「共享数组」的写法在端口不存在。
//   - `is_nullish(bdt)` 与 `!truthy(bdt)`：`datas.backgrounds.find(v => v.id === bid)` 只会返回
//     **对象**（或 undefined），而对象恒为真值 ⇒ 两种写法在可达输入上等价。
//   - `hp_recovery` 的 `|| 0` 与 `?? 0`：`health_up[diff]` 若是假值（`0` / `""` / `false` / NaN），
//     后续的 `truthy(...)` 与 `to_number(...)` 会把两种写法拉平（`to_number` 的 NaN 也只让
//     `loop_players_fighters` 为假）⇒ 等价。
//   - `hp_recovery_r`：TS 原文就是 `health_up?.[diff] || hp_recovery` ⇒ 与 `hp_recovery` 同源，
//     「不看自己的表」这个变异没有语义差别。
//   - `player_facing` 的 `is_num(...) ? ... : void 0`：`player_f` 只被拿去**严**比较 `1` / `-1`，
//     字符串与 `NaN` 都不会命中 ⇒ 换成 `!is_undefined` 的守卫看不出差别。
//   - `enter_phase` 里 `_phase_idx = idx` 与 `phases()` 的先后：`phases()` 不读 `_phase_idx`
//     ⇒ 两种顺序等价（TS 的 `phases?.[this._phase_idx = idx]` 也是先取 `phases`）。
//   - `spawn_count <= 0` 与 `< 0`：后面还有 `while (spawn_count > 0)` ⇒ `0` 时两边都不刷。
//   - `update` 里 `VOID_STAGE` 的 `==` 与 `===`：两边都是字符串（`id` 由 `|| ""` 得来）
//     ⇒ 松/严相等同真同假。
//   - `update` 里 released 的物件要不要 `update()`：`Item::update` 开头的 `_released` 门
//     让它立刻返回 ⇒ 交换两个分支的副作用不可见。
//   - `kill_*` 的 `e.team === this.team`：`Item::spawn` 里就是 `e.set_team(this.stage.team)`
//     ⇒ 物件刷出来的实体恒等于本队，这个过滤在可达输入上恒真。
export default {
  subject: "stage",
  cases: ["stage"],
  mutations: [
    // ---------------------------------------------------------------- change_bg / 构造
    {
      note: "change_bg：同 id 不早退（照样重建）",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (prev_bg != nullptr) {
    if (strict_equals(field_or(prev_bg->data(), u"id"), field_or(data, u"id"))) return prev_bg;
  }`,
      to: `  if (prev_bg != nullptr) {
    if (!strict_equals(field_or(prev_bg->data(), u"id"), field_or(data, u"id"))) return prev_bg;
  }`,
    },
    {
      note: "change_bg：不 dispose 旧的",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (prev_bg != nullptr) prev_bg->dispose();`,
      to: `  (void)prev_bg;`,
    },
    {
      note: "change_bg：world.stage 那条分支不算数",
      file: "native/lfw/stage/stage.cpp",
      from: `  Stage* const world_stage = _world->stage();
  Background* const curr_bg = world_stage != nullptr ? _world->bg() : nullptr;`,
      to: `  Stage* const world_stage = _world->stage();
  (void)world_stage;
  Background* const curr_bg = nullptr;`,
    },
    {
      note: "change_bg：drink_l 的下界写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  drink_l = -9007199254740991.0;  // \`Number.MIN_SAFE_INTEGER\``,
      to: `  drink_l = 0.0;`,
    },
    {
      note: "change_bg：drink_r 的上界写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  drink_r = 9007199254740991.0;   // \`Number.MAX_SAFE_INTEGER\``,
      to: `  drink_r = 0.0;`,
    },
    {
      note: "change_bg：不写 left 那一串边界",
      file: "native/lfw/stage/stage.cpp",
      from: `  auto bg = std::make_unique<Background>(_world, data);
  left = cam_l = player_l = enemy_l = bg->left();`,
      to: `  auto bg = std::make_unique<Background>(_world, data);
  left = cam_l = player_l = enemy_l = 0.0;`,
    },
    {
      note: "构造：bg 没找到也不 warn",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (!truthy(bdt)) warn(u"Stage::constructor", u"bg not found, id: " + to_string(bid));`,
      to: `  (void)bid;`,
    },
    {
      note: "构造：早退分支不写右边界（enemy_r 用 b->right）",
      file: "native/lfw/stage/stage.cpp",
      from: `  right = cam_r = player_r = enemy_r = b->right();`,
      to: `  right = cam_r = player_r = b->right();
  enemy_r = 0.0;`,
    },
    {
      note: "构造：far 用 near 的值",
      file: "native/lfw/stage/stage.cpp",
      from: `  _near = b->near_plane();
  _far = b->far_plane();`,
      to: `  _near = b->near_plane();
  _far = b->near_plane();`,
    },
    {
      note: "构造：drink_r 不按 bg.width 算",
      file: "native/lfw/stage/stage.cpp",
      from: `  drink_r = _world->bg()->width() + 1200.0;`,
      to: `  drink_r = _world->bg()->width();`,
    },
    {
      note: "构造：next_stage 用 nullish 判定（`next` 为 `\"\"` 也去查）",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (truthy(next)) _next_stage = _lfw->datas_stages_find(next);
  _team = _lfw->new_team();`,
      to: `  if (!is_nullish(next)) _next_stage = _lfw->datas_stages_find(next);
  _team = _lfw->new_team();`,
    },
    {
      note: "构造：team 不取 new_team",
      file: "native/lfw/stage/stage.cpp",
      from: `  _team = _lfw->new_team();`,
      to: `  _team = std::u16string();`,
    },
    // ---------------------------------------------------------------- set_phase
    {
      note: "set_phase：不做同一性早退",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (same_ref(phase, _phase)) return;
  phase_time = 0.0;`,
      to: `  if (false && same_ref(phase, _phase)) return;
  phase_time = 0.0;`,
    },
    {
      note: "set_phase：不重置 phase_time",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (same_ref(phase, _phase)) return;
  phase_time = 0.0;
  phase_end_tester.reset(_lfw->end_testers(phase));`,
      to: `  if (same_ref(phase, _phase)) return;
  phase_end_tester.reset(_lfw->end_testers(phase));`,
    },
    {
      note: "set_phase：不 reset phase_end_tester",
      file: "native/lfw/stage/stage.cpp",
      from: `  phase_end_tester.reset(_lfw->end_testers(phase));`,
      to: `  (void)phase;`,
    },
    {
      note: "set_phase：player_l 复位成 1（不是 0）",
      file: "native/lfw/stage/stage.cpp",
      from: `  player_l = 0.0;
  player_r = _world->bg()->right();
  if (!truthy(phase)) return;`,
      to: `  player_l = 1.0;
  player_r = _world->bg()->right();
  if (!truthy(phase)) return;`,
    },
    {
      note: "set_phase：player_r 复位成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  player_r = _world->bg()->right();
  if (!truthy(phase)) return;`,
      to: `  player_r = 0.0;
  if (!truthy(phase)) return;`,
    },
    {
      note: "set_phase：先 set_phase 再回调（curr/prev 对调）",
      file: "native/lfw/stage/stage.cpp",
      from: `  _callbacks.call(u"on_phase_changed", {StageCallbackArgs{this, _phase, prev}});`,
      to: `  _callbacks.call(u"on_phase_changed", {StageCallbackArgs{this, prev, _phase}});`,
    },
    {
      note: "set_phase：hp_respawn_r 不看 respawn_r 表",
      file: "native/lfw/stage/stage.cpp",
      from: `  const Value hp_respawn_r_v = map_at(respawn_r);
  const double hp_respawn_r = truthy(hp_respawn_r_v) ? to_number(hp_respawn_r_v) : hp_respawn;`,
      to: `  const Value hp_respawn_r_v = map_at(respawn_r);
  (void)hp_respawn_r_v;
  const double hp_respawn_r = hp_respawn;`,
    },
    {
      note: "set_phase：不读 mp_up 表",
      file: "native/lfw/stage/stage.cpp",
      from: `  const double mp_recovery = or_zero(map_at(mp_up));`,
      to: `  (void)mp_up;
  const double mp_recovery = 0.0;`,
    },
    {
      note: "set_phase：_respawn_x 不看 respawn_x 表",
      file: "native/lfw/stage/stage.cpp",
      from: `  const Value _respawn_x = map_at(respawn_x);`,
      to: `  const Value _respawn_x = Value();`,
    },
    {
      note: "set_phase：恢复循环的门用 `&&`（要么都满足才进）",
      file: "native/lfw/stage/stage.cpp",
      from: `  const bool loop_players_fighters =
      truthy(Value(hp_recovery)) || truthy(Value(hp_respawn)) || truthy(Value(mp_recovery));`,
      to: `  const bool loop_players_fighters =
      truthy(Value(hp_recovery)) && truthy(Value(hp_respawn)) && truthy(Value(mp_recovery));`,
    },
    {
      note: "set_phase：puppets 不参与队伍表",
      file: "native/lfw/stage/stage.cpp",
      from: `    std::vector<Value> teams;
    for (Entity* const f : _world->puppet_list()) set_add(teams, Value(f->team()));
    for (Entity* const f : _world->entity_list()) {
      if (!entity::is_fighter(*f) || !set_has(teams, Value(f->team()))) continue;`,
      to: `    std::vector<Value> teams;
    for (Entity* const f : _world->puppet_list()) set_add(teams, Value(f->team()));
    for (Entity* const f : _world->entity_list()) {
      if (!entity::is_fighter(*f)) continue;`,
    },
    {
      note: "set_phase：hp<=0 的门写成 `< 0`",
      file: "native/lfw/stage/stage.cpp",
      from: `      if (f->hp() <= 0.0 && truthy(Value(hp_respawn))) {`,
      to: `      if (f->hp() < 0.0 && truthy(Value(hp_respawn))) {`,
    },
    {
      note: "set_phase：hp>0 的门写成 `>= 0`",
      file: "native/lfw/stage/stage.cpp",
      from: `      } else if (f->hp() > 0.0 && truthy(Value(hp_recovery))) {`,
      to: `      } else if (f->hp() >= 0.0 && truthy(Value(hp_recovery))) {`,
    },
    {
      note: "set_phase：复活的血量不做上限钳制",
      file: "native/lfw/stage/stage.cpp",
      from: `        const double hp = hp_respawn < 1.0 ? lfw::min(f->hp_max() * hp_respawn, f->hp_max())
                                           : lfw::min(hp_respawn, f->hp_max());`,
      to: `        const double hp = hp_respawn < 1.0 ? f->hp_max() * hp_respawn : hp_respawn;`,
    },
    {
      note: "set_phase：恢复的分支用比例写法（丢掉 >= 1 的那一支）",
      file: "native/lfw/stage/stage.cpp",
      from: `        const double hp = hp_recovery < 1.0
                              ? lfw::min(f->hp_r() + (f->hp_max() - f->hp_r()) * hp_recovery,
                                         f->hp_max())
                              : lfw::min(f->hp_r() + hp_recovery, f->hp_max());`,
      to: `        const double hp = lfw::min(f->hp_r() + (f->hp_max() - f->hp_r()) * hp_recovery,
                                   f->hp_max());`,
    },
    {
      note: "set_phase：hp_r 取 min（不是 max）",
      file: "native/lfw/stage/stage.cpp",
      from: `        f->set_hp_r(lfw::max(hp_r, hp));
        if (is_num(_respawn_x))`,
      to: `        f->set_hp_r(lfw::min(hp_r, hp));
        if (is_num(_respawn_x))`,
    },
    {
      note: "set_phase：respawn_x 用真值判定（`0` 也算有）",
      file: "native/lfw/stage/stage.cpp",
      from: `        if (is_num(_respawn_x)) f->set_position(_respawn_x, Value(NullTag{}), Value(NullTag{}));`,
      to: `        if (truthy(_respawn_x)) f->set_position(_respawn_x, Value(NullTag{}), Value(NullTag{}));`,
    },
    {
      note: "set_phase：mp 恢复写成乘法",
      file: "native/lfw/stage/stage.cpp",
      from: `        f->set_mp(lfw::min(f->mp() + mp_recovery, f->mp_max()));`,
      to: `        f->set_mp(lfw::min(f->mp() * mp_recovery, f->mp_max()));`,
    },
    {
      note: "set_phase：不播相位音效",
      file: "native/lfw/stage/stage.cpp",
      from: `  play_phase_sounds();
  const double ce_count = ce();`,
      to: `  const double ce_count = ce();`,
    },
    {
      note: "set_phase：每个 object 各自算一次 ce",
      file: "native/lfw/stage/stage.cpp",
      from: `  const double ce_count = ce();
  const Array* const obj_arr = as_array(objects);
  if (obj_arr != nullptr && obj_arr->size() > 0) {
    for (size_t i = 0; i < obj_arr->size(); ++i) spawn(phase, obj_arr->at(i), ce_count);
  }`,
      to: `  const Array* const obj_arr = as_array(objects);
  if (obj_arr != nullptr && obj_arr->size() > 0) {
    for (size_t i = 0; i < obj_arr->size(); ++i) spawn(phase, obj_arr->at(i), ce());
  }`,
    },
    {
      note: "set_phase：cam_jump_to_x 用真值判定",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (is_num(cam_jump_to_x)) _world->camera_jump_x(cam_jump_to_x);`,
      to: `  if (truthy(cam_jump_to_x)) _world->camera_jump_x(cam_jump_to_x);`,
    },
    {
      note: "set_phase：player_l 的缺省写成 1",
      file: "native/lfw/stage/stage.cpp",
      from: `  player_l = to_number(nullish_or(field_or(phase, u"player_l"), Value(0.0)));
  cam_l = to_number(nullish_or(field_or(phase, u"camera_l"), Value(0.0)));`,
      to: `  player_l = to_number(nullish_or(field_or(phase, u"player_l"), Value(1.0)));
  cam_l = to_number(nullish_or(field_or(phase, u"camera_l"), Value(0.0)));`,
    },
    {
      note: "set_phase：enemy_l 的缺省写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  enemy_l = to_number(nullish_or(field_or(phase, u"enemy_l"), Value(-1200.0)));`,
      to: `  enemy_l = to_number(nullish_or(field_or(phase, u"enemy_l"), Value(0.0)));`,
    },
    {
      note: "set_phase：player_r 不看 bound",
      file: "native/lfw/stage/stage.cpp",
      from: `  auto value_or_bound_or_bg_right = [&](const Value& v) -> Value {
    if (!is_nullish(v)) return v;
    return bound_or_bg_right();
  };`,
      to: `  auto value_or_bound_or_bg_right = [&](const Value& v) -> Value {
    if (!is_nullish(v)) return v;
    return Value(_world->bg()->right());
  };`,
    },
    {
      note: "set_phase：enemy_r 的 +1200 去掉",
      file: "native/lfw/stage/stage.cpp",
      from: `  enemy_r = is_nullish(enemy_r_v)
                ? to_number(bound_or_bg_right()) + 1200.0
                : to_number(enemy_r_v);`,
      to: `  enemy_r = is_nullish(enemy_r_v) ? to_number(bound_or_bg_right()) : to_number(enemy_r_v);`,
    },
    {
      note: "set_phase：drink_r 的 +1200 去掉",
      file: "native/lfw/stage/stage.cpp",
      from: `  drink_r = is_nullish(drink_r_v) ? _world->bg()->right() + 1200.0 : to_number(drink_r_v);`,
      to: `  drink_r = is_nullish(drink_r_v) ? _world->bg()->right() : to_number(drink_r_v);`,
    },
    {
      note: "set_phase：turn 只认 1（丢掉 -1）",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (strict_equals(player_f, Value(1.0)) || strict_equals(player_f, Value(-1.0))) {`,
      to: `    if (strict_equals(player_f, Value(1.0))) {`,
    },
    {
      note: "set_phase：不写 mt 的 mark",
      file: "native/lfw/stage/stage.cpp",
      from: `    _lfw->mt()->mark = u"criminal_respawn";`,
      to: ``,
    },
    {
      note: "set_phase：x 的随机窗口宽度写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `      x = Value(_lfw->mt()->range(
          lfw::max(player_l, to_number(player_x) - 50.0),
          lfw::min(player_r, to_number(player_x) + 50.0)));`,
      to: `      x = Value(_lfw->mt()->range(
          lfw::max(player_l, to_number(player_x)),
          lfw::min(player_r, to_number(player_x))));`,
    },
    {
      note: "set_phase：z 的窗口用 far/near 的 min/max 写反",
      file: "native/lfw/stage/stage.cpp",
      from: `      z = Value(_lfw->mt()->range(lfw::max(_far, to_number(player_z) - 50.0),
                                  lfw::min(_near, to_number(player_z) + 50.0)));`,
      to: `      z = Value(_lfw->mt()->range(lfw::min(_far, to_number(player_z) - 50.0),
                                  lfw::max(_near, to_number(player_z) + 50.0)));`,
    },
    {
      note: "set_phase：set_position 的 y 写成 undefined（不是 null）",
      file: "native/lfw/stage/stage.cpp",
      from: `    e->set_position(x, Value(NullTag{}), z);`,
      to: `    e->set_position(x, Value(), z);`,
    },
    {
      note: "set_phase：dialogs 用 `is_array` 就 push（空数组也推）",
      file: "native/lfw/stage/stage.cpp",
      from: `  const Array* const dialog_arr = as_array(dialogs);
  if (dialog_arr != nullptr && dialog_arr->size() > 0) push_dialogs(dialogs);`,
      to: `  const Array* const dialog_arr = as_array(dialogs);
  if (dialog_arr != nullptr) push_dialogs(dialogs);`,
    },
    // ---------------------------------------------------------------- 音效
    {
      note: "play_phase_sounds：`music !== void 0` 写成真值判定",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (!is_undefined(music)) {
    if (truthy(music)) {`,
      to: `  if (truthy(music)) {
    if (truthy(music)) {`,
    },
    {
      note: "play_phase_sounds：music 为假值时不禁用 stop（不清空）",
      file: "native/lfw/stage/stage.cpp",
      from: `      _stop_bgm = nullptr;
      _lfw->sounds_stop_bgm();`,
      to: `      _lfw->sounds_stop_bgm();`,
    },
    {
      note: "play_phase_sounds：sounds 循环不读 x",
      file: "native/lfw/stage/stage.cpp",
      from: `      _lfw->sounds_play(field_or(s, u"path"), field_or(s, u"x"), field_or(s, u"y"),
                        field_or(s, u"z"));`,
      to: `      _lfw->sounds_play(field_or(s, u"path"), field_or(s, u"y"), field_or(s, u"y"),
                        field_or(s, u"z"));`,
    },
    {
      note: "stop_bgm：不判空直接调",
      file: "native/lfw/stage/stage.cpp",
      from: `void Stage::stop_bgm() {
  if (_stop_bgm) _stop_bgm();
}`,
      to: `void Stage::stop_bgm() {
  _stop_bgm();
}`,
    },
    // ---------------------------------------------------------------- dialogs
    {
      note: "push_dialogs：不追加 more",
      file: "native/lfw/stage/stage.cpp",
      from: `  const Array* const arr = as_array(more);
  if (arr != nullptr) {
    for (size_t i = 0; i < arr->size(); ++i) list.push_back(arr->at(i));
  }`,
      to: `  const Array* const arr = as_array(more);
  (void)arr;`,
    },
    {
      note: "push_dialogs：index < 0 的门写成 <= 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (index < 0.0) {
    index = prev.index + 1.0;
    dialog_time = 0.0;`,
      to: `  if (index <= 0.0) {
    index = prev.index + 1.0;
    dialog_time = 0.0;`,
    },
    {
      note: "push_dialogs：index 直接写 1",
      file: "native/lfw/stage/stage.cpp",
      from: `    index = prev.index + 1.0;
    dialog_time = 0.0;`,
      to: `    index = 1.0;
    dialog_time = 0.0;`,
    },
    {
      note: "push_dialogs：不重置 dialog_time",
      file: "native/lfw/stage/stage.cpp",
      from: `    index = prev.index + 1.0;
    dialog_time = 0.0;`,
      to: `    index = prev.index + 1.0;`,
    },
    {
      note: "push_dialogs：不 reset dialog_end_tester",
      file: "native/lfw/stage/stage.cpp",
      from: `    const size_t at = static_cast<size_t>(index);
    dialog_end_tester.reset(_lfw->end_testers(at < list.size() ? list[at] : Value()));`,
      to: `    const size_t at = static_cast<size_t>(index);
    (void)at;`,
    },
    {
      note: "push_dialogs：回调的 curr/prev 对调",
      file: "native/lfw/stage/stage.cpp",
      from: `  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(_dialogs), dialog_state_value(prev)}});
}

void Stage::next_dialog() {`,
      to: `  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(prev), dialog_state_value(_dialogs)}});
}

void Stage::next_dialog() {`,
    },
    {
      note: "next_dialog：结束判定写成 `>`",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (prev.index >= static_cast<double>(prev.list.size())) return;
  _dialogs = DialogState{prev.index + 1.0, prev.list};`,
      to: `  if (prev.index > static_cast<double>(prev.list.size())) return;
  _dialogs = DialogState{prev.index + 1.0, prev.list};`,
    },
    {
      note: "next_dialog：新 index 写成 1",
      file: "native/lfw/stage/stage.cpp",
      from: `  _dialogs = DialogState{prev.index + 1.0, prev.list};`,
      to: `  _dialogs = DialogState{1.0, prev.list};`,
    },
    {
      note: "next_dialog：不重置 dialog_time",
      file: "native/lfw/stage/stage.cpp",
      from: `  dialog_time = 0.0;
  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(_dialogs), dialog_state_value(prev)}});
}

void Stage::clear_dialogs() {`,
      to: `  _callbacks.call(u"on_dialogs_changed",
                  {StageCallbackArgs{this, dialog_state_value(_dialogs), dialog_state_value(prev)}});
}

void Stage::clear_dialogs() {`,
    },
    {
      note: "clear_dialogs：index 写 0（不是 -1）",
      file: "native/lfw/stage/stage.cpp",
      from: `  _dialogs = DialogState{-1.0, {}};`,
      to: `  _dialogs = DialogState{0.0, {}};`,
    },
    {
      note: "clear_dialogs：清空时保留 list",
      file: "native/lfw/stage/stage.cpp",
      from: `  _dialogs = DialogState{-1.0, {}};`,
      to: `  _dialogs = DialogState{-1.0, _dialogs.list};`,
    },
    // ---------------------------------------------------------------- enter_phase
    {
      note: "enter_phase：不做 `world.stage === this` 守卫",
      file: "native/lfw/stage/stage.cpp",
      from: `void Stage::enter_phase(double idx) {
  if (_world->stage() != this) return;
  _phase_idx = idx;`,
      to: `void Stage::enter_phase(double idx) {
  _phase_idx = idx;`,
    },
    {
      note: "enter_phase：收尾判定用 `>`",
      file: "native/lfw/stage/stage.cpp",
      from: `  _is_stage_finish = phases_arr != nullptr && phases_arr->size() > 0 &&
                     _phase_idx >= static_cast<double>(phases_arr->size());`,
      to: `  _is_stage_finish = phases_arr != nullptr && phases_arr->size() > 0 &&
                     _phase_idx > static_cast<double>(phases_arr->size());`,
    },
    {
      note: "enter_phase：章结束的判定取反",
      file: "native/lfw/stage/stage.cpp",
      from: `  _is_chapter_finish =
      _is_stage_finish && !strict_equals(field_or(_next_stage, u"chapter"), field_or(_data, u"chapter"));`,
      to: `  _is_chapter_finish =
      _is_stage_finish && strict_equals(field_or(_next_stage, u"chapter"), field_or(_data, u"chapter"));`,
    },
    {
      note: "enter_phase：phases 有内容那一半去掉",
      file: "native/lfw/stage/stage.cpp",
      from: `  _is_stage_finish = phases_arr != nullptr && phases_arr->size() > 0 &&
                     _phase_idx >= static_cast<double>(phases_arr->size());`,
      to: `  _is_stage_finish = phases_arr != nullptr &&
                     _phase_idx >= static_cast<double>(phases_arr->size());`,
    },
    // ---------------------------------------------------------------- ce
    {
      note: "ce：puppets 的 ce 缺省写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  for (Entity* const c : _world->puppet_list()) {
    const Value base = field_or(c->data(), u"base");
    const Value ce_v = field_or(base, u"ce");
    count += is_nullish(ce_v) ? 1.0 : to_number(ce_v);
  }`,
      to: `  for (Entity* const c : _world->puppet_list()) {
    const Value base = field_or(c->data(), u"base");
    const Value ce_v = field_or(base, u"ce");
    count += is_nullish(ce_v) ? 0.0 : to_number(ce_v);
  }`,
    },
    {
      note: "ce：`if (!count)` 的反向（有 count 也去累加实体）",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (!truthy(Value(count))) {
    for (Entity* const e : _world->entity_list()) {`,
      to: `  if (truthy(Value(count))) {
    for (Entity* const e : _world->entity_list()) {`,
    },
    {
      note: "ce：count 为 0 时不兜底成 1",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (!truthy(Value(count))) count = 1.0;`,
      to: `  (void)0;`,
    },
    {
      note: "ce：Crazy 不翻倍",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (strict_equals(difficulty, Value(static_cast<double>(Difficulty::Crazy)))) count *= 2.0;`,
      to: `  (void)difficulty;`,
    },
    {
      note: "ce：只看 Team_1 那条去掉",
      file: "native/lfw/stage/stage.cpp",
      from: `      if (!strict_equals(Value(e->team()), Value(std::u16string(team_enum::kTeam_1)))) continue;`,
      to: `      (void)e;`,
    },
    {
      note: "ce：不判 mounted",
      file: "native/lfw/stage/stage.cpp",
      from: `      if (!entity::is_fighter(*e) || !truthy(Value(e->mounted())) || e->hp() <= 0.0) {`,
      to: `      if (!entity::is_fighter(*e) || e->hp() <= 0.0) {`,
    },
    // ---------------------------------------------------------------- spawn
    {
      note: "spawn：不做 `world.stage === this` 守卫",
      file: "native/lfw/stage/stage.cpp",
      from: `void Stage::spawn(const Value& phase, const Value& obj, double count) {
  if (_world->stage() != this) return;
  const Value ratio = field_or(obj, u"ratio");`,
      to: `void Stage::spawn(const Value& phase, const Value& obj, double count) {
  const Value ratio = field_or(obj, u"ratio");`,
    },
    {
      note: "spawn：times 的默认值写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  const Value times = is_undefined(times_v) ? Value(1.0) : times_v;`,
      to: `  const Value times = is_undefined(times_v) ? Value(0.0) : times_v;`,
    },
    {
      note: "spawn：ratio 用 nullish 判定（`null` 也当没给）",
      file: "native/lfw/stage/stage.cpp",
      from: `  double spawn_count =
      is_undefined(ratio) ? 1.0 : floor(round_float(count * to_number(ratio), 10.0));`,
      to: `  double spawn_count =
      is_nullish(ratio) ? 1.0 : floor(round_float(count * to_number(ratio), 10.0));`,
    },
    {
      note: "spawn：round_float 的乘数写成 1000（默认）",
      file: "native/lfw/stage/stage.cpp",
      from: `      is_undefined(ratio) ? 1.0 : floor(round_float(count * to_number(ratio), 10.0));`,
      to: `      is_undefined(ratio) ? 1.0 : floor(round_float(count * to_number(ratio), 1000.0));`,
    },
    {
      note: "spawn：不判 times 的真假",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (spawn_count <= 0.0 || !truthy(times)) return;`,
      to: `  if (spawn_count <= 0.0) return;`,
    },
    {
      note: "spawn：不调 item->spawn()",
      file: "native/lfw/stage/stage.cpp",
      from: `    std::unique_ptr<Item> item = std::make_unique<Item>(this, phase, obj);
    item->spawn();
    items.push_back(std::move(item));`,
      to: `    std::unique_ptr<Item> item = std::make_unique<Item>(this, phase, obj);
    items.push_back(std::move(item));`,
    },
    // ---------------------------------------------------------------- kill_*
    {
      note: "kill_soliders：is_soldier 判定取反",
      file: "native/lfw/stage/stage.cpp",
      from: `void Stage::kill_soliders() {
  for (const std::unique_ptr<Item>& o : items) {
    if (!truthy(field_or(o->info(), u"is_soldier"))) continue;`,
      to: `void Stage::kill_soliders() {
  for (const std::unique_ptr<Item>& o : items) {
    if (truthy(field_or(o->info(), u"is_soldier"))) continue;`,
    },
    {
      note: "kill_boss：不判 is_boss",
      file: "native/lfw/stage/stage.cpp",
      from: `void Stage::kill_boss() {
  for (const std::unique_ptr<Item>& o : items) {
    if (!truthy(field_or(o->info(), u"is_boss"))) continue;`,
      to: `void Stage::kill_boss() {
  for (const std::unique_ptr<Item>& o : items) {
    (void)o;`,
    },
    {
      note: "kill_others：跳过 boss 的条件去掉",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (truthy(field_or(o->info(), u"is_boss")) || truthy(field_or(o->info(), u"is_soldier"))) {
      continue;
    }`,
      to: `    if (truthy(field_or(o->info(), u"is_soldier"))) {
      continue;
    }`,
    },
    {
      note: "kill_*：血量写 1（不是 0）",
      file: "native/lfw/stage/stage.cpp",
      from: `      if (entity::is_fighter(*e) && strict_equals(Value(e->team()), Value(_team))) e->set_hp(0.0);
    }
  }
}

void Stage::kill_soliders() {`,
      to: `      if (entity::is_fighter(*e) && strict_equals(Value(e->team()), Value(_team))) e->set_hp(1.0);
    }
  }
}

void Stage::kill_soliders() {`,
    },
    // ---------------------------------------------------------------- dispose
    {
      note: "dispose：不 release 物件",
      file: "native/lfw/stage/stage.cpp",
      from: `  for (const std::unique_ptr<Item>& item : items) item->release();`,
      to: `  (void)0;`,
    },
    {
      note: "dispose：玩家队伍的角色也删",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (entity::is_fighter(*e) && set_has(player_teams, Value(e->team()))) continue;`,
      to: `    if (false) continue;`,
    },
    {
      note: "dispose：玩家持有的武器也删",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (entity::is_weapon(*e) && e->bearer != nullptr &&
        set_has(player_teams, Value(e->bearer->team()))) {
      continue;
    }`,
      to: `    (void)0;`,
    },
    {
      note: "dispose：不清空 callbacks",
      file: "native/lfw/stage/stage.cpp",
      from: `  _world->del_entities(temp);
  _callbacks.clear();`,
      to: `  _world->del_entities(temp);`,
    },
    // ---------------------------------------------------------------- 死绝判定
    {
      note: "all_boss_dead：不判 is_boss",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (!item->is_fighter()) continue;
    if (!truthy(field_or(item->info(), u"is_boss"))) continue;`,
      to: `    if (!item->is_fighter()) continue;`,
    },
    {
      note: "all_boss_dead：objects 非空时算死",
      file: "native/lfw/stage/stage.cpp",
      from: `bool Stage::all_boss_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;
    if (!truthy(field_or(item->info(), u"is_boss"))) continue;
    if (!item->objects().empty()) return false;`,
      to: `bool Stage::all_boss_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;
    if (!truthy(field_or(item->info(), u"is_boss"))) continue;
    if (item->objects().empty()) return false;`,
    },
    {
      note: "all_fighter_dead：不判 released",
      file: "native/lfw/stage/stage.cpp",
      from: `bool Stage::all_fighter_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;
    if (!item->objects().empty()) return false;
    if (!item->released()) return false;
  }`,
      to: `bool Stage::all_fighter_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;
    if (!item->objects().empty()) return false;
  }`,
    },
    {
      note: "all_fighter_dead：不判 is_fighter",
      file: "native/lfw/stage/stage.cpp",
      from: `bool Stage::all_fighter_dead() {
  for (const std::unique_ptr<Item>& item : items) {
    if (!item->is_fighter()) continue;`,
      to: `bool Stage::all_fighter_dead() {
  for (const std::unique_ptr<Item>& item : items) {`,
    },
    // ---------------------------------------------------------------- 结束判定
    {
      note: "dialog_cleared：`index >= length` 写成 `>`",
      file: "native/lfw/stage/stage.cpp",
      from: `  return _dialogs.list.size() <= 0 ||
         _dialogs.index >= static_cast<double>(_dialogs.list.size());`,
      to: `  return _dialogs.list.size() <= 0 ||
         _dialogs.index > static_cast<double>(_dialogs.list.size());`,
    },
    {
      note: "is_phase_end：有 testers 就短路（不跑 flow）",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (!phase_end_tester.list().empty()) return phase_end_tester.flow(*this);
  return all_fighter_dead() && dialog_cleared();`,
      to: `  if (!phase_end_tester.list().empty()) return true;
  return all_fighter_dead() && dialog_cleared();`,
    },
    {
      note: "is_phase_end：两条件的 `&&` 写成 `||`",
      file: "native/lfw/stage/stage.cpp",
      from: `  return all_fighter_dead() && dialog_cleared();`,
      to: `  return all_fighter_dead() || dialog_cleared();`,
    },
    {
      note: "is_dialog_end：用 phase_end_tester",
      file: "native/lfw/stage/stage.cpp",
      from: `bool Stage::is_dialog_end() { return dialog_end_tester.flow(*this); }`,
      to: `bool Stage::is_dialog_end() { return phase_end_tester.flow(*this); }`,
    },
    {
      note: "check_phase_end：结束也不切相位",
      file: "native/lfw/stage/stage.cpp",
      from: `bool Stage::check_phase_end() {
  const bool ret = is_phase_end();
  if (!ret) return ret;
  enter_phase(phase_idx() + 1.0);
  return ret;
}`,
      to: `bool Stage::check_phase_end() {
  const bool ret = is_phase_end();
  if (!ret) return ret;
  return ret;
}`,
    },
    {
      note: "check_dialog_end：结束也不推对话",
      file: "native/lfw/stage/stage.cpp",
      from: `bool Stage::check_dialog_end() {
  const bool ret = is_dialog_end();
  if (!ret) return ret;
  next_dialog();
  return ret;
}`,
      to: `bool Stage::check_dialog_end() {
  const bool ret = is_dialog_end();
  if (!ret) return ret;
  return ret;
}`,
    },
    {
      note: "should_goto_next_stage：守卫的 `||` 写成 `&&`",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (is_chapter_finish() || !is_stage_finish()) return false;`,
      to: `  if (is_chapter_finish() && !is_stage_finish()) return false;`,
    },
    {
      note: "should_goto_next_stage：不跳过无血的",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (e->hp() <= 0.0) continue;                   // 无血，不判断`,
      to: `    if (false) continue;`,
    },
    {
      note: "should_goto_next_stage：右边界比较用 `>`",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (e->position.x >= cam_r) continue;           // 已达右侧，不判断`,
      to: `    if (e->position.x > cam_r) continue;`,
    },
    {
      note: "should_goto_next_stage：不跳过 Bot",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (entity::is_bot_ctrl(ctrl)) continue;       // Bot 不判断
    if (_lfw->players_has(field_or(ctrl, u"player_id"))) return false;`,
      to: `    if (_lfw->players_has(field_or(ctrl, u"player_id"))) return false;`,
    },
    {
      note: "should_goto_next_stage：玩家的判定取反",
      file: "native/lfw/stage/stage.cpp",
      from: `    if (_lfw->players_has(field_or(ctrl, u"player_id"))) return false;`,
      to: `    if (!_lfw->players_has(field_or(ctrl, u"player_id"))) return false;`,
    },
    // ---------------------------------------------------------------- update
    {
      note: "update：不累加 phase_time",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (truthy(_phase)) ++phase_time;
  if (truthy(dialog())) ++dialog_time;
  _fsm.update(1.0);`,
      to: `  if (truthy(_phase)) ++dialog_time;
  if (truthy(dialog())) ++dialog_time;
  _fsm.update(1.0);`,
    },
    {
      note: "update：fsm 的 dt 写成 0",
      file: "native/lfw/stage/stage.cpp",
      from: `  _fsm.update(1.0);`,
      to: `  _fsm.update(0.0);`,
    },
    {
      note: "update：VOID_STAGE 的早退去掉",
      file: "native/lfw/stage/stage.cpp",
      from: `  if (equals(Value(id()), void_id)) return;`,
      to: `  if (false && equals(Value(id()), void_id)) return;`,
    },
    {
      note: "update：出列后不从 items 里删",
      file: "native/lfw/stage/stage.cpp",
      from: `  for (Item* const v : _released_items) {
    for (size_t i = 0; i < items.size(); ++i) {
      if (items[i].get() == v) {
        items.erase(items.begin() + static_cast<std::ptrdiff_t>(i));
        break;
      }
    }
  }`,
      to: `  for (Item* const v : _released_items) {
    (void)v;
  }`,
    },
    {
      note: "update：不调 check_phase_end",
      file: "native/lfw/stage/stage.cpp",
      from: `  check_phase_end();
  check_dialog_end();
}`,
      to: `  check_dialog_end();
}`,
    },
    // ---------------------------------------------------------------- 宿主转发
    {
      note: "Item 宿主转发：far/near 互换",
      file: "native/lfw/stage/stage.h",
      from: `  virtual double far_plane() const { return _far; }
  virtual double near_plane() const { return _near; }`,
      to: `  virtual double far_plane() const { return _near; }
  virtual double near_plane() const { return _far; }`,
    },
    {
      note: "Item 宿主转发：team 返回空",
      file: "native/lfw/stage/stage.h",
      from: `  virtual Value team() const { return Value(_team); }`,
      to: `  virtual Value team() const { return Value(std::u16string()); }`,
    },
    // ---------------------------------------------------------------- 顶层 getter
    {
      note: "title：`??` 写成 `||`（空串也要回退）",
      file: "native/lfw/stage/stage.cpp",
      from: `  const Value t = field_or(_data, u"title");
  if (!is_nullish(t)) return t;
  return _world->bg()->name();  // \`this.bg.name\``,
      to: `  const Value t = field_or(_data, u"title");
  if (truthy(t)) return t;
  return _world->bg()->name();  // \`this.bg.name\``,
    },
    {
      note: "id：`|| \"\"` 写成 `?? \"\"`",
      file: "native/lfw/stage/stage.cpp",
      from: `std::u16string Stage::id() const { return name_of(_data, u"id"); }`,
      to: `std::u16string Stage::id() const {
  const Value v = field_or(_data, u"id");
  return is_nullish(v) ? std::u16string() : to_string(v);
}`,
    },
    {
      note: "dialog：越界时不返回 undefined（回绕到 0）",
      file: "native/lfw/stage/stage.cpp",
      from: `  const size_t idx = static_cast<size_t>(_dialogs.index);
  if (idx >= _dialogs.list.size()) return Value();
  return _dialogs.list[idx];`,
      to: `  const size_t idx = static_cast<size_t>(_dialogs.index);
  if (idx >= _dialogs.list.size()) return _dialogs.list[0];
  return _dialogs.list[idx];`,
    },
  ],
};
