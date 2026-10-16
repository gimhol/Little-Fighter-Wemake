#include "lfw/ui/component/tests/tests.h"

#include "lfw/core/js_string.h"
#include "lfw/defines/game_key.h"
#include "lfw/lfw.h"
#include "lfw/ui/component/tests/ball/ball.h"
#include "lfw/ui/component/tests/bat/bat_duj.h"
#include "lfw/ui/component/tests/bg/moon.h"
#include "lfw/ui/component/tests/bot/bot_avoiding.h"
#include "lfw/ui/component/tests/bot/weapon_picking1.h"
#include "lfw/ui/component/tests/bot/weapon_picking2.h"
#include "lfw/ui/component/tests/firen/firen_dfa.h"
#include "lfw/ui/component/tests/firen/firen_dfj.h"
#include "lfw/ui/component/tests/firen/firen_duj.h"
#include "lfw/ui/component/tests/firen/firen_dvj.h"
#include "lfw/ui/component/tests/firezen/firzen_dua.h"
#include "lfw/ui/component/tests/firezen/firzen_fusion.h"
#include "lfw/ui/component/tests/freeze/freeze_dfa.h"
#include "lfw/ui/component/tests/freeze/freeze_dfj.h"
#include "lfw/ui/component/tests/freeze/freeze_duj.h"
#include "lfw/ui/component/tests/freeze/freeze_dvj.h"
#include "lfw/ui/component/tests/jan/jan_dua.h"
#include "lfw/ui/component/tests/jan/jan_duj.h"
#include "lfw/ui/component/tests/julian/julian_dfa.h"
#include "lfw/ui/component/tests/julian/julian_dfj.h"
#include "lfw/ui/component/tests/julian/julian_duj.h"
#include "lfw/ui/component/tests/louis/louis_jump_attack.h"
#include "lfw/ui/component/tests/others/all_fighters.h"
#include "lfw/ui/component/tests/others/armor_test.h"
#include "lfw/ui/component/tests/others/bottoms_up.h"
#include "lfw/ui/component/tests/others/come.h"
#include "lfw/ui/component/tests/others/criminal_saving.h"
#include "lfw/ui/component/tests/others/faster_slower_stand_up.h"
#include "lfw/ui/component/tests/others/follow.h"
#include "lfw/ui/component/tests/others/move_stay_come.h"
#include "lfw/ui/component/tests/rudolf/rudolf_dfj.h"
#include "lfw/ui/component/tests/test_case.h"
#include "lfw/ui/component/tests/weapons/blue_book.h"
#include "lfw/ui/component/tests/weapons/boomerang.h"
#include "lfw/ui/component/tests/weapons/dropping.h"
#include "lfw/ui/component/tests/weapons/green_book.h"
#include "lfw/ui/component/tests/weapons/red_book.h"
#include "lfw/ui/component/tests/weapons/throw.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace ui {

namespace {

// TS `Tests.ts` 的 `CASE_GROUPS`（顺序 = 分组顺序，组内顺序 = 用左右键切的顺序）。
std::vector<std::vector<TestCase*>> build_groups(Tests& owner) {
  std::vector<std::vector<TestCase*>> g;
  g.push_back({new TestCase(owner), new AllFighters(owner)});
  g.push_back({new Julian_DUJ(owner), new Julian_DFJ(owner), new Julian_DFA(owner)});
  g.push_back({new Firzen_DUA_0(owner), new Firzen_DUA_1(owner), new Firzen_DUA_2(owner),
               new Firzen_FUSION(owner)});
  g.push_back({new Bat_DUJ_0(owner), new Bat_DUJ_1(owner), new Bat_DUJ_2(owner),
               new Bat_DUJ_3(owner)});
  g.push_back({new Jan_DUA(owner), new Jan_DUA_2(owner), new Jan_DUJ(owner), new Jan_DUJ_2(owner)});
  g.push_back({new Henry_DUJ(owner)});
  g.push_back({new Rudolf_DFJ(owner)});
  g.push_back({new Firen_DUJ(owner), new Firen_DFA(owner), new Firen_DFJ(owner),
               new Firen_DVJ(owner)});
  g.push_back({new Freeze_DUJ(owner), new Freeze_DFA(owner), new Freeze_DFJ(owner),
               new Freeze_DVJ(owner)});
  g.push_back({new LOUIS_JUMP_ATTACK(owner)});
  g.push_back({new MoonTest(owner)});
  g.push_back({new BottomsUp(owner), new MoveStayCome(owner), new BotCome(owner),
               new BotFollow(owner), new FasterSlowerStandUp(owner)});
  g.push_back({new BotAvoiding(owner), new WeaponPicking1(owner), new WeaponPicking2(owner),
               new CriminalSaving1(owner), new ArmorTest1(owner)});
  g.push_back({new Ball_3000_vs_Ball_3000(owner), new Ball_3000_vs_Ball_3005(owner),
               new Ball_3000_vs_Ball_3006(owner), new Ball_3005_vs_Ball_3005(owner),
               new Ball_3005_vs_Ball_3006(owner), new Ball_3006_vs_Ball_3006(owner),
               new Ball_3000_vs_JohnShield(owner), new Ball_3005_vs_JohnShield(owner),
               new Ball_3006_vs_JohnShield(owner), new Ball_3000_vs_ManyPunch(owner),
               new Ball_3005_vs_ManyPunch(owner), new Ball_3006_vs_ManyPunch(owner),
               new Ball_3000_vs_BurnRun(owner), new Ball_3005_vs_BurnRun(owner),
               new Ball_3006_vs_BurnRun(owner)});
  g.push_back({new Boomerang_1_1(owner), new Boomerang_1_2(owner), new Boomerang_1_3(owner),
               new Boomerang_1_4(owner), new Boomerang_1_5(owner), new Boomerang_1_6(owner),
               new Boomerang_2_1(owner), new Boomerang_2_2(owner), new Boomerang_2_3(owner),
               new Boomerang_2_4(owner), new Boomerang_2_5(owner), new Boomerang_2_6(owner),
               new Boomerang_3_1(owner), new Boomerang_3_2(owner), new Boomerang_3_3(owner),
               new Boomerang_3_4(owner), new Boomerang_3_5(owner), new Boomerang_3_6(owner)});
  g.push_back({new Baseball_1_1(owner), new Knife_1_1(owner), new Hoe_1_1(owner),
               new Stick_1_1(owner), new Stone_1_1(owner), new Dropping_1(owner),
               new Dropping_2(owner)});
  g.push_back({new RedBook_GroupAttack(owner), new GreenBook_Electrify(owner),
               new BlueBook_MpHealing(owner)});
  return g;
}

}  // namespace

const ClazzTag* Tests::class_tag() {
  static const ClazzTag tag{UIComponent::class_tag()};
  return &tag;
}

const std::vector<std::u16string>& Tests::TAGS() {
  static const std::vector<std::u16string> tags{u"Tests"};
  return tags;
}

void Tests::init() {}

Tests::~Tests() {
  for (TestCase* const c : _owned) delete c;
  for (TestCase* const c : _retired) delete c;
}

void Tests::on_start() {
  // 上一轮留下的用例**不释放**（见类头注释：`FSM::_prev_state` 还指着它们）。
  for (TestCase* const c : _owned) _retired.push_back(c);
  _owned.clear();

  // TS：`TestCase.key = -1` ⇒ 这一轮第一个用例的 key 是 0（`FSM::add` 按 key 覆盖上一轮那批）。
  TestCase::key_counter = -1.0;
  std::vector<std::vector<TestCase*>> next = build_groups(*this);
  for (std::vector<TestCase*>& group : next) {
    for (TestCase* const c : group) _owned.push_back(c);
  }
  for (size_t x = 0; x < next.size(); ++x) {
    const std::vector<TestCase*>& group = next[x];
    for (size_t y = 0; y < group.size(); ++y) {
      TestCase* const c = group[y];
      // TS：`r.name = `${x}-${y} ${r.name}``（页面标题就是这一串）。
      c->name = number_to_string(static_cast<double>(x)) + u"-" +
                number_to_string(static_cast<double>(y)) + u" " + *c->name;
      _fsm.add(c);
    }
  }
  groups = std::move(next);
  _fsm.use(Value(0.0));
  _fsm.callbacks().on(u"on_state_changed", [this](const CallbacksT<FSM*>::Payloads& ps) {
    const FSM* const f = ps.empty() ? nullptr : ps[0];
    std::u16string n = u"None";
    if (f != nullptr && f->state() != nullptr && f->state()->name.has_value()) n = *f->state()->name;
    UINode* const nn = node.search_node(u"test_case_name");
    if (nn != nullptr) nn->set_text(u"Case: " + n);
  });
}

void Tests::on_stop() { world().clear(); }

void Tests::on_key_down(LFWKeyEvent& e) {
  const size_t len = _fsm.states().size();
  if (len == 0) return;
  IState* const state = _fsm.state();
  if (state == nullptr) {
    _fsm.use(Value(0.0));
    return;
  }
  const int key = static_cast<int>(to_number(state->key()));
  if (e.game_key == gk::kR) {
    _fsm.use(Value(static_cast<double>((key + 1) % static_cast<int>(len))));
  } else if (e.game_key == gk::ka) {
    _fsm.use(Value(static_cast<double>(key)));
  } else if (e.game_key == gk::kL) {
    _fsm.use(Value(static_cast<double>((key + static_cast<int>(len) - 1) % static_cast<int>(len))));
  } else if (e.game_key == gk::kU || e.game_key == gk::kD) {
    if (groups.empty()) return;
    int gid = -1;
    for (size_t i = 0; i < groups.size(); ++i) {
      for (TestCase* const c : groups[i]) {
        if (c == state) {
          gid = static_cast<int>(i);
          break;
        }
      }
      if (gid >= 0) break;
    }
    if (gid < 0) return;
    const int n = static_cast<int>(groups.size());
    const int next_gid = e.game_key == gk::kU ? (gid + n - 1) % n : (gid + 1) % n;
    const std::vector<TestCase*>& cases = groups[static_cast<size_t>(next_gid)];
    if (cases.empty()) return;
    // TS：上一组取**最后一个**、下一组取**第一个**。
    _fsm.use(cases[e.game_key == gk::kU ? cases.size() - 1 : 0]->key());
  }
}

void Tests::update(double dt) { _fsm.update(dt); }

}
}
