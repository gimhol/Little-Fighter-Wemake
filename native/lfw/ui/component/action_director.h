#pragma once

#include <functional>
#include <vector>

namespace lfw {
namespace ui {

// TS `src/LFW/director/ActionDirector.ts`（4BU 之后从 `ui/component/Tests/` 迁到 `director/`）：
// 定时工作队列（`repeat`/`offset`/`insert`/
// `wait` 按 `end_time` 顺序落表，`update` 用「当前指针 + 一次性 min(end_time, time)」
// 分发；`_lifetime` 到点回卷）。
class ActionDirector {
 public:
  using Work = std::function<void()>;

  struct Action {
    double time = 0;
    Work work;
    double seq = 0;
  };

  double lifetime() const { return _lifetime; }
  double end_time() const;
  size_t action_index() const { return _action_idx; }
  double curr() const { return _curr; }
  double times_value() const { return _times; }
  size_t action_count() const { return _actions.size(); }
  const std::vector<Action>& actions() const { return _actions; }

  ActionDirector& reset();
  ActionDirector& repeat(double times, double delay, const std::vector<Work>& works);
  ActionDirector& offset(double delay, const std::vector<Work>& works);
  ActionDirector& insert(double time, Work work);
  ActionDirector& wait(double duration);
  ActionDirector& sort_actions();
  void update(double dt);
  ActionDirector& times(double times);

 private:
  size_t _action_idx = 0;
  std::vector<Action> _actions;
  double _lifetime = 0;
  double _times = 1;
  double _curr = 0;
  double _seq = 0;
};

}
}
