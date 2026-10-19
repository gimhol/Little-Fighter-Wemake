#include "lfw/cmds/cmd_pointer_events.h"

#include <cmath>
#include <cstddef>
#include <limits>
#include <optional>
#include <string>
#include <unordered_map>
#include <utility>
#include <vector>

#include "lfw/base/clock.h"
#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/defines/cmd.h"
#include "lfw/defines/i_vector3.h"
#include "lfw/lfw.h"
#include "lfw/ui/ui_event.h"
#include "lfw/ui/uilayer.h"
#include "lfw/ui/uinode.h"
#include "lfw/world.h"

namespace lfw {
namespace cmds {

namespace {

// TS 的 `Set<UINode>`：迭代次序 = 插入次序（`POINTER_MOVE` 的 leave 派发次序、
// `POINTER_CANCEL` 的取消次序都可观测）⇒ 数组 + 线性查重，不能用 `std::set`（指针序
// 不确定）。
//
// 偏差：TS 的 `for (const ui of set)` 是**活迭代**（回调里改动集合会被看到）；端口对
// 快照迭代（`items()` 返回的向量）。要看穿它需要在回调里重入命令，实际不可达。
class UiSet {
 public:
  void add(ui::UINode* ui) {
    if (!has(ui)) _items.push_back(ui);
  }
  bool has(ui::UINode* ui) const {
    for (ui::UINode* item : _items) {
      if (item == ui) return true;
    }
    return false;
  }
  void del(ui::UINode* ui) {
    for (size_t i = 0; i < _items.size(); ++i) {
      if (_items[i] == ui) {
        _items.erase(_items.begin() + static_cast<std::ptrdiff_t>(i));
        return;
      }
    }
  }
  void clear() { _items.clear(); }
  const std::vector<ui::UINode*>& items() const { return _items; }
  // 把**已经销毁**的节点从这个集合里剔掉，回剩下的（顺序不变）。
  // TS 的 `Set<UINode>` 引用着那些对象 ⇒ 页面销毁后对它们派发 `leave` 无害（孤儿对象设个标志）；
  // 端口这边那些节点已经 `delete` 了，再去读就是悬垂指针（实测：点一下换页的那个按钮、再动一下
  // 鼠标就 signal 11）⇒ 派发前先筛。
  std::vector<ui::UINode*> live_items() {
    std::vector<ui::UINode*> out;
    out.reserve(_items.size());
    for (ui::UINode* const ui : _items) {
      if (is_live_uinode(ui)) out.push_back(ui);
    }
    _items = out;
    return out;
  }

 private:
  std::vector<ui::UINode*> _items;
};

struct IPointerState {
  UiSet down_uis;
  UiSet on_uis;
  std::unordered_map<std::u16string, IPointerCursor> cursors;
};

struct IPointerTargets {
  std::vector<std::vector<double>> paths;
  std::vector<std::u16string> pages;
  std::vector<std::vector<double>> points;
};

// TS `const _pointer_states = new WeakMap<World, IPointerState>()`。端口用普通表：`World`
// 是长命对象、永不回收 ⇒ 表项也不回收（偏差见 DESIGN）。
std::unordered_map<const World*, IPointerState>& pointer_states() {
  static std::unordered_map<const World*, IPointerState> states;
  return states;
}

IPointerState& state_of(World& world) { return pointer_states()[&world]; }

IPointerState& pointer_state(CMDS& c) { return state_of(c.world()); }

IPointerCursor& cursor_for(IPointerState& state, const std::u16string& from) {
  IPointerCursor& cursor = state.cursors[from];
  return cursor;
}

// `String.split(sep)`（只按调用者保证的**非空**字符串调用：TS 那边 `s ? s.split(...) : []`）。
std::vector<std::u16string> split_char(const std::u16string& s, char16_t sep) {
  std::vector<std::u16string> out;
  std::u16string cur;
  for (char16_t c : s) {
    if (c == sep) {
      out.push_back(cur);
      cur.clear();
    } else {
      cur.push_back(c);
    }
  }
  out.push_back(cur);
  return out;
}

// `raw.split(',').map(Number)`：保留空段（`"1,,2"` → `[1, 0, 2]`，`Number('')` 是 0）。
std::vector<double> nums_of(const std::u16string& raw) {
  std::vector<double> out;
  for (const std::u16string& part : split_char(raw, u',')) out.push_back(string_to_number(part));
  return out;
}

// `Number.isInteger(v)`（`NaN`/`±Infinity` 都不是整数，`-0` 是）。
bool is_js_integer(double v) { return std::isfinite(v) && std::floor(v) == v; }

// `point.some(v => !Number.isFinite(v))` 的反面。
bool all_finite(const std::vector<double>& nums) {
  for (double v : nums) {
    if (!std::isfinite(v)) return false;
  }
  return true;
}

void warn_of(CMDS& c, const std::u16string& text) { c.world().lfw().warn(text); }

IPointerCursor* move_cursor(CMDS& c, std::optional<bool> hidden,
                            std::optional<bool> down = std::nullopt) {
  const std::optional<std::u16string> from = c.str_arg(u"--from");
  if (!from || from->empty()) return nullptr;
  IPointerCursor& cursor = cursor_for(pointer_state(c), *from);
  const std::optional<std::vector<double>> pos = c.nums_arg(u"--pos");
  if (pos && pos->size() > 1 && std::isfinite((*pos)[0]) && std::isfinite((*pos)[1])) {
    cursor.x = (*pos)[0];
    cursor.y = (*pos)[1];
  }
  if (hidden.has_value()) cursor.hidden = *hidden;
  if (down.has_value()) cursor.down = *down;
  cursor.t = clock_now();
  return &cursor;
}

std::optional<IPointerTargets> read_targets(const std::u16string& tag, CMDS& c, bool need_points) {
  const std::u16string paths_raw = c.str_arg(u"--paths").value_or(std::u16string());
  const std::u16string pages_raw = c.str_arg(u"--pages").value_or(std::u16string());
  const std::u16string points_raw = c.str_arg(u"--points").value_or(std::u16string());
  const std::vector<std::u16string> path_parts =
      paths_raw.empty() ? std::vector<std::u16string>() : split_char(paths_raw, u'|');
  const std::vector<std::u16string> page_parts =
      pages_raw.empty() ? std::vector<std::u16string>() : split_char(pages_raw, u'|');
  const std::vector<std::u16string> point_parts =
      points_raw.empty() ? std::vector<std::u16string>() : split_char(points_raw, u'|');
  if (path_parts.size() != page_parts.size()) {
    warn_of(c, u"[" + tag + u"] failed, '--paths' and '--pages' count mismatch, got: " + c.cmd());
    return std::nullopt;
  }
  if (point_parts.size() != path_parts.size() && (need_points || !point_parts.empty())) {
    warn_of(c, u"[" + tag + u"] failed, '--points' count mismatch, got: " + c.cmd());
    return std::nullopt;
  }
  IPointerTargets targets;
  for (size_t i = 0; i < path_parts.size(); ++i) {
    const std::vector<double> path = nums_of(path_parts[i]);
    const std::u16string& page = page_parts[i];
    const std::u16string* point_raw = i < point_parts.size() ? &point_parts[i] : nullptr;
    const bool has_point = point_raw != nullptr && !point_raw->empty();
    const std::vector<double> point = has_point ? nums_of(*point_raw) : std::vector<double>();
    bool path_ok = path.size() >= 2;
    for (size_t k = 0; path_ok && k < path.size(); ++k) {
      if (!is_js_integer(path[k]) || path[k] < 0) path_ok = false;
    }
    if (!path_ok) {
      warn_of(c, u"[" + tag + u"] failed, invalid path: '" + path_parts[i] + u"', got: " + c.cmd());
      return std::nullopt;
    }
    if (page.empty()) {
      warn_of(c, u"[" + tag + u"] failed, invalid page id: '" + page_parts[i] + u"', got: " +
                     c.cmd());
      return std::nullopt;
    }
    if (has_point && (point.size() != 3 || !all_finite(point))) {
      warn_of(c, u"[" + tag + u"] failed, invalid point: '" + *point_raw + u"', got: " + c.cmd());
      return std::nullopt;
    }
    if (!targets.paths.empty()) {
      const std::vector<double>& first = targets.paths[0];
      if (path[0] != first[0] || path[1] != first[1] || page != targets.pages[0]) {
        warn_of(c, u"[" + tag + u"] failed, entries must target the same page, got: " + c.cmd());
        return std::nullopt;
      }
    }
    targets.paths.push_back(path);
    targets.pages.push_back(page);
    if (has_point) targets.points.push_back(point);
  }
  return targets;
}

std::optional<double> read_button(const std::u16string& tag, CMDS& c) {
  const std::optional<double> b = c.num_arg(u"--b");
  if (!b || !std::isfinite(*b)) {
    warn_of(c, u"[" + tag + u"] failed, invalid '--b', got: " + c.cmd());
    return std::nullopt;
  }
  return b;
}

ui::UINode* read_page(const std::u16string& tag, CMDS& c, double layer_idx, double page_idx,
                      const std::u16string& page_id) {
  ui::UILayers* layers = c.world().lfw().ui_layers();
  ui::UILayer* layer = layers != nullptr ? layers->at(layer_idx) : nullptr;
  if (layer == nullptr) {
    warn_of(c, u"[" + tag + u"] layer not found: " + to_string(Value(layer_idx)));
    return nullptr;
  }
  ui::UINode* page = layer->at(page_idx);
  if (page == nullptr) {
    warn_of(c, u"[" + tag + u"] page not found: " + to_string(Value(page_idx)) + u", expected '" +
                   page_id + u"'");
    return nullptr;
  }
  if (!strict_equals(page->id(), Value(page_id))) {
    warn_of(c, u"[" + tag + u"] page changed, index " + to_string(Value(page_idx)) + u" is '" +
                   to_string(page->id()) + u"', expected '" + page_id + u"'");
    return nullptr;
  }
  return page;
}

ui::UINode* read_child(const std::u16string& tag, CMDS& c, ui::UINode* page,
                       const std::vector<double>& path) {
  ui::UINode* node = page;
  for (size_t i = 2; i < path.size(); ++i) {
    if (node == nullptr) break;
    const std::vector<ui::UINode*>& children = node->children();
    const size_t idx = static_cast<size_t>(path[i]);
    node = idx < children.size() ? children[idx] : nullptr;
  }
  if (node == nullptr) {
    std::u16string joined;
    for (size_t i = 0; i < path.size(); ++i) {
      if (i > 0) joined += u",";
      joined += to_string(Value(path[i]));
    }
    warn_of(c, u"[" + tag + u"] node not found, path: " + joined);
  }
  return node;
}

// TS `ui.pointer_down` / `ui.click_flag` 是布尔 getter（`if (!ui.pointer_down) continue`）。
bool truthy_count(int n) { return n != 0; }

// `paths[i][j]`：算得出来就取，算不出来（TS 里 `points` 短了、`points[i]` 是 `undefined`）
// 给 TS 的 `undefined` —— 调用点只在 `read_targets(..., true)` 之后用，那时长度必然对齐。
std::vector<double> point_at(const IPointerTargets& targets, size_t i) {
  return i < targets.points.size() ? targets.points[i] : std::vector<double>();
}

ui::LFWPointerEvent make_event(const IPointerTargets& targets, size_t i, double b) {
  const std::vector<double> p = point_at(targets, i);
  const double x = p.size() > 0 ? p[0] : std::numeric_limits<double>::quiet_NaN();
  const double y = p.size() > 1 ? p[1] : std::numeric_limits<double>::quiet_NaN();
  const double z = p.size() > 2 ? p[2] : std::numeric_limits<double>::quiet_NaN();
  return ui::LFWPointerEvent(Vector3(x, y, z), b);
}

ui::LFWPointerEvent make_nan_event(double b) {
  const double nan = std::numeric_limits<double>::quiet_NaN();
  return ui::LFWPointerEvent(Vector3(nan, nan, nan), b);
}

}

const char16_t* cmd_pointer_down_help() {
  return uR"(Usage: POINTER_DOWN --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay a pointer-down hit list on the local UI, near to far / 按近到远在本地 UI 上重放一次指针按下命中列表

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同；用于校验下标处页面未变 / page id, same for every entry, checked against the page at that index
  --points  每项命中点 x,y,z，与 --paths 一一对应 / hit point of each entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

const char16_t* cmd_pointer_move_help() {
  return uR"(Usage: POINTER_MOVE --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay a pointer-move on the local UI, enter/leave are derived by diff; omit '--paths' / '--pages' for no hits / 在本地 UI 上重放一次指针移动，enter/leave 由差异推导；省略 '--paths'/'--pages' 表示无命中（全体 leave）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --points  每项命中点 x,y,z，与 --paths 一一对应 / hit point of each entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

const char16_t* cmd_pointer_up_help() {
  return uR"(Usage: POINTER_UP --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay a pointer-up on the local UI, then click and cancel leftovers; omit '--paths' / '--pages' for no hits / 重放指针抬起，随后派发 click 并取消未收到 up 的按下节点；省略 '--paths'/'--pages' 表示无命中（取消全部按下）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --points  每项命中点 x,y,z，与 --paths 一一对应 / hit point of each entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

const char16_t* cmd_pointer_click_help() {
  return uR"(Usage: POINTER_CLICK --paths=<layer>,<index>,<child>,... --pages=<page_id> --points=<x,y,z> --b=<button>

Replay one atomic click on the local UI, dispatch 'on_click' only, near to far / 在本地 UI 上重放一次原子点击，只派发 on_click（近到远）

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --points  每项命中点 x,y,z，与 --paths 一一对应 / hit point of each entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --b       0 left / 1 middle / 2 right
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

const char16_t* cmd_pointer_cancel_help() {
  return uR"(Usage: POINTER_CANCEL --b=<button>

Cancel every node still pressed in the local UI / 取消本地 UI 中所有仍处于按下状态的节点

Options:
  --b       0 left / 1 middle / 2 right
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

const char16_t* cmd_pointer_enter_help() {
  return uR"(Usage: POINTER_ENTER --paths=<layer>,<index>,<child>,... --pages=<page_id>

Dispatch pointer-enter on the local UI / 在本地 UI 上派发指针进入

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

const char16_t* cmd_pointer_leave_help() {
  return uR"(Usage: POINTER_LEAVE --paths=<layer>,<index>,<child>,... --pages=<page_id>

Dispatch pointer-leave on the local UI; omit '--paths' / '--pages' when the pointer leaves the surface, leaving every hovered node and marking the initiator's cursor hidden / 在本地 UI 上派发指针离开；省略 '--paths'/'--pages' 表示指针离开画面：所有悬停节点 leave，并标记该发起方光标隐藏

Options:
  --paths   <layer>,<页面栈下标>,<子节点索引>...，多项以 | 分隔 / node paths, '|' separated
  --pages   页面 id，各项须相同 / page id, same for every entry
  --pos     指针位置 x,y（UI 坐标，无命中时也存在） / pointer position x,y (UI coordinates, present even without hits)
  --from    发起方 client id，联机时由网络层附加，本地省略 / initiator client id, attached by the net layer for netplay, omitted locally)";
}

std::unordered_map<std::u16string, IPointerCursor>* get_pointer_cursors(World& world) {
  std::unordered_map<const World*, IPointerState>& states = pointer_states();
  const std::unordered_map<const World*, IPointerState>::iterator it = states.find(&world);
  return it == states.end() ? nullptr : &it->second.cursors;
}

void set_local_cursor(World& world, double x, double y, std::optional<bool> hidden,
                      std::optional<bool> down) {
  IPointerCursor& cursor = cursor_for(state_of(world), u"");
  cursor.x = x;
  cursor.y = y;
  if (hidden.has_value()) cursor.hidden = *hidden;
  if (down.has_value()) cursor.down = *down;
  cursor.t = clock_now();
}

void cmd_pointer_down(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_DOWN;
  const std::optional<IPointerTargets> targets = read_targets(tag, c, true);
  if (!targets) return;
  const std::optional<double> b = read_button(tag, c);
  if (!b) return;
  move_cursor(c, false, true);
  IPointerState& state = pointer_state(c);
  if (targets->paths.empty()) return;
  ui::UINode* page = read_page(tag, c, targets->paths[0][0], targets->paths[0][1],
                               targets->pages[0]);
  if (page == nullptr) return;
  for (size_t i = 0; i < targets->paths.size(); ++i) {
    ui::UINode* ui = read_child(tag, c, page, targets->paths[i]);
    if (ui == nullptr || !ui->visible() || ui->disabled()) continue;
    state.down_uis.add(ui);
    ui::LFWPointerEvent event = make_event(*targets, i, *b);
    ui->on_pointer_down(event);
    if (event.stopped()) break;
  }
}

void cmd_pointer_move(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_MOVE;
  const std::optional<IPointerTargets> targets = read_targets(tag, c, true);
  if (!targets) return;
  const std::optional<double> b = read_button(tag, c);
  if (!b) return;
  move_cursor(c, false);
  IPointerState& state = pointer_state(c);
  UiSet enter_uis;
  UiSet stay_uis;
  if (!targets->paths.empty()) {
    ui::UINode* page = read_page(tag, c, targets->paths[0][0], targets->paths[0][1],
                                 targets->pages[0]);
    if (page != nullptr) {
      for (size_t i = 0; i < targets->paths.size(); ++i) {
        ui::UINode* ui = read_child(tag, c, page, targets->paths[i]);
        if (ui == nullptr || !ui->visible() || ui->disabled()) continue;
        ui::LFWPointerEvent event = make_event(*targets, i, *b);
        ui->on_pointer_move(event);
        if (state.on_uis.has(ui)) {
          state.on_uis.del(ui);
          stay_uis.add(ui);
        } else {
          enter_uis.add(ui);
        }
      }
    }
  }
  for (ui::UINode* ui : state.on_uis.live_items()) ui->on_pointer_leave();
  state.on_uis.clear();
  for (ui::UINode* ui : enter_uis.items()) {
    ui->on_pointer_enter();
    state.on_uis.add(ui);
  }
  for (ui::UINode* ui : stay_uis.items()) state.on_uis.add(ui);
}

void cmd_pointer_up(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_UP;
  const std::optional<IPointerTargets> targets = read_targets(tag, c, true);
  if (!targets) return;
  const std::optional<double> b = read_button(tag, c);
  if (!b) return;
  move_cursor(c, false, false);
  IPointerState& state = pointer_state(c);
  if (!targets->paths.empty()) {
    ui::UINode* page = read_page(tag, c, targets->paths[0][0], targets->paths[0][1],
                                 targets->pages[0]);
    if (page != nullptr) {
      std::vector<ui::UINode*> uis;
      std::vector<size_t> pts;
      for (size_t i = 0; i < targets->paths.size(); ++i) {
        ui::UINode* ui = read_child(tag, c, page, targets->paths[i]);
        if (ui == nullptr || !ui->visible() || ui->disabled()) continue;
        uis.push_back(ui);
        pts.push_back(i);
      }
      for (size_t i = 0; i < uis.size(); ++i) {
        ui::UINode* ui = uis[i];
        if (!truthy_count(ui->pointer_down())) continue;
        state.down_uis.del(ui);
        ui::LFWPointerEvent event = make_event(*targets, pts[i], *b);
        ui->on_pointer_up(event);
        if (event.stopped()) break;
      }
      for (size_t i = 0; i < uis.size(); ++i) {
        ui::UINode* ui = uis[i];
        if (!truthy_count(ui->click_flag())) continue;
        ui::LFWPointerEvent event = make_event(*targets, pts[i], *b);
        ui->on_click(event);
        if (event.stopped()) break;
      }
    }
  }
  for (ui::UINode* ui : state.down_uis.live_items()) {
    ui::LFWPointerEvent event = make_nan_event(*b);
    ui->on_pointer_cancel(event);
  }
  state.down_uis.clear();
}

void cmd_pointer_click(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_CLICK;
  const std::optional<IPointerTargets> targets = read_targets(tag, c, true);
  if (!targets) return;
  const std::optional<double> b = read_button(tag, c);
  if (!b) return;
  if (targets->paths.empty()) return;
  ui::UINode* page = read_page(tag, c, targets->paths[0][0], targets->paths[0][1],
                               targets->pages[0]);
  if (page == nullptr) return;
  for (size_t i = 0; i < targets->paths.size(); ++i) {
    ui::UINode* ui = read_child(tag, c, page, targets->paths[i]);
    if (ui == nullptr || !ui->visible() || ui->disabled()) continue;
    ui::LFWPointerEvent event = make_event(*targets, i, *b);
    ui->on_click(event);
    if (event.stopped()) break;
  }
}

void cmd_pointer_cancel(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_CANCEL;
  const std::optional<double> b = read_button(tag, c);
  if (!b) return;
  move_cursor(c, std::nullopt, false);
  IPointerState& state = pointer_state(c);
  for (ui::UINode* ui : state.down_uis.live_items()) {
    ui::LFWPointerEvent event = make_nan_event(*b);
    ui->on_pointer_cancel(event);
  }
  state.down_uis.clear();
}

void cmd_pointer_enter(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_ENTER;
  const std::optional<IPointerTargets> targets = read_targets(tag, c, false);
  if (!targets) return;
  move_cursor(c, false);
  IPointerState& state = pointer_state(c);
  if (targets->paths.empty()) return;
  ui::UINode* page = read_page(tag, c, targets->paths[0][0], targets->paths[0][1],
                               targets->pages[0]);
  if (page == nullptr) return;
  for (size_t i = 0; i < targets->paths.size(); ++i) {
    ui::UINode* ui = read_child(tag, c, page, targets->paths[i]);
    if (ui == nullptr || !ui->visible() || ui->disabled()) continue;
    ui->on_pointer_enter();
    state.on_uis.add(ui);
  }
}

void cmd_pointer_leave(CMDS& c) {
  const std::u16string tag = cmd::kPOINTER_LEAVE;
  const std::optional<IPointerTargets> targets = read_targets(tag, c, false);
  if (!targets) return;
  IPointerState& state = pointer_state(c);
  if (targets->paths.empty()) {
    move_cursor(c, true);
    for (ui::UINode* ui : state.on_uis.live_items()) ui->on_pointer_leave();
    state.on_uis.clear();
    return;
  }
  ui::UINode* page = read_page(tag, c, targets->paths[0][0], targets->paths[0][1],
                               targets->pages[0]);
  if (page == nullptr) return;
  for (size_t i = 0; i < targets->paths.size(); ++i) {
    ui::UINode* ui = read_child(tag, c, page, targets->paths[i]);
    if (ui == nullptr) continue;
    ui->on_pointer_leave();
    state.on_uis.del(ui);
  }
}

}
}
