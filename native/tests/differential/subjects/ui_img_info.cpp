// `ui_img_info`（`ui/utils/validate_ui_img_info`；4AH）的差分台面：固定表
// `Schema_IUIImgInfo`（生成于 `schemas_gen.h`）上跑真校验器。
//
// 文法（两侧逐字一致）：
//   tag                        打 TAG 常量：`tag|<esc>`
//   v <vid> <value-literal>    带 errors/warnings 数组校验：
//                              `v|<vid>|b0/1|e=N|w=N` + 逐条 `ve|<vid>|<i>|<esc>` /
//                              `vw|<vid>|<i>|<esc>` + `vv|<vid>|<校验后的值>`
//   vd <vid> <value-literal>   不传数组（C++ 传 null / TS 用默认参）：`vd|<vid>|b0/1`
#include <cstdio>
#include <fstream>
#include <string>
#include <vector>

#include "lfw/ui/validate_ui_img_info.h"

#include "trace_util.h"

namespace {

using trace::parse_value;
using trace::render_value;
using trace::split_ws;

void fail(const char* what, const std::string& detail) {
  std::fprintf(stderr, "%s: %s\n", what, detail.c_str());
  std::exit(2);
}

void print_messages(const char* tag, const std::string& vid,
                    const std::vector<std::u16string>& ms) {
  for (size_t j = 0; j < ms.size(); ++j) {
    std::printf("%s|%s|%zu|%s\n", tag, vid.c_str(), j, trace::esc(ms[j]).c_str());
  }
}

}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: lfw_trace_ui_img_info <case-file>\n");
    return 2;
  }

  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "cannot open case file: %s\n", argv[1]);
    return 2;
  }

  std::string raw;
  int lineno = 0;
  while (std::getline(in, raw)) {
    ++lineno;
    const std::vector<std::string> t = split_ws(trace::strip_comment(raw));
    if (t.empty()) continue;
    const std::string& op = t[0];
    size_t i = 1;

    if (op == "tag") {
      std::printf("tag|%s\n", trace::esc(lfw::ui::kValidateUIImgInfoTag).c_str());
    } else if (op == "v" || op == "vd") {
      const std::string vid = t[i++];
      const lfw::Value value = parse_value(t, i);
      std::vector<std::u16string> errors;
      std::vector<std::u16string> warnings;
      const bool ok = op == "v" ? lfw::ui::validate_ui_img_info(value, &errors, &warnings)
                                : lfw::ui::validate_ui_img_info(value);
      if (op == "v") {
        std::printf("v|%s|b%d|e=%zu|w=%zu\n", vid.c_str(), ok ? 1 : 0, errors.size(),
                    warnings.size());
        print_messages("ve", vid, errors);
        print_messages("vw", vid, warnings);
      } else {
        std::printf("vd|%s|b%d\n", vid.c_str(), ok ? 1 : 0);
      }
      std::printf("vv|%s|%s\n", vid.c_str(), trace::to_ascii(render_value(value)).c_str());
    } else {
      fail("bad op", op);
    }
  }
  return 0;
}
