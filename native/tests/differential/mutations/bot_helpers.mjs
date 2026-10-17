export default {
  subject: "bot_helpers",
  mutations: [
    {
      note: "manhattan_xz 的 dx 丢了 abs",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  return round_float(abs(dx) + abs(dz));`,
      to: `  return round_float(dx + abs(dz));`,
    },
    {
      note: "manhattan_xz 的 dz 丢了 abs",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  return round_float(abs(dx) + abs(dz));`,
      to: `  return round_float(abs(dx) + dz);`,
    },
    {
      note: "manhattan_xz 用 round 代替 round_float",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  return round_float(abs(dx) + abs(dz));`,
      to: `  return round(abs(dx) + abs(dz));`,
    },
    {
      note: "manhattan_xz 完全不做四舍五入",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  return round_float(abs(dx) + abs(dz));`,
      to: `  return abs(dx) + abs(dz);`,
    },
    {
      note: "manhattan_xz 的 dx 读成 z",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  const double dx = to_number(field_or(pa, u"x")) - to_number(field_or(pb, u"x"));`,
      to: `  const double dx = to_number(field_or(pa, u"z")) - to_number(field_or(pb, u"z"));`,
    },
    {
      note: "manhattan_xz 的 dx 变成加法",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  const double dx = to_number(field_or(pa, u"x")) - to_number(field_or(pb, u"x"));`,
      to: `  const double dx = to_number(field_or(pa, u"x")) + to_number(field_or(pb, u"x"));`,
    },
    {
      note: "manhattan_xz 的 dx 两边都读 a",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  const double dx = to_number(field_or(pa, u"x")) - to_number(field_or(pb, u"x"));`,
      to: `  const double dx = to_number(field_or(pa, u"x")) - to_number(field_or(pa, u"x"));`,
    },
    {
      note: "manhattan_xz 读的是 a 的 position 两次",
      file: "native/lfw/helper/manhattan_xz.cpp",
      from: `  const Value pb = field_or(b, u"position");`,
      to: `  const Value pb = field_or(a, u"position");`,
    },
    {
      note: "closest 完全不做四舍五入",
      file: "native/lfw/bot/closest.cpp",
      from: `    const double d = round(abs(dx) + abs(dz));`,
      to: `    const double d = abs(dx) + abs(dz);`,
    },
    {
      note: "closest 的最小值判定用 <=",
      file: "native/lfw/bot/closest.cpp",
      from: `    if (!truthy(ret) || d < distance) {`,
      to: `    if (!truthy(ret) || d <= distance) {`,
    },
    {
      note: "closest 不跳过假值项",
      file: "native/lfw/bot/closest.cpp",
      from: `    if (!truthy(it)) continue;`,
      to: `    if (false) continue;`,
    },
    {
      note: "closest 丢掉首个候选的赋值",
      file: "native/lfw/bot/closest.cpp",
      from: `    if (!truthy(ret) || d < distance) {`,
      to: `    if (d < distance) {`,
    },
    {
      note: "closest 的 dx 丢了 abs",
      file: "native/lfw/bot/closest.cpp",
      from: `    const double d = round(abs(dx) + abs(dz));`,
      to: `    const double d = round(dx + abs(dz));`,
    },
    {
      note: "closest 的距离变成相减",
      file: "native/lfw/bot/closest.cpp",
      from: `    const double d = round(abs(dx) + abs(dz));`,
      to: `    const double d = round(abs(dx) - abs(dz));`,
    },
    {
      note: "closest 的 dx 读成 z",
      file: "native/lfw/bot/closest.cpp",
      from: `    const double dx = to_number(field_or(pm, u"x")) - to_number(field_or(pi, u"x"));`,
      to: `    const double dx = to_number(field_or(pm, u"z")) - to_number(field_or(pi, u"z"));`,
    },
    {
      note: "closest 记错获胜者",
      file: "native/lfw/bot/closest.cpp",
      from: `      ret = it;
      distance = d;`,
      to: `      ret = me;
      distance = d;`,
    },
    {
      note: "closest 忘记更新 distance",
      file: "native/lfw/bot/closest.cpp",
      from: `      ret = it;
      distance = d;`,
      to: `      ret = it;
      distance = 0;`,
    },
    {
      note: "closest 拿 it 的 position 当 me",
      file: "native/lfw/bot/closest.cpp",
      from: `    const Value pi = field_or(it, u"position");`,
      to: `    const Value pi = field_or(me, u"position");`,
    },
    {
      note: "is_ray_hit 的 x 读成 z",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double x = to_number(field_or(ray, u"x"));`,
      to: `  const double x = to_number(field_or(ray, u"z"));`,
    },
    {
      note: "is_ray_hit 的 z 读成 x",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double z = to_number(field_or(ray, u"z"));`,
      to: `  const double z = to_number(field_or(ray, u"x"));`,
    },
    {
      note: "is_ray_hit 的 min_x 默认值写错",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double min_x = num_or(field_or(ray, u"min_x"), 0.0);`,
      to: `  const double min_x = num_or(field_or(ray, u"min_x"), 1.0);`,
    },
    {
      note: "is_ray_hit 的 max_x 默认值写错",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double max_x = num_or(field_or(ray, u"max_x"), 10000.0);`,
      to: `  const double max_x = num_or(field_or(ray, u"max_x"), 1000.0);`,
    },
    {
      note: "is_ray_hit 的 min_z 默认值写错",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double min_z = num_or(field_or(ray, u"min_z"), 0.0);`,
      to: `  const double min_z = num_or(field_or(ray, u"min_z"), 1.0);`,
    },
    {
      note: "is_ray_hit 的 max_z 默认值写错",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double max_z = num_or(field_or(ray, u"max_z"), 10000.0);`,
      to: `  const double max_z = num_or(field_or(ray, u"max_z"), 100000.0);`,
    },
    {
      note: "is_ray_hit 的默认值也吃 null",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `double num_or(const Value& v, double fallback) {
  return is_undefined(v) ? fallback : to_number(v);
}`,
      to: `double num_or(const Value& v, double fallback) {
  if (is_undefined(v)) return fallback;
  if (std::holds_alternative<NullTag>(v)) return fallback;
  return to_number(v);
}`,
    },
    {
      note: "is_ray_hit 的 reverse 不吃 false 默认值",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const Value reverse = defaulted(field_or(ray, u"reverse"), Value(false));`,
      to: `  const Value reverse = field_or(ray, u"reverse");`,
    },
    {
      note: "is_ray_hit 的 reverse 恒为默认值",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const Value reverse = defaulted(field_or(ray, u"reverse"), Value(false));`,
      to: `  const Value reverse = Value(false);`,
    },
    {
      note: "is_ray_hit 的 facing 读成 b 的",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double facing = a.facing;`,
      to: `  const double facing = b.facing;`,
    },
    {
      note: "is_ray_hit 的 dx 方向反了",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double dx = round_float(b.position.x - a.position.x);`,
      to: `  const double dx = round_float(a.position.x - b.position.x);`,
    },
    {
      note: "is_ray_hit 的 dz 方向反了",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double dz = round_float(b.position.z - a.position.z);`,
      to: `  const double dz = round_float(a.position.z - b.position.z);`,
    },
    {
      note: "is_ray_hit 的 dx 不做四舍五入",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double dx = round_float(b.position.x - a.position.x);`,
      to: `  const double dx = b.position.x - a.position.x;`,
    },
    {
      note: "is_ray_hit 的 dz 不做四舍五入",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double dz = round_float(b.position.z - a.position.z);`,
      to: `  const double dz = b.position.z - a.position.z;`,
    },
    {
      note: "is_ray_hit 的 dx 乘掉了 facing",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(facing * dx, min_x, max_x)) return reverse;`,
      to: `  if (!between(dx, min_x, max_x)) return reverse;`,
    },
    {
      note: "is_ray_hit 的 dx 变成加法",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(facing * dx, min_x, max_x)) return reverse;`,
      to: `  if (!between(facing + dx, min_x, max_x)) return reverse;`,
    },
    {
      note: "is_ray_hit 的 min_x/max_x 传反",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(facing * dx, min_x, max_x)) return reverse;`,
      to: `  if (!between(facing * dx, max_x, min_x)) return reverse;`,
    },
    {
      note: "is_ray_hit 不检查 x 范围",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(facing * dx, min_x, max_x)) return reverse;`,
      to: `  if (false) return reverse;`,
    },
    {
      note: "is_ray_hit 的 dz 丢了 abs",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(abs(dz), min_z, max_z)) return reverse;`,
      to: `  if (!between(dz, min_z, max_z)) return reverse;`,
    },
    {
      note: "is_ray_hit 的 dz 用了 abs(dx)",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(abs(dz), min_z, max_z)) return reverse;`,
      to: `  if (!between(abs(dx), min_z, max_z)) return reverse;`,
    },
    {
      note: "is_ray_hit 的 min_z/max_z 传反",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(abs(dz), min_z, max_z)) return reverse;`,
      to: `  if (!between(abs(dz), max_z, min_z)) return reverse;`,
    },
    {
      note: "is_ray_hit 不检查 z 范围",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(abs(dz), min_z, max_z)) return reverse;`,
      to: `  if (false) return reverse;`,
    },
    {
      note: "is_ray_hit 的 x 范围提前返回 false 而不是 reverse",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(facing * dx, min_x, max_x)) return reverse;`,
      to: `  if (!between(facing * dx, min_x, max_x)) return Value(false);`,
    },
    {
      note: "is_ray_hit 的 z 范围提前返回 false 而不是 reverse",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (!between(abs(dz), min_z, max_z)) return reverse;`,
      to: `  if (!between(abs(dz), min_z, max_z)) return Value(false);`,
    },
    {
      note: "is_ray_hit 的 d_sq 为零时提前返回 false 而不是 reverse",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (d_sq == 0.0) return reverse;`,
      to: `  if (d_sq == 0.0) return Value(false);`,
    },
    {
      note: "is_ray_hit 不处理 d_sq 为零",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  if (d_sq == 0.0) return reverse;`,
      to: `  if (false) return reverse;`,
    },
    {
      note: "is_ray_hit 的 rx 少乘 facing",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double rx = x * facing;`,
      to: `  const double rx = x;`,
    },
    {
      note: "is_ray_hit 的 rz 恒为零",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double rz = z;`,
      to: `  const double rz = 0.0;`,
    },
    {
      note: "is_ray_hit 的 rz 读成 x",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double rz = z;`,
      to: `  const double rz = x;`,
    },
    {
      note: "is_ray_hit 的 d_sq 用减法",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double d_sq = round_float(rx * rx + rz * rz);`,
      to: `  const double d_sq = round_float(rx * rx - rz * rz);`,
    },
    {
      note: "is_ray_hit 的 d_sq 没有平方",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double d_sq = round_float(rx * rx + rz * rz);`,
      to: `  const double d_sq = round_float(rx + rz);`,
    },
    {
      note: "is_ray_hit 的 d_sq 不做四舍五入",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double d_sq = round_float(rx * rx + rz * rz);`,
      to: `  const double d_sq = rx * rx + rz * rz;`,
    },
    {
      note: "is_ray_hit 的 cross 变成加法",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double cross = rx * dz - rz * dx;`,
      to: `  const double cross = rx * dz + rz * dx;`,
    },
    {
      note: "is_ray_hit 的 cross 丢掉 rz*dx",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double cross = rx * dz - rz * dx;`,
      to: `  const double cross = rx * dz;`,
    },
    {
      note: "is_ray_hit 的 cross 丢掉 rx*dz",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const double cross = rx * dz - rz * dx;`,
      to: `  const double cross = -rz * dx;`,
    },
    {
      note: "is_ray_hit 的命中判定没有归一化",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const bool hit = round_float((cross * cross) / d_sq) < max_d;`,
      to: `  const bool hit = round_float(cross * cross) < max_d;`,
    },
    {
      note: "is_ray_hit 的命中判定不做四舍五入",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const bool hit = round_float((cross * cross) / d_sq) < max_d;`,
      to: `  const bool hit = (cross * cross) / d_sq < max_d;`,
    },
    {
      note: "is_ray_hit 的命中判定用 <=",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  const bool hit = round_float((cross * cross) / d_sq) < max_d;`,
      to: `  const bool hit = round_float((cross * cross) / d_sq) <= max_d;`,
    },
    {
      note: "is_ray_hit 的 reverse 没有取反命中结果",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  return Value(truthy(reverse) ? !hit : hit);`,
      to: `  return Value(hit);`,
    },
    {
      note: "is_ray_hit 的 reverse 判定取反",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  return Value(truthy(reverse) ? !hit : hit);`,
      to: `  return Value(!truthy(reverse) ? !hit : hit);`,
    },
    {
      note: "is_ray_hit 的 reverse 分支写反",
      file: "native/lfw/bot/is_ray_hit.cpp",
      from: `  return Value(truthy(reverse) ? !hit : hit);`,
      to: `  return Value(truthy(reverse) ? hit : !hit);`,
    },
    {
      note: "DummyEnum 表里 dLa_auto 的名字写成 dLj_auto",
      file: "native/lfw/bot/dummy_enum.cpp",
      from: `    {u"LockAtMid_dLa_auto", dummy_enum::kLockAtMid_dLa_auto},`,
      to: `    {u"LockAtMid_dLj_auto", dummy_enum::kLockAtMid_dLa_auto},`,
    },
    {
      note: "DummyEnum.dLa_auto 的常量指错",
      file: "native/lfw/bot/dummy_enum.cpp",
      from: `    {u"LockAtMid_dLa_auto", dummy_enum::kLockAtMid_dLa_auto},`,
      to: `    {u"LockAtMid_dLa_auto", dummy_enum::kLockAtMid_dLj_auto},`,
    },
    {
      note: "DummyEnum.dDj_auto 的值改成 19",
      file: "native/lfw/bot/dummy_enum.h",
      from: `inline constexpr const char16_t* kLockAtMid_dDj_auto = u"18";`,
      to: `inline constexpr const char16_t* kLockAtMid_dDj_auto = u"19";`,
    },
    {
      note: "DummyEnum.dja_auto 的值改成 21",
      file: "native/lfw/bot/dummy_enum.h",
      from: `inline constexpr const char16_t* kLockAtMid_dja_auto = u"22";`,
      to: `inline constexpr const char16_t* kLockAtMid_dja_auto = u"21";`,
    },
    {
      note: "DummyEnum.dRj 的值改成 12",
      file: "native/lfw/bot/dummy_enum.h",
      from: `inline constexpr const char16_t* kLockAtMid_dRj = u"13";`,
      to: `inline constexpr const char16_t* kLockAtMid_dRj = u"12";`,
    },
    {
      note: "DummyEnum.RowingWhenFalling 的值改成 4",
      file: "native/lfw/bot/dummy_enum.h",
      from: `inline constexpr const char16_t* kLockAtMid_RowingWhenFalling = u"3";`,
      to: `inline constexpr const char16_t* kLockAtMid_RowingWhenFalling = u"4";`,
    },
    {
      note: "DummyEnum 表里 dRa 与 dLj 互换",
      file: "native/lfw/bot/dummy_enum.cpp",
      from: `    {u"LockAtMid_dLj", dummy_enum::kLockAtMid_dLj},
    {u"LockAtMid_dRa", dummy_enum::kLockAtMid_dRa},`,
      to: `    {u"LockAtMid_dLj", dummy_enum::kLockAtMid_dRa},
    {u"LockAtMid_dRa", dummy_enum::kLockAtMid_dLj},`,
    },
    {
      note: "DummyEnum 表里 dja 的名字拼错",
      file: "native/lfw/bot/dummy_enum.cpp",
      from: `    {u"LockAtMid_dja", dummy_enum::kLockAtMid_dja},`,
      to: `    {u"LockAtMid_daj", dummy_enum::kLockAtMid_dja},`,
    },
    {
      note: "dummy_updater_ids 少了一个有更新器的 id",
      file: "native/lfw/bot/dummy_enum.cpp",
      from: `    dummy_enum::kLockAtMid_dRj,
    dummy_enum::kLockAtMid_dja,`,
      to: `    dummy_enum::kLockAtMid_dRj,`,
    },
    {
      note: "dummy_updater_ids 少了一个 _auto id",
      file: "native/lfw/bot/dummy_enum.cpp",
      from: `    dummy_enum::kLockAtMid_dRj_auto,
    dummy_enum::kLockAtMid_dja_auto,`,
      to: `    dummy_enum::kLockAtMid_dRj_auto,`,
    },
    {
      note: "NearestTargets.get 返回最后一个而不是第一个",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  return targets_.empty() ? nullptr : &targets_[0];`,
      to: `  return targets_.empty() ? nullptr : &targets_[targets_.size() - 1];`,
    },
    {
      note: "NearestTargets.has_entity 恒为假",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `bool NearestTargets::has_entity(const Value& v) const {
  for (const Value& e : entities_) {
    if (strict_equals(e, v)) return true;
  }
  return false;
}`,
      to: `bool NearestTargets::has_entity(const Value& v) const {
  (void)v;
  return false;
}`,
    },
    {
      note: "NearestTargets.look 漏掉 self 假值检查",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  if (!truthy(self) || has_entity(other)) return;`,
      to: `  if (has_entity(other)) return;`,
    },
    {
      note: "NearestTargets.look 检查的是 self 是否已收录",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  if (!truthy(self) || has_entity(other)) return;`,
      to: `  if (!truthy(self) || has_entity(self)) return;`,
    },
    {
      note: "NearestTargets.look 的假值判定查了 other",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  if (!truthy(self) || has_entity(other)) return;`,
      to: `  if (!truthy(other) || has_entity(other)) return;`,
    },
    {
      note: "NearestTargets.look 的容量判定用 <=",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  if (static_cast<double>(len) < max_) {`,
      to: `  if (static_cast<double>(len) <= max_) {`,
    },
    {
      note: "NearestTargets.look 满员分支不加实体",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    targets_.push_back(BotTarget(other, distance, defendable_of(defendable)));
    add_entity(other);
    return;`,
      to: `    targets_.push_back(BotTarget(other, distance, defendable_of(defendable)));
    return;`,
    },
    {
      note: "NearestTargets.look 满员分支忽略 defendable",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    targets_.push_back(BotTarget(other, distance, defendable_of(defendable)));
    add_entity(other);
    return;`,
      to: `    targets_.push_back(BotTarget(other, distance, Value(0.0)));
    add_entity(other);
    return;`,
    },
    {
      note: "NearestTargets.look 的比距离用 >=",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    if (distance > targets_[i].distance) continue;`,
      to: `    if (distance >= targets_[i].distance) continue;`,
    },
    {
      note: "NearestTargets.look 的 continue 写成 break",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    if (distance > targets_[i].distance) continue;`,
      to: `    if (distance > targets_[i].distance) break;`,
    },
    {
      note: "NearestTargets.look 插入位置写死为末尾",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    targets_.insert(targets_.begin() + static_cast<std::ptrdiff_t>(i),
                    BotTarget(other, distance, defendable_of(defendable)));`,
      to: `    targets_.push_back(BotTarget(other, distance, defendable_of(defendable)));`,
    },
    {
      note: "NearestTargets.look 满员插入分支不加实体",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    add_entity(other);
    const Value entity = targets_[static_cast<std::size_t>(max_)].entity;`,
      to: `    const Value entity = targets_[static_cast<std::size_t>(max_)].entity;`,
    },
    {
      note: "NearestTargets.look 删错被挤出的实体",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    const Value entity = targets_[static_cast<std::size_t>(max_)].entity;`,
      to: `    const Value entity = targets_[0].entity;`,
    },
    {
      note: "NearestTargets.look 不把挤出的实体移出集合",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    del_entity(entity);
    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());
    break;`,
      to: `    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());
    break;`,
    },
    {
      note: "NearestTargets.look 不截断到 max",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    del_entity(entity);
    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());
    break;`,
      to: `    del_entity(entity);
    break;`,
    },
    {
      note: "NearestTargets.look 的截断清空整表",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());`,
      to: `    targets_.erase(targets_.begin(), targets_.end());`,
    },
    {
      note: "NearestTargets.look 插入后不 break",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());
    break;`,
      to: `    targets_.erase(targets_.begin() + static_cast<std::ptrdiff_t>(max_), targets_.end());`,
    },
    {
      note: "NearestTargets.del 的条件取反",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    const bool ret = !condition(t);`,
      to: `    const bool ret = condition(t);`,
    },
    {
      note: "NearestTargets.del 删错实体",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    if (!ret) del_entity(t.entity);`,
      to: `    if (ret) del_entity(t.entity);`,
    },
    {
      note: "NearestTargets.del 不保留被保留的目标",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    if (ret) kept.push_back(t);`,
      to: `    kept.push_back(t);`,
    },
    {
      note: "NearestTargets.del 不把被删实体移出集合",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    const bool ret = !condition(t);
    if (!ret) del_entity(t.entity);`,
      to: `    const bool ret = !condition(t);`,
    },
    {
      note: "NearestTargets.del 不清空表",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  targets_ = std::move(kept);`,
      to: `  (void)kept;`,
    },
    {
      note: "NearestTargets.sort 不重算距离",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  for (BotTarget& t : targets_) t.distance = helper::manhattan_xz(self, t.entity);`,
      to: `  (void)self;`,
    },
    {
      note: "NearestTargets.sort 用 self 与自己算距离",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  for (BotTarget& t : targets_) t.distance = helper::manhattan_xz(self, t.entity);`,
      to: `  for (BotTarget& t : targets_) t.distance = helper::manhattan_xz(self, self);`,
    },
    {
      note: "NearestTargets.sort 的距离比较反了",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `    return d < 0.0;`,
      to: `    return d > 0.0;`,
    },
    {
      note: "NearestTargets.sort 的 id 比较反了",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  if (lt(ia, ib)) return true;`,
      to: `  if (lt(ia, ib)) return false;`,
    },
    {
      note: "NearestTargets.sort 没有 id 兜底比较",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  if (lt(ia, ib)) return true;
  if (gt(ia, ib)) return false;
  return false;`,
      to: `  return false;`,
    },
    {
      note: "NearestTargets.sort 的 id 取了 a 的两次",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  const Value ib = field_or(b.entity, u"id");`,
      to: `  const Value ib = field_or(a.entity, u"id");`,
    },
    {
      note: "NearestTargets.clear 不清实体集合",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  targets_.clear();
  entities_.clear();`,
      to: `  targets_.clear();`,
    },
    {
      note: "NearestTargets.clear 不清目标表",
      file: "native/lfw/bot/nearest_targets.cpp",
      from: `  targets_.clear();
  entities_.clear();`,
      to: `  entities_.clear();`,
    },
  ],
};
