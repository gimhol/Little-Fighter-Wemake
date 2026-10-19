#include "lfw_godot_font.h"

#include <godot_cpp/classes/os.hpp>
#include <godot_cpp/classes/system_font.hpp>
#include <godot_cpp/variant/packed_string_array.hpp>
#include <godot_cpp/variant/string.hpp>

#include <cctype>
#include <cstdlib>

namespace lfw::host {
namespace {

std::string lower(std::string s) {
  for (char& c : s) c = static_cast<char>(std::tolower(static_cast<unsigned char>(c)));
  return s;
}

std::string trim(const std::string& s) {
  std::size_t b = 0;
  std::size_t e = s.size();
  while (b < e && std::isspace(static_cast<unsigned char>(s[b])) != 0) ++b;
  while (e > b && std::isspace(static_cast<unsigned char>(s[e - 1])) != 0) --e;
  return s.substr(b, e - b);
}

bool has_word(const std::string& haystack, const char* word) {
  const std::string w(word);
  std::size_t at = haystack.find(w);
  while (at != std::string::npos) {
    const bool lb = at == 0 || std::isspace(static_cast<unsigned char>(haystack[at - 1])) != 0;
    const std::size_t end = at + w.size();
    const bool rb = end >= haystack.size() ||
                    std::isspace(static_cast<unsigned char>(haystack[end])) != 0;
    if (lb && rb) return true;
    at = haystack.find(w, at + 1);
  }
  return false;
}

}  // namespace

std::string CssFont::key() const {
  return (family.empty() ? std::string("-") : family) + "|" + std::to_string(weight) +
         (italic ? "|i" : "|u");
}

CssFont parse_css_font(const std::string& css) {
  CssFont ret;
  // 1) `NNpx`（CSS 简写里字号必带单位；数据里都是 `px`）。取**第一个** `px` 之前的数字。
  std::size_t px = css.find("px");
  if (px != std::string::npos) {
    std::size_t b = px;
    while (b > 0 && (std::isdigit(static_cast<unsigned char>(css[b - 1])) != 0 ||
                     css[b - 1] == '.')) {
      --b;
    }
    if (b < px) {
      const double n = std::strtod(css.substr(b, px - b).c_str(), nullptr);
      if (n > 0.0) ret.size_px = static_cast<int>(n);
    }
  }
  // 2) 字号**之前**那段 = style/variant/weight/stretch。
  const std::string head = lower(px == std::string::npos ? css : css.substr(0, px));
  if (has_word(head, "bold") || has_word(head, "bolder")) ret.weight = 700;
  for (int w = 700; w <= 900; w += 100) {
    if (head.find(std::to_string(w)) != std::string::npos) ret.weight = w;
  }
  if (has_word(head, "medium")) ret.weight = 500;
  if (has_word(head, "light")) ret.weight = 300;
  if (has_word(head, "thin") || has_word(head, "hairline")) ret.weight = 100;
  ret.italic = has_word(head, "italic") || has_word(head, "oblique");
  // 3) 字号**之后**那段 = 字族表：取第一个（逗号前的），去引号。
  if (px == std::string::npos) return ret;
  std::size_t fam = px + 2;
  while (fam < css.size() && std::isspace(static_cast<unsigned char>(css[fam])) != 0) ++fam;
  std::string list = css.substr(fam);
  const std::size_t comma = list.find(',');
  if (comma != std::string::npos) list = list.substr(0, comma);
  list = trim(list);
  if (list.size() >= 2 && (list.front() == '"' || list.front() == '\'') &&
      list.back() == list.front()) {
    list = list.substr(1, list.size() - 2);
  }
  list = trim(list);
  // 4) 字族名后缀里的字重：`Arial Black` / `Segoe UI Semibold` 这类。
  // ⚠ Windows 上 `Arial Black` 不是**独立字族**（DirectWrite 把它归到 `Arial` + Black 字重）
  // ⇒ 引擎按字族名找**找不到**（`OS::get_system_font_path("Arial Black")` 给空串），
  // 而浏览器能直接解析。拆成「基名 + 字重」两边都通 —— `prel.zip` 的 `ui/*.ui.json5`
  // 里 `gogogo` / `char_menu` 那一批标题就是 `Arial Black`。
  const std::size_t sp = list.rfind(' ');
  if (sp != std::string::npos) {
    const std::string tail = lower(list.substr(sp + 1));
    int w = 0;
    if (tail == "black" || tail == "heavy" || tail == "extrabold" || tail == "ultrabold") w = 900;
    else if (tail == "semibold" || tail == "demibold") w = 600;
    else if (tail == "bold") w = 700;
    else if (tail == "medium") w = 500;
    else if (tail == "light") w = 300;
    else if (tail == "thin" || tail == "hairline") w = 100;
    if (w > 0) {
      list = trim(list.substr(0, sp));
      if (w > ret.weight) ret.weight = w;
    }
  }
  ret.family = list;
  return ret;
}

void FontCache::set_fallback(godot::Ref<godot::Font> fallback) {
  _fallback = fallback;
  _resolved.clear();
  _missed.clear();
}

godot::Ref<godot::Font> FontCache::get(const CssFont& spec) {
  if (spec.family.empty()) return _fallback;
  const std::string key = spec.key();
  const auto hit = _resolved.find(key);
  if (hit != _resolved.end()) return hit->second;

  godot::Ref<godot::SystemFont> sf;
  sf.instantiate();
  godot::PackedStringArray names;
  names.push_back(godot::String::utf8(spec.family.c_str()));
  sf->set_font_names(names);
  sf->set_font_weight(spec.weight);
  sf->set_font_italic(spec.italic);
  // `SystemFont` 解析不到字族时会**静默**落回引擎的 fallback 字体 ⇒ 得单独问引擎"这个字族在不在"
  // （`OS::get_system_font_path` 给空串 = 没有），免得把落回当成"解析成功"、让证据行说谎。
  const godot::String path = godot::OS::get_singleton()->get_system_font_path(
      godot::String::utf8(spec.family.c_str()), spec.weight, 100, spec.italic);
  const bool ok = !path.is_empty();

  godot::Ref<godot::Font> ret = _fallback;
  if (ok) ret = sf;
  else _missed.push_back(key);
  _resolved.emplace(key, ret);
  return ret;
}

std::string FontCache::describe() const {
  std::string out;
  for (const auto& kv : _resolved) {
    if (!out.empty()) out += ", ";
    out += kv.first + " -> ";
    if (kv.second.is_null()) {
      out += "<none>";
    } else {
      out += kv.second->get_font_name().utf8().get_data();
    }
  }
  return out.empty() ? "(还没量过文字)" : out;
}

}  // namespace lfw::host
