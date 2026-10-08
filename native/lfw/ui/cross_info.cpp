#include "lfw/ui/cross_info.h"

namespace lfw::ui {

namespace {

bool read_field(const Value& o, const char16_t* key, double& out) {
  const Object* const obj = as_object(o);
  if (obj == nullptr) return false;
  const Value* const v = obj->get(key);
  if (v == nullptr) return false;
  const double* const d = std::get_if<double>(&*v);
  if (d == nullptr) return false;
  out = *d;
  return true;
}

}  // namespace

void CrossInfo::set(const Value& o) {
  read_field(o, u"left", left);
  read_field(o, u"top", top);
  read_field(o, u"right", right);
  read_field(o, u"bottom", bottom);
  read_field(o, u"mid_x", mid_x);
  read_field(o, u"mid_y", mid_y);
}

CrossInfo CrossInfo::make(const Value& o) {
  CrossInfo ret;
  ret.set(o);
  return ret;
}

bool CrossInfo::compare(const CrossInfo& o) const {
  return left != o.left || top != o.top || right != o.right || bottom != o.bottom ||
         mid_x != o.mid_x || mid_y != o.mid_y;
}

}
