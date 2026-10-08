#pragma once

#include <functional>
#include <string>
#include <utility>

#include "lfw/core/value.h"
#include "lfw/utils/times.h"

namespace lfw {

class LFW;

namespace ui {

// TS `ui/UIImgLoader.ts`。`node` 是 TS 的 `() => UINode | null | undefined` 回调：端口收成
// `IUIImgLoaderNode*`（nullptr = null/undefined，错误文案固定写 `null`，记偏差）。
class IUIImgLoaderNode {
 public:
  virtual ~IUIImgLoaderNode() = default;
  // `node.lfw`（喂给 `ui_load_img`）
  virtual LFW& lfw() = 0;
  // `node.image = imgs`
  virtual void set_image(const Value& image) = 0;
  // `node.resize(w / scale, h / scale)`（参数已是除过的值）
  virtual void resize(double w, double h) = 0;
};

// TS 的 Promise 三态：`ok` / 普通拒绝 / `OutOfDateError`（带 `texture`）。
struct UIImgLoadResult {
  bool ok = false;
  bool out_of_date = false;  // `__is_out_of_date_error`
  Value texture;             // out-of-date 时带的图（可空）
  Value image;               // ok 时的 ImageInfo
  std::u16string error;      // 失败文本（out-of-date 时是 `out_of_date`）
};

class UIImgLoader {
 public:
  using NodeGetter = std::function<IUIImgLoaderNode*()>;

  explicit UIImgLoader(NodeGetter node) : _node(std::move(node)) {}

  // 端口同步：两次 `jid !== _jid.value` 比较只在宿主**重入**时才可能翻转（台面不脚本化），
  // 因此 out-of-date 分支仅保留形状（记偏差）。
  UIImgLoader& ignore_out_of_date();
  UIImgLoadResult load(const Value& uiimg);
  UIImgLoadResult set_img(const std::u16string& path);

  const Times& jid() const { return _jid; }

 private:
  NodeGetter _node;
  Times _jid;
};

}
}
