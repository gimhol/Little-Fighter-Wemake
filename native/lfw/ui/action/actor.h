#pragma once

#include <functional>
#include <map>
#include <string>
#include <vector>

#include "lfw/core/value.h"

namespace lfw::ui {

class UINode;

// TS `ui/action/Actor.ts` 的 `UIActor`（单例 `actor` 对应 `ui::actor()`）。
//
// TS 的 handler 收 `(layout, ...args: string[])`；端口统一成 `(node, args)`。
class UIActor {
 public:
  static constexpr const char* TAG = "Actor";

  using Handler = std::function<void(UINode&, const std::vector<Value>&)>;

  UIActor();

  UIActor& add(const std::u16string& key, Handler handler);

  // `act(layout, action)`：`undefined/null/假值` 直返；数组逐个；对象取 `{name, args}`。
  // 未命中 handler ⇒ `Ditto.warn`（宿主 `warn` 缝），文案照抄 TS。
  void act(UINode& node, const Value& action);

 private:
  std::map<std::u16string, Handler> _map;
};

UIActor& actor();

}  // namespace lfw::ui
