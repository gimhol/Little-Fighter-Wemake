import { chrome_api, is_extension_page } from './Utils/environment';

const CHECK_DELAY = 3000;
const RELOAD_KEY = 'lfj_version_reloaded';

function warn(action: string, e: unknown) {
  console.warn(`[version_check] ${action}`, e);
}

function reloaded_stamp(): string {
  try {
    return sessionStorage.getItem(RELOAD_KEY) ?? '';
  } catch (e) {
    warn('无法读取 sessionStorage', e);
    return '';
  }
}

function mark_reloaded(stamp: number) {
  try {
    sessionStorage.setItem(RELOAD_KEY, `${stamp}`);
  } catch (e) {
    warn('无法写入 sessionStorage', e);
  }
}

function version_url(): string {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  if (!url.pathname.endsWith('/')) url.pathname = url.pathname.replace(/[^/]*$/, '');
  url.pathname += 'version.json';
  url.searchParams.set('time', `${Date.now()}`);
  return url.href;
}

function reload_to_latest() {
  const url = new URL(location.href);
  url.searchParams.set('time', `${Date.now()}`);
  location.replace(url.href);
}

async function fetch_stamp(): Promise<number | undefined> {
  const resp = await fetch(version_url(), { cache: 'no-store' });
  if (!resp.ok) return void 0;
  const data = await resp.json() as { stamp?: unknown };
  return typeof data?.stamp === 'number' ? data.stamp : void 0;
}

async function check_version() {
  try {
    const stamp = await fetch_stamp();
    if (!stamp || stamp === BUILD_STAMP) return;
    if (reloaded_stamp() === `${stamp}`) return;
    mark_reloaded(stamp);
    reload_to_latest();
  } catch (e) {
    warn('检查同版本热更失败', e);
  }
}

const LATEST_IGNORED_KEY = 'lfj_latest_ignored';
const NOTICE_ID = 'lfj_latest_notice';
const LATEST_CHECK_HOST = 'lf.gim.ink';

function current_version(): string {
  return VERSION_NAME.replace(/^v/, '').split('-')[0];
}

function latest_url(): string {
  const url = new URL('../latest.json', location.href);
  url.searchParams.set('time', `${Date.now()}`);
  return url.href;
}

function ignored_version(): string {
  try {
    return sessionStorage.getItem(LATEST_IGNORED_KEY) ?? '';
  } catch (e) {
    warn('无法读取 sessionStorage', e);
    return '';
  }
}

function mark_ignored(version: string) {
  try {
    sessionStorage.setItem(LATEST_IGNORED_KEY, version);
  } catch (e) {
    warn('无法写入 sessionStorage', e);
  }
}

function is_newer_version(a: string, b: string): boolean {
  const x = a.split('.');
  const y = b.split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (+x[i] || 0) - (+y[i] || 0);
    if (d) return d > 0;
  }
  return false;
}

const EXT_UPDATE_KEY = 'lfw_update_available';

async function fetch_extension_update(): Promise<string | undefined> {
  const data = await chrome_api?.storage?.local?.get?.(EXT_UPDATE_KEY);
  const version = data?.[EXT_UPDATE_KEY];
  return typeof version === 'string' && version ? version : void 0;
}

function version_page_url(version: string): string {
  return new URL(`../${version}/`, location.href).href;
}

/** 缓存键：优先 commit（dirty 构建带后缀），没有 commit 就用 stamp */
function cache_key(info: { commit?: unknown; dirty?: unknown; stamp?: unknown }): string {
  if (typeof info.commit === 'string' && info.commit)
    return `${info.commit}${info.dirty ? '-dirty' : ''}`;
  return typeof info.stamp === 'number' || typeof info.stamp === 'string' ? `${info.stamp}` : '';
}

interface ILatestVersionInfo {
  version: string;
  url?: string;
}

/**
 * 读取 `latest.json`（`deploy:latest` 上传）得到最新版本。
 *
 * 跳转链接带上 commit 以避免旧页面缓存，与 `auto-latest.html` 保持同一套规则。
 */
async function fetch_latest(): Promise<ILatestVersionInfo | undefined> {
  const resp = await fetch(latest_url(), { cache: 'no-store' });
  if (!resp.ok) return void 0;
  const data = await resp.json() as { version?: unknown; commit?: unknown; dirty?: unknown; stamp?: unknown };
  if (typeof data?.version !== 'string' || !data.version) return void 0;
  const url = new URL(version_page_url(data.version));
  const key = cache_key(data);
  if (key) url.searchParams.set('commit', key);
  return { version: data.version, url: url.href };
}

function notice_button(label: string, primary: boolean): HTMLButtonElement {
  const el = document.createElement('button');
  el.textContent = label;
  el.style.cssText = [
    'font:inherit',
    'padding:4px 10px',
    'border:0',
    'border-radius:6px',
    'cursor:pointer',
    `color:${primary ? '#16161a' : '#ddd'}`,
    `background:${primary ? '#ffd24a' : 'rgba(255,255,255,.14)'}`,
  ].join(';');
  return el;
}

function notice_box(): HTMLDivElement {
  const box = document.createElement('div');
  box.id = NOTICE_ID;
  box.style.cssText = [
    'position:fixed',
    'right:16px',
    'bottom:16px',
    'z-index:9999',
    'display:flex',
    'align-items:center',
    'gap:10px',
    'padding:10px 12px',
    'border-radius:10px',
    'background:rgba(18,18,22,.92)',
    'color:#eee',
    'font:13px/1.4 system-ui,-apple-system,"Microsoft YaHei",sans-serif',
    'box-shadow:0 4px 16px rgba(0,0,0,.45)',
  ].join(';');
  return box;
}

function show_latest_notice(version: string, url?: string) {
  if (document.getElementById(NOTICE_ID)) return;
  const zh = `${navigator.language || ''}`.toLowerCase().startsWith('zh');
  const box = notice_box();
  const text = document.createElement('span');
  text.textContent = zh ? `新版本 v${version} 已发布` : `New version v${version} available`;
  const go = notice_button(zh ? '前往' : 'Update', true);
  go.onclick = () => {
    location.href = url ?? version_page_url(version);
  };
  const later = notice_button(zh ? '忽略' : 'Later', false);
  later.onclick = () => {
    mark_ignored(version);
    box.remove();
  };
  box.append(text, go, later);
  document.body.append(box);
}

function show_extension_notice(version: string) {
  if (document.getElementById(NOTICE_ID)) return;
  const zh = `${navigator.language || ''}`.toLowerCase().startsWith('zh');
  const box = notice_box();
  const text = document.createElement('span');
  text.textContent = zh
    ? `扩展有新版本 v${version}，重启浏览器后生效`
    : `Extension v${version} is ready, restart the browser to apply`;
  const ok = notice_button(zh ? '知道了' : 'OK', true);
  ok.onclick = () => {
    mark_ignored(version);
    box.remove();
  };
  box.append(text, ok);
  document.body.append(box);
}

async function check_extension_update() {
  try {
    const version = await fetch_extension_update();
    if (!version) return;
    if (!is_newer_version(version, current_version())) return;
    if (ignored_version() === version) return;
    show_extension_notice(version);
  } catch (e) {
    warn('检查扩展更新失败', e);
  }
}

async function check_latest_version() {
  if (is_extension_page()) return check_extension_update();
  if (location.hostname !== LATEST_CHECK_HOST) return;
  try {
    const latest = await fetch_latest();
    if (!latest) return;
    if (!is_newer_version(latest.version, current_version())) return;
    if (ignored_version() === latest.version) return;
    show_latest_notice(latest.version, latest.url);
  } catch (e) {
    warn('检查新版本失败', e);
  }
}

export function start_version_check() {
  if (!VERSION_CHECK) return;
  setTimeout(check_version, CHECK_DELAY);
  setTimeout(check_latest_version, CHECK_DELAY);
}
