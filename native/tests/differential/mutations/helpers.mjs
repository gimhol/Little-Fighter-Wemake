// `helper/` 家族（4AA）+ `Keys` + `JoinQueue` 的变异档。
//
// 用例：`cases/helpers/{basic,keys,ui,jq}.txt`（任一锁住即可）。
//
// 有意不覆盖 / 等价（在原型上验证过「改了没漂」或不可观察）：
//   * `add` 里 `entity->set_ctrl(nullptr)` 的结果：台面假件 `create_ctrl` 恒回 null，
//     「删掉 set_ctrl 这一句但不删 create_ctrl 调用」不可观察（上面那条变异删的是整句，
//     `ctrl|…` 日志会缺）。
//   * `WeaponsHelper::add_random` 的 `randoms(group, false)`：`we.rand g2 n` 之后缓存命中
//     与新建 dup 版在**同一次抽取**下首抽同元素 ⇒ 改写后轨迹同形。
//   * `add_random` 的 `if (!truthy(d)) continue;`：`Randoming.get()` 空池才回 undefined，
//     而空池在 `randoms` 里已经早退 ⇒ 用例造不出该分支。
//   * `ObjectsHelper::at` 的负数分支：删掉会让 `list[size_t(-1)]` 越界 UB，风险大于收益。
//   * `cases.cpp` 的 `sus_cases`：本批没有消费它的台面（名字不可观察）。
export default {
  subject: "helpers",
  mutations: [
    // ------------------------------------------------------------ entities_helper.cpp
    {
      note: "team_randoming：名字多打一个字符",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `      _team_randoming(u"team_randoming",`,
      to: `      _team_randoming(u"team_randomingX",`,
    },
    {
      note: "team_randoming：源池少一个队",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `                      {Value(std::u16string(u"1")), Value(std::u16string(u"2")),
                       Value(std::u16string(u"3")), Value(std::u16string(u"4"))},`,
      to: `                      {Value(std::u16string(u"1")), Value(std::u16string(u"2")),
                       Value(std::u16string(u"3"))},`,
    },
    {
      note: "ObjectsHelper.all：不遍历 ghosts",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `  for (Entity* const v : _lfw->world_entities()) ret.push_back(v);
  for (Entity* const v : _lfw->world_ghosts()) ret.push_back(v);
  return ret;`,
      to: `  for (Entity* const v : _lfw->world_entities()) ret.push_back(v);
  return ret;`,
    },
    {
      note: "ObjectsHelper.at：非整数下标不判空（JS 应回 undefined）",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `  if (std::floor(idx) != idx) return nullptr;`,
      to: `  (void)0;`,
    },
    {
      note: "ObjectsHelper.add：while(--num >= 0) 改 > 0（少造一个）",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    n -= 1;
    if (!(n >= 0)) break;
    Entity* const entity = _lfw->create_entity(data);`,
      to: `    n -= 1;
    if (!(n > 0)) break;
    Entity* const entity = _lfw->create_entity(data);`,
    },
    {
      note: "ObjectsHelper.add：造不出实体就整轮中断（continue 改 break）",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    Entity* const entity = _lfw->create_entity(data);
    if (entity == nullptr) continue;`,
      to: `    Entity* const entity = _lfw->create_entity(data);
    if (entity == nullptr) break;`,
    },
    {
      note: "ObjectsHelper.add：不调 create_ctrl",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    entity->set_ctrl(_lfw->create_ctrl(field_or(entity->data(), u"id"), std::u16string(), entity));
`,
      to: ``,
    },
    {
      note: "ObjectsHelper.add：'?' 判定串写错",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    if (team != nullptr && *team == u"?") {`,
      to: `    if (team != nullptr && *team == u"?X") {`,
    },
    {
      note: "ObjectsHelper.add：空串 team 不再落到 new_team",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    } else if (team != nullptr && !team->empty()) {`,
      to: `    } else if (team != nullptr) {`,
    },
    {
      note: "ObjectsHelper.add：随机队不抽签，恒给 '1'",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `      const Value picked = _team_randoming.get();`,
      to: `      const Value picked = Value(std::u16string(u"1"));`,
    },
    {
      note: "ObjectsHelper.add：new_team 落到空串",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `      entity->set_team(_lfw->new_team());`,
      to: `      entity->set_team(std::u16string());`,
    },
    {
      note: "ObjectsHelper.add：不调 random_entity_info",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    _lfw->random_entity_info(*entity);
    entity->attach();`,
      to: `    entity->attach();`,
    },
    {
      note: "ObjectsHelper.add：不调 attach",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `    entity->attach();
    ret.push_back(entity);`,
      to: `    ret.push_back(entity);`,
    },
    {
      note: "ObjectsHelper.del_all：只删 entities，漏 ghosts",
      file: "native/lfw/helper/entities_helper.cpp",
      from: `void ObjectsHelper::del_all() { _lfw->del_entities(all()); }`,
      to: `void ObjectsHelper::del_all() { _lfw->del_entities(_lfw->world_entities()); }`,
    },
    // ------------------------------------------------------------ characters_helper.cpp
    {
      note: "CharactersHelper.all：类型判定错成 ball",
      file: "native/lfw/helper/characters_helper.cpp",
      from: `    if (entity::is_fighter_data(v->data())) ret.push_back(v);
  }
  for (Entity* const v : _lfw->world_ghosts()) {`,
      to: `    if (entity::is_ball_data(v->data())) ret.push_back(v);
  }
  for (Entity* const v : _lfw->world_ghosts()) {`,
    },
    {
      note: "CharactersHelper.all：不遍历 ghosts",
      file: "native/lfw/helper/characters_helper.cpp",
      from: `  for (Entity* const v : _lfw->world_ghosts()) {
    if (entity::is_fighter_data(v->data())) ret.push_back(v);
  }
  return ret;`,
      to: `  return ret;`,
    },
    {
      note: "CharactersHelper.add：字符串 id 不查表（直接当数据用）",
      file: "native/lfw/helper/characters_helper.cpp",
      from: `    const Value* const found = _lfw->find_fighter(d);
    if (found == nullptr) return {};
    d = *found;`,
      to: `    const Value* const found = _lfw->find_fighter(d);
    if (found == nullptr) return {};
    (void)found;`,
    },
    {
      note: "CharactersHelper.add_random：无过滤时把全部筛掉",
      file: "native/lfw/helper/characters_helper.cpp",
      from: `      if (filter == nullptr || (*filter)(v)) items.push_back(v);`,
      to: `      if (filter != nullptr && (*filter)(v)) items.push_back(v);`,
    },
    {
      note: "CharactersHelper.add_random：丢 team",
      file: "native/lfw/helper/characters_helper.cpp",
      from: `    const std::vector<Entity*> added = add(d, 1, team);`,
      to: `    const std::vector<Entity*> added = add(d, 1, nullptr);`,
    },
    // ------------------------------------------------------------ balls_helper.cpp
    {
      note: "BallsHelper.all：类型判定错成 weapon（entities 侧）",
      file: "native/lfw/helper/balls_helper.cpp",
      from: `    if (entity::is_ball_data(v->data())) ret.push_back(v);
  }
  for (Entity* const v : _lfw->world_ghosts()) {`,
      to: `    if (entity::is_weapon_data(v->data())) ret.push_back(v);
  }
  for (Entity* const v : _lfw->world_ghosts()) {`,
    },
    {
      note: "BallsHelper.all：不遍历 ghosts",
      file: "native/lfw/helper/balls_helper.cpp",
      from: `  for (Entity* const v : _lfw->world_ghosts()) {
    if (entity::is_ball_data(v->data())) ret.push_back(v);
  }
  return ret;`,
      to: `  return ret;`,
    },
    // ------------------------------------------------------------ weapons_helper.cpp
    {
      note: "WeaponsHelper.all：类型判定错成 ball（entities 侧）",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `    if (entity::is_weapon_data(v->data())) ret.push_back(v);
  }
  for (Entity* const v : _lfw->world_ghosts()) {`,
      to: `    if (entity::is_ball_data(v->data())) ret.push_back(v);
  }
  for (Entity* const v : _lfw->world_ghosts()) {`,
    },
    {
      note: "WeaponsHelper.add：字符串 id 不查表",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `    const Value* const found = _lfw->find_weapon(d);
    if (found == nullptr) return {};
    d = *found;`,
      to: `    const Value* const found = _lfw->find_weapon(d);
    if (found == nullptr) return {};
    (void)found;`,
    },
    {
      note: "js_trim：不裁剪",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `  size_t b = 0;
  size_t e = s.size();
  while (b < e && is_js_ws(s[b])) ++b;
  while (e > b && is_js_ws(s[e - 1])) --e;
  return s.substr(b, e - b);`,
      to: `  return s;`,
    },
    {
      note: "split_comma：分隔符错成 ';'",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `    if (c == u',') {
      ret.push_back(std::move(cur));`,
      to: `    if (c == u';') {
      ret.push_back(std::move(cur));`,
    },
    {
      note: "in_groups：成员判定反了",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `    for (const std::u16string& g : gg) {
      if (g == *item) return true;
    }`,
      to: `    for (const std::u16string& g : gg) {
      if (g != *item) return true;
    }`,
    },
    {
      note: "in_groups：没有 group 字段也入选",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `  const Array* const arr = group != nullptr ? as_array(*group) : nullptr;
  if (arr == nullptr) return false;`,
      to: `  const Array* const arr = group != nullptr ? as_array(*group) : nullptr;
  if (arr == nullptr) return true;`,
    },
    {
      note: "in_groups：错把 v 自己当 base",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `    const Object* const base = as_object(field_or(v, u"base"));`,
      to: `    const Object* const base = as_object(v);`,
    },
    {
      note: "randoms：不做缓存（每次新建）",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `  for (const auto& kv : map) {
    if (kv.first == groups) return kv.second.get();
  }`,
      to: `  (void)map;`,
    },
    {
      note: "randoms：名字前缀写错",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `  std::u16string name = u"weapons_randoms";`,
      to: `  std::u16string name = u"weapons_randomX";`,
    },
    {
      note: "randoms：组名连接符改 '-'",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `      if (i != 0) name.push_back(u'_');`,
      to: `      if (i != 0) name.push_back(u'-');`,
    },
    {
      note: "randoms：空池不再早退（给出空 src 的 Randoming）",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `  if (list.empty()) return nullptr;`,
      to: `  (void)0;`,
    },
    {
      note: "add_random：每抽一个造两个",
      file: "native/lfw/helper/weapons_helper.cpp",
      from: `    const std::vector<Entity*> added = add(d, 1, nullptr);`,
      to: `    const std::vector<Entity*> added = add(d, 2, nullptr);`,
    },
    // ------------------------------------------------------------ ui_helper.cpp
    {
      note: "UIHelper.add：不存条目",
      file: "native/lfw/helper/ui_helper.cpp",
      from: `  for (const Value& ui : uis) _all.push_back(ui);`,
      to: `  (void)uis;`,
    },
    {
      note: "UIHelper.clear：不清空",
      file: "native/lfw/helper/ui_helper.cpp",
      from: `UIHelper& UIHelper::clear() {
  _all.clear();`,
      to: `UIHelper& UIHelper::clear() {`,
    },
    {
      note: "UIHelper.push_page：page 键名写错",
      file: "native/lfw/helper/ui_helper.cpp",
      from: `  obj->set(u"id", Value(id));
  _lfw->push_page(Value(std::move(obj)), stack_idx);`,
      to: `  obj->set(u"iD", Value(id));
  _lfw->push_page(Value(std::move(obj)), stack_idx);`,
    },
    {
      note: "UIHelper.set_page：page 键名写错",
      file: "native/lfw/helper/ui_helper.cpp",
      from: `  obj->set(u"id", Value(id));
  _lfw->set_page(Value(std::move(obj)), stack_idx);`,
      to: `  obj->set(u"iD", Value(id));
  _lfw->set_page(Value(std::move(obj)), stack_idx);`,
    },
    // ------------------------------------------------------------ join_queue.cpp
    {
      note: "enqueue：空 uid 也收",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  if (entrant.uid.empty()) return false;`,
      to: `  if (false) return false;`,
    },
    {
      note: "enqueue：不判重",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  if (_uids.count(entrant.uid) != 0) return false;`,
      to: `  if (false) return false;`,
    },
    {
      note: "enqueue：容量边界 >= 改 >",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  if (static_cast<double>(_items.size()) >= _cap) return false;`,
      to: `  if (static_cast<double>(_items.size()) > _cap) return false;`,
    },
    {
      note: "dequeue：只出队不摘 uid",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  Entrant ret = _items.front();
  _items.erase(_items.begin());
  _uids.erase(ret.uid);
  return ret;`,
      to: `  Entrant ret = _items.front();
  _items.erase(_items.begin());
  return ret;`,
    },
    {
      note: "dequeue：从尾巴出（LIFO）",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  Entrant ret = _items.front();
  _items.erase(_items.begin());`,
      to: `  Entrant ret = _items.back();
  _items.erase(_items.end() - 1);`,
    },
    {
      note: "remove：uid 判定反了",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    if (_items[i].uid == uid) {
      idx = i;`,
      to: `    if (_items[i].uid != uid) {
      idx = i;`,
    },
    {
      note: "remove：不摘 uid",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  _items.erase(_items.begin() + static_cast<std::ptrdiff_t>(idx));
  _uids.erase(uid);
  return true;`,
      to: `  _items.erase(_items.begin() + static_cast<std::ptrdiff_t>(idx));
  return true;`,
    },
    {
      note: "clear：不摘 uid",
      file: "native/lfw/helper/join_queue.cpp",
      from: `void JoinQueue::clear() {
  _items.clear();
  _uids.clear();
}`,
      to: `void JoinQueue::clear() {
  _items.clear();
}`,
    },
    {
      note: "pick：alive<=0 改 <0（零人也进候选）",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    if (alive <= 0) continue;`,
      to: `    if (alive < 0) continue;`,
    },
    {
      note: "pick：满员判定 -alive<=0 改 <0",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    if (map_get(caps, team) - alive <= 0) continue;`,
      to: `    if (map_get(caps, team) - alive < 0) continue;`,
    },
    {
      note: "pick：最小判定 < 改 <=",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    if (alive < least) {
      least = alive;`,
      to: `    if (alive <= least) {
      least = alive;`,
    },
    {
      note: "pick：并列尾巴不收集",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    } else if (alive == least) {
      candidates.push_back(team);
    }`,
      to: `    }`,
    },
    {
      note: "pick：fallen 命中也不优先",
      file: "native/lfw/helper/join_queue.cpp",
      from: `      if (c == *fallen) return Value(*fallen);`,
      to: `      if (c == *fallen) return Value(candidates[0]);`,
    },
    {
      note: "pick：返回末位候选",
      file: "native/lfw/helper/join_queue.cpp",
      from: `  return Value(candidates[0]);`,
      to: `  return Value(candidates.back());`,
    },
    {
      note: "pick：counts/caps 读反",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    const double alive = map_get(counts, team);`,
      to: `    const double alive = map_get(caps, team);`,
    },
    {
      note: "pick：Map 缺失默认值回 1",
      file: "native/lfw/helper/join_queue.cpp",
      from: `    return 0.0;  // \`counts.get(team) ?? 0\``,
      to: `    return 1.0;`,
    },
    // ------------------------------------------------------------ keys.cpp / keys.h
    {
      note: "Keys：字段顺序换（L/R 交换）",
      file: "native/lfw/keys.cpp",
      from: `  for (const char16_t* const k : {u"L", u"R", u"U", u"D", u"a", u"j", u"d"}) {`,
      to: `  for (const char16_t* const k : {u"R", u"L", u"U", u"D", u"a", u"j", u"d"}) {`,
    },
    {
      note: "Keys：末位 d 写成大写 D（重复）",
      file: "native/lfw/keys.cpp",
      from: `  for (const char16_t* const k : {u"L", u"R", u"U", u"D", u"a", u"j", u"d"}) {`,
      to: `  for (const char16_t* const k : {u"L", u"R", u"U", u"D", u"a", u"j", u"D"}) {`,
    },
    {
      note: "Keys.get：命中判定反了",
      file: "native/lfw/keys.cpp",
      from: `    if (kv.first == key) return &kv.second;`,
      to: `    if (kv.first != key) return &kv.second;`,
    },
    {
      note: "Keys.mount：注册到回收面",
      file: "native/lfw/keys.cpp",
      from: `void Keys::mount() { _lfw->regist_keys(*this); }`,
      to: `void Keys::mount() { _lfw->recycle_keys(*this); }`,
    },
    {
      note: "Keys.time：不读 world.lifetime",
      file: "native/lfw/keys.cpp",
      from: `double Keys::time() const { return _lfw->lifetime(); }`,
      to: `  double time() const { return 0.0; }`,
    },
    {
      note: "eval_number：nullish 不返 0",
      file: "native/lfw/utils/eval_number.cpp",
      from: `  if (s == nullptr) return 0.0;`,
      to: `  if (s == nullptr) return 1.0;`,
    },
    {
      note: "eval_number：number 不走直通",
      file: "native/lfw/utils/eval_number.cpp",
      from: `  if (const double* const d = std::get_if<double>(&value)) return *d;`,
      to: `  if (std::get_if<double>(&value) != nullptr) return 0;`,
    },
    {
      note: "eval_number：减法当加法",
      file: "native/lfw/utils/eval_number.cpp",
      from: `      v = c == u'+' ? v + r : v - r;`,
      to: `      v = v + r;`,
    },
    {
      note: "eval_number：除法当乘法",
      file: "native/lfw/utils/eval_number.cpp",
      from: `      v = c == u'*' ? v * r : v / r;`,
      to: `      v = v * r;`,
    },
  ],
};