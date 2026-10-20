#include "host/godot/lfw_godot_textures.h"

#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstring>
#include <utility>

#include <godot_cpp/classes/image.hpp>
#include <godot_cpp/variant/packed_byte_array.hpp>
#include <godot_cpp/variant/string.hpp>

namespace lfw::host {

namespace {

double clamp01(double v) { return v < 0.0 ? 0.0 : (v > 1.0 ? 1.0 : v); }

godot::PackedByteArray to_bytes(const std::string& raw) {
  godot::PackedByteArray out;
  if (raw.empty()) return out;
  out.resize(static_cast<int64_t>(raw.size()));
  std::memcpy(out.ptrw(), raw.data(), raw.size());
  return out;
}

}  // namespace

godot::Ref<godot::Image> GodotTextureCache::read_image(const std::string& path, std::string& err) {
  std::string raw;
  if (!_load(path, raw)) {
    err = "read failed: " + path;
    return {};
  }
  godot::Ref<godot::Image> image;
  image.instantiate();
  // 引擎自己的解码器：只吃 PNG（包里的图片全是 PNG，webp 一张都没有）。
  const godot::Error code = image->load_png_from_buffer(to_bytes(raw));
  if (code != godot::OK) {
    err = "png decode failed (" + std::to_string(static_cast<int>(code)) + "): " + path;
    return {};
  }
  return image;
}

godot::Ref<godot::ImageTexture> GodotTextureCache::get(const std::string& path) {
  if (path.empty()) return {};
  const auto found = _cache.find(path);
  if (found != _cache.end()) return found->second;

  godot::Ref<godot::ImageTexture> tex;
  std::string err;
  const godot::Ref<godot::Image> image = read_image(path, err);
  if (image.is_null()) {
    ++_failed;
    _last_error = err;
  } else {
    tex = godot::ImageTexture::create_from_image(image);
    if (tex.is_null()) {
      ++_failed;
      _last_error = "texture create failed: " + path;
    } else {
      ++_loaded;
    }
  }
  _cache.emplace(path, tex);
  return tex;
}

godot::Ref<godot::ImageTexture> GodotTextureCache::get_silhouette(const std::string& path) {
  if (path.empty()) return {};
  const auto found = _sil.find(path);
  if (found != _sil.end()) return found->second;

  godot::Ref<godot::ImageTexture> tex;
  std::string err;
  const godot::Ref<godot::Image> image = read_image(path, err);
  if (image.is_null()) {
    _last_error = err;
  } else {
    const int32_t w = image->get_width();
    const int32_t h = image->get_height();
    // 统一成 RGBA8 再逐像素改：`convert()` 改的是我们自己刚解出来的那份 `Image`（与主纹理那份
    // 不是同一个实例），所以不影响原图。
    image->convert(godot::Image::FORMAT_RGBA8);
    godot::PackedByteArray data = image->get_data();
    const int64_t pixels = static_cast<int64_t>(w) * static_cast<int64_t>(h);
    if (w > 0 && h > 0 && data.size() == pixels * 4) {
      std::uint8_t* const bytes = data.ptrw();
      for (int64_t i = 0; i < pixels; ++i) {
        std::uint8_t* const px = bytes + i * 4;
        px[0] = 255;
        px[1] = 255;
        px[2] = 255;
        px[3] = px[3] >= 128 ? 255 : 0;
      }
      const godot::Ref<godot::Image> sil = godot::Image::create_from_data(
          w, h, false, godot::Image::FORMAT_RGBA8, data);
      if (!sil.is_null()) tex = godot::ImageTexture::create_from_image(sil);
    }
    if (tex.is_null()) _last_error = "silhouette failed: " + path;
    else ++_silhouettes;
  }
  _sil.emplace(path, tex);
  return tex;
}

godot::Ref<godot::ImageTexture> GodotTextureCache::get_tinted(const std::string& path, double r,
                                                             double g, double b, double gray,
                                                             double strength) {
  if (path.empty()) return {};
  char key[768];
  std::snprintf(key, sizeof(key), "%s|%.3f,%.3f,%.3f|%.3f|%.3f", path.c_str(), r, g, b, gray,
                strength);
  const std::string cache_key(key);
  const auto found = _tint.find(cache_key);
  if (found != _tint.end()) return found->second.tex;

  godot::Ref<godot::ImageTexture> tex;
  std::string err;
  const godot::Ref<godot::Image> image = read_image(path, err);
  if (image.is_null()) {
    _last_error = err;
  } else {
    image->convert(godot::Image::FORMAT_RGBA8);
    const int32_t w = image->get_width();
    const int32_t h = image->get_height();
    godot::PackedByteArray data = image->get_data();
    const int64_t pixels = static_cast<int64_t>(w) * static_cast<int64_t>(h);
    if (w > 0 && h > 0 && data.size() == pixels * 4) {
      const double gr = gray < 0.0 ? 0.0 : (gray > 1.0 ? 1.0 : gray);
      const double ms = strength < 0.0 ? 0.0 : (strength > 1.0 ? 1.0 : strength);
      const auto to_byte = [](double v) {
        return static_cast<std::uint8_t>(std::lround(clamp01(v) * 255.0));
      };
      const double tr = clamp01(r);
      const double tg = clamp01(g);
      const double tb = clamp01(b);
      std::uint8_t* const bytes = data.ptrw();
      for (int64_t i = 0; i < pixels; ++i) {
        std::uint8_t* const px = bytes + i * 4;
        if (px[3] == 0) continue;
        double cr = static_cast<double>(px[0]) / 255.0;
        double cg = static_cast<double>(px[1]) / 255.0;
        double cb = static_cast<double>(px[2]) / 255.0;
        if (gr > 0.0) {
          const double lum = 0.299 * cr + 0.587 * cg + 0.114 * cb;
          cr += (lum - cr) * gr;
          cg += (lum - cg) * gr;
          cb += (lum - cb) * gr;
        }
        if (ms > 0.0) {
          cr += (tr - cr) * ms;
          cg += (tg - cg) * ms;
          cb += (tb - cb) * ms;
        }
        px[0] = to_byte(cr);
        px[1] = to_byte(cg);
        px[2] = to_byte(cb);
      }
      const godot::Ref<godot::Image> baked =
          godot::Image::create_from_data(w, h, false, godot::Image::FORMAT_RGBA8, data);
      if (!baked.is_null()) tex = godot::ImageTexture::create_from_image(baked);
    }
    if (tex.is_null()) _last_error = "tint failed: " + path;
    else ++_tinted;
  }
  if (_tint.size() >= kMaxTinted) {
    auto oldest = _tint.begin();
    for (auto it = _tint.begin(); it != _tint.end(); ++it) {
      if (it->second.seq < oldest->second.seq) oldest = it;
    }
    _tint.erase(oldest);
  }
  _tint.emplace(cache_key, Tinted{tex, ++_tint_seq});
  return tex;
}

}  // namespace lfw::host
