#include "lfw/ui/component/tests/test_case.h"

#include <cmath>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/defines/cmd.h"
#include "lfw/defines/game_key.h"
#include "lfw/defines/oid.h"
#include "lfw/entity/entity.h"
#include "lfw/lfw.h"
#include "lfw/ui/component/tests/tests.h"
#include "lfw/utils/math/base.h"
#include "lfw/utils/math/round_float.h"
#include "lfw/world.h"

namespace lfw {
namespace ui {

const std::vector<std::u16string>& agk() {
  static const std::vector<std::u16string> keys = []() {
    std::vector<std::u16string> out;
    for (const char16_t* const k : all_game_keys()) out.emplace_back(k);
    return out;
  }();
  return keys;
}

double TestCase::key_counter = -1.0;

TestCase::TestCase(Tests& owner) : ComponentFSMState(owner) {
  _key = ++key_counter;
  IState::name = u"None";
}

TestCase::~TestCase() = default;

Value TestCase::key() const { return Value(_key); }

std::optional<Value> TestCase::update(double dt) {
  if (!world.paused()) director().update(dt);
  return std::nullopt;
}

void TestCase::enter() {
  director().reset();
  world.camera().undest();
  world.camera().unlock();
  world.clear();
  lfw.change_bg(u"bg_4");
}

void TestCase::leave() {
  lfw.push_cmd({std::u16string(cmd::kDIST_CAM)});
  world.clear();
  lfw.change_bg(u"bg_4");
}

Background& TestCase::bg() const {
  Background* const b = world.bg();
  return *b;
}

FSM& TestCase::fsm() const { return *owner.fsm(); }

double TestCase::left() const { return bg().left(); }
double TestCase::right() const { return bg().right(); }
double TestCase::far_plane() const { return bg().far_plane(); }
double TestCase::near_plane() const { return bg().near_plane(); }
double TestCase::midX() const { return round_float((left() + right()) / 2.0); }
double TestCase::midZ() const { return round_float((near_plane() + far_plane()) / 2.0); }

Entity* TestCase::spawn(const std::u16string& oid) {
  // TS：`const data = this.lfw.datas.find_object(oid); if (!data) return null;`
  const Value* const data = lfw.datas().find_object(Value(oid));
  if (data == nullptr) return nullptr;
  return lfw.create_entity(world, *data);
}

std::vector<Entity*> TestCase::spawns(const std::vector<std::u16string>& oids) {
  std::vector<Entity*> ret;
  for (const std::u16string& oid : oids) ret.push_back(spawn(oid));
  return ret;
}

std::vector<Entity*> TestCase::bandits_8() {
  return circle({std::u16string(oid::kBandit)}, midX(), midZ(), bg().width() / 2.0,
                bg().depth() / 2.0, 8);
}

std::vector<Entity*> TestCase::bandits_mid_8(double x, double z) {
  return circle({std::u16string(oid::kBandit)}, midX(), midZ(), x, z, 8);
}

std::vector<Entity*> TestCase::circle(const std::vector<std::u16string>& oids, double ox, double oz,
                                      double r1, double r2, int count) {
  if (oids.empty()) return {};
  const int n = count >= 0 ? count : static_cast<int>(oids.size());
  if (n <= 0) return {};
  std::vector<Entity*> ret;
  const double d = PI * 2.0 / static_cast<double>(n);
  for (int i = 0; i < n; ++i) {
    const std::u16string& oid_str = oids[static_cast<std::size_t>(i) % oids.size()];
    const double a = round_float(d * static_cast<double>(i));
    const double x = n == 1 ? ox : round_float(ox + cos(a) * r1);
    const double z = n == 1 ? oz : round_float(oz + sin(a) * r2);
    Entity* const e = spawn(oid_str);
    if (e == nullptr) break;
    ret.push_back(e);
    e->set_position(Value(x), Value(0.0), Value(z));
    e->attach();
  }
  return ret;
}

std::vector<Entity*> TestCase::verti(const std::vector<std::u16string>& oids, double ox, double oz,
                                     double h, int count) {
  if (oids.empty()) return {};
  const int n = count >= 0 ? count : static_cast<int>(oids.size());
  if (n <= 0) return {};
  std::vector<Entity*> ret;
  const double d = n > 1 ? h / static_cast<double>(n - 1) : 0.0;
  for (int i = 0; i < n; ++i) {
    const double z = round_float(n == 1 ? oz : oz - h / 2.0 + d * static_cast<double>(i));
    const std::u16string& oid_str = oids[static_cast<std::size_t>(i) % oids.size()];
    Entity* const o = spawn(oid_str);
    if (o == nullptr) continue;
    o->set_position(Value(ox), Value(0.0), Value(z));
    o->attach();
    ret.push_back(o);
  }
  return ret;
}

std::vector<Entity*> TestCase::hori(const std::vector<std::u16string>& oids, double ox, double oz,
                                    double w, int count) {
  if (oids.empty()) return {};
  const int n = count >= 0 ? count : static_cast<int>(oids.size());
  if (n <= 0) return {};
  std::vector<Entity*> ret;
  const double d = n > 1 ? w / static_cast<double>(n - 1) : 0.0;
  for (int i = 0; i < n; ++i) {
    const double x = round_float(n == 1 ? ox : ox - w / 2.0 + d * static_cast<double>(i));
    const std::u16string& oid_str = oids[static_cast<std::size_t>(i) % oids.size()];
    Entity* const o = spawn(oid_str);
    if (o == nullptr) continue;
    o->set_position(Value(x), Value(0.0), Value(oz));
    o->attach();
    ret.push_back(o);
  }
  return ret;
}

std::vector<Entity*> TestCase::hori_3(const std::u16string& oid, double rx, std::optional<double> z) {
  return hori({oid}, midX(), z.value_or(midZ()), rx * 2.0, 3);
}

std::vector<Entity*> TestCase::hori_2(const std::u16string& oid, double rx, std::optional<double> z) {
  return hori({oid}, midX(), z.value_or(midZ()), rx * 2.0, 2);
}

std::vector<Entity*> TestCase::verti_3(const std::u16string& oid, std::optional<double> x, double z) {
  return verti({oid}, x.value_or(midX()), midZ(), z, 3);
}

}
}
