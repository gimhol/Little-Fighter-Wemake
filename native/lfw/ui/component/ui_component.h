#pragma once

#include <functional>
#include <map>
#include <optional>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/defines/i_vector3.h"
#include "lfw/ui/component/ui_props.h"
#include "lfw/ui/ui_event.h"
#include "lfw/utils/is_class.h"

namespace lfw {

class Keys;
class LFW;
class World;

namespace ui {

class UINode;

// TS `IUICompnentCallbacks`（空接口）。
struct UIComponentCallbacks {};

// TS `ui/component/UIComponent.ts` 的基类。
//
// 与 TS 的形状差异：
//   * JS 的 `props` getter 在失败时抛 `[UIComponent.props] failed`；端口不抛 ⇒ `ensure_props()`
//     返回 bool，失败后 `props()` 为 nullptr、`props_errors()` 给出错误表（同 TS 的 `e.errors`）。
//   * `find_node` 的 `Number(...)` 口径按整数实现（用例只走整数距离）。
//   * `debug/warn/log` 与 `make_debugging` 是空转（TS 也只有写日志时才有可见差异）。
class UIComponent {
 public:
  static constexpr const char* TAG = "UIComponent";
  static const ClazzTag* class_tag();
  static const std::vector<std::u16string>& TAGS();
  static const Value& PROPS();

  UIComponent(UINode& layout, const std::u16string& f_name, const Value& info);
  virtual ~UIComponent() = default;

  // 实例的类标签（子类覆写；对应 TS 的 `this.constructor`）。
  virtual const ClazzTag* clazz() const { return class_tag(); }

  UINode& node;
  std::u16string f_name;
  Value info;
  UIComponentCallbacks callbacks;
  UIProps props_holder;

  bool stopped = true;
  bool paused = true;
  bool mounted = false;
  std::u16string id;
  std::u16string name;

  bool ensure_props();
  const Value* props();
  bool props_failed() const { return _props_error; }
  const std::vector<std::u16string>& props_errors() const { return props_holder.errors(); }
  // TS `validate(this.constructor)` 拿子类的 `TAG` / `PROPS`；端口用可覆写虚函数表达。
  virtual const std::u16string& props_tag() const;
  virtual const Value& props_meta() const;

  bool enabled() const { return _enabled; }
  void set_enabled(bool v) { _enabled = v; }
  bool disabled() const { return !_enabled; }
  double LR() const;
  double UD() const;
  std::u16string node_name() const;
  LFW& lfw();
  World& world();
  Keys& keys() const;
  void recycle_keys();

  // `@deprecated` 的 args 访问器（同 TS）。
  std::optional<double> num(size_t idx);
  std::optional<std::u16string> str(size_t idx);
  bool bool_(size_t idx);
  std::optional<std::vector<double>> nums(size_t idx, size_t length);
  std::optional<Vector3> vec3(size_t idx);

  // `find_node`：字符串迷你语言（`parent:N` / `parent` / `self` / `bro:…` / `id:…` / `name:…`）。
  UINode* find_node(const Value& which);

  // 生命周期 / 输入钩子（TS 的可选方法；端口统一成可覆写的虚函数）。
  virtual void init() {}
  virtual void on_add() {}
  virtual void on_del() {}
  virtual void on_start() {}
  virtual void on_stop() {}
  virtual void on_resume() {}
  virtual void on_pause() {}
  virtual void on_show() {}
  virtual void on_hide() {}
  virtual void on_foucs() {}
  virtual void on_blur() {}
  virtual void update(double dt) { (void)dt; }
  virtual void on_click(LFWPointerEvent& e) { (void)e; }
  virtual void on_pointer_down(LFWPointerEvent& e) { (void)e; }
  virtual void on_pointer_move(LFWPointerEvent& e) { (void)e; }
  virtual void on_pointer_up(LFWPointerEvent& e) { (void)e; }
  virtual void on_pointer_cancel(LFWPointerEvent& e) { (void)e; }
  virtual void on_pointer_leave() {}
  virtual void on_pointer_enter() {}
  virtual void on_key_down(LFWKeyEvent& e) { (void)e; }
  virtual void on_key_up(LFWKeyEvent& e) { (void)e; }

  bool __debugging = false;
  template <typename... A>
  void debug(A&&...) {}
  template <typename... A>
  void warn(A&&...) {}
  template <typename... A>
  void log(A&&...) {}

 private:
  struct NumsCache {
    bool set = false;
    bool failed = false;
    std::vector<double> nums;
  };
  struct Vec3Cache {
    bool set = false;
    bool failed = false;
    Vector3 v;
  };

  bool _enabled = true;
  bool _props_error = false;
  Value _props;
  mutable Keys* _keys = nullptr;
  std::map<std::u16string, NumsCache> _nums_caches;
  std::map<std::u16string, Vec3Cache> _vec3_caches;
};

}
}
