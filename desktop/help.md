# Little Fighter Wemake 帮助

`start.exe` = 游戏本体 + 弹幕桥 + 联机服务器 + 数据工具的桌面客户端；本文件随包分发（Markdown 格式）。

## 一、启动方式

- 双击 `start.exe`：默认单机游戏；配好弹幕来源（danmu.json5 或平台传入）后即以弹幕互动玩法运行
- `start.exe code=<主播身份码>`：直播姬 / 幻星互动拉起玩法时自动传入（手动填可用于 open 模式联调）
- `start.exe --room <直播间号>`：web 模式，免审核、免密钥，直接收该直播间弹幕（本地调试用）
- 拖拽：把 LF2 目录（或数据工具的 conf 文件）拖到 `start.exe` 上，会打开数据工具控制台并按拖入的路径开始转换
- `start.exe --tool <命令...>`：只使用数据工具、不启动游戏（见「六、数据工具」）

## 二、窗口与托盘

- 窗口没有系统标题栏：按住画面上方那条半透明区域可以拖动窗口，双击该区域最大化 / 还原
- 右上角按钮依次是：最小化 / 最大化还原 / 全屏 / 关闭；关闭窗口即整个程序退出
- 一个直播间同时只能开启一个玩法；重复启动会聚焦已有窗口
- 托盘菜单（任务栏右下角图标）：
  - 联机服务器组：开启 / 关闭联机服务器（默认只监听本机 `127.0.0.1:8080`）；允许局域网连接（勾选后改听 `0.0.0.0`，切换会自动重启服务器）；复制联机地址
  - 游戏页面组：允许局域网访问游戏页面（勾选后改听 `0.0.0.0`，不用再带 `--host 0.0.0.0`；端口不变、游戏窗口不受影响）；复制游戏页面地址（同一网络下用浏览器打开它即可）
  - 更新组（仅安装版）：检查更新；发现新版本会在后台自动下载，完成后可「重启并更新」，也会弹窗询问（B站解压版 / 绿色版没有这项）
  - 其他：打开数据工具（命令行）/ 复制数据工具命令 / 打开数据目录 / 打开模组目录（括号里是本次加载的模组数量）/ 显示游戏窗口 / 退出
  - 菜单语言：启动时用系统语言（Windows 显示语言），游戏内切换语言时托盘跟着变；想固定用启动参数 `--lang`；自定义文案放在本目录 `langs\` 文件夹（每语言一个文件，写法见 `langs\README.txt`）

## 三、命令行选项

写法：`--xxx <value>` 与 `--xxx=<value>` 等价；布尔选项出现即为开启；`--tool` 优先于其他参数。

| 选项 | 说明 |
| --- | --- |
| `--help`, `-h` | 打印简要用法后退出（更完整的就是本文件） |
| `--user-data <目录>` | 指定用户数据目录（想同时开多个实例调试时用） |
| `--debug` | 打印收到的弹幕事件（调试用） |
| `--devtools` | 打开开发者工具 |
| `--screenshot <path>` | 启动后把窗口画面截图保存为 PNG |
| `--host <host>` | 监听地址，默认 `127.0.0.1`；改成 `0.0.0.0` 可让局域网直接访问游戏页面（8067；弹幕模式下也开放弹幕桥 8066）。游戏页面也可以不写参数，直接用托盘开关「允许局域网访问游戏页面」切换 |
| `--port <port>` | 弹幕桥端口，默认 8066（被占用时会提示并退出） |
| `--game-port <port>` | 游戏页面端口（内置网页服务），默认 8067（被占用时自动向后找空位） |
| `--server` | 启动时自动开启联机服务器（默认仅本机 8080） |
| `--server-port <port>` | 联机服务器起始端口，默认 8080（被占用时自动向后找） |
| `--server-lan` | 与 `--server` 同用时直接以局域网模式开启 |
| `--lang <code>` | 界面（托盘）语言：默认启动用系统语言、游戏内切换时跟随；可固定为 `zh-hans` / `zh-hant` / `en` 等（其他语言码需在 `langs\` 里提供文案，否则用英文）；`--lang auto` 恢复默认行为 |
| `--mods <目录>` | 额外模组目录（和默认的两个目录一起加载，最后加载 = 优先级最高）；见下文「五、模组」 |
| `--no-mods` | 不自动加载任何模组目录（排查模组相关问题时用） |
| `--tool <命令...>` | 后面的参数原样交给数据工具，如 `--tool help`、`--tool make-data-zip -c conf.json5` |

弹幕来源（与 danmu.json5 字段同名；优先级：命令行 > 环境变量 > 配置文件）：

| 选项 | 说明 |
| --- | --- |
| `code=<身份码>` | 官方开放平台主播身份码（主播启动玩法时产生） |
| `--room <id>` | web 模式直播间号 |
| `--mode <web\|open>` | 强制来源模式；不填按凭据自动判断（凭据齐 → open，否则 web） |
| `--app-id <id>` | 开放平台应用 ID（项目ID） |
| `--access-key <key>` | 开放平台 access_key |
| `--access-key-secret <sk>` | 开放平台 access_key_secret |
| `--open-host <url>` | 开放平台地址，默认 `https://live-open.biliapi.com` |
| `--sessdata <value>` | web 模式登录 cookie 的 SESSDATA（可选，登录态更稳） |
| `--uid <id>` | 配 `--sessdata` 用的 DedeUserID |

弹幕指令（关键词均为「包含」匹配、忽略大小写）：

| 选项 | 说明 |
| --- | --- |
| `--join <kw1,kw2>` | 触发入队的关键词；留空 / 不填 = 任意弹幕都入队 |
| `--pick <kw=角色,...>` | 指定角色入队 / 切换（角色用英文 ID，如 戴维斯=Davis、拳王=Davis） |
| `--cheer <kw1,kw2>` | 触发应援的关键词，默认 `加油,666,应援` |
| `--leave <kw1,kw2>` | 触发退场的关键词，默认不启用 |
| `--join-cooldown <ms>` | 同一观众两次入队尝试的最小间隔，默认 5000 |

## 四、弹幕配置（danmu.json5）

- 位置：与 `start.exe` 同目录；包内已带一份完整默认配置（关键词与角色昵称已预置，不含任何密钥），直接编辑即可
- 也支持 `danmu.json`（纯 JSON），或命令行 `--config <path>` / 环境变量 `DANMU_BRIDGE_CONFIG` 指定任意路径
- 优先级：命令行 > 环境变量 > danmu.json5 / danmu.json > 默认值

字段：

| 字段 | 说明 |
| --- | --- |
| `mode` | `"web"` 或 `"open"`；不填按凭据自动判断（凭据齐 → open，否则 web） |
| `room` | 直播间号（web 模式） |
| `sessdata` / `uid` | web 模式登录 cookie（可选，登录态更稳） |
| `app_id` / `access_key` / `access_key_secret` / `code` / `open_host` | open 模式（官方开放平台）凭据 |
| `join_keywords` | 触发入队的关键词数组；空数组 = 任意弹幕都入队 |
| `leave_keywords` | 触发退场的关键词数组，默认不启用 |
| `cheer_keywords` | 触发应援的关键词数组，默认 `["加油","666","应援"]` |
| `character_keywords` | 角色关键词 → 角色 ID 的对象，如 `{ "戴维斯": "Davis" }`（角色仅限常规角色） |
| `join_cooldown` | 同一观众两次入队尝试的最小间隔（毫秒），默认 5000 |
| `scores_file` | 战绩存档路径，留空 = 本目录 `scores.json` |
| `score_weights` | 积分权重 `{ kills, spawns, cheers, deads, damages }` |
| `port` / `host` | 弹幕桥端口与监听地址 |
| `debug` | 打印弹幕事件 |

对应环境变量：

```
BILI_APP_ID / BILI_ACCESS_KEY / BILI_ACCESS_SECRET / BILI_CODE / BILI_ROOM_ID /
BILI_SESSDATA / BILI_UID / BILI_OPEN_HOST / DANMU_BRIDGE_MODE / DANMU_BRIDGE_CONFIG /
DANMU_JOIN_KEYWORDS / DANMU_PICK_KEYWORDS / DANMU_CHEER_KEYWORDS / DANMU_LEAVE_KEYWORDS /
DANMU_JOIN_COOLDOWN / DANMU_BRIDGE_PORT / DANMU_BRIDGE_HOST / DANMU_SCORES_FILE
```

> 注意：数据工具用的是另一个文件 `conf.json5`（用 `-c` 指定），跟这里的 danmu.json5 互不相干。

## 五、模组（mods）

把模组包（`*.zip`）放进模组目录，**启动时自动加载**，不用在游戏里手动选文件（相当于入口页「添加模组」）。

模组目录（按加载顺序，越后面优先级越高，同名资源以后者为准）：

1. `<程序目录>\mods\`（和 `langs\`、`danmu.json5` 同级，托盘「打开模组目录」可以直接打开）
2. `<用户数据目录>\mods\`（默认 `%APPDATA%` 下的应用目录；用 `--user-data` 可以改）
3. `--mods <目录>` 指定的目录（可选，多个时最后指定的优先）

支持的两种 zip：

- **普通数据包 zip**：与本体数据合并，入口页「额外数据」会列出本次加载的模组
- **自定义游戏包 zip**：内含 `index.json`（指向包内的 `prel.zip` / `data.zip` 等）时，整个游戏被它替换；目录里有多个时只认第一个（按文件名排序）

在模组目录里可以放一个 `mods.json5`（或 `mods.json`）控制顺序与禁用：

```json5
{
  // 加载顺序：先列出的先加载，后面的覆盖前面的；没列出的按文件名排在最后
  order: ["基础模组.zip", "覆盖补丁.zip"],
  // 不加载
  disabled: ["先别用的模组.zip"],
}
```

- 改动模组目录 / `mods.json5` 后需要重启游戏生效（启动时会打印 `模组: 已加载 N 个（...）`）
- 想临时加一个目录：`start.exe --mods D:\my_mods`；想完全关掉：`start.exe --no-mods`

## 六、联机服务器（Multiplayer Server）

`start.exe` 内置了联机服务器（无需另装 Node），存档与日志都在本目录。

### 开启与地址

- 开启方式：托盘菜单「开启联机服务器」；或启动参数 `--server`（可配 `--server-port`、`--server-lan`）
- 默认只监听本机 `127.0.0.1:8080`——开给自己机器上的浏览器 / 多开实例调试用
- 想让同一网络下的其他人连入：托盘勾选「允许局域网连接」（服务器改听 `0.0.0.0`），再用「复制联机地址」把 `IP:端口` 发给对方
- 端口被占用时会自动从起始端口往后找空闲端口（日志里会看到提示与实际端口），也可以用 `--server-port` 指定起始端口；切换「允许局域网连接」时服务器会自动重启

### 玩家怎么加入

1. 打开游戏（各自的客户端，或网页版），进入「联机面板」（游戏菜单里的联机项）
2. 在「地址」里填房主的联机地址，如 `192.168.1.5:8080`（就是托盘「复制联机地址」得到的 `主机:端口`；也可以带协议写成 `ws://主机:端口`。面板默认地址是线上服务器 `lfj.gim.ink`，要连本地 / 局域网记得替换）
3. 点连接：连上后会列出房间列表；「创建房间」开新房，或对房间点「加入」（有密码的房间需要输入密码）
4. 房间列表里标有游戏版本与数据包信息；**同房玩家的游戏版本与数据包应保持一致**（游戏内靠它校验数据一致性）

### 让局域网外的人连（进阶）

- 需要公网 IP / 端口映射，或在公网机器上自行部署（仓库 `server/` 的服务器独立于本包，支持 HTTPS、REST 管理等）
- 网页版（https 页面，如 lf.gim.ink）连 `ws://` 地址会被浏览器拦截（混合内容），需要在浏览器里允许「不安全内容」——调试完记得改回去

### 不开弹幕也能玩：局域网多人（可选）

游戏页面就是 `start.exe` 内置的网页服务（默认 8067 端口），窗口里加载的和浏览器打开的是同一个页面；不需要任何弹幕配置，可以直接把 `start.exe` 当房主用：

1. 启动：双击后直接在托盘里勾选「允许局域网访问游戏页面」，并开启联机服务器、勾选「允许局域网连接」；也可以启动时直接带 `start.exe --host 0.0.0.0 --server --server-lan`
2. 让朋友用浏览器打开：`http://<你的IP>:8067/`（启动日志里的「游戏页面（局域网）」那行就是完整地址）——打开就能玩你这份游戏
3. 一起联机：朋友在游戏「联机面板」的地址里填 `你的IP:8080`（托盘「复制联机地址」得到的就是它）→ 连接 → 创建 / 加入房间

首次这样启动时 Windows 可能弹出防火墙询问，允许「专用网络」即可；局域网内没有鉴权，端口不要暴露到公网。

### 数据、日志与接口

- 服务器存档 / 排行数据写入本目录 `ranks/`（桌面端自动指定，可用 `RANKS_DIR` 环境变量改）
- 服务器日志并入 `logs.txt`（以 `[server]` 开头）
- 服务器同时提供 REST 接口（与 WebSocket 同端口）：

```
GET  /api                接口清单
GET  /api/stats          服务器统计
GET  /api/rooms          房间列表
GET  /api/rooms/:key     房间详情
GET  /api/clients        客户端列表（admin）
POST /api/auth/token     申请玩家 token
POST /api/ranks          提交排行分数
GET  /api/ranks/:type    查询排行
```

## 七、数据工具（LF2W Tool）

把 LF2 原版目录转换成游戏需要的数据包（含音频 / 图片转换），也可以直接跑数据处理脚本。

### 打开方式

- `start.exe --tool <命令...>`（不启动游戏，直接跑工具）
- 托盘「打开数据工具（命令行）」：在本目录开一个控制台（`tools\lfwm-console.cmd`），光标已停在本目录
- 把 LF2 目录（或 conf 文件）直接拖到 `start.exe` 上

### 命令

| 命令 | 作用 |
| --- | --- |
| `main` | 依次执行 `make-data-zip` + `make-prel` + `zip-full` |
| `make-data-zip` | 把 LF2 目录转换成游戏数据并打包成 `data.zip`（同时生成描述文件 `data.zip.json`） |
| `make-prel` | 把 prel 目录打包成 `prel.zip`（同时生成 `prel.zip.json`） |
| `zip-full` | 把 `data.zip` + `prel.zip` 与索引合并成 `lfw.full.zip` |
| `make-data` | 只做转换、不打 zip（方便先检查转换结果） |
| `dat-2-txt` | 把 `.dat` 解析成 `.txt`（查看 / 排障用） |
| `pick` | 从已转换的数据里挑选部分资源重新打包（进阶，需要额外的 `IN_LFW_DIR` / `LFW_PICKS` 等配置） |
| `print-conf` | 打印配置模板，复制成 `conf.json5` 填好即可用 |
| `version` / `help` | 版本号 / 帮助 |

### 常用参数

| 参数 | 说明 |
| --- | --- |
| `-c`, `--conf <file>` | 指定配置文件；缺省读工作目录下的 `conf.json5` / `conf.json` |
| `-i`, `--input <dir>` | LF2 目录（转换的输入） |
| `-o`, `--output <dir>` | 输出目录，默认 `./public` |
| `-t`, `--temp <dir>` | 临时目录，默认 `./temp` |
| `-d`, `--dont-wait` | 跑完不等待按键直接退出（脚本 / 命令行里用） |
| `--ffmpeg <cmd>` | 指定 ffmpeg（默认优先用包内 `tools\ffmpeg.exe`） |
| `--magick <cmd>` | 指定 ImageMagick（默认优先用包内 `tools\` 里的） |
| `--debug` | 输出调试日志 |

### 两种拖拽用法

- 拖 **LF2 目录**：自动在工作目录生成 `<目录名>.conf.json`，在目录旁生成 `<目录名>.temp` / `<目录名>.output`，并依次产出 data / prel / full 包（放在 `.output` 里）
- 拖 **conf 文件**：按该配置依次产出 data / prel / full 包

### 转换器

- 包内 `tools\` 已附带 ffmpeg 与 ImageMagick（构建机拷入），数据工具优先使用它们，运行机不需要另装
- 想用自己那份：在 conf 里改 `FFMPEG_CMD` / `MAGICK_CMD`（或命令行 `--ffmpeg` / `--magick`），或删掉 `tools\` 改用 PATH 里的
- 默认音频转码参数 `-codec:a libmp3lame -b:a 128k -ar 44100`（`FFMPEG_OPTS` 可改）

### 示例

```text
start.exe --tool help
start.exe --tool print-conf
start.exe --tool make-data-zip -c conf.json5
start.exe --tool main -c conf.json5
```

## 八、文件与端口一览

| 路径 / 端口 | 说明 |
| --- | --- |
| `danmu.json5` | 弹幕玩法配置（不填也能以单机模式运行） |
| `langs/` | 自定义界面文案（托盘语言文件，可留空；写法定 `langs\README.txt`） |
| `mods/` | 模组目录（`*.zip` 启动时自动加载，可放 `mods.json5` 控制顺序 / 禁用） |
| `logs.txt` | 运行日志（`[server]` 开头的是联机服务器日志） |
| `scores.json` | 弹幕互动积分榜数据（榜单页 `http://127.0.0.1:8066/`，仅弹幕模式） |
| `ranks/` | 联机服务器存档 / 排行数据 |
| `tools/` | ffmpeg / ImageMagick 与命令行控制台 `lfwm-console.cmd` |
| `readme.txt` / `help.md` | 快速上手 / 本文件 |
| 8066 | 弹幕桥（与积分榜页同端口；**仅接入弹幕来源时开启**，单机模式没有） |
| 8067 | 游戏页面（`start.exe` 内置的网页服务，窗口里加载的就是它；被占用自动向后找空位） |
| 8080 | 联机服务器（默认关闭，仅本机） |

## 九、常见问题

| 现象 | 处理 |
| --- | --- |
| 收不到弹幕 | 确认 danmu.json5 凭据 / 房间号正确；加 `--debug` 看有没有事件输出 |
| 页面没反应 | 游戏页 URL 需要带 `DANMU_WS` 参数；桥和页面必须网络互通（同机查防火墙 / 端口） |
| 联机连不上 | 确认房主端勾选了「允许局域网连接」，地址用「复制联机地址」的 `IP:端口`；双方版本 / 数据包要一致 |
| 朋友用网页版连不上 | https 页面连 `ws://` 会被浏览器拦（混合内容），建议双方都用客户端，或让浏览器允许不安全内容 |
| 端口被占用 | 联机服务器与游戏页面会自动向后找空闲端口（日志里会提示实际端口）；弹幕桥端口被占用会直接退出，可用 `--port` 指定 |
| 8066 榜单页打不开 | 单机模式不启动弹幕桥（8066 没有服务）；配好 danmu.json5 或带 `code=` / `--room` 启动后才有 `http://127.0.0.1:8066/` |
| 官方模式报错 | 检查 app_id / access_key / access_key_secret 是否配对；消息类型需要向 B站运营申请开通 |
| 转换失败 / 没有输出 | 看数据工具控制台的报错；确认 ffmpeg / magick 可用（包内 `tools\` 或 PATH）；`--tool print-conf` 对照配置项 |
| 模组没生效 | 日志里看有没有 `模组: 已加载 ...`；确认 zip 放在 `mods\` 里（不是子目录）、没被 `mods.json5` 的 `disabled` 排除；改完目录要重启；用 `--no-mods` 启动过的话把它去掉 |

---

命令行下运行 `start.exe --help` 可看简要版；本文件（help.md）是完整版。
