#include "lfw/dat_translator/xml/xml_to_data_lists.h"

#include "lfw/dat_translator/xml/xml_x_dat_index.h"
#include "lfw/dat_translator/xml/xml_x_director.h"

namespace lfw {
namespace dat_translator {
namespace xml {

Value xml_2_data_lists(const IXMLElement& el) {
  auto ret = std::make_shared<Object>();
  static const char16_t* const kTags[5] = {u"obj", u"background", u"stages", u"bot", u"moves"};
  static const char16_t* const kKeys[5] = {u"objects", u"backgrounds", u"stages", u"bots",
                                           u"moves"};
  for (size_t i = 0; i < 5; ++i) {
    auto arr = std::make_shared<Array>();
    for (IXMLElement* child : el.children_by_tag(kTags[i])) {
      arr->push_back(xml_2_dat_index(*child));
    }
    ret->set(kKeys[i], Value(std::move(arr)));
  }
  auto directors = std::make_shared<Array>();
  for (IXMLElement* child : el.children_by_tag(u"directors")) {
    directors->push_back(xml_2_director_index(*child));
  }
  ret->set(u"directors", Value(std::move(directors)));
  return Value(std::move(ret));
}

}
}
}
