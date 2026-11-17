# 多人联机游戏

[中文](README.MD) | [English](README.EN.MD)  

## 一些废话

- 没有太仔细的测试，不知道会不会出现同步失效的情况
- 在 Windows Chrome 与 Windows Firefox 测试过（Firefox有时候点connect没反应...）
- Android 浏览器也可以用，但性能似乎有比较大的问题

## 运行联机服务器

我的服务器在阿里云(广州)，而且设备配置比较低。
基于nodejs开发，经测试bun和deno也都可以运行。
你可能想要用自己的设备作为联机服务器。

- 下载: [server.cjs](https://github.com/gimhol/Little-Fighter-Wemake/releases/tag/v0.1.0)

- 安装运行环境(选一个即可): [Node.js](https://nodejs.org/) | [Bun](https://bun.sh/) | [Deno](https://deno.com/)

- 命令行(根据安装的运行环境选一个)

  | 运行环境 | 命令 |
  | - | - |
  | Node.js | `node ./server.cjs` |
  | Bun | `bun ./server.cjs` |
  | Deno | `deno ./server.cjs` |

- 默认将运行在`ws://localhost:80`，需要更多配置，见“联机服务器配置”

## 联机服务器配置

- 你需要创建文件，文件名为：`.env`
- 配置文件内容（注意等号两侧不需要空格）:

  ``` plaintext
  HTTP_PORT=80
  HTTPS_PORT=443
  SSL_KEY_FILE_PATH=SSL的密钥文件（不需要SSL的话留空）
  SSL_CER_FILE_PATH=SSL的证书文件（不需要SSL的话留空）
  ADMIN_PWD=管理员token（不需要管理接口的话留空）
  RANKS_FILE_PATH=排行数据文件路径（可留空）
  ```

- 想写得更结构化的话，可以用配置文件代替 `.env`：在运行目录放一个 `server.config.json5`（JSON5，支持注释）。
  优先级为 命令行参数 > 环境变量 > 配置文件 > 默认值，完整配置项见 [REST API 文档的“配置文件”章节](REST%20API.MD#配置文件)。
  构建时如果 `server/server.config.json5` 存在，它和 `.env` 一样会被拷贝到 `dist/cjs`。

## REST 接口

服务器同时提供 HTTP 接口（与 WebSocket 共用同一个端口），可用于查询服务器状态与房间列表、管理房间、申请玩家 token，以及提交与查询排行榜分数、提交玩家建议（游戏内入口页/主页右下角的「Any idea?」）。

接口文档：[REST API](REST%20API.MD)

## 顺带一提

在通常情况下，如果你的服务器不支持https访问的话，
[lf.gim.ink](https://lf.gim.ink)运行的游戏将无法连接你的服务器的。

除非让你的浏览器允许在https的页面中进行“不安全的连接”

如果你用的是Firefox, 你可以搜索 “火狐如何设置 network.websocket.allowInsecureFromHTTPS”
如果你用的是Chorme, 你可以搜索 “How to allow Chrome (browser) to load insecure content?”

**如果你做了这些,请务必记得还原这些设置!!!**
