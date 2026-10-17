#pragma once

#include <functional>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "lfw/core/value.h"
#include "lfw/helper/randoming.h"

namespace lfw {

class LFW;

class MersenneTwister;
class Resources;

namespace loader {

// TS `DatMgr` 直接拿整个 `LFW`（`lfw.resources` / `lfw.images` / `lfw.mt` /
// `lfw.emit_progress`）与全局 `Ditto.warn/error` 用 ⇒ 端口收成一个宿主缝。
// 台面假件与将来的 `LFW` 都实现它。
// `DatMgr` 的宿主（切片 4CQ：`IDatMgrHost` 退役）。它要的 6 条面（`resources` / `mt_ref` /
// `load_img` / `emit_progress` / `warn` / `error`）在 `LFW` 上都有实现 —— 那层缝的开口理由
// 「`LFW` 未移植」早已不成立 ⇒ 直接持 `LFW*`。

// TS `loader/DatMgr.ts`（`DatMgr` + `Inner`）。数据对象都是 JSON 形态 ⇒ 端口一律用
// `Value`（列表 = `std::vector<Value>`，`Map` = 插入序的 pair 表，见 `factory.cpp` 的
// 同一套约定）。
//
// 与 TS 的差异（记 README 偏差表）：
//   * `load()` 是 `async` 的（`throw` ⇒ `false` + `error`，文案 = TS `err.message`）；
//   * `_add_object` / `_add_bg` 里给数据对象挂的 `xml` / `xml_roundtrip` /
//     `xml_roundtrip_ok` 三个 defineProperty 访问器**不建形**（`Value` 没有 getter；
//     它们只服务编辑器 / 开发向的取用）；
//   * `this.stages[idx] = stage` 在 `idx < 0` 时是「往数组上挂 `-1` 属性」（数组内容
//     不变）⇒ 端口跳过这一写；
//   * 端口没有 `Entity` 的 `env` 语义之外的东西：`Factory.register_ctrl` 注册的
//     `ICtrlCreator` 只落 `player_id`（见 `controller/creators.h`）。
class DatMgr {
 public:
  static constexpr const char* kTag = "DatMgr";

  // TS 里 `find_*` 的谓词重载：`(value, index, obj) => unknown`（`Array.find` 带上
  // 三个参数的形态；返回真值即命中）。
  using FindPredicate =
      std::function<bool(const Value& value, double index, const std::vector<Value>& arr)>;

  explicit DatMgr(LFW* host);

  int inner_id() const { return _inner_id; }

  bool load(const std::vector<std::u16string>& index_files, std::u16string& error);
  void dispose();
  void clear();

  const std::vector<Value>& bots() const;
  const std::vector<Value>& moves() const;
  const std::vector<Value>& objects() const;
  const std::vector<Value>& fighters() const;
  const std::vector<Value>& weapons() const;
  const std::vector<Value>& balls() const;
  const std::vector<Value>& entities() const;
  const std::vector<Value>& backgrounds() const;
  const std::vector<Value>& stages() const;

  // `get directors`（4CJ）：`IDirectorGroupData[]` —— `{ id, file, name?, directors: IDirectorData[] }`。
  const std::vector<Value>& directors() const;
  // `find_director(id)`：`v.id === id || v.file === id`。
  const Value* find_director(const Value& id) const;

  // `find(id)`：先查别名表、再查 id 表（`??` 语义：别名表没命中才落到 id 表）。
  const Value* find(const Value& id) const;
  const Value* find_bot(const Value& id) const;
  const Value* find_moves(const Value& id) const;

  Randoming::Ptr get_randoming_by_group(const std::u16string& group);

  const Value* find_weapon(const Value& id) const;
  const Value* find_weapon(const FindPredicate& predicate) const;
  const Value* find_entity(const Value& id) const;
  const Value* find_entity(const FindPredicate& predicate) const;
  const Value* find_object(const Value& id) const;
  const Value* find_object(const FindPredicate& predicate) const;
  const Value* find_fighter(const Value& id) const;
  const Value* find_fighter(const FindPredicate& predicate) const;
  const Value* find_background(const Value& id) const;
  const Value* find_background(const FindPredicate& predicate) const;

  std::vector<Value> get_objects_of_group(const std::u16string& group) const;
  std::vector<Value> get_fighters_of_group(const std::u16string& group) const;
  std::vector<Value> get_weapons_of_group(const std::u16string& group) const;
  std::vector<Value> get_fighters_not_in_group(const std::u16string& group) const;
  std::vector<Value> get_backgrouds_of_group(const std::u16string& group) const;

  Randoming::Ptr get_bg_randoming_of_group(const std::vector<std::u16string>& groups);
  Value get_random_bg(const std::vector<std::u16string>& groups);

 private:
  struct Inner;

  LFW* _host = nullptr;
  int _inner_id = 0;
  std::shared_ptr<Inner> _inner;
};

}
}
