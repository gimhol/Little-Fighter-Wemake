import http from "http";
import https from "https";
import { WebSocketServer } from 'ws';
import { Client } from './Client.js';
import { ClientMgr } from './ClientMgr.js';
import { Context } from './Context.js';
import { RoomMgr } from './RoomMgr.js';
import "./init.js";
import { read_file } from "./read_file.js";
import { load_config, to_bool, to_list, to_num, to_str } from './config.js';
import { AuthMgr } from './rest/AuthMgr.js';
import { attach_rest } from './rest/index.js';
import arg from "../node_modules/arg"
import info from "../package.json"

/** 构建期注入的版本信息（见 rollup.config.mjs） */
const BUILD_TAG = __GIT_COMMIT__ ? ` (${__GIT_COMMIT__.slice(0, 7)}${__GIT_DIRTY__ ? ' dirty' : ''})` : ''

const args = arg({
  '--help': Boolean, '-h': '--help',
  '--host': String,
  '--port': Number, '-p': '--port',
  '--ssl-key-path': String,
  '--ssl-cer-parh': String,
  '--admin-token': String,
  '--config': String, '-c': '--config',
})
function handle_help() {
  console.log(`
Little Fighter Wemake Multiplayer Server v${info.version}
Options:
  -h, --help
  --host <host>   监听地址（缺省 0.0.0.0，桌面端“仅本机”传 127.0.0.1）
  -p, --port
  --ssl-key-path 
  --ssl-cer-parh
  --admin-token   管理员 token（同 ADMIN_TOKEN，逗号分隔多个）
  -c, --config    配置文件路径（缺省 ./server.config.json5 或 ./server.config.json）

Environment variables (.env is supported):
  HTTP_HOST
  HTTP_PORT
  HTTPS_PORT
  SSL_KEY_FILE_PATH
  SSL_CER_FILE_PATH
  ADMIN_TOKEN / ADMIN_PWD
  CONFIG_FILE_PATH
  RANKS_FILE_PATH
  RANKS_DIR
  RANKS_DB
  RANKS_ALLOWED_TYPES
  RANKS_MAX_PER_TYPE

REST API (与 ws 共用端口):
  GET  /api                接口清单
  GET  /api/stats          服务器统计
  GET  /api/rooms          房间列表
  GET  /api/rooms/:key     房间详情
  GET  /api/clients        客户端列表（admin）
  POST /api/auth/token     申请玩家 token
  POST /api/ranks          提交排行分数
  GET  /api/ranks/:type    查询排行
`.trim())
}
async function main() {
  if (args[`--help`]) {
    handle_help();
    return;
  }
  console.log(`Little Fighter Wemake Multiplayer Server v${info.version}${BUILD_TAG}`)
  const config_file = load_config(to_str(args['--config']) ?? to_str(process.env.CONFIG_FILE_PATH));
  const { config } = config_file;
  const ssl_key = await read_file(to_str(args['--ssl-key-path']) ?? to_str(process.env.SSL_KEY_FILE_PATH) ?? config.ssl_key_file_path);
  const ssl_cer = await read_file(to_str(args['--ssl-cer-parh']) ?? to_str(process.env.SSL_CER_FILE_PATH) ?? config.ssl_cert_file_path);
  const https_port = to_num(args['--port']) ?? to_num(process.env.HTTPS_PORT) ?? to_num(config.https_port) ?? 443
  const http_port = to_num(args['--port']) ?? to_num(process.env.HTTP_PORT) ?? to_num(config.http_port) ?? 80
  const http_host = to_str(args['--host']) ?? to_str(process.env.HTTP_HOST) ?? to_str(config.http_host) ?? ""
  const is_https = !!(ssl_key && ssl_cer);
  const port = is_https ? https_port : http_port;
  const server = !is_https ? http.createServer() : https.createServer({
    key: ssl_key,
    cert: ssl_cer,
  })

  const wss = new WebSocketServer({ server });
  const auth = new AuthMgr();
  const ctx = new Context(
    wss,
    new RoomMgr(),
    new ClientMgr(),
    auth,
  );
  attach_rest(server, ctx, {
    admin_tokens: [args['--admin-token'], process.env.ADMIN_TOKEN, process.env.ADMIN_PWD, config.admin_tokens],
    ranks_path: to_str(process.env.RANKS_FILE_PATH) ?? config.ranks?.path,
    ranks_dir: to_str(process.env.RANKS_DIR) ?? to_str(config.ranks?.dir),
    ranks_db: to_str(process.env.RANKS_DB) ?? to_str(config.ranks?.db),
    ranks_types: to_list(process.env.RANKS_ALLOWED_TYPES) ?? to_list(config.ranks?.allowed_types),
    ranks_max_per_type: to_num(process.env.RANKS_MAX_PER_TYPE) ?? to_num(config.ranks?.max_per_type),
    log: to_bool(config.rest?.log),
    max_body_size: to_num(config.rest?.max_body_size),
    info: { ssl: is_https, port, http_port, https_port, config_file: config_file.loaded ? config_file.path : void 0, commit: __GIT_COMMIT__, dirty: __GIT_DIRTY__, built_at: __BUILD_TIME__ },
  });
  wss.on('connection', (ws, req) => {
    const client = new Client(ctx, ws, req);
    auth.bind_from_req(client, req);
  });
  wss.on('error', e => console.error('WebSocket error:', e));
  server.listen(port, http_host || undefined)
  const host_text = http_host || '0.0.0.0';
  console.log(`${is_https ? 'wss' : 'ws'} server start, host: ${host_text}, port: ${port}`);
  console.log(`${is_https ? 'https' : 'http'} rest api start, host: ${host_text}, port: ${port}`);
}
main();