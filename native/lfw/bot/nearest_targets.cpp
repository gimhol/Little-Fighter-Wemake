#include "lfw/bot/nearest_targets.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <functional>
#include <utility>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/entity/entity.h"
#include "lfw/helper/manhattan_xz.h"

namespace lfw {
namespace bot {
namespace {

// `sort` 的比较器：距离优先，距离相等再比 `id`（TS 的 `a.id < b.id` 口径）。
bool target_less(const std::pair<double, const Entity*>& a,
                 const std::pair<double, const Entity*>& b) {
  const double d = a.first - b.first;
  if (d != 0.0) {
    if (std::isnan(d)) return false;
    return d < 0.0;
  }
  const Value ia = Value(a.second->id);
  const Value ib = Value(b.second->id);
  if (lt(ia, ib)) return true;
  if (gt(ia, ib)) return false;
  return false;
}

}  // namespace

const Entity* NearestTargets::get() const { return targets_.empty() ? nullptr : targets_[0]; }

bool NearestTargets::has_target(const Entity* v) const {
  for (const Entity* t : targets_) {
    if (t == v) return true;
  }
  return false;
}

void NearestTargets::look(const Entity& self, const Entity& other) {
  look_impl([&self](const Entity* t) { return helper::manhattan_xz(self, *t); }, &other);
}

void NearestTargets::look_impl(const std::function<double(const Entity*)>& distance_of,
                               const Entity* other) {
  if (other == nullptr) return;
  if (has_target(other)) return;
  const double distance = distance_of(other);
  const std::size_t len = targets_.size();
  if (static_cast<double>(len) < max_) {
    targets_.push_back(other);
    return;
  }
  for (std::size_t i = 0; i < len; ++i) {
    if (distance > distance_of(targets_[i])) continue;
    targets_.insert(targets_.begin() + static_cast<std::ptrdiff_t>(i), other);
    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());
    break;
  }
}

void NearestTargets::del(const std::function<bool(const Entity&)>& condition) {
  std::vector<const Entity*> kept;
  kept.reserve(targets_.size());
  for (const Entity* t : targets_) {
    if (!condition(*t)) kept.push_back(t);
  }
  targets_ = std::move(kept);
}

void NearestTargets::sort(const Entity& self) {
  sort_by([&self](const Entity* t) { return helper::manhattan_xz(self, *t); });
}

void NearestTargets::sort_by(const std::function<double(const Entity*)>& distance_of) {
  std::vector<std::pair<double, const Entity*>> tmp;
  tmp.reserve(targets_.size());
  for (const Entity* t : targets_) tmp.emplace_back(distance_of(t), t);
  std::stable_sort(tmp.begin(), tmp.end(), target_less);
  for (std::size_t i = 0; i < tmp.size(); ++i) targets_[i] = tmp[i].second;
}

void NearestTargets::clear() { targets_.clear(); }

}  // namespace bot
}  // namespace lfw