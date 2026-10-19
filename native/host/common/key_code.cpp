#include "host/common/key_code.h"

#include <cctype>
#include <utility>
#include <vector>

#include "lfw/utils/utf8.h"

namespace lfw::host {

namespace {

// 别名 → DOM `KeyboardEvent.key`（小写）。表里只放「不好敲 / 有别的叫法」的那些：
// 单字符（`a` / `.` / `;`）与已经与 DOM 同名的（`arrowleft` / `enter` / `tab`）不必登记。
const std::vector<std::pair<const char*, const char*>>& alias_table() {
  static const std::vector<std::pair<const char*, const char*>> t = {
      {"space", " "},      {"spacebar", " "},  {"esc", "escape"},   {"return", "enter"},
      {"up", "arrowup"},   {"down", "arrowdown"}, {"left", "arrowleft"}, {"right", "arrowright"},
      {"del", "delete"},   {"ins", "insert"},  {"pgup", "pageup"},  {"pgdn", "pagedown"},
      {"page_up", "pageup"}, {"page_down", "pagedown"}, {"ctrl", "control"},
      {"cmd", "meta"},     {"win", "meta"},    {"meta_l", "meta"},  {"caps", "capslock"},
      {"back", "backspace"}, {"bksp", "backspace"}, {"menu", "contextmenu"},
  };
  return t;
}

}  // namespace

std::u16string dom_key_of_name(const std::string& name) {
  std::string lower;
  lower.reserve(name.size());
  for (const char c : name) lower.push_back(static_cast<char>(std::tolower(static_cast<unsigned char>(c))));
  for (const std::pair<const char*, const char*>& kv : alias_table()) {
    if (lower == kv.first) {
      const std::string value = kv.second;
      return decode_utf8(std::vector<uint8_t>(value.begin(), value.end()));
    }
  }
  return decode_utf8(std::vector<uint8_t>(lower.begin(), lower.end()));
}

}  // namespace lfw::host
