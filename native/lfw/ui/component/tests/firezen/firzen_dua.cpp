#include "lfw/ui/component/tests/firezen/firzen_dua.h"

#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/state_enum.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

namespace {

// 三个类的 `update` 在 TS 里逐字相同（`Firzen_DUA.ts`）。
void dua_tick(Entity* const firzen) {
  if (firzen == nullptr) return;
  const bool standing =
      strict_equals(firzen->state(), Value(static_cast<double>(StateEnum::Standing)));
  if (firzen->mp() > 100.0 && standing) {
    firzen->ctrl()->click({gk::kd, gk::kU, gk::ka});
  } else if (firzen->mp() > 100.0 && !standing &&
             truthy(field_or(field_or(firzen->frame, u"hit"), u"a"))) {
    firzen->ctrl()->click({gk::ka});
  }
}

// TS 三个类的 `enter` 开头都是这一段（站位 / 阵营 / 挂载 / 先按一次三段）。
Entity* spawn_firzen(TestCase& self, double x, double z) {
  Entity* const firzen = self.spawn(std::u16string(oid::kFirzen));
  if (firzen == nullptr) return nullptr;
  firzen->set_position(Value(x), Value(0.0), Value(z));
  firzen->set_team(team_enum::kTeam_1);
  firzen->attach();
  firzen->ctrl()->click({gk::kd, gk::kU, gk::ka});
  return firzen;
}

}  // namespace

Firzen_DUA_0::Firzen_DUA_0(Tests& owner) : TestCase(owner) { name = u"Firezen D^A 0"; }

std::optional<Value> Firzen_DUA_0::update(double dt) {
  (void)dt;
  dua_tick(firzen);
  return std::nullopt;
}

void Firzen_DUA_0::enter() { firzen = spawn_firzen(*this, midX(), midZ()); }

Firzen_DUA_1::Firzen_DUA_1(Tests& owner) : TestCase(owner) { name = u"Firezen D^A 1"; }

std::optional<Value> Firzen_DUA_1::update(double dt) {
  (void)dt;
  dua_tick(firzen);
  return std::nullopt;
}

void Firzen_DUA_1::enter() {
  firzen = spawn_firzen(*this, midX(), midZ());
  for (Entity* const v : bandits_8()) {
    v->set_team(team_enum::kTeam_2);
    v->set_hp(100.0);
  }
}

Firzen_DUA_2::Firzen_DUA_2(Tests& owner) : TestCase(owner) { name = u"Firezen D^A 2"; }

std::optional<Value> Firzen_DUA_2::update(double dt) {
  (void)dt;
  dua_tick(firzen);
  return std::nullopt;
}

void Firzen_DUA_2::enter() {
  firzen = spawn_firzen(*this, midX(), midZ());
  const std::vector<Entity*> bandits =
      circle({std::u16string(oid::kBandit)}, midX(), midZ(), bg().width() / 2.0,
             bg().depth() / 2.0, 80);
  for (Entity* const v : bandits) {
    v->set_team(team_enum::kTeam_2);
    v->set_hp(100.0);
  }
}

}
}
