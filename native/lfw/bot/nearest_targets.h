#pragma once

#include <cstddef>
#include <functional>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/entity/target_handle.h"

namespace lfw {

class Entity;

namespace bot {

class BotTarget {
 public:
  BotTarget(TargetHandle entity, double distance, Value defendable)
      : entity(std::move(entity)), distance(distance), defendable(std::move(defendable)) {}

  Value facing() const;
  Value x() const;

  // TS 的 `BotTarget.entity` 是活实体；端口用 `TargetHandle`（真实体或台面的引用快照）。
  TargetHandle entity;
  double distance;
  Value defendable;
};

class NearestTargets {
 public:
  explicit NearestTargets(double max) : max_(max) {}

  const BotTarget* get() const;
  // `self` 的两条重载与 `manhattan_xz` 一致：真实体（活读）优先，台面用引用。
  void look(const Value& self, const TargetHandle& other, const Value& defendable = Value());
  void look(const Entity& self, const TargetHandle& other, const Value& defendable = Value());
  void look(const Value& self, const Value& other, const Value& defendable = Value());
  void look(const Entity& self, const Value& other, const Value& defendable = Value());
  void del(const std::function<bool(const BotTarget&)>& condition);
  void sort(const Value& self);
  void sort(const Entity& self);
  void clear();

  double max() const { return max_; }
  const std::vector<BotTarget>& targets() const { return targets_; }
  const std::vector<TargetHandle>& entities() const { return entities_; }

 private:
  // `look` 的公共体：距离由调用方算好（`self` / `other` 的取法只差这一步）。
  void insert_at(const TargetHandle& other, double distance, const Value& defendable);
  void sort_by(const std::function<double(const BotTarget&)>& distance_of);
  bool has_entity(const TargetHandle& v) const;
  void add_entity(const TargetHandle& v);
  void del_entity(const TargetHandle& v);

  double max_;
  std::vector<BotTarget> targets_;
  std::vector<TargetHandle> entities_;
};

}
}
