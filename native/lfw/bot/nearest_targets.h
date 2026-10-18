#pragma once

#include <cstddef>
#include <functional>
#include <vector>

#include "lfw/core/value.h"

namespace lfw {

class Entity;

namespace bot {

class BotTarget {
 public:
  BotTarget(Value entity, double distance, Value defendable)
      : entity(std::move(entity)), distance(distance), defendable(std::move(defendable)) {}

  Value facing() const;
  Value x() const;

  Value entity;
  double distance;
  Value defendable;
};

class NearestTargets {
 public:
  explicit NearestTargets(double max) : max_(max) {}

  const BotTarget* get() const;
  void look(const Value& self, const Value& other, const Value& defendable = Value());
  // 自身是真实体时走这条（`manhattan_xz` 活读位置）；`other` 仍是跨帧存的引用。
  void look(const Entity& self, const Value& other, const Value& defendable = Value());
  void del(const std::function<bool(const BotTarget&)>& condition);
  void sort(const Value& self);
  void sort(const Entity& self);
  void clear();
  // 名单里还有同一个 `id` 的引用时，把存下来的快照引用换成名单里的新引用（TS 的 targets
  // 是活实体，每次 `BotController.update_lookup` 用这条把引用刷新一遍）。
  void reidentify(const std::vector<Value>& entities);

  double max() const { return max_; }
  const std::vector<BotTarget>& targets() const { return targets_; }
  const std::vector<Value>& entities() const { return entities_; }

 private:
  // `look` 的公共体：距离由调用方算好（`self` 是引用还是真实体只差这一步）。
  void insert_at(const Value& other, double distance, const Value& defendable);
  void sort_by(const std::function<double(const Value&)>& distance_of);
  bool has_entity(const Value& v) const;
  void add_entity(const Value& v);
  void del_entity(const Value& v);

  double max_;
  std::vector<BotTarget> targets_;
  std::vector<Value> entities_;
};

}
}
