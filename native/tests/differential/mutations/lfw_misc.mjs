// `ui_misc`（4AM：事件层 + UIImgLoader）的变异档。
//
// 用例：`cases/lfw/event.txt` / `cases/lfw/imloader.txt`（任一锁住即可）。
//
// 有意不覆盖：`UIImgLoader.load` 里两次 `jid !== this._jid.value` 的 out-of-date 分支
// —— 端口同步、宿主也不重入，比较恒不相等为假（`ignore_out_of_date` 只测 jid 观测量）。
export default {
  subject: "lfw",
  cases: ["event", "imloader"],
  mutations: [
    {
      note: "stop_propagation 写成 2",
      file: "native/lfw/ui/ui_event.h",
      from: `  void stop_propagation() override { _stopped = 1; }`,
      to: `  void stop_propagation() override { _stopped = 2; }`,
    },
    {
      note: "stop_immediate_propagation 写成 1",
      file: "native/lfw/ui/ui_event.h",
      from: `  void stop_immediate_propagation() override { _stopped = 2; }`,
      to: `  void stop_immediate_propagation() override { _stopped = 1; }`,
    },
    {
      note: "stopped 初值不是 0",
      file: "native/lfw/ui/ui_event.h",
      from: `  int _stopped = 0;`,
      to: `  int _stopped = 1;`,
    },
    {
      note: "指针事件的 button 丢了",
      file: "native/lfw/ui/ui_event.h",
      from: `  LFWPointerEvent(const Vector3& point, double button) : point(point), button(button) {}`,
      to: `  LFWPointerEvent(const Vector3& point, double button) : point(point), button(0.0) {}`,
    },
    {
      note: "按键事件的 game_key/key 接反",
      file: "native/lfw/ui/ui_event.h",
      from: `        game_key(std::move(game_key)),
        key(std::move(key)),`,
      to: `        key(std::move(game_key)),
        game_key(std::move(key)),`,
    },
    {
      note: "按键事件的 pressed 取反",
      file: "native/lfw/ui/ui_event.h",
      from: `        pressed(pressed) {}`,
      to: `        pressed(!pressed) {}`,
    },
    {
      note: "ignore_out_of_date 少了 set_max",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  _jid.set_max(0.0);
  _jid.set_min(0.0);
  _jid.set_value(0.0);`,
      to: `  _jid.set_min(0.0);
  _jid.set_value(0.0);`,
    },
    {
      note: "load 不再推进 jid",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  _jid.add();
  const double jid = _jid.value();`,
      to: `  const double jid = _jid.value();`,
    },
    {
      note: "node 缺失的报错文案改了",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `    result.error = u"[UIImgLoader::load] node got null";`,
      to: `    result.error = u"[UIImgLoader::load] node got nil";`,
    },
    {
      note: "加载成功不再回写 image",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  node->set_image(imgs);
  node->resize(w / scale, h / scale);`,
      to: `  node->resize(w / scale, h / scale);`,
    },
    {
      note: "resize 没除 scale",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  node->resize(w / scale, h / scale);`,
      to: `  node->resize(w, h);`,
    },
    {
      note: "scale 缺省不再取字段（固定 1）",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  const double scale = num_of(u"scale");`,
      to: `  const double scale = 1.0;`,
    },
    {
      note: "宿主失败的错误文本不再透传",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `    result.error = error;
    return result;
  }`,
      to: `    result.error = u"x";
    return result;
  }`,
    },
    {
      note: "成功结果不带 image",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  result.image = imgs;`,
      to: `  result.image = Value();`,
    },
    {
      note: "set_img 不带 path",
      file: "native/lfw/ui/ui_img_loader.cpp",
      from: `  o->set(u"path", Value(path));`,
      to: `  o->set(u"path", Value());`,
    },
  ],
};
