#include "lfw/director/action_director.h"

#include <algorithm>
#include <cmath>

#include "lfw/utils/math/base.h"

namespace lfw {
namespace director {

double ActionDirector::end_time() const {
  return !_actions.empty() ? _actions.back().time : 0.0;
}

ActionDirector& ActionDirector::reset() {
  _lifetime = 0;
  _curr = 0;
  _action_idx = 0;
  return *this;
}

ActionDirector& ActionDirector::repeat(double times, double delay,
                                       const std::vector<Work>& works) {
  double time = end_time();
  do {
    for (const Work& work : works) {
      insert(time += delay, work);
    }
    --times;
  } while (times > 0);
  return *this;
}

ActionDirector& ActionDirector::offset(double delay, const std::vector<Work>& works) {
  return repeat(0, delay, works);
}

ActionDirector& ActionDirector::insert(double time, Work work) {
  _actions.push_back(Action{time, std::move(work), _seq++});
  return *this;
}

ActionDirector& ActionDirector::wait(double duration) {
  return insert(end_time() + duration, []() {});
}

ActionDirector& ActionDirector::sort_actions() {
  std::stable_sort(_actions.begin(), _actions.end(), [](const Action& a, const Action& b) {
    if (a.time != b.time) return a.time < b.time;
    return a.seq < b.seq;
  });
  return *this;
}

void ActionDirector::update(double dt) {
  const double end = end_time();

  if (_action_idx == _actions.size() && _curr < _times) {
    _action_idx = 0;
    ++_curr;
  }

  const double time = _lifetime + dt;
  if (_curr < _times && _times > 0) {
    std::vector<const Action*> actions;
    const double t = end != 0 ? min(end, time) : time;
    for (; _action_idx < _actions.size(); ++_action_idx) {
      const Action& action = _actions[_action_idx];
      if (action.time > t) break;
      actions.push_back(&action);
    }
    for (const Action* const v : actions) v->work();
  }

  _lifetime = end != 0 ? std::fmod(time, end) : time;
}

ActionDirector& ActionDirector::times(double times) {
  _times = times;
  return *this;
}

}
}
