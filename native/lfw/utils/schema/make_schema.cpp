#include "lfw/utils/schema/make_schema.h"

#include <memory>
#include <string>

#include "lfw/utils/schema/validate_schema.h"

namespace lfw {
namespace schema {

namespace {

const Value& undef() {
  static const Value v;
  return v;
}

const Value& field(const Value& obj, const char16_t* key) {
  const Object* o = as_object(obj);
  if (o == nullptr) return undef();
  const Value* p = o->get(std::u16string(key));
  return p != nullptr ? *p : undef();
}

bool truthy_field(const Value& obj, const char16_t* key) { return truthy(field(obj, key)); }

Value new_object() { return Value(std::make_shared<Object>()); }

void set_field(const Value& obj, const char16_t* key, const Value& v) {
  Object* const o = const_cast<Object*>(as_object(obj));
  if (o != nullptr) o->set(std::u16string(key), v);
}

}  // namespace

Value make_schema(const Value& meta, const Value* parent) {
  const Value& meta_key = field(meta, u"key");
  if (parent == nullptr && !truthy(meta_key)) return Value();

  const Value* const raw_type =
      as_object(meta) != nullptr ? as_object(meta)->get(u"type") : nullptr;
  const Value type = raw_type != nullptr && !std::holds_alternative<std::monostate>(*raw_type)
                         ? *raw_type
                         : Value(u"object");
  const Value& items = field(meta, u"items");
  const Value& properties = field(meta, u"properties");

  // `{ key, type, ...remains, path, properties: void 0 }`：remains = meta 去掉
  // `properties`/`items`/`key`/`type` 后的剩余键（插入序照抄）。
  const Value ret = new_object();
  set_field(ret, u"key", meta_key);
  set_field(ret, u"type", type);
  if (const Object* const o = as_object(meta)) {
    for (const std::u16string& k : o->keys()) {
      if (k == u"properties" || k == u"items" || k == u"key" || k == u"type") continue;
      const Value* const p = o->get(k);
      if (p != nullptr) set_field(ret, k.c_str(), *p);
    }
  }
  const std::u16string path =
      parent != nullptr
          ? to_string(field(*parent, u"path")) + u"." + to_string(meta_key)
          : to_string(meta_key);
  set_field(ret, u"path", Value(path));
  set_field(ret, u"properties", Value());

  if (truthy(items)) {
    if (is_class_type(items)) {
      Value shorthand = new_object();
      set_field(shorthand, u"key", meta_key);
      set_field(shorthand, u"type", items);
      set_field(shorthand, u"nullable", Value(true));
      set_field(ret, u"items", make_schema(shorthand, &ret));
    } else if (as_object(items) != nullptr) {
      Value spread = new_object();
      set_field(spread, u"key", meta_key);
      if (const Object* const o = as_object(items)) {
        for (const std::u16string& k : o->keys()) {
          const Value* const p = o->get(k);
          if (p != nullptr) set_field(spread, k.c_str(), *p);
        }
      }
      set_field(ret, u"items", make_schema(spread, &ret));
    }
  }
  if (truthy(properties)) {
    const Value props = new_object();
    set_field(ret, u"properties", props);
    if (const Object* const po = as_object(properties)) {
      for (const std::u16string& prop_key : po->keys()) {
        const Value* const pp = po->get(prop_key);
        if (pp == nullptr) continue;
        const Value& prop = *pp;
        if (is_class_type(prop)) {
          Value shorthand = new_object();
          set_field(shorthand, u"key", Value(prop_key));
          set_field(shorthand, u"type", prop);
          set_field(shorthand, u"nullable", Value(true));
          set_field(props, prop_key.c_str(), make_schema(shorthand, &ret));
        } else if (as_object(prop) != nullptr) {
          Value copy = new_object();
          if (const Object* const o = as_object(prop)) {
            for (const std::u16string& k : o->keys()) {
              const Value* const p = o->get(k);
              if (p != nullptr) set_field(copy, k.c_str(), *p);
            }
          }
          set_field(copy, u"key", Value(prop_key));
          set_field(props, prop_key.c_str(), make_schema(copy, &ret));
        }
        // `else`（字符串等原始类型）与 TS 一致：**不落地**（TS 的 `typeof prop` 既非
        // `function` 也非 `object` 时跳过）。
      }
    }
  }
  return ret;
}

}
}
