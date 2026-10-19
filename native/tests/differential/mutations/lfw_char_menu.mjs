export default {
  subject: "lfw",
  cases: ["char_menu"],
  mutations: [

    // ============================ CharMenuLogic 基础 ============================
    { note: "状态名 Player 拼错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    case CharMenuState::PlayerSel: return u"Player";`,
      to: `    case CharMenuState::PlayerSel: return u"Player1";` },
    { note: "状态名 ComNumberSel 缩写错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    case CharMenuState::ComNumSel: return u"ComNumberSel";`,
      to: `    case CharMenuState::ComNumSel: return u"ComNumber";` },
    { note: "状态名 Computer 拼错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    case CharMenuState::ComSel: return u"Computer";`,
      to: `    case CharMenuState::ComSel: return u"Computers";` },
    { note: "状态名 GameSetting 拼错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    case CharMenuState::GameSetting: return u"GameSetting";`,
      to: `    case CharMenuState::GameSetting: return u"GameSettings";` },
    { note: "默认队伍表键名错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  const Value* const v = defines::find(u"Defines.Teams");`,
      to: `  const Value* const v = defines::find(u"Defines.Teams2");` },
    { note: "max_player 缺省 8→9", file: "native/lfw/ui/component/char_menu.cpp",
      from: `double CharMenuLogic::max_player() { return prop_num(props_holder, u"max_player").value_or(8.0); }`,
      to: `double CharMenuLogic::max_player() { return prop_num(props_holder, u"max_player").value_or(9.0); }` },
    { note: "min_player 缺省 8→7", file: "native/lfw/ui/component/char_menu.cpp",
      from: `double CharMenuLogic::min_player() { return prop_num(props_holder, u"min_player").value_or(8.0); }`,
      to: `double CharMenuLogic::min_player() { return prop_num(props_holder, u"min_player").value_or(7.0); }` },
    { note: "max_coms 下限 0→1", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  return max(0.0, max_player() - static_cast<double>(players.size()));`,
      to: `  return max(1.0, max_player() - static_cast<double>(players.size()));` },
    { note: "min_coms 差号反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  return max(0.0, min_player() - static_cast<double>(players.size()));`,
      to: `  return max(0.0, min_player() + static_cast<double>(players.size()));` },
    { note: "teams 缺省不吃默认表", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  const Array* const arr = as_array(v);
  if (arr == nullptr) return default_teams();`,
      to: `  const Array* const arr = as_array(v);
  if (arr == nullptr) return std::vector<std::u16string>();` },
    { note: "oids 空名单仍过滤", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (!allowed.has_value() || allowed->empty()) return list;`,
      to: `  if (!allowed.has_value() && allowed->empty()) return list;` },
    { note: "oids 命中判定取反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      if (o == s) {
        ret.push_back(v);`,
      to: `      if (o != s) {
        ret.push_back(v);` },
    { note: "随机池分组 1000→1001", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      filter_oids(lfw().datas().get_fighters_of_group(u"1000"));`,
      to: `      filter_oids(lfw().datas().get_fighters_of_group(u"1001"));` },
    { note: "随机池记的斗士数 +1", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  _randoming_fighters = lfw().datas().fighters().size();`,
      to: `  _randoming_fighters = lfw().datas().fighters().size() + 1;` },
    { note: "ensure_randoming 判等反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (_randoming_fighters == lfw().datas().fighters().size()) return;`,
      to: `  if (_randoming_fighters != lfw().datas().fighters().size()) return;` },
    { note: "group_has 判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (equals(arr->at(i), Value(std::u16string(group)))) return true;`,
      to: `    if (!equals(arr->at(i), Value(std::u16string(group)))) return true;` },
    { note: "cheat_0 绑到 GIM_INK", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  const bool cheat_0 = lfw().is_cheat(u"LF2_NET");`,
      to: `  const bool cheat_0 = lfw().is_cheat(u"GIM_INK");` },
    { note: "hidden 分组过滤丢非", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (!cheat_0 && group_has(v, entity_group::kHidden)) continue;`,
      to: `    if (cheat_0 && group_has(v, entity_group::kHidden)) continue;` },
    { note: "Dev 分组过滤丢非", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (!cheat_1 && group_has(v, entity_group::kDev)) continue;`,
      to: `    if (cheat_1 && group_has(v, entity_group::kDev)) continue;` },

    // ============================ 广播订阅 ============================
    { note: "reset_gpl 消息名错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        if (message == u"reset_gpl") {`,
      to: `        if (message == u"reset_gpl2") {` },
    { note: "update_random 消息名错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        if (message == u"update_random") {`,
      to: `        if (message == u"update_random2") {` },
    { note: "pick_prev 消息名错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        if (message == u"char_menu_pick_prev") {`,
      to: `        if (message == u"char_menu_pick_previous") {` },
    { note: "pick_prev_ 后缀截短", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        if (has_prefix(message, u"char_menu_pick_prev_")) {
          const double idx = to_number(Value(message.substr(20)));`,
      to: `        if (has_prefix(message, u"char_menu_pick_prev_")) {
          const double idx = to_number(Value(message.substr(19)));` },
    { note: "pick_next_ 方向反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        if (has_prefix(message, u"char_menu_pick_next_")) {
          const double idx = to_number(Value(message.substr(20)));
          pick_lr(1.0, idx - 1.0);`,
      to: `        if (has_prefix(message, u"char_menu_pick_next_")) {
          const double idx = to_number(Value(message.substr(20)));
          pick_lr(-1.0, idx - 1.0);` },

    // ============================ on_start / 槽位装配 ============================
    { note: "槽位数取 min", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  const size_t len = std::max({heads.size(), p_nam.size(), f_nam.size(), t_nam.size()});`,
      to: `  const size_t len = std::min({heads.size(), p_nam.size(), f_nam.size(), t_nam.size()});` },
    { note: "auto_join 首个非 COM 判反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  for (const std::pair<PlayerInfo*, SlotState>& kv : players) {
    if (!kv.first->is_com()) return;
  }`,
      to: `  for (const std::pair<PlayerInfo*, SlotState>& kv : players) {
    if (kv.first->is_com()) return;
  }` },
    { note: "on_resume 不自动加入", file: "native/lfw/ui/component/char_menu.cpp",
      from: `void CharMenuLogic::on_resume() {
  UIComponent::on_resume();
  if (prop_bool(props_holder, u"auto_join")) do_auto_join();
}`,
      to: `void CharMenuLogic::on_resume() {
  UIComponent::on_resume();
}` },
    { note: "reset 不清 prev", file: "native/lfw/ui/component/char_menu.cpp",
      from: `void CharMenuLogic::reset() {
  prev_players.clear();`,
      to: `void CharMenuLogic::reset() {
  (void)0;` },
    { note: "update_random 只更新非随机", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  for (std::pair<PlayerInfo*, SlotState>& kv : players) {
    if (!kv.second.random) continue;
    kv.second.fighter = randoming_next();`,
      to: `  for (std::pair<PlayerInfo*, SlotState>& kv : players) {
    if (kv.second.random) continue;
    kv.second.fighter = randoming_next();` },
    { note: "cancel 回退步进错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (state == nullptr) return;
  state->step = SlotStep::FighterSel;
  lfw().host().sounds_play_preset(Value(u"cancel"), Value(), Value(), Value());`,
      to: `  if (state == nullptr) return;
  state->step = SlotStep::TeamSel;
  lfw().host().sounds_play_preset(Value(u"cancel"), Value(), Value(), Value());` },

    // ============================ update_slots ============================
    { note: "random_confirm 绑到选角态", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      strict_equals(_fsm.state()->key(), Value(char_menu_state_str(CharMenuState::GameSetting)));`,
      to: `      strict_equals(_fsm.state()->key(), Value(char_menu_state_str(CharMenuState::PlayerSel)));` },
    { note: "空槽判定 >= 放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (i >= players.size()) {
      if (s.head != nullptr) s.head->quit();`,
      to: `    if (i >= players.size() + 1) {
      if (s.head != nullptr) s.head->quit();` },
    { note: "随机头像用别人图", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      if (state.random && !random_confirm) {
        s.head->join(std::u16string(built_in_imgs::kRFACE));`,
      to: `      if (state.random && !random_confirm) {
        s.head->join(std::u16string(u"sprite/MENU_BACK0.png"));` },
    { note: "头像回退判空反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        s.head->join(head != nullptr && !is_nullish(*head)
                         ? to_string(*head)
                         : std::u16string(built_in_imgs::kRFACE));`,
      to: `        s.head->join(head != nullptr && is_nullish(*head)
                         ? to_string(*head)
                         : std::u16string(built_in_imgs::kRFACE));` },
    { note: "decided 阈值 >= 放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      const bool decided = state.step > SlotStep::FighterSel;`,
      to: `      const bool decided = state.step >= SlotStep::FighterSel;` },
    { note: "无名斗士回退反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        s.fighter_name->join(truthy(txt) ? to_string(txt) : std::u16string(u"noname"), is_com,`,
      to: `        s.fighter_name->join(!truthy(txt) ? to_string(txt) : std::u16string(u"noname"), is_com,` },
    { note: "队伍名步进 >= 收紧", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      if (state.step >= SlotStep::TeamSel) {`,
      to: `      if (state.step > SlotStep::TeamSel) {` },
    { note: "队伍键判空反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `            i18n != nullptr && !is_nullish(*i18n) ? to_string(*i18n) : state.team;`,
      to: `            i18n != nullptr && is_nullish(*i18n) ? to_string(*i18n) : state.team;` },
    { note: "队伍名 decided >= 放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        s.team_name->join(to_string(lfw().string(Value(key))), is_com,
                          state.step > SlotStep::TeamSel);`,
      to: `        s.team_name->join(to_string(lfw().string(Value(key))), is_com,
                          state.step >= SlotStep::TeamSel);` },

    // ============================ press_a / press_j / press_lr / press_u ============================
    { note: "press_a 满员判定放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (state == nullptr && max_player() <= static_cast<double>(players.size())) return;`,
      to: `  if (state == nullptr && max_player() < static_cast<double>(players.size())) return;` },
    { note: "press_a 单人队伍不直达 Ready", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (state->step == SlotStep::FighterSel && teams().size() <= 1) {`,
      to: `    if (state->step == SlotStep::FighterSel && teams().size() < 1) {` },
    { note: "press_a 步进用 max", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      const double next = std::min(static_cast<double>(state->step) + 1.0,`,
      to: `      const double next = std::max(static_cast<double>(state->step) + 1.0,` },
    { note: "press_a 音效用 cancel", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  lfw().host().sounds_play_preset(Value(u"join"), Value(), Value(), Value());`,
      to: `  lfw().host().sounds_play_preset(Value(u"cancel"), Value(), Value(), Value());` },
    { note: "press_j 弹页 min_pages 2", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (state == nullptr) {
    if (is_player_sel()) {
      UIPopPageOpts opts;
      opts.min_pages = 1.0;`,
      to: `  if (state == nullptr) {
    if (is_player_sel()) {
      UIPopPageOpts opts;
      opts.min_pages = 2.0;` },
    { note: "auto_join 跳跃弹页 min_pages 2", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      lfw().host().sounds_play_preset(Value(u"cancel"), Value(), Value(), Value());
      UIPopPageOpts opts;
      opts.min_pages = 1.0;
      node.pop_page(opts);`,
      to: `      lfw().host().sounds_play_preset(Value(u"cancel"), Value(), Value(), Value());
      UIPopPageOpts opts;
      opts.min_pages = 2.0;
      node.pop_page(opts);` },
    { note: "press_j 取消门槛 <= 收紧", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  } else if (state->step <= SlotStep::FighterSel) {`,
      to: `  } else if (state->step < SlotStep::FighterSel) {` },
    { note: "press_j 退步用 min", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    const double next = std::max(static_cast<double>(state->step) - 1.0,`,
      to: `    const double next = std::min(static_cast<double>(state->step) - 1.0,` },
    { note: "press_lr 首尾取反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      state->fighter = dir < 0 ? list[list.size() - 1] : list[0];`,
      to: `      state->fighter = dir < 0 ? list[0] : list[list.size() - 1];` },
    { note: "press_lr 边界 <= 收紧", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      if (next_idx >= 0 && next_idx <= static_cast<double>(list.size()) - 1) {`,
      to: `      if (next_idx >= 0 && next_idx < static_cast<double>(list.size()) - 1) {` },
    { note: "press_lr 队伍环绕方向反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    const double next_idx = std::fmod(len + idx + dir, len);`,
      to: `    const double next_idx = std::fmod(len + idx - dir, len);` },
    { note: "pick_lr 首个非 COM 判反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    for (const std::pair<PlayerInfo*, SlotState>& kv : players) {
      if (kv.first->is_com()) continue;`,
      to: `    for (const std::pair<PlayerInfo*, SlotState>& kv : players) {
      if (!kv.first->is_com()) continue;` },
    { note: "pick_lr 序号比较反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `        if (static_cast<double>(at) == *index) {`,
      to: `        if (static_cast<double>(at) != *index) {` },
    { note: "press_u 随机步进条件反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (state == nullptr || state->step != SlotStep::FighterSel) return;`,
      to: `  if (state == nullptr || state->step == SlotStep::FighterSel) return;` },
    { note: "handle_fighters_changed 初值反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    bool hidden = true;
    for (const Value& v : list) {`,
      to: `    bool hidden = false;
    for (const Value& v : list) {` },
    { note: "handle_fighters_changed 清随机标记", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    kv.second.random = true;
    kv.second.fighter = Value(NullTag{});`,
      to: `    kv.second.random = false;
    kv.second.fighter = Value(NullTag{});` },
    { note: "update 名字键判等反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (key == _player_names_key) return;`,
      to: `  if (key != _player_names_key) return;` },
    { note: "last_com 判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (!ret->first->is_com()) return std::nullopt;`,
      to: `  if (ret->first->is_com()) return std::nullopt;` },

    // ============================ add_com ============================
    { note: "add_com 满员判定放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (max_player() <= static_cast<double>(players.size())) return;`,
      to: `  if (max_player() < static_cast<double>(players.size())) return;` },
    { note: "add_com 复用判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (map_has(kv.second.get())) continue;`,
      to: `    if (!map_has(kv.second.get())) continue;` },
    { note: "add_com id 前缀错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    com = lfw().player(u"com_" + lfw().new_id());`,
      to: `    com = lfw().player(u"comX_" + lfw().new_id());` },
    { note: "add_com 不当 COM", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    com->set_is_com(true, false);`,
      to: `    com->set_is_com(false, false);` },

    // ============================ 各状态 ============================
    { note: "PlayerSel enter 清错对象", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (kv.first->is_com()) coms.push_back(kv.first);`,
      to: `    if (!kv.first->is_com()) coms.push_back(kv.first);` },
    { note: "PlayerSel 就绪人数要求恒 1", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  const double need =
      gpl != nullptr && gpl->auto_start_when_ready() ? owner.min_player() : 1.0;`,
      to: `  const double need = 1.0;` },
    { note: "PlayerSel 人数比较 >", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  bool all_ready = static_cast<double>(owner.players.size()) >= need;`,
      to: `  bool all_ready = static_cast<double>(owner.players.size()) > need;` },
    { note: "PlayerSel 就绪步进判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (kv.second.step == SlotStep::Ready) continue;`,
      to: `    if (kv.second.step != SlotStep::Ready) continue;` },
    { note: "倒计时初值 4000", file: "native/lfw/ui/component/char_menu.cpp",
      from: `void CharMenuState_CountingDown::enter() { _count_down = 5000.0; }`,
      to: `void CharMenuState_CountingDown::enter() { _count_down = 4000.0; }` },
    { note: "倒计时按键减 600", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  _count_down = max(0.0, _count_down - 500.0);`,
      to: `  _count_down = max(0.0, _count_down - 600.0);` },
    { note: "倒计时满员判定放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (owner.max_player() <= static_cast<double>(owner.players.size())) return;
  if (player == nullptr || e.game_key != gk::ka || owner.map_has(player)) return;`,
      to: `  if (owner.max_player() < static_cast<double>(owner.players.size())) return;
  if (player == nullptr || e.game_key != gk::ka || owner.map_has(player)) return;` },
    { note: "倒计时加入键错绑 J", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (player == nullptr || e.game_key != gk::ka || owner.map_has(player)) return;`,
      to: `  if (player == nullptr || e.game_key != gk::kj || owner.map_has(player)) return;` },
    { note: "倒计时取消键错绑 U", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (survival && e.game_key == gk::kd && player != nullptr && owner.map_has(player)) {`,
      to: `  if (survival && e.game_key == gk::kU && player != nullptr && owner.map_has(player)) {` },
    { note: "倒计时显示用 floor", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  const double num = ceil(_count_down / 1000.0);`,
      to: `  const double num = floor(_count_down / 1000.0);` },
    { note: "倒计时归零判定 >= 放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (num > 0) return std::nullopt;`,
      to: `  if (num >= 0) return std::nullopt;` },
    { note: "生存自动开赛满员判定放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (gpl != nullptr && gpl->auto_start_when_ready() &&
      owner.max_player() <= static_cast<double>(owner.players.size())) {`,
      to: `  if (gpl != nullptr && gpl->auto_start_when_ready() &&
      owner.max_player() < static_cast<double>(owner.players.size())) {` },
    { note: "倒计时去向分支反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  return Value(char_menu_state_str(owner.max_player() <= static_cast<double>(owner.players.size())
                                       ? CharMenuState::GameSetting
                                       : CharMenuState::ComNumSel));`,
      to: `  return Value(char_menu_state_str(owner.max_player() <= static_cast<double>(owner.players.size())
                                       ? CharMenuState::ComNumSel
                                       : CharMenuState::GameSetting));` },
    { note: "ComNumSel 面板不显示", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (how_many_coms != nullptr) how_many_coms->set_visible(true);
  btns.clear();`,
      to: `  if (how_many_coms != nullptr) how_many_coms->set_visible(false);
  btns.clear();` },
    { note: "COM 按钮编号从 1 开始", file: "native/lfw/ui/component/char_menu.cpp",
      from: `                       ? how_many_coms->search_node(u"com_num_" +
                                                    std::u16string(1, static_cast<char16_t>(u'0' + i)))`,
      to: `                       ? how_many_coms->search_node(u"com_num_" +
                                                    std::u16string(1, static_cast<char16_t>(u'1' + i)))` },
    { note: "COM 按钮禁用窗口错", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    btn->set_disabled(!(static_cast<double>(i) >= min_coms && static_cast<double>(i) <= max_coms));`,
      to: `    btn->set_disabled(!(static_cast<double>(i) >= min_coms && static_cast<double>(i) < max_coms));` },
    { note: "COM 焦点步进判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (static_cast<double>(i) == min_coms) btn->set_focused(true);`,
      to: `    if (static_cast<double>(i) != min_coms) btn->set_focused(true);` },
    { note: "COM 数 clamp 偏 1", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  num = clamp(num, min_coms, max_coms);`,
      to: `  num = clamp(num + 1.0, min_coms, max_coms);` },
    { note: "ComNumSel 面板隐藏判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (how_many_coms == nullptr || !how_many_coms->visible()) {`,
      to: `  if (how_many_coms == nullptr || how_many_coms->visible()) {` },
    { note: "ComNumSel com_num>0 放宽", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (com_num > 0) owner.fsm_ref().use(Value(char_menu_state_str(CharMenuState::ComSel)));`,
      to: `  if (com_num >= 0) owner.fsm_ref().use(Value(char_menu_state_str(CharMenuState::ComSel)));` },
    { note: "ComNumSel 只认非 A 键", file: "native/lfw/ui/component/char_menu.cpp",
      from: `void CharMenuState_ComNumSel::on_key_down(LFWKeyEvent& e) {
  if (e.game_key != gk::ka) return;`,
      to: `void CharMenuState_ComNumSel::on_key_down(LFWKeyEvent& e) {
  if (e.game_key == gk::ka) return;` },
    { note: "com_num_ 后缀位错读", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      const char16_t c = id[at + 8];`,
      to: `      const char16_t c = id[at + 7];` },
    { note: "com_num 数字偏 1", file: "native/lfw/ui/component/char_menu.cpp",
      from: `      if (c >= u'0' && c <= u'9') which = static_cast<double>(c - u'0');`,
      to: `      if (c >= u'0' && c <= u'9') which = static_cast<double>(c - u'0') + 1.0;` },
    { note: "ComSel enter 不添加 COM", file: "native/lfw/ui/component/char_menu.cpp",
      from: `void CharMenuState_ComSel::enter() { owner.add_com(); }`,
      to: `void CharMenuState_ComSel::enter() { (void)0; }` },
    { note: "ComSel A 键非 COM 判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (!player->is_com()) {
      owner.add_com();
      return;
    }`,
      to: `    if (player->is_com()) {
      owner.add_com();
      return;
    }` },
    { note: "ComSel 就绪判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (state == nullptr || state->step != SlotStep::Ready) return;`,
      to: `    if (state == nullptr || state->step == SlotStep::Ready) return;` },
    { note: "ComSel 全就绪判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    if (all_com_ready()) return;
    owner.add_com();`,
      to: `    if (!all_com_ready()) return;
    owner.add_com();` },
    { note: "ComSel J 键错绑 U", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (e.game_key == gk::kj) owner.press_j(com);`,
      to: `  if (e.game_key == gk::kU) owner.press_j(com);` },
    { note: "ComSel 弹出后不删玩家", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    lfw.players_delete(com->id());`,
      to: `    (void)0;` },
    { note: "ComSel 补位判定反", file: "native/lfw/ui/component/char_menu.cpp",
      from: `    const std::optional<std::pair<PlayerInfo*, SlotState*>> lc = owner.last_com();
    if (lc.has_value()) owner.press_j(lc->first);`,
      to: `    const std::optional<std::pair<PlayerInfo*, SlotState*>> lc = owner.last_com();
    if (!lc.has_value()) owner.press_j(lc->first);` },
    { note: "ComSel 无 COM 去向不返回", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (!pair.has_value()) return Value(char_menu_state_str(CharMenuState::ComNumSel));`,
      to: `  if (pair.has_value()) return Value(char_menu_state_str(CharMenuState::ComNumSel));` },
    { note: "ComSel 全就绪判定反 2", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (all_com_ready()) return Value(char_menu_state_str(CharMenuState::GameSetting));`,
      to: `  if (!all_com_ready()) return Value(char_menu_state_str(CharMenuState::GameSetting));` },
    { note: "GameSetting 菜单不显示", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (game_settings_menu != nullptr) game_settings_menu->set_visible(true);`,
      to: `  if (game_settings_menu != nullptr) game_settings_menu->set_visible(false);` },
    { note: "GameSetting 离开留菜单", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (game_settings_menu != nullptr) game_settings_menu->set_visible(false);
  owner.update_random();`,
      to: `  if (game_settings_menu != nullptr) game_settings_menu->set_visible(true);
  owner.update_random();` },
    { note: "GameSetting 离开不重随", file: "native/lfw/ui/component/char_menu.cpp",
      from: `  if (game_settings_menu != nullptr) game_settings_menu->set_visible(false);
  owner.update_random();`,
      to: `  if (game_settings_menu != nullptr) game_settings_menu->set_visible(false);` },

    // ============================ CharMenuHead ============================
    { note: "Head join 不记状态", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `void CharMenuHead::join(const std::u16string& path) {
  _joined = true;`,
      to: `void CharMenuHead::join(const std::u16string& path) {
  _joined = false;` },
    { note: "Head join 头像不显示", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `    pic->node.set_visible(true);
    pic->set_src(path);`,
      to: `    pic->node.set_visible(false);
    pic->set_src(path);` },
    { note: "Head join 提示不隐藏", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `  UINode* const hints = hints_node();
  if (hints != nullptr) hints->set_visible(false);
  UINode* const cd = countdown_node();
  if (cd != nullptr) cd->set_visible(false);
}

void CharMenuHead::quit() {`,
      to: `  UINode* const hints = hints_node();
  if (hints != nullptr) hints->set_visible(true);
  UINode* const cd = countdown_node();
  if (cd != nullptr) cd->set_visible(false);
}

void CharMenuHead::quit() {` },
    { note: "Head 提示可见性条件反", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `  const bool hints_visible = !_joined && !cd_visible;`,
      to: `  const bool hints_visible = _joined && !cd_visible;` },
    { note: "Head start 提示条件丢 joined", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `  if (start_hints != nullptr) start_hints->set_visible(_joined && !cd_visible);`,
      to: `  if (start_hints != nullptr) start_hints->set_visible(!cd_visible);` },
    { note: "Head 左右箭头条件反", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `  const bool pick_visible = _joined && !cd_visible;`,
      to: `  const bool pick_visible = !_joined && !cd_visible;` },
    { note: "Head 倒计时隐藏阈值 2", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `  if (cd != nullptr) cd->set_visible(num >= 1);`,
      to: `  if (cd != nullptr) cd->set_visible(num >= 2);` },
    { note: "Head 倒计时文本偏 1", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `    if (label != nullptr) label->set_text(number_to_string(num));`,
      to: `    if (label != nullptr) label->set_text(number_to_string(num + 1.0));` },
    { note: "Head quit 不恢复提示", file: "native/lfw/ui/component/char_menu_head.cpp",
      from: `void CharMenuHead::quit() {
  _joined = false;
  _path.clear();
  Picture* const pic = head_pic();
  if (pic != nullptr) pic->node.set_visible(false);
  UINode* const hints = hints_node();
  if (hints != nullptr) hints->set_visible(true);`,
      to: `void CharMenuHead::quit() {
  _joined = false;
  _path.clear();
  Picture* const pic = head_pic();
  if (pic != nullptr) pic->node.set_visible(false);
  UINode* const hints = hints_node();
  if (hints != nullptr) hints->set_visible(false);` },

    // ============================ GamePrepareLogic 基础 ============================
    { note: "周期表 day/week 互换", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  static const std::vector<std::u16string> v{u"all", u"month", u"week", u"day"};`,
      to: `  static const std::vector<std::u16string> v{u"all", u"month", u"day", u"week"};` },
    { note: "i18n_fmt 下标 0 基", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      const size_t at = idx >= 1 ? static_cast<size_t>(idx - 1) : args.size();`,
      to: `      const size_t at = idx >= 1 ? static_cast<size_t>(idx) : args.size();` },
    { note: "i18n_fmt 空参照拼", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      if (at < args.size() && !is_nullish(args[at])) out += to_string(args[at]);`,
      to: `      if (at < args.size()) out += to_string(args[at]);` },
    { note: "难度血量表 1 档错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  if (d == 1.0) return 2500;`,
      to: `  if (d == 1.0) return 2600;` },
    { note: "生存判定错绑 stage", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  return mode.has_value() && *mode == kGameModeSurvival;`,
      to: `  return mode.has_value() && *mode == kGameModeStage;` },
    { note: "生存排行重置 dataset 时保留了旧难度（TS b25e6ff9c 之后不再保留）",
      file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      if (v != nullptr) ds.set(k, *v);`,
      to: `      if (v != nullptr && k != u"difficulty") ds.set(k, *v);` },
    { note: "start_game 广播名错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        if (message == u"start_game") {`,
      to: `        if (message == u"start_game2") {` },
    { note: "rank_refresh 广播名错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        if (message == u"rank_refresh") {`,
      to: `        if (message == u"rank_refresh2") {` },
    { note: "周期前缀错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        const std::u16string prefix = u"rank_period_set_";`,
      to: `        const std::u16string prefix = u"rank_period_set0_";` },
    { note: "榜单上限 100→1", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `constexpr double kRankLimit = 100;`,
      to: `constexpr double kRankLimit = 1;` },
    { note: "榜单数据不置已加载", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        _rank_loaded = true;
        render_rank_rows_text();`,
      to: `        _rank_loaded = false;
        render_rank_rows_text();` },
    { note: "新数据不滚回顶部", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `            static_cast<ScrollView*>(c)->scroll_to_start();`,
      to: `            (void)0;` },

    // ============================ on_resume 三模式 ============================
    { note: "生存背景行不隐藏", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  if (mode.has_value() && *mode == kGameModeSurvival) {
    if (background_row != nullptr) {
      background_row->set_visible(false);
      background_row->set_disabled(true);
    }`,
      to: `  if (mode.has_value() && *mode == kGameModeSurvival) {
    if (background_row != nullptr) {
      background_row->set_visible(true);
      background_row->set_disabled(true);
    }` },
    { note: "生存队伍绑 2 队", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      char_menu_logic->set_teams({std::u16string(team_enum::kTeam_1)});
      char_menu_logic->set_min_player(player_count());`,
      to: `      char_menu_logic->set_teams({std::u16string(team_enum::kTeam_2)});
      char_menu_logic->set_min_player(player_count());` },
    { note: "生存最大人数 +1", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      char_menu_logic->set_max_player(player_count());`,
      to: `      char_menu_logic->set_max_player(player_count() + 1.0);` },
    { note: "生存 oids 清空", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      char_menu_logic->set_oids(std::vector<std::u16string>(
          oid::survival_rank_oids().begin(), oid::survival_rank_oids().end()));`,
      to: `      char_menu_logic->set_oids(std::vector<std::u16string>());` },
    { note: "舞台行不显示", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  } else if (mode.has_value() && *mode == kGameModeStage) {
    if (stage_row != nullptr) {
      stage_row->set_visible(true);
      stage_row->set_disabled(false);
    }`,
      to: `  } else if (mode.has_value() && *mode == kGameModeStage) {
    if (stage_row != nullptr) {
      stage_row->set_visible(false);
      stage_row->set_disabled(false);
    }` },
    { note: "舞台队伍绑 3 队", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      char_menu_logic->set_teams({std::u16string(team_enum::kTeam_1)});
    }
    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(1.0);`,
      to: `      char_menu_logic->set_teams({std::u16string(team_enum::kTeam_3)});
    }
    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(1.0);` },
    { note: "舞台最小人数 2", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(1.0);`,
      to: `    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(2.0);` },
    { note: "VS 背景行不显示", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  } else {
    if (background_row != nullptr) {
      background_row->set_visible(true);
      background_row->set_disabled(false);
    }`,
      to: `  } else {
    if (background_row != nullptr) {
      background_row->set_visible(false);
      background_row->set_disabled(false);
    }` },
    { note: "VS 最小人数 3", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(2.0);`,
      to: `    if (char_menu_logic != nullptr) char_menu_logic->set_min_player(3.0);` },
    { note: "update 只在非生存刷脸", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  if (mode.has_value() && *mode == kGameModeSurvival) refresh_selection_face();`,
      to: `  if (mode.has_value() && *mode == kGameModeStage) refresh_selection_face();` },

    // ============================ 选角大头像 ============================
    { note: "刷脸人数用 min", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  const double count = std::max(1.0, player_count());`,
      to: `  const double count = std::min(1.0, player_count());` },
    { note: "大头像回退取反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const std::u16string next = !bg_face.empty() ? bg_face : std::u16string(kDefaultBgFace);`,
      to: `    const std::u16string next = bg_face.empty() ? bg_face : std::u16string(kDefaultBgFace);` },
    { note: "左右脸节点取反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `          node.search_node(i == 0 ? u"survival_bg_face" : u"survival_bg_face_r");`,
      to: `          node.search_node(i != 0 ? u"survival_bg_face" : u"survival_bg_face_r");` },
    { note: "随机标记绑定计数", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const bool show_mark = random && !counting;`,
      to: `    const bool show_mark = random && counting;` },
    { note: "随机脸面空值判反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      if (face != nullptr && !is_nullish(*face)) bg_face = to_string(*face);`,
      to: `      if (face != nullptr && is_nullish(*face)) bg_face = to_string(*face);` },

    // ============================ 生存榜单 ============================
    { note: "榜单不可用不禁滚条", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  if (scroll != nullptr) scroll->set_visible(available);`,
      to: `  if (scroll != nullptr) scroll->set_visible(true);` },
    { note: "榜单可用标记恒真", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  _rank_board_shown = available;`,
      to: `  _rank_board_shown = true;` },
    { note: "不可用仍显示下划线", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    clear_rank_rows();
    UINode* const under = node.search_node(u"rank_sel_underline");
    if (under != nullptr) under->set_visible(false);`,
      to: `    clear_rank_rows();
    UINode* const under = node.search_node(u"rank_sel_underline");
    if (under != nullptr) under->set_visible(true);` },
    { note: "双人榜标记比较反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  lfw().survival_rank_2p = player_count() >= 2;`,
      to: `  lfw().survival_rank_2p = player_count() < 2;` },
    { note: "榜单请求广播名错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  lfw().broadcast(Value(kBroadcastRankRequest));`,
      to: `  lfw().broadcast(Value(u"rank_request2"));` },
    { note: "行距 +1", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    y += kRankRowH + kRankRowGap;`,
      to: `    y += kRankRowH + kRankRowGap + 1.0;` },
    { note: "空榜占两行", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  const size_t shown = empty ? 1 : entries.size();`,
      to: `  const size_t shown = empty ? 2 : entries.size();` },
    { note: "斑马纹反色", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    row->color = (i & 1) ? std::u16string(kRankRowEvenBg) : std::u16string();`,
      to: `    row->color = !(i & 1) ? std::u16string(kRankRowEvenBg) : std::u16string();` },
    { note: "空榜文案键错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        set_text_keep_style(*n1, to_string(lfw().string(Value(u"survival.board_empty"))));`,
      to: `        set_text_keep_style(*n1, to_string(lfw().string(Value(u"survival.board_empty2"))));` },
    { note: "名次后缀错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    if (n0 != nullptr) set_text_keep_style(*n0, to_string(field_or(v, u"rank")) + u".");`,
      to: `    if (n0 != nullptr) set_text_keep_style(*n0, to_string(field_or(v, u"rank")) + u"-");` },
    { note: "双人名字分隔符错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        if (!names.empty()) names += u" & ";`,
      to: `        if (!names.empty()) names += u" / ";` },
    { note: "双人斗士分隔符错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        if (!fighters.empty()) fighters += u" & ";`,
      to: `        if (!fighters.empty()) fighters += u"+";` },
    { note: "层数文案键错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `                          i18n_fmt(to_string(lfw().string(Value(u"survival.floor_reached"))),
                                   {score != nullptr ? *score : Value(0.0)}));`,
      to: `                          i18n_fmt(to_string(lfw().string(Value(u"survival.floor_reached2"))),
                                   {score != nullptr ? *score : Value(0.0)}));` },
    { note: "我的排名有无判定反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        truthy(_rank_mine)
            ? i18n_fmt(to_string(lfw().string(Value(u"survival.my_rank_ranked"))),`,
      to: `        !truthy(_rank_mine)
            ? i18n_fmt(to_string(lfw().string(Value(u"survival.my_rank_ranked"))),` },
    { note: "选中页签颜色互换", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    n->style.set_fill_style(Value(std::u16string(selected ? u"#ffffff" : u"#9b9bff")));`,
      to: `    n->style.set_fill_style(Value(std::u16string(selected ? u"#9b9bff" : u"#ffffff")));` },
    { note: "页签文案键错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `        to_string(lfw().string(Value(u"survival.rank_period_" + p)));`,
      to: `        to_string(lfw().string(Value(u"survival.rank_periods_" + p)));` },
    { note: "下划线宽度用 min", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      const double w = std::max((g.right - g.left) > 0.0 ? (g.right - g.left) : 8.0, 8.0);`,
      to: `      const double w = std::min((g.right - g.left) > 0.0 ? (g.right - g.left) : 8.0, 8.0);` },
    { note: "下划线水平偏半宽", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      under->move_to_global((g.left + g.right) / 2.0 - w / 2.0, g.bottom + 2.0, 0.0);`,
      to: `      under->move_to_global((g.left + g.right) / 2.0 + w / 2.0, g.bottom + 2.0, 0.0);` },
    { note: "同周期不早退", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  if (rank_period == p) return;`,
      to: `  if (rank_period != p) return;` },
    { note: "数据集 playrate 0.5", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  ds.set(u"playrate", Value(1.0));`,
      to: `  ds.set(u"playrate", Value(0.5));` },
    // 撤出（等效，附证据）：
    //  - `on_stop` 的 `change_stage(u"")` vs `u"VOID"`：`Defines.VOID_STAGE.id` 是
    //    `"VOID_STAGE"`，`"VOID"` 既不是已加载舞台 id 也不是空串的兜底路径产物
    //    （空串同走兜底）⇒ 两条路都落 `Defines.VOID_STAGE`；若当前已是 VOID，
    //    `same_ref` 又一起早退。（手工施加后整份 trace 一致）
    //  - 背景 id 匹配取反：该循环结果马上被随后的 `change_stage(st_srv)` 覆盖
    //    （stage 自带 bg）；命中时 base 的 `change_bg` 还是相等早退，两侧最终 bg 都是
    //    st_srv.bg。（手工施加后整份 trace 一致）

    // ============================ start_game ============================
    { note: "缺斗士不取消开赛", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  for (const std::pair<PlayerInfo*, SlotState>& kv : char_menu_logic->players) {
    if (truthy(kv.second.fighter)) continue;`,
      to: `  for (const std::pair<PlayerInfo*, SlotState>& kv : char_menu_logic->players) {
    if (!truthy(kv.second.fighter)) continue;` },
    { note: "生存章节名错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      if (equals(field_or(v, u"chapter"), Value(std::u16string(u"survival"))) &&`,
      to: `      if (equals(field_or(v, u"chapter"), Value(std::u16string(u"survival2"))) &&` },
    { note: "舞台背景字段错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const Value stage = stage_sw->stage();
    const Value bg = field_or(stage, u"bg");`,
      to: `    const Value stage = stage_sw->stage();
    const Value bg = field_or(stage, u"bg2");` },
    { note: "镜头公式方向错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `                    : mt->range(left, right - defines::num(u"Defines.MODERN_SCREEN_WIDTH"));`,
      to: `                    : mt->range(left, right + defines::num(u"Defines.MODERN_SCREEN_WIDTH"));` },
    { note: "舞台模式朝向反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      fighter->facing = static_cast<double>(FacingFlag::Right);`,
      to: `      fighter->facing = static_cast<double>(FacingFlag::Left);` },
    { note: "xx1 舞台档偏 1", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const double xx1 = is_stage_mode ? 40.0 : 1.0 * screen_width() / 3.0;`,
      to: `    const double xx1 = is_stage_mode ? 41.0 : 1.0 * screen_width() / 3.0;` },
    { note: "xx2 对局档偏 1/3", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const double xx2 = is_stage_mode ? 80.0 : 2.0 * screen_width() / 3.0;`,
      to: `    const double xx2 = is_stage_mode ? 80.0 : 3.0 * screen_width() / 3.0;` },
    { note: "生存血量 1900", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      fighter->set_hp(2000);
      fighter->set_hp_max(2000);`,
      to: `      fighter->set_hp(1900);
      fighter->set_hp_max(2000);` },
    { note: "VS 蓝量 3/5", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    if (is_vs_mode) fighter->set_mp(fighter->mp_max() * 2.0 / 5.0);`,
      to: `    if (is_vs_mode) fighter->set_mp(fighter->mp_max() * 3.0 / 5.0);` },
    { note: "出场 x 不加镜头偏移", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const double x = mt->range(xx1, xx2) + cam_x;`,
      to: `    const double x = mt->range(xx1, xx2);` },
    { note: "纵深范围反", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    const double z = mt->range(far, near_v);`,
      to: `    const double z = mt->range(near_v, far);` },
    { note: "生存页 id 错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    lfw().srank_mode = true;
    if (layer != nullptr) {
      UIPushPageOpts opts;
      opts.id = u"stage_mode_page";`,
      to: `    lfw().srank_mode = true;
    if (layer != nullptr) {
      UIPushPageOpts opts;
      opts.id = u"stage_mode_page2";` },
    { note: "生存不置 srank_mode", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    lfw().srank_mode = true;`,
      to: `    lfw().srank_mode = false;` },
    { note: "生存关卡 id 取成名字", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `    lfw().change_stage(survival_stage.has_value() ? to_string(field_or(*survival_stage, u"id"))
                                                  : std::u16string(u"50"));`,
      to: `    lfw().change_stage(survival_stage.has_value() ? to_string(field_or(*survival_stage, u"name"))
                                                  : std::u16string(u"50"));` },
    { note: "VS 页 id 错", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `      opts.id = u"vs_mode_page";`,
      to: `      opts.id = u"vs_mode_page2";` },
    { note: "镜头跳转归零", file: "native/lfw/ui/component/game_prepare_logic.cpp",
      from: `  world().camera().jump_x(cam_x);`,
      to: `  world().camera().jump_x(0.0);` },

    // ============================ LFW / OID ============================
    { note: "players_delete 匹配反", file: "native/lfw/lfw.cpp",
      from: `    if (_players[i].first != player_id) continue;`,
      to: `    if (_players[i].first == player_id) continue;` },
    { note: "生存 oids 换一人", file: "native/lfw/defines/oid.h",
      from: `  static const std::vector<std::u16string> v{kDeep,  kJohn,  kHenry,  kRudolf, kLouis,`,
      to: `  static const std::vector<std::u16string> v{kDeep,  kJan,   kHenry,  kRudolf, kLouis,` },
  ],
};
