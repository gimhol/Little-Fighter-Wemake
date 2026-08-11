import "current-device";
import './DittoImpl';
import * as dom from "./DittoImpl";
import { UINodeRenderer } from "./DittoImpl/renderer/UINodeRenderer";
import { WorldRenderer } from "./DittoImpl/renderer/WorldRenderer";
import { actor, Ditto, LFW, UIActionEnum } from "./LFW";
import { Debug, Log, Warn } from "./Log";
import { ewents } from './Utils/ewents';
import './i18n';
import { Err } from "@fimagine/logger";

actor
  .add(UIActionEnum.Alert, (_, msg) => window.alert(msg))
  .add(UIActionEnum.LinkTo, (_, url) => window.open(url))
  .add(UIActionEnum.Exit, () => window.confirm("确定退出?") && window.close())

const DEV = window.location.href.includes('DEV=1')
Ditto.setup({
  Timeout: dom.__Timeout,
  Interval: dom.__Interval,
  Render: dom.__Render,
  Keyboard: dom.__Keyboard,
  Pointings: dom.__Pointings,
  FullScreen: dom.__FullScreen,
  Sounds: dom.__Sounds,
  Cache: dom.__Cache,
  Zip: dom.__Zip,
  MD5: dom.md5,
  Importer: new dom.__Importer(),
  Vector3: dom.Vector3,
  Vector2: dom.Vector2,
  WorldRender: WorldRenderer,
  UINodeRenderer: UINodeRenderer,
  ImageMgr: dom.ImageMgr,
  UIInputHandle: dom.UIInputHandle,
  warn: Warn.print,
  error: Err.print,
  Log: Log.print,
  debug: Debug.print,
  XML: dom.XML,
  DEV,
  alert: (msg) => window.alert(msg),
});
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
ewents.mount()
ewents.submit_visit()

LFW.VERSION_NAME = [
  `v${VERSION_NAME}-${GIT_COMMIT_ID.substring(0, 7)}${GIT_COMMIT_DIRTY ? `-${GIT_COMMIT_DIRTY}` : ''}`,
  `${BUILD_TIME}`
].filter(v => v).join(' ');