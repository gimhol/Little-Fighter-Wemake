#include "lfw/collision/actor_handle.h"

#include "lfw/buff/buff_group_attack.h"
#include "lfw/controller/base_controller.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/type_cast.h"

namespace lfw {
namespace collision {
namespace {

// `Entity::emitter()` 是「有就给字符串、没有给 nullptr」（TS 的 `undefined`）。
Value from_str(const std::u16string* p) { return p == nullptr ? Value() : Value(*p); }

}

ActorHandle ActorHandle::of(const Entity& e) {
  ActorHandle h;
  h._entity = &e;
  h._id = e.id;
  return h;
}

ActorHandle ActorHandle::of(const CollisionActor& a) {
  ActorHandle h;
  h._id = a.id;
  h._snap = a;
  h._snap_built = true;
  return h;
}

const std::u16string& ActorHandle::id() const {
  if (_entity != nullptr) return _id;
  ensure_snapshot();
  return _snap.id;
}

const Entity* ActorHandle::entity() const {
  if (_entity == nullptr) return nullptr;
  return _entity->id == _id ? _entity : nullptr;
}

void ActorHandle::ensure_snapshot() const {
  if (_snap_built) return;
  _snap_built = true;
  const Entity* const e = entity();
  if (e == nullptr) {
    _snap = CollisionActor();
    _snap.id = _id;
    return;
  }
  CollisionActor& a = _snap;
  a = CollisionActor();
  a.id = e->id;
  a.px = e->position.x;
  a.py = e->position.y;
  a.pz = e->position.z;
  a.data_id = to_string(field_or(e->data(), u"id"));
  a.data_type = to_number(field_or(e->data(), u"type"));
  a.frame = e->frame;
  a.itr_prefabs = field_or(e->data(), u"itr_prefabs");
  a.bear_wpoint_attacking =
      e->bearer == nullptr ? Value()
                           : field_or(field_or(e->bearer->frame, u"wpoint"), u"attacking");
  a.marks_group_attack =
      e->marks.find(std::u16string(buff::Buff_GroupAttack::KIND)) != e->marks.end();
  a.dropping = e->dropping;
  a.arest = Value(e->arest());
  a.has_catcher = e->catcher != nullptr;
  a.catcher_hurtable =
      e->catcher == nullptr ? Value() : field_or(field_or(e->catcher->frame, u"cpoint"), u"hurtable");
  a.invulnerable = Value(e->invulnerable());
  a.bot_ignore = e->bot_ignore();
  a.team = Value(e->team());
  a.emitter = from_str(e->emitter());
  a.spawn_time = Value(e->spawn_time());
  a.is_bot_ctrl = e->ctrl() != nullptr && e->ctrl()->is_bot();
}

const CollisionActor& ActorHandle::snapshot() const {
  ensure_snapshot();
  return _snap;
}

CollisionActor& ActorHandle::snap_mut() {
  ensure_snapshot();
  // 写进来的值只对台面有意义（真实运行时的写入都走 `HandlersEnv` 的缝）⇒ 以后按快照读。
  _entity = nullptr;
  return _snap;
}

double ActorHandle::px() const {
  const Entity* const e = entity();
  return e != nullptr ? e->position.x : snapshot().px;
}

double ActorHandle::py() const {
  const Entity* const e = entity();
  return e != nullptr ? e->position.y : snapshot().py;
}

double ActorHandle::pz() const {
  const Entity* const e = entity();
  return e != nullptr ? e->position.z : snapshot().pz;
}

std::u16string ActorHandle::data_id() const {
  const Entity* const e = entity();
  return e != nullptr ? to_string(field_or(e->data(), u"id")) : snapshot().data_id;
}

double ActorHandle::data_type() const {
  const Entity* const e = entity();
  return e != nullptr ? to_number(field_or(e->data(), u"type")) : snapshot().data_type;
}

Value ActorHandle::frame() const {
  const Entity* const e = entity();
  return e != nullptr ? e->frame : snapshot().frame;
}

Value ActorHandle::itr_prefabs() const {
  const Entity* const e = entity();
  return e != nullptr ? field_or(e->data(), u"itr_prefabs") : snapshot().itr_prefabs;
}

Value ActorHandle::bear_wpoint_attacking() const {
  const Entity* const e = entity();
  if (e == nullptr) return snapshot().bear_wpoint_attacking;
  return e->bearer == nullptr ? Value()
                              : field_or(field_or(e->bearer->frame, u"wpoint"), u"attacking");
}

bool ActorHandle::marks_group_attack() const {
  const Entity* const e = entity();
  if (e == nullptr) return snapshot().marks_group_attack;
  return e->marks.find(std::u16string(buff::Buff_GroupAttack::KIND)) != e->marks.end();
}

bool ActorHandle::dropping() const {
  const Entity* const e = entity();
  return e != nullptr ? e->dropping : snapshot().dropping;
}

Value ActorHandle::arest() const {
  const Entity* const e = entity();
  return e != nullptr ? Value(e->arest()) : snapshot().arest;
}

bool ActorHandle::has_catcher() const {
  const Entity* const e = entity();
  return e != nullptr ? e->catcher != nullptr : snapshot().has_catcher;
}

Value ActorHandle::catcher_hurtable() const {
  const Entity* const e = entity();
  if (e == nullptr) return snapshot().catcher_hurtable;
  return e->catcher == nullptr ? Value()
                               : field_or(field_or(e->catcher->frame, u"cpoint"), u"hurtable");
}

Value ActorHandle::invulnerable() const {
  const Entity* const e = entity();
  return e != nullptr ? Value(e->invulnerable()) : snapshot().invulnerable;
}

Value ActorHandle::bot_ignore() const {
  const Entity* const e = entity();
  return e != nullptr ? e->bot_ignore() : snapshot().bot_ignore;
}

Value ActorHandle::team() const {
  const Entity* const e = entity();
  return e != nullptr ? Value(e->team()) : snapshot().team;
}

Value ActorHandle::emitter() const {
  const Entity* const e = entity();
  return e != nullptr ? from_str(e->emitter()) : snapshot().emitter;
}

Value ActorHandle::spawn_time() const {
  const Entity* const e = entity();
  return e != nullptr ? Value(e->spawn_time()) : snapshot().spawn_time;
}

bool ActorHandle::is_bot_ctrl() const {
  const Entity* const e = entity();
  if (e == nullptr) return snapshot().is_bot_ctrl;
  return e->ctrl() != nullptr && e->ctrl()->is_bot();
}

}
}
