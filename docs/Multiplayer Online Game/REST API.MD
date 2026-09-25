# REST API

联机服务器的 HTTP 接口。接口与 WebSocket 共用同一个端口：

- HTTP 请求（任意路径）由 REST 层处理，未注册的路径返回 404 JSON
- WebSocket 握手与 HTTP 请求由协议区分，客户端连接根路径即可

> 本文档只提供中文版本。

## 概述

- 基地址：`http(s)://<服务器地址>:<端口>`，端口与 WebSocket 相同（默认 HTTP 80 / HTTPS 443）
- 请求体支持 `application/json`，也兼容 `application/x-www-form-urlencoded`；上限 1MB
- 响应一律是 UTF-8 的 JSON
- 已开启 CORS（`Access-Control-Allow-Origin: *`），支持 `OPTIONS` 预检，可直接在网页里调用
- `GET /api` 会返回当前服务器**实际注册**的全部接口清单，可用来确认部署版本

## 鉴权

接口分四个权限等级：

| 等级 | 含义 |
| - | - |
| `public` | 任何人可访问 |
| `player` | 需要有效的玩家 token |
| `client` | 需要玩家 token，且该 token 已绑定到在线的 WebSocket 客户端 |
| `admin` | 需要管理员 token |

### token 的携带方式

以下三种任选其一（同时存在时按此顺序读取）：

| 方式 | 示例 |
| - | - |
| 请求头 | `Authorization: Bearer <token>` |
| 请求头 | `X-Token: <token>` |
| 查询参数 | `?token=<token>` |

### 管理员 token

按以下顺序合并，任一匹配即为管理员（可用英文逗号分隔配置多个）：

1. 命令行参数 `--admin-token <token>`
2. 环境变量 `ADMIN_TOKEN`
3. 环境变量 `ADMIN_PWD`

WebSocket 连接地址带上管理员 token 时，对应客户端会被标记为管理员（等价于游戏内的管理员身份）。

### 玩家 token

- 调 `POST /api/auth/token` 申请，服务器返回一个随机 token
- 也支持客户端自己生成：WebSocket 连接时带 `?token=<自定义 token>`，未知 token 会被自动登记为玩家 token
- 玩家 token 通过 `?token=` 绑定的在线客户端掉线后会自动解绑（此时 `access: client` 的接口会返回 409）
- 玩家 token 只保存在内存中，服务器重启后失效；管理员 token 来自配置，不受重启影响

> 注意：没有配置 HTTPS 时，token 是明文传输的，请只在可信网络中使用。

## 通用约定

### 成功响应

直接返回数据对象，例如：

``` json
{ "rooms": [] }
```

### 失败响应

``` json
{ "status": 404, "error": "房间不存在：999" }
```

部分接口还会带业务错误码字段 `code`。

| 状态码 | 含义 |
| - | - |
| 400 | 参数缺失或格式错误 |
| 401 | 未携带 token，或 token 无效 |
| 403 | token 有效但权限不足 |
| 404 | 接口或对象不存在 |
| 405 | 方法不被支持（响应头 `Allow` 会列出可用方法） |
| 409 | 当前状态不允许该操作（例如玩家 token 未绑定在线客户端） |
| 413 | 请求体超过大小上限 |
| 500 | 服务器内部错误 |

### 布尔参数

`?key=1`、`?key=true`、`?key=yes`、`?key=on` 或直接写 `?key` 都表示 true；`0`、`false`、`no`、`off` 表示 false。

## 接口一览

| 方法 | 路径 | 权限 | 说明 |
| - | - | - | - |
| GET | `/` | public | 服务器基本信息 |
| GET | `/api` | public | 接口清单 |
| GET | `/api/stats` | public | 服务器统计 |
| GET | `/api/system` | admin | 进程与系统信息 |
| GET | `/api/rooms` | public | 房间列表 |
| GET | `/api/rooms/:key` | public | 房间详情 |
| POST | `/api/rooms/:key/close` | admin | 关闭房间 |
| POST | `/api/rooms/:key/kick` | admin | 踢出房间内的客户端 |
| GET | `/api/clients` | admin | 客户端列表 |
| POST | `/api/auth/token` | public | 申请玩家 token |
| GET | `/api/auth/tokens` | admin | 玩家 token 列表 |
| DELETE | `/api/auth/tokens/:token` | admin | 删除玩家 token |
| GET | `/api/me` | player | 当前 token 的身份信息 |
| POST | `/api/me/chat` | client | 以绑定客户端身份发言 |
| POST | `/api/ranks` | public | 提交排行分数 |
| GET | `/api/ranks/:type` | public | 查询排行 |

## 接口详情

### GET /

服务器基本信息，可用于探活。

``` bash
curl http://localhost/api
```

``` json
{ "name": "lfj-node-server", "version": "1.0.1", "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4", "commit_short": "a1b2c3d", "dirty": false, "built_at": "2026-09-25T12:22:29.198Z", "api": "/api" }
```

### GET /api

接口清单。`access` 即该接口所需权限等级。

``` json
{
  "version": "1.0.1",
  "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
  "commit_short": "a1b2c3d",
  "dirty": false,
  "built_at": "2026-09-25T12:22:29.198Z",
  "uptime_ms": 44397,
  "routes": [
    { "method": "GET", "path": "/api/rooms", "access": "public" },
    { "method": "POST", "path": "/api/rooms/:key/kick", "access": "admin" }
  ]
}
```

`commit` / `commit_short` / `dirty` / `built_at` 是**构建时**注入的（打包时读取构建机上的 git 状态），部署后可以直接用它确认线上跑的是哪次提交。启动日志也会带上：`Little Fighter Wemake Multiplayer Server v1.0.1 (a1b2c3d)`（工作区有未提交改动时会多一个 `dirty`）。

### GET /api/stats

| 字段 | 类型 | 说明 |
| - | - | - |
| `version` | string | 服务器版本 |
| `commit` / `commit_short` | string | 构建时的 git 提交（完整 / 前 7 位） |
| `dirty` | boolean | 构建时工作区是否有未提交改动 |
| `built_at` | string | 构建时间（ISO） |
| `started_at` | number | 启动时间戳（毫秒） |
| `uptime_ms` | number | 已运行毫秒数 |
| `clients` | number | 在线客户端总数 |
| `players` | number | 已加入房间的客户端数 |
| `admins` | number | 管理员客户端数 |
| `rooms` | number | 房间总数 |
| `playing_rooms` | number | 已开始的房间数 |
| `ssl` | boolean | 是否启用 HTTPS/WSS |
| `port` / `http_port` / `https_port` | number | 端口配置 |

``` json
{
  "version": "1.0.1",
  "commit": "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4",
  "commit_short": "a1b2c3d",
  "dirty": false,
  "built_at": "2026-09-25T12:22:29.198Z",
  "started_at": 1789304745001,
  "uptime_ms": 44418,
  "clients": 1,
  "players": 1,
  "admins": 0,
  "rooms": 1,
  "playing_rooms": 0,
  "ssl": false,
  "port": 80,
  "http_port": 80,
  "https_port": 443
}
```

### GET /api/system

需要 admin。

``` json
{
  "pid": 1234,
  "node": "v22.15.0",
  "platform": "linux",
  "arch": "x64",
  "uptime_ms": 123456,
  "memory": { "rss": 52428800, "heapTotal": 12345678, "heapUsed": 7654321, "external": 1234567, "arrayBuffers": 12345 },
  "cwd": "/root/backends/lfj"
}
```

### GET /api/rooms

| 参数 | 类型 | 默认 | 说明 |
| - | - | - | - |
| `show_all` | bool | false | 是否返回同步模式为 `delay` 的房间 |

``` json
{
  "rooms": [
    {
      "title": "gim的房间",
      "code": "HTPJWFOX",
      "id": "1",
      "owner": { "id": "client_1", "name": "gim", "players": ["davis"] },
      "clients": [{ "id": "client_1", "name": "gim", "players": ["davis"], "ready": false }],
      "min_players": 2,
      "max_players": 4,
      "started": false,
      "sync_mode": "auto",
      "need_pwd": false,
      "lfw_version": "",
      "data_infos": []
    }
  ]
}
```

### GET /api/rooms/:key

`:key` 可以是房间 `id`，也可以是房间 `code`（入房码）。房间不存在返回 404。

``` bash
curl http://localhost/api/rooms/HTPJWFOX
```

``` json
{ "room": { "id": "1", "code": "HTPJWFOX" } }
```

### POST /api/rooms/:key/close

需要 admin。以房主身份关闭房间：向房内所有客户端广播 `CloseRoom`，并清空房间。

返回关闭前的房间快照。

``` bash
curl -X POST -H "Authorization: Bearer <admin token>" http://localhost/api/rooms/1/close
```

### POST /api/rooms/:key/kick

需要 admin。把指定客户端移出房间（房主被踢时房主自动转给下一位成员）。

| 字段 | 类型 | 必填 | 说明 |
| - | - | - | - |
| `client_id` | string | 是 | 要踢出的客户端 id，见 `GET /api/rooms/:key` 的 `clients[].id` |

``` bash
curl -X POST -H "Authorization: Bearer <admin token>" -H "Content-Type: application/json" \
  -d '{"client_id":"client_3"}' http://localhost/api/rooms/1/kick
```

房间内没有该客户端时返回 404。

### GET /api/clients

需要 admin。

| 参数 | 类型 | 默认 | 说明 |
| - | - | - | - |
| `detail` | bool | false | 是否附带 socket 信息等运行时细节 |

不传 `detail` 时返回该客户端最近一次上报的基础信息：

``` json
{ "clients": [{ "id": "client_1", "name": "gim", "players": ["davis"] }] }
```

传 `detail=1` 时额外包含 `admin`、`ready`、`room`、`rtt`、`r_address`、`r_port`、`r_family`、`l_address`、`l_port`、`l_family`：

``` json
{
  "clients": [
    {
      "id": "client_1",
      "name": "gim",
      "players": ["davis"],
      "admin": false,
      "ready": false,
      "room": "1",
      "rtt": 42,
      "r_address": "::ffff:127.0.0.1",
      "r_port": 50429,
      "r_family": "IPv6",
      "l_address": "::ffff:127.0.0.1",
      "l_port": 80,
      "l_family": "IPv6"
    }
  ]
}
```

### POST /api/auth/token

申请一个玩家 token。请求体可省略或留空。

| 字段 | 类型 | 必填 | 说明 |
| - | - | - | - |
| `name` | string | 否 | 玩家名，缺省时由服务器生成 |
| `players` | string[] | 否 | 玩家使用的角色名列表 |

``` bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"gim","players":["davis"]}' http://localhost/api/auth/token
```

``` json
{
  "token": "74d8924d6b175fbdea435a7a6a54f9d33a11863feb0099d0",
  "name": "gim",
  "players": ["davis"],
  "created_at": 1789304800136
}
```

### GET /api/auth/tokens

需要 admin。返回全部玩家 token 及其在线状态。

``` json
{
  "tokens": [
    {
      "token": "74d8924d6b175fbdea435a7a6a54f9d33a11863feb0099d0",
      "name": "gim",
      "players": ["davis"],
      "created_at": 1789304800136,
      "last_seen": 1789304840112,
      "online": true,
      "client_id": "client_1"
    }
  ]
}
```

### DELETE /api/auth/tokens/:token

需要 admin。删除玩家 token 并解绑。

``` json
{ "ok": true }
```

### GET /api/me

需要 player。返回该 token 的身份信息；若 token 已绑定在线客户端，还会带上客户端与房间的完整信息。

``` json
{
  "token": "74d8924d6b175fbdea435a7a6a54f9d33a11863feb0099d0",
  "name": "gim",
  "players": ["davis"],
  "created_at": 1789304800136,
  "last_seen": 1789304840112,
  "online": true,
  "client": {
    "id": "client_1",
    "name": "gim",
    "players": ["davis"],
    "admin": false,
    "ready": false,
    "room": "1",
    "rtt": 42,
    "r_address": "::ffff:127.0.0.1",
    "r_port": 50429,
    "r_family": "IPv6",
    "l_address": "::ffff:127.0.0.1",
    "l_port": 80,
    "l_family": "IPv6"
  },
  "room": { "id": "1", "code": "HTPJWFOX", "started": false }
}
```

### POST /api/me/chat

需要 client（玩家 token 且已绑定在线客户端）。走与游戏内聊天完全相同的通道，房间或全局的其它玩家都会收到这条消息，发送者自己的客户端也会收到一条推送。

| 字段 | 类型 | 必填 | 说明 |
| - | - | - | - |
| `text` | string | 是 | 消息内容 |
| `target` | string | 否 | `room`（默认）或 `global` |

``` bash
curl -X POST -H "Authorization: Bearer <player token>" -H "Content-Type: application/json" \
  -d '{"text":"gg","target":"room"}' http://localhost/api/me/chat
```

``` json
{
  "sender": { "id": "client_1", "name": "gim", "players": ["davis"] },
  "date": 1789304999904,
  "text": "gg",
  "target": "room",
  "seq": 1789304994338
}
```

`seq` 与游戏内聊天共用同一个自增序号，可直接用于消息排序与去重。

### POST /api/ranks

提交一条排行分数。

| 字段 | 类型 | 必填 | 说明 |
| - | - | - | - |
| `type` | string | 是 | 排行类型，最长 64 字符，只能包含字母、数字、`_`、`.`、`-`（例如 `story`、`survival_week`） |
| `name` | string | 是 | 玩家名，最长 32 字符（仅用于展示） |
| `score` | number | 是 | 分数，数字或数字字符串 |
| `uid` | string | 否 | 提交者标识，4~64 位字母/数字/`_`/`-`（如客户端本地生成的匿名 id）；不合法或未提供时按 `name` 去重 |
| `group` | string | 否 | 分组标识，最长 64 字符；同一 `uid` 下不同 `group` 各占一条记录（如生存榜单人榜传角色名，同一客户端的多个角色各占一行）；缺省或没有 `uid` 时不影响去重 |
| `extra` | any | 否 | 额外信息，任意 JSON，原样保存 |

服务器会自动记录提交时间 `date`、提交者地址 `address`，以及（若已绑定 token）客户端 id `client_id`。

同一 `type` + 同一提交者（`uid`，缺省时退回 `name`）+ 同一 `group`（缺省视为空）只保留最高分：再次提交时只有分数更高才会覆盖原记录（名次、时间随新记录更新），低于或等于现有最高分的提交不会写入，响应里返回的是现有最高分记录。重名玩家只要 `uid` 不同就会各占一行，同一 `uid` 传入多个 `group` 时也会各占一行。

``` bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"type":"story","name":"gim","score":250,"uid":"0f8c1d92","extra":{"stage":3}}' http://localhost/api/ranks
```

``` json
{
  "rank": 1,
  "total": 3,
  "kept": true,
  "type": "story",
  "name": "gim",
  "score": 250,
  "uid": "0f8c1d92",
  "extra": { "stage": 3 },
  "address": "::ffff:127.0.0.1",
  "date": 1789305323519
}
```

| 字段 | 说明 |
| - | - |
| `rank` | 该提交者当前记录在当前类型下的名次（从 1 开始） |
| `total` | 该类型当前保留的条目数（每个提交者每个分组一条） |
| `kept` | 是否进入服务器保留的名单（保留上限见下） |

规则与限制：

- 排序按 `score` 从高到低，分数相同则更早达到的记录在前
- 每个提交者在每个类型下只有一条记录（最高分），但如果提交时带了 `group`（如角色名），则每个 `group` 各占一条；反复提交不会在榜单里产生重复行；没有 `uid` 的旧数据先按名字收敛，加载旧数据文件时也同样处理，旧文件会在下次落盘时变干净
- 周期类型（以 `_all` / `_month` / `_week` / `_day` 结尾，例如 `survival_all`）视为同一族：提交其中任意一个，会自动把这条记录同步写入同族的其它类型，所以客户端每次提交只需发一个请求，月/周/日榜也会同时更新（各类型仍按 `uid` + `group` 去重、只留最高分；被 `RANKS_ALLOWED_TYPES` 排除的类型会跳过）
- 每个排行类型默认最多保留 10000 条（可用 `RANKS_MAX_PER_TYPE` 或配置文件 `ranks.max_per_type` 调整），超出后名次靠后的记录会被丢弃，此时 `kept` 为 false；设为 `0` 或负数表示不限制条数
- 可以用 `RANKS_ALLOWED_TYPES` 或配置文件 `ranks.allowed_types` 限定允许的排行类型；限制后提交未允许的类型会返回 400
- 数据落盘有两种方式：默认全部类型写在一个 JSON 文件（`ranks.path` / `RANKS_FILE_PATH`，默认 `<运行目录>/ranks.json`）；配置了目录（`ranks.dir` / `RANKS_DIR`）时，每个类型单独一个文件 `<目录>/<type>.json`，方便单独维护（例如每周换掉 `survival_week.json` 即可重置周榜）。服务器重启后自动加载；落盘有约 0.5 秒防抖

### GET /api/ranks/:type

查询某个排行类型的榜单。

| 参数 | 类型 | 默认 | 说明 |
| - | - | - | - |
| `limit` | number | 50 | 返回条数，范围 1 到 500 |
| `name` | string | 无 | 只返回指定玩家名的成绩（重名时返回多行） |
| `uid` | string | 无 | 只返回该提交者的成绩；与 `name` 同时给出时优先 `uid` |

`total` 是当前保留的条数；每个提交者每个分组只有一条记录（其最高分），所以不使用 `group` 时同一个 `uid` 不会出现两次（重名玩家各占一行）。传了 `name` 或 `uid` 时会额外返回 `best`（该提交者在榜上的最好成绩与名次，使用 `group` 时取所有分组里最好的一条；没有记录时为 null）。

``` json
{
  "type": "survival_week",
  "limit": 50,
  "total": 2,
  "scores": [
    { "type": "survival_week", "name": "gim", "score": 7, "date": 1789307723535 },
    { "type": "survival_week", "name": "bob", "score": 3, "date": 1789307723527 }
  ],
  "best": { "rank": 1, "score": { "type": "survival_week", "name": "gim", "score": 7, "date": 1789307723535 } }
}
```

``` bash
curl "http://localhost/api/ranks/story?limit=3"
```

``` json
{
  "type": "story",
  "limit": 3,
  "total": 3,
  "scores": [
    { "type": "story", "name": "gim", "score": 250, "date": 1789305323528 },
    { "type": "story", "name": "bob", "score": 180, "date": 1789305323530 },
    { "type": "story", "name": "ann", "score": 100, "extra": { "stage": 3 }, "date": 1789305323519 }
  ]
}
```

类型未在允许列表内时返回 400；类型不存在（从未有过提交）时返回空的 `scores`，不报错。

## 数据结构

### RoomInfo

| 字段 | 类型 | 说明 |
| - | - | - |
| `id` | string | 房间 id |
| `code` | string | 入房码 |
| `title` | string | 房间标题 |
| `owner` | ClientInfo | 房主 |
| `clients` | RoomClientInfo[] | 房间内客户端（含 `ready`） |
| `min_players` / `max_players` | number | 最少/最多玩家数 |
| `started` | boolean | 是否已开始 |
| `sync_mode` | string | 房主选择的同步模式（`auto` / `lockstep` / `delay`） |
| `need_pwd` | boolean | 是否需要密码 |
| `lfw_version` | string | 房主创建房间时的游戏版本 |
| `data_infos` | IDataInfo[] | 房主创建房间时的数据包信息（含 md5） |

### ClientInfo

| 字段 | 类型 | 说明 |
| - | - | - |
| `id` | string | 客户端 id |
| `name` | string | 客户端名称 |
| `players` | string[] | 使用的角色名列表 |

`detail` / `full_info` 形式还会附加：`admin`、`ready`、`room`、`rtt`、`r_address`、`r_port`、`r_family`、`l_address`、`l_port`、`l_family`。

### RankScore

| 字段 | 类型 | 说明 |
| - | - | - |
| `type` | string | 排行类型 |
| `name` | string | 玩家名 |
| `score` | number | 分数 |
| `extra` | any | 提交时附带的额外信息 |
| `date` | number | 服务器记录的时间戳（毫秒） |
| `client_id` | string | 提交者客户端 id（绑定了 token 时才有） |
| `address` | string | 提交者地址 |

## 配置文件

配置有多个来源，优先级从高到低：

1. 命令行参数（`--port`、`--admin-token`、`--config` 等）
2. 环境变量（含 `.env`）
3. 配置文件
4. 内置默认值

### 结构化配置文件

支持 JSON5（可写注释、键名可省略引号、允许尾逗号），默认从**运行目录**读取 `server.config.json5`（没有时再试 `server.config.json`），也可以用 `--config <路径>` 或环境变量 `CONFIG_FILE_PATH` 指定其它位置。

- 文件不存在时静默跳过（用默认值启动）
- 显式指定的路径不存在、或文件解析失败时会直接退出，并打印原因
- 启动时会打印 `[Config] 已加载 <路径>`，`GET /api/stats` 的 `config_file` 字段也会带上实际使用的配置文件路径

``` json5
{
  http_port: 80,
  https_port: 443,
  ssl_key_file_path: 'SSL的密钥文件（不需要SSL的话留空）',
  ssl_cert_file_path: 'SSL的证书文件（不需要SSL的话留空）',
  admin_tokens: ['token1', 'token2'],

  rest: {
    log: true,
    max_body_size: 1048576,
  },

  ranks: {
    path: '/root/data/lfj/ranks.json',
    allowed_types: ['story', 'versus'],
    max_per_type: 0, // 0 或负数 = 不限条数
  },
}
```

| 配置项 | 类型 | 说明 |
| - | - | - |
| `http_port` / `https_port` | number | 监听端口，默认 80 / 443 |
| `ssl_key_file_path` / `ssl_cert_file_path` | string | SSL 密钥与证书文件路径，两者都有效时才启用 HTTPS |
| `admin_tokens` | string 或 string[] | 管理员 token |
| `rest.log` | boolean | 是否打印每个请求的日志，默认 true |
| `rest.max_body_size` | number | 请求体大小上限（字节），默认 1048576 |
| `ranks.path` | string | 排行数据文件路径（所有类型集中在一个文件） |
| `ranks.dir` | string | 排行数据目录，每个排行类型一个 `<type>.json`；配置后优先于 `ranks.path` |
| `ranks.db` | string | SQLite 数据库路径；配置后优先使用 SQLite，不可用时自动回退到文件存储（见下方“排行存储”） |
| `ranks.allowed_types` | string 或 string[] | 允许的排行类型，缺省不限制 |
| `ranks.max_per_type` | number | 每个排行类型保留的条数上限，默认 10000；`0` 或负数表示不限制 |

### 环境变量

`.env` 同样会被读取（注意等号两侧不需要空格）：

``` plaintext
HTTP_PORT=80
HTTPS_PORT=443
SSL_KEY_FILE_PATH=SSL的密钥文件（不需要SSL的话留空）
SSL_CER_FILE_PATH=SSL的证书文件（不需要SSL的话留空）
ADMIN_TOKEN=管理员token（与 ADMIN_PWD 等价，可用英文逗号分隔多个）
ADMIN_PWD=同上
CONFIG_FILE_PATH=配置文件路径
RANKS_FILE_PATH=/root/data/lfj/ranks.json
RANKS_DIR=/root/data/lfj/ranks
RANKS_DB=/root/data/lfj/ranks.sqlite
RANKS_ALLOWED_TYPES=story,versus
RANKS_MAX_PER_TYPE=10000
```

| 配置 | 说明 |
| - | - |
| `ADMIN_TOKEN` / `ADMIN_PWD` | 管理员 token，两者等价，可用英文逗号配置多个；也可用启动参数 `--admin-token` 指定 |
| `CONFIG_FILE_PATH` | 配置文件路径，等价于 `--config` |
| `RANKS_FILE_PATH` | 排行数据文件路径，缺省为 `<运行目录>/ranks.json`。部署时建议指到部署目录之外，避免更新被覆盖 |
| `RANKS_DIR` | 排行数据目录（每个类型一个文件），配置后优先于 `RANKS_FILE_PATH` |
| `RANKS_DB` | SQLite 数据库路径；配置且可用时优先，否则回退到文件存储 |
| `RANKS_ALLOWED_TYPES` | 允许的排行类型，逗号分隔，缺省不限制 |
| `RANKS_MAX_PER_TYPE` | 每个排行类型保留的条数上限，缺省 10000；`0` 或负数表示不限制 |

### 排行存储

排行数据有两种后端，按配置选择：

| 后端 | 开启方式 | 特点 |
| - | - | - |
| SQLite | `ranks.db` / `RANKS_DB` 指定数据库文件路径 | 增量写入，不会因为条数变多而每次重写整份文件；适合配合 `max_per_type: 0`（不限条数）使用 |
| 文件（默认） | `ranks.dir` / `RANKS_DIR`（每类型一个 `<type>.json`）或 `ranks.path` / `RANKS_FILE_PATH`（全部类型一个文件） | 纯 JSON，写入为 500ms 防抖 + tmp+rename 原子替换（整份重写） |

- SQLite 用的是 Node 内置的 `node:sqlite`，**需要 Node 22.5 及以上**；启动时会打印一条 `ExperimentalWarning: SQLite is an experimental feature`（可忽略，或用 `--no-warnings` 关掉）。
- 配置了 `ranks.db` 但打不开（Node 版本过低、路径不可写、文件损坏等）时，会打印 `[RankMgr] SQLite 不可用，回退到文件存储: ...` 并自动改用文件后端，服务不会因此启动失败。
- 两种后端的数据**不互通**：切换后端不会自动迁移旧数据，旧榜单需要自己导入（SQLite 表结构：`scores(type, owner, name, score, date, uid, extra, client_id, address)`，其中 `owner` 为 `uid:xxx` 或 `name:xxx`）。

## 新增接口

接口代码在 `server/src/rest/`：

- `Router.ts`：路由注册与匹配，支持 `:name` 路径参数
- `AuthMgr.ts`：token 与权限
- `routes/`：具体接口，新增文件后在 `routes/index.ts` 里注册

处理器返回非 `undefined` 的值会以 200 返回 JSON；需要其它状态码时抛 `RestError`，或直接用 `c.res`：

``` ts
rest.router.get('/api/rooms/:key/clients', { access: 'admin' }, (c) => ({
  clients: Array.from(require_room(c.ctx, c.req.params.key).clients).map(v => v.info ?? {}),
}));

rest.router.post('/api/xxx', { access: 'client' }, (c) => {
  const text = str_of(body_of(c.req.body)?.text);
  if (!text) throw RestError.bad_request('缺少 text');
  const client = require_client(c);
  return { ok: true, name: client.client_info?.name };
});
```
