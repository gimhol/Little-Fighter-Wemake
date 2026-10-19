#pragma once

#include <optional>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/ui/component/action_director.h"
#include "lfw/ui/component/component_fsm_state.h"

namespace lfw {

class Background;
class Entity;
class FSM;
class LFW;
class World;

namespace ui {

class Tests;

// TS 的 `...AGK`（`defines/GameKey.ts` 的"全部按键"，顺序会影响按键判定）—— 端口 `all_game_keys()`
// 是 `const char16_t*`，而 `BaseController::key_up` 吃 `std::vector<std::u16string>` ⇒ 转一手。
const std::vector<std::u16string>& agk();

// TS `ui/component/Tests/TestCase.ts`：测试模式里的**一个用例**（一个 `IState<number>`）。
// 一个用例 = 「把场上摆好」（`enter`）+「一段定时脚本」（`director`）。
//
// 三处移植形状：
//   * TS 子类用 `override readonly director = new ActionDirector()...` **换掉**基类那一份；C++ 不能
//     覆盖数据成员 ⇒ 基类给虚访问器 `director()`，子类自己持一份成员覆写它（见 `others/all_fighters.h`）。
//   * TS 的 `oid: string | string[]` ⇒ 端口统一收 `std::vector<std::u16string>`（单个写 `{oid}`）。
//   * TS 的 `hori_3/hori_2/verti_3` 是**箭头函数字段**（缺省参数里绑 `this.midX/midZ`）⇒ 端口用
//     `std::optional` 的"没给就用 midX/midZ"（`std::nullopt` 即 `this.midZ`）。
class TestCase : public ComponentFSMState {
 public:
  // TS `static key = -1`：`Tests::on_start` 每次把它重置，`++` 之后第一个用例的 key 是 0。
  static double key_counter;

  explicit TestCase(Tests& owner);
  ~TestCase() override;

  Value key() const override;
  std::optional<Value> update(double dt) override;
  void enter() override;
  void leave() override;

  // `override readonly director`（子类覆写那一份就返回子类自己的）。
  virtual ActionDirector& director() { return _director; }

  // `this.owner.lfw` 别名（`ComponentFSMState` 只给 `UIComponent& owner`）。
  UIComponent& owner_component() const { return owner; }

  std::vector<Entity*> entities;
  std::vector<Entity*> fighters;
  std::vector<Entity*> weapons;

  Background& bg() const;
  FSM& fsm() const;
  double left() const;
  double right() const;
  double far_plane() const;
  double near_plane() const;
  double midX() const;
  double midZ() const;

  Entity* spawn(const std::u16string& oid);
  std::vector<Entity*> spawns(const std::vector<std::u16string>& oids);
  std::vector<Entity*> bandits_8();
  std::vector<Entity*> bandits_mid_8(double x = 100.0, double z = 50.0);
  std::vector<Entity*> circle(const std::vector<std::u16string>& oids, double ox, double oz,
                              double r1, double r2, int count = -1);
  std::vector<Entity*> verti(const std::vector<std::u16string>& oids, double ox, double oz,
                             double h, int count = -1);
  std::vector<Entity*> hori(const std::vector<std::u16string>& oids, double ox, double oz, double w,
                            int count = -1);
  std::vector<Entity*> hori_3(const std::u16string& oid, double rx = 250.0,
                              std::optional<double> z = std::nullopt);
  std::vector<Entity*> hori_2(const std::u16string& oid, double rx = 250.0,
                              std::optional<double> z = std::nullopt);
  std::vector<Entity*> verti_3(const std::u16string& oid, std::optional<double> x = std::nullopt,
                               double z = 200.0);

 private:
  double _key = 0.0;
  ActionDirector _director;
};

}
}
