#pragma once

#include <optional>
#include <string>
#include <vector>

#include "lfw/ditto/zip/i_zip_object.h"

namespace lfw {

// Mirrors `src/LFW/ditto/zip/IZip.ts` 里会用到的那部分（`name` / `md5` 与 `file` 的两个重载）。
// `files` / `set` / `blob` 这些重载随用到的刀再补。
//
// 注意：真实的 `IZip.file` 是纯查表、不会抛；端口不给抛错面（记在 README 偏差表里）。
class IZip {
 public:
  virtual ~IZip() = default;
  virtual const std::u16string& name() const = 0;
  // `zip.file(path)`：未命中 ⇒ `nullptr`（TS `null`）。
  virtual IZipObject* file(const std::u16string& path) = 0;
  // `zip.file(regex)`：对**条目名**做正则 test（模式是 JS 正则源码、无 flags），命中按包内顺序。
  virtual std::vector<IZipObject*> file_regex(const std::u16string& pattern) = 0;
  // TS 的可选字段 `zip.md5`（没给 ⇒ `nullopt`）。
  virtual std::optional<std::u16string> md5() const { return std::nullopt; }
};

// `zip.file(/.../)` 的匹配规则：JS 无锚点 `RegExp.test`（子串命中即可；`^`/`$` 自己写在模式里）。
// 端口只认移植触及的固定模式（`std::regex` 被 lint 禁、也没必要为 5 条模式引一个引擎）；
// 未登记的模式统一按「全串相等」处理（记 README 偏差表）。模式里只有 ASCII。
inline bool zip_name_matches(const std::u16string& name, const std::u16string& pattern) {
  const auto starts = [&name](const char16_t* const s) {
    const std::u16string p(s);
    return name.size() >= p.size() && name.compare(0, p.size(), p) == 0;
  };
  const auto ends = [&name](const char16_t* const s) {
    const std::u16string p(s);
    return name.size() >= p.size() && name.compare(name.size() - p.size(), p.size(), p) == 0;
  };
  // `/\\.(i18n|strings)\\.json5?$/`
  if (pattern == u"\\.(i18n|strings)\\.json5?$") {
    return ends(u".i18n.json") || ends(u".i18n.json5") || ends(u".strings.json") ||
           ends(u".strings.json5");
  }
  // `/\\.index\\.(json5|xml)$/`
  if (pattern == u"\\.index\\.(json5|xml)$") {
    return ends(u".index.json5") || ends(u".index.xml");
  }
  // `/bgm\/.*?\\.mp3$/`
  if (pattern == u"bgm\\/.*?\\.mp3$") {
    return starts(u"bgm/") && ends(u".mp3");
  }
  // `/^ui\/.*?\\.ui\\.(json5?|xml)$/`
  if (pattern == u"^ui\\/.*?\\.ui\\.(json5?|xml)$") {
    return starts(u"ui/") &&
           (ends(u".ui.json") || ends(u".ui.json5") || ends(u".ui.xml"));
  }
  return name == pattern;
}

}
