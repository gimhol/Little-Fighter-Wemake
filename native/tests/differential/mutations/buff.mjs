// buff 变异规格
// 覆盖 native/lfw/buff/buff.{h,cpp}（Buff 生命周期 / 受害者表压缩 / Times 三重计时 /
// 特效实体跟随 / 快照往返 / grant_buff）与 native/lfw/defines/gone_frame_info.h。
//
// 单元边界：Buff 要读写 Entity/World/LFW，故用 IBuffEntity + BuffEnv 注入
// （与 CtrlEnv / HandlersEnv 同型）。harness 记录调用序列与落地值。
//
// 不可变异类(记录，不计入):
//   1. 回调用 std::function 的判空守卫：移除后 std::bad_function_call(_HAS_EXCEPTIONS=0)，属崩溃类。
//   2. `read_snapshot` 对数组长度的越界守卫：TS 对短数组抛错，差分喂不进去。
//
// 已证明不可观测的变异（已删除）:
//   - `attacter 兜底返回空`：第三个分支要求 `_attacker` 与 `_attacker_id` 不一致，
//     而 set_attacker_by_id/set_attacker_entity/read_snapshot 三个入口都会同步两者，
//     公开 API 无法造成不一致，该分支在 harness 内不可达。
//   - `reset 寿命总量错`（set_lifes(1)→2）：`dead` 只看 `remains == 0`，
//     reset 后 remains 为 1 或 2 都不为 0，两种取值下 dead 均为 false，观测等价。
//   - `del_id 搬移条件`（slow<fast → slow<=fast）：slow==fast 时该赋值是自赋值，
//     语义不变（后续用慢指针读回被搬移的元素，自赋值不改变数组内容）。
//   - `grant 无施放者仍写`：TS 的 set_attacker(undefined) 会在 `attacker.id` 抛 TypeError，
//     差分无法构造「无施放者」的 grant；且 C++ 的 set_attacker_entity(nullptr) 结果与跳过它一致。
//
// 未杀条目（留待下一轮，带诊断）:
//   - `attacter 重找判定取反`：需要「缓存 _attacker 非空 + _attacker_id 相等 + 该实体已被删」
//     三条件同时成立。用例已含 attacker 实体删除段（env entity "A" 0），但实测两边输出相同，
//     说明进入该分支时 `_attacker` 已被置空。下一步：在那次 update 前先打 `buff snap`（含 aid）
//     与日志，确认 _attacker 是否为空，再决定是改用例还是改入口。
export default {
  subject: "buff",
  mutations: [
    { note: "attacter 空 id 判定取反", file: "native/lfw/buff/buff.cpp", from: `  if (_attacker_id.empty()) {`, to: `  if (!_attacker_id.empty()) {` },
    { note: "attacter 重找判定取反", file: "native/lfw/buff/buff.cpp", from: `  if (_attacker != nullptr && _attacker->id == _attacker_id) {`, to: `  if (_attacker != nullptr && _attacker->id != _attacker_id) {` },
    { note: "reset 身份比较取反", file: "native/lfw/buff/buff.cpp", from: `  if (prev != id && _env != nullptr) {`, to: `  if (prev == id && _env != nullptr) {` },
    { note: "reset 不清旧挂载", file: "native/lfw/buff/buff.cpp", from: `      if (v != nullptr) v->buffs_delete(prev);\n    }\n  }\n  _id = id;`, to: `      (void)v;\n    }\n  }\n  _id = id;` },
    { note: "reset 不清等级", file: "native/lfw/buff/buff.cpp", from: `  _level = 0;\n  _mounted = false;`, to: `  _level = 1;\n  _mounted = false;` },
    { note: "reset 不摘挂载位", file: "native/lfw/buff/buff.cpp", from: `  _mounted = false;\n  _victims.clear();`, to: `  _mounted = true;\n  _victims.clear();` },
    { note: "reset 不重生 ticker", file: "native/lfw/buff/buff.cpp", from: `  _ticker.reborn();\n  _lifetime.set_range(0.0, 1.0);`, to: `  _lifetime.set_range(0.0, 1.0);` },
    { note: "reset 寿命范围错", file: "native/lfw/buff/buff.cpp", from: `  _lifetime.set_range(0.0, 1.0);\n  _lifetime.set_lifes(1.0);`, to: `  _lifetime.set_range(0.0, 2.0);\n  _lifetime.set_lifes(1.0);` },
    { note: "set_attacker_by_id 不存 id", file: "native/lfw/buff/buff.cpp", from: `  _attacker = _env->find_entity(id);\n  _attacker_id = id;`, to: `  _attacker = _env->find_entity(id);` },
    { note: "set_attacker_entity 不存 id", file: "native/lfw/buff/buff.cpp", from: `  _attacker_id = e != nullptr ? e->id : std::u16string();`, to: `  _attacker_id = std::u16string();` },
    { note: "set_victim 不清旧表", file: "native/lfw/buff/buff.cpp", from: `  _victims.clear();\n  add_victim(victim);`, to: `  add_victim(victim);` },
    { note: "set_victim 不刷新旧挂载", file: "native/lfw/buff/buff.cpp", from: `    if (v != nullptr) v->buffs_set(_id, this);\n  }\n  _victims.clear();`, to: `    (void)v;\n  }\n  _victims.clear();` },
    { note: "add_victim 不去重", file: "native/lfw/buff/buff.cpp", from: `  for (const std::u16string& vid : _victims) {\n    if (vid == victim->id) return;\n  }`, to: `  for (const std::u16string& vid : _victims) {\n    if (vid == victim->id) break;\n  }` },
    { note: "add_victim 不登记到受害者", file: "native/lfw/buff/buff.cpp", from: `  _victims.push_back(victim->id);\n  victim->buffs_set(_id, this);`, to: `  _victims.push_back(victim->id);` },
    { note: "del_victim 不删特效", file: "native/lfw/buff/buff.cpp", from: `  del_effect(victim->id);\n  del_id(victim->id);`, to: `  del_id(victim->id);` },
    { note: "del_victim 不删挂载", file: "native/lfw/buff/buff.cpp", from: `  del_id(victim->id);\n  victim->buffs_delete(_id);`, to: `  del_id(victim->id);` },
    { note: "del_id 删除判定取反", file: "native/lfw/buff/buff.cpp", from: `    if (_victims[fast] == id) continue;`, to: `    if (_victims[fast] != id) continue;` },
    { note: "del_id 不截断", file: "native/lfw/buff/buff.cpp", from: `  _victims.resize(slow);\n  return slow != fast;`, to: `  return slow != fast;` },
    { note: "del_id 返回值取反", file: "native/lfw/buff/buff.cpp", from: `  return slow != fast;`, to: `  return slow == fast;` },
    { note: "effect_data 空 oid 判定取反", file: "native/lfw/buff/buff.cpp", from: `  if (oid.empty()) return Value();`, to: `  if (!oid.empty()) return Value();` },
    { note: "effect_data 不缓存", file: "native/lfw/buff/buff.cpp", from: `  if (!_effect_data_loaded) {\n    _effect_data = _env->find_data(oid);\n    _effect_data_loaded = true;\n  }`, to: `  _effect_data = _env->find_data(oid);` },
    { note: "place_effect 偏移丢失", file: "native/lfw/buff/buff.cpp", from: `  effect->set_position(victim->position.x, victim->position.y, victim->position.z + 0.5);`, to: `  effect->set_position(victim->position.x, victim->position.y, victim->position.z);` },
    { note: "place_center 高度取反", file: "native/lfw/buff/buff.cpp", from: `  const double h = height != 0 ? height : victim->frame_pic_h();`, to: `  const double h = victim->frame_pic_h();` },
    { note: "place_center 减半改加", file: "native/lfw/buff/buff.cpp", from: `  effect->set_position(victim->position.x, victim->position.y + centery - h / 2,\n                       victim->position.z + 0.5);`, to: `  effect->set_position(victim->position.x, victim->position.y + centery + h / 2,\n                       victim->position.z + 0.5);` },
    { note: "del_effect 匹配取反", file: "native/lfw/buff/buff.cpp", from: `    if (_effects[i].first != vid) continue;`, to: `    if (_effects[i].first == vid) continue;` },
    { note: "del_effect 不隐藏特效", file: "native/lfw/buff/buff.cpp", from: `    _effects[i].second->set_frame(gone_frame_info());\n    _effects.erase(_effects.begin() + static_cast<std::ptrdiff_t>(i));`, to: `    _effects.erase(_effects.begin() + static_cast<std::ptrdiff_t>(i));` },
    { note: "clear_effects 不隐藏", file: "native/lfw/buff/buff.cpp", from: `  for (const auto& e : _effects) e.second->set_frame(gone_frame_info());\n  _effects.clear();`, to: `  _effects.clear();` },
    { note: "show_effect 不校验存活", file: "native/lfw/buff/buff.cpp", from: `  if (effect != nullptr && _env->find_entity(effect->id) == nullptr) effect = nullptr;`, to: `` },
    { note: "show_effect 数据判定取反", file: "native/lfw/buff/buff.cpp", from: `    if (!truthy(data)) return;`, to: `    if (truthy(data)) return;` },
    { note: "show_effect 轮廓透明度", file: "native/lfw/buff/buff.cpp", from: `    effect->set_outline_alpha(0);`, to: `    effect->set_outline_alpha(1);` },
    { note: "show_effect 不进帧", file: "native/lfw/buff/buff.cpp", from: `    effect->enter_frame_by_id(effect_frame_id());\n    effect->attach(true);`, to: `    effect->attach(true);` },
    { note: "show_effect 不附着", file: "native/lfw/buff/buff.cpp", from: `    effect->attach(true);\n    bool replaced = false;`, to: `    effect->attach(false);\n    bool replaced = false;` },
    { note: "show_effect 覆盖判定取反", file: "native/lfw/buff/buff.cpp", from: `      if (e.first == victim->id) {\n        e.second = effect;\n        replaced = true;`, to: `      if (e.first != victim->id) {\n        e.second = effect;\n        replaced = true;` },
    { note: "show_effect 落点键错", file: "native/lfw/buff/buff.cpp", from: `    if (!replaced) _effects.emplace_back(victim->id, effect);\n  }\n  place_effect(effect, victim);`, to: `    if (!replaced) _effects.emplace_back(effect->id, effect);\n  }\n  place_effect(effect, victim);` },
    { note: "update_effects 早退判定", file: "native/lfw/buff/buff.cpp", from: `  if (_effects.empty() && effect_oid().empty()) return;`, to: `  if (_effects.empty() || effect_oid().empty()) return;` },
    { note: "update_effects 不隐藏过期", file: "native/lfw/buff/buff.cpp", from: `    effect->set_frame(gone_frame_info());\n    _effects.erase(_effects.begin() + static_cast<std::ptrdiff_t>(i));\n  }`, to: `    _effects.erase(_effects.begin() + static_cast<std::ptrdiff_t>(i));\n  }` },
    { note: "update 挂钩用错", file: "native/lfw/buff/buff.cpp", from: `  if (has_on_update()) {`, to: `  if (has_on_tick()) {` },
    { note: "update 计时器忽略 d", file: "native/lfw/buff/buff.cpp", from: `  if (_ticker.add(d) && has_on_tick()) {`, to: `  if (_ticker.add(1) && has_on_tick()) {` },
    { note: "update 结束钩判定", file: "native/lfw/buff/buff.cpp", from: `  if (_lifetime.add() && has_on_end()) {`, to: `  if (has_on_end()) {` },
    { note: "update 不解施放者", file: "native/lfw/buff/buff.cpp", from: `    if (!resolved) {\n      attacker = attacter();\n      resolved = true;\n    }\n    for (const std::u16string& vid : _victims) on_update(attacker, _env->find_entity(vid));`, to: `    for (const std::u16string& vid : _victims) on_update(attacker, _env->find_entity(vid));` },
    { note: "update 不刷特效", file: "native/lfw/buff/buff.cpp", from: `  update_effects();\n}\n\nValue Buff::to_snapshot`, to: `}\n\nValue Buff::to_snapshot` },
    { note: "快照 ticker/lifetime 互换", file: "native/lfw/buff/buff.cpp", from: `  o.set(u"ticker", times_value(_ticker.to_snapshot()));\n  o.set(u"lifetime", times_value(_lifetime.to_snapshot()));`, to: `  o.set(u"ticker", times_value(_lifetime.to_snapshot()));\n  o.set(u"lifetime", times_value(_ticker.to_snapshot()));` },
    { note: "快照施放者 id 置空", file: "native/lfw/buff/buff.cpp", from: `  o.set(u"attacker_id", Value(_attacker_id));`, to: `  o.set(u"attacker_id", Value(std::u16string()));` },
    { note: "读快照不找施放者", file: "native/lfw/buff/buff.cpp", from: `  _attacker = _attacker_id.empty() ? nullptr : _env->find_entity(_attacker_id);`, to: `  _attacker = nullptr;` },
    { note: "读快照挂载位取反", file: "native/lfw/buff/buff.cpp", from: `  _mounted = truthy(field_or(s, u"mounted"));`, to: `  _mounted = !truthy(field_or(s, u"mounted"));` },
    { note: "读快照丢受害者", file: "native/lfw/buff/buff.cpp", from: `    for (size_t i = 0; i < a->size(); ++i) _victims.push_back(to_string(a->at(i)));`, to: `    (void)a;` },
    { note: "读快照计时器互换", file: "native/lfw/buff/buff.cpp", from: `  _ticker.read_snapshot(times_read(field_or(s, u"ticker")));\n  _lifetime.read_snapshot(times_read(field_or(s, u"lifetime")));`, to: `  _ticker.read_snapshot(times_read(field_or(s, u"lifetime")));\n  _lifetime.read_snapshot(times_read(field_or(s, u"ticker")));` },
    { note: "mount 幂等判定取反", file: "native/lfw/buff/buff.cpp", from: `  if (_mounted) return;`, to: `  if (!_mounted) return;` },
    { note: "mount 不挂到世界", file: "native/lfw/buff/buff.cpp", from: `  _mounted = true;\n  _env->world_buffs_set(_id, this);`, to: `  _mounted = true;` },
    { note: "unmount 不摘挂载位", file: "native/lfw/buff/buff.cpp", from: `  if (!_mounted) return;\n  _mounted = false;`, to: `  if (!_mounted) return;` },
    { note: "unmount 取尾元素", file: "native/lfw/buff/buff.cpp", from: `    const std::u16string vid = _victims[0];`, to: `    const std::u16string vid = _victims[_victims.size() - 1];` },
    { note: "unmount 不通知受害者", file: "native/lfw/buff/buff.cpp", from: `    if (v != nullptr) v->buffs_delete(_id);\n  }`, to: `    (void)v;\n  }` },
    { note: "grant 不查已有", file: "native/lfw/buff/buff.cpp", from: `  if (env->world_buffs_get) buf = env->world_buffs_get(id);\n  if (buf == nullptr && env->create_buff) buf = env->create_buff(kind, id);`, to: `  if (env->create_buff) buf = env->create_buff(kind, id);` },
    { note: "grant id 分隔符丢失", file: "native/lfw/buff/buff.cpp", from: `  const std::u16string id = kind + u"_" + (victim != nullptr ? victim->id : std::u16string());`, to: `  const std::u16string id = kind + (victim != nullptr ? victim->id : std::u16string());` },
    { note: "grant 不清寿命", file: "native/lfw/buff/buff.cpp", from: `  buf->set_lifetime(0);\n  buf->set_duration(duration);`, to: `  buf->set_duration(duration);` },
    { note: "grant 不传时长", file: "native/lfw/buff/buff.cpp", from: `  buf->set_duration(duration);\n  buf->set_level(buf->level() + 1);`, to: `  buf->set_level(buf->level() + 1);` },
    { note: "grant 不加等级", file: "native/lfw/buff/buff.cpp", from: `  buf->set_level(buf->level() + 1);`, to: `  buf->set_level(buf->level());` },
    { note: "grant 不设受害者", file: "native/lfw/buff/buff.cpp", from: `  buf->set_victim(victim);\n  buf->mount();`, to: `  buf->mount();` },
    { note: "grant 不挂载", file: "native/lfw/buff/buff.cpp", from: `  buf->mount();\n  return buf;`, to: `  return buf;` },
    { note: "gone 帧 no_shadow", file: "native/lfw/defines/gone_frame_info.h", from: `    o.set(u"no_shadow", Value(1.0));`, to: `    o.set(u"no_shadow", Value(0.0));` },
    { note: "gone 帧 name 错", file: "native/lfw/defines/gone_frame_info.h", from: `    o.set(u"name", Value(std::u16string(u"GONE_FRAME_INFO")));`, to: `    o.set(u"name", Value(std::u16string(u"GONE")));` },
  ],
};
