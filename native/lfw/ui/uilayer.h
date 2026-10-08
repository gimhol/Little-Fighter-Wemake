#pragma once

#include <functional>
#include <memory>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/lfw.h"

namespace lfw {

class IWorldUi;

namespace ui {

class UINode;
class UILayer;

// TS `ui/UILayer.ts` 的 `IUILayersCallback`（`Callbacks<IUILayersCallback>` 端口化成可选字段表）。
struct UILayersCallbacks {
  // `on_set(pushed, popped, layer)`
  std::function<void(UINode*, UINode*, UILayer&)> on_set;
  // `on_push(pushed, prev, layer)`
  std::function<void(UINode*, UINode*, UILayer&)> on_push;
  // `on_pop(curr, poppeds, layer)`
  std::function<void(UINode*, const std::vector<UINode*>&, UILayer&)> on_pop;
};

// TS `IPopPageOpts`。
struct UIPopPageOpts {
  bool inclusive = false;
  // `until(ui, index, pages)`
  std::function<bool(UINode&, double, const std::vector<UINode*>&)> until;
  double min_pages = 0.0;
};

// TS `IPushPageOpts`（`id` 只接受字符串，同 TS 的 `is_str` 判定）。
struct UIPushPageOpts {
  std::u16string id;
  bool has_id = false;
};

// TS `ui/UILayer.ts` 的 `UILayer`。页面由本层持有（TS 靠 GC，端口用 `unique_ptr`）。
class UILayer {
 public:
  UILayer(LFW& lfw, double index);

  LFW& lfw() const { return *_lfw; }
  double index() const { return _index; }
  std::vector<UINode*> pages() const;
  UINode* ui() const;
  UINode* at(double idx) const;

  UILayersCallbacks callbacks;

  void dispose();
  void set(const UIPushPageOpts& opts);
  void push(const UIPushPageOpts& opts);
  void pop(const UIPopPageOpts& opts);

 private:
  std::unique_ptr<UINode> create_page(const UIPushPageOpts& opts);
  LFW* _lfw = nullptr;
  double _index = 0;
  std::vector<std::unique_ptr<UINode>> _pages;
};

// TS `ui/UILayer.ts` 的 `UILayers`（实现 `IUiLayers` 缝：`LFW::layers` 的接线面）。
//
// 偏差：TS 的非整数/负数层号会挂在数组对象属性上（不进 `all`、不计长度）；端口把这些层
// 放进 `_loose`（同样不进 `all`），但 `at()` 只认非负整数下标（与 JS 数组下标一致）。
class UILayers : public IUiLayers {
 public:
  explicit UILayers(LFW& lfw);

  LFW& lfw() const { return *_lfw; }
  UILayer* bottom() const;
  UILayer* top() const;
  // `Array.from(this._all)`：洞（未 ensure 的下标）保留为 nullptr。
  std::vector<UILayer*> all() const;
  UINode* ui_top() const;
  double length() const;
  UILayer& push_layer();
  UILayer& ensure(double index);
  UILayer* at(double index);

  // `IUiLayers`
  void push() override;
  void set_page(const Value& opts, double index) override;
  void push_page(const Value& opts, double index) override;
  void dispose() override;
  UINode* ui() override;
  std::vector<IWorldUi*> layer_uis() override;

 private:
  class UiAdapter;
  static UIPushPageOpts to_opts(const Value& opts);
  LFW* _lfw = nullptr;
  std::vector<std::unique_ptr<UILayer>> _all;
  std::vector<std::unique_ptr<UILayer>> _loose;
  mutable std::vector<std::unique_ptr<UiAdapter>> _adapters;
};

}  // namespace ui
}  // namespace lfw
