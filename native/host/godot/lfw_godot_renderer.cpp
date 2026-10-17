#include "host/godot/lfw_godot_renderer.h"

#include <algorithm>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <functional>
#include <iterator>
#include <string>
#include <system_error>
#include <vector>

#include "host/common/zip_file.h"
#include "host/fs_zip.h"
#include "host/headless_host.h"
#include "lfw/bg/background.h"
#include "lfw/bg/layer.h"
#include "lfw/camera.h"
#include "lfw/core/value.h"
#include "lfw/defines/state_enum.h"
#include "lfw/entity/entity.h"
#include "lfw/loader/get_import_fallbacks.h"
#include "lfw/transform.h"
#include "lfw/utils/container_help/field_or.h"
#include "lfw/utils/utf8.h"

namespace lfw::host {
namespace {

std::string to_utf8(const std::u16string& s) {
  const std::vector<uint8_t> buf = lfw::encode_utf8(s);
  return std::string(buf.begin(), buf.end());
}

std::u16string from_utf8(const std::string& s) {
  return decode_utf8(std::vector<uint8_t>(s.begin(), s.end()));
}

// 取不到的字段一律落回 `fallback`（与 TS 的 `?? 0` 同口径）。
double num_or(const Value& holder, const char16_t* key, double fallback = 0.0) {
  const Value v = lfw::field_or(holder, key);
  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) {
    return fallback;
  }
  const double n = lfw::to_number(v);
  return std::isnan(n) ? fallback : n;
}

double num_at(const Value& v, double fallback = 0.0) {
  if (std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v)) {
    return fallback;
  }
  const double n = lfw::to_number(v);
  return std::isnan(n) ? fallback : n;
}

// JS 的 `x === void 0 || x === null`（`??` 的左半边）。
bool missing(const Value& v) {
  return std::holds_alternative<std::monostate>(v) || std::holds_alternative<NullTag>(v);
}

// JS 的 `a || b`：`a` 是假值（缺字段 / `null` / `0` / `NaN`）时落回 `b`。
double falsy_or(const Value& v, double fallback) {
  const double n = num_at(v, 0.0);
  return n == 0.0 ? fallback : n;
}

const std::u16string* as_str(const Value& v) { return std::get_if<std::u16string>(&v); }

std::string str_or(const Value& v, const std::string& fallback) {
  const std::u16string* const s = as_str(v);
  return s != nullptr ? to_utf8(*s) : fallback;
}

// ---- 欧拉角 / 四元数（three.js `Euler('XYZ')` ⇄ `Quaternion` 的同口径实现）----
// TS 的 `model_node.rotation` 是"base 模型旋转 × 帧旋转"的四元数乘积再拆回 XYZ 欧拉角；
// 端口的宿主只吃欧拉角（Godot 的默认次序是 YXZ，和 three.js 不同），所以这里自己算一遍。
struct Quat {
  double x = 0, y = 0, z = 0, w = 1;
};

Quat quat_from_euler_xyz(double x, double y, double z) {
  const double c1 = std::cos(x / 2.0), c2 = std::cos(y / 2.0), c3 = std::cos(z / 2.0);
  const double s1 = std::sin(x / 2.0), s2 = std::sin(y / 2.0), s3 = std::sin(z / 2.0);
  Quat q;
  q.x = s1 * c2 * c3 + c1 * s2 * s3;
  q.y = c1 * s2 * c3 - s1 * c2 * s3;
  q.z = c1 * c2 * s3 + s1 * s2 * c3;
  q.w = c1 * c2 * c3 - s1 * s2 * s3;
  return q;
}

Quat quat_mul(const Quat& a, const Quat& b) {
  Quat r;
  r.x = a.x * b.w + a.w * b.x + a.y * b.z - a.z * b.y;
  r.y = a.y * b.w + a.w * b.y + a.z * b.x - a.x * b.z;
  r.z = a.z * b.w + a.w * b.z + a.x * b.y - a.y * b.x;
  r.w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
  return r;
}

// three.js `Euler.setFromQuaternion(q, 'XYZ')`。
void euler_xyz_from_quat(const Quat& q, double& ox, double& oy, double& oz) {
  const double x2 = q.x * 2.0, y2 = q.y * 2.0, z2 = q.z * 2.0;
  const double xx = q.x * x2, xy = q.x * y2, xz = q.x * z2;
  const double yy = q.y * y2, yz = q.y * z2, zz = q.z * z2;
  const double wx = q.w * x2, wy = q.w * y2, wz = q.w * z2;
  const double m11 = 1.0 - (yy + zz);
  const double m12 = xy - wz;
  const double m13 = xz + wy;
  const double m22 = 1.0 - (xx + zz);
  const double m23 = yz + wx;
  const double m32 = yz - wx;
  const double m33 = 1.0 - (xx + yy);
  const double clamped = m13 > 1.0 ? 1.0 : (m13 < -1.0 ? -1.0 : m13);
  oy = std::asin(clamped);
  if (std::fabs(m13) < 0.9999999) {
    ox = std::atan2(-m23, m33);
    oz = std::atan2(-m12, m11);
  } else {
    ox = std::atan2(m32, m22);
    oz = 0.0;
  }
}

// 一组 `{x,y,z}`（数据里是 object，缺省各轴 0）。
void euler_or(const Value& holder, const char16_t* key, double& x, double& y, double& z) {
  const Value v = lfw::field_or(holder, key);
  if (missing(v)) return;
  x = num_or(v, u"x");
  y = num_or(v, u"y");
  z = num_or(v, u"z");
}

// `holder[key][sub]`（缺省 `fallback`）。
double num_sub(const Value& holder, const char16_t* key, const char16_t* sub,
               double fallback = 0.0) {
  const Value v = lfw::field_or(holder, key);
  if (missing(v)) return fallback;
  return num_or(v, sub, fallback);
}

int hex_digit(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  if (c >= 'a' && c <= 'f') return c - 'a' + 10;
  if (c >= 'A' && c <= 'F') return c - 'A' + 10;
  return -1;
}

// `#rgb` / `#rrggbb`（three.js `Color.setStyle` 里那两种；`#rrggbbaa` 浏览器认、three 不认）。
bool parse_hex_color(const std::string& text, double& r, double& g, double& b) {
  if (text.size() < 4 || text[0] != '#') return false;
  const std::string body = text.substr(1);
  if (body.size() == 3 || body.size() == 4) {
    const int h[3] = {hex_digit(body[0]), hex_digit(body[1]), hex_digit(body[2])};
    if (h[0] < 0 || h[1] < 0 || h[2] < 0) return false;
    r = h[0] / 15.0;
    g = h[1] / 15.0;
    b = h[2] / 15.0;
    return true;
  }
  if (body.size() >= 6) {
    const int h[6] = {hex_digit(body[0]), hex_digit(body[1]), hex_digit(body[2]),
                      hex_digit(body[3]), hex_digit(body[4]), hex_digit(body[5])};
    for (const int d : h) {
      if (d < 0) return false;
    }
    r = (h[0] * 16 + h[1]) / 255.0;
    g = (h[2] * 16 + h[3]) / 255.0;
    b = (h[4] * 16 + h[5]) / 255.0;
    return true;
  }
  return false;
}

// `rgb(r,g,b)` / `rgba(r,g,b,a)`（a 是 0..1 小数；与 `Color.setStyle` 同一口径）。
bool parse_rgb_call(const std::string& text, double& r, double& g, double& b, double& a) {
  const std::size_t open = text.find('(');
  if (open == std::string::npos || text.empty() || text.back() != ')') return false;
  const std::string head = text.substr(0, open);
  int want = 0;
  if (head == "rgb") want = 3;
  else if (head == "rgba") want = 4;
  else return false;
  std::vector<double> nums;
  std::size_t at = open + 1;
  while (at < text.size()) {
    std::size_t comma = text.find(',', at);
    if (comma == std::string::npos) comma = text.size();
    const std::string piece = text.substr(at, comma - at);
    const char* const begin = piece.c_str();
    char* end = nullptr;
    const double v = std::strtod(begin, &end);
    if (end == begin) return false;
    nums.push_back(v);
    at = comma + 1;
  }
  if (static_cast<int>(nums.size()) != want) return false;
  r = nums[0] / 255.0;
  g = nums[1] / 255.0;
  b = nums[2] / 255.0;
  a = want == 4 ? nums[3] : 1.0;
  return true;
}

// `Color.set(value)` 的口径（three.js）：**数字 = `0xRRGGBB`**、字符串 = CSS（`#rgb` / `#rrggbb` /
// `rgb()` / `rgba()`）。⚠ 一个坑：烹饪出来的背景数据里纯色层写的是 **`rgb(r,g,b)` 字符串**
//（`dat_translator/bg_data.cpp` 的 `bg_color_translate` 产物），而 `rf-lf2` 那批手写 json5 里
// 写的是**数字**（`0x3F3F3F` 那种）—— 只认 `#hex` 的话这两类全都落空（数字连图层都进不去）。
// ⚠ `ui/utils/int_to_rgba` 是 **ARGB**（那是 UI 的 `parse_rgba` 口径），背景层**不能**用它当替身：
// `0x3F3F3F` 按 ARGB 解出来 alpha = 0（整层透明）。
bool parse_color(const Value& value, double& r, double& g, double& b, double& a) {
  a = 1.0;
  if (const double* const num = std::get_if<double>(&value)) {
    if (!std::isfinite(*num)) return false;
    const long long hex = static_cast<long long>(*num);
    r = static_cast<double>((hex >> 16) & 0xff) / 255.0;
    g = static_cast<double>((hex >> 8) & 0xff) / 255.0;
    b = static_cast<double>(hex & 0xff) / 255.0;
    return true;
  }
  const std::u16string* const str = as_str(value);
  if (str == nullptr) return false;
  const std::string text = to_utf8(*str);
  if (!text.empty() && text[0] == '#') return parse_hex_color(text, r, g, b);
  return parse_rgb_call(text, r, g, b, a);
}

// PNG 的 IHDR（宽/高各 4 字节大端，偏移 16/20）：只要有头就够，不解码。
bool png_size(const std::string& bytes, double& w, double& h) {
  static const char sig[8] = {'\x89', 'P', 'N', 'G', '\r', '\n', '\x1a', '\n'};
  if (bytes.size() < 24) return false;
  if (std::memcmp(bytes.data(), sig, 8) != 0) return false;
  if (std::memcmp(bytes.data() + 12, "IHDR", 4) != 0) return false;
  const auto be32 = [&](std::size_t at) {
    return (static_cast<std::uint32_t>(static_cast<unsigned char>(bytes[at])) << 24) |
           (static_cast<std::uint32_t>(static_cast<unsigned char>(bytes[at + 1])) << 16) |
           (static_cast<std::uint32_t>(static_cast<unsigned char>(bytes[at + 2])) << 8) |
           static_cast<std::uint32_t>(static_cast<unsigned char>(bytes[at + 3]));
  };
  w = static_cast<double>(be32(16));
  h = static_cast<double>(be32(20));
  return true;
}

// 命中名里的倍数（`ImageMgr.get_img_scale` 的两条正则：`@Nx.png` / `@Nx/…`）。
double scale_of_path(const std::string& path) {
  const std::size_t at = path.find('@');
  if (at == std::string::npos || at + 2 >= path.size()) return 1.0;
  const char digit = path[at + 1];
  if (digit < '0' || digit > '9') return 1.0;
  const char x = path[at + 2];
  if (x != 'x' && x != 'X') return 1.0;
  const double n = static_cast<double>(digit - '0');
  return n >= 1.0 ? n : 1.0;
}

double clamp01(double v) { return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v); }

}  // namespace

// ---------------------------------------------------------------- 生命期

void GodotWorldRenderer::add_entity(Entity& e) {
  // 计数与 `NullWorldRenderer` 同口径（摘要行的 `renderer(+-)` 要逐位一致）：每次调用都算一次。
  ++_added;
  for (const Live& l : _live) {
    if (l.e == &e) {
      ++_duplicate_adds;  // TS `mount_renderer` 对已挂载的实体提前返回
      return;
    }
  }
  Live l;
  l.e = &e;
  // TS `EntityRenderer.mount`：`p1` 与 `p0` 都设成挂载时的位置（投影后）。
  const double y = e.position.y - e.position.z / 2.0;
  l.p0x = l.p1x = e.position.x;
  l.p0y = l.p1y = y;
  l.p0z = l.p1z = e.position.z;
  l.s0x = l.s1x = e.position.x;
  l.s0y = l.s1y = e.ground_y() - e.position.z / 2.0;
  l.s0z = l.s1z = e.position.z;
  _live.push_back(l);
}

void GodotWorldRenderer::del_entity(Entity& e) {
  ++_removed;
  for (std::size_t i = 0; i < _live.size(); ++i) {
    if (_live[i].e != &e) continue;
    _live.erase(_live.begin() + static_cast<std::ptrdiff_t>(i));
    return;
  }
  ++_stray_removes;
}

void GodotWorldRenderer::dispose() {
  _disposed = true;
  _live.clear();
  _order.clear();
  _shown = GodotFrame{};
}

GodotWorldRenderer::Live* GodotWorldRenderer::find_live(const Entity* e) {
  for (Live& l : _live) {
    if (l.e == e) return &l;
  }
  return nullptr;
}

// ---------------------------------------------------------------- 资源

const GodotWorldRenderer::Resolved& GodotWorldRenderer::resolve_path(const std::string& path) {
  const std::string ck = "path|" + path;
  const auto found = _resolved.find(ck);
  if (found != _resolved.end()) return found->second;
  Resolved res;
  std::vector<std::u16string> fallbacks;
  std::u16string suffix;
  // 名字前缀（`ImageMgr.create_img_info` 的 `?` 模糊 / `!` 精确）在查包之前去掉 —— 它是标记、
  // 不是文件名的一部分（UI 那两处调用方各自也要用它，见 `lfw_godot_ui_renderer.cpp:305`）。
  std::string name = path;
  while (!name.empty() && (name[0] == '!' || name[0] == '?')) name.erase(name.begin());
  // 与 TS 同一张回退表（`native/lfw/loader/get_import_fallbacks`）：`@Nx` / `@Nx/` / `.webp`。
  // ⚠ 一个候选算数要**字节真的读得出来**：包（`--zip`）与根目录（`--root`）都认
  //（UI 的图片路径是相对 root 的：`builtin_data/launch/bg.png` 在 `dist/` 里，不在任何包里）。
  if (!name.empty() && lfw::loader::get_import_fallbacks(Value(from_utf8(name)), fallbacks, suffix)) {
    for (const std::u16string& cand : fallbacks) {
      const std::string candidate = to_utf8(cand);
      std::string bytes;
      if (!read_resource(candidate, bytes)) continue;
      res.path = candidate;
      res.scale = scale_of_path(res.path);
      double w = 0, h = 0;
      if (png_size(bytes, w, h)) {
        res.img_w = w / res.scale;
        res.img_h = h / res.scale;
      }
      break;
    }
  }
  return _resolved.emplace(ck, std::move(res)).first->second;
}

const GodotWorldRenderer::Resolved& GodotWorldRenderer::resolve_key(const Entity& e,
                                                                   const std::string& key,
                                                                   double variant) {
  const Value base = e.data_base();
  const Value files = lfw::field_or(base, u"files");
  std::string chosen = key;
  // 变体表：TS `file_variants.get(tex)?.at(variant)` = `[tex, ...files[tex].variants][variant]`。
  const int vi = static_cast<int>(variant);
  if (vi > 0) {
    const Value entry = lfw::field_or(files, from_utf8(key).c_str());
    const Value variants_v = lfw::field_or(entry, u"variants");
    const Array* const variants = lfw::as_array(variants_v);
    if (variants != nullptr && static_cast<std::size_t>(vi) <= variants->size()) {
      const std::u16string* const alt = as_str(variants->at(static_cast<std::size_t>(vi) - 1));
      if (alt != nullptr) chosen = to_utf8(*alt);
    }
  }
  const std::string ck = str_or(e.data_id(), "-") + "|" + std::to_string(vi) + "|" + chosen;
  const auto found = _resolved.find(ck);
  if (found != _resolved.end()) return found->second;
  const Value entry = lfw::field_or(files, from_utf8(chosen).c_str());
  const std::string path = str_or(lfw::field_or(entry, u"path"), "");
  const Resolved& by_path = resolve_path(path);
  Resolved res = by_path;
  return _resolved.emplace(ck, std::move(res)).first->second;
}

bool GodotWorldRenderer::read_resource(const std::string& path, std::string& out) const {
  if (path.empty()) return false;
  if (_lfw != nullptr) {
    const std::vector<IZipResult> hits = _lfw->zips().find({from_utf8(path)}, /*exact=*/true);
    for (const IZipResult& hit : hits) {
      if (hit.file == nullptr) continue;
      std::u16string error;
      // 包对象两种：`FsZipObject`（`--zip` 的目录当包用）与 `ZipFileObject`（**真 `.zip`**，
      // 从菜单 `load_data()` 按 URL 加载的那条路）。两种都能直接给字节；`image_bitmap` 那条路
      // 故意拒绝（DESIGN D2），宿主自己解码。
      if (auto* const fs = dynamic_cast<FsZipObject*>(hit.file)) {
        if (fs->read(out, error)) return true;
        continue;
      }
      if (auto* const zf = dynamic_cast<ZipFileObject*>(hit.file)) {
        if (zf->read(out, error)) return true;
      }
    }
  }
  if (_host != nullptr) {
    const std::filesystem::path p = _host->resolve(from_utf8(path));
    if (!p.empty()) {
      std::ifstream in(p, std::ios::binary);
      if (in) {
        out.assign(std::istreambuf_iterator<char>(in), std::istreambuf_iterator<char>());
        return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------- 背景

void GodotWorldRenderer::build_background(const World& world, GodotFrame& frame, bool foreground) {
  const Background* const bg = world.bg();
  if (bg == nullptr) return;
  const Value base = lfw::field_or(bg->data(), u"base");
  const double zoom_x = num_or(base, u"zoom_x", 1.0);
  const double zoom_y = num_or(base, u"zoom_y", 1.0);
  // ⚠ `bg_width` 是 **stage** 的宽度（TS `const { width: bg_width } = world`；
  // 端口 `World::width()` = `stage_->width`），不是 `bg.width()`。
  const double bg_width = world.width();
  struct One {
    double z = 0;
    GodotDrawItem item;
  };
  std::vector<One> picked;
  for (const std::shared_ptr<Layer>& layer : bg->layers()) {
    if (layer == nullptr || !layer->visible()) continue;
    const Value& info = layer->info();
    const double z = num_or(info, u"z");
    if ((z > 0.0) != foreground) continue;
    const std::string file = str_or(lfw::field_or(info, u"file"), "");
    const Resolved& res = file.empty() ? resolve_path("") : resolve_path(file);
    const bool has_pic = !res.path.empty();
    // 目标尺寸：有图 ⇒ `dw ?? 一倍图宽`；无图（纯色层）⇒ `w || width`（JS 的 `||`：0 落回后一个）。
    const double layer_width = num_or(info, u"width");
    const double dst_w = has_pic ? num_or(info, u"dw", res.img_w)
                                 : falsy_or(lfw::field_or(info, u"w"), layer_width);
    const double dst_h = has_pic ? num_or(info, u"dh", res.img_h)
                                 : falsy_or(lfw::field_or(info, u"h"),
                                            num_or(info, u"height"));
    if (!(dst_w > 0.0) || !(dst_h > 0.0)) continue;
    // 视差：`BgLayerRender.render`（非 absolute 层按相机平移）。
    const double cam_x = frame.cam_x;
    const double parallax = bg_width > frame.screen_w
                                ? (bg_width - layer_width) * cam_x / (bg_width - frame.screen_w)
                                : (bg_width - layer_width) * cam_x;
    const bool absolute = lfw::truthy(lfw::field_or(info, u"absolute"));
    // 节点在世界里的位置（TS `BgRender.build_nodes` + `render`）：非 absolute 层挂在
    // `root_node`（`position = cam * (1 - zoom)` + 层自己那点视差）上，absolute 层挂在
    // `cam_node`（`position.x = cam_x`，y 不动）上 ⇒ **absolute 层在屏幕上不随相机平移**
    //（`cam_node` 补上的正好是相机那一段）。⚠ 这里曾经写成 `world_x = absolute ? 0 : …`，
    // 于是 absolute 层被画到 `-cam_x` 上、跟着相机跑（2026-10-16 用户报的"纯色且相对相机不移动的
    // Layer 渲染得不对"）。
    const double info_x = num_or(info, u"x");
    const double info_y = num_or(info, u"y");
    const double node_x = absolute ? (cam_x + info_x)
                                   : (cam_x * (1.0 - zoom_x) + info_x + parallax);
    const double node_y = absolute ? info_y : (frame.cam_y * (1.0 - zoom_y) + info_y);
    GodotDrawItem it;
    it.kind = foreground ? "fg" : "bg";
    it.tag = str_or(lfw::field_or(info, u"name"), str_or(bg->id(), "bg"));
    it.depth = z;
    it.x = node_x - cam_x;
    it.y = frame.screen_h - (node_y - frame.cam_y);
    it.w = dst_w;
    it.h = dst_h;
    it.path = res.path;
    it.tex_scale = res.scale;
    it.sw = res.img_w;
    it.sh = res.img_h;
    // 颜色：TS 是 `if (!src_texture && color !== void 0) m.color.set(color)` ⇒ **有图就不看颜色**；
    // 无图的纯色层是"一块填色"，宿主必须按 `flat` 填矩形（否则会掉进"取不到图"的占位色块那一档）。
    const Value color_v = lfw::field_or(info, u"color");
    const bool has_color = !std::holds_alternative<std::monostate>(color_v) &&
                           !std::holds_alternative<NullTag>(color_v);
    double cr = 1, cg = 1, cb = 1, ca = 1;
    const bool color_ok = !has_pic && has_color && parse_color(color_v, cr, cg, cb, ca);
    if (color_ok) {
      it.r = cr;
      it.g = cg;
      it.b = cb;
      it.a = ca;
      it.flat = true;
    }
    if (has_pic || has_color) picked.push_back(One{z, it});
  }
  // 同一遍内 z 远→近（画家次序）。
  std::stable_sort(picked.begin(), picked.end(),
                   [](const One& a, const One& b) { return a.z < b.z; });
  for (const One& one : picked) {
    frame.items.push_back(one.item);
    ++frame.bg_layers;
  }
}

// ---------------------------------------------------------------- 逐实体

void GodotWorldRenderer::emit_sprite(GodotFrame& frame, const Entity& e, const Value& pic,
                                     double world_x, double world_y, double anchor_x,
                                     double anchor_y, const Resolved& res,
                                     const std::string& kind) {
  const double pw = num_or(pic, u"w");
  const double ph = num_or(pic, u"h");
  if (!(pw > 0.0) || !(ph > 0.0)) return;
  GodotDrawItem it;
  it.kind = kind;
  it.tag = to_utf8(e.id);
  it.x = frame.tx + frame.scale_x * (world_x + anchor_x - frame.cam_x);
  it.y = frame.screen_h - frame.ty - frame.scale_y * (world_y + anchor_y - frame.cam_y);
  it.w = pw * frame.scale_x;
  it.h = ph * frame.scale_y;
  it.path = res.path;
  it.tex_scale = res.scale;
  it.sx = num_or(pic, u"x");
  it.sy = num_or(pic, u"y");
  it.sw = pw;
  it.sh = ph;
  it.flip_x = e.facing < 0;
  if (it.path.empty()) ++frame.unnamed_textures;
  // 逐图旋转（TS `EntityMainRender.update_mesh_position`）：`rad` 为假值时不动（TS 的 `!rad`）。
  // TS 的 mesh 位置算在 **y 向上**的局部系里（`px = cx + ox` / `py = cy - oy`，pivot 从矩形
  // 左上角按 `ox` 向右、`oy` 向下量），端口的绘制项是 y 向下的屏幕系（差一个镜像）⇒ 角度取
  // `-rad`；再把**矩形中心**按同一条公式绕 pivot 转一次，剩下的「绕矩形中心转」由宿主做
  //（绕中心转 + 中心绕 pivot 转 = 绕 pivot 转，两次叠加逐位等价）。
  const Value rad_v = lfw::field_or(pic, u"rad");
  if (std::holds_alternative<double>(rad_v) && std::get<double>(rad_v) != 0.0) {
    const double rad = std::get<double>(rad_v);
    const Value ox_v = lfw::field_or(pic, u"ox");
    const Value oy_v = lfw::field_or(pic, u"oy");
    const double ox = missing(ox_v) ? pw / 2.0 : num_at(ox_v);
    const double oy = missing(oy_v) ? ph / 2.0 : num_at(oy_v);
    // TS：`rotation.z = flipped ? -rad : rad`，绕 pivot 的那次旋转也用同一个符号（`_sin` 乘
    // `flipped ? -1 : 1`）⇒ 屏幕系（差一个镜像）里就是它的相反数。
    const double theta = e.facing < 0 ? rad : -rad;
    const double pivot_x = it.x + ox * frame.scale_x;
    const double pivot_y = it.y + oy * frame.scale_y;
    const double dx = it.x + it.w / 2.0 - pivot_x;
    const double dy = it.y + it.h / 2.0 - pivot_y;
    const double cs = std::cos(theta);
    const double sn = std::sin(theta);
    it.x = pivot_x + dx * cs - dy * sn - it.w / 2.0;
    it.y = pivot_y + dx * sn + dy * cs - it.h / 2.0;
    it.rot = theta;
    if (frame.rotated_items == 0) frame.rotated_probe = theta;
    ++frame.rotated_items;
  }
  // 换色（`mix_color` + `mix_strength`）：宿主用第二遍 `modulate` 叠出来（见 `_draw`）。
  const double mix = e.mix_strength();
  if (mix > 0.0) {
    double cr = 1, cg = 1, cb = 1, ca = 1;
    if (parse_color(e.mix_color(), cr, cg, cb, ca)) {
      it.mix_r = cr;
      it.mix_g = cg;
      it.mix_b = cb;
      it.mix_a = clamp01(mix);
    }
  }
  // 描边：`outline_color && outline_alpha && outline_enabled`（TS `update_outline`）。
  const std::string oc = to_utf8(e.outline_color());
  const double oa = e.outline_alpha();
  const double ow = e.outline_width();
  if (!oc.empty() && oa > 0.0 && lfw::truthy(e.outline_enabled()) && ow > 0.0) {
    double cr = 0, cg = 0, cb = 0, ca = 1;
    if (parse_color(e.outline_color(), cr, cg, cb, ca)) {
      it.outline_r = cr;
      it.outline_g = cg;
      it.outline_b = cb;
      it.outline_a = oa;
      // ⚠ `outline_width` 是**逻辑像素**的扩张量：TS 里乘 `img.scale` 是给着色器算 texel 用的
      //（`texel = outlineWidth / textureSize`，@2x 时正好折回 1 逻辑像素）⇒ 画的时候不要乘。
      it.outline_w = ow;
      ++frame.outline_items;
      if (frame.outline_probe.empty()) {
        char buf[96];
        std::snprintf(buf, sizeof(buf), "%s@%.2f,%.1f", oc.c_str(), oa, it.outline_w);
        frame.outline_probe = buf;
      }
    }
  }
  frame.items.push_back(std::move(it));
}

void GodotWorldRenderer::emit_entity_shadow(const World& world, GodotFrame& frame,
                                            const Entity& e, const Live& live) {
  const Background* const bg = world.bg();
  if (bg == nullptr) return;
  const Value base = lfw::field_or(bg->data(), u"base");
  const std::string shadow = str_or(lfw::field_or(base, u"shadow"), "");
  if (shadow.empty()) return;
  if (lfw::truthy(lfw::field_or(e.frame, u"no_shadow"))) return;
  const Resolved& res = resolve_path(shadow);
  if (res.path.empty()) return;
  const double w = num_or(base, u"shadow_w", res.img_w);
  const double h = num_or(base, u"shadow_h", res.img_h);
  if (!(w > 0.0) || !(h > 0.0)) return;
  // TS `EntityShadowRender.render`：位置 / 缩放 / 不透明度三对各自 `p0 → p1` 按 df 插。
  const double df = frame.dfactor;
  const double px = live.s0x + (live.s1x - live.s0x) * df;
  const double py = live.s0y + (live.s1y - live.s0y) * df;
  const double s = live.s0s + (live.s1s - live.s0s) * df;
  const double o = live.s0o + (live.s1o - live.s0o) * df;
  GodotDrawItem it;
  it.kind = "shadow";
  it.tag = to_utf8(e.id);
  it.depth = num_at(live.s1z);
  // 几何是**居中**的（TS `get_static_plane_geometry(w, h)` 不带平移）。
  it.x = frame.tx + frame.scale_x * (px - frame.cam_x) - w * s * frame.scale_x / 2.0;
  it.y = frame.screen_h - frame.ty - frame.scale_y * (py - frame.cam_y) - h * s * frame.scale_y / 2.0;
  it.w = w * s * frame.scale_x;
  it.h = h * s * frame.scale_y;
  it.path = res.path;
  it.tex_scale = res.scale;
  it.sw = res.img_w;
  it.sh = res.img_h;
  it.a = clamp01(o);
  if (it.path.empty()) ++frame.unnamed_textures;
  frame.items.push_back(std::move(it));
}

// ---------------------------------------------------------------- 3D 模型那一遍（`frame.model`）

// TS `EntityMainRender.render` 的模型分支 + `update_model_visual` 的参数部分：
//   `model_node.position.set(shaking_x + ox, oy, oz)`、`scale.set(facing * sx, sy, sz)`、
//   `rotation.set(ex, facing < 0 ? -ey : ey, facing < 0 ? -ez : ez)`，
//   其中 (ex,ey,ez) 是「base 模型旋转 × 帧旋转」的四元数拆回 XYZ 欧拉角，
//   帧旋转缺省时 `z` 回退到 `model.rad`。
// 位置/缩放/旋转都是**局部**量（相对实体节点），真正的像素由宿主在离屏 3D 画布里出。
void GodotWorldRenderer::emit_model(GodotFrame& frame, const Entity& e, const Value& model,
                                    double world_x, double world_y, double shaking_x) {
  const std::string id = str_or(lfw::field_or(model, u"id"), "");
  if (id.empty()) return;
  const Value models = lfw::field_or(e.data_base(), u"models");
  const Value id_v = lfw::field_or(model, u"id");
  const std::u16string* const id_p = as_str(id_v);
  if (id_p == nullptr) return;
  const Value info = lfw::field_or(models, id_p->c_str());
  if (missing(info)) return;  // TS：`未在 base.models 中声明` ⇒ 只警告、不显示
  GodotModelSpec spec;
  std::string path = str_or(lfw::field_or(info, u"path"), "");
  if (path.empty()) return;
  // TS `resolve_model_path`：`!` 精确 / `?` 模糊（数据里目前没有这两个前缀，照抄语义）。
  if (path.front() == '!') {
    path = path.substr(1);
  } else if (path.front() == '?') {
    path = path.substr(1);
    spec.exact = false;
  }
  spec.path = path;

  double bx = 0, by = 0, bz = 0;
  euler_or(info, u"rotation", bx, by, bz);
  double fx = 0, fy = 0, fz = 0;
  euler_or(model, u"rotation", fx, fy, fz);
  if (missing(lfw::field_or(model, u"rotation"))) fz = num_or(model, u"rad");
  const Quat qa = quat_mul(quat_from_euler_xyz(bx, by, bz), quat_from_euler_xyz(fx, fy, fz));
  euler_xyz_from_quat(qa, spec.rx, spec.ry, spec.rz);
  if (e.facing < 0) {
    spec.ry = -spec.ry;
    spec.rz = -spec.rz;
  }

  const double b_sx = num_sub(info, u"scale", u"x", 1.0);
  const double b_sy = num_sub(info, u"scale", u"y", 1.0);
  const double b_sz = num_sub(info, u"scale", u"z", 1.0);
  const double f_sx = num_sub(model, u"scale", u"x", 1.0);
  const double f_sy = num_sub(model, u"scale", u"y", 1.0);
  const double f_sz = num_sub(model, u"scale", u"z", 1.0);
  spec.sx = e.facing * b_sx * f_sx;
  spec.sy = b_sy * f_sy;
  spec.sz = b_sz * f_sz;

  spec.px = shaking_x + num_sub(info, u"offset", u"x") + num_sub(model, u"offset", u"x");
  spec.py = num_sub(info, u"offset", u"y") + num_sub(model, u"offset", u"y");
  spec.pz = num_sub(info, u"offset", u"z") + num_sub(model, u"offset", u"z");

  spec.anim = str_or(lfw::field_or(model, u"anim"), "");
  spec.loop = lfw::truthy(lfw::field_or(model, u"loop"));
  spec.reverse = lfw::truthy(lfw::field_or(model, u"reverse"));
  spec.hold_last = lfw::truthy(lfw::field_or(model, u"hold_last"));

  // 模型轮廓：判据与精灵那一遍逐条一致（`update_model_outline`：`!ghosted && outline_color &&
  // outline_alpha && outline_enabled`）。
  const std::string moc = to_utf8(e.outline_color());
  const double moa = e.outline_alpha();
  const double mow = e.outline_width();
  if (!moc.empty() && moa > 0.0 && lfw::truthy(e.outline_enabled()) && mow > 0.0) {
    double cr = 0, cg = 0, cb = 0, ca = 1;
    if (parse_color(e.outline_color(), cr, cg, cb, ca)) {
      spec.outline_r = cr;
      spec.outline_g = cg;
      spec.outline_b = cb;
      spec.outline_a = moa;
      spec.outline_w = mow;
    }
  }

  GodotDrawItem it;
  it.kind = "model";
  it.tag = to_utf8(e.id);
  it.has_model = true;
  it.model = std::move(spec);
  it.depth = e.position.z;
  // 模型局部原点（世界单位 = 逻辑像素）落在实体**画到**的那个点上 ⇒ 离屏画布以它为中心。
  const double cx = frame.tx + frame.scale_x * (world_x - frame.cam_x);
  const double cy = frame.screen_h - frame.ty - frame.scale_y * (world_y - frame.cam_y);
  it.w = kModelViewport * frame.scale_x;
  it.h = kModelViewport * frame.scale_y;
  it.x = cx - it.w / 2.0;
  it.y = cy - it.h / 2.0;
  ++frame.model_items;
  if (frame.model_probe.empty()) frame.model_probe = it.model.path + "|" + it.model.anim;
  frame.items.push_back(std::move(it));
}

// ---------------------------------------------------------------- UI 那一遍（D4）

// 一个层开始收集：清缓冲。`end` 里按 (pass, z, 收集序) 稳定排好后并进 `_pending`。
void GodotWorldRenderer::ui_begin_layer() {
  if (_disposed) return;
  _ui_buf.clear();
  ++_ui_stats.layers;
}

void GodotWorldRenderer::ui_append(GodotDrawItem item) { _ui_buf.push_back(std::move(item)); }

void GodotWorldRenderer::ui_end_layer() {
  if (_disposed) {
    _ui_buf.clear();
    return;
  }
  // `z`（`GodotDrawItem::depth`）：three.js 的透明排序按到相机的距离 —— 相机在 z=100 看向 -z
  // ⇒ 本地 z 越大越近、越后画 ⇒ 升序即画家次序；同 z 保持模型树的递归序（`stable_sort`）。
  // `pass` 是五遍次序（UI 背景 / 世界 / UI 前景），先按它分堆。
  std::stable_sort(_ui_buf.begin(), _ui_buf.end(), [](const GodotDrawItem& a, const GodotDrawItem& b) {
    if (a.pass != b.pass) return a.pass < b.pass;
    return a.depth < b.depth;
  });
  for (GodotDrawItem& item : _ui_buf) _pending.items.push_back(std::move(item));
  _ui_buf.clear();
}

// ---------------------------------------------------------------- 每帧

void GodotWorldRenderer::render(double dt) {
  if (_disposed) return;
  ++_render_count;
  _ui_stats = GodotUIStats{};
  _ui_dump_lines.clear();
  World& world = _lfw->world();
  GodotFrame frame;
  frame.valid = true;
  frame.index = _render_count;
  frame.dt = dt;
  frame.lifetime = world.lifetime();
  frame.tu = world.TU;
  frame.fps = world.fps_value();
  frame.ups = num_at(world.dataset.get(u"UPS"), 60.0);
  // 帧内比例：TS `WorldRenderer.render`（`WorldRenderer.ts:187-204`）逐字照抄。
  if (frame.fps <= frame.ups) {
    _utime = frame.lifetime;
    _dtime = frame.tu;
    _dfactor = 1.0;
    _dirty = true;
  } else if (_utime != frame.lifetime) {
    _utime = frame.lifetime;
    _dtime = 0.0;
    _dfactor = 0.0;
    _dirty = true;
  } else {
    _dtime = std::min(_dtime + dt, frame.tu);
    _dfactor = std::min(_dtime / frame.tu, 1.0);
  }
  frame.dfactor = _dfactor;
  frame.dtime = _dtime;
  frame.dirty = _dirty;

  const Camera& cam = world.camera();
  if (_dirty) {
    _cam_p0_x = _cam_p1_x;
    _cam_p0_y = _cam_p1_y;
    _cam_p1_x = cam.position.x;
    _cam_p1_y = cam.position.y;
  }
  frame.cam_p0_x = _cam_p0_x;
  frame.cam_p0_y = _cam_p0_y;
  frame.cam_p1_x = _cam_p1_x;
  frame.cam_p1_y = _cam_p1_y;
  frame.cam_x = _cam_p0_x + (_cam_p1_x - _cam_p0_x) * _dfactor;
  frame.cam_y = _cam_p0_y + (_cam_p1_y - _cam_p0_y) * _dfactor;

  frame.tx = world.transform.x();
  frame.ty = world.transform.y();
  frame.scale_x = world.transform.scale_x();
  frame.scale_y = world.transform.scale_y();
  frame.screen_w = num_at(world.dataset.get(u"screen_w"), 794.0);
  frame.screen_h = num_at(world.dataset.get(u"screen_h"), 450.0);
  if (const Background* const bg = world.bg()) {
    frame.bg_id = str_or(bg->id(), "-");
  }
  frame.retained = static_cast<int>(_live.size());
  frame.world_live = static_cast<int>(world.entities.size() + world.ghosts.size());

  // ---- 1) 背景层（`z <= 0` 那些）----
  build_background(world, frame, /*foreground=*/false);

  // ---- 2) 位置那一对 & 次序 ----
  for (Live& live : _live) {
    Entity& e = *live.e;
    if (_dirty) {
      live.p0x = live.p1x;
      live.p0y = live.p1y;
      live.p0z = live.p1z;
      const double y = e.position.y - e.position.z / 2.0;  // TS `p1.set(x, y - z/2, z)`
      live.p1x = e.position.x;
      live.p1y = y;
      live.p1z = e.position.z;
      // 影子：`(x, ground_y - z/2, min(bg.far - 1, z))` + 随离地高度的缩放/不透明度。
      const Background* const bg = world.bg();
      const double far = bg != nullptr ? bg->far_plane() : e.position.z;
      live.s0x = live.s1x;
      live.s0y = live.s1y;
      live.s0z = live.s1z;
      live.s0s = live.s1s;
      live.s0o = live.s1o;
      live.s1x = e.position.x;
      live.s1y = e.ground_y() - e.position.z / 2.0;
      live.s1z = std::min(far - 1.0, e.position.z);
      const double off = 250.0 - (e.position.y - e.ground_y());
      const double t = std::max(0.0, std::min(off, 250.0)) / 250.0;
      live.s1s = 0.5 + 0.5 * t;
      live.s1o = 0.3 + 0.7 * t;
    }
    live.has_r = false;
  }

  _order.clear();
  std::vector<Live*> roots;
  for (Live& live : _live) {
    Entity& e = *live.e;
    const Entity* const holder = e.bearer != nullptr ? e.bearer : e.catcher;
    if (holder == nullptr || find_live(holder) == nullptr) roots.push_back(&live);
  }
  // 组按代表实体的 z 远→近（TS `by_group_z` = 升序）。
  std::stable_sort(roots.begin(), roots.end(), [](const Live* a, const Live* b) {
    return a->p1z < b->p1z;
  });
  // 组内：持有者 → 被持有 → 被抓住（TS `EntityRenderer.render` 尾部那三行），
  // 然后按**各自**的 z 升序排一遍（TS 组内走的是真深度测试 ⇒ 画家次序要按 z）。
  std::vector<Live*> group;
  const std::function<void(Live*, int)> push_chain = [&](Live* live, int depth) {
    if (live == nullptr || live->has_r || depth > 4) return;
    live->has_r = true;
    group.push_back(live);
    Entity& e = *live->e;
    push_chain(find_live(e.holding), depth + 1);
    push_chain(find_live(e.catching), depth + 1);
  };
  for (Live* const root : roots) {
    group.clear();
    push_chain(root, 0);
    std::stable_sort(group.begin(), group.end(),
                     [](const Live* a, const Live* b) { return a->p1z < b->p1z; });
    for (Live* const member : group) _order.push_back(member);
  }
  for (Live& live : _live) {  // 环/孤儿兜底：剩下的按插入序补在后面
    if (!live.has_r) {
      live.has_r = true;
      _order.push_back(&live);
    }
  }

  // ---- 3) 位置：根按 `p0 → p1` 插值、被持有者跟随持有者的位移 ----
  for (Live* const live : _order) {
    Entity& e = *live->e;
    const Entity* const holder = e.bearer != nullptr ? e.bearer : e.catcher;
    Live* const hl = holder != nullptr ? find_live(holder) : nullptr;
    if (hl == nullptr) {
      // TS：`entity.lifetime === 0 && (df = 1)`（出生那一帧不插）。
      const double df = e.lifetime() == 0.0 ? 1.0 : _dfactor;
      live->rx = live->p0x + (live->p1x - live->p0x) * df;
      live->ry = live->p0y + (live->p1y - live->p0y) * df;
      live->rz = live->p0z + (live->p1z - live->p0z) * df;
    } else {
      // TS：`position = p1 - (holder.p1 - holder.position)`。
      live->rx = live->p1x - (hl->p1x - hl->rx);
      live->ry = live->p1y - (hl->p1y - hl->ry);
      live->rz = live->p1z - (hl->p1z - hl->rz);
    }
  }

  // ---- 4) 影子（TS 的 shadow_batch：所有影子在实体之前一遍画掉）----
  for (Live* const live : _order) {
    const Entity& e = *live->e;
    if (e.invisible() > 0.0) continue;
    emit_entity_shadow(world, frame, e, *live);
  }

  // ---- 5) 实体（组已排好序）----
  for (Live* const live : _order) {
    Entity& e = *live->e;
    const Value frame_id = e.frame_id();
    const Value state = e.state();
    const std::string frame_id_s = str_or(frame_id, "");
    const std::string state_s = str_or(state, "");
    const bool gone = frame_id_s == "gone" || state_s == "Gone" || state_s == "gone";
    const double blinking = e.blinking();
    const bool visible = !gone && e.invisible() <= 0.0 &&
                         !(blinking > 0.0 && std::fmod(std::floor(blinking / 4.0), 2.0) != 0.0);
    if (!visible) {
      ++frame.hidden_entities;
      continue;
    }
    // 锚点：TS `facing === 1 ? -centerx : centerx - width`；抖动是同一条公式上的水平偏移。
    const Value top = e.frame;
    const double centerx = num_or(top, u"centerx");
    const double centery = num_or(top, u"centery");
    const double width = num_or(top, u"width");
    const double shaking = num_at(e.shaking);
    const double shaking_x =
        shaking > 0.0 ? e.facing * (std::fmod(std::floor(shaking / 2.0), 2.0) != 0.0 ? 1.0 : -1.0)
                      : 0.0;
    const double base_anchor_x = e.facing == 1.0 ? -centerx : centerx - width;
    const Value pic = lfw::field_or(top, u"pic");
    int drawn = 0;
    bool had_tex = false;
    if (!std::holds_alternative<std::monostate>(pic) &&
        !std::holds_alternative<NullTag>(pic)) {
      const std::string tex = str_or(lfw::field_or(pic, u"tex"), "");
      if (!tex.empty()) {
        had_tex = true;
        const Resolved& res = resolve_key(e, tex, e.variant);
        emit_sprite(frame, e, pic, live->rx, live->ry, base_anchor_x + shaking_x, centery, res,
                    "entity");
        ++drawn;
      }
    }
    const Value pics_v = lfw::field_or(top, u"pics");
    if (const Array* const pics = lfw::as_array(pics_v)) {
      for (std::size_t i = 0; i < pics->size(); ++i) {
        const Value& one = pics->at(i);
        const std::string tex = str_or(lfw::field_or(one, u"tex"), "");
        if (tex.empty()) continue;
        const double pw = num_or(one, u"w");
        // 每层可用 `cx/cy` 覆盖锚点（TS `EntityMainRender.render` 的 `pics` 循环）。
        const Value cx_v = lfw::field_or(one, u"cx");
        const double anchor_x =
            (std::holds_alternative<std::monostate>(cx_v) ||
             std::holds_alternative<NullTag>(cx_v))
                ? base_anchor_x
                : (e.facing == 1.0 ? -num_at(cx_v) : num_at(cx_v) - pw);
        const Value cy_v = lfw::field_or(one, u"cy");
        const double anchor_y =
            (std::holds_alternative<std::monostate>(cy_v) ||
             std::holds_alternative<NullTag>(cy_v))
                ? centery
                : num_at(cy_v);
        const Resolved& res = resolve_key(e, tex, e.variant);
        emit_sprite(frame, e, one, live->rx, live->ry, anchor_x + shaking_x, anchor_y, res,
                    "entity");
        ++drawn;
      }
    }
    if (drawn > 0) {
      ++frame.drawn_entities;
    } else if (had_tex) {
      ++frame.no_file_entities;  // 有素材键但没解出文件（素材表里没这个键 / 包里没这张图）
    } else if (!missing(lfw::field_or(top, u"model"))) {
      // 只有 3D 模型帧（书类武器就是这样）：不算"没有 2D 精灵"，模型项在下面单独出。
      ++frame.drawn_entities;
    } else {
      ++frame.no_pic_entities;  // 这一帧根本没有 2D 精灵（例如纯 3D 模型帧）
    }
    // `frame.model`：与 2D 精灵**共存**（TS 的 `frame` 可以同时有 `pic` 和 `model`）。
    const Value model_v = lfw::field_or(top, u"model");
    if (!missing(model_v)) {
      emit_model(frame, e, model_v, live->rx, live->ry, shaking_x);
    }
  }

  // ---- 6) 前景层（`z > 0` 那些）----
  build_background(world, frame, /*foreground=*/true);

  _dirty = false;
  _pending = std::move(frame);
}

const GodotFrame& GodotWorldRenderer::take_frame() {
  if (_pending.valid) {
    _shown = std::move(_pending);
    _pending = GodotFrame{};
  }
  return _shown;
}

}  // namespace lfw::host
