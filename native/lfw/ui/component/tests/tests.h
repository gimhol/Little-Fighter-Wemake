#pragma once

#include <memory>
#include <string>
#include <vector>

#include "lfw/base/fsm.h"
#include "lfw/ui/component/ui_component.h"

namespace lfw {

class Entity;

namespace ui {

class TestCase;

// TS `ui/component/Tests/Tests.ts`：测试模式那一页（`test_cases_page.ui.json5` 的 `component: ["Tests"]`）。
// 用 `CASE_GROUPS` 把全部用例建成一个 FSM（每个用例就是一个 `IState`），左右切用例、上下切组、
// `Attack` 重放当前用例；页面上那行 `Case: …` 是 `on_state_changed` 里写的。
//
// ⚠ 与 TS 一样的"重建"语义：`on_start` 每次都重新 `new` 一遍用例（key 从 0 重数 ⇒ `FSM::add` 按 key
// 覆盖），旧的用例**不立刻释放**（TS 靠 GC；端口把每一轮都留在 `_retired` 里）—— `FSM` 的
// `_prev_state` 还指着上一轮那个对象，提前析构会在下一次切状态时读到悬垂指针。
class Tests : public UIComponent {
 public:
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();

  using UIComponent::UIComponent;

  // 要在 .cpp 里定义：`_owned` 装的是**不完整类型**的 `unique_ptr`（`TestCase` 只在这里前置声明）。
  ~Tests() override;

  const ClazzTag* clazz() const override { return class_tag(); }
  FSM* fsm() override { return &_fsm; }

  void init() override;
  void on_start() override;
  void on_stop() override;
  void on_key_down(LFWKeyEvent& e) override;
  void update(double dt) override;

  std::vector<std::vector<TestCase*>> groups;

 private:
  FSM _fsm;
  // 本轮活着的用例（`_owned`）与历轮的（`_retired`，见类头注释）。⚠ 故意用裸指针 + `~Tests()`
  // 里统一 delete：`using UIComponent::UIComponent` 的继承构造机会实例化本类的析构，而
  // `unique_ptr<TestCase>` 要求 `TestCase` 在本头文件里**完整**（类头只前置声明了它）。
  std::vector<TestCase*> _owned;
  std::vector<TestCase*> _retired;
};

}
}
