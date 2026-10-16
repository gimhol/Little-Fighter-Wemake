#include "lfw/ui/component/tests/bg/moon.h"

#include <cmath>
#include <vector>

#include "lfw/core/js_string.h"
#include "lfw/defines/cmd.h"
#include "lfw/defines/defines_data.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"

namespace lfw {
namespace ui {

namespace {

const std::u16string& cmd_dist_cam() {
  static const std::u16string s(cmd::kDIST_CAM);
  return s;
}

double modern_screen_width() { return defines::num(u"Defines.MODERN_SCREEN_WIDTH"); }

}  // namespace

MoonTest::MoonTest(Tests& owner) : TestCase(owner) {
  name = u"Bg Override Gravity Test, Normal Jump / Jump + Defend / Small Jump";
  _director
      .offset(100.0, {[this]() {
                if (louis1 != nullptr) louis1->ctrl()->key_down({gk::kj}).key_down({gk::ka});
                if (louis2 != nullptr) louis2->ctrl()->key_down({gk::kj}).key_down({gk::ka});
                if (louis3 != nullptr) louis3->ctrl()->click({gk::kj}).key_down({gk::ka});
              }})
      .offset(500.0, {[this]() {
                if (louis1 != nullptr) louis1->ctrl()->key_up(agk());
                if (louis2 != nullptr) louis2->ctrl()->key_up(agk()).key_down({gk::kd});
                if (louis3 != nullptr) louis3->ctrl()->key_up(agk());
              }})
      .offset(500.0, {[this]() {
                if (louis1 != nullptr) louis1->ctrl()->key_up(agk());
                if (louis2 != nullptr) louis2->ctrl()->key_up(agk());
                if (louis3 != nullptr) louis3->ctrl()->key_up(agk());
              }})
      .wait(1000.0)
      .times(999.0)
      .sort_actions();
}

void MoonTest::enter() {
  world.clear();
  lfw.change_bg(u"bg_moon");
  lfw.push_cmd({cmd_dist_cam(), number_to_string(midX() - modern_screen_width() / 2.0)});
  _director.reset();
  const std::vector<Entity*> louiss = hori_3(std::u16string(oid::kLouisEX), 100.0);
  for (Entity* const o : louiss) {
    o->set_team(team_enum::kTeam_1);
    o->as_key_role(Value(false));
    o->set_mp(1000000.0);
  }
  louis1 = louiss.size() > 0 ? louiss[0] : nullptr;
  louis2 = louiss.size() > 1 ? louiss[1] : nullptr;
  louis3 = louiss.size() > 2 ? louiss[2] : nullptr;
}

}
}
