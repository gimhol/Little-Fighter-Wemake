#include "lfw/state/spawn_ice_piece.h"

#include <memory>
#include <utility>

#include "lfw/defines/oid.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/entity/gen_field.h"
#include "lfw/helper/randoming.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"

namespace lfw {
namespace state {
namespace {

const std::vector<Value>& dvx_values() {
  static const std::vector<Value> values = {
      Value(-4.0), Value(-3.0), Value(-2.0), Value(-1.0), Value(0.0),
      Value(1.0),  Value(2.0),  Value(3.0),  Value(4.0)};
  return values;
}

const std::vector<Value>& dvy_values() {
  static const std::vector<Value> values = {
      Value(1.0), Value(2.0), Value(2.0), Value(3.0), Value(3.0), Value(3.0), Value(4.0),
      Value(4.0), Value(5.0), Value(5.0), Value(5.0), Value(6.0), Value(6.0)};
  return values;
}

std::shared_ptr<Randoming>& dvx_randoming() {
  static std::shared_ptr<Randoming> slot;
  return slot;
}

std::shared_ptr<Randoming>& dvy_randoming() {
  static std::shared_ptr<Randoming> slot;
  return slot;
}

Value action_of(const std::u16string& id) {
  Object action;
  action.set(u"id", Value(id));
  return Value(std::make_shared<Object>(std::move(action)));
}

}

Value spawn_ice_piece(const std::u16string& id) {
  Object opoint;
  opoint.set(u"kind", Value(0.0));
  opoint.set(u"x", Value(0.0));
  opoint.set(u"y", Value(0.0));
  opoint.set(u"oid", Value(std::u16string(oid::kBrokenWeapon)));
  opoint.set(u"action", action_of(id));
  opoint.set(u"dvx", Value(0.0));
  opoint.set(u"dvy", Value(0.0));
  opoint.set(u"ghost", Value(1.0));
  opoint.set(u"speedz", Value(0.0));
  opoint.set(u"unimportant", Value(1.0));
  // TS 在这个对象上挂了四个 `__gen_*` 闭包（随机初速 + 帧尺寸内的随机落点）⇒ 端口登记到
  // `gen_field` 的侧表里（`Value` 装不下函数，见 `lfw/entity/gen_field.h`）。
  Value ret(std::make_shared<Object>(std::move(opoint)));
  register_gen_closure(ret, GenClosure::IcePiece);
  return ret;
}

const std::vector<Value>& ice_piece_opoints() {
  static const std::vector<Value> opoints = {
      spawn_ice_piece(u"130"), spawn_ice_piece(u"130"), spawn_ice_piece(u"130"),
      spawn_ice_piece(u"120"), spawn_ice_piece(u"120"), spawn_ice_piece(u"125"),
      spawn_ice_piece(u"125"), spawn_ice_piece(u"125"), spawn_ice_piece(u"125"),
      spawn_ice_piece(u"135"), spawn_ice_piece(u"135"), spawn_ice_piece(u"135"),
      spawn_ice_piece(u"135"), spawn_ice_piece(u"135"), spawn_ice_piece(u"135"),
      spawn_ice_piece(u"135")};
  return opoints;
}

Value ice_piece_dvx(const Value& e, MersenneTwister& mt) {
  if (!entity::is_object(e)) return Value(0.0);
  if (dvx_randoming() == nullptr || dvx_randoming()->mt() != &mt) {
    dvx_randoming() = std::make_shared<Randoming>(u"ice_piece_vx", dvx_values(), &mt);
  }
  return dvx_randoming()->get();
}

Value ice_piece_dvy(const Value& e, MersenneTwister& mt) {
  if (!entity::is_object(e)) return Value(0.0);
  if (dvy_randoming() == nullptr || dvy_randoming()->mt() != &mt) {
    dvy_randoming() = std::make_shared<Randoming>(u"ice_piece_vy", dvy_values(), &mt);
  }
  return dvy_randoming()->get();
}

Value ice_piece_x(const Value& e, MersenneTwister& mt) {
  if (!entity::is_object(e)) return Value(0.0);
  const double width = to_number(field_or(field_or(e, u"frame"), u"width"));
  const double r = width / 4.0;
  mt.mark = u"ice_piece_x";
  return Value(round(width / 2.0 + mt.range(-r, r)));
}

Value ice_piece_y(const Value& e, MersenneTwister& mt) {
  if (!entity::is_object(e)) return Value(0.0);
  const double height = to_number(field_or(field_or(e, u"frame"), u"height"));
  const double r = height / 4.0;
  mt.mark = u"ice_piece_y";
  return Value(round(height / 2.0 + mt.range(-r, r)));
}

}
}
