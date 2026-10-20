#include "lfw/controller/ball_controller.h"

#include <cstddef>
#include <limits>
#include <string>
#include <vector>

#include "lfw/core/js_num.h"
#include "lfw/core/same_ref.h"
#include "lfw/core/value.h"
#include "lfw/defines/chase_lost.h"
#include "lfw/defines/chase_strategy.h"
#include "lfw/defines/empty_frame_info.h"
#include "lfw/defines/frame_behavior.h"
#include "lfw/defines/frame_id.h"
#include "lfw/defines/game_key.h"
#include "lfw/entity/entity.h"
#include "lfw/entity/entity_flag.h"
#include "lfw/entity/entity_ref.h"
#include "lfw/helper/manhattan_xz.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/round_float.h"
#include "lfw/utils/type_cast.h"

namespace lfw {
namespace controller {

namespace {

// `a.get_flag(b)` 用到的字段：对方（引用）的 `team`。
std::u16string ref_team(const Value& ref) { return to_string(field_or(ref, u"team")); }

double ref_pos(const Value& ref, const char16_t* axis) {
  return to_number(field_or(field_or(ref, u"position"), axis));
}

double ref_x(const Value& ref) { return ref_pos(ref, u"x"); }

double ref_y(const Value& ref) { return ref_pos(ref, u"y"); }

double ref_z(const Value& ref) { return ref_pos(ref, u"z"); }

double ref_hp(const Value& ref) { return to_number(field_or(ref, u"hp")); }

double ref_type(const Value& ref) { return to_number(field_or(ref, u"type")); }

// TS 的 `??` —— 只对 null/undefined 兜底（0 与 NaN 都原样保留）。
Value or_nullish(const Value& v, const Value& fallback) {
  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) return fallback;
  return v;
}

}  // namespace

void BallController::reset() {
  BaseController::reset();
  chasing = nullptr;
  gave_up = false;
  dir_x = 0;
  dir_y = 0;
  dir_z = 0;
  leave_dir = 0;
  frame = empty_frame_info();
  has_chase_point_ = false;
  chase_point_ = Vector3{};
}

void BallController::copy_self_position() {
  const CtrlEnv* e = env();
  has_chase_point_ = true;
  chase_point_.set(e != nullptr ? e->px : 0.0, e != nullptr ? e->py : 0.0,
                   e != nullptr ? e->pz : 0.0);
}

Vector3& BallController::chase_point() {
  if (!has_chase_point_) copy_self_position();
  return chase_point_;
}

void BallController::set_chase_point(double x, double y, double z) {
  // TS 在这里有一句「三者任一不是有限数就 `debugger`」的断言（`is_f_num`）——
  // `debugger` 不改变行为，端口不搬，只做同款的取整。
  has_chase_point_ = true;
  chase_point_.set(round_float(x), round_float(y), round_float(z));
}

void BallController::aim_at(const Value& e, double oy) {
  const double height = to_number(field_or(field_or(e, u"frame"), u"height"));
  set_chase_point(ref_x(e), ref_y(e) + height * oy, ref_z(e));
}

bool BallController::should_chase(const Value& other) const {
  if (!truthy(other)) return false;
  const Value oid = field_or(field_or(other, u"frame"), u"id");
  if (strict_equals(oid, Value(std::u16string(frame_id::kGone))) ||
      strict_equals(oid, Value(std::u16string(frame_id::kNone)))) {
    return false;
  }
  const CtrlEnv* e = env();
  if (e == nullptr) return false;
  const Value chase = field_or(e->frame, u"chase");
  if (!truthy(chase)) return false;
  const double flag = to_number(field_or(chase, u"flag"));
  // `other.get_flag(this.entity)` —— 注意是**对方**的 team/hp/type 对**自己**的 team。
  const double target = flag_between(ref_team(other), ref_hp(other), ref_type(other), e->team);
  return (js_to_int32(target) & js_to_int32(flag)) == js_to_int32(target);
}

void BallController::update_lookup(int me, const std::vector<Entity*>& entities) {
  const CtrlEnv* e = env();
  if (e == nullptr) return;
  const Value chase_info = field_or(e->frame, u"chase");
  if (!truthy(chase_info)) return;
  const double stratedy = to_number(field_or(chase_info, u"stratedy"));
  if (stratedy == static_cast<double>(ChaseStrategy::StopOnLost) && gave_up) return;

  const int count = static_cast<int>(entities.size());
  // TS 的 `const self = this.entity`。**不能**拿 `entities[me]` 顶替：`me` 是「自己在
  // 名单里的下标」，只有调用方保证它指向自己时两者才等价。
  const Entity* const self_e = e->self;
  if (self_e == nullptr) return;

  const Entity* const current = chasing;
  const bool still_valid = current != nullptr && should_chase(ref_of(*current));
  if (!still_valid) chasing = nullptr;
  if (current != nullptr &&
      (stratedy == static_cast<double>(ChaseStrategy::UntilLost) ||
       (still_valid && stratedy == static_cast<double>(ChaseStrategy::StopOnLost)))) {
    aim_at(ref_of(*current));
    return;
  }
  if (current != nullptr && stratedy == static_cast<double>(ChaseStrategy::StopOnLost)) {
    gave_up = true;
    stop_chasing();
    return;
  }
  if (stratedy == static_cast<double>(ChaseStrategy::Default)) chasing = nullptr;

  const double x0 = self_e->position.x;
  int i1 = me - 1;
  int i2 = me + 1;
  Entity* found = nullptr;
  double found_d = std::numeric_limits<double>::infinity();

  Entity* e2 = nullptr;
  do {
    Entity* l = (i1 >= 0 && i1 < count) ? entities[static_cast<size_t>(i1)] : nullptr;
    Entity* r = (i2 >= 0 && i2 < count) ? entities[static_cast<size_t>(i2)] : nullptr;
    if (found != nullptr) {
      if (l != nullptr && x0 - l->position.x >= found_d) l = nullptr;
      if (r != nullptr && r->position.x - x0 >= found_d) r = nullptr;
    }
    if (l != nullptr && r != nullptr) {
      e2 = helper::manhattan_xz(*self_e, *l) > helper::manhattan_xz(*self_e, *r) ? r : l;
    } else {
      e2 = l != nullptr ? l : r;
    }
    if (e2 == nullptr) break;
    const Value e2_ref = ref_of(*e2);
    if (!truthy(field_or(e2_ref, u"ghosted")) && should_chase(e2_ref)) {
      const double d = helper::manhattan_xz(*self_e, *e2);
      if (d < found_d) {
        found = e2;
        found_d = d;
      }
    }
    if (l == e2) --i1;
    if (r == e2) ++i2;
    // 两侧都没推进就没有下一轮可看。留一条出路，别让台面挂住。
    if (l != e2 && r != e2) break;
  } while (e2 != nullptr);

  if (found == nullptr) return;
  chasing = found;
  aim_at(ref_of(*found));
}
  const ControllerResult& BallController::update() {
  const CtrlEnv* e = env();
  if (e == nullptr) return BaseController::update();
  const Value frame_now = e->frame;
  const double facing = e->facing;
  const double hp = e->hp;
  const Value chase = field_or(frame_now, u"chase");
  const Value behavior = field_or(frame_now, u"behavior");

  if (hp > 0 && !same_ref(frame, frame_now)) {
    gave_up = false;
    if (truthy(field_or(frame, u"chase")) && !truthy(chase)) {
      stop_chasing();
      copy_self_position();
    }
  } else if (hp <= 0 && truthy(chase)) {
    stop_chasing();
  }

  if (strict_equals(behavior, Value(static_cast<double>(FrameBehavior::JohnBiscuitLeaving)))) {
    if (facing < 0) {
      key_down({gk::kL});
      key_up({gk::kR, gk::kU, gk::kD});
    } else {
      key_down({gk::kR});
      key_up({gk::kL, gk::kU, gk::kD});
    }
    if (e->py > 40) {
      key_down({gk::kd});
      key_up({gk::kj});
    } else if (e->py < 40) {
      key_down({gk::kj});
      key_up({gk::kd});
    } else {
      key_up({gk::kj, gk::kd});
    }
  }
  if (truthy(chase)) update_chasing(chase);
  frame = frame_now;
  return BaseController::update();
}

void BallController::update_chasing(const Value& chase) {
  const CtrlEnv* e = env();
  if (e == nullptr) return;
  Entity* const chasing_now = chasing;
  const double facing = e->facing;
  const double hp = e->hp;

  if (chasing_now != nullptr) {
    // `const { oy = 0.5 } = chase`
    const Value oy_v = field_or(chase, u"oy");
    const double oy = std::holds_alternative<std::monostate>(oy_v) ||
                              std::holds_alternative<NullTag>(oy_v)
                          ? 0.5
                          : to_number(oy_v);
    aim_at(ref_of(*chasing_now), oy);
  }

  const Vector3& cp = chase_point();
  const double x = cp.x;
  const double y = cp.y;
  const double z = cp.z;
  const Value overshoot = field_or(chase, u"overshoot");
  // `chase.overshoot?.x ?? 0` —— 缺字段时是 0，不是 NaN。
  const double over_x = to_number(or_nullish(field_or(overshoot, u"x"), Value(0.0)));
  const double over_y = to_number(or_nullish(field_or(overshoot, u"y"), Value(0.0)));
  const double over_z = to_number(or_nullish(field_or(overshoot, u"z"), Value(0.0)));
  const double lost = to_number(field_or(chase, u"lost"));

  if (hp > 0 && (chasing_now != nullptr ||
                 (js_to_int32(lost) & static_cast<int32_t>(ChaseLost::Hover)) != 0)) {
    dir_x = calc_dir(x - e->px, over_x, dir_x);
    if (dir_x > 0) {
      key_down({gk::kR});
      key_up({gk::kL});
    } else if (dir_x < 0) {
      key_down({gk::kL});
      key_up({gk::kR});
    } else {
      key_up({gk::kL, gk::kR});
    }

    dir_z = calc_dir(z - e->pz, over_z, dir_z);
    if (dir_z > 0) {
      key_down({gk::kD});
      key_up({gk::kU});
    } else if (dir_z < 0) {
      key_down({gk::kU});
      key_up({gk::kD});
    } else {
      key_up({gk::kU, gk::kD});
    }

    dir_y = calc_dir(y - e->py, over_y, dir_y);
    if (dir_y > 0) {
      key_down({gk::kj});
      key_up({gk::kd});
    } else if (dir_y < 0) {
      key_down({gk::kd});
      key_up({gk::kj});
    } else {
      key_up({gk::kj, gk::kd});
    }
  } else {
    if (leave_dir == 0) leave_dir = facing < 0 ? -1 : 1;
    if (leave_dir < 0) {
      key_down({gk::kL});
      key_up({gk::kR, gk::kU, gk::kD});
    } else {
      key_down({gk::kR});
      key_up({gk::kL, gk::kU, gk::kD});
    }

    const double dy = y - e->py;
    if (dy < 0) {
      key_down({gk::kd});
      key_up({gk::kj});
    } else if (dy > 0) {
      key_down({gk::kj});
      key_up({gk::kd});
    } else {
      key_up({gk::kj, gk::kd});
    }
  }
  chasing = chasing_now;
}

double BallController::calc_dir(double delta, double over, double prev) {
  double dir = prev;
  if (dir == 0 && truthy(Value(delta))) dir = delta > 0 ? 1 : -1;
  if (dir > 0 && delta < -over) {
    dir = -1;
  } else if (dir < 0 && delta > over) {
    dir = 1;
  }
  return dir;
}

void BallController::stop_chasing() {
  dir_x = 0;
  dir_y = 0;
  dir_z = 0;
  chasing = nullptr;
}

}
}
