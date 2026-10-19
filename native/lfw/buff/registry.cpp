#include "lfw/buff/registry.h"

#include <string>
#include <type_traits>
#include <vector>

#include "lfw/buff/buff_electrify.h"
#include "lfw/buff/buff_electroshock.h"
#include "lfw/buff/buff_group_attack.h"
#include "lfw/buff/buff_healing.h"
#include "lfw/buff/buff_magic_flute.h"
#include "lfw/buff/buff_mp_healing.h"
#include "lfw/factory.h"

namespace lfw {
namespace buff {
namespace {

// TS 的 `IInstCls`：类上带 `KIND` / `GROUPS`，构造是 `new B(lfw, id, B.KIND)`。
template <typename B>
Value kind_value() {
  if constexpr (std::is_same_v<std::decay_t<decltype(B::KIND)>, const char16_t*>) {
    return Value(std::u16string(B::KIND));
  } else {
    return Value(static_cast<double>(B::KIND));
  }
}

template <typename B>
const std::vector<Value>& groups_value() {
  static const std::vector<Value> out = [] {
    std::vector<Value> ret;
    if constexpr (requires { B::GROUPS(); }) {
      for (const std::u16string& g : B::GROUPS()) ret.push_back(Value(g));
    }
    return ret;
  }();
  return out;
}

template <typename B>
class BuffCreator : public IBuffCreator {
 public:
  const Value& kind() const override {
    static const Value k = kind_value<B>();
    return k;
  }
  const std::vector<Value>& groups() const override { return groups_value<B>(); }
  Buff* create(LFW* lfw, const std::u16string& id, const Value& kind) const override {
    if (lfw == nullptr) return nullptr;
    return new B(*lfw, id, kind);
  }
};

}  // namespace

void regist_buffs() {
  static bool registed = false;
  if (registed) return;
  registed = true;
  static const BuffCreator<Buff_MagicFlute> magic_flute;
  static const BuffCreator<Buff_MagicFlute2> magic_flute2;
  static const BuffCreator<Buff_Electroshock> electroshock;
  static const BuffCreator<Buff_GroupAttack> group_attack;
  static const BuffCreator<Buff_Healing> healing;
  static const BuffCreator<Buff_MpHealing> mp_healing;
  static const BuffCreator<Buff_Electrify> electrify;
  Factory::register_buff(&magic_flute);
  Factory::register_buff(&magic_flute2);
  Factory::register_buff(&electroshock);
  Factory::register_buff(&group_attack);
  Factory::register_buff(&healing);
  Factory::register_buff(&mp_healing);
  Factory::register_buff(&electrify);
}

}  // namespace buff
}  // namespace lfw
