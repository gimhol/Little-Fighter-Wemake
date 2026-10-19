#include "lfw/buff/buff.h"

#include <memory>

#include "lfw/defines/gone_frame_info.h"
#include "lfw/lfw.h"
#include "lfw/world.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/type_cast.h"

namespace lfw {
namespace buff {
namespace {

std::vector<Value> times_items(const std::array<double, 5>& a) {
  std::vector<Value> v;
  for (double d : a) v.push_back(Value(d));
  return v;
}

Value times_value(const std::array<double, 5>& a) {
  Object o;
  o.set(u"nums", Value(std::make_shared<Array>(times_items(a))));
  return Value(std::make_shared<Object>(o));
}

std::array<double, 5> times_read(const Value& v) {
  std::array<double, 5> out = {0, 0, 0, 0, 0};
  const Array* a = as_array(field_or(v, u"nums"));
  if (a == nullptr) return out;
  for (size_t i = 0; i < 5 && i < a->size(); ++i) out[i] = to_number(a->at(i));
  return out;
}

}

Buff::Buff(LFW& lfw, const std::u16string& id, const Value& kind)
    : _lfw(&lfw), _world(&lfw.world()), _id(id), _kind(kind) {
  _lifetime.set_lifes(1.0);
}

// 池化复用可能把这个对象交给别的 `LFW`（`Factory::create_buff` 那条路）⇒ 上一局的
// `_effects` / `_victims` / `_effect_data` 全部作废。
void Buff::rebind_lfw(LFW& lfw) {
  if (_lfw == &lfw) return;
  drop_cached_refs();
  _lfw = &lfw;
  _world = &lfw.world();
}

Entity* Buff::attacter() {
  if (_attacker_id.empty()) {
    _attacker = nullptr;
    return _attacker;
  }
  if (_attacker != nullptr && _attacker->id == _attacker_id) {
    _attacker = _world->find_entity(_attacker_id);
    return _attacker;
  }
  return _attacker;
}

void Buff::reset(const std::u16string& id) {
  clear_effects();
  const std::u16string prev = _id;
  if (prev != id) {
    for (const std::u16string& vid : _victims) {
      Entity* v = _world->find_entity(vid);
      if (v != nullptr) v->buffs_delete(prev);
    }
  }
  _id = id;
  _attacker = nullptr;
  _attacker_id.clear();
  _level = 0;
  _mounted = false;
  _victims.clear();
  _ticker.reborn();
  _lifetime.set_range(0.0, 1.0);
  _lifetime.set_lifes(1.0);
}

void Buff::set_attacker_by_id(const std::u16string& id) {
  _attacker = _world->find_entity(id);
  _attacker_id = id;
}

void Buff::set_attacker_entity(Entity* e) {
  _attacker = e;
  _attacker_id = e != nullptr ? e->id : std::u16string();
}

void Buff::set_victim(Entity* victim) {
  for (const std::u16string& vid : _victims) {
    Entity* v = _world->find_entity(vid);
    if (v != nullptr) v->buffs_set(_id, this);
  }
  _victims.clear();
  add_victim(victim);
}

void Buff::add_victim(Entity* victim) {
  if (victim == nullptr) return;
  for (const std::u16string& vid : _victims) {
    if (vid == victim->id) return;
  }
  _victims.push_back(victim->id);
  victim->buffs_set(_id, this);
}

void Buff::del_victim(Entity* victim) {
  if (victim == nullptr) return;
  del_effect(victim->id);
  del_id(victim->id);
  victim->buffs_delete(_id);
}

bool Buff::del_id(const std::u16string& id) {
  size_t fast = 0;
  size_t slow = 0;
  const size_t len = _victims.size();
  for (; fast < len; ++fast) {
    if (slow < fast) _victims[slow] = _victims[fast];
    if (_victims[fast] == id) continue;
    ++slow;
  }
  _victims.resize(slow);
  return slow != fast;
}

Value Buff::effect_data() {
  const std::u16string oid = effect_oid();
  if (oid.empty()) return Value();
  if (!_effect_data_loaded) {
    _effect_data = _lfw->datas_find(Value(oid));
    _effect_data_loaded = true;
  }
  return _effect_data;
}

void Buff::place_effect(Entity* effect, Entity* victim) {
  effect->set_position(victim->position.x, victim->position.y, victim->position.z + 0.5);
}

void Buff::place_effect_center(Entity* effect, Entity* victim) {
  const double centery = victim->frame_centery();
  const double height = victim->frame_height();
  const double h = height != 0 ? height : victim->frame_pic_h();
  effect->set_position(victim->position.x, victim->position.y + centery - h / 2,
                       victim->position.z + 0.5);
}

void Buff::del_effect(const std::u16string& vid) {
  for (size_t i = 0; i < _effects.size(); ++i) {
    if (_effects[i].first != vid) continue;
    _effects[i].second->set_frame(gone_frame_info());
    _effects.erase(_effects.begin() + static_cast<std::ptrdiff_t>(i));
    return;
  }
}

void Buff::clear_effects() {
  for (const auto& e : _effects) e.second->set_frame(gone_frame_info());
  _effects.clear();
}

void Buff::drop_cached_refs() {
  _effects.clear();
  _victims.clear();
  _attacker = nullptr;
  _attacker_id.clear();
  _effect_data = Value();
  _effect_data_loaded = false;
}

void Buff::show_effect(Entity* victim) {
  if (victim == nullptr) return;
  Entity* effect = nullptr;
  for (const auto& e : _effects) {
    if (e.first == victim->id) effect = e.second;
  }
  if (effect != nullptr && _world->find_entity(effect->id) == nullptr) effect = nullptr;
  if (effect == nullptr) {
    const Value data = effect_data();
    if (!truthy(data)) return;
    effect = _lfw->create_entity(*_world, data);
    if (effect == nullptr) return;
    effect->set_outline_alpha(0);
    effect->set_outline_width(0);
    effect->set_outline_color(std::u16string());
    place_effect(effect, victim);
    effect->enter_frame_by_id(effect_frame_id());
    effect->attach(true);
    bool replaced = false;
    for (auto& e : _effects) {
      if (e.first == victim->id) {
        e.second = effect;
        replaced = true;
      }
    }
    if (!replaced) _effects.emplace_back(victim->id, effect);
  }
  place_effect(effect, victim);
}

void Buff::update_effects() {
  if (_effects.empty() && effect_oid().empty()) return;
  for (size_t i = 0; i < _effects.size();) {
    const std::u16string vid = _effects[i].first;
    Entity* effect = _effects[i].second;
    bool keep = false;
    for (const std::u16string& v : _victims) {
      if (v == vid) keep = true;
    }
    if (keep && _world->find_entity(vid) != nullptr && _world->find_entity(effect->id) != nullptr) {
      ++i;
      continue;
    }
    effect->set_frame(gone_frame_info());
    _effects.erase(_effects.begin() + static_cast<std::ptrdiff_t>(i));
  }
  for (const std::u16string& vid : _victims) {
    Entity* victim = _world->find_entity(vid);
    if (victim != nullptr) show_effect(victim);
  }
}

void Buff::update(double d) {
  bool resolved = false;
  Entity* attacker = nullptr;
  if (has_on_update()) {
    if (!resolved) {
      attacker = attacter();
      resolved = true;
    }
    for (const std::u16string& vid : _victims) on_update(attacker, _world->find_entity(vid));
  }
  if (_ticker.add(d) && has_on_tick()) {
    if (!resolved) {
      attacker = attacter();
      resolved = true;
    }
    for (const std::u16string& vid : _victims) on_tick(attacker, _world->find_entity(vid));
  }
  if (_lifetime.add() && has_on_end()) {
    if (!resolved) {
      attacker = attacter();
      resolved = true;
    }
    for (const std::u16string& vid : _victims) on_end(attacker, _world->find_entity(vid));
  }
  update_effects();
}

Value Buff::to_snapshot() const {
  Object o;
  o.set(u"attacker_id", Value(_attacker_id));
  o.set(u"level", Value(_level));
  o.set(u"mounted", Value(_mounted));
  std::vector<Value> victims;
  for (const std::u16string& v : _victims) victims.push_back(Value(v));
  o.set(u"victims", Value(std::make_shared<Array>(victims)));
  o.set(u"ticker", times_value(_ticker.to_snapshot()));
  o.set(u"lifetime", times_value(_lifetime.to_snapshot()));
  return Value(std::make_shared<Object>(o));
}

void Buff::read_snapshot(const Value& s) {
  _attacker_id = to_string(field_or(s, u"attacker_id"));
  _attacker = _attacker_id.empty() ? nullptr : _world->find_entity(_attacker_id);
  _level = to_number(field_or(s, u"level"));
  _mounted = truthy(field_or(s, u"mounted"));
  _victims.clear();
  if (const Array* a = as_array(field_or(s, u"victims"))) {
    for (size_t i = 0; i < a->size(); ++i) _victims.push_back(to_string(a->at(i)));
  }
  _ticker.read_snapshot(times_read(field_or(s, u"ticker")));
  _lifetime.read_snapshot(times_read(field_or(s, u"lifetime")));
}

void Buff::mount() {
  if (_mounted) return;
  _mounted = true;
  _world->buffs_set(_id, this);
}

void Buff::unmount() {
  if (!_mounted) return;
  _mounted = false;
  while (!_victims.empty()) {
    const std::u16string vid = _victims[0];
    del_effect(vid);
    del_id(vid);
    Entity* v = _world->find_entity(vid);
    if (v != nullptr) v->buffs_delete(_id);
  }
}

Buff* grant_buff(const std::u16string& kind, Entity* attacker, Entity* victim,
                 double duration) {
  if (victim == nullptr) return nullptr;
  LFW& lfw = victim->lfw();
  World& world = victim->world();
  const std::u16string id = kind + u"_" + victim->id;
  Buff* buf = world.buffs_get(id);
  if (buf == nullptr) buf = lfw.create_buff(kind, id);
  if (buf == nullptr) return nullptr;
  buf->rebind_lfw(lfw);
  buf->set_lifetime(0);
  buf->set_duration(duration);
  buf->set_level(buf->level() + 1);
  if (attacker != nullptr) buf->set_attacker_entity(attacker);
  buf->set_victim(victim);
  buf->mount();
  return buf;
}

}
}
