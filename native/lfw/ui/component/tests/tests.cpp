#include "lfw/ui/component/tests/tests.h"

#include "lfw/core/js_string.h"
#include "lfw/defines/game_key.h"
#include "lfw/lfw.h"
#include "lfw/ui/component/tests/director_test_case.h"
#include "lfw/ui/component/tests/test_case.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace ui {

namespace {

// TS `Tests.ts`（4CJ 起）：用例组来自**数据** —— `lfw.datas.directors` 的 17 组，
// 每组里每份 `IDirectorData` 造一个 `DirectorTestCase`；数据里一份都没有时退回
// `[[new TestCase(owner)]]`（空壳用例，行为与老的 `TestCase` 那一格一样）。
std::vector<std::vector<TestCase*>> build_groups(Tests& owner) {
  std::vector<std::vector<TestCase*>> g;
  const std::vector<Value>& list = owner.lfw().datas().directors();
  for (const Value& group : list) {
    std::vector<TestCase*> row;
    if (const Array* const arr = as_array(field_or(group, u"directors"))) {
      for (const Value& data : arr->items()) row.push_back(new DirectorTestCase(owner, data));
    }
    g.push_back(std::move(row));
  }
  if (g.empty()) g.push_back({new TestCase(owner)});
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
