#pragma once

#include <cstddef>
#include <functional>
#include <vector>

namespace lfw {

class Entity;

namespace bot {

// TS 的 `NearestTargets.targets` 就是 `Entity[]`：距离随用随读，不另存 distance。
class NearestTargets {
 public:
  explicit NearestTargets(double max) : max_(max) {}

  // `targets[0]`；空表给 `undefined`（`nullptr`）。
  const Entity* get() const;
  void look(const Entity& self, const Entity& other);
  void del(const std::function<bool(const Entity&)>& condition);
  void sort(const Entity& self);
  void clear();

  double max() const { return max_; }
  const std::vector<const Entity*>& targets() const { return targets_; }
  std::size_t size() const { return targets_.size(); }
  bool empty() const { return targets_.empty(); }

 private:
  bool has_target(const Entity* v) const;
  void look_impl(const std::function<double(const Entity*)>& distance_of, const Entity* other);
  void sort_by(const std::function<double(const Entity*)>& distance_of);

  double max_;
  std::vector<const Entity*> targets_;
};

}
}