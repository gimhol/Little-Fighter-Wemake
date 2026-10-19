#include "host/common/ui_input_handle.h"

#include <algorithm>
#include <cmath>
#include <cstddef>
#include <functional>
#include <optional>
#include <string>
#include <string_view>
#include <utility>
#include <vector>

#include "lfw/camera.h"
#include "lfw/cmds/cmd_pointer_events.h"
#include "lfw/core/js_num.h"
#include "lfw/core/js_string.h"
#include "lfw/core/value.h"
#include "lfw/defines/cmd.h"
#include "lfw/ui/uilayer.h"
#include "lfw/world.h"

namespace lfw::host {

namespace {

// `world.dataset.get(k)`：缺失/NaN 都落回 `fallback`（TS 的 `dataset.screen_w` 缺省值）。
double dataset_num(const World& world, const char16_t* key, double fallback) {
  const Value v = world.dataset.get(key);
  if (std::holds_alternative<std::monostate>(v)) return fallback;
  const double n = to_number(v);
  return std::isnan(n) ? fallback : n;
}

}  // namespace

UiScreenSize ui_screen_size(const World& world) {
  UiScreenSize out;
  out.w = dataset_num(world, u"screen_w", 794.0);
  out.h = dataset_num(world, u"screen_h", 450.0);
  return out;
}

UiPoint ui_point_of_scene(const World& world, double scene_x, double scene_y) {
  const UiScreenSize s = ui_screen_size(world);
  return UiPoint{(scene_x + 1) / 2 * s.w, (1 - scene_y) / 2 * s.h};
}

void ui_scene_of_point(const World& world, double x, double y, double& scene_x, double& scene_y) {
  const UiScreenSize s = ui_screen_size(world);
  scene_x = s.w > 0 ? x / s.w * 2 - 1 : 0;
  scene_y = s.h > 0 ? -(y / s.h) * 2 + 1 : 0;
}

std::u16string ui_node_path(const ui::UINode& node) {
  ui::UILayer* const layer = node.layer();
  if (layer == nullptr) return {};
  const Value page_id = node.root().id();
  const std::u16string* const page_id_s = std::get_if<std::u16string>(&page_id);
  // TS `if (!layer || !page.id) return;`（空串 id 也算没有）。
  if (page_id_s == nullptr || page_id_s->empty()) return {};

  const ui::UINode* const page = &node.root();
  const std::vector<ui::UINode*> pages = layer->pages();
  double page_idx = -1;
  for (size_t i = 0; i < pages.size(); ++i) {
    if (pages[i] == page) {
      page_idx = static_cast<double>(i);
      break;
    }
  }
  if (page_idx < 0) return {};

  // 从节点往上收到页面为止，逐个把「在父节点 children 里的下标」unshift 到前面。
  std::vector<double> idx;
  const ui::UINode* n = &node;
  while (n != nullptr && n != page) {
    ui::UINode* const parent = n->parent();
    if (parent == nullptr) return {};
    const std::vector<ui::UINode*>& children = parent->children();
    double found = -1;
    for (size_t i = 0; i < children.size(); ++i) {
      if (children[i] == n) {
        found = static_cast<double>(i);
        break;
      }
    }
    idx.insert(idx.begin(), found);
    n = parent;
  }

  std::u16string out = number_to_string(layer->index());
  out += u",";
  out += number_to_string(page_idx);
  for (const double v : idx) {
    out += u",";
    out += number_to_string(v);
  }
  return out;
}

void UiInputHandle::set_ui_offset(double x, double y, double z) {
  _offset_x = x;
  _offset_y = y;
  _offset_z = z;
}

void UiInputHandle::on_pointer_down(LfwPointingEvent& e) {
  update_local_cursor(e, false, true);
  push_pointer(cmd::kPOINTER_DOWN, e);
}

void UiInputHandle::on_pointer_move(LfwPointingEvent& e) {
  update_local_cursor(e, false);
  push_pointer(cmd::kPOINTER_MOVE, e);
}

void UiInputHandle::on_pointer_up(LfwPointingEvent& e) {
  update_local_cursor(e, false, false);
  push_pointer(cmd::kPOINTER_UP, e);
}

void UiInputHandle::on_pointer_cancel(LfwPointingEvent& e) {
  update_local_cursor(e, std::nullopt, false);
  _lfw->push_cmd({cmd::kPOINTER_CANCEL, u"--b=" + number_to_string(e.button), pos_arg(e)});
}

void UiInputHandle::on_pointer_enter(LfwPointingEvent& e) {
  _empty_move = false;
  update_local_cursor(e, false);
  push_pointer(cmd::kPOINTER_MOVE, e);
}

void UiInputHandle::on_pointer_leave(LfwPointingEvent& e) {
  if (_lfw->ui_layers() == nullptr || _lfw->ui_layers()->ui() == nullptr) return;
  _empty_move = true;
  update_local_cursor(e, true);
  _lfw->push_cmd({cmd::kPOINTER_LEAVE, pos_arg(e)});
}

std::u16string UiInputHandle::pos_arg(const LfwPointingEvent& e) const {  const UiScreenSize s = ui_screen_size(_lfw->world());
  const double x = js_round((e.scene_x + 1) / 2 * s.w * 10) / 10;
  const double y = js_round((1 - e.scene_y) / 2 * s.h * 10) / 10;
  return u"--pos=" + number_to_string(x) + u"," + number_to_string(y);
}

void UiInputHandle::update_local_cursor(const LfwPointingEvent& e, std::optional<bool> hidden,
                                        std::optional<bool> down) {
  const UiPoint p = ui_point_of_scene(_lfw->world(), e.scene_x, e.scene_y);
  cmds::set_local_cursor(_lfw->world(), p.x, p.y, hidden, down);
}

double UiInputHandle::world_z(const ui::UINode& node) const {
  double z = _offset_z;
  for (const ui::UINode* n = &node; n != nullptr; n = n->parent()) {
    const double pz = n->z();
    z += std::isfinite(pz) ? pz : 0.0;
  }
  return z;
}

std::vector<UiInputHandle::Hit> UiInputHandle::intersections(const LfwPointingEvent& e,
                                                             ui::UINode& page,
                                                             std::vector<std::u16string>* visits) const {
  const UiPoint p = ui_point_of_scene(_lfw->world(), e.scene_x, e.scene_y);
  const Camera& cam = _lfw->world().camera();
  const UiScreenSize s = ui_screen_size(_lfw->world());

  std::vector<Hit> hits;
  double order = 0;
  // 深度优先：先收自己（记下遍历序），再按 children 次序递归。
  const std::function<void(ui::UINode&)> walk = [&](ui::UINode& node) {
    const double my_order = order++;
    if (visits != nullptr) {
      const ui::UINode::Geo& g = node.geo();
      visits->push_back(ui_node_path(node) + u"(" + number_to_string(g.left) + u"," +
                        number_to_string(g.top) + u"," + number_to_string(g.right) + u"," +
                        number_to_string(g.bottom) + u")v" + (node.visible() ? u"1" : u"0") + u"d" +
                        (node.disabled() ? u"1" : u"0"));
    }
    if (node.visible() && !node.disabled()) {
      const ui::UINode::Geo& g = node.geo();
      if (p.x >= g.left && p.x <= g.right && p.y >= g.top && p.y <= g.bottom) {
        // 祖先 `clip_children` 的视口要包含该点（模型是轴对齐的 ⇒ 直接矩形包含）。
        bool inside = true;
        for (ui::UINode* parent = node.parent(); parent != nullptr; parent = parent->parent()) {
          if (!parent->clip_children()) continue;
          const ui::UINode::Geo& pg = parent->geo();
          if (p.x < pg.left || p.x > pg.right || p.y < pg.top || p.y > pg.bottom) {
            inside = false;
            break;
          }
        }
        if (inside) {
          Hit hit;
          hit.node = &node;
          // TS `to_world`：`ui_offset` + 渲染器的相机位置；UI 容器摆在 `cam + (0, screen_h)`，
          // y 反号相抵（`lfw_godot_ui_renderer.cpp` 的 `compute_global`）。
          hit.x = cam.position.x + _offset_x + p.x;
          hit.y = cam.position.y + s.h + _offset_y - p.y;
          hit.z = world_z(node);
          hit.order = my_order;
          hits.push_back(hit);
        }
      }
    }
    for (ui::UINode* const child : node.children()) {
      if (child != nullptr) walk(*child);
    }
  };
  walk(page);

  // 近→远（z 降序）；同 z 保深度优先序（对齐 raycast 的稳定排序）。
  std::stable_sort(hits.begin(), hits.end(), [](const Hit& a, const Hit& b) {
    return a.z != b.z ? a.z > b.z : a.order < b.order;
  });
  return hits;
}

void UiInputHandle::push_empty_move(const LfwPointingEvent& e) {
  if (_empty_move) return;
  _empty_move = true;
  _lfw->push_cmd({cmd::kPOINTER_MOVE, u"--b=" + number_to_string(e.button), pos_arg(e)});
}

void UiInputHandle::push_pointer(const char16_t* command, const LfwPointingEvent& e) {
  ui::UILayers* const layers = _lfw->ui_layers();
  ui::UINode* const page = layers != nullptr ? layers->ui() : nullptr;
  if (page == nullptr) return;  // TS `const { ui } = this.lfw; if (!ui) return;`

  const std::u16string_view name(command);
  std::vector<std::u16string> visits;
  const std::vector<Hit> hits =
      intersections(e, *page, _lfw->dev_mode && name == cmd::kPOINTER_DOWN ? &visits : nullptr);
  std::u16string paths;
  std::u16string pages;
  std::u16string points;
  for (const Hit& hit : hits) {
    const std::u16string path = ui_node_path(*hit.node);
    const Value page_id = hit.node->root().id();
    const std::u16string* const page_id_s = std::get_if<std::u16string>(&page_id);
    if (path.empty() || page_id_s == nullptr || page_id_s->empty()) continue;
    if (!paths.empty()) {
      paths += u"|";
      pages += u"|";
      points += u"|";
    }
    paths += path;
    pages += *page_id_s;
    points += number_to_string(hit.x) + u"," + number_to_string(hit.y) + u"," +
              number_to_string(hit.z);
  }

  const bool empty = paths.empty();
  // 按下没有命中 ⇒ 什么都不推（`--paths` 与 `--pages` 计数不符会被命令侧告警）。
  if (empty && name == cmd::kPOINTER_DOWN) return;
  if (name == cmd::kPOINTER_MOVE) {
    if (empty) {
      push_empty_move(e);
      return;
    }
    _empty_move = false;
  }

  // `--dev` 下的命中列表轨迹（点没点到某个按钮时，先看这一行）。
  if (_lfw->dev_mode && name == cmd::kPOINTER_DOWN) {
    std::u16string trace = u"[" + std::u16string(name) + u"] " + pos_arg(e) + u" hits=" +
                           number_to_string(static_cast<double>(hits.size()));
    for (const Hit& hit : hits) {
      const ui::UINode::Geo& g = hit.node->geo();
      trace += u" | " + ui_node_path(*hit.node) + u"(" + number_to_string(g.left) + u"," +
               number_to_string(g.top) + u"," + number_to_string(g.right) + u"," +
               number_to_string(g.bottom) + u")";
    }
    _lfw->host().log({Value(trace)});
    std::u16string tree = u"[" + std::u16string(name) + u"] tree:";
    for (const std::u16string& v : visits) tree += u" " + v;
    _lfw->host().log({Value(tree)});
  }

  std::vector<std::u16string> args{std::u16string(name), u"--b=" + number_to_string(e.button),
                                   pos_arg(e)};
  if (!empty) {
    args.push_back(u"--paths=" + paths);
    args.push_back(u"--pages=" + pages);
    args.push_back(u"--points=" + points);
  }
  _lfw->push_cmd(args);
}

}  // namespace lfw::host
