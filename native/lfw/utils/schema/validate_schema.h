#pragma once

#include <functional>
#include <string>
#include <vector>

#include "lfw/core/value.h"

namespace lfw {
namespace schema {

// 类类型标记：TS 的 schema `type` 可以是构造器（函数）；端口的数据 schema 装不下函数，
// 改用字符串 `$cls:<类名>`（`is_class_type` 判定）。校验分支与 `instance_getter` 的语义同 TS。
inline bool is_class_type(const Value& type) {
  const std::u16string* s = std::get_if<std::u16string>(&type);
  return s != nullptr && s->rfind(u"$cls:", 0) == 0;
}

inline std::u16string class_type_name(const Value& type) {
  const std::u16string* s = std::get_if<std::u16string>(&type);
  return s != nullptr && s->rfind(u"$cls:", 0) == 0 ? s->substr(5) : std::u16string();
}

// Mirrors `src/LFW/utils/schema/validate_schema.ts`（`SchemaValidator`）。
//
// 形状差异：
//   * TS 里 schema 是 `ISchema` 接口对象；端口把它当 **Value**（生成器 dump 的纯数据表，
//     见 `defines/schemas_gen.h`）——校验里对「对象/数组/字符串」的操作全部照抄。
//   * 类类型（`type` 是构造器/自定义类）在端口里用 `$cls:<类名>` 标记（见 `is_class_type`）；
//     `instance_getter` / `instance_setter` 钩子与 `Object.defineProperty` 惰性属性分支已建形
//     （后者落成 `DefinedInstance` 闭包数据 + `get_instance`/`set_instance`）。
//   * TS `errors` / `warnings` 是 protected 数组 + getter；端口同形（私有数组 + 访问器）。
//   * `validate` 会**就地**改 `value`（数组项/对象属性的浅拷贝写回、嵌套递归）——照抄。
class SchemaValidator {
 public:
  static SchemaValidator& Default();

  // 4AR：类类型（`$cls:` 标记）的惰性属性钩子（TS 的 `instance_getter/setter`）。
  // `clazz` 参数是去掉 `$cls:` 前缀后的类名。
  using InstanceGetter =
      std::function<Value(const Value& raw_value, const std::u16string& clazz,
                          const Value& prop_schema)>;
  using InstanceSetter =
      std::function<void(const Value& value, const Value& raw_value, const std::u16string& clazz,
                         const Value& prop_schema)>;

  SchemaValidator& instance_getter(InstanceGetter func);
  SchemaValidator& instance_setter(InstanceSetter func);
  bool has_instance_getter() const { return static_cast<bool>(_get_instance); }
  bool has_instance_setter() const { return static_cast<bool>(_set_instance); }

  // TS `Object.defineProperty` 的闭包数据（端口没属性的概念，取出即用）：
  // 对象属性与 TS 一样 `delete value[k]`；数组项保留元素。
  struct DefinedInstance {
    enum class Kind { ObjectProp, ArrayItem };
    Kind kind = Kind::ObjectProp;
    Value target;       // 被 defineProperty 的 `value`（对象 / 数组）
    std::u16string key;  // 对象键；数组下标字符串（"0"、"1"…）
    Value raw_value;     // defineProperty 时捕获的原始值
    Value schema;        // prop_schema
  };
  const std::vector<DefinedInstance>& defined_instances() const { return _defined; }
  void clear_defined_instances() { _defined.clear(); }

  // 惰性属性的读/写（TS getter/setter）：
  //   getter 缺失 ⇒ error `[SchemaValidator] instance_getter not set! <path>`；
  //   命中假值且 `nullable != false` ⇒ 拿 `z`（JS 的 null）；否则 error `<path> not found, value: <raw>`。
  struct InstanceAccess {
    bool ok = false;
    Value value;
    std::u16string error;
  };
  InstanceAccess get_instance(size_t index) const;
  // setter 缺失 ⇒ 返回 `[SchemaValidator] instance_setter not set! <path>`（空串 = 成功）。
  std::u16string set_instance(size_t index, const Value& v) const;

  const std::vector<std::u16string>& errors() const { return _errors; }
  const std::vector<std::u16string>& warnings() const { return _warnings; }

  bool validate(const Value& value, const Value& schema);
  void reset();

 private:
  InstanceGetter _get_instance;
  InstanceSetter _set_instance;
  std::vector<DefinedInstance> _defined;
  std::vector<std::u16string> _errors;
  std::vector<std::u16string> _warnings;
};

}
}
