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
  ```

## 顺带一提

在通常情况下，如果你的服务器不支持https访问的话，
[lf.gim.ink](https://lf.gim.ink)运行的游戏将无法连接你的服务器的。

除非让你的浏览器允许在https的页面中进行“不安全的连接”

如果你用的是Firefox, 你可以搜索 “火狐如何设置 network.websocket.allowInsecureFromHTTPS”
如果你用的是Chorme, 你可以搜索 “How to allow Chrome (browser) to load insecure content?”

**如果你做了这些,请务必记得还原这些设置!!!**
