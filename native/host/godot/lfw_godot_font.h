// Godot 侧的**字体解析**：把 TS 的 CSS `font` 简写（`TextMesh` 直接把整串塞给 `ctx.font`，
// `TextMesh.ts:66`）翻成引擎的 `Font`。
//
// 为什么要它：切片早期这一份宿主只用 `ThemeDB::get_fallback_font()` 度量 + 绘制**所有**文字，
// 而浏览器是按 `style.font` 里的字族渲染的（数据里全是 `NNpx Arial` / `bold 18px Arial`）。
// 两者的字宽不同 ⇒ 同一段文字两边的**度量**不同（`auto_size_by_text` 定出来的节点尺寸跟着不同），
// 与 Web 版一比就能看出来（准备页的 "Press Attack to join!" 一边一行一边两行）。
//
// 取不到字族时落回引擎的 fallback 字体（与旧行为一致），所以这是**纯增益**的一层。
#pragma once

#include <godot_cpp/classes/font.hpp>
#include <map>
#include <string>
#include <vector>

namespace lfw::host {

// CSS `font` 简写里我们关心的几件事（其余如 `text-transform` 不在简写里）。
struct CssFont {
  std::string family;   // 去掉引号的字族名；空 = 没写（调用方按 `DEFAULT_FONT` 补 "Arial"）
  int size_px = 0;      // `NNpx` 里的 `NN`（可带小数，向下取整成整数）；0 = 没写
  int weight = 400;     // 字重：`bold`/`bolder`/`700`.. 或字族后缀（`Arial Black` ⇒ 900）
  bool italic = false;  // `italic` / `oblique`
  // 缓存键：`family|weight|italic`（字号不进键 —— 引擎的 `Font` 与字号无关）。
  std::string key() const;
};

CssFont parse_css_font(const std::string& css);

// 按字族挑字体并缓存。`SystemFont` 的解析由引擎做（各平台的系统字体），解析不到时它会退回引擎
// 的 fallback 字体 —— 那时我们按"没解析到"处理，直接用 fallback，避免每次绘制都新建对象。
class FontCache {
 public:
  // 落回用的字体（`ThemeDB::get_fallback_font()`；可能为空 = 没有可用字体）。
  void set_fallback(godot::Ref<godot::Font> fallback);
  const godot::Ref<godot::Font>& fallback() const { return _fallback; }

  // 字族解析成功 ⇒ 返回该字体的 `Ref`；否则返回 `_fallback`。
  godot::Ref<godot::Font> get(const CssFont& spec);

  // 已解析出的字族数（证据行用）。
  std::size_t resolved_count() const { return _resolved.size(); }
  // 已经试过但没解析到的字族（证据行用）。
  const std::vector<std::string>& missed() const { return _missed; }
  // 证据行：`<键> -> <引擎里真正拿到的字体名>`，用 `, ` 连起来。
  std::string describe() const;

 private:
  godot::Ref<godot::Font> _fallback;
  std::map<std::string, godot::Ref<godot::Font>> _resolved;
  std::vector<std::string> _missed;
};

}  // namespace lfw::host
