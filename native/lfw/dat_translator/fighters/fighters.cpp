#include "lfw/dat_translator/fighters/fighters.h"

#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <variant>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/dat_translator/cond_maker.h"
#include "lfw/dat_translator/helpers.h"
#include "lfw/dat_translator/value_builder.h"
#include "lfw/defines/action_type.h"
#include "lfw/defines/armor_enum.h"
#include "lfw/defines/bdy_kind.h"
#include "lfw/defines/collision_val.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/entity_group.h"
#include "lfw/defines/entity_val.h"
#include "lfw/defines/hit_flag.h"
#include "lfw/defines/itr_effect.h"
#include "lfw/defines/itr_kind.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/state_enum.h"
#include "lfw/utils/container_help/ensure.h"
#include "lfw/utils/container_help/traversal.h"

namespace lfw {
namespace dat_translator {
namespace {

bool is_nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

Value* member(Value& v, const char16_t* key) {
  Object* o = as_object(v);
  if (o == nullptr) return nullptr;
  return const_cast<Value*>(o->get(std::u16string(key)));
}

Object* member_object(Value& v, const char16_t* key) {
  Value* p = member(v, key);
  return p != nullptr ? as_object(*p) : nullptr;
}

Value value_or_undefined(const Object& o, const char16_t* key) {
  const Value* p = o.get(std::u16string(key));
  return p != nullptr ? *p : Value();
}

Value* element_at(Value& container, double index) {
  if (Array* a = as_array(container)) {
    const size_t i = static_cast<size_t>(index);
    return i < a->size() ? &a->at(i) : nullptr;
  }
  Object* o = as_object(container);
  if (o == nullptr) return nullptr;
  return const_cast<Value*>(o->get(number_to_string(index)));
}

double hit_flag_or(HitFlag a, HitFlag b) {
  return static_cast<double>(static_cast<int>(a) | static_cast<int>(b));
}

void set_bg_face(Value& data, const char16_t* path) {
  Object* base = member_object(data, u"base");
  if (base == nullptr) return;
  const Value* cur = base->get(u"bg_face");
  if (cur != nullptr && !is_nullish(*cur)) return;
  base->set(u"bg_face", Value(std::u16string(path)));
}

void set_armor(Value& data, const Value& armor) {
  Object* base = member_object(data, u"base");
  if (base == nullptr) return;
  base->set(u"armor", armor);
}

// TS 里那几个 `frames[k].opoint?.forEach(op => op.oid === X && …)` 的公共骨架：
// 遍历所有帧的所有 opoint，oid 命中（`===`，故只认字符串）就交给 `fn`。
void for_each_opoint_in_frame(Value& frame, const char16_t* oid_text,
                              const std::function<void(Object*)>& fn) {
  Value* opoints = member(frame, u"opoint");
  if (opoints == nullptr || !truthy(*opoints)) return;
  Array* a = as_array(*opoints);
  if (a == nullptr) return;
  const Value target = s(oid_text);
  const size_t count = a->size();
  for (size_t i = 0; i < count; ++i) {
    Object* op = as_object(a->at(i));
    if (op == nullptr) continue;
    const Value* oid = op->get(u"oid");
    if (oid == nullptr || !strict_equals(*oid, target)) continue;
    fn(op);
  }
}

void for_each_opoint_of_frames(Value& data, const char16_t* oid_text,
                               const std::function<void(Object*)>& fn) {
  Value* frames = member(data, u"frames");
  if (frames == nullptr) return;
  traversal(*frames, [oid_text, &fn](const std::u16string&, Value& frame) {
    for_each_opoint_in_frame(frame, oid_text, fn);
  });
}

// `julian` / `rudolf` 分身出来的自己：opoint 生成时压低血量与蓝条。
void boost_opoint(Object* op) {
  op->set(u"max_hp", n(20));
  op->set(u"hp", n(20));
  op->set(u"max_mp", n(150));
  op->set(u"mp", n(150));
}

void boost_opoints_in_frame(Value& frame, const char16_t* oid_text) {
  for_each_opoint_in_frame(frame, oid_text, boost_opoint);
}

void boost_opoints_of_frames(Value& data, const char16_t* oid_text) {
  for_each_opoint_of_frames(data, oid_text, boost_opoint);
}

// TS `make_fighter_data_julian`：给指 oid 的 opoint 落 `speedz`（发射时按上下键给的 Z 初速）。
void set_opoint_speedz_of_frames(Value& data, const char16_t* oid_text, double speedz) {
  for_each_opoint_of_frames(
      data, oid_text, [speedz](Object* op) { op->set(u"speedz", n(speedz)); });
}

void for_each_running_frame(Value& data, const std::function<void(Object&)>& fn) {
  Value* frames = member(data, u"frames");
  if (frames == nullptr) return;
  Object* fo = as_object(*frames);
  if (fo == nullptr) return;
  static const char16_t* const kKeys[4] = {u"running_0", u"running_1", u"running_2",
                                           u"running_3"};
  for (const char16_t* key : kKeys) {
    const Value* p = fo->get(std::u16string(key));
    if (p == nullptr || !truthy(*p)) continue;
    Object* frame = as_object(const_cast<Value&>(*p));
    if (frame == nullptr) continue;
    fn(*frame);
  }
}

std::u16string vbuff_expression() {
  CondMaker cm;
  cm.add(s(entity_val::kIsSurvialRankMode), u"!=", n(1))
      .and_(s(entity_val::kHP_P), u"<=", n(33))
      .or_(s(entity_val::kLF2_NET_ON), u"==", n(1));
  return cm.done();
}

void add_electroshock(Value& frame, double duration) {
  Value* itrs = member(frame, u"itr");
  if (itrs == nullptr || !truthy(*itrs)) return;
  Array* a = as_array(*itrs);
  if (a == nullptr) return;
  const size_t count = a->size();
  for (size_t i = 0; i < count; ++i) {
    Object* itr = as_object(a->at(i));
    if (itr == nullptr) continue;
    const Value* kind = itr->get(u"kind");
    if (kind == nullptr || !strict_equals(*kind, n(0))) continue;
    const Value* effect = itr->get(u"effect");
    if (effect != nullptr && truthy(*effect)) continue;
    Value actions = value_or_undefined(*itr, u"actions");
    if (!truthy(actions)) {
      actions = Value(std::make_shared<Array>());
      itr->set(u"actions", actions);
    }
    Array* aa = as_array(actions);
    if (aa == nullptr) continue;
    aa->push_back(make_obj({
        {u"type", s(action_type::kV_BUFF)},
        {u"data", make_obj({
                     {u"hitflag", n(hit_flag_or(HitFlag::EnemyFighter, HitFlag::AllyFighter))},
                     {u"duration", n(duration)},
                     {u"buff", s(u"Electroshock")},
                 })},
    }));
  }
}

void apply_vbuff_expression(Value& frame) {
  Value* seqs = member(frame, u"seqs");
  if (seqs == nullptr || !truthy(*seqs)) return;
  Object* so = as_object(*seqs);
  if (so == nullptr) return;
  const Value* ja = so->get(u"ja");
  if (ja == nullptr || !truthy(*ja)) return;
  std::vector<Value> items;
  if (const Array* a = as_array(*ja)) {
    for (size_t i = 0; i < a->size(); ++i) items.push_back(a->at(i));
  } else {
    items.push_back(*ja);
  }
  for (Value& item : items) {
    Object* jo = as_object(item);
    if (jo == nullptr) continue;
    const Value* id = jo->get(u"id");
    if (id == nullptr || !strict_equals(*id, s(u"300"))) continue;
    jo->set(u"expression", Value(vbuff_expression()));
  }
}

void each_run_frame(Value& data, const std::function<void(Value&)>& fn) {
  Value* frames = member(data, u"frames");
  if (frames == nullptr) return;
  traversal(*frames, [&fn](const std::u16string& k, Value& frame) {
    const double frame_no = to_number(Value(k));
    if (frame_no >= 85.0 && frame_no <= 95.0) fn(frame);
  });
}

void set_rudolf_seqs(Value& frame) {
  Object* f = as_object(frame);
  if (f == nullptr) return;
  const Value* seqs = f->get(u"seqs");
  Value target = seqs != nullptr ? *seqs : Value();
  if (!truthy(target)) {
    target = Value(std::make_shared<Object>());
    f->set(u"seqs", target);
  }
  Object* so = as_object(target);
  if (so == nullptr) return;
  so->set(u"LRa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(1)}}));
  so->set(u"RLa", make_obj({{u"id", s(u"70")}, {u"mp", n(60)}, {u"facing", n(-1)}}));
}

bool is_rudolf_seq_state(const Object& f) {
  const Value* st = f.get(u"state");
  if (st == nullptr) return false;
  return strict_equals(*st, en(StateEnum::Standing)) ||
         strict_equals(*st, en(StateEnum::Walking)) ||
         strict_equals(*st, en(StateEnum::Defend));
}

}

void ensure_base_group(Value& data, const char16_t* group) {
  Object* base = member_object(data, u"base");
  if (base == nullptr) return;
  Value cur = value_or_undefined(*base, u"group");
  base->set(u"group", ensure(cur, Value(std::u16string(group))));
}

Value make_fighter_data_bat(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  set_bg_face(data, u"sprite/MENU_BACK1.png");
  return data;
}

Value make_fighter_data_davis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK2.png");
  return data;
}

Value make_fighter_data_deep(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK3.png");
  return data;
}

Value make_fighter_data_dennis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK4.png");
  return data;
}

Value make_fighter_data_firen(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK5.png");
  CondMaker cm;
  cm.add(s(collision_val::kBdyCode), u"==", n(123))
      .and_(s(collision_val::kVictimOID), u"==", s(oid::kFreeze))
      .and_(s(collision_val::kBdyHitFlag), u"==", en(HitFlag::AllyFighter))
      .and_(s(collision_val::kSameFacing), u"==", n(0));
  const std::pair<Value, Value> hf = hit_flag_pair(en(HitFlag::AllyFighter));
  for_each_running_frame(data, [&cm, &hf](Object& frame) {
    Value cur = value_or_undefined(frame, u"itr");
    frame.set(u"itr", ensure(cur, make_obj({
                                      {u"hit_flag", hf.first},
                                      {u"hit_flag_name", hf.second},
                                      {u"code", n(123)},
                                      {u"kind", en(ItrKind::Normal)},
                                      {u"effect", en(ItrEffect::Ignore)},
                                      {u"x", n(35)},
                                      {u"y", n(19)},
                                      {u"w", n(10)},
                                      {u"h", n(60)},
                                      {u"test", Value(cm.done())},
                                  })));
  });
  return data;
}

Value make_fighter_data_firzen(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  Object* base = member_object(data, u"base");
  if (base != nullptr) {
    base->set(u"mp_r_ratio", n(2));
    base->set(u"ce", n(2));
  }
  set_bg_face(data, u"sprite/MENU_BACK6.png");
  return data;
}

Value make_fighter_data_freeze(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK7.png");
  ensure_base_group(data, entity_group::kFreezer);
  CondMaker cm;
  cm.add(s(collision_val::kItrCode), u"==", n(123))
      .and_(s(collision_val::kAttackerOID), u"==", s(oid::kFiren))
      .and_(s(collision_val::kItrHitFlag), u"==",
            n(hit_flag_or(HitFlag::Fighter, HitFlag::Ally)))
      .and_(s(collision_val::kSameFacing), u"==", n(0))
      .and_([&cm](CondMaker& c) -> CondMaker* {
        c.add(s(collision_val::kV_HP_P), u"<=", n(33))
            .and_(s(collision_val::kA_HP_P), u"<", n(33))
            .or_(s(collision_val::kLF2_NET_ON), u"==", n(1));
        return &c;
      });
  const std::pair<Value, Value> hf = hit_flag_pair(en(HitFlag::AllyFighter));
  for_each_running_frame(data, [&cm, &hf](Object& frame) {
    Value cur = value_or_undefined(frame, u"bdy");
    frame.set(u"bdy", ensure(cur, make_obj({
                                      {u"hit_flag", hf.first},
                                      {u"hit_flag_name", hf.second},
                                      {u"code", n(123)},
                                      {u"kind", en(BdyKind::Normal)},
                                      {u"x", n(35)},
                                      {u"y", n(19)},
                                      {u"w", n(10)},
                                      {u"h", n(60)},
                                      {u"actions", make_arr({make_obj({
                                                       {u"type", s(action_type::kFUSION)},
                                                       {u"data", make_obj({
                                                                      {u"oid", s(oid::kFirzen)},
                                                                      {u"act", make_obj({{u"id", s(u"290")}})},
                                                                      {u"time", n(9000)},
                                                                  })},
                                                   })})},
                                      {u"test", Value(cm.done())},
                                  })));
  });
  return data;
}

Value make_fighter_data_henry(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK8.png");
  return data;
}

Value make_fighter_data_henter(Value& data) {
  ensure_base_group(data, entity_group::k_3000);
  Value* frames = member(data, u"frames");
  if (frames == nullptr) return data;
  Value* frame = element_at(*frames, 3.0);
  if (frame == nullptr) return data;
  Object* f = as_object(*frame);
  if (f == nullptr) return data;
  f->set(u"opoint", Value());
  return data;
}

Value make_fighter_data_jack(Value& data) { return data; }

Value make_fighter_data_jan(Value& data) {
  Object* base = member_object(data, u"base");
  if (base == nullptr) return data;
  const Value* files = base->get(u"files");
  if (files == nullptr || !truthy(*files)) return data;
  Value holder = *files;
  Value* f0 = element_at(holder, 0.0);
  if (f0 == nullptr) return data;
  Object* o0 = as_object(*f0);
  if (o0 == nullptr) return data;
  o0->set(u"variants", make_arr({s(u"2")}));
  Value* f1 = element_at(holder, 1.0);
  if (f1 == nullptr) return data;
  Object* o1 = as_object(*f1);
  if (o1 == nullptr) return data;
  o1->set(u"variants", make_arr({s(u"3")}));
  return data;
}

Value make_fighter_data_john(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK9.png");
  return data;
}

Value make_fighter_data_julian(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  Object* base = member_object(data, u"base");
  if (base != nullptr) {
    base->set(u"mp_r_ratio", n(2));
    base->set(u"ce", n(3));
  }
  set_bg_face(data, u"sprite/MENU_BACK10.png");
  set_armor(data, make_obj({
                       {u"fireproof", n(1)},
                       {u"antifreeze", n(1)},
                       {u"hit_sounds", make_arr({s(u"data/002.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(60)},
                       {u"toughness_resting", n(18)},
                   }));
  boost_opoints_of_frames(data, oid::kJulian);
  set_opoint_speedz_of_frames(data, oid::kJulianBall2,
                              defines::num(u"Defines.DEFAULT_OPOINT_SPEED_Z"));
  return data;
}

Value make_fighter_data_justin(Value& data) { return data; }

Value make_fighter_data_knight(Value& data) {
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Defend)},
                       {u"toughness", n(60)},
                       {u"toughness_resting", n(18)},
                   }));
  return data;
}

Value make_fighter_data_louis(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK11.png");
  set_armor(data, make_obj({
                       {u"hit_sounds", make_arr({s(u"data/085.wav.mp3")})},
                       {u"type", en(ArmorEnum::Times)},
                       {u"fulltime", Value(false)},
                       {u"toughness", n(1)},
                       {u"toughness_resting", n(90)},
                   }));
  each_run_frame(data, [](Value& frame) {
    add_electroshock(frame, 200);
    apply_vbuff_expression(frame);
  });
  return data;
}

Value make_fighter_data_louisex(Value& data) {
  ensure_base_group(data, entity_group::kBoss);
  set_bg_face(data, u"sprite/MENU_BACK11.png");
  each_run_frame(data, [](Value& frame) { add_electroshock(frame, 400); });
  return data;
}

Value make_fighter_data_mark(Value& data) { return data; }

Value make_fighter_data_monk(Value& data) { return data; }

Value make_fighter_data_rudolf(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK12.png");
  Value* frames = member(data, u"frames");
  if (frames != nullptr) {
    traversal(*frames, [](const std::u16string&, Value& frame) {
      boost_opoints_in_frame(frame, oid::kRudolf);
      Object* f = as_object(frame);
      if (f == nullptr) return;
      if (!is_rudolf_seq_state(*f)) return;
      set_rudolf_seqs(frame);
    });
  }
  return data;
}

Value make_fighter_data_sorcerer(Value& data) { return data; }

Value make_fighter_data_template(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK0.png");
  return data;
}

Value make_fighter_data_woody(Value& data) {
  set_bg_face(data, u"sprite/MENU_BACK13.png");
  return data;
}

}
}
