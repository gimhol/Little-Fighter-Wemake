import "current-device";
import './DittoImpl';
import * as dom from "./DittoImpl";
import { HeadlessUIInputHandle } from "./DittoImpl/ui/HeadlessUIInputHandle";
import { get_ui_snapshot, HeadlessUINodeRenderer } from "./DittoImpl/renderer/HeadlessUINodeRenderer";
import { UINodeRenderer } from "./DittoImpl/renderer/UINodeRenderer";
import { ui_test_run } from "./ui_test";
import { WorldRenderer } from "./DittoImpl/renderer/WorldRenderer";
import { actor, Ditto, LFW, UIActionEnum } from "./LFW";
import { Debug, Log, Warn } from "./Log";
import { ewents } from './Utils/ewents';
import { is_extension_page } from './Utils/environment';
import './i18n';
import { Err } from "@fimagine/logger";
import { install_mock_toy_if_requested } from "./mock_toy";
import { close_browser, enable_immersive_landscape } from "./toy_sdk";

// 本地开发：URL 带 TOY=1 时模拟 B站 Toy 容器（便于 localhost 测试生存排行等）
install_mock_toy_if_requested()

actor
  .add(UIActionEnum.Alert, (_, msg) => window.alert(msg))
  .add(UIActionEnum.LinkTo, (_, url) => window.open(url))
  .add(UIActionEnum.Exit, () => {
    if (!window.confirm("确定退出?")) return
    // B站 App 内用 Toy SDK 关闭容器；其它环境回退到 window.close()
    close_browser().then(ok => {
      if (!ok) window.close()
    })
  })

const DEV = window.location.href.includes('DEV=1')
// ?headless_ui=1：把 UI 渲染器换成不画东西的实现，只记录节点树快照（验证模型/渲染分层用）
const HEADLESS_UI = new URLSearchParams(window.location.search).has('headless_ui')
Ditto.setup({
  Timeout: dom.__Timeout,
  Interval: dom.__Interval,
  Render: dom.__Render,
  Clock: dom.__Clock,
  Keyboard: dom.__Keyboard,
  Pointings: dom.__Pointings,
  FullScreen: dom.__FullScreen,
  Sounds: dom.__Sounds,
  Cache: dom.__Cache,
  Zip: dom.__Zip,
  MD5: dom.md5,
  JSON5: dom.__JSON5,
  Importer: new dom.__Importer(),
  Vector3: dom.Vector3,
  Vector2: dom.Vector2,
  WorldRender: WorldRenderer,
  UINodeRenderer: HEADLESS_UI ? HeadlessUINodeRenderer : UINodeRenderer,
  ImageMgr: dom.ImageMgr,
  UIInputHandle: HEADLESS_UI ? HeadlessUIInputHandle : dom.UIInputHandle,
  warn: Warn.print,
  error: Err.print,
  Log: Log.print,
  debug: Debug.print,
  XML: dom.XML,
  DEV,
  IsDesktop: !!window.runtime,
  alert: (msg) => window.alert(msg),
  print: Log.print
});
if (HEADLESS_UI) {
  Object.assign(window, {
    ui_snapshot: () => ({
      frames: HeadlessUINodeRenderer.frames,
      nodes: get_ui_snapshot(),
    }),
    ui_test_run: (steps?: unknown) => {
      const lfw = (window as any).world?.lfw;
      if (!lfw) throw new Error("[ui_test_run] world 未就绪");
      return ui_test_run(lfw, steps as any);
    },
  });
}
ewents.filter = async (type: string, event: object) => {
  if (localStorage.getItem('last_admin') == '255')
    return false
  if (type == 'visit') {
    if (!('uri' in event)) return false;
    const { uri } = event;
    if (typeof uri !== 'string') return false;
  }
  return true
}
if (!is_extension_page()) {
  ewents.mount()
  ewents.submit_visit()
}

LFW.VERSION_NAME = [
  `v${VERSION_NAME}-${GIT_COMMIT_ID.substring(0, 7)}${GIT_COMMIT_DIRTY ? `-${GIT_COMMIT_DIRTY}` : ''}`,
  `${BUILD_TIME}`
].filter(v => v).join(' ');

// 构建期注入的默认数据包地址（见 vite.config.ts）：当前 bilibili-toy 构建注入远端
// https://lf.gim.ink/<package.json 版本>/... ，页面不托管数据包时用于覆盖默认数据包
if (typeof DATA_ZIP_URLS !== 'undefined' && DATA_ZIP_URLS.length) {
  LFW.ZIPS = DATA_ZIP_URLS;
}

// B站 Toy 环境：App 内手机 / 平板进入时自动请求「沉浸横屏」（非 Toy 环境静默跳过）
enable_immersive_landscape().catch(() => { })