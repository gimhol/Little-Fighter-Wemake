#pragma once

#include <optional>
#include <string>

#include "lfw/core/value.h"
#include "lfw/utils/math/mersenne_twister.h"

namespace lfw {

// TS 的「生成器」是挂在**数据对象**上的函数对象：
//   * `opoint.__gen_dvx` / `__gen_x` / `__gen_spread_*` —— `preprocess_opoint` 把
//     `gen_dvx` 这类源表达式编译成 `ValExpression`（`.get(emitter)`）；
//   * `action.__gen_facing`（`make_buring_smoke`）、`spawn_ice_piece` 的四个 `__gen_*`
//     —— 手写闭包（要吃 `mt` / 帧尺寸，表达式表达不了）。
// `Value` 装不下函数（DESIGN §4.40）⇒ 端口用一张「对象地址 → 口味」的侧表代替，
// 表项**持有对象本身**（`shared_ptr`）：登记过的对象不会被释放，地址也就不会被复用，
// 查表不会串味。
enum class GenClosure {
  // `state::spawn_ice_piece`：`__gen_dvx` / `__gen_dvy` / `__gen_x` / `__gen_y`
  IcePiece,
  // `dat_translator::make_buring_smoke`：`action.__gen_facing`
  BuringSmokeAction,
};

// 登记（`holder` 必须是 object；同一对象重复登记是幂等的）。
void register_gen_closure(const Value& holder, GenClosure kind);

// TS `Entity::gen_or(holder, "__gen_*", fallback)` 的一次求值：
//   1. 侧表里的闭包（只认自己提供的字段，其余落空）；
//   2. `__gen_*` → 同名 `gen_*` 源表达式，用**发射者当前帧**与世界的 `mt` 现编译求值
//      （TS 是在 `preprocess_opoint` 里编译，端口按需编译 —— 语义一致：解析失败的字段等同
//      没有该字段）。
// `nullopt` = 没有这个字段 ⇒ 调用方回落到 `opoint.dvx` / `opoint.x` 之类。
// `emitter_frame` / `emitter_data` 是发射者当前帧与数据（TS 的 `.get(emitter)` 会读
// `e.frame.width` 与 `e.data`：后者是那些闭包开头 `is_object(e)` 的判据）。
std::optional<Value> gen_field_eval(const Value& holder, const std::u16string& kind,
                                    const Value& emitter_frame, const Value& emitter_data,
                                    MersenneTwister& mt);

// 诊断计数（不进三条摘要）：调了几次、其中几次真给出值、几次走的是闭包侧表。
struct GenFieldStats {
  long long calls = 0;
  long long resolved = 0;
  long long closures = 0;
};

const GenFieldStats& gen_field_stats();

}
