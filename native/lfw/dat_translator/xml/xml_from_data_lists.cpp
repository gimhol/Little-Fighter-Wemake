#include "lfw/dat_translator/xml/xml_from_data_lists.h"

#include "lfw/dat_translator/xml/xml_x_dat_index.h"
#include "lfw/dat_translator/xml/xml_x_director.h"
#include "lfw/utils/container_help/field_or.h"

namespace lfw {
namespace dat_translator {
namespace xml {

std::shared_ptr<IXMLElement> xml_from_data_lists(IXML& xml, const Value& lists) {
  std::shared_ptr<IXMLElement> root = xml.create(u"data");
  // TS 里六个组共用一个循环，`directors` 走 `xml_x_director_index`、其余走 `xml_x_dat_index`。
  static const char16_t* const kTags[6] = {u"obj", u"background", u"stages", u"bot", u"moves", u"directors"};
  static const char16_t* const kKeys[6] = {u"objects", u"backgrounds", u"stages", u"bots", u"moves", u"directors"};
  for (size_t i = 0; i < 6; ++i) {
    const Array* const items = as_array(field_or(lists, kKeys[i]));
    if (items == nullptr || items->size() == 0) continue;
    for (size_t j = 0; j < items->size(); ++j) {
      root->insert(i == 5 ? xml_x_director_index(xml, items->at(j), kTags[i])
                          : xml_x_dat_index(xml, items->at(j), kTags[i]));
    }
  }
  return root;
}

}
}
}
