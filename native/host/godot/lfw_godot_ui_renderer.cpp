#include "host/godot/lfw_godot_ui_renderer.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <cstddef>
#include <cstdio>
#include <cstdlib>
#include <string>
#include <utility>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/lfw.h"
#include "lfw/ui/color.h"
#include "lfw/ui/uinode.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/utf8.h"
#include "lfw/world.h"

namespace lfw::host {
namespace {

// 平滑时间常数（ms）：TS `UINodeRenderer.ts:26` `SMOOTH_TAU = 1000 / 60`。
constexpr double kSmoothTau = 1000.0 / 60.0;
// 平铺的保护上限（`repeatX * repeatY`；`main_bg` 是 20×11 = 220）。
constexpr long long kMaxTiles = 4096;

std::string to_utf8(const std::u16string& s) {
  const std::vector<uint8_t> buf = lfw::encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

const std::u16string* as_str(const Value& v) { return std::get_if<std::u16string>(&v); }

std::string str_or(const Value& v, const std::string& fallback) {
  const std::u16string* const s = as_str(v);
  return s != nullptr ? to_utf8(*s) : fallback;
}

std::u16string str16_or(const Value& v) {
  const std::u16string* const s = as_str(v);
  return s != nullptr ? *s : std::u16string();
}

bool nullish(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// `Value` → double；缺失/NaN 一律落回 `fallback`（TS 的 `?? 0` 口径）。
double num_or(const Value& holder, const char16_t* key, double fallback) {
  const Value v = lfw::field_or(holder, key);
  if (nullish(v)) return fallback;
  const double n = lfw::to_number(v);
  return std::isnan(n) ? fallback : n;
}

bool has_num(const Value& holder, const char16_t* key) {
  const Value v = lfw::field_or(holder, key);
  if (nullish(v)) return false;
  return !std::isnan(lfw::to_number(v));
}

double finite_or(double v, double fallback) { return std::isfinite(v) ? v : fallback; }

// JS `Math.round`（负数向 +∞ 收；TS `update_center_and_size` 用的就是它）。
double js_round(double v) {
  if (!std::isfinite(v)) return 0.0;
  return std::floor(v + 0.5);
}

// 正模（TS `pos_mod`：`((a % b) + b) % b`）。⚠ 别用 `std::fmod` 代替 —— 它跟被除数的符号走
// （`fmod(-1.5, 32) == -1.5`），负的纹理窗口起点会被引擎夹到边界（见 `emit_image` 里那条注释）。
double pos_mod(double a, double b) {
  if (!(b > 0.0) || !std::isfinite(a)) return 0.0;
  const double r = std::fmod(a, b);
  return r < 0.0 ? r + b : r;
}

// `Style.font` / `TextMesh` 的 `DEFAULT_FONT_SIZE`：抓第一个 `NNpx`。
double parse_font_size(const std::u16string& font) {
  const std::string s = to_utf8(font);
  for (std::size_t i = 0; i + 1 < s.size(); ++i) {
    if (s[i] != 'p' || s[i + 1] != 'x') continue;
    std::size_t k = i;
    while (k > 0 && (std::isdigit(static_cast<unsigned char>(s[k - 1])) != 0 || s[k - 1] == '.')) {
      --k;
    }
    if (k == i) continue;
    const double n = std::strtod(s.substr(k, i - k).c_str(), nullptr);
    if (n > 0.0) return n;
  }
  return 9.0;
}

struct Rgb01 {
  double r = 1, g = 1, b = 1, a = 1;
  bool found = false;
};

// `parse_rgba`（与 TS 同一个函数）：0..255 的 rgb + 0..1 的 a。
Rgb01 parse_color(const std::u16string& text) {
  Rgb01 out;
  if (text.empty()) return out;
  const ui::RgbaLookup got = ui::parse_rgba(Value(text));
  if (!got.found || got.is_null) return out;
  out.r = got.value.r / 255.0;
  out.g = got.value.g / 255.0;
  out.b = got.value.b / 255.0;
  out.a = got.value.a;
  out.found = true;
  return out;
}

}  // namespace

GodotUINodeRenderer::~GodotUINodeRenderer() = default;

// ---------------------------------------------------------------- 生命周期

void GodotUINodeRenderer::on_start() { _attached = true; }

void GodotUINodeRenderer::on_resume() { _attached = true; }

void GodotUINodeRenderer::on_pause() { _attached = false; }

void GodotUINodeRenderer::on_stop() { _attached = false; }

void GodotUINodeRenderer::del_self() { _attached = false; }

void GodotUINodeRenderer::add(IUINodeRenderer& child) {
  GodotUINodeRenderer* const c = dynamic_cast<GodotUINodeRenderer*>(&child);
  if (c != nullptr) c->_parent = this;
}

void GodotUINodeRenderer::del(IUINodeRenderer& child) {
  GodotUINodeRenderer* const c = dynamic_cast<GodotUINodeRenderer*>(&child);
  if (c != nullptr && c->_parent == this) c->_parent = nullptr;
}

GodotUINodeRenderer* GodotUINodeRenderer::parent_renderer() const {
  // 父子关系来自**模型树**（D4：`parent = ui.parent?.renderer`）；`add`/`del` 只做记账。
  if (ui == nullptr || ui->parent() == nullptr) return nullptr;
  return dynamic_cast<GodotUINodeRenderer*>(ui->parent()->renderer);
}

std::string GodotUINodeRenderer::node_tag() const {
  if (ui == nullptr) return "ui/-";
  const std::string id = str_or(ui->id(), "");
  const std::string name = str_or(ui->name(), "");
  if (id.empty() && name.empty()) return "ui/-";
  return "ui/" + id + (name.empty() ? std::string() : " " + name);
}

int GodotUINodeRenderer::pass_of() const {
  const ui::UINode& n = *ui;
  const ui::UINode& root = n.root();
  // TS `UINodeRenderer.attach_ui_layer`：**层根自己的 z** 决定整棵子树进哪个容器
  //（`ui_bg_container` / `ui_fg_container`，两个容器分别排在世界的两侧）。
  if (finite_or(root.z(), 0.0) < 0.0) return -1;
  if (&n == &root) return 1;
  // 根 `z >= 0` 时只有**根的直接子节点**里 `z < 0` 的那些（连同它们的子树）被挪进背景容器。
  const ui::UINode* top = &n;
  while (top->parent() != nullptr && top->parent() != &root) top = top->parent();
  if (top->parent() == &root) return finite_or(top->z(), 0.0) < 0.0 ? -1 : 1;
  return 1;
}

// ---------------------------------------------------------------- 渲染面

void GodotUINodeRenderer::render(double dt, double dfactor) {
  static_cast<void>(dfactor);  // TS 的 UI 那一遍也不用 `df`（`UINodeRenderer.ts:404-420`）
  if (ui == nullptr || _world == nullptr) return;
  if (!_attached) return;
  // 层根（页节点，`parent == nullptr`）负责一次"开始/收尾"：那一层收集完的绘制项按
  // (pass, z, 收集序) 排好后并进正在写的那一帧 —— 五遍次序里 UI 那两遍就是这么落位的。
  const bool layer_root = ui->parent() == nullptr;
  if (layer_root) _world->ui_begin_layer();
  render_subtree(dt);
  if (layer_root) _world->ui_end_layer();
}

void GodotUINodeRenderer::render_subtree(double dt) {
  ui::UINode& n = *ui;
  _visible = n.visible();  // TS `render()` 的第一行：`mesh.visible = ui.visible`
  if (!_visible) {
    ++_world->ui_stats().hidden;
    return;  // 不可见 ⇒ 整棵子树不画（TS 里 mesh 不可见 + 父节点那句递归条件）
  }
  ++_world->ui_stats().nodes;

  step_local(dt);
  const double lifetime = n.lfw().world().lifetime();
  if (_sync_lifetime != lifetime) {
    _sync_lifetime = lifetime;
    sync_model();
  }
  compute_global();
  if (_world->ui_dump_on()) {
    char np[64];
    if (_np_on) {
      std::snprintf(np, sizeof(np), "%.0f,%.0f,%.0f,%.0f/%.0fx%.0f", _np_lw, _np_th, _np_rw,
                    _np_bh, _np_fw, _np_fh);
    } else {
      std::snprintf(np, sizeof(np), "-");
    }
    char line[512];
    std::snprintf(line, sizeof(line),
                  "[ui] %-28s pass=%2d box=(%.1f,%.1f %.1fx%.1f) vis=%d z=%.0f alpha=%.2f img=%s "
                  "crop=(%.1f,%.1f %.1fx%.1f) rep=%.0fx%.0f np=%s text=%zu/%s",
                  node_tag().c_str(), pass_of(), _box_x0, _box_y0, _box_x1 - _box_x0,
                  _box_y1 - _box_y0, _visible ? 1 : 0, _gz, _alpha,
                  _img_path.empty() ? (_wants_img ? "<missing>" : "-") : _img_path.c_str(), _crop_x,
                  _crop_y, _crop_w, _crop_h, _repeat_x, _repeat_y, np, _text.size(),
                  _text.empty() ? "" : _text.c_str());
    _world->ui_dump_lines().emplace_back(line);
  }
  if (emit_node()) {
    ++_world->ui_stats().drawn;
  } else {
    ++_world->ui_stats().empty;
  }

  for (ui::UINode* const child : n.children()) {
    if (child == nullptr) continue;
    GodotUINodeRenderer* const gr = dynamic_cast<GodotUINodeRenderer*>(child->renderer);
    if (gr == nullptr) continue;  // 别人的实现（差分台面）不参与本宿主的绘制
    // TS `UINodeRenderer.ts:412-420`：可见 **或** 与渲染器的镜像不一致（差一次同步镜像）。
    const bool cv = child->visible();
    if (cv || cv != gr->_visible) gr->render_subtree(dt);
  }
}

void GodotUINodeRenderer::step_local(double dt) {
  const ui::UINode& n = *ui;
  const double tx = finite_or(n.pos.x, _pos_x);
  const double ty = finite_or(n.pos.y, _pos_y);
  const double sx = finite_or(n.scale.x, _scale_x);
  const double sy = finite_or(n.scale.y, _scale_y);
  if (!_pos_init) {
    // TS 在 `on_start()` 里把位置/缩放**一次到位**（`mesh.position.set(x, -y, z)`）。
    _pos_init = true;
    _pos_x = tx;
    _pos_y = ty;
    _scale_x = sx;
    _scale_y = sy;
    return;
  }
  // TS `render()`：`t = 1 - exp(-dt / SMOOTH_TAU)`，位置与缩放各一次 lerp。
  const double t = 1.0 - std::exp(-finite_or(dt, 0.0) / kSmoothTau);
  _pos_x += (tx - _pos_x) * t;
  _pos_y += (ty - _pos_y) * t;
  _scale_x += (sx - _scale_x) * t;
  _scale_y += (sy - _scale_y) * t;
  // 纹理 UV 动画的积分（TS `update_texture_attributes`，`UINodeRenderer.ts:369-388`）：
  // 先按 `offsetAnimR` 累进角度，再把 `offsetAnimX/Y` **按当前角度旋进** offset。
  // ⚠ `_anim_x/_anim_y/_anim_r` 从 `cook` 期就一直在读（`sync_model` 里那三行），但**没人用** ⇒
  // 启动页那张平铺网格（`launch/bg.png`，`offsetAnimX/Y = 0.5`，`repeat 20x11`）在 Godot 里是静止的，
  // 而 Web 版是斜着滚动的（2026-10-16 用户报的"背景网格的 UV 移动动画怎么没了"）。
  if (_anim_x != 0.0 || _anim_y != 0.0 || _anim_r != 0.0) {
    const double sec = finite_or(dt, 0.0) / 1000.0;
    if (_anim_r != 0.0) _uv_angle += sec * _anim_r;
    if (_anim_x != 0.0 || _anim_y != 0.0) {
      const double c = std::cos(_uv_angle);
      const double s = std::sin(_uv_angle);
      _uv_x += sec * (_anim_x * c - _anim_y * s);
      // ⚠ **y 反号**（x 不反）：TS 加的是 three.js 的 `Texture.offset.y`（v 轴，`flipY=true` ⇒
      // v=0 在**图底**），而这里的 `_uv_y` 喂给 `cy = crop_y + _uv_y * ch / repeat_y`、`crop_y`
      // 是**图顶向下**的行号（`emit_image`）⇒ 同一个物理平移在两套坐标里符号相反。
      // 这条只改了"方向"，`anim_r` 的旋转也跟着落在同一套坐标里（`_uv_angle` 只喂这一处）。
      _uv_y -= sec * (_anim_x * s + _anim_y * c);
    }
  }
}

void GodotUINodeRenderer::sync_model() {
  ui::UINode& n = *ui;
  // ---- 矩形与锚点（TS `update_center_and_size`）----
  const double w = finite_or(n.w(), 0.0);
  const double h = finite_or(n.h(), 0.0);
  const double cx = finite_or(n.cx(), 0.0);
  const double cy = finite_or(n.cy(), 0.0);
  const double tran_x = js_round(w * (0.5 - cx));
  const double tran_y = js_round(h * (cy - 0.5));
  _rect_w = w;
  _rect_h = h;
  _rect_x = tran_x - w / 2.0;   // 本地矩形：以 (tran_x, tran_y) 为中心
  _rect_y = -tran_y - h / 2.0;  // ⚠ three.js 的 y 向上 → 屏幕 y 向下要反号

  // ---- 不透明度（TS `apply()`：每次同步往 `global_opacity` 靠一半）----
  const double target = finite_or(n.global_opacity(), 1.0);
  if (!_alpha_init) {
    _alpha_init = true;
    _alpha = target;
  } else {
    _alpha = _alpha + (target - _alpha) * 0.5;
  }

  // ---- 图片 ----
  const Value& img_info = n.image();  // 宿主 `ui_image_load` 给的那份（`ImgLoop` 会 clone 改 clip_*）
  const Value data_img = lfw::field_or(n.data(), u"img");
  const bool has_data_img = !nullish(data_img);
  std::string path = str_or(lfw::field_or(img_info, u"path"), "");
  if (path.empty() && has_data_img) path = str_or(lfw::field_or(data_img, u"path"), "");
  // `ImageMgr.create_img_info` 的前缀：`?` 模糊 / `!` 精确（查包之前都去掉）。
  while (!path.empty() && (path[0] == '!' || path[0] == '?')) path.erase(path.begin());
  _wants_img = !path.empty();
  _img_path.clear();
  _img_unresolved = false;
  _tex_scale = 1;
  _img_lw = _img_lh = 0;
  _crop_x = _crop_y = 0;
  _crop_w = _crop_h = 0;
  _flip_x = _flip_y = false;
  _repeat_x = _repeat_y = 1;
  _anim_x = _anim_y = _anim_r = 0;
  parse_nine_patch(data_img);
  if (!path.empty()) {
    const GodotWorldRenderer::Resolved& res = _world->probe_path(path);
    _img_path = res.path;
    _tex_scale = res.scale > 0.0 ? res.scale : 1.0;
    _img_lw = res.img_w;
    _img_lh = res.img_h;
    if (_img_path.empty()) _img_unresolved = true;
    const bool has_clip = has_num(img_info, u"clip_w") || has_num(img_info, u"clip_h") ||
                          has_num(img_info, u"clip_x") || has_num(img_info, u"clip_y");
    const bool has_dw = has_num(data_img, u"dw") || has_num(data_img, u"dh");
    const double raw_w = num_or(data_img, u"w", 0.0);
    const double raw_h = num_or(data_img, u"h", 0.0);
    // 裁剪窗口（一倍图逻辑像素）：① `ImgLoop` 写的 `clip_*`；② 数据里有 `dw/dh`（TS 会把它烤进
    // 一张新位图 ⇒ 裁剪窗口就是 x/y/w/h）；③ 没有 dw/dh 但 w/h 比原图小 —— 也当一次真裁剪
    //（TS 这种情况下**整图铺上**，是本宿主与 TS 的一处有意偏差，见报告）。
    double src_x = 0, src_y = 0, src_w = 0, src_h = 0;
    if (has_clip) {
      src_x = num_or(img_info, u"clip_x", 0.0);
      src_y = num_or(img_info, u"clip_y", 0.0);
      src_w = num_or(img_info, u"clip_w", 0.0);
      src_h = num_or(img_info, u"clip_h", 0.0);
    }
    if (!(src_w > 0.0) || !(src_h > 0.0)) {
      src_x = num_or(data_img, u"x", 0.0);
      src_y = num_or(data_img, u"y", 0.0);
      const bool cuts = has_dw || has_clip ||
                        (raw_w > 0.0 && _img_lw > 0.0 && raw_w < _img_lw) ||
                        (raw_h > 0.0 && _img_lh > 0.0 && raw_h < _img_lh);
      src_w = cuts && raw_w > 0.0 ? raw_w : _img_lw;
      src_h = cuts && raw_h > 0.0 ? raw_h : _img_lh;
    }
    _crop_x = src_x;
    _crop_y = src_y;
    _crop_w = src_w;
    _crop_h = src_h;
    _flip_x = num_or(data_img, u"flip_x", 0.0) != 0.0;
    _flip_y = num_or(data_img, u"flip_y", 0.0) != 0.0;
    _repeat_x = num_or(data_img, u"repeatX", 1.0);
    _repeat_y = num_or(data_img, u"repeatY", 1.0);
    if (!(_repeat_x > 0.0)) _repeat_x = 1.0;
    if (!(_repeat_y > 0.0)) _repeat_y = 1.0;
    _anim_x = num_or(data_img, u"offsetAnimX", 0.0);
    _anim_y = num_or(data_img, u"offsetAnimY", 0.0);
    _anim_r = num_or(data_img, u"offsetAnimR", 0.0);
  }

  // ---- 颜色（TS `update_img`）----
  const Rgb01 col = parse_color(n.color);
  _has_color = col.found;
  if (col.found) {
    _cr = col.r;
    _cg = col.g;
    _cb = col.b;
    _ca = col.a;
  }
  const Rgb01 bg = parse_color(n.background());
  _bga = finite_or(n.backgroundAlpha(), 0.0);
  _has_bg = bg.found && _bga > 0.0;
  if (bg.found) {
    _bgr = bg.r;
    _bgg = bg.g;
    _bgb = bg.b;
  }
  const Rgb01 fg = parse_color(n.foreground());
  _fga = finite_or(n.foregroundAlpha(), 0.0);
  _has_fg = fg.found && _fga > 0.0;
  if (fg.found) {
    _fgr = fg.r;
    _fgg = fg.g;
    _fgb = fg.b;
  }

  // ---- 文字（TS `UITextRenderer.update` + `TextMesh` 的样式口径）----
  _text.clear();
  _font_size = 9.0;
  _font_css.clear();
  _text_align = 0;
  _tr = _tg = _tb = _ta = 1.0;
  const Value& tv = n.text();
  if (!nullish(tv)) {
    const Value text_v = lfw::field_or(tv, u"text");
    if (!nullish(text_v)) _text = to_utf8(lfw::to_string(n.lfw().string(text_v)));
    if (!_text.empty()) {
      Value style = lfw::field_or(tv, u"style");
      if (nullish(style)) style = n.style.data();
      _font_css = to_utf8(str16_or(lfw::field_or(style, u"font")));
      _font_size = parse_font_size(str16_or(lfw::field_or(style, u"font")));
      const std::u16string align = str16_or(lfw::field_or(style, u"text_align"));
      if (align == u"center") {
        _text_align = 1;
      } else if (align == u"right") {
        _text_align = 2;
      }
      const Rgb01 fill = parse_color(str16_or(lfw::field_or(style, u"fill_style")));
      if (fill.found) {
        _tr = fill.r;
        _tg = fill.g;
        _tb = fill.b;
        _ta = fill.a;
      }
    }
  }
}

void GodotUINodeRenderer::compute_global() {
  GodotUINodeRenderer* const p = parent_renderer();
  const double px = p != nullptr ? p->_gx : 0.0;
  const double py = p != nullptr ? p->_gy : 0.0;
  const double pz = p != nullptr ? p->_gz : 0.0;
  const double psx = p != nullptr ? p->_gsx : 1.0;
  const double psy = p != nullptr ? p->_gsy : 1.0;
  // UI 的本地 (x, y) 逐位等于屏幕 (x, y)（`WorldRenderer.ts:216-219` 把 ui 容器摆到
  // `cam + (0, screen_h)`，两处 y 反号相抵）⇒ 这里只做父坐标系的累计，不再反号。
  _gx = px + psx * _pos_x;
  _gy = py + psy * _pos_y;
  _gz = pz + finite_or(ui->pos.z, 0.0);
  _gsx = psx * _scale_x;
  _gsy = psy * _scale_y;

  const double ax = _gx + _gsx * _rect_x;
  const double ay = _gy + _gsy * _rect_y;
  const double aw = _rect_w * _gsx;
  const double ah = _rect_h * _gsy;
  _box_x0 = std::min(ax, ax + aw);
  _box_x1 = std::max(ax, ax + aw);
  _box_y0 = std::min(ay, ay + ah);
  _box_y1 = std::max(ay, ay + ah);
  _box_valid = (_box_x1 > _box_x0) && (_box_y1 > _box_y0);

  // 继承来的裁剪：祖先里每个 `clip_children` 的矩形求交（TS `effective_clip_rect`）。
  _clip_on = false;
  _clip_x0 = _clip_y0 = _clip_x1 = _clip_y1 = 0;
  if (p != nullptr) {
    _clip_on = p->_clip_on;
    _clip_x0 = p->_clip_x0;
    _clip_y0 = p->_clip_y0;
    _clip_x1 = p->_clip_x1;
    _clip_y1 = p->_clip_y1;
  }
  if (p != nullptr && p->ui != nullptr && p->ui->clip_children() && p->_box_valid) {
    if (!_clip_on) {
      _clip_on = true;
      _clip_x0 = p->_box_x0;
      _clip_y0 = p->_box_y0;
      _clip_x1 = p->_box_x1;
      _clip_y1 = p->_box_y1;
    } else {
      _clip_x0 = std::max(_clip_x0, p->_box_x0);
      _clip_y0 = std::max(_clip_y0, p->_box_y0);
      _clip_x1 = std::min(_clip_x1, p->_box_x1);
      _clip_y1 = std::min(_clip_y1, p->_box_y1);
      if (_clip_x0 >= _clip_x1 || _clip_y0 >= _clip_y1) _clip_on = false;
    }
  }
}

bool GodotUINodeRenderer::emit_node() {
  const bool has_img = !_img_path.empty();
  // "有图但一个包都没命中"要**先**记：下面那条"没东西可画"的早退会把它一起吞掉。
  if (!has_img && _wants_img) ++_world->ui_stats().missing_img;
  if (!has_img && !_has_color && _text.empty() && !_has_bg && !_has_fg) return false;
  if (!_box_valid) return false;
  if (!(_alpha > 0.0)) return false;
  if (_clip_on && (_box_x1 <= _clip_x0 || _box_x0 >= _clip_x1 || _box_y1 <= _clip_y0 ||
                   _box_y0 >= _clip_y1)) {
    ++_world->ui_stats().clipped;
    return false;
  }

  const double x = _box_x0;
  const double y = _box_y0;
  const double w = _box_x1 - _box_x0;
  const double h = _box_y1 - _box_y0;
  const int pass = pass_of();
  const std::string tag = node_tag();
  auto base_item = [&]() {
    GodotDrawItem it;
    it.pass = pass;
    it.depth = _gz;
    it.tag = tag;
    it.kind = "ui";
    it.has_clip = _clip_on;
    it.clip_x0 = _clip_x0;
    it.clip_y0 = _clip_y0;
    it.clip_x1 = _clip_x1;
    it.clip_y1 = _clip_y1;
    return it;
  };
  auto push = [&](GodotDrawItem it) {
    _world->ui_append(std::move(it));
    ++_world->ui_stats().items;
  };

  bool drew = false;
  // 1) `background` 色：TS 在着色器里一次性合成（`bgfg`），这里先铺一层。
  if (_has_bg) {
    GodotDrawItem it = base_item();
    it.flat = true;
    it.x = x;
    it.y = y;
    it.w = w;
    it.h = h;
    it.r = _bgr;
    it.g = _bgg;
    it.b = _bgb;
    it.a = _alpha * _bga;
    push(std::move(it));
    drew = true;
  }
  // 2) 图片（裁剪 + 镜像 + 平铺）或覆盖色
  if (has_img) {
    drew = emit_image(base_item(), x, y, w, h, _gsx < 0.0) || drew;
  } else {
    if (_has_color) {
      GodotDrawItem it = base_item();
      it.flat = true;
      it.x = x;
      it.y = y;
      it.w = w;
      it.h = h;
      it.r = _cr;
      it.g = _cg;
      it.b = _cb;
      it.a = _alpha * _ca;
      push(std::move(it));
      drew = true;
    }
  }
  // 3) 文字
  if (!_text.empty() && _ta > 0.0) {
    GodotDrawItem it = base_item();
    it.x = x;
    it.y = y;
    it.w = w;
    it.h = h;
    it.text = _text;
    it.font_size = _font_size * std::fabs(_gsy);
    it.font_css = _font_css;
    it.text_align = _text_align;
    it.r = _tr;
    it.g = _tg;
    it.b = _tb;
    it.a = _alpha * _ta;
    push(std::move(it));
    ++_world->ui_stats().texts;
    drew = true;
  }
  // 4) `foreground` 色（同上：叠一层）
  if (_has_fg) {
    GodotDrawItem it = base_item();
    it.flat = true;
    it.x = x;
    it.y = y;
    it.w = w;
    it.h = h;
    it.r = _fgr;
    it.g = _fgg;
    it.b = _fgb;
    it.a = _alpha * _fga;
    push(std::move(it));
    drew = true;
  }
  return drew;
}

// `img.nine_patch`（TS `INinePatch`）：缺的键按 `NinePatchGeometry.ensure_parameters` 的默认值
// （`l_w = f_w * 0.4` 那一套），值都在**纹理像素**上。
void GodotUINodeRenderer::parse_nine_patch(const Value& img) {
  _np_on = false;
  _np_fw = 1, _np_fh = 1;
  _np_fl = _np_ft = _np_fr = _np_fb = 0;
  _np_lw = _np_th = _np_rw = _np_bh = 0;
  const Value np = lfw::field_or(img, u"nine_patch");
  if (nullish(np) || as_object(np) == nullptr) return;
  _np_fw = num_or(np, u"f_w", 1.0);
  _np_fh = num_or(np, u"f_h", 1.0);
  if (!(_np_fw > 0.0)) _np_fw = 1.0;
  if (!(_np_fh > 0.0)) _np_fh = 1.0;
  _np_fl = num_or(np, u"f_l", 0.0);
  _np_ft = num_or(np, u"f_t", 0.0);
  _np_fr = num_or(np, u"f_r", 0.0);
  _np_fb = num_or(np, u"f_b", 0.0);
  _np_lw = num_or(np, u"l_w", _np_fw * 0.4);
  _np_th = num_or(np, u"t_h", _np_fh * 0.4);
  _np_rw = num_or(np, u"r_w", _np_fw * 0.4);
  _np_bh = num_or(np, u"b_h", _np_fh * 0.4);
  _np_on = true;
}

// 九宫格（TS `NinePatchGeometry` + `UINodeRenderer.next_geometry`）：3×3 共 9 块，四角按纹理
// 1:1（`t_s = 1 / @Nx`）、四边与中间**拉伸**（`repeatX/Y` 的平铺不叠在九宫格上，数据里没有这种组合）。
//   * 源窗口：着色器里 `uv_x = vUv.x * w / ow + x / ow`（`x/w` = 裁剪窗口，一倍图逻辑像素），
//     九宫格的 `vUv` 是「按框尺寸 `f_w/f_h` 归一化」的图内坐标 ⇒ 换算成**逻辑像素**就是
//     `u * clip_w + clip_x`。
//   * 目标尺寸：几何体里是 `t_s * l_w`（逻辑像素），再乘全局缩放后才是屏幕像素。
//   * 镜像（全局缩放为负）：目标整块左右翻 ⇒ 列序反过来、每块内容也翻（与一图那条同一口径）。
bool GodotUINodeRenderer::emit_nine_patch(const GodotDrawItem& proto, double x, double y, double w,
                                          double h, bool mirror_x) {
  const double iw = _img_lw > 0.0 ? _img_lw : _crop_w;
  const double ih = _img_lh > 0.0 ? _img_lh : _crop_h;
  const double cw = _crop_w > 0.0 ? _crop_w : iw;
  const double ch = _crop_h > 0.0 ? _crop_h : ih;
  if (!(cw > 0.0) || !(ch > 0.0) || !(w > 0.0) || !(h > 0.0)) return false;
  const double ts = _tex_scale > 0.0 ? 1.0 / _tex_scale : 1.0;
  const double u0 = _np_fl / _np_fw, u3 = (_np_fw - _np_fr) / _np_fw;
  const double u1 = u0 + _np_lw / _np_fw, u2 = u3 - _np_rw / _np_fw;
  const double v0 = _np_ft / _np_fh, v3 = (_np_fh - _np_fb) / _np_fh;
  const double v1 = v0 + _np_th / _np_fh, v2 = v3 - _np_bh / _np_fh;
  const double us[4] = {u0, u1, u2, u3};
  const double vs[4] = {v0, v1, v2, v3};
  double sx[4], sy[4];
  for (int i = 0; i < 4; ++i) {
    sx[i] = _crop_x + us[i] * cw;
    sy[i] = _crop_y + vs[i] * ch;
  }
  // 目标格线（屏幕像素，相对盒子左上角）。盒子比角还小的时候把中间那一格挤到 0。
  double dx[4] = {0.0, ts * _np_lw * std::fabs(_gsx), w, w};
  double dy[4] = {0.0, ts * _np_th * std::fabs(_gsy), h, h};
  dx[2] = std::min(std::max(w - ts * _np_rw * std::fabs(_gsx), 0.0), w);
  dy[2] = std::min(std::max(h - ts * _np_bh * std::fabs(_gsy), 0.0), h);
  dx[1] = std::min(std::max(dx[1], 0.0), dx[2]);
  dy[1] = std::min(std::max(dy[1], 0.0), dy[2]);
  bool drew = false;
  for (int j = 0; j < 3; ++j) {
    const double cell_h = dy[j + 1] - dy[j];
    if (!(cell_h > 0.0)) continue;
    for (int i = 0; i < 3; ++i) {
      const double cell_w = dx[i + 1] - dx[i];
      if (!(cell_w > 0.0)) continue;
      const double src_w = sx[i + 1] - sx[i];
      const double src_h = sy[j + 1] - sy[j];
      if (!(src_w > 0.0) || !(src_h > 0.0)) continue;
      GodotDrawItem it = proto;
      it.path = _img_path;
      it.tex_scale = _tex_scale;
      it.x = x + (mirror_x ? w - dx[i + 1] : dx[i]);
      it.y = y + dy[j];
      it.w = cell_w;
      it.h = cell_h;
      it.sx = sx[i];
      it.sy = sy[j];
      it.sw = src_w;
      it.sh = src_h;
      it.flip_x = _flip_x != mirror_x;
      it.flip_y = _flip_y;
      it.mix_a = _has_color ? _ca : 0.0;
      it.mix_r = _has_color ? _cr : 1.0;
      it.mix_g = _has_color ? _cg : 1.0;
      it.mix_b = _has_color ? _cb : 1.0;
      it.a = _alpha;
      _world->ui_append(std::move(it));
      ++_world->ui_stats().items;
      drew = true;
    }
  }
  return drew;
}

// 图片：裁剪窗口（一倍图逻辑像素）+ `@Nx` 倍数 + 平铺。返回"画了没有"。
//
// 平铺的数学照 TS 的着色器（`outline.frag` 的 `uv_x = vUv.x * w / ow + x / ow`，其中
// `ow = tw / tsw = (一倍图宽) / repeatX`）：
//   整块画布上的 u 从 `x / ow` 走到 `(x + clip_w) / ow`，也就是**扫过 `clip_w * repeatX / lw` 张图**；
//   分成 `repeatX` 个瓦片之后，**每个瓦片正好扫过 `clip_w / lw` 张图** ⇒ 一个瓦片要显示的纹理窗口宽
//   是 `clip_w`（一倍图逻辑像素），而不是 `clip_w / repeatX`。窗口起点在重复坐标系里是
//   `x * repeatX + i * clip_w`（`wrap` 折回 = TS 的 wrap 采样）。
// `clip_w > lw`（一张图上重复多次）这里不展开（最多显示前 `lw`）。
bool GodotUINodeRenderer::emit_image(const GodotDrawItem& proto, double x, double y, double w,
                                     double h, bool mirror_x) {
  // 九宫格：数据给了 `nine_patch` 就换成 3×3 那 9 块（TS 里 `next_geometry` 也是二选一 ——
  // 几何体一换就不再是「一图一张」）。和平铺的组合数据里没有，真凑一起还是走下面那条。
  if (_np_on && std::llround(_repeat_x) <= 1 && std::llround(_repeat_y) <= 1) {
    return emit_nine_patch(proto, x, y, w, h, mirror_x);
  }
  const double lw = _img_lw;
  const double lh = _img_lh;
  const double cw = _crop_w > 0.0 ? _crop_w : lw;
  const double ch = _crop_h > 0.0 ? _crop_h : lh;
  if (!(cw > 0.0) || !(ch > 0.0) || !(lw > 0.0) || !(lh > 0.0)) return false;
  // UV 动画把纹理平移折进裁剪窗口（TS `apply()` 里 `set_clip` 那一行的 `% (w/scale)`）。
  // ⚠ 一律用**正模**（TS 的 `pos_mod`，`BgLayerRender.ts` 里就是它）：`std::fmod` 会跟着被除数的
  // 符号走（`fmod(-1.5, 32) == -1.5`），负的窗口起点交给 `draw_texture_rect_region` 会被引擎
  // **夹到纹理边界**⇒ 只剩边缘那一像素被拉成一条（实测：`_uv_y` 是负的（见 `step_local` 里那条
  // "y 反号"），于是整片背景每一瓦片都多一条"最后一像素延申"的竖/横带）。
  const double cx = pos_mod(_crop_x + _uv_x * cw / _repeat_x, lw);
  const double cy = pos_mod(_crop_y + _uv_y * ch / _repeat_y, lh);

  long long nx = static_cast<long long>(std::llround(_repeat_x));
  long long ny = static_cast<long long>(std::llround(_repeat_y));
  if ((nx > 1 || ny > 1) && nx * ny > kMaxTiles) {  // 保护：太碎就不平铺
    nx = 1;
    ny = 1;
  }
  if (nx < 1) nx = 1;
  if (ny < 1) ny = 1;
  const double tile_w = w / static_cast<double>(nx);
  const double tile_h = h / static_cast<double>(ny);
  const double win_w = std::min(cw, lw);  // 一个瓦片显示的纹理像素宽
  const double win_h = std::min(ch, lh);
  const double sweep_x0 = cx * static_cast<double>(nx);  // 重复坐标系里的起点（px）
  const double sweep_y0 = cy * static_cast<double>(ny);
  bool drew = false;
  for (long long i = 0; i < nx; ++i) {
    for (long long j = 0; j < ny; ++j) {
      const double sx0 = pos_mod(sweep_x0 + static_cast<double>(i) * cw, lw);
      const double sy0 = pos_mod(sweep_y0 + static_cast<double>(j) * ch, lh);
      // 窗口在纹理边界折回（wrap）⇒ 切成 ≤2 段，每段一个矩形（一次 blit）。
      const double xsegs[2][2] = {{sx0, std::min(win_w, lw - sx0)},
                                  {0.0, std::max(0.0, win_w - (lw - sx0))}};
      const double ysegs[2][2] = {{sy0, std::min(win_h, lh - sy0)},
                                  {0.0, std::max(0.0, win_h - (lh - sy0))}};
      for (int a = 0; a < 2; ++a) {
        const double sx = xsegs[a][0];
        const double sw = xsegs[a][1];
        if (!(sw > 0.0)) continue;
        // 这一段在窗口里的位置（用来把它摆到瓦片的对应子矩形上）。
        const double fx0 = (a == 0 ? 0.0 : (lw - sx0) / win_w);
        const double fw = sw / win_w;
        for (int b = 0; b < 2; ++b) {
          const double sy = ysegs[b][0];
          const double sh = ysegs[b][1];
          if (!(sh > 0.0)) continue;
          const double fy0 = (b == 0 ? 0.0 : (lh - sy0) / win_h);
          const double fh = sh / win_h;
          GodotDrawItem it = proto;
          it.path = _img_path;
          it.tex_scale = _tex_scale;
          it.w = tile_w * fw;
          it.h = tile_h * fh;
          const double off_x =
              static_cast<double>(i) * tile_w + fx0 * tile_w;
          it.x = mirror_x ? (x + (static_cast<double>(i + 1) * tile_w) - (fx0 + fw) * tile_w)
                          : (x + off_x);
          it.y = y + static_cast<double>(j) * tile_h + fy0 * tile_h;
          it.sx = sx;
          it.sy = sy;
          it.sw = sw;
          it.sh = sh;
          it.flip_x = _flip_x != mirror_x;
          it.flip_y = _flip_y;
          // 有图 ⇒ `color` 当**混色 + 强度**（TS `update_img` 的 `mixColor/mixStrength`）。
          it.mix_a = _has_color ? _ca : 0.0;
          it.mix_r = _has_color ? _cr : 1.0;
          it.mix_g = _has_color ? _cg : 1.0;
          it.mix_b = _has_color ? _cb : 1.0;
          it.a = _alpha;
          _world->ui_append(std::move(it));
          ++_world->ui_stats().items;
          drew = true;
        }
      }
    }
  }
  return drew;
}

}  // namespace lfw::host
