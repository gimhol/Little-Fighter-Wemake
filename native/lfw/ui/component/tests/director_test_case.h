#pragma once

#include "lfw/core/value.h"
#include "lfw/director/director.h"
#include "lfw/ui/component/tests/test_case.h"

namespace lfw {
namespace ui {

// Mirrors `src/LFW/ui/component/Tests/DirectorTestCase.ts`（4CJ）：
// 数据驱动用例 —— 一个 `DirectorTestCase` 就是一份 `IDirectorData`，`enter` 起播、
// `update` 推进、`leave` 收摊；页面标题取数据的 `name`。
class DirectorTestCase : public TestCase {
 public:
  DirectorTestCase(Tests& owner, Value data);
  ~DirectorTestCase() override;

  std::optional<Value> update(double dt) override;
  void enter() override;
  void leave() override;

  const Value& data() const { return _data; }
  director::Director& playback() { return _playback; }

 private:
  Value _data;
  director::Director _playback;
};

}
}
