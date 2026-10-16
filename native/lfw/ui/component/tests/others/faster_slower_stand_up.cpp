#include "lfw/ui/component/tests/others/faster_slower_stand_up.h"

#include <cstddef>
#include <string>
#include <vector>

#include "lfw/controller/base_controller.h"
#include "lfw/core/value.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

namespace lfw {
namespace ui {

namespace {

// `indexes` 是「记录 + 数组」两用的（`walking` 那批调用点同口径）：`x[k]` 先按键查记录，
// 记录里没有再按数字当数组下标查。
Value index_by(const Value& holder, const std::u16string& k) {
  const Object* o = as_object(holder);
  if (o != nullptr) {
    const Value* p = o->get(k);
    if (p != nullptr) return *p;
  }
  const Array* arr = as_array(holder);
  if (arr != nullptr) {
    const double index = to_number(Value(k));
    if (!(index >= 0) || index >= static_cast<double>(arr->size())) return Value();
    return arr->at(static_cast<size_t>(index));
  }
  return Value();
}

Value index_0(const Value& holder) {
  const Array* arr = as_array(holder);
  if (arr != nullptr) {
    if (arr->size() == 0) return Value();
    return arr->at(0);
  }
  const Object* o = as_object(holder);
  if (o != nullptr) {
    const Value* p = o->get(u"0");
    if (p != nullptr) return *p;
  }
  return Value();
}

// TS 的 `this.figters[i].ctrl.…`：下标越界 / 没挂控制器在 TS 里会抛，端口给 `nullptr`。
controller::BaseController* ctrl_at(const std::vector<Entity*>& figters, std::size_t i) {
  if (i >= figters.size()) return nullptr;
  Entity* const e = figters[i];
  return e != nullptr ? e->ctrl() : nullptr;
}

Entity* entity_at(const std::vector<Entity*>& figters, std::size_t i) {
  return i < figters.size() ? figters[i] : nullptr;
}

}  // namespace

FasterSlowerStandUp::FasterSlowerStandUp(Tests& owner) : TestCase(owner) {
  name = u"Press A/D faster or slower to stand up";
  // TS 里这一段没有 `.sort()` ⇒ 端口同样按插入序推进。
  _director
      .offset(10.0, {[this]() {
                for (Entity* const v : figters) {
                  if (v == nullptr) continue;
                  if (controller::BaseController* const c = v->ctrl()) c->key_up(agk());
                }
              }})
      .offset(500.0, {[this]() {
                for (Entity* const v : figters) {
                  if (v == nullptr) continue;
                  v->set_velocity(Value(), Value(5.0), Value());
                  // 进入"倒地第一帧"（`data.indexes.falling[1][0]`）。
                  v->enter_frame_by_id(index_0(index_by(v->data_indexes_falling(), u"1")));
                }
              }})
      .offset(10.0, {[this]() {
                if (controller::BaseController* const c0 = ctrl_at(figters, 0))
                  c0->key_down({gk::ka});
                if (controller::BaseController* const c2 = ctrl_at(figters, 2))
                  c2->key_down({gk::kd});
              }})
      .wait(15000.0)
      .times(10000.0);
}

void FasterSlowerStandUp::enter() {
  TestCase::enter();
  director().reset();
  figters = hori_3(std::u16string(oid::kHunter), 80.0);
  for (Entity* const v : figters) {
    v->set_stat_bar(0.0);
    v->set_wakeup_invuln(Value(1.0));
    v->ctrl_visible = 1;
    v->name_visible = 1;
  }
  if (Entity* const f0 = entity_at(figters, 0))
    f0->set_name(Value(std::u16string(u"Press \"A\"")));
  if (Entity* const f1 = entity_at(figters, 1))
    f1->set_name(Value(std::u16string(u"Default")));
  if (Entity* const f2 = entity_at(figters, 2))
    f2->set_name(Value(std::u16string(u"Press \"D\"")));
}

}
}
