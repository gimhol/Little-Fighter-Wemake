// 资源路径 → `ImageTexture` 的缓存（Godot 宿主侧）。
//
// 这一层是 DESIGN「宿主负责图片解码」那一条的落地：核心只给**素材键 + 裁剪矩形**（契约 D2），
// 把键解析成资源路径、把路径读成字节、把字节解码成像素，全在宿主。字节来自
// `GodotWorldRenderer::read_resource`（已加载的数据包 → `--root` 根目录），解码交给引擎自己的
// PNG 解码器（`Image::load_png_from_buffer`）—— 这两条都不需要核心加缝。
//
// 失败的键**也缓存**（空引用）：一张取不到的图不该每帧重试一次磁盘。
//
// 另有「剪影」缓存（`get_silhouette`）：描边要的是**纯色**轮廓，而 `modulate` 是乘性的 ⇒ 直接拿
// 原图叠会把描边色乘进纹理色（偏暗/染色）。剪影把 RGB 刷白、alpha 二值化，乘上描边色就是纯色。
#pragma once

#include <functional>
#include <map>
#include <string>

#include <godot_cpp/classes/image.hpp>
#include <godot_cpp/classes/image_texture.hpp>

namespace lfw::host {

class GodotTextureCache {
 public:
  // `load`：条目名（`/` 分隔）→ 字节。宿主注入（真源是数据包 / 根目录）。
  explicit GodotTextureCache(std::function<bool(const std::string&, std::string&)> load)
      : _load(std::move(load)) {}

  // 命中缓存或加载成功 ⇒ 非空；失败 ⇒ 空引用。
  godot::Ref<godot::ImageTexture> get(const std::string& path);

  // 描边用的「剪影」纹理：同尺寸、RGB 全白、A 二值化（源 alpha ≥ 0.5 ⇒ 255，否则 0）。
  // 宿主拿它沿偏移画几遍、`modulate` = 描边色 ⇒ **纯色**轮廓（TS `outline.frag` 的判据就是
  // `center < 0.5` 且四邻有 ≥ 0.5）。按 path 单独缓存；失败同样是空引用。
  godot::Ref<godot::ImageTexture> get_silhouette(const std::string& path);

  long long loaded() const { return _loaded; }
  long long failed() const { return _failed; }
  long long silhouettes() const { return _silhouettes; }
  const std::string& last_error() const { return _last_error; }

 private:
  // PNG 字节 → `Image`（`_load` + 引擎解码；失败时 `err` 里是原因）。
  godot::Ref<godot::Image> read_image(const std::string& path, std::string& err);

  std::function<bool(const std::string&, std::string&)> _load;
  std::map<std::string, godot::Ref<godot::ImageTexture>> _cache;
  std::map<std::string, godot::Ref<godot::ImageTexture>> _sil;
  long long _loaded = 0;
  long long _failed = 0;
  long long _silhouettes = 0;
  std::string _last_error;
};

}  // namespace lfw::host
