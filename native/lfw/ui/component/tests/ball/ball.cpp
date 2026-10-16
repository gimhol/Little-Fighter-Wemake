#include "lfw/ui/component/tests/ball/ball.h"

#include <cstddef>
#include <vector>

#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/ui/component/tests/tests.h"

namespace lfw {
namespace ui {

namespace {

// TS `this.fighters[i]`：端口里 `spawn` 可能回 nullptr（数据集里没这个 oid），而 `hori` 会把这种
// 项跳过 ⇒ 下标越界时按"没人"处理。
Entity* fighter_at(const std::vector<Entity*>& fighters, std::size_t idx) {
  return idx < fighters.size() ? fighters[idx] : nullptr;
}

// TS 直接写 `this.fighters[i].ctrl.click(...)`（不判空）；这里把"缺人 / 还没建控制器"一并吞掉。
void click_keys(const std::vector<Entity*>& fighters, std::size_t idx, const std::vector<std::u16string>& ks) {
  Entity* const e = fighter_at(fighters, idx);
  if (e == nullptr || e->ctrl() == nullptr) return;
  e->ctrl()->click(ks);
}

// 15 个用例 `enter` 的尾巴是同一段：0 号青队、1 号红队，两人都满蓝 99999、不显示血条，1 号朝左。
void setup_duel(const std::vector<Entity*>& fighters) {
  Entity* const a = fighter_at(fighters, 0);
  if (a != nullptr) {
    a->set_team(team_enum::kTeam_1);
    a->set_mp(99999.0);
    a->set_mp_max(99999.0);
    a->set_stat_bar(0.0);
  }
  Entity* const b = fighter_at(fighters, 1);
  if (b != nullptr) {
    b->set_team(team_enum::kTeam_2);
    b->set_mp(99999.0);
    b->set_mp_max(99999.0);
    b->facing = -1.0;
    b->set_stat_bar(0.0);
  }
}

}  // namespace

Ball_3000_vs_Ball_3000::Ball_3000_vs_Ball_3000(Tests& owner) : TestCase(owner) {
  name = u"Ball_3000_vs_Ball_3000";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::ka});
              }})
      .repeat(99999.0, 10.0, {[this]() {
                click_keys(fighters, 0, {gk::ka});
                click_keys(fighters, 1, {gk::ka});
              }})
      .sort_actions();
}

void Ball_3000_vs_Ball_3000::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kDavis), std::u16string(oid::kDavis)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3000_vs_Ball_3005::Ball_3000_vs_Ball_3005(Tests& owner) : TestCase(owner) {
  name = u"Ball_3000_vs_Ball_3005";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::ka});
              }})
      .repeat(99999.0, 10.0, {[this]() { click_keys(fighters, 0, {gk::ka}); }})
      .sort_actions();
}

void Ball_3000_vs_Ball_3005::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kDavis), std::u16string(oid::kHenry)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3000_vs_Ball_3006::Ball_3000_vs_Ball_3006(Tests& owner) : TestCase(owner) {
  name = u"Ball_3000_vs_Ball_3006";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .repeat(99999.0, 10.0, {[this]() { click_keys(fighters, 0, {gk::ka}); }})
      .sort_actions();
}

void Ball_3000_vs_Ball_3006::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kDavis), std::u16string(oid::kHenry)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3005_vs_Ball_3005::Ball_3005_vs_Ball_3005(Tests& owner) : TestCase(owner) {
  name = u"Ball_3005_vs_Ball_3005";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::ka});
              }})
      .sort_actions();
}

void Ball_3005_vs_Ball_3005::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kHenry)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3005_vs_Ball_3006::Ball_3005_vs_Ball_3006(Tests& owner) : TestCase(owner) {
  name = u"Ball_3005_vs_Ball_3006";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3005_vs_Ball_3006::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kHenry)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3006_vs_Ball_3006::Ball_3006_vs_Ball_3006(Tests& owner) : TestCase(owner) {
  name = u"Ball_3006_vs_Ball_3006";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::kj});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3006_vs_Ball_3006::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kHenry)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3000_vs_JohnShield::Ball_3000_vs_JohnShield(Tests& owner) : TestCase(owner) {
  name = u"Ball_3000_vs_JohnShield";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3000_vs_JohnShield::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kDavis), std::u16string(oid::kJohn)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3005_vs_JohnShield::Ball_3005_vs_JohnShield(Tests& owner) : TestCase(owner) {
  name = u"Ball_3005_vs_JohnShield";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3005_vs_JohnShield::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kJohn)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3006_vs_JohnShield::Ball_3006_vs_JohnShield(Tests& owner) : TestCase(owner) {
  name = u"Ball_3006_vs_JohnShield";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::kj});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3006_vs_JohnShield::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kJohn)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3000_vs_ManyPunch::Ball_3000_vs_ManyPunch(Tests& owner) : TestCase(owner) {
  name = u"Ball_3000_vs_ManyPunch";
  _director.offset(500.0, {[this]() { click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka}); }})
      .offset(500.0, {[this]() { click_keys(fighters, 1, {gk::kd, gk::kD, gk::ka}); }})
      .sort_actions();
}

void Ball_3000_vs_ManyPunch::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kDavis), std::u16string(oid::kDavis)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3005_vs_ManyPunch::Ball_3005_vs_ManyPunch(Tests& owner) : TestCase(owner) {
  name = u"Ball_3005_vs_ManyPunch";
  _director.offset(500.0, {[this]() { click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka}); }})
      .offset(500.0, {[this]() { click_keys(fighters, 1, {gk::kd, gk::kD, gk::ka}); }})
      .sort_actions();
}

void Ball_3005_vs_ManyPunch::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kDavis)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3006_vs_ManyPunch::Ball_3006_vs_ManyPunch(Tests& owner) : TestCase(owner) {
  name = u"Ball_3006_vs_ManyPunch";
  _director.offset(500.0, {[this]() { click_keys(fighters, 0, {gk::kd, gk::kR, gk::kj}); }})
      .offset(500.0, {[this]() { click_keys(fighters, 1, {gk::kd, gk::kD, gk::ka}); }})
      .sort_actions();
}

void Ball_3006_vs_ManyPunch::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kDavis)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3000_vs_BurnRun::Ball_3000_vs_BurnRun(Tests& owner) : TestCase(owner) {
  name = u"Ball_3000_vs_BurnRun";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3000_vs_BurnRun::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kDavis), std::u16string(oid::kFiren)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3005_vs_BurnRun::Ball_3005_vs_BurnRun(Tests& owner) : TestCase(owner) {
  name = u"Ball_3005_vs_BurnRun";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::ka});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3005_vs_BurnRun::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kFiren)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

Ball_3006_vs_BurnRun::Ball_3006_vs_BurnRun(Tests& owner) : TestCase(owner) {
  name = u"Ball_3006_vs_BurnRun";
  _director
      .offset(500.0, {[this]() {
                click_keys(fighters, 0, {gk::kd, gk::kR, gk::kj});
                click_keys(fighters, 1, {gk::kd, gk::kL, gk::kj});
              }})
      .sort_actions();
}

void Ball_3006_vs_BurnRun::enter() {
  TestCase::enter();
  _director.reset();
  fighters = hori({std::u16string(oid::kHenry), std::u16string(oid::kFiren)}, midX(), midZ(), 450.0);
  setup_duel(fighters);
}

}
}
