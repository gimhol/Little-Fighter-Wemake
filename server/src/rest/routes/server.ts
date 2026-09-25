import info from '../../../package.json';
import type { Rest } from '../index';

/** 构建期注入的版本信息（见 server/rollup.config.mjs） */
const build = {
  commit: __GIT_COMMIT__,
  commit_short: __GIT_COMMIT__.slice(0, 7),
  dirty: __GIT_DIRTY__,
  built_at: __BUILD_TIME__,
};

export function register_server_routes(rest: Rest) {
  const { router } = rest;

  router.get('/', () => ({
    name: info.name,
    version: info.version,
    ...build,
    api: '/api',
  }));

  router.get('/api', () => ({
    version: info.version,
    ...build,
    uptime_ms: Date.now() - rest.started_at,
    routes: rest.router.routes.map(v => ({ method: v.method, path: v.path, access: v.access })),
  }));

  router.get('/api/stats', (c) => {
    const clients = Array.from(c.ctx.client_mgr.all);
    const rooms = Array.from(c.ctx.room_mgr.all);
    return {
      version: info.version,
      started_at: rest.started_at,
      uptime_ms: Date.now() - rest.started_at,
      clients: clients.length,
      players: clients.filter(v => v.room).length,
      admins: clients.filter(v => v.is_admin).length,
      rooms: rooms.length,
      playing_rooms: rooms.filter(v => v.room_info.started).length,
      ...rest.options.info,
    };
  });

  router.get('/api/system', { access: 'admin' }, () => ({
    pid: process.pid,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    uptime_ms: Math.round(process.uptime() * 1000),
    memory: { ...process.memoryUsage() },
    cwd: process.cwd(),
  }));
}
