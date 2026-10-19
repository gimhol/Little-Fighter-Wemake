#include "lfw/dat_translator/make_buring_smoke.h"

#include <memory>
#include <string>

#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/dat_translator/value_builder.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/gen_field.h"

namespace lfw {
namespace dat_translator {

namespace {

Value oid_broken_weapon() { return Value(std::u16string(oid::kBrokenWeapon)); }

}

Value make_buring_smoke(int foo) {
  Object action;
  action.set(u"id", s(u"140"));

  Object ret;
  ret.set(u"kind", n(0));
  ret.set(u"x", n(0));
  ret.set(u"y", n(0));
  ret.set(u"oid", oid_broken_weapon());
  // TS 的 `action.__gen_facing` 是个闭包（`mt.pick([-1, 1])`），`Value` 装不下函数 ⇒
  // 把 action 对象登记到 `gen_field` 的侧表里（见 `lfw/entity/gen_field.h`）。
  Value action_value(std::make_shared<Object>(std::move(action)));
  register_gen_closure(action_value, GenClosure::BuringSmokeAction);
  ret.set(u"action", action_value);
  ret.set(u"speedz", n(0));
  ret.set(u"ghost", n(1));
  ret.set(u"unimportant", n(1));
  ret.set(u"interval", n(3));
  ret.set(u"interval_id", Value(std::u16string(u"buring_smoke_") + number_to_string(static_cast<double>(foo))));
  ret.set(u"interval_mode", n(1));
  if (foo == 1) {
    ret.set(u"gen_x", s(u"round(rand(round(w/4), round(3*w/4)))"));
    ret.set(u"gen_y", s(u"round(cy + rand(-round(h/2), 0))"));
  } else {
    ret.set(u"gen_x", s(u"round(cx + rand(-round(w/6), round(w/6)))"));
    ret.set(u"gen_y", s(u"round(cy + rand(-round(3*h/4), 0))"));
  }
  return Value(std::make_shared<Object>(ret));
}

}
}
