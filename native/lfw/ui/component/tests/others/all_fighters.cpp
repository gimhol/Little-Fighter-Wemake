#include "lfw/ui/component/tests/others/all_fighters.h"

#include "lfw/defines/team_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/math/base.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

AllFighters::AllFighters(Tests& owner) : TestCase(owner) {
  name = u"All Fighters";
  _director.offset(2000.0, {[this]() {
                     for (Entity* const v : fighters) {
                       const std::u16string team = v->team();
                       if (team.empty()) {
                         v->set_team(u"1");
                       } else if (team == team_enum::kMax) {
                         v->set_team(std::u16string());
                       } else {
                         v->set_team(number_to_string(
                             std::fmod(to_number(Value(team)), to_number(Value(team_enum::kMax))) +
                             1.0));
                       }
                     }
                   }})
      .times(9999.0);
}

void AllFighters::enter() {
  TestCase::enter();
  _director.reset();

  std::vector<std::u16string> all_ids;
  for (const Value& v : lfw.datas().fighters()) {
    all_ids.push_back(to_string(field_or(v, u"id")));
  }
  const size_t half_len = static_cast<size_t>(round(static_cast<double>(all_ids.size()) / 2.0));
  const std::vector<std::u16string> ids_1(all_ids.begin(), all_ids.begin() + half_len);
  const std::vector<std::u16string> ids_2(all_ids.begin() + half_len, all_ids.end());
  fighters = hori(ids_1, midX(), midZ() - 50.0, bg().width() - 120.0);
  const std::vector<Entity*> row2 =
      hori(ids_2, midX(), near_plane(), bg().width() - 120.0);
  fighters.insert(fighters.end(), row2.begin(), row2.end());

  for (Entity* const v : fighters) {
    v->as_key_role(Value(false));
    v->set_stat_bar(0.0);
    v->name_visible = 1.0;
    v->set_team(std::u16string());
    v->attach();
  }
}

}
}
