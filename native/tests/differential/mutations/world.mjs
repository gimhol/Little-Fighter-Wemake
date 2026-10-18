// `World`（`native/lfw/world.cpp`）的变异档。用例是 `cases/world/*.txt` 全部八份。
//
// 撤出名单（**按构造等价或暂时够不着**，每条都在下面写清理由）：
//   * 构造里 `bg_ = new Background(this, Defines.VOID_BG)` 的**数据**与那句
//     `transform.set_scale(bg_->zoom_x, ...)`：紧接着的 `new Stage(this, Defines.VOID_STAGE)`
//     会走 `Stage::change_bg` → `world.set_bg(...)`，把 bg 换成舞台数据里的 `VOID_BG` 并**重写**
//     缩放 ⇒ 构造里那两处的取值在任何观测点之前就被覆盖了（`set_bg` 那一刀的同类变异能杀）；
//   * `set_paused` 的 `if (paused_ == v) return;`：去掉它只是把同一个值再写一次，而回调另有
//     `changed` 门（`!v != !paused_`）⇒ 两者不可分辨；
//   * `reset_game_time` 的复位：`game_time` 只在 `step` 里推进（4K），本刀里它恒 0 ⇒ 复位前后
//     一样；
// 有意不覆盖（不可观察、按构造等价、或 TS 与端口同样够不着）：
//   * `set_bg` 里 `if (v.get() == bg_.get()) return;` 的同一性早退：台面走不到（`change_bg` 的
//     id 比较先生效）；
//   * `clear` 里 `if (bg.id !== VOID_BG.id) stage.change_bg(VOID_BG)` 的那个判等：等号成立
//     （bg 已经是 VOID_BG，`bound` 用例的 `wclear` 就落在这一支）时，`Stage::change_bg` 开头
//     自己也有「同 id 早退」⇒ 打不打这个电话完全分辨不出来；
//   * `map_set` 的「同键覆盖原位」那半：`add_entities` / `set_stage` 的路径不会对同一个键写两次；
//   * `collect_dead_buff`：Buff 那一刀的宿主面不在这里，台面没有真 `Buff`；
//   * `restrict` 的球分支（`x < left - 800 - l_len`）：球的边界是 MIN/MAX_SAFE_INTEGER，
//     TS 与端口都够不着（`clamp` 之后永远为假）；
//   * `restrict` 的 `ground.block` 推挤循环：假舞台的地形全在「地平线」上（`block` 对 base 段
//     直接给空表）⇒ 走的是 `Ground::y(seg, x, z)` 那一支；
//   * `game_result` 里 `!is_stage_finish || !is_chapter_finish` 之后的 `'win'`：要阶段/章节都完成，
//     那要 `step` 推阶段（下一刀）；
//   * 台面自己的 `w*` op 与 dump 行。
export default {
  subject: "world",
  cases: ["basic", "bound", "callbacks", "entities", "misc", "render", "spark", "teams"],
  mutations: [
    // ---------------------------------------------------------------- 构造
    {
      note: "World: 初始舞台用 VOID_BG 的数据",
      file: "native/lfw/world.cpp",
      from: `  stage_ = std::make_unique<Stage>(this, lfw_, defines_value(u"Defines.VOID_STAGE"));`,
      to: `  stage_ = std::make_unique<Stage>(this, lfw_, defines_value(u"Defines.VOID_BG"));`,
    },
    {
      note: "World: dataset 变更回调把 curr / prev 传反",
      file: "native/lfw/world.cpp",
      from: `  dataset.on_dataset_change = [this](const std::u16string& key, const Value& curr,
                                     const Value& prev) { on_dataset_change(key, curr, prev); };`,
      to: `  dataset.on_dataset_change = [this](const std::u16string& key, const Value& curr,
                                     const Value& prev) { on_dataset_change(key, prev, curr); };`,
    },
    // ---------------------------------------------------------------- set_bg / set_stage
    {
      note: "World: set_bg 不再把新 bg 的缩放写进 transform",
      file: "native/lfw/world.cpp",
      from: `  std::unique_ptr<Background> const o = std::move(bg_);
  bg_ = std::move(v);
  transform.set_scale(bg_->zoom_x(), bg_->zoom_y(), bg_->zoom_z());`,
      to: `  std::unique_ptr<Background> const o = std::move(bg_);
  bg_ = std::move(v);`,
    },
    {
      note: "World: set_stage 的 on_stage_change 把新旧舞台传反",
      file: "native/lfw/world.cpp",
      from: `  callbacks.call(u"on_stage_change",
                 {WorldCallbackArgs{this, nullptr, stage_.get(), o.get()}});`,
      to: `  callbacks.call(u"on_stage_change",
                 {WorldCallbackArgs{this, nullptr, o.get(), stage_.get()}});`,
    },
    {
      note: "World: set_stage 不给 bot 重新下 come",
      file: "native/lfw/world.cpp",
      from: `    if (!lfw_->ctrl_goingto(*ctrl)) continue;
    lfw_->ctrl_come(*ctrl, e->position.x, e->position.y, e->position.z);`,
      to: `    if (!lfw_->ctrl_goingto(*ctrl)) continue;`,
    },
    {
      note: "World: set_stage 的 goingto 判断反了",
      file: "native/lfw/world.cpp",
      from: `    if (!lfw_->ctrl_goingto(*ctrl)) continue;`,
      to: `    if (lfw_->ctrl_goingto(*ctrl)) continue;`,
    },
    {
      note: "World: set_stage 不 dispose 旧舞台",
      file: "native/lfw/world.cpp",
      from: `  o->dispose();
  stage_->enter_phase(0);`,
      to: `  stage_->enter_phase(0);`,
    },
    {
      note: "World: set_stage 不 enter_phase(0)",
      file: "native/lfw/world.cpp",
      from: `  stage_->enter_phase(0);`,
      to: `  (void)0;`,
    },
    // ---------------------------------------------------------------- 边界 / 暂停 / 计数
    {
      note: "World: player_l 转发成 player_r",
      file: "native/lfw/world.cpp",
      from: `double World::player_l() const { return stage_ != nullptr ? stage_->player_l : 0.0; }`,
      to: `double World::player_l() const { return stage_ != nullptr ? stage_->player_r : 0.0; }`,
    },
    {
      note: "World: middle 在舞台存在时反而给空",
      file: "native/lfw/world.cpp",
      from: `  static const Background::Middle kEmpty{};
  if (stage_ == nullptr) return kEmpty;`,
      to: `  static const Background::Middle kEmpty{};
  if (stage_ != nullptr) return kEmpty;`,
    },
    {
      note: "World: stage_limit 漏掉作弊判断",
      file: "native/lfw/world.cpp",
      from: `  return stage_->id() != std::u16string(u"VOID_STAGE") &&
         !lfw_->is_cheat(std::u16string(cheat_enum::kHERO_FT));`,
      to: `  return stage_->id() != std::u16string(u"VOID_STAGE");`,
    },
    {
      note: "World: world_pause 不读舞台",
      file: "native/lfw/world.cpp",
      from: `bool World::world_pause() const { return stage_ != nullptr && stage_->world_pause(); }`,
      to: `bool World::world_pause() const { return stage_ != nullptr; }`,
    },
    {
      note: "World: is_stage_finish 不读舞台",
      file: "native/lfw/world.cpp",
      from: `bool World::is_stage_finish() const { return stage_ != nullptr && stage_->is_stage_finish(); }`,
      to: `bool World::is_stage_finish() const { return stage_ != nullptr; }`,
    },
    {
      note: "World: is_chapter_finish 不读舞台",
      file: "native/lfw/world.cpp",
      from: `bool World::is_chapter_finish() const {
  return stage_ != nullptr && stage_->is_chapter_finish();
}`,
      to: `bool World::is_chapter_finish() const { return stage_ != nullptr; }`,
    },
    {
      note: "World: on_dataset_change 把 curr / prev 传反",
      file: "native/lfw/world.cpp",
      from: `  callbacks.call(u"on_dataset_change",
                 {WorldCallbackArgs{this, nullptr, nullptr, nullptr, curr, prev, k}});`,
      to: `  callbacks.call(u"on_dataset_change",
                 {WorldCallbackArgs{this, nullptr, nullptr, nullptr, prev, curr, k}});`,
    },
    {
      note: "World: set_paused 的 changed 恒真",
      file: "native/lfw/world.cpp",
      from: `  const bool changed = (!truthy(Value(v))) != (!truthy(Value(paused_)));
  paused_ = v;`,
      to: `  const bool changed = true;
  paused_ = v;`,
    },
    {
      note: "World: set_fn_locked 同值时不再早退",
      file: "native/lfw/world.cpp",
      from: `  if (fn_locked_ == v) return;
  fn_locked_ = v;`,
      to: `  fn_locked_ = v;`,
    },
    {
      note: "World: on_fn_locked_change 的回调值写死 0",
      file: "native/lfw/world.cpp",
      from: `  callbacks.call(u"on_fn_locked_change",
                 {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                    std::u16string(), v}});`,
      to: `  callbacks.call(u"on_fn_locked_change",
                 {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                    std::u16string(), 0.0}});`,
    },
    // ---------------------------------------------------------------- team_*
    {
      note: "World: team_come 的队伍判断用或",
      file: "native/lfw/world.cpp",
      from: `    if (team == e->team() && is_bot_ctrl_ptr(ctrl)) lfw_->ctrl_come(*ctrl, x, y, z);`,
      to: `    if (team == e->team() || is_bot_ctrl_ptr(ctrl)) lfw_->ctrl_come(*ctrl, x, y, z);`,
    },
    {
      note: "World: team_move 认成人类控制器",
      file: "native/lfw/world.cpp",
      from: `    if (team == e->team() && is_bot_ctrl_ptr(ctrl)) lfw_->ctrl_move(*ctrl);`,
      to: `    if (team == e->team() && is_human_ctrl_ptr(ctrl)) lfw_->ctrl_move(*ctrl);`,
    },
    {
      note: "World: team_stay 的队伍判断反了",
      file: "native/lfw/world.cpp",
      from: `    if (team == e->team() && is_bot_ctrl_ptr(ctrl)) lfw_->ctrl_stay(*ctrl);`,
      to: `    if (team != e->team() && is_bot_ctrl_ptr(ctrl)) lfw_->ctrl_stay(*ctrl);`,
    },
    {
      note: "World: team_follow 不再看目标队伍",
      file: "native/lfw/world.cpp",
      from: `    if (target.team() == e->team() && is_bot_ctrl_ptr(ctrl)) lfw_->ctrl_follow(*ctrl, target);`,
      to: `    if (target.team() == e->team()) lfw_->ctrl_follow(*ctrl, target);`,
    },
    // ---------------------------------------------------------------- 实体表
    {
      note: "World: add_entities 去掉重复 id 早退",
      file: "native/lfw/world.cpp",
      from: `void World::add_entities(Entity& e) {
  if (map_get(entity_map, e.id) != nullptr) return;`,
      to: `void World::add_entities(Entity& e) {`,
    },
    {
      note: "World: add_entities 的战士分支不再认战士",
      file: "native/lfw/world.cpp",
      from: `  if (entity::is_fighter(e)) {
    callbacks.call(u"on_fighter_add",`,
      to: `  if (false) {
    callbacks.call(u"on_fighter_add",`,
    },
    {
      note: "World: add_entities 不去查玩家表",
      file: "native/lfw/world.cpp",
      from: `    PlayerInfo* const player = lfw_->players_get(Value(std::u16string(player_id)));
    if (player != nullptr) {`,
      to: `    PlayerInfo* const player = nullptr;
    if (player != nullptr) {`,
    },
    {
      note: "World: add_entities 把 player 的 fighter 清空",
      file: "native/lfw/world.cpp",
      from: `      player->set_fighter(&e);`,
      to: `      player->set_fighter(nullptr);`,
    },
    {
      note: "World: add_entities 不给实体打 puppet 标记",
      file: "native/lfw/world.cpp",
      from: `      e.puppet = true;
      callbacks.call(u"on_puppet_add",`,
      to: `      callbacks.call(u"on_puppet_add",`,
    },
    {
      note: "World: add_entities 用队伍当 puppets 的键",
      file: "native/lfw/world.cpp",
      from: `      map_set(puppets, player_id, &e);`,
      to: `      map_set(puppets, e.team(), &e);`,
    },
    {
      note: "World: add_entities 的 on_puppet_add 参数被改写",
      file: "native/lfw/world.cpp",
      from: `      callbacks.call(u"on_puppet_add",
                     {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                        std::u16string(player_id)}});`,
      to: `      callbacks.call(u"on_puppet_add",
                     {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                        std::u16string(player_id + u"x")}});`,
    },
    {
      note: "World: add_entities 的 on_fighter_add 不带实体",
      file: "native/lfw/world.cpp",
      from: `    callbacks.call(u"on_fighter_add",
                   {WorldCallbackArgs{this, &e, nullptr, nullptr, Value(), Value(),
                                      std::u16string(), 0.0, 0.0, 0.0, false}});`,
      to: `    callbacks.call(u"on_fighter_add",
                   {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(), Value(),
                                      std::u16string(), 0.0, 0.0, 0.0, false}});`,
    },
    {
      note: "World: add_entities 的 ghosted 分支反了",
      file: "native/lfw/world.cpp",
      from: `  if (truthy(Value(e.ghosted()))) {
    ghosts.push_back(&e);`,
      to: `  if (!truthy(Value(e.ghosted()))) {
    ghosts.push_back(&e);`,
    },
    {
      note: "World: add_entities 不写 entity_map",
      file: "native/lfw/world.cpp",
      from: `  map_set(entity_map, e.id, &e);
  renderer_->add_entity(e);`,
      to: `  renderer_->add_entity(e);`,
    },
    {
      note: "World: add_entities 不通知渲染器",
      file: "native/lfw/world.cpp",
      from: `  renderer_->add_entity(e);
  controller::BaseController* const ctrl = e.ctrl();
  mark_players_alive(e, is_human_ctrl_ptr(ctrl) && e.hp() > 0);`,
      to: `  controller::BaseController* const ctrl = e.ctrl();
  mark_players_alive(e, is_human_ctrl_ptr(ctrl) && e.hp() > 0);`,
    },
    {
      note: "World: add_entities 的存活标记漏掉 hp 判断",
      file: "native/lfw/world.cpp",
      from: `  mark_players_alive(e, is_human_ctrl_ptr(ctrl) && e.hp() > 0);`,
      to: `  mark_players_alive(e, is_human_ctrl_ptr(ctrl));`,
    },
    {
      note: "World: list_entities 不吃缓存",
      file: "native/lfw/world.cpp",
      from: `  const std::map<std::u16string, std::vector<Entity*>>::iterator it = entities_map_.find(name);
  if (it != entities_map_.end()) return it->second;`,
      to: `  const std::map<std::u16string, std::vector<Entity*>>::iterator it = entities_map_.find(name);
  if (false) return it->second;`,
    },
    {
      note: "World: list_entities 不再过谓词",
      file: "native/lfw/world.cpp",
      from: `    if (predicate(*o)) ret.push_back(o);`,
      to: `    ret.push_back(o);`,
    },
    {
      note: "World: del_entity 不设 gone 帧",
      file: "native/lfw/world.cpp",
      from: `void World::del_entity(Entity& e) { e.set_frame(gone_frame_info()); }`,
      to: `void World::del_entity(Entity& e) { (void)e; }`,
    },
    {
      note: "World: del_entities 不逐个删",
      file: "native/lfw/world.cpp",
      from: `void World::del_entities(const std::vector<Entity*>& list) {
  for (Entity* const e : list) del_entity(*e);
}`,
      to: `void World::del_entities(const std::vector<Entity*>& list) { (void)list; }`,
    },
    {
      note: "World: mark_players_alive 只加不删",
      file: "native/lfw/world.cpp",
      from: `  } else {
    alive_players_.erase(std::remove(alive_players_.begin(), alive_players_.end(), &e),
                         alive_players_.end());
  }`,
      to: `  }`,
    },
    {
      note: "World: mark_players_alive 的 has_players_alive 恒真",
      file: "native/lfw/world.cpp",
      from: `  has_players_alive = !alive_players_.empty();`,
      to: `  has_players_alive = true;`,
    },
    // ---------------------------------------------------------------- 碰撞
    {
      note: "World: add_collision 忽略更近的重复 id",
      file: "native/lfw/world.cpp",
      from: `  if (prev != nullptr && prev->m_distance <= c.m_distance) return;`,
      to: `  if (prev != nullptr) return;`,
    },
    {
      note: "World: add_collision 换掉旧碰撞时不撤配对表",
      file: "native/lfw/world.cpp",
      from: `  if (prev != nullptr) pair_collisions_.remove(prev->aid, prev->vid);`,
      to: `  if (false) pair_collisions_.remove(prev->aid, prev->vid);`,
    },
    {
      note: "World: add_collision 永远追加新条目",
      file: "native/lfw/world.cpp",
      from: `  if (!replaced) collisions.emplace_back(c.id, c);`,
      to: `  collisions.emplace_back(c.id, c);`,
    },
    {
      note: "World: add_collision 往配对表里塞反的键",
      file: "native/lfw/world.cpp",
      from: `  pair_collisions_.add(c.aid, c.vid, c);`,
      to: `  pair_collisions_.add(c.vid, c.aid, c);`,
    },
    // ---------------------------------------------------------------- 渲染 / 相机 / UI
    {
      note: "World: render_once 不调渲染器",
      file: "native/lfw/world.cpp",
      from: `  const double t0 = clock_now();
  renderer_->render(dt);`,
      to: `  const double t0 = clock_now();`,
    },
    {
      note: "World: render_cost 的平滑权重写反",
      file: "native/lfw/world.cpp",
      from: `  render_cost = truthy(Value(render_cost)) ? render_cost * 0.9 + spent * 0.1 : spent;`,
      to: `  render_cost = truthy(Value(render_cost)) ? render_cost * 0.1 + spent * 0.9 : spent;`,
    },
    {
      note: "World: render_cost 第一次也算加权",
      file: "native/lfw/world.cpp",
      from: `  render_cost = truthy(Value(render_cost)) ? render_cost * 0.9 + spent * 0.1 : spent;`,
      to: `  render_cost = render_cost * 0.9 + spent * 0.1;`,
    },
    {
      note: "World: update_camera 不推进相机",
      file: "native/lfw/world.cpp",
      from: `  const double old_cam_x = round(camera_->position.x);
  const double old_cam_y = round(camera_->position.y);
  camera_->update();`,
      to: `  const double old_cam_x = round(camera_->position.x);
  const double old_cam_y = round(camera_->position.y);`,
    },
    {
      note: "World: update_camera 的位置变化判断用与",
      file: "native/lfw/world.cpp",
      from: `  if (old_cam_x != new_cam_x || old_cam_y != new_cam_y) {`,
      to: `  if (old_cam_x != new_cam_x && old_cam_y != new_cam_y) {`,
    },
    {
      note: "World: update_camera 回调里的 y 抄成 x",
      file: "native/lfw/world.cpp",
      from: `    callbacks.call(u"on_cam_move", {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(),
                                                     Value(), std::u16string(), new_cam_x,
                                                     new_cam_y}});`,
      to: `    callbacks.call(u"on_cam_move", {WorldCallbackArgs{this, nullptr, nullptr, nullptr, Value(),
                                                     Value(), std::u16string(), new_cam_y,
                                                     new_cam_x}});`,
    },
    {
      note: "World: update_ui 正序遍历图层",
      file: "native/lfw/world.cpp",
      from: `  for (size_t i = uis.size(); i > 0; --i) {
    ui::UINode* const ui = uis[i - 1];`,
      to: `  for (size_t i = 0; i < uis.size(); ++i) {
    ui::UINode* const ui = uis[i];`,
    },
    {
      note: "World: update_ui 不跳过 disabled 的图层",
      file: "native/lfw/world.cpp",
      from: `    if (ui == nullptr || ui->disabled()) continue;`,
      to: `    if (ui == nullptr) continue;`,
    },
    {
      note: "World: update_ui 的 dt 不乘 atom_time",
      file: "native/lfw/world.cpp",
      from: `  const double uidt = round_float(16.66666 * to_number(dataset.get(u"atom_time")));`,
      to: `  const double uidt = round_float(16.66666);`,
    },
    // ---------------------------------------------------------------- spark / etc
    {
      note: "World: spark 的实体数上限放宽 1",
      file: "native/lfw/world.cpp",
      from: `  if (static_cast<double>(entities.size() + ghosts.size()) > kMaxDebugEntities) return;`,
      to: `  if (static_cast<double>(entities.size() + ghosts.size()) > kMaxDebugEntities + 1) return;`,
    },
    {
      note: "World: spark 每次都重查数据",
      file: "native/lfw/world.cpp",
      from: `  if (!truthy(spark_data_)) spark_data_ = lfw_->datas_find(Value(std::u16string(oid)));`,
      to: `  spark_data_ = lfw_->datas_find(Value(std::u16string(oid)));`,
    },
    {
      note: "World: spark 的告警文本被改写",
      file: "native/lfw/world.cpp",
      from: `    lfw_->warn(std::u16string(u"[World::spark] \\"") + oid + u"\\" data not found!");`,
      to: `    lfw_->warn(std::u16string(u"[World::spark] \\"") + oid + u"\\" data not found?");`,
    },
    {
      note: "World: spark 的 outline_alpha 不是 0",
      file: "native/lfw/world.cpp",
      from: `  e->set_outline_alpha(0);
  e->set_outline_width(0);
  e->set_outline_color(std::u16string());`,
      to: `  e->set_outline_alpha(1);
  e->set_outline_width(0);
  e->set_outline_color(std::u16string());`,
    },
    {
      note: "World: spark 的位置 y / z 传反",
      file: "native/lfw/world.cpp",
      from: `  e->set_position(Value(x), Value(y), Value(z));
  e->enter_frame_by_id(Value(std::u16string(f)));
  e->attach(Value(true));`,
      to: `  e->set_position(Value(x), Value(z), Value(y));
  e->enter_frame_by_id(Value(std::u16string(f)));
  e->attach(Value(true));`,
    },
    {
      note: "World: spark 造出来的实体不进幽灵表",
      file: "native/lfw/world.cpp",
      from: `  e->enter_frame_by_id(Value(std::u16string(f)));
  e->attach(Value(true));`,
      to: `  e->enter_frame_by_id(Value(std::u16string(f)));
  e->attach(Value(false));`,
    },
    {
      note: "World: etc 的位置不取整",
      file: "native/lfw/world.cpp",
      from: `  e->position.x = round(x);
  e->position.y = round(y);
  e->position.z = round(z);`,
      to: `  e->position.x = x;
  e->position.y = round(y);
  e->position.z = round(z);`,
    },
    {
      note: "World: etc 每次都重查数据",
      file: "native/lfw/world.cpp",
      from: `  if (!truthy(etc_data_)) etc_data_ = lfw_->datas_find(Value(std::u16string(oid)));`,
      to: `  etc_data_ = lfw_->datas_find(Value(std::u16string(oid)));`,
    },
    {
      note: "World: etc 的实体被标成幽灵",
      file: "native/lfw/world.cpp",
      from: `  e->attach(Value(false));
}`,
      to: `  e->attach(Value(true));
}`,
    },
    // ---------------------------------------------------------------- get_bounding
    {
      note: "World: get_bounding 的 l 默认值不生效",
      file: "native/lfw/world.cpp",
      from: `  const double l = std::holds_alternative<std::monostate>(lv) ? l_default : to_number(lv);`,
      to: `  const double l = std::holds_alternative<std::monostate>(lv) ? 0.0 : to_number(lv);`,
    },
    {
      note: "World: get_bounding 的 z 默认值不生效",
      file: "native/lfw/world.cpp",
      from: `  const double z = std::holds_alternative<std::monostate>(zv) ? -l_default / 2.0 : to_number(zv);`,
      to: `  const double z = std::holds_alternative<std::monostate>(zv) ? 0.0 : to_number(zv);`,
    },
    {
      note: "World: get_bounding 的 left 不看朝向",
      file: "native/lfw/world.cpp",
      from: `  const double left = e.facing > 0 ? e.position.x - centerx + x
                                   : e.position.x + centerx - x - w;`,
      to: `  const double left = e.facing > 0 ? e.position.x + centerx - x - w
                                   : e.position.x - centerx + x;`,
    },
    {
      note: "World: get_bounding 的 top 方向反了",
      file: "native/lfw/world.cpp",
      from: `  const double top = e.position.y + centery - y;`,
      to: `  const double top = e.position.y + centery + y;`,
    },
    {
      note: "World: get_bounding 的 bottom 方向反了",
      file: "native/lfw/world.cpp",
      from: `  o->set(u"bottom", Value(round(top - h)));`,
      to: `  o->set(u"bottom", Value(round(top + h)));`,
    },
    {
      note: "World: get_bounding 的 right 用 h",
      file: "native/lfw/world.cpp",
      from: `  o->set(u"right", Value(round(left + w)));`,
      to: `  o->set(u"right", Value(round(left + h)));`,
    },
    // ---------------------------------------------------------------- FPS / 渲染循环
    {
      note: "World: FPS 的 Unlimited 回 60",
      file: "native/lfw/world.cpp",
      from: `    case SyncRenderEnum::Unlimited:
      return 1000;`,
      to: `    case SyncRenderEnum::Unlimited:
      return 60;`,
    },
    {
      note: "World: FPS 的 FPS_60 回 120",
      file: "native/lfw/world.cpp",
      from: `    case SyncRenderEnum::FPS_60:
      return 60;`,
      to: `    case SyncRenderEnum::FPS_60:
      return 120;`,
    },
    {
      note: "World: FPS 的 Sync 读错字段",
      file: "native/lfw/world.cpp",
      from: `    case SyncRenderEnum::Sync:
      return to_number(dataset.get(u"UPS"));`,
      to: `    case SyncRenderEnum::Sync:
      return to_number(dataset.get(u"atom_time"));`,
    },
    {
      note: "World: FPS 的 Half 不取整",
      file: "native/lfw/world.cpp",
      from: `    case SyncRenderEnum::Half:
      return floor(to_number(dataset.get(u"UPS")) / 2);`,
      to: `    case SyncRenderEnum::Half:
      return to_number(dataset.get(u"UPS")) / 2;`,
    },
    {
      note: "World: start_render 不为 Half 早退",
      file: "native/lfw/world.cpp",
      from: `  if (sync_render == static_cast<double>(SyncRenderEnum::Half)) return;
  render_prev_time_ = 0.0;`,
      to: `  render_prev_time_ = 0.0;`,
    },
    {
      note: "World: start_render 的 ideally_dt 乘反",
      file: "native/lfw/world.cpp",
      from: `  const double ideally_dt = 1000 / fps;`,
      to: `  const double ideally_dt = 1000 * fps;`,
    },
    {
      note: "World: start_render 不再按 fix_radio 节流",
      file: "native/lfw/world.cpp",
      from: `    if (real_dt < render_fix_radio_ * ideally_dt) return;`,
      to: `    if (false) return;`,
    },
    {
      note: "World: start_render 的 fix_radio 公式取反",
      file: "native/lfw/world.cpp",
      from: `    render_fix_radio_ = 1 - clamp(6 * (fps - fps_.value()) / fps, 0, 1);`,
      to: `    render_fix_radio_ = 1 + clamp(6 * (fps - fps_.value()) / fps, 0, 1);`,
    },
    {
      note: "World: start_render 不存渲染句柄",
      file: "native/lfw/world.cpp",
      from: `  render_worker_id_ = render_add(on_render);`,
      to: `  render_add(on_render);`,
    },
    {
      note: "World: start_render 起新的之前不撤旧的",
      file: "native/lfw/world.cpp",
      from: `  if (render_worker_id_ != 0) render_del(render_worker_id_);
  render_worker_id_ = render_add(on_render);`,
      to: `  render_worker_id_ = render_add(on_render);`,
    },
    {
      note: "World: on_fps_update 的回调不发",
      file: "native/lfw/world.cpp",
      from: `    fps_.update(real_dt);
    if (need_FPS_) {`,
      to: `    fps_.update(real_dt);
    if (false) {`,
    },
    {
      note: "World: stop_render 不管有没有句柄都撤",
      file: "native/lfw/world.cpp",
      from: `void World::stop_render() {
  if (render_worker_id_ != 0) render_del(render_worker_id_);
  render_worker_id_ = 0;
}`,
      to: `void World::stop_render() {
  render_del(render_worker_id_);
  render_worker_id_ = 0;
}`,
    },
    // ---------------------------------------------------------------- 休眠 / 步长 / 步进错误
    {
      note: "World: sleep 不翻标志",
      file: "native/lfw/world.cpp",
      from: `void World::sleep() {
  sleeping_ = true;`,
      to: `void World::sleep() {`,
    },
    {
      note: "World: awake 不翻标志",
      file: "native/lfw/world.cpp",
      from: `void World::awake() {
  sleeping_ = false;`,
      to: `void World::awake() {`,
    },
    {
      note: "World: base_step_ms 的 playrate 下界放宽",
      file: "native/lfw/world.cpp",
      from: `  if (!between(playrate_n, 0.01, 1000)) {`,
      to: `  if (!between(playrate_n, 0.0, 1000)) {`,
    },
    {
      note: "World: base_step_ms 重置 playrate 成 2",
      file: "native/lfw/world.cpp",
      from: `    dataset.set(u"playrate", Value(1.0));
    playrate = Value(1.0);
    playrate_n = 1.0;`,
      to: `    dataset.set(u"playrate", Value(2.0));
    playrate = Value(2.0);
    playrate_n = 2.0;`,
    },
    {
      note: "World: base_step_ms 不再要求 UPS 是 30/60",
      file: "native/lfw/world.cpp",
      from: `  if (ups_n != 30 && ups_n != 60) {`,
      to: `  if (ups_n != 60) {`,
    },
    {
      note: "World: base_step_ms 重置 UPS 成 30",
      file: "native/lfw/world.cpp",
      from: `    dataset.set(u"UPS", Value(60.0));
    ups = Value(60.0);
    ups_n = 60.0;`,
      to: `    dataset.set(u"UPS", Value(30.0));
    ups = Value(30.0);
    ups_n = 30.0;`,
    },
    {
      note: "World: base_step_ms 的 atom_time 校验放宽",
      file: "native/lfw/world.cpp",
      from: `  if (!(atom_n > 0)) {`,
      to: `  if (atom_n < 0) {`,
    },
    {
      note: "World: base_step_ms 的返回式乘 playrate",
      file: "native/lfw/world.cpp",
      from: `  return 1000 / ups_n / playrate_n;`,
      to: `  return 1000 / ups_n * playrate_n;`,
    },
    {
      note: "World: on_step_error 不再按 1000ms 窗口限流",
      file: "native/lfw/world.cpp",
      from: `  if (now - step_error_time_ > 1000) {`,
      to: `  if (false) {`,
    },
    {
      note: "World: on_step_error 的告警文本被改写",
      file: "native/lfw/world.cpp",
      from: `    lfw_->warn(message);`,
      to: `    lfw_->warn(message + u"!");`,
    },
    {
      note: "World: on_step_error 的 errors 判断反了",
      file: "native/lfw/world.cpp",
      from: `    if (has_errors) lfw_->warn(u"[World::start_update] errors");`,
      to: `    if (!has_errors) lfw_->warn(u"[World::start_update] errors");`,
    },
    {
      note: "World: on_step_error 的计数一次加二",
      file: "native/lfw/world.cpp",
      from: `  step_error_count_ += 1;`,
      to: `  step_error_count_ += 2;`,
    },
    {
      note: "World: on_step_error 的 120 次门槛不下调",
      file: "native/lfw/world.cpp",
      from: `  if (step_error_count_ >= kMaxStepErrors) {`,
      to: `  if (step_error_count_ >= kMaxStepErrors + 10) {`,
    },
    // ---------------------------------------------------------------- get_bound / restrict
    {
      note: "World: get_bound 的战士队伍判断反了",
      file: "native/lfw/world.cpp",
      from: `    if (e.team() == to_string(s.team())) {`,
      to: `    if (e.team() != to_string(s.team())) {`,
    },
    {
      note: "World: get_bound 的 Drink 武器不去看喝药边界",
      file: "native/lfw/world.cpp",
      from: `    l = s.drink_l;
    r = s.drink_r;`,
      to: `    l = s.player_l;
    r = s.player_r;`,
    },
    {
      note: "World: get_bound 的 near / far 传反",
      file: "native/lfw/world.cpp",
      from: `  bound_[2] = s.near_plane();
  bound_[3] = s.far_plane();`,
      to: `  bound_[2] = s.far_plane();
  bound_[3] = s.near_plane();`,
    },
    {
      note: "World: restrict 不再夹 x",
      file: "native/lfw/world.cpp",
      from: `  x = clamp(x, left, right);
  z = clamp(z, far_v, near_v);`,
      to: `  z = clamp(z, far_v, near_v);`,
    },
    {
      note: "World: restrict 不再夹 z",
      file: "native/lfw/world.cpp",
      from: `  x = clamp(x, left, right);
  z = clamp(z, far_v, near_v);`,
      to: `  x = clamp(x, left, right);`,
    },
    {
      note: "World: restrict 的持有者/幽灵早退分支不再生效",
      file: "native/lfw/world.cpp",
      from: `  if (e.bearer != nullptr || e.catcher != nullptr || truthy(Value(e.ghosted()))) {`,
      to: `  if (false) {`,
    },
    {
      note: "World: restrict 只认持有者、不认被抓住",
      file: "native/lfw/world.cpp",
      from: `  if (e.bearer != nullptr || e.catcher != nullptr || truthy(Value(e.ghosted()))) {`,
      to: `  if (e.bearer != nullptr || truthy(Value(e.ghosted()))) {`,
    },
    {
      note: "World: restrict 只认持有者、不认幽灵",
      file: "native/lfw/world.cpp",
      from: `  if (e.bearer != nullptr || e.catcher != nullptr || truthy(Value(e.ghosted()))) {`,
      to: `  if (e.bearer != nullptr || e.catcher != nullptr) {`,
    },
    {
      note: "World: restrict 的武器 gone 门不看 is_on_ground",
      file: "native/lfw/world.cpp",
      from: `    if (e.is_on_ground && x < left - e.l_len || x > right + e.r_len) {`,
      to: `    if (e.is_on_ground || x < left - e.l_len || x > right + e.r_len) {`,
    },
    {
      note: "World: restrict 的武器 gone 门左右传反",
      file: "native/lfw/world.cpp",
      from: `    if (e.is_on_ground && x < left - e.l_len || x > right + e.r_len) {`,
      to: `    if (e.is_on_ground && x < left - e.r_len || x > right + e.l_len) {`,
    },
    {
      note: "World: restrict 的越界帧不是 gone",
      file: "native/lfw/world.cpp",
      from: `      e.enter_frame(defines_value(u"Defines.NEXT_FRAME_GONE"));
      e.terrain = ground.base();
      restrict_result_.x = x;
      restrict_result_.y = y;
      restrict_result_.z = z;
      return restrict_result_;
    }
  } else if (entity::is_ball(e)) {`,
      to: `      e.terrain = ground.base();
      restrict_result_.x = x;
      restrict_result_.y = y;
      restrict_result_.z = z;
      return restrict_result_;
    }
  } else if (entity::is_ball(e)) {`,
    },
    {
      note: "World: restrict 的落点不取地形高度",
      file: "native/lfw/world.cpp",
      from: `  restrict_result_.y = Ground::y(seg, x, z);`,
      to: `  restrict_result_.y = y;`,
    },
    // ---------------------------------------------------------------- 变更 / 清理 / 计分
    {
      note: "World: change_bg 的同 id 早退失效",
      file: "native/lfw/world.cpp",
      from: `  if (equals(cur_id, bg_id)) return;`,
      to: `  if (false) return;`,
    },
    {
      note: "World: change_bg 的随机背景不看 LF2_NET",
      file: "native/lfw/world.cpp",
      from: `    if (truthy(dataset.get(u"LF2_NET"))) {
      bg_data = lfw_->get_random_bg({Value(std::u16string(background_group::kRegular)),
                                     Value(std::u16string(background_group::kHidden))});
    } else {
      bg_data = lfw_->get_random_bg({Value(std::u16string(background_group::kRegular))});
    }`,
      to: `    bg_data = lfw_->get_random_bg({Value(std::u16string(background_group::kRegular))});`,
    },
    {
      note: "World: change_bg 找不到背景时不回落 VOID_BG",
      file: "native/lfw/world.cpp",
      from: `  if (!truthy(bg_data)) bg_data = defines_value(u"Defines.VOID_BG");`,
      to: `  if (false) bg_data = defines_value(u"Defines.VOID_BG");`,
    },
    {
      note: "World: change_stage 的同一份数据判等失效",
      file: "native/lfw/world.cpp",
      from: `  if (same_ref(stage_data, stage_->data())) return;`,
      to: `  if (false) return;`,
    },
    {
      note: "World: change_stage 找不到舞台时不回落 VOID_STAGE",
      file: "native/lfw/world.cpp",
      from: `  Value stage_data = lfw_->datas_stages_find(stage_id);
  if (!truthy(stage_data)) stage_data = defines_value(u"Defines.VOID_STAGE");`,
      to: `  Value stage_data = lfw_->datas_stages_find(stage_id);`,
    },
    {
      note: "World: handle_cmds 不看有没有命令",
      file: "native/lfw/world.cpp",
      from: `  if (!lfw_->has_cmds()) return;
  lfw_->handle_cmds(*this);`,
      to: `  lfw_->handle_cmds(*this);`,
    },
    {
      note: "World: find_entity 恒回空",
      file: "native/lfw/world.cpp",
      from: `Entity* World::find_entity(const std::u16string& id) const { return map_get(entity_map, id); }`,
      to: `Entity* World::find_entity(const std::u16string& id) const { (void)id; return nullptr; }`,
    },
    {
      note: "World: weapon_section_at 不除 WEAPON_X_SECTION",
      file: "native/lfw/world.cpp",
      from: `double World::weapon_section_at(double x) const { return round(x / kWeaponXSection); }`,
      to: `double World::weapon_section_at(double x) const { return round(x); }`,
    },
    {
      note: "World: random_weapon_x 不排除分带",
      file: "native/lfw/world.cpp",
      from: `  double band_x = 0;
  double band_len = 0;
  if (exclude_section.has_value()) {`,
      to: `  double band_x = 0;
  double band_len = 0;
  if (false) {`,
    },
    {
      note: "World: random_weapon_x 的 band_len 不算出来",
      file: "native/lfw/world.cpp",
      from: `      band_len = max(0.0, br - bl);`,
      to: `      band_len = max(0.0, bl - br);`,
    },
    {
      note: "World: random_weapon_x 不跳过排除带",
      file: "native/lfw/world.cpp",
      from: `  if (band_len > 0 && x >= band_x) x += band_len;`,
      to: `  if (band_len > 0 && x >= band_x) x -= band_len;`,
    },
    {
      note: "World: weapon_count_at 的分带键不取整",
      file: "native/lfw/world.cpp",
      from: `  const double key = weapon_section_at(x);`,
      to: `  const double key = x;`,
    },
    {
      note: "World: add_count 不是累加",
      file: "native/lfw/world.cpp",
      from: `    if (kv.first == key) {
      kv.second = value + o;`,
      to: `    if (kv.first == key) {
      kv.second = o;`,
    },
    {
      note: "World: add_count 不发 on_counts",
      file: "native/lfw/world.cpp",
      from: `  if (!replaced) counts_.emplace_back(key, value + o);
  callbacks.call(u"on_counts", {WorldCallbackArgs{this}});`,
      to: `  if (!replaced) counts_.emplace_back(key, value + o);`,
    },
    {
      note: "World: clear 不重置 playrate",
      file: "native/lfw/world.cpp",
      from: `  dataset.set(u"infinity_mp", Value(0.0));
  dataset.set(u"playrate", Value(1.0));`,
      to: `  dataset.set(u"infinity_mp", Value(0.0));`,
    },
    {
      note: "World: clear 不把实体设成 gone",
      file: "native/lfw/world.cpp",
      from: `  for (Entity* const e : entities) e->set_frame(gone_frame_info());
  for (Entity* const e : ghosts) e->set_frame(gone_frame_info());`,
      to: `  for (Entity* const e : entities) (void)e;
  for (Entity* const e : ghosts) e->set_frame(gone_frame_info());`,
    },
    {
      note: "World: clear 不清空计数",
      file: "native/lfw/world.cpp",
      from: `  callbacks.call(u"on_counts", {WorldCallbackArgs{this}});
  counts_.clear();`,
      to: `  callbacks.call(u"on_counts", {WorldCallbackArgs{this}});`,
    },
    {
      note: "World: clear 不重置相机",
      file: "native/lfw/world.cpp",
      from: `  set_paused(false);
  camera_->reset();`,
      to: `  set_paused(false);`,
    },
    {
      note: "World: dispose 不发 on_disposed",
      file: "native/lfw/world.cpp",
      from: `  callbacks.call(u"on_disposed", {WorldCallbackArgs{this}});`,
      to: `  (void)0;`,
    },
    {
      note: "World: dispose 不通知渲染器",
      file: "native/lfw/world.cpp",
      from: `  renderer_->dispose();
  callbacks.clear();`,
      to: `  callbacks.clear();`,
    },

    {
      note: "World: calc_alives 不看 hp",
      file: "native/lfw/world.cpp",
      from: `    if (e->hp() <= 0) continue;`,
      to: `    if (false) continue;`,
    },
    {
      note: "World: calc_alives 不再判重",
      file: "native/lfw/world.cpp",
      from: `      if (!vec_has(puppet_teams, team)) puppet_teams.push_back(team);`,
      to: `      puppet_teams.push_back(team);`,
    },
    {
      note: "World: calc_alives 只认非 puppet",
      file: "native/lfw/world.cpp",
      from: `    if (e->puppet) {`,
      to: `    if (!e->puppet) {`,
    },
    {
      note: "World: game_result 不刷新存活表",
      file: "native/lfw/world.cpp",
      from: `  if (refresh) calc_alives();`,
      to: `  if (false) calc_alives();`,
    },
    {
      note: "World: game_result 的一队阈值用 >=",
      file: "native/lfw/world.cpp",
      from: `  if (team_alive_counts_.size() > 1) return std::u16string();`,
      to: `  if (team_alive_counts_.size() >= 1) return std::u16string();`,
    },
    {
      note: "World: game_result 的空表不给 drawn",
      file: "native/lfw/world.cpp",
      from: `  if (team_alive_counts_.size() <= 0) return std::u16string(u"drawn");`,
      to: `  if (false) return std::u16string(u"drawn");`,
    },
    {
      note: "World: game_result 的 VOID_STAGE 判等失效",
      file: "native/lfw/world.cpp",
      from: `  if (stage_->id() == std::u16string(u"VOID_STAGE")) return std::u16string(u"over");`,
      to: `  if (false) return std::u16string(u"over");`,
    },
    {
      note: "World: game_result 的 puppet_team_alive 恒假",
      file: "native/lfw/world.cpp",
      from: `  if (!puppet_team_alive) return std::u16string(u"over");`,
      to: `  if (true) return std::u16string(u"over");`,
    },
  ],
};
