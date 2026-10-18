#include "lfw/bot/bot_dataset.h"

#include <memory>
#include <vector>

#include "lfw/defines/defines_data.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace bot {
namespace {

// `defines/IBotDataSet.ts` 的字段默认值，按类里的声明顺序记录（`Object.assign` /
// `Object.keys` 看到的就是这个顺序）。`r_atk_desire` / `j_atk_desire` 是
// `Defines.MAX_AI_DESIRE`（运行时常量表）。
void set_defaults(Object& o) {
  const double max_desire = defines::num(u"Defines.MAX_AI_DESIRE");
  o.set(u"r_stop_desire", Value(10.0));
  o.set(u"defend_desire_base", Value(0.0));
  o.set(u"defend_desire_step", Value(1800.0));
  o.set(u"w_atk_x", Value(50.0));
  o.set(u"w_atk_m_x", Value(-1.0));
  o.set(u"w_atk_r_x", Value(-1.0));
  o.set(u"w_atk_min_z", Value(-15.0));
  o.set(u"w_atk_max_z", Value(15.0));
  o.set(u"r_atk_desire", Value(max_desire));
  o.set(u"j_atk_desire", Value(max_desire));
  o.set(u"r_atk_x", Value(100.0));
  o.set(u"r_atk_min_z", Value(-15.0));
  o.set(u"r_atk_max_z", Value(15.0));
  o.set(u"d_atk_min_x", Value(0.0));
  o.set(u"d_atk_max_x", Value(100.0));
  o.set(u"d_atk_min_z", Value(-60.0));
  o.set(u"d_atk_max_z", Value(60.0));
  o.set(u"j_atk_x", Value(180.0));
  o.set(u"j_atk_min_z", Value(-60.0));
  o.set(u"j_atk_max_z", Value(60.0));
  o.set(u"j_atk_min_y", Value(-260.0));
  o.set(u"j_atk_max_y", Value(260.0));
  o.set(u"jump_desire", Value(50.0));
  o.set(u"dash_desire", Value(100.0));
  o.set(u"r_desire_min", Value(0.0));
  o.set(u"r_desire_max", Value(2000.0));
  o.set(u"r_x_min", Value(100.0));
  o.set(u"r_x_max", Value(1200.0));
  o.set(u"avoid_in_x", Value(180.0));
  o.set(u"avoid_in_z", Value(100.0));
  o.set(u"avoid_out_x", Value(200.0));
  o.set(u"avoid_out_z", Value(200.0));
  o.set(u"pick_weapon_f_x", Value(25.0));
  o.set(u"pick_weapon_b_x", Value(-25.0));
  o.set(u"pick_weapon_z", Value(25.0));
}

const std::vector<std::u16string>& default_keys() {
  static const std::vector<std::u16string> keys = [] {
    Object o;
    set_defaults(o);
    return o.keys();
  }();
  return keys;
}

}  // namespace

BotDataSet::BotDataSet() {
  Object o;
  set_defaults(o);
  data_ = Value(std::make_shared<Object>(std::move(o)));
}

const BotDataSet& BotDataSet::Default() {
  static const BotDataSet kDefault;
  return kDefault;
}

const Value* BotDataSet::get(const std::u16string& key) const {
  const Object* o = as_object(data_);
  return o != nullptr ? o->get(key) : nullptr;
}

double BotDataSet::num(const std::u16string& key) const {
  const Value* v = get(key);
  return v != nullptr ? to_number(*v) : to_number(Value());
}

void BotDataSet::assign(const Value& src) {
  const Object* s = as_object(src);
  if (s == nullptr) return;
  Object* d = as_object(data_);
  if (d == nullptr) return;
  for (const std::u16string& k : object_keys(src)) {
    const Value* v = s->get(k);
    if (v != nullptr) d->set(k, *v);
  }
}

void BotDataSet::reset() {
  Object* d = as_object(data_);
  if (d == nullptr) return;
  for (const std::u16string& k : default_keys()) {
    const Value* v = Default().get(k);
    if (v != nullptr) d->set(k, *v);
  }
}

Value BotDataSet::dump() const { return data_; }

}  // namespace bot
}  // namespace lfw
