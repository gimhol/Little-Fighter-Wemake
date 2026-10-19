#include "lfw/entity/gen_field.h"

#include <cmath>
#include <limits>
#include <map>
#include <memory>
#include <utility>
#include <vector>

#include "lfw/base/val_expression.h"
#include "lfw/entity/entity_type_check.h"
#include "lfw/state/spawn_ice_piece.h"

namespace lfw {
namespace {

// `ValExpression` 的 Ctx —— TS 的 `.get(emitter)` 在表达式里用到的那两面：
//   * `DEFAULT_VARS` 的 `w/h/cx/cy` 读**发射者当前帧**；
//   * `rand/pick/bag/flip` 落到世界那台 `mt`（并且写 `mark` = 字段名）。
// 帧缺字段时 TS 拿到 `undefined` ⇒ 参与算术变 `NaN`，这里同样回 `NaN`。
struct GenCtx {
  const Value* frame = nullptr;
  MersenneTwister* mt_ptr = nullptr;

  double frame_var(const std::u16string& name) const {
    const Object* const o = as_object(*frame);
    if (o == nullptr) return std::numeric_limits<double>::quiet_NaN();
    const Value* const v = o->get(name);
    if (v == nullptr) return std::numeric_limits<double>::quiet_NaN();
    const double* const d = std::get_if<double>(v);
    return d != nullptr ? *d : std::numeric_limits<double>::quiet_NaN();
  }

  MersenneTwister& mt() const { return *mt_ptr; }
};

struct ClosureSlot {
  std::shared_ptr<Object> keep;  // 防地址复用：登记过的对象不会被释放
  GenClosure kind = GenClosure::IcePiece;
};

std::map<const Object*, ClosureSlot>& closure_registry() {
  static std::map<const Object*, ClosureSlot> kRegistry;
  return kRegistry;
}

// `gen_*` 源表达式的编译缓存：键是 (对象地址, `__gen_*` 名)，值里带**源文本**做校验 ——
// 地址被复用时文本不同就会重编译（文本相同 ⇒ 表达式相同，缓存依旧成立）。
struct CachedExpr {
  std::u16string text;
  ValExpression<GenCtx> expr;
};

std::map<std::pair<const Object*, std::u16string>, CachedExpr>& expr_cache() {
  static std::map<std::pair<const Object*, std::u16string>, CachedExpr> kCache;
  return kCache;
}

GenFieldStats& mutable_stats() {
  static GenFieldStats kStats;
  return kStats;
}

// 发射者快照（TS 的闭包签名是 `.get(e)`：冰片那四个读 `e.frame`，开头还有
// `is_object(e)` = `is_object_data(e.data)` 的守卫 ⇒ `data` 必须一起带上）。
Value emitter_snapshot(const Value& emitter_frame, const Value& emitter_data) {
  auto o = std::make_shared<Object>();
  o->set(u"frame", emitter_frame);
  o->set(u"data", emitter_data);
  return Value(std::move(o));
}

// 侧表里的闭包：`nullopt` = 这个口味不提供该字段（⇒ 继续走表达式分支）。
std::optional<Value> eval_closure(GenClosure kind, const std::u16string& field,
                                  const Value& emitter_frame, const Value& emitter_data,
                                  MersenneTwister& mt) {
  if (kind == GenClosure::BuringSmokeAction) {
    if (field != u"__gen_facing") return std::nullopt;
    // TS: `is_object(e) ? e.lfw.mt.pick([-1, 1]) ?? 0 : 0` —— 不是实体就**不抽**。
    if (!entity::is_object(emitter_snapshot(emitter_frame, emitter_data))) return Value(0.0);
    const std::optional<double> got = mt.pick(std::vector<double>{-1.0, 1.0});
    return Value(got.has_value() ? *got : 0.0);
  }
  const Value emitter = emitter_snapshot(emitter_frame, emitter_data);
  if (field == u"__gen_dvx") return state::ice_piece_dvx(emitter, mt);
  if (field == u"__gen_dvy") return state::ice_piece_dvy(emitter, mt);
  if (field == u"__gen_x") return state::ice_piece_x(emitter, mt);
  if (field == u"__gen_y") return state::ice_piece_y(emitter, mt);
  return std::nullopt;
}

}

void register_gen_closure(const Value& holder, GenClosure kind) {
  const std::shared_ptr<Object>* const keep = std::get_if<std::shared_ptr<Object>>(&holder);
  if (keep == nullptr || *keep == nullptr) return;
  closure_registry()[keep->get()] = ClosureSlot{*keep, kind};
}

std::optional<Value> gen_field_eval(const Value& holder, const std::u16string& kind,
                                    const Value& emitter_frame, const Value& emitter_data,
                                    MersenneTwister& mt) {
  GenFieldStats& stats = mutable_stats();
  ++stats.calls;
  const Object* const holder_obj = as_object(holder);
  if (holder_obj == nullptr) return std::nullopt;

  const auto& registry = closure_registry();
  const auto found = registry.find(holder_obj);
  if (found != registry.end()) {
    const std::optional<Value> got =
        eval_closure(found->second.kind, kind, emitter_frame, emitter_data, mt);
    if (got.has_value()) {
      ++stats.resolved;
      ++stats.closures;
      return got;
    }
    return std::nullopt;  // 闭包型对象只有那几个字段，别再去碰 `gen_*`
  }

  // `__gen_*` ← 同名 `gen_*` 源表达式（TS `preprocess_opoint` 的编译结果）。
  if (kind.size() <= 2 || kind[0] != u'_' || kind[1] != u'_') return std::nullopt;
  const std::u16string source_field = kind.substr(2);
  const Value* const source = holder_obj->get(source_field);
  if (source == nullptr) return std::nullopt;
  const std::u16string* const text = std::get_if<std::u16string>(source);
  if (text == nullptr || text->empty()) return std::nullopt;

  const std::pair<const Object*, std::u16string> key{holder_obj, kind};
  auto& cache = expr_cache();
  auto cached = cache.find(key);
  if (cached == cache.end() || cached->second.text != *text) {
    if (cache.size() >= 4096) cache.clear();
    ValExpressionOptions<GenCtx> options;
    options.tag = source_field;
    CachedExpr entry;
    entry.text = *text;
    entry.expr = ValExpression<GenCtx>(*text, options);
    cached = cache.insert_or_assign(key, std::move(entry)).first;
  }
  if (cached->second.expr.has_err) return std::nullopt;

  const GenCtx ctx{&emitter_frame, &mt};
  ++stats.resolved;
  return Value(cached->second.expr.get(ctx));
}

const GenFieldStats& gen_field_stats() { return mutable_stats(); }

}
