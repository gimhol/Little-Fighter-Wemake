#pragma once

#include <functional>
#include <memory>
#include <optional>
#include <string>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/defines/i_vector3.h"
#include "lfw/ui/style.h"
#include "lfw/ui/ui_event.h"
#include "lfw/utils/times.h"

namespace lfw {

class LFW;

namespace ui {

class UIComponent;
class UILayer;
class UINode;

// TS `IUICallback`（`Callbacks<IUICallback>` 的具名方法端口化成一份可选字段表）。
struct UINodeCallbacks {
  std::function<void(LFWPointerEvent&)> on_click;
  std::function<void(UINode&)> on_show;
  std::function<void(UINode&)> on_hide;
  std::function<void(UINode&)> on_foucs_changed;
  std::function<void(UINode*, UINode*)> on_foucs_item_changed;
  std::function<void(LFWPointerEvent&, UINode&)> on_pointer_down;
  std::function<void(LFWPointerEvent&, UINode&)> on_pointer_move;
  std::function<void(LFWPointerEvent&, UINode&)> on_pointer_up;
  std::function<void(LFWPointerEvent&, UINode&)> on_pointer_cancel;
  std::function<void(UINode&)> on_pointer_leave;
  std::function<void(UINode&)> on_pointer_enter;
  // `on_component_add` / `on_component_del` 随 UIComponent 刀补。
};

// TS `ui/UINode.ts`。**第一段**（4AN）：几何 / 状态 / 树 / 焦点 / 指针状态。
//
// 本刀不建形（后续刀补）：`text`/`image`/`set_text`/`auto_size_by_text`（要 TextInfo/ImageInfo）、
// `renderer` 缝、`components` 行为（find/search/lookup_component、add/del_components、
// on_start/stop/resume/pause）、`on_click`/`on_key_*`（要 actor/actions）、`pop_page`/`layer`
// 行为（要 UILayer）、`static create`（要 factory）。
class UINode {
 public:
  static constexpr const char* TAG = "UINode";

  UINode(LFW& lfw, const Value& data, UINode* parent = nullptr, UILayer* layer = nullptr);

  LFW& lfw() { return *_lfw; }
  const Value& data() const { return _data; }
  const Value& raw() const { return _raw; }

  UINodeCallbacks callbacks;

  // `readonly pos/scale/size/center`（TS 的 `new D.Vector3()` 默认 0；`scale` 默认 (1,1,1)）。
  Vector3 pos;
  Vector3 scale{1, 1, 1};
  Vector3 size;
  Vector3 center;

  std::u16string color;  // `color: string = ''`
  Style style;

  // ---- 几何 ----
  double w() const { return size.x; }
  double h() const { return size.y; }
  UINode& set_w(double v);
  UINode& set_h(double v);
  UINode& resize(std::optional<double> x = {}, std::optional<double> y = {},
                 std::optional<double> z = {});
  UINode& set_x(double v);
  UINode& set_y(double v);
  UINode& set_z(double v);
  UINode& move_to(std::optional<double> x = {}, std::optional<double> y = {},
                  std::optional<double> z = {});
  UINode& set_cx(double v);
  UINode& set_cy(double v);
  UINode& set_cz(double v);
  UINode& set_center(std::optional<double> x = {}, std::optional<double> y = {},
                     std::optional<double> z = {});
  UINode& set_sx(double v);
  UINode& set_sy(double v);
  UINode& set_sz(double v);
  UINode& set_scale(std::optional<double> x = {}, std::optional<double> y = {},
                    std::optional<double> z = {});
  double x() const { return pos.x; }
  double y() const { return pos.y; }
  double z() const { return pos.z; }
  double cx() const { return center.x; }
  double cy() const { return center.y; }
  double cz() const { return center.z; }
  double sx() const { return scale.x; }
  double sy() const { return scale.y; }
  double sz() const { return scale.z; }

  // `get global_pos` / `set global_pos`（缓存对象可观测：父节点移动**不清**子节点缓存）。
  const Vector3& global_pos() const;
  void set_global_pos(double x, double y, double z);
  UINode& move_to_global(double x, double y, double z);

  struct Cross {
    double left = 0;
    double top = 0;
    double right = 0;
    double bottom = 0;
    double mid_x = 0;
    double mid_y = 0;
  };
  struct Rect {
    double left = 0;
    double top = 0;
    double right = 0;
    double bottom = 0;
  };
  struct Geo {
    double pos_x = 0;
    double pos_y = 0;
    double left = 0;
    double top = 0;
    double right = 0;
    double bottom = 0;
  };
  const Cross& cross() const;
  const Rect& rect() const;
  const Geo& geo() const;

  bool hit(double x, double y) const;

  // ---- 状态 ----
  bool focused() const { return root()._focused_node == this; }
  void set_focused(bool v);
  UINode* focused_node() const { return root()._focused_node; }
  void set_focused_node(UINode* val);
  void blur() { set_focused(false); }

  Value id() const;
  Value name() const;
  UINode& root() const { return *_root; }
  UILayer* layer() const { return _root->_layer; }
  double depth() const { return _parent != nullptr ? _parent->depth() + 1 : 0; }
  const Value& state() const { return _state; }

  bool self_visible() const { return _visible; }
  bool clip_children() const { return _clip_children; }
  void set_clip_children(bool v) { _clip_children = v; }
  bool visible() const;
  UINode& set_visible(bool v);
  std::u16string background() const;
  void set_background(std::optional<std::u16string> v) { _background = std::move(v); }
  std::u16string foreground() const;
  void set_foreground(std::optional<std::u16string> v) { _foreground = std::move(v); }
  double backgroundAlpha() const;
  void set_background_alpha(std::optional<double> v) { _backgroundAlpha = v; }
  double foregroundAlpha() const;
  void set_foreground_alpha(std::optional<double> v) { _foregroundAlpha = v; }
  const Value& outlineColor() const { return _outlineColor; }
  const Value& outlineWidth() const { return _outlineWidth; }
  const Value& outlineAlpha() const { return _outlineAlpha; }
  void set_outline_color(Value v) { _outlineColor = std::move(v); }
  void set_outline_width(Value v) { _outlineWidth = std::move(v); }
  void set_outline_alpha(Value v) { _outlineAlpha = std::move(v); }
  bool disabled() const;
  bool self_disabled() const { return _disabled; }
  double global_opacity() const;
  double opacity() const;
  UINode& set_opacity(double v);

  UINode* parent() const { return _parent; }
  const std::vector<UINode*>& children() const { return _children; }
  UINode& add_child(UINode& node);
  UINode& add_children(const std::vector<UINode*>& nodes);

  // ---- 树查询 ----
  UINode* find_child(const std::u16string& id);
  UINode* find_child_by_name(const std::u16string& name);
  UINode* search_node(const std::u16string& id);
  UINode* lookup_node(const std::u16string& id);
  UINode* find_parent_by_id(const std::u16string& id);
  UINode* find_parent(const std::function<bool(UINode&)>& match,
                      const std::function<void(UINode&, const std::vector<UINode*>&)>& handler = {});
  Value get_value(const std::u16string& name, bool lookup = true) const;

  // ---- 指针/焦点回调 ----
  int pointer_over() const { return _pointer_over; }
  int pointer_down() const { return _pointer_down; }
  int click_flag() const { return _click_flag; }
  double lifetime() const { return _update_times.value(); }
  void on_pointer_down(LFWPointerEvent& e);
  void on_pointer_move(LFWPointerEvent& e);
  void on_pointer_up(LFWPointerEvent& e);
  void on_pointer_cancel(LFWPointerEvent& e);
  void on_pointer_leave();
  void on_pointer_enter();
  void on_show();
  void on_hide();
  void on_foucs();
  void on_blur();
  void invoke_all_on_show();
  void invoke_all_on_hide();
  void invoke_all_visible();

  void update(double dt);

  // `set_disabled`（TS 返回 this）。
  UINode& set_disabled(bool v);

 private:
  void clear_caches();
  void set3(Vector3& v, const Value& arr);

  LFW* _lfw = nullptr;
  Value _data;
  Value _raw;
  UINode* _root = nullptr;
  UILayer* _layer = nullptr;
  UINode* _focused_node = nullptr;

  bool _visible = true;
  bool _disabled = false;
  bool _clip_children = false;
  Value _opacity = Value(1.0);
  Value _state = Value(std::make_shared<Object>());

  UINode* _parent = nullptr;
  std::vector<UINode*> _children;
  Vector3 _prev_size;
  Vector3 _prev_center;
  Vector3 _prev_pos;

  mutable std::optional<Cross> _cache_cross;
  mutable std::optional<Rect> _cache_rect;
  mutable std::optional<Geo> _cache_geo;
  mutable std::optional<Vector3> _cache_global_pos;

  std::optional<std::u16string> _background;
  std::optional<double> _backgroundAlpha;
  std::optional<std::u16string> _foreground;
  std::optional<double> _foregroundAlpha;
  Value _outlineColor;
  Value _outlineWidth;
  Value _outlineAlpha;

  int _pointer_over = 0;
  int _pointer_down = 0;
  int _click_flag = 0;
  Times _update_times;
};

}
}
