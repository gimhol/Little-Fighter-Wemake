# LFW 桌面客户端 & 弹幕桥（B站直播 -> 弹幕互动游戏）

本目录装着两件事：

- **弹幕桥服务**（`index.mjs` / `bilibili.mjs` / `open.mjs` / `scores.mjs`）：连接 B站直播弹幕流，把观众互动转成游戏指令发给弹幕互动游戏页面。不依赖、也不修改仓库里的 `server/`，可单独部署（和 OBS/浏览器同机运行即可）。
- **桌面客户端壳**（`app/`）：`start.exe` 的 Electron 主进程/预加载，负责无边框游戏窗口 + 本地静态服务 + 在进程内跑弹幕桥 + 托盘里的联机服务器开关 + 数据工具（`--tool`）；`npm run build:desktop`（根目录）把它打成 `release/Little Fighter Wemake_<version>.zip`，同时也能当 B站互动玩法的安装包上传。

## 安装与运行

```powershell
cd desktop
npm install
node index.mjs --room 12345
```

参数（命令行 / 环境变量 / 配置文件三选一，优先级：命令行 > 环境变量 > 配置文件）：

| 参数 | 环境变量 | 说明 |
| --- | --- | --- |
| `--room <id>` | `BILI_ROOM_ID` | 直播间号，短号/真实房间号都行（必填） |
| `--sessdata <v>` | `BILI_SESSDATA` | 登录 cookie 的 SESSDATA，可选；游客也能收弹幕，登录态更稳 |
| `--uid <id>` | `BILI_UID` | 配 SESSDATA 用的 DedeUserID，可选 |
| `--join <k1,k2>` | `DANMU_JOIN_KEYWORDS` | 触发入队的关键词；不填 = 任意弹幕都入队 |
| `--pick <kw=角色,...>` | `DANMU_PICK_KEYWORDS` | 指定角色入队/切换（如 `戴维斯=Davis`；仅常规角色） |
| `--cheer <k1,k2>` | `DANMU_CHEER_KEYWORDS` | 触发应援的关键词，默认 `加油,666,应援` |
| `--leave <k1,k2>` | `DANMU_LEAVE_KEYWORDS` | 触发退出的关键词（离队/场上退场），默认不启用 |
| `--join-cooldown <ms>` | `DANMU_JOIN_COOLDOWN` | 同一观众两次入队尝试的最小间隔，默认 5000 |
| `--port <port>` | `DANMU_BRIDGE_PORT` | 游戏页面连接端口，默认 8066 |
| `--host <host>` | `DANMU_BRIDGE_HOST` | 监听地址，默认 127.0.0.1（页面在别的设备上打开时才需要 `0.0.0.0`） |
| `--scores <path>` | `DANMU_SCORES_FILE` | 战绩存档文件，默认本目录 `scores.json` |
| `--config <path>` | `DANMU_BRIDGE_CONFIG` | 指定配置文件；默认自动读取本目录 `danmu.json5` / `danmu.json` |
| `--debug` | - | 打印所有弹幕事件，排障用 |
| `--dry` | - | 只打印解析后的配置（密钥脱敏）后退出，用于校验配置 |

### 配置文件

不想每次敲一长串参数（尤其是官方模式的密钥），复制模板即可：

```powershell
copy danmu.example.json5 danmu.json5
```

`danmu.json5` / `danmu.json` 已被 `.gitignore` 忽略，不会进仓库；字段名见模板里的注释，命令行参数可临时覆盖单项。

## 弹幕指令（观众做什么）

| 观众行为 | 效果 | 需要配置 |
| --- | --- | --- |
| 进入直播间（合作闯关） | **认领一个未认领的 Template**；没有占位且未满员时直接以 Template 入场；满员时不动（发弹幕才能排队） | 不需要 |
| 进入直播间（其他模式） | **场上未满时自动以 Template 入场**；满员时不动（发弹幕才能排队） | 不需要 |
| 发含入队关键词的弹幕（默认：任意弹幕） | 合作闯关 → 认领 Template；其他模式 → 排队入场，随机一名常规角色 | `--join`（默认任意） |
| 发含角色关键词的弹幕，如「戴维斯」 | 未入场 → 认领 Template（合作闯关）或以该角色入队；**已以 Template 入场 → 立即切换**为该角色 | `--pick 戴维斯=Davis` |
| 已入场（Template）后发入队关键词 | 切换为随机常规角色 | `--join` |
| 发含应援关键词的弹幕（默认 加油/666/应援） | 为自己角色应援：回血 15%（3 秒 CD） | `--cheer` |
| 发含退出关键词的弹幕（默认不启用） | 离开队列 / 场上角色立即退场 | `--leave` |
| 送礼物 / 上舰 / 醒目留言 | 视为应援 | 不需要 |
| 关注 / 分享 / 点赞 | 刷新活跃时间（避免排队超时被清） | 不需要 |

规则细节：

- **合作闯关**：开局与每关开始时默认生成 **4 个未认领的 Template 占位**（无名字、从关卡左侧入场）；观众进入直播间 / 发弹幕即认领一个（认领后头顶显示观众名），占位不够时直接以 Template 入场，再发角色关键词即切换为该角色；场上最多 32 名观众，满员后新观众排队，等有人阵亡或退场腾出位置
- **合作闯关的敌人数量按场上人数缩放**：每个关卡阶段（波次）开始时按场上人数——已入场的观众 + 未认领的 Template 占位（按角色强度算，Template 算 1 人）——计算倍率，敌人数 = 人数 × 关卡配置倍率（与普通闯关按 1/2 名玩家缩放同一套规则）；阶段中途的人数变化从下一波开始生效
- 角色仅限**常规角色**（Regular 组：`Davis / Deep / Dennis / Woody / Firen / Freeze / Louis / Rudolf / Henry / John`）；`--pick` 的值可用角色名（`Davis`）或角色 ID（如 `11`）
- 关键词匹配**忽略大小写**；`danmu.example.json5` 已为十名常规角色预置中文/英文昵称（拳王=Davis、深渊=Deep、奶妈=John、弓手=Henry、豆腐/忍者=Rudolf、铁甲=Louis、火人=Firen、冰人/冰佬=Freeze、腿王=Dennis、木头=Woody），可自行增改
- 只有 **Template** 状态允许中途切换；切换后即固定为该角色，想换就等下一局
- 入队时角色写错会退化为随机常规角色；切换时写错则忽略
- 同一人已在场上时不会重复入队；入队尝试有冷却（`--join-cooldown`，默认 5 秒）
- 队列上限 50、场上上限 32；排队中超过 5 分钟无任何互动会被自动移出
- 战死即出局：要重新发弹幕认领/入队，或退出直播间后再进（合作闯关认领 Template / 其他模式未满时以 Template 入场）
- 游戏内左上角面板底部会**轮播提示**（每 6 秒换一条，文案由本桥根据配置自动生成；没接桥时显示内置默认提示；其中「发角色名换人」每次轮播会**随机抽 3 个角色昵称**展示，昵称池 = `character_keywords` 里每个角色的首个关键词）

## 官方开放平台模式（推荐，有应用时）

```powershell
node index.mjs --mode open --app-id 12345 --access-key <xxx> --access-key-secret <yyy> --code <主播身份码>
```

流程：`POST /v2/app/start`（HMAC-SHA256 签名）换 `game_id` + 长连地址 + 鉴权体 → wss `op7` 鉴权 → 20 秒双心跳（wss `op2` + `POST /v2/app/heartbeat`）→ 断线自动重连（鉴权失败会重新 start）；Ctrl+C 退出时自动 `POST /v2/app/end`。

前置条件：

- 应用为互动玩法类型：`--app-id` 就是创作者服务中心里项目的「项目ID」；`access_key` / `access_key_secret` 随入驻审核通过邮件发放（也可在开平管理中心查看）
- **向 B站运营申请开通长连消息类型**（弹幕/礼物/点赞等，未申请收不到消息）
- 主播身份码 `code`：主播在直播姬启动你开发中的玩法时产生并传给玩法（联调阶段用官方测试入口拿到的 code）

消息映射：`LIVE_OPEN_PLATFORM_DM` → 入队/应援；`LIVE_OPEN_PLATFORM_SEND_GIFT` / `_GUARD` / `_SUPER_CHAT` → 应援；`LIVE_OPEN_PLATFORM_LIKE` → 刷新活跃。

## 游戏侧对接

游戏页面加 URL 参数即可连接本服务：

- 同机默认地址：`#/?DANMU_WS=1`
- 自定义地址：`#/?DANMU_WS=ws://192.168.1.5:8066`（值里若含 `&` 需 URL 编码）

页面会周期上报状态，桥的控制台会打印：`[游戏] teams8 排队 12 / 场上 30`。

## 事件映射（B站事件 → 游戏指令）

| B站事件 | 游戏指令 |
| --- | --- |
| 进入直播间 | `enter`：合作闯关认领一个未认领的 Template（没有占位且未满员时直接以 Template 入场）；其他模式场上未满时以 Template 直接入场（同人 10 秒内只发一次）+ `touch` |
| 弹幕（命中角色关键词，且在场为 Template） | `switch` 切换为该角色 |
| 弹幕（命中入队规则） | `join` 合作闯关先认领 Template，否则排队入场（uid 去重；同一人已在场上时不会重复入队） |
| 弹幕（命中应援关键词） | `cheer` 应援（引擎内 3 秒 CD） |
| 弹幕（命中退出关键词） | `leave` 离队 / 场上退场 |
| 关注 / 分享 / 点赞 | `touch` 刷新活跃时间 |
| 礼物 / 上舰 / 醒目留言 | `touch` + `cheer` |
| 开播 / 未开播 | 日志提示 |

## 战绩持久化与积分榜

- 游戏页面每 10 秒把观众战绩（按 uid：出场/击败/阵亡/伤害/应援）同步给桥；桥按**增量累计**保存到 `scores.json`（已 gitignore，重启不丢）
- 游戏页面刷新/重开时新一局计数从 0 开始，桥会自动识别为新场次继续累计（`games` +1）；桥自身重启后接着算，不重复计
- 积分口径可在配置里改（默认 击败×10、出场×1、应援×1，阵亡/伤害×0）：

```json5
score_weights: { kills: 10, spawns: 1, cheers: 1, deads: 0, damages: 0 }
```

- 榜单页：`http://127.0.0.1:8066/`（与游戏 ws 同端口，可直接当 OBS 浏览器源，10 秒自动刷新）；原始数据 `GET /scores.json`

## 关于"离开直播间"

B站常规弹幕流没有离场事件（只有进入/互动），所以采用活跃超时兜底：

- 桥侧：收到该用户任何互动就 `touch(uid)`（最多 30 秒发一次，避免刷屏）
- 引擎侧：排队中超过 5 分钟没有任何 `touch` 会自动移出队列
  （`src/LFW/ui/component/DanmuGameLogic.ts` 里的 `QUEUE_IDLE_TIMEOUT`，可按直播节奏调整）
- 已经在场上打的人不受超时影响，只在战死或换关时出局
- 若将来数据源能提供离场事件，收到后发 `{ type: "leave", uid }` 即可立即出队（引擎已支持）

## 桌面客户端 / B站互动玩法安装包（幻星互动）

`start.exe` 就是 **Little Fighter Wemake 的桌面客户端**：双击即玩（不接直播就是单机），接上直播后就变成弹幕互动玩法。同一个包也能直接当 B站互动玩法的「程序文件」上传（包内 = 游戏本体 + 弹幕桥 + Electron 壳，全部离线自包含）。包内另附 `readme.txt`（快速上手）与 `help.md`（完整命令行与配置说明），命令行下 `start.exe --help` 打印简要用法。

```powershell
# 1) 先准备好开平应用密钥（会被打进包里的 danmu.json5）
copy desktop\danmu.example.json5 desktop\danmu.json5
#    编辑 danmu.json5：app_id / access_key / access_key_secret
#    （没有 desktop\danmu.json5 时，构建会把 danmu.example.json5 原样作为包内默认配置）
# 2) 构建（build:desktop 是同一脚本的别名）
npm run build:playable
#    输出 release/Little Fighter Wemake_<version>.zip（上传用）
#    以及同名解包目录 release/Little Fighter Wemake_<version>\（里面的 start.exe 可直接运行）
```

- 包名格式 = 项目名_版本号（脚本自动取 `package.json` 的版本号，如 `Little Fighter Wemake_0.1.56.zip`）；根目录直接铺文件、入口 `start.exe`、文件全 ASCII 名、<500MB（B站“程序文件”上传要求；因为 B站要求入口必须叫 `start.exe`，桌面客户端的可执行文件也是这个名字）
- `start.exe` 是一个 **Electron 应用**（源码 `desktop/app/`：`main.mjs` 主进程 + `preload.cjs` 向页面暴露 Wails 兼容的 `window.runtime`），负责：
  - 起本地静态服务放游戏页面（默认 8067）
  - 在主进程里以开平模式跑弹幕桥（默认 8066，源即 `index.mjs`，构建时用 esbuild 打成 `bridge.bundle.mjs`）；只在配好弹幕来源（danmu.json5 / `code=` / `--room`）时启动，单机模式不会监听 8066
  - 开一个**无系统标题栏**的游戏窗口；画面顶部那条半透明区域就是拖拽区（按住拖动、双击最大化/还原），右上角依次是最小化 / 最大化还原 / 全屏 / 关闭；关闭窗口整个玩法退出
  - 把**联机服务器**（仓库 `server/`，构建时打成 `server.bundle.cjs`）与**数据工具**（仓库 `tool/`，打成 `tool.bundle.cjs`）一起带上，都由主进程直接拉起，运行机不需要另装 Node
  - `tools\` 里附带 ffmpeg 与 Imagemagick 全套转换器（构建机上有就自动拷进来），数据工具会优先用它们，运行机也不需要另装
- 顶栏窗口按钮复用游戏里已有的 Wails 运行时调用（`window.runtime.*`），所以网页端、Wails 端、Electron 端三套壳共用同一段 UI 代码
- 身份码不用手填：直播姬/平台拉起时按 `start.exe code=xxxxxxxxxx` 传入（自动从启动参数解析）；本地调试也可直接 `start.exe code=你的身份码`
- 本地调试技巧：`start.exe --room 12345` 用 web 模式收弹幕免密钥；`--debug` 打印事件；`--devtools` 开开发者工具；`--screenshot <path>` 把窗口内容截成 PNG；`--port` / `--game-port` / `--host` 可改端口
- 不开弹幕、纯局域网多人：托盘勾选「允许局域网访问游戏页面」并开启联机服务器 + 勾选「允许局域网连接」（或启动时带 `--host 0.0.0.0 --server --server-lan`），朋友浏览器打开 `http://<你的IP>:8067/` 就能玩你这份游戏，再在游戏「联机面板」填 `你的IP:8080` 联机
- 没配上任何弹幕来源（无密钥无身份码也没房间号）时，`start.exe` 以**单机桌面模式**启动：只开游戏页面并提示原因，不会直接报错退出

### 系统托盘（右下角图标）

- **开启/关闭联机服务器**：默认只监听 `127.0.0.1:8080`（被占用时自动向后找空闲端口），菜单标题会实时显示当前地址
- **允许局域网连接**：勾选后服务器改听 `0.0.0.0`，同一网络下的人用「复制联机地址」得到的地址就能连进来（切换时会自动重启服务器）
- **允许局域网访问游戏页面**：勾选后游戏页面改听 `0.0.0.0`（等价于启动参数 `--host 0.0.0.0`，端口不变、游戏窗口不受影响）；配合「复制游戏页面地址」把地址发给别人
- **打开数据工具（命令行）**：在包目录开一个控制台窗口（包内 `tools\lfwm-console.cmd`），自动 `--tool help` 列出全部命令，光标停在本目录，可以直接接着敲 `start.exe --tool make-data-zip -c conf.json5`
- **复制数据工具命令** / **打开数据目录** / **显示游戏窗口** / **退出**

### 桌面端专属命令行参数

| 参数 | 说明 |
| --- | --- |
| `--server` | 启动时自动开启联机服务器（默认 8080，仅本机） |
| `--server-port <port>` | 联机服务器起始端口，默认 8080（被占用时自动向后找） |
| `--server-lan` | 直接以局域网模式开启（等价于托盘里勾选「允许局域网连接」） |
| `--tool <命令...>` | 后面的参数原样交给**数据工具**，例如 `start.exe --tool help`、`start.exe --tool make-data-zip -c conf.json5`；转换用的 ffmpeg/magick 已随包附在 `tools\`，无需装到 PATH |
| `--user-data <目录>` | 指定用户数据目录（想同时开多个实例调试时用） |
| `--help` / `-h` | 打印客户端全部命令行用法（含弹幕桥参数）后退出 |

- 把 LF2 目录（或数据工具的 conf 文件）**直接拖到 `start.exe` 上**（等价于 `start.exe --tool <路径>`），会自动开一个数据工具控制台并按拖入路径开始转换；游戏已经开着时拖拽也照样生效

服务器存档（`ranks/`）与工具的工作目录默认都在 `start.exe` 所在目录；服务器日志会一并写进 `logs.txt`（以 `[server]` 开头）。

`tools\` 里放的是 ffmpeg（gyan.dev full build，GPL）与 ImageMagick（Apache-2.0）及其 License/NOTICE 文件；想让工具改用系统里的版本，在工具的配置里改 `FFMPEG_CMD` / `MAGICK_CMD` 即可（自带的优先级最高）。
- 构建脚本还会删掉 `lfw.full.zip`、把 Electron 的语言包精简到 `en-US / zh-CN / zh-TW`，并检查非 ASCII 文件名与 500MB 上限，最后把解包目录固定输出到 `release\Little Fighter Wemake_<version>\`（同名旧目录会先清掉；`--keep` 可额外保留临时构建目录）
- 构建机只需要 Node.js：根目录 `npm i` 会装好 esbuild 与 ws，主进程 / 弹幕桥 / 联机服务器 / 数据工具四个 bundle 都由 esbuild 打包，不再需要 Bun；还需要能在 PATH 里找到的 `ffmpeg` 与 `magick`（会被拷进包的 `tools\`；也可用 `FFMPEG_PATH` / `MAGICK_PATH` 指定，或 `--no-converters` 跳过）；首次打包会下载 Electron win32-x64（约 110MB），产物解包约 550MB（其中转换器 178MB）、zip 约 258MB

## 常见问题

- **认证失败（code 非 0）**：通常是 token 过期或风控，服务会自动重连并重新取 token；频繁失败建议加 `--sessdata`。
- **改了配置没生效**：优先级是 命令行 > 环境变量 > 配置文件；先用 `--dry` 看实际生效的配置；默认读取的是 `desktop/danmu.json5`（或 `danmu.json`）。
- **官方模式返回 `4001 应用无效`**：检查 `--app-id` / `--access-key` / `--access-key-secret` 是否配对（用假密钥探测也会得到这个返回，说明网络与签名没问题）。
- **官方模式收不到弹幕**：确认已向 B站运营申请开通消息类型，以及 `--code` 是当前主播本次启动产生的、未过期。
- **断流**：服务内置心跳（30 秒）与 90 秒无消息看门狗，断开后按 3s → 30s 退避重连。
- **收不到弹幕但要先确认房间**：先看控制台打印的 `房间 xxx -> yyy` 是否正确；用 `--debug` 看原始事件。
- **页面没反应**：确认游戏页 URL 带了 `DANMU_WS` 参数；桥和页面必须网络互通（同机就查防火墙/端口）。

---

主笔：Gim / 润色：DeepSeek V4 Flash
