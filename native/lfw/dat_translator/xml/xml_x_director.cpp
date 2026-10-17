#include "lfw/dat_translator/xml/xml_x_director.h"

#include <optional>

#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace dat_translator {
namespace xml {

std::shared_ptr<IXMLElement> xml_x_director_index(IXML& xml, const Value& idx,
                                                  const std::u16string& tag) {
  std::shared_ptr<IXMLElement> el = xml.create(tag);
  el->set_attr(u"id", field_or(idx, u"id"));
  el->set_attr(u"file", field_or(idx, u"file"));
  el->set_attr(u"name", field_or(idx, u"name"));
  el->set_attr(u"skipped", field_or(idx, u"skipped"));
  return el;
}

Value xml_2_director_index(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();
  const std::optional<std::u16string> id = el.get_str(u"id");
  const std::optional<std::u16string> file = el.get_str(u"file");
  ret->set(u"id", Value(id ? *id : std::u16string()));
  ret->set(u"file", Value(file ? *file : std::u16string()));
  if (const std::optional<std::u16string> name = el.get_str(u"name")) {
    ret->set(u"name", Value(*name));
  }
  if (const std::optional<std::u16string> skipped = el.get_str(u"skipped")) {
    ret->set(u"skipped", Value(*skipped));
  }
  return Value(std::move(ret));
}

}
}
}
