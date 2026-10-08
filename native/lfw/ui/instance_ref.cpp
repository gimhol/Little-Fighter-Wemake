#include "lfw/ui/instance_ref.h"

#include <memory>
#include <vector>

#include "lfw/ui/component/ui_component.h"
#include "lfw/ui/uinode.h"

namespace lfw {
namespace ui {

namespace {

std::vector<UINode*>& node_refs() {
  static std::vector<UINode*> list;
  return list;
}

std::vector<UIComponent*>& comp_refs() {
  static std::vector<UIComponent*> list;
  return list;
}

Value make_ref(const char16_t* key, size_t index) {
  Value ret(std::make_shared<Object>());
  Object* const o = as_object(ret);
  if (o != nullptr) o->set(std::u16string(key), Value(static_cast<double>(index)));
  return ret;
}

bool ref_index(const Value& v, const char16_t* key, size_t& out) {
  const Object* const o = as_object(v);
  if (o == nullptr) return false;
  const Value* const p = o->get(std::u16string(key));
  if (p == nullptr) return false;
  const double* const d = std::get_if<double>(p);
  if (d == nullptr || *d < 0.0) return false;
  out = static_cast<size_t>(*d);
  return true;
}

}

Value make_node_ref(UINode* node) {
  node_refs().push_back(node);
  return make_ref(u"__uinode", node_refs().size() - 1);
}

Value make_comp_ref(UIComponent* comp) {
  comp_refs().push_back(comp);
  return make_ref(u"__uicomp", comp_refs().size() - 1);
}

UINode* ref_to_node(const Value& v) {
  size_t idx = 0;
  if (!ref_index(v, u"__uinode", idx) || idx >= node_refs().size()) return nullptr;
  return node_refs()[idx];
}

UIComponent* ref_to_comp(const Value& v) {
  size_t idx = 0;
  if (!ref_index(v, u"__uicomp", idx) || idx >= comp_refs().size()) return nullptr;
  return comp_refs()[idx];
}

}
}
