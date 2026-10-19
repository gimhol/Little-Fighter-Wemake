#include "lfw/ui/component/tests/director_test_case.h"

#include "lfw/ui/component/tests/tests.h"

#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace ui {

// TS：`super(owner)` → `this.data = data` → `this.playback = new Director(owner.world, data)`
// → `this.name = data.name`。⚠ `_playback` 在成员初始化列表里构造（`Director(World&, Value)`），
// 所以 `world` 从 `owner` 取（`TestCase::owner` 是基类成员，构造期已就绪）。
DirectorTestCase::DirectorTestCase(Tests& owner_in, Value data_in)
    : TestCase(owner_in),
      _data(std::move(data_in)),
      _playback(owner_in.world(), _data) {
  // TS `this.name = data.name`（`name` 在端口是 `std::optional<std::u16string>`）。
  const Value data_name = field_or(_data, u"name");
  if (const std::u16string* const s = std::get_if<std::u16string>(&data_name)) name = *s;
}

DirectorTestCase::~DirectorTestCase() = default;

void DirectorTestCase::enter() { playback().start(); }

std::optional<Value> DirectorTestCase::update(double dt) {
  playback().update(dt);
  return std::nullopt;
}

void DirectorTestCase::leave() {
  playback().stop();
  TestCase::leave();
}

}
}
