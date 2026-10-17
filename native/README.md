# native —— LFW 核心的 C++ 实现

目标：**单一实现 / 平台解耦**。让 `src/LFW` 的规则层能在浏览器（WASM）、
Electron 桌面壳、以及将来的原生客户端上跑同一份逻辑。

对应关系：

| | TS（现状，唯一可运行实现） | C++（本目录） |
|---|---|---|
| 纯核心 | `src/LFW/` | `native/lfw/` |
| 宿主实现 | `src/DittoImpl/` | `native/host/`（`common/lfw_boot` 共享装配 + headless 宿主 `FsZip`/`HeadlessHost`/`lfw_run` + `wasm/` 的 C ABI 宿主 + `godot/` 的 GDExtension 宿主） |
| 前端宿主（JS 侧） | `src/DittoImpl/`（浏览器） | `native/web/`（JS 宿主 / 冒烟 / 打包 / 预演页） |
| 注入边界 | `src/LFW/ditto/Instance.ts` 的 `IDittoPack` | 镜像到 `native/lfw/ditto/`（`IXML` / `IXMLElement` / `IZip` / `IZipObject` 等宿主服务接口） |

---

## 硬规则（`native/lfw/` 下）

- **平台实现一律不许落在 `native/lfw/**`**：渲染、音频、图片、输入、时钟、wasm/ABI 这些**具体实现**
  只放 `native/host/**`（C++ 侧）与 `native/web/**`（JS 侧）；核心只留**接口**与**逻辑**。
  `lfw.h` 里与平台相关的东西只允许是"**宿主工厂**"（`create_world_renderer` / `create_ui_node_renderer`
  这种"向宿主索要实现"的钩子）。

这份规则和 `src/LFW/README.md` 是同一个意图的两面：
**让核心不可撤销地保持平台无关。**

> TS 侧：只能写标准 ECMAScript（由 `scripts/check-lfw-esonly.mjs` 保证）
> C++ 侧：只能写纯语言设施（由 `native/tools/check_lfw_cpp_includes.mjs` 保证）

**零宿主 · 零 IO · 零线程 · 零异常 · 零 RTTI · 零第三方库**

| 类别 | 禁止 | 应该用 |
|---|---|---|
| 文件 | `<filesystem>` `<fstream>` `<cstdio>` | 注入的 `IImporter` |
| 流 | `<iostream>` `<sstream>` | 什么都不用（核心不打印） |
| 线程 | `<thread>` `<mutex>` `<atomic>` `<future>` | 无（核心是单线程的） |
| 时间 | `<chrono>` `<ctime>` | 注入的 `IClock`（`base/clock.h`） |
| 随机 | `<random>` | `utils/math/mersenne_twister.h` |
| locale | `<locale>` `<regex>` | 待建的 `utils/math/string.h` |
| 异常 | `throw` / `try` / `catch` | `std::optional` / 指针返回 `nullptr` |
| RTTI | `typeid` / `dynamic_cast` | 标签 + `switch`（对应 TS 的 `is_fighter()` 那套） |
| 舍入 | `std::round` `std::rint` `std::nearbyint` | `utils/math/base.h` 里的 `round` |
| 格式化 | `std::to_string` | 待建的 `js_number_to_string` |
| 链接 | `target_link_libraries(lfw_core ...)` 非空 | **保持为空** |

```
npm run native lint
```

---

## ★ 确定性：这是移植门槛，不是优化选项

`src/LFW` 是纯逻辑 + 定点化物理，两侧必须一致，否则联机/回放会分叉。
已核到行的地雷清单：

| # | 坑 | 现有证据 | C++ 侧规矩 |
|---|---|---|---|
| 1 | **FMA 收缩** | — | MSVC 刻意不用 `/arch:AVX*`；Clang/GCC 必须 `-ffp-contract=off`。已在 `CMakeLists.txt` 里强制 |
| 2 | **`Math.round`** | `utils/math/base.ts` 里 `round = Math['round']` | JS 是 half-up **朝 +∞**（`Math.round(-0.5) === -0`）；`std::round` 是 half-away-from-zero，**必错**。用 `core/js_num.h` 的 `js_round` |
| 3 | **NaN 比较器** | `World.ts:50` `x_sorter`：`const d = a.aabb_min_x - b.aabb_min_x; if (d !== 0) return d;` | NaN 时 JS sort 规范把结果当 `+0`；`std::sort` 收到 NaN 返回 = 违反严格弱序 = **UB**。C++ 比较器必须把 NaN 归一成 0 |
| 4 | **`std::sort` 不稳定** | `BotController.chasings.sort` / `CameraCtrl.fighters.sort` / `NearestTargets.targets.sort` / `ReachableGroup.reachables.sort` / `MoveTableLogic._steps.sort` 都没有 tie-breaker | V8 `Array#sort` 自 7.0 起稳定 → 必须 `std::stable_sort` |
| 5 | **`String(number)`** | 字段拼接、XML 输出 | 最短往返（`to_chars`），**不是** `to_string`；且 JS 的指数阈值（`1e21` / `1e-7`）与 `to_chars` 不同 |
| 6 | **`Object.keys()` 顺序** | `loader/DatMgr.ts:135/157`：`JSON.stringify(xml_roundtrip) === JSON.stringify(this)` | JS = 整数键升序 + 字符串键插入序 → `OrderedMap` |
| 7 | **字符串比较 = UTF-16 code unit** | — | `std::string` 是 UTF-8 字节序：ASCII 一致，**中文不一致**。参与排序的键要么证明全 ASCII，要么用 `utf16_compare` |
| 8 | **`localeCompare`** | `ui/component/DanmuGameLogic.ts:272` | locale 相关，C++ 无等价物 —— 需要定死 collation |

### libm：唯一无法用编译选项消除的源

`round_float` 本身是**纯 IEEE 运算**（比较 + `+0.5` + `std::floor` + 除法），
所以它跨实现逐位一致 —— 差异只可能从它**上游**漏进来。上游只有两个来源：

- FMA 收缩 → 已用编译选项消除
- **libm 函数**（`pow` / `exp` / `log` / `sin` / `cos` / `tan` / `atan2` / `acos` / `asin` / `hypot`）
  → V8 用自己的 fdlibm 移植，MSVC 用 UCRT，**可以差 1 ULP 甚至更多**
  （`sqrt` 安全：IEEE 要求正确舍入）

**收口**：`src/LFW` 与 `native/lfw` 各有一个 `utils/math/base.h` 镜像同一组名字。
将来要让两侧数值一致，只改这两个文件。`src/LFW` 里已经 **0 处**直调 `Math.pow/cos/…`，
也 **0 处** `**` 运算符（`**` 与 `Math.pow` 同算法，也算泄漏）。

自检命令：

```powershell
Select-String -Path "src\LFW\*.ts","src\LFW\**\*.ts" -Pattern 'Math\s*\.\s*(pow|cos|sin|tan|atan2|hypot|acos|asin|exp|log)\s*\(|[\w\)\]]\s\*\*\s[\w\(\-\.]'
```

### 实体状态永远落在 1/1000 格点上

`Entity.set_position` / `set_velocity` **每次写入都过 `round_float`**
（`Entity.ts:2348` / `:2340`），`handle_gravity` / `update_velocity` 的中间量也是。

实测：60 万个格点样本，`round_float` 的不动点性质 **0 例外**。
⇒ 两侧状态**要么逐位相同，要么至少差 0.001**，**不存在"缓慢漂移放大"**。
⇒ 从相同状态出发、且该帧运算无 libm，则下一帧状态**逐位相同**（可证明）。

---

## ★ 共享可变单例：TS 里三个几何函数的隐藏语义

`normalize_plane` / `calc_plane` / `line_plane_intersection` 在 TS 里都返回
**模块级共享的可变对象**（`const result = {...}` 然后 `return result`）。

C++ 侧必须镜像 —— 返回指向文件级 static 的 `const Plane*` / `const Vec3*`，
**不能**按值返回。否则"先拿引用、再调用一次、回头读第一次的引用"会静默出错。

差分测试里的 `alias_*` 用例专门锁这个语义（见 `tests/differential/PROTOCOL.md` §1.3）。
另外这三个函数在 TS 里会 `throw`（`range` / `project_to_line`），
C++ 侧映射成 `std::optional` 的 `nullopt`。

---

## 目录

```
native/
  CMakeLists.txt                     确定性开关（FMA / 异常 / RTTI）
  CMakePresets.json                  msvc-x64 / wasm
  cmake/toolchains/emscripten.cmake  WASM（已验证：编出 liblfw_core.a；见「WASM 构建」节）
  lfw/                               ★ 纯核心
    core/                            JS 语义地基（TS 侧无对应物）
      js_num.{h,cpp}                 js_round / js_to_uint32 / f64_bits
      state_hash.{h,cpp}             FNV-1a 64（差分测试用）
    defines/
      i_bounding.h                   ← defines/IBounding
    base/
      clock.h                        注入式 IClock（禁止 <chrono>）
      graves.h                       ← base/Graves.ts（对象池）
    utils/
      math/                          ← 镜像 src/LFW/utils/math/
        base.h                       ★ libm 单一收口（镜像 base.ts）
        floor_float.h  round_float.h
        clamp.h  clamp_add.h  float_equal.h  normalize.h
        normalize_plane.{h,cpp}  calc_plane.{h,cpp}
        line_plane_intersection.{h,cpp}  range.{h,cpp}
        probability.{h,cpp}  project_to_line.{h,cpp}
        mersenne_twister.{h,cpp}     ← utils/math/MersenneTwister.ts
      array/
        loop_arr.h  make_arr.h  map_arr.h
      container_help/
        filter.h  find.h  fisrt.h  ensure.h  loop_offset.h
        map_no_void.h  nested_map.h  nested_multi_map.h
      easing/
        ease_linearity.h  ease_in_out_sine.h  ease_in_out_quint.h
      cross_bounding.h  utf8.{h,cpp}  times.{h,cpp}
    helper/
      manhattan_xz.{h,cpp}           ← helper/manhattan_xz.ts
      randoming.{h,cpp}              ← helper/Randoming.ts
    state/
      spawn_ice_piece.{h,cpp}        ← state/spawn_ice_piece.ts
    loader/ entity/ stage/ bot/ buff/ bg/ cmds/ controller/ ui/ animation/
      dat_translator/ ditto/                 ← 以上均已搬
      collision/（非叶子：靠 entity/buff/World）
    未搬（按需）：utils/container_help/{get_keys,list_fn}、utils/string_parser
  tests/differential/                ★ 两侧对拍（详见 PROTOCOL.md）
  tools/
    native.mjs                       configure / build / lint / test / godot（GDExtension）
    check_lfw_cpp_includes.mjs       分层规则检查
    shots_compare.mjs                整窗截图 → 逻辑屏幕网格的归一化叠图/逐像素差（窗口那套改动的证据）
    win_window_modes.ps1             --titlebar 四档的外部证据（Win32 style 位 / 非客户区尺寸 / 屏幕截图）
  host/                              ★ 宿主实现（M1：headless 可运行入口）
    fs_zip.{h,cpp}                   目录当 zip 用（`IZip` / `IZipObject` 的读盘实现）：`--zip <dir>`
    common/zip_file.{h,cpp}          **真 `.zip`**（中央目录 + stored/deflate，自带 inflate）+ 真 MD5
                                     （RFC 1321，与 `DittoImpl/md5.ts` 的 SparkMD5 逐位一致）。引擎无关
    common/key_code.{h,cpp}          `--key <name>` 的键名 → 真 `KeyboardEvent.key`（DOM 口径 + 别名表）
    headless_host.{h,cpp}            `ILfwHost` 的最小可用实现 + 手动时钟/定时器 + 空渲染器 + 键盘注入
    thin/                            录制型薄宿主：headless 的超集，只把世界渲染器换成「录制」
      recording_world_renderer.{h,cpp}  `IWorldRenderer` 的录制实现（逐帧快照字段表见文件头）
      thin_host.{h,cpp}                 `ThinHost`（覆写 `create_world_renderer`）+ 推帧口（一 tick N 次）
      lfw_thin.cpp                      `lfw_thin`：与 `lfw_run` 同参数，打印/落盘绘制记录
    lfw_run.cpp                      `lfw_run`：装数据包 → 起世界 → 推帧（每 N 帧打摘要）
    common/lfw_boot.{h,cpp}          宿主无关的装配（选 stage/bg → 造战士）+ 一帧摘要：两宿主共用
    common/ui_input_handle.{h,cpp}   UI 输入那一半：指针事件 → 命中测试（`UINode` 模型上的矩形）
                                     → `POINTER_*` 命令（`--paths/--pages/--points`）。镜像
                                     `src/DittoImpl/ui/HeadlessUIInputHandle.ts`，**无引擎类型**
    godot/                           ★ Godot 宿主（GDExtension；见「Godot 宿主」节）
      lfw_godot_host.{h,cpp}         `LfwGodotHost : HeadlessHost`：注入虚拟时钟 + 固定步长累加器
                                     + `create_world_renderer` / `create_ui_node_renderer`（覆写那两处空实现）
                                     + `set_measure_text`（宿主侧文字度量的装入口）
      lfw_godot_renderer.{h,cpp}     `IWorldRenderer` 的实现：契约数据 → **引擎无关**的绘制项（无 Godot 类型）
                                     + UI 那一遍的落点（`ui_begin/append/end_layer` + `probe_path`）
      lfw_godot_ui_renderer.{h,cpp}  `IUINodeRenderer` 的实现：UI 模型树 → 同一批**引擎无关**的绘制项
      lfw_godot_textures.{h,cpp}     资源路径 → `ImageTexture` 缓存（字节走数据包，解码走引擎的 PNG 解码器）
      lfw_godot_node.{h,cpp}         `LfwGodot : Node2D`：命令行 → `boot_scene` → 推帧 → `_draw()`（引擎类型只到这里）
      shots/                         跑出来的画面存档（世界 + UI；见「画面存档」节；**在 .gitignore 里**，只留本地）
      register_types.cpp             扩展入口（`lfw_godot_library_init`，`.gdextension` 的 entry_symbol）
      CMakeLists.txt                 链 `godot-cpp` + `lfw_core` + headless 宿主源码 → `project/bin/lfw_godot.dll`
      project/                       Godot 工程：`project.godot` / `lfw_godot.gdextension` / `main.tscn`
  ffi/lfw_c.h                        纯 C ABI 导出（尚未创建）
  DESIGN.md                          现行设计；WASM 对接方案见其中 `## ★ 宿主层与 WASM 对接设计（方案）` 一节
```

**命名约定**：C++ 侧文件名一律 `snake_case`，TS 侧保持 `PascalCase`。
这样 `World.ts ↔ world.h` 的映射是机械的，也天然避开 NTFS 大小写不敏感带来的冲突。
头文件统一 `.h`（因为 `ffi/lfw_c.h` 要能被 C 消费）。

小函数（`clamp` / `float_equal` / `normalize` / `base`）写成 header-only 的 `inline`，
避免为 6 行代码造 `.cpp`。

---

## 怎么跑

```
npm run native all                      # configure → build → lint → test
npm run native configure
npm run native build
npm run native lint
npm run native test                     # 或 test <subject> [<case>]
npm run native godot                    # 编 Godot 的 GDExtension（需 GODOT_CPP_DIR；见「Godot 宿主」节）
npm run godot                           # 跑 Godot 工程（缺 dll 先编、缺 .godot 先 import）；详见「Godot 宿主」节
npm run godot:headless                  # 同上但 --headless（只打摘要）
```

不需要配 PATH —— 脚本自己用 `vswhere` 找 VS 2022、自己调 `vcvars64.bat`、
自己把 VS 自带的 `cmake.exe` / `ninja.exe` 加进 PATH。
生成的实际命令落在 `native/build/gen/native-cmd.cmd`（可以直接打开看）。

VS Code 里也已经指好（`.vscode/settings.json`）：

```jsonc
"cmake.sourceDirectory": "${workspaceFolder}/native",
"cmake.buildDirectory": "${sourceDirectory}/build/vscode"
```

第二行是必须的 —— `cmake.buildDirectory` 的默认值 `${workspaceFolder}/build`
会撞上仓库根的 **Vite 网页构建输出目录**。

### IntelliSense

`.vscode/c_cpp_properties.json` 把 C++ 扩展指向 **一份合并的编译数据库**：

```jsonc
"compileCommands": "${workspaceFolder}/native/build/compile_commands.json"
```

⇒ **先跑一次 `npm run native configure`**（或 `godot` / `all` / `intellisense`）。没这一步时编辑器会
报 `cannot open source file "memory"` / `"vector"` 这类标准库缺失的错（不是代码问题）。

**为什么要"合并"**（2026-10-16 用户报的 `cannot open source file "godot_cpp/classes/image_texture.hpp"`）：

- 工程有**两个** CMake 构建目录、各自一份 `compile_commands.json`：`native/build/msvc-x64`
  （core + 测试，853 条）与 `native/build/godot`（Godot 扩展，含 `godot-cpp/**` 的 1594 条）。
  扩展那边单独 configure（`native.mjs godot`），所以 `msvc-x64` 那份里**一条** `native/host/godot/**`
  都没有 ⇒ 打开扩展的源文件时所有 `godot_cpp/...` 头都解析不出来。
- `native/tools/native.mjs` 的 `writeIntellisenseDb()` 把两份按**core 在后**（core 覆盖 godot）的顺序
  合并成 `native/build/compile_commands.json`：`native/lfw/**` 因此**永远看不到** godot-cpp 的
  include 路径（`DESIGN.md` §G8 的硬规则："核心不许依赖引擎"）。
- 顺带两件事：① `-external:I` 归一成 `-I`（cpptools 1.34.4 认得 `-external:I`，这里是双保险）；
  ② **头文件也要有条目** —— 只有源文件的话，打开 `.h` 仍会退到老一套 include 解析（真正
  `#include <godot_cpp/classes/image_texture.hpp>` 的正是 `lfw_godot_textures.h`）。做法是给
  `native/` 下的每个头文件从"同目录/最近祖先目录里那条源文件条目"换掉 input 那一项、派生一条。
  合并后 1007 条（491 源 + 516 头，其中 15 条 `native/host/godot/**`）。
- `npm run native intellisense` 可以单独重算这一份；`configure` / `godot` 跑完也会自动重算。
- `compileCommands` 不存在时才退到配置里的 `includePath` / `compilerPath` 兜底（配置里那三条
  godot-cpp 目录是编辑器侧的保险）；`compilerPath` 跟着 VS 版本走，升级 VS 后可能要改
  （当前 14.41.34120）。

### 增量构建为什么快（以及别把它弄慢）

- `native.mjs build [<subject>]`：带 subject 时只构建 `lfw_core` + `lfw_trace_<subject>`
  （不带 `--target` 时 `lfw_core.lib` 一变就要重链**全部**测试 exe，实测 46 个）。
- **VS 环境只捕获一次**：`call vcvars64.bat` 实测 **5400 ms/次**，之前每次 `build` 都重跑一遍。
  现在缓存到 `native/build/gen/vsenv.json`（带 `vcvars` 路径 + mtime 校验），
  之后 `spawnSync(cmake, …)` 直接用缓存好的 env，连 `cmd.exe` 都省了。
  删掉 `native/build/` 后会重新捕获，无需干预。
- `native.mjs test <subject> --reuse-ts`（变异测试用）：变异只改 `native/lfw/**`
  ⇒ TS 侧产物不可能变，直接复用 `native/build/gen/trace.<subject>.<case>.ts.txt`。
  缓存比用例文件或 subject `.ts` 旧时会**自动回退**去真跑 TS，所以手工改用例不会读到陈旧结果。
- `node native/tools/mutate.mjs <spec>` 现在会打印
  `总耗时 / ms per mutation / 最慢的一条`，一慢就看得见。
  spec 可以带 `cases: ["<case>", …]` 只跑相关用例（一份变异通常只有一两份用例看得见，
  测试那一段从 ~2.0s 降到 ~0.2s，整条 `build` + `test` 从 ~4.5s 到 ~2.8s；
  不写就照旧跑该 subject 的全部用例）。
  ⚠️ 跑之前先确认 `native/build/mutate-backup/` **不存在** —— 它存在说明上一次跑被中断，
  源文件可能还是变异体（下次启动会自动恢复）。

### 跑起来（headless，`host/`）

`lfw_run` 把宿主缝接到真数据上、**手动推帧**（不依赖平台的 raf / setInterval），跑完打
每帧摘要与实体表快照。数据包两种都能装：`--zip <dir>`（`Expand-Archive` 出来的目录）与
**真 `.zip`**（`--root` 下按 URL 找，例如菜单里 `load_data()` 走的 `data.zip.json` → `data.zip`）。

```
# 一次性：把包解开（目录 = 包内容）
mkdir native\build\host-data\prel -Force; Expand-Archive dist\prel.zip -DestinationPath native\build\host-data\prel -Force
mkdir native\build\host-data\data -Force; Expand-Archive dist\data.zip  -DestinationPath native\build\host-data\data  -Force

# 跑（`--root` 给 `builtin_data/…` 的根；`--zip` 按给定顺序 load）
native\build\msvc-x64\bin\lfw_run.exe --root dist ^
  --zip native\build\host-data\prel --frames 300 --every 100
```

输出形如：

```
[lfw_run] loaded: fighters=1 weapons=0 balls=0 entities=1 stages=2 bg=3
[lfw_run] spawn p1 gim @(-80.0, 0.0, 0.0) team=1
[lfw_run] stage=tutorial bg=ash_forest entities=2
[frame    299] entities=2 ghosts=0 hp=893.0 digest=a7edd32e19a43ea9
[lfw_run] done: frames=300 ups=60 digest=a7edd32e19a43ea9 warns=0 errors=0 …
```

`digest` 是「实体表（按 id 排序）的位置/血量/队/状态」的 FNV-1a —— 同参数**逐位可复现**
（`--time` 给时钟初值 = `MersenneTwister` 的种子）。渲染 / 音频 / 指针 / UI 图片在
headless 宿主里是空实现（会计数并在结尾报一行）。

⚠️ 完整数据包（`--zip ...\data`）现在**能加载**了：包里的 12 个 `.xml`（7 个 bg、5 把武器）走
`host.xml_parse → ToolXML::parse`（已搬，见 DESIGN §141）。两个包一起装：

```
native\build\msvc-x64\bin\lfw_run.exe --root dist ^
  --zip native\build\host-data\prel --zip native\build\host-data\data ^
  --fighter 1 --fighter 4 --stage 1 --frames 900 --every 300
# loaded: fighters=26 weapons=19 balls=24 entities=5 stages=28 bg=16
```

（`--dump` 会打印各表前两条与全部 id，挑 `--fighter` / `--stage` 用。）

**脚本化点击**（无头也能"点 UI"：注入 `enter → move → down → up`，与 `src/ui_test.ts` 同一次序；
坐标是 **UI 逻辑像素**，左上原点、794×450 那套、与截图 1:1）：

```
native\build\msvc-x64\bin\lfw_run.exe --root dist ^
  --zip native\build\host-data\prel --frames 400 --every 100 ^
  --click 397,225 --click-frame 10
# [ui] pages before clicks: 0:init
# [click] frame=10 at=(397.0, 225.0) pages=0:init
# [ui] pages: 0:init …（第 300 帧）[ui] pages: 0:entry     ← 点击把启动页推进到了入口页
```

`--click` 可重复、支持 `x,y@frame` 写法定帧（没写就用 `--click-frame`，缺省 60）；带 `--click`
时摘要行会多打一行 `[ui] pages:`（层号:栈顶页 id）。`--dev` 下每次按下还会打一行命中列表与整棵
子树的 `path(geo)v/d`（"为什么没点中"就靠它）。
⚠ **PowerShell 下坐标要加引号**：逗号在 PS 里是数组分隔符，`--click 397,225` 会被拆成两个参数
（扩展会报 `bad --click value: 397 225`）⇒ 写成 `--click '397,225'` / `--click '397,225@10'`。

**脚本化键盘**（选人页那种「只认键」的地方也能无头驱动）：键名取**小写 `KeyboardEvent.key`**
（`space` / `esc` / `up` / `j`…，见 `host/common/key_code.h` 的别名表），事件走
`HeadlessHost::key_down/key_up` → `LFW::on_key_down` → `KEY_EVENT` 命令 → UI 层 + 按键状态 +
真人控制器（与 Godot 的 `_input` 同一条链）：

```
native\build\msvc-x64\bin\lfw_run.exe --root dist ^
  --zip native\build\host-data\prel --frames 700 --every 100 ^
  --click '397,225@10'          # init → entry（入口菜单；btn_game_start 自带 auto_focus）
  --key   'j@450'               # 游戏键 a（玩家 1 的 a = DOM "j"）⇒ Game Start：装 data.zip → main_page
  --key   's@500' --key 'j@520' # D 换焦点（→ Stage Mode）、a 按下 ⇒ stage_mode_prepare_page（八人框）
# [key  ] frame=450 down key=j times=0 pages=0:main_page
# [key  ] frame=520 down key=j times=0 pages=0:stage_mode_prepare_page
```

`--key <name>[@frame]` 是「按一下」（按下 + `--key-tap` 帧后抬起，缺省 2）；
要按住不放就用 `--key-down` / `--key-up` 成对写。`--key-frame N` 给没写 `@frame` 的定帧（缺省 60）。
⚠ 第一次按下的 `times` 是 **0**（`Keyboard.ts` 的 `_times_map` 就是 0 起算，重复按下才递增）——
`LFW::on_key_down` 只在 `times == 0` 时把这次按下翻成 `KEY_EVENT`，所以注入器必须照这个口径发。

**`--zip-diff`（真 `.zip` ↔ 解包目录逐条比对）**：条目名 + 大小 + 内容 MD5 三项全对才算过，
差异 ⇒ 退出码 1（不跑游戏，`--root`/`--zip` 可省）：

```
native\build\msvc-x64\bin\lfw_run.exe --zip-diff 'dist\prel.zip,native\build\host-data\prel'
# [zip-diff] dist/prel.zip vs native/build/host-data/prel: entries=161 (stored=88 deflate=73 other=0) compared=161 ok=161 missing=0 extra=0 mismatch=0
native\build\msvc-x64\bin\lfw_run.exe --zip-diff 'dist\data.zip,native\build\host-data\data'
# [zip-diff] dist/data.zip vs native/build/host-data/data: entries=633 (stored=469 deflate=164 other=0) compared=633 ok=633 missing=0 extra=0 mismatch=0
```

### 跑起来（录制型薄宿主，`host/thin/`）

`lfw_thin` 与 `lfw_run` **同参数、同装配、同推帧路线**（共用 `host/common/lfw_boot.*`），
只把世界渲染器从「只计数的空实现」换成 `RecordingWorldRenderer`：它不画，逐帧记下
「核心要求渲染器画什么」。**摘要因此必须与 `lfw_run` 逐位相同** —— 对不上就是回归。

```
native\build\msvc-x64\bin\lfw_thin.exe --root dist ^
  --zip native\build\host-data\prel --frames 300 --every 300
# [frame    299] entities=2 ghosts=0 hp=893.0 digest=a7edd32e19a43ea9 renders=300 rec=2
# [   draw] E id=101 data=gim type=8.0000 pos=21.0000,… frame=running_0 state=2 tex=0
#            crop=0.0000,160.0000,79.0000,79.0000 … outline=#4f9bff@0.8000,1.0000 …
# [thin] done: frames=300 ups=60 digest=a7edd32e19a43ea9 renders=300 added=6 removed=4 …
# [thin] UI render calls: 300 (unhandled: 300)
```

`--dump <file>` 落整条记录（每帧一行 `FRAME` 帧头 + 每个活体一行 `E`）；字段序与全部字段名
写在 `host/thin/recording_world_renderer.h` 的头部注释里，`--sample N` 控制每帧顺带打几条。
`renders` 必须等于帧数（缺省一 tick 一次 `render`）；`match=0` 或 `dup_add` / `stray_del`
非零说明保留式记账（`add_entity` / `del_entity`）与 `world.entities + ghosts` 对不上。

**`UI render calls: N (unhandled: M)`**：核心每帧对**每一层**的 UI 根节点发一次渲染面调用
（TS `WorldRenderer.ts:236-239`），`N` = 这个宿主一共发了多少次、`M` = 其中没有人画的
（宿主没给渲染器对象、或渲染器没覆写 `render`）。本宿主不自己画 ⇒ `M == N`；`N` 必须与
`renders × 层数` 对得上（`unhandled` 与 `calls` 对不上，说明有渲染器接了这条缝）。

#### 插值那条路（`--sync-render` + `--sub-render`）

缺省装配（`sync_render = FPS_60` + `UPS = 60`）里 `world.FPS <= dataset.UPS` ⇒ **`dfactor ≡ 1`**、
一 tick 一渲染 ⇒ 逐实体插值**一次都没跑过**；而 `E` 行的 `pos` / `prev` 是 TS 的那对
`p1` / `p0`（两个 tick 端点，一个 tick 只刷一次），只在一 tick 渲染多次时才不等于彼此。
把档位换成 `FPS_120`（或 `Unlimited`）、一 tick 渲染 N 次就能真跑：

```
native\build\msvc-x64\bin\lfw_thin.exe --root dist ^
  --zip native\build\host-data\prel --zip native\build\host-data\data ^
  --fighter 1 --fighter 4 --stage 1 --frames 900 --every 900 ^
  --sync-render FPS_120 --sub-render 4 --dump native\build\thin-interp.dump
# [thin] done: frames=900 … digest=13945ad1144c968d renders=3600 … ents_rec=21820 df01=16365 interp=10161 …
#   帧头 df=0/0.25/0.5/0.75 各 900 帧；21820 条实体记录里 16365 条 0<dfactor<1、10161 条 p0!=p1、13548 条 moved
#   E id=102 data=4 … pos=110.2250,30.1180,-135.1000 prev=101.2250,27.8960,-130.1000 … state=5 ← 跑跳悬空那一拍
```

`df01` = `0 < dfactor < 1` 的记录条数、`interp` = 其中 `p0 != p1` 的（真在插）、`moved` = `p0 != p1`。
⚠ **换档位不算改模拟**：上面这条命令的三条摘要与 `lfw_run` 同参数**逐位相同**（渲染档位只是
"宿主算 `dfactor` 的输入"，`--sync-render FPS_120` 单独用（一 tick 仍只渲染一次）只会得到 `df=0`）。

---

## WASM 构建（已验证）

端口核心能编成 wasm：`lfw_core` 编过 **0 错误**（62 s / `-j 16`），产物 `native/build/wasm/lfw/liblfw_core.a`
**19.3 MiB**（357 个成员）。需要 emsdk（本机装在仓库外 `%USERPROFILE%\emsdk`，SDK 6.0.12 / clang 24）。

```
cd native
# 先让 emcc 在 PATH 上（emsdk_env.bat，或手写 PATH 加上 emsdk 与 upstream\emscripten）
cmake --preset wasm
cmake --build build\wasm --target lfw_core -j 16     # ⚠ 必须限定 target
```

⚠ **一定要带 `--target lfw_core`**：这个预设的 `all` 里有 **117 个可执行文件**（`lfw_run` + 116 个
`lfw_trace_*`），不限定就会去链 117 个 wasm 可执行文件（未验证，且不是这一阶段要的东西）。

两条已知前提（都已落进 `cmake/toolchains/emscripten.cmake`）：VS 捆绑的 CMake **没有**
`Modules/Platform/Emscripten.cmake` ⇒ 工具链文件改为优先 `include` emsdk 自带的那份（拿不到才退回手写设置）；
`-msimd128=off` clang 不认 ⇒ 改成 `-mno-simd128`。**链接期开关仍是空白**：`-sMODULARIZE` /
`-sALLOW_MEMORY_GROWTH` / `-sEXPORTED_FUNCTIONS` 这些要等真链接（写 JS 宿主那一步）再定，见 DESIGN
「宿主层与 WASM 对接设计」W12。

## WASM 宿主（端口已在 wasm 里真跑）

骨架已通：**整个端口在 wasm 里跑起来**，JS 只提供**时钟 + 日志**并逐帧驱动；渲染/音频/图片仍用
headless 那套顶着（下一步才接）。

```
node native/web/build-wasm.mjs          # 编 wasm（emsdk 须在 PATH 上；~61 s，0 错误）
node native/web/smoke.mjs --profile 2   # Node 冒烟：装数据 → boot → 推 900 帧 → 对拍摘要
node native/web/smoke.mjs --profile 1 --live
```

产物 `native/build/wasm/bin/lfw_wasm.{mjs,wasm}`（67 KB + 2.8 MB）。冒烟结论是硬的：**三条摘要与 MSVC 的
`lfw_run` 逐位一致**（`a7edd32e19a43ea9` / `13945ad1144c968d` / `61c42c78c9d0bcac`）；
`fighters=26 weapons=19 balls=24 stages=28 bg=21 bots=22 moves=24` 全装进来；`--profile 1` 连跑两遍输出逐字节相同。

⚠ **一条必须记住的坑**：`LFW` 构造里会 `world.start_update()` ⇒ **端口自己的 Ticker 也在推帧**。
宿主要么**只**实现时钟槽、让 Ticker 自己走（`--live`），要么**只**手动调 `lfw_frame`（`--profile *`）；
**两边都做 ⇒ 一帧走两步**（`lifetime` 翻倍）。手动模式才是与 `lfw_run` 对拍的那条路。

数据怎么进 wasm：JS 先把解包好的包**写进 emscripten 的 MEMFS**（浏览器走 `bundle.json` + `bundle.bin`
一次拉取），`FsZip`/`HeadlessHost` 照旧按目录读 —— **端口零改动**，`.wasm` 里不塞数据。

（台面那条 WASM 构建节是 `lfw_core` 静态库；这一节是能跑起来的目标，两者并存。）

## Godot 宿主（端口在 Godot 里真跑）

GDExtension 骨架（DESIGN §G1 骨架 / §G2(a) 的同进程路线）：**Godot 自己当宿主**，端口零改动。
**世界与 UI 都真画出来了**（§G2 第二半）：`LfwGodot` 是 `Node2D`，`_draw()` 把核心的绘制契约变成像素
——相机 / 背景层 / 影子 / 逐流体（按 `crop` 裁剪的真 PNG、`facing` 镜像、队伍色描边、`mix` 换色、
按 z 的绘制次序），以及 UI 那一遍（页面的锚点矩形 / 父子坐标系 / `z` 次序 / 图片裁剪 + 平铺 +
UV 动画 / 文字 / `clip_children` 裁剪；`create_ui_node_renderer` 覆写，每个节点一份渲染器）。
头文件与实现都在
`native/host/godot/**`（`lfw_godot_renderer.{h,cpp}` 与 `lfw_godot_ui_renderer.{h,cpp}` 只产出
**引擎无关**的绘制项，`lfw_godot_node.cpp` 的 `_draw()` 是唯一碰引擎类型的地方，见 §G5）。
下文 `<godot-console>` = `Godot_v4.7.1-stable_win64_console.exe`（本机在桌面；**固定 4.7.1**）。

**一条命令跑起来**（前置都在位之后；dll 缺就先编、`.godot` 缺就先 `--import`，都会自己补）：

**两种跑法**（`--play` 是岔路口；`npm run godot` = 玩，`npm run godot:headless` = 验收）：

```
npm run godot                                  # 开放模式：开窗从数据自己的首页 init 开始玩，关窗口才结束
npm run godot:headless                         # 验收：`--headless` + 缺省 `--frames 900 --delta 0.017`，只打摘要
npm run godot '--' --ui-page main_page         # 透传扩展自己的参数（PS 里 `--` 要写成 `'--'`）
npm run godot '--' --play --every 300          # 开放模式 + 每 300 帧一行心跳（想看它跑到第几帧时用）
```

* **开放模式**（`--play`，或 `--frames 0` 的帧数那一半）：**不** `boot_scene`（不替玩家摆场景，入口是
  数据自己的首页 `init`）、**不**限帧数（关窗口才结束）、缺省**不打**帧摘要、节拍用 Godot 给的真
  `delta`（真时间）⇒ 这一支**不进三条摘要**（它不是验收口径）。
* **验收模式**（给 `--frames N`，`npm run godot:headless` 走的这条）：与 `lfw_run` 同形 —— 强制
  `boot_scene` 造场景、固定步长 + `--delta` 节拍、每 `--every`（缺省 60）帧一行摘要。**三条摘要靠这一支。**

**宿主替数据补的那几件事（语言 / 版本号 / 字体）**

Web 端有几步是**宿主注入**的（不在数据包里）；宿主不补，Godot 这边的画面就和 Web 版对不上
（拿 Web 版对拍时一眼可见：整页英文、左下角 `v0.0.0`、字宽不同）。三件事的对应关系：

| 事项 | Web 端（`src/…`） | Godot 宿主 |
|---|---|---|
| UI 语言 | `useLFW.setup`：`lfw.lang = navigator.language.toLowerCase()`（`App.tsx:404-411`） | `OS::get_locale()`（`_`→`-`、转小写）⇒ `LFW::set_lang`；`--lang <code>` 可覆盖 |
| 版本号 | `init.ts:86-89` 拼 `` `v${VERSION_NAME}-${GIT_COMMIT_ID[:7]}${dirty ? '-' + dirty : ''}` + ' ' + BUILD_TIME `` | `--version-name <text>`；缺省读 `<root>/version.json`（vite 插件写的**同一批字段**，`vite.config.ts:38-44`） |
| 字体 | `ctx.font = style.font`（`TextMesh.ts:66`，数据里是 `NNpx Arial` / `bold 18px Arial` / `Arial Black`） | `lfw_godot_font.{h,cpp}`：CSS 简写 → 字族 + 字重 → `SystemFont`；解析不到才落回引擎字体 |

```
npm run godot '--' --lang en-us                        # 强制英文（缺省跟系统区域）
npm run godot '--' --version-name 'v9.9.9'             # 覆盖左下角那行
```

证据行（开窗就有）：`[godot] ui lang: zh-cn` / `[godot] version name: v0.1.61-3f19bf7-dirty …` /
`[godot] ui fonts: Arial|400|u -> Arial, Arial|900|u -> Arial Black, Monospace|400|u -> Courier New`。

⚠ 三条**踩过的**硬约束：

* **版本号必须在 `LFW` **构造之前**写**：构造函数就把 `VERSION_NAME` 塞进 i18n 的基准表
  （`lfw.cpp:269`）⇒ 构造之后再写，`version_name` 节点拿到的还是 `v0.0.0`（实测）。
  TS 同理：`init.ts` 是模块加载期设的静态量。
* **语言必须在 `load` 之前设**：端口这边 `load` 是**同步**的、UI 节点就在里面建（文本按当时的 i18n
  定死）；`set_lang` 的"重写节点文本 + 重度量"那一半只在**改语言**时起作用（见下面「与 Web 版
  对不上的地方」第 3 条）。
* **`Arial Black` 在 Windows 上不是独立字族**：DirectWrite 把它归到 `Arial` + Black 字重
  ⇒ `OS::get_system_font_path("Arial Black")` 给空串、引擎按字族名**找不到**，而浏览器直接就能解析
  （`prel.zip` 的 `ui/*.ui.json5` 里 `gogogo` / `char_menu` 那批标题就是它）。所以 CSS 简写里的
  字族名要**拆后缀**：`Arial Black` ⇒ `Arial`@900（`Semibold` / `Bold` / `Light` / `Thin` 同理）。

**窗口外观：无系统顶栏 + 自绘顶栏（照 Electron 端那套，整簇 11 个控件）**

桌面端（`desktop/app/main.mjs:915`）是 `frame: false`，窗口 `1191×675 = 794×450 × 1.5`（**没给顶栏留高度**
⇒ 顶栏是盖在画面上的），顶栏那一整簇控件由应用自绘（`src/App.tsx:705-813` + `src/App.module.scss:33-81`
的 `.top_bar` / `.wails_drag`）。Godot 宿主照同一口径：

```
npm run godot                                  # 缺省：borderless + 自绘顶栏 + 1.5×（1191×675）
npm run godot '--' --titlebar native --window-scale 1    # 想要系统顶栏 / 1:1 逻辑像素时
npm run godot '--' --titlebar none --window-scale 1      # 无边框但**不**画顶栏（只剩 alt+F4/任务栏可关）
npm run godot '--' --titlebar frame --window-scale 1.5   # 想试"原生边框但不显示系统标题栏"——**实测办不到**（见下）
npm run godot '--' --icons D:\path\to\assets             # 那 11 张 btn_*.png 换一个目录
```

* `--window-size WxH`（缺省没给）：直接指定**窗口像素**尺寸，**允许不等比**（给了就压过
  `--window-scale`；`--window-scale 1.5` ≡ `--window-size 1191x675`）。窗口**可以自由拉伸**：
  `WINDOW_FLAG_RESIZE_DISABLED` 明确关掉，下限取逻辑屏幕 **794×450**（与 Electron 的
  `minWidth/minHeight` 同口径），边缘 6 像素带自己叫 `window_start_resize`，悬停时按方向换缩放游标
  （`titlebar_edge_to_cursor`；两个**对角**形状的命名没逐个核对，反了只是图标镜像）。
  ⚠ **`project.godot` 的 stretch 是 `disabled`**（曾经是 `canvas_items` + `aspect=keep`）：那一档下引擎
  把"画布"整个压进内容区、**渲染目标本身就只等于内容区**（实测 1400×500 的窗口里视口纹理只有
  882×500）⇒ 画到窗口右端的自绘顶栏会被切掉（用户实测报的 bug），`--screenshot` 也抓不到黑边。
  现在 contain + 居中由**宿主自己做**（`lfw_godot_node.cpp` 的 `contain_transform()`，口径照
  `Window::_update_viewport_size()` 的 keep 分支：内容尺寸 `floor`、居中偏移 `round`、逐轴缩放），
  一个矩阵管三件事：
  * **绘制**：游戏那一层按逻辑像素画、套这个矩阵（画布 = 窗口像素时 `final_transform()` 是单位阵）。
    ⚠ 绘制项里的**镜像**（`flip_x`，UI 的 `mirror_x` / 世界里的 `facing < 0`）也必须**叠在这个矩阵上**
    （`_item_xform * mirror`）：`draw_set_transform*` 是**绝对**设置，夹在绘制项中间就会把游戏那一层的
    contain 整条冲掉 —— 镜像项**自己**以及它**之后**的所有项（同帧的文字/标题图/UI，世界那一遍还有朝左
    的实体）会按**逻辑像素 1:1** 画进窗口，于是"窗口越大越离谱"、画面上还多一份小号的镜像鬼影
    （修之前的样子见 `shots/window-entry-bug-before-1920x1030.png`）；
  * **裁剪**：`contain_rect()` 交给 `canvas_item_set_custom_rect` + `canvas_item_set_clip` ⇒ 游戏被
    裁在内容矩形里（逻辑屏幕外的东西不会漏进黑边；`--clip-probe` 是这一条的观测量，见下）；
  * **输入**：`_input()` 用它的逆把画布/窗口像素换回逻辑像素（`--click-window` 走的正是这条）。
  自绘顶栏反过来按**窗口像素**铺满整窗（`final.affine_inverse()` + `canvas_item_add_clip_ignore`
  越过上面那条裁剪）。`[godot] window:` 行里的 `content=宽x高+左+上` 现在是**宿主算的**那一份，
  同一份数字由 `[godot] stretch:` 那一行连带缩放与过采样一起报出来：
  实测窗口 `1400x500` ⇒ `content=882x500+259+0 scale=1.11083x1.11111 oversampling=1.111`
  （左右各 259 黑边）；`1191x675` ⇒ `content=1191x675+0+0`（无黑边）；`1191x900` ⇒
  `content=1191x675+0+113`（上下 113/112）。字体过采样补成引擎在 `canvas_items` 下的自动值
  （`MAX(内容缩放)`）⇒ 1.5× 开窗时文字的光栅化与切片之前**逐像素一致**（`1191x675` 那张旧截图
  与新截图 0 像素差）。
  ⚠ 顶栏画在**CSS 像素**里（DOM 口径），所以条铺满**整窗宽**、按钮贴**窗口**右上角（不是内容区右缘）：
  `1400x500` 时 `titlebar:` 那行给 `bar=1400x32 scale=1.000`（`bar` 是 CSS 宽 —— 见下一条的 DPI 说明），
  窗口再高（`1191x900`）也在最顶上一行。
  ⚠ `--screenshot` 抓的是**整个视口 = 整窗**（黑边 + 条 + 画面都在图里）。
  `--clip-probe`（诊断，不进摘要）：贴着逻辑屏幕的边界**内外各 8 像素**画一圈洋红 ——
  裁剪生效时只看得到边界**里面**那半圈、黑边里一个像素洋红都没有（`shots/window-clip-probe.png`
  那张在 1400×500 下：黑边 0 像素洋红、边界内 9 像素；1191×900 的上下黑边同理）。
  `WINDOW_FLAG_BORDERLESS`，后者再画我们自己的条。条的几何 = **DOM 的 CSS 像素**（= OS 的**逻辑**像素，
  见下一条的 DPI 说明）：`.top_bar` 是 `justify-content: flex-end` ⇒ 控件**右对齐**、DOM 次序 = 从左到右；
  每个控件占 **32×32**（`transform` 不参与布局），32×32 的图缩 **0.6**、悬停 **0.8**；**条上没有背景**
  （只有 `.wails_drag` 悬停时那层 `#88888855`，高 90% = 28.8 像素），**全屏时只藏那三个窗口按钮、
整条不消失**（Electron 的 `show={!is_fullscreen && window.runtime?.…}` 只管 minimize/maximize/quit；
静音/设置/全屏那几个 `Show` 里没有 `!is_fullscreen` ⇒ 全屏时仍能点设置、点退出全屏。实测：
`titlebar: fullscreen=true` 之后 `controls(4)=bgm sound settings fullscreen`）。
  拖拽走 `DisplayServer::window_start_drag()`；`borderless` 在 Windows 上是 `WS_POPUP` ⇒ 没有原生可拖的
  边框，故自己留了 6 像素的 `window_start_resize` 带。绘制时用 `Viewport::get_final_transform()` 的**逆**
  把"窗口像素"贴回逻辑画布，命中时用**正**变换换回来（`lfw_godot_titlebar.h` 只管这套几何，
  `lfw_godot_node.cpp` 只管"能不能求值 / 点了干什么"）。

  **最大化/还原是宿主自己做的**（不用 `WINDOW_MODE_MAXIMIZED`）：无边框窗口走引擎那一档会盖住任务栏，
  而且"还原"回到的尺寸不可靠。这里记下还原点（尺寸+位置）后用 `screen_get_usable_rect()`（已排除任务栏）
  摆窗口，还原时**先把 mode 压回 `WINDOWED`** 再放回还原点（把窗口铺满工作区时 Windows 会自己把它当成
  最大化 `mode=2`，那一档下 `window_set_size` 会被钉回整屏 —— 不压这一下"还原"原地不动）。
  实测：`maximize (mode=2 size=1920x1030 …)` → `restore (mode=0 size=1191x675 …)`。
  ⚠ **最大化后拖拽区不拖**（Windows 的最大化窗口不是"整屏窗口"）：`titlebar: drag ignored (maximized)`；
  但**双击拖拽区 = 最大化/还原**（Windows 标准）。

  **第四档 `frame`：能不能"像 Electron 那样用原生边框、但不显示原生顶栏"？——实测：Windows 上办不到。**
  Electron 在 Windows 上的 `frame: false` **不是** `WS_POPUP`：它保留 `WS_THICKFRAME`（原生缩放 / Aero
  Snap / 原生最大化 / DWM 阴影都还在），只用 `WM_NCCALCSIZE` 把 caption 那一块让出来。Godot 端对应的
  那一枚是 `DisplayServer.WINDOW_FLAG_EXTEND_TO_TITLE`（`frame` 档：设它、**不**设 `BORDERLESS`、自绘栏
  照画）。**实测（Godot 4.7.1 / Windows）它是空操作**：
  * 设完**读回来还是 0**、`has_feature(FEATURE_EXTEND_TO_TITLE)` 也是 0（宿主 `_ready()` 里那行 verdict：
    `titlebar: frame -> extend_to_title read-back=0 feature=0 size=794x450 deco=810x489 (NO-OP …)`）；
  * `deco` 仍比 `size` 高一条 caption（`1191x675` vs `1207x714` = 左右各 8 + 上 31），外部
    `GetWindowLongW(GWL_STYLE)` 给 `0x16CF0000`、`WS_CAPTION` 还在（量法见下）；
  * 源头也对得上：`platform/windows/**` 里根本没有 `extend_to_title`（只在 macOS 后端实现，
    `doc/classes/DisplayServer.xml` 自己写着 implemented only on macOS）。
  ⇒ 这一档画出来是"**系统标题栏 + 我们自绘的条**"两层，**不是**可用的 Electron 等价物：留着只为
  "一条命令复现这个结论"。**缺省不动**（`--play` → `custom`）。四档的实测对照（窗口 `1191x675`、缩放 1.5）：

| `--titlebar` | 无边框 flag | Win32 `GWL_STYLE` | window / client | 非客户区 | 自绘栏 | 缩放/贴边 | 最大化/还原 |
|---|---|---|---|---|---|---|---|
| `native` | 0 | `0x16CF0000` `WS_CAPTION\|WS_THICKFRAME\|WS_SYSMENU\|MIN\|MAX` | 1207x714 / 1191x675 | 16x39 | 无 | 系统 | 系统 |
| `custom`（缺省） | 1 | `0x960B0000` `WS_POPUP\|WS_SYSMENU\|MIN\|MAX` | 1191x675 / 1191x675 | 0x0 | 有 | 自绘 6 px 带 | 自绘（工作区） |
| `none` | 1 | 同 `custom` | 同 `custom` | 0x0 | 无 | 自绘 6 px 带 | 自绘（工作区） |
| `frame` | **0** | 同 `native`（= 那个 flag 没生效） | 1207x714 / 1191x675 | 16x39 | **有**（在系统标题栏**下面**） | 系统 | 系统 |

  `frame` 档顺带量到的两条（**就算那个 flag 将来真生效也用得上**）：① 有原生边框时那条 6 像素自绘缩放带
  **不参与**（边界是**非客户区**、归 Windows：`non-client=16x39`）；② 最大化/还原改走**引擎那一档**，
  实测 `maximize (native frame) (mode=2 size=1920x1009 deco=1936x1048 pos=3840,23)` →
  `restore (native frame) (mode=0 size=1191x675 deco=1207x714 pos=4204,202)`（**正好回到原矩形**，不用
  宿主那套工作区模拟；`custom` 那档仍是宿主自己记还原点：`maximize (mode=2 size=1920x1030 …)`）。
  DPI 不变式两档一样：`--titlebar frame --window-scale 1.5 --display-scale 1.5` ⇒
  `bar=794x32 icon=19.2 scale=1.500`（条高/图不变，只有 `scale=` 从 1.000 变 1.500）。
  截图：`shots/window-frame-os-caption.png`（frame：系统的 `LFW (Godot host) (DEBUG)` 条**和**它下面我们
  自己的条，就是上面那个结论的样子）/ `shots/window-custom-no-os-frame.png`（custom：一点 OS 边框都没有）。
  这两张是**屏幕截图**（窗口 + 30 像素桌面边），不是宿主视口截图 —— OS 的标题栏/边框在**客户区之外**，
  `--screenshot` 抓不到。

  11 个控件（次序 = Electron 的 DOM 次序；`checked` 走 `ToggleImgButton` 那条反直觉的规则：**`checked == true` 显示 `src[1]`、false 显示 `src[0]`** —— 静音时看到的是划掉的那张）：

| # | 控件（`TitleAction`） | 图 `src[0]` / `src[1]` | 可见条件（`src/App.tsx`） | 点了干什么 |
|---|---|---|---|---|
| 1 | `dev_ui` | `btn_1_2` / `btn_1_3` | `lfw.is_cheat(GIM_INK)` | ⚠ 端口没有那个开发者面板 ⇒ 只打一行、不做动作 |
| 2 | `f4` | `btn_2_3`（单张） | `ui_id && layers.bottom.pages.length > 1` | `push_cmd(CMD.F4)` |
| 3 | `bgm_mute` | `btn_2_0` / `btn_3_0` | 恒显示 | `sounds_set_bgm_muted(!muted)`；悬停出音量条 |
| 4 | `sound_mute` | `btn_0_3` / `btn_1_0` | 恒显示 | `sounds_set_sound_muted(!muted)`；悬停出音量条 |
| 5 | `f1` | `btn_2_1` / `btn_2_2` | `bg_id != VOID_BG && ui_id != "settings"` | `push_cmd(CMD.F1)`（`checked` = `world.paused()`） |
| 6 | `f5` | `btn_4_3`（单张） | 上面那条 **且** `first_page == 'init_demo'` | `push_cmd(CMD.F5)` |
| 7 | `settings` | `btn_1_1`（单张） | 恒显示 | `push_cmd(CMD.F2)` + 当前页是 `settings` 就 `layer.pop()`，否则 `set_page({id:"settings"}, 1)` |
| 8 | `fullscreen` | `btn_3_1` / `btn_3_2` | `!is_mobile_container && !toy_mobile && first_page != 'init_demo'` | 全屏 ⇄ 窗口 |
| 9 | `minimize` | `btn_0_4`（单张） | `!is_fullscreen && window.runtime` | 最小化 |
| 10 | `maximize` | `btn_1_4` / `btn_2_4` | 同上 | 最大化 ⇄ 还原 |
| 11 | `close` | `btn_3_3`（单张） | 同上 | 关窗口（打 `[godot] exit:` 那行） |

* **求值不了的三条**（照实说，不假装）：`is_mobile_container` / `toy_mobile`（UA + 触摸判定 ⇒ 桌面宿主恒
  false）、`window.runtime`（Wails/Electron 的桥 ⇒ 用"真窗口"代替）。**`f5` 在这个端口里永远不显示**：
  它的条件多一条 `first_page == 'init_demo'`，而那一档只在 web demo（路径带 `/demo`）里设
  （`src/App.tsx:400-408`），桌面端与端口都是 `init`。想复现最全的一簇（10/11）= 进对局（`bg_id` 非 VOID
  ⇒ 出 `f1`）+ 页栈 > 1（⇒ 出 `f4`）+ 用 `--key` 敲出 `gim.ink` 开 `GIM_INK`（⇒ 出 `dev_ui`），见「画面存档」。
* **顶栏的尺寸不随窗口变**（不变式，回归看 `[godot] titlebar:` 那行的 `bar=` / `icon=` / `scale=`）：
  条高 **32 CSS**、控件盒 **32 CSS**、32×32 的图缩 **0.6**（悬停 0.8 ⇒ 25.6）、拖拽层 **28.8 CSS**、
  边缘缩放带 **6 CSS** —— 它们**既不随窗口尺寸、也不随游戏 contain 的缩放**变化
  （`--window-scale` / `--window-size` 改了窗口，条与图一个像素都不动；实测窗口 `1191x675` 与
  `2382x1350` 两档的图标逐行像素轮廓相同：亮行都在 y=8..23）。
* ⚠ **DPI：顶栏那一层按 CSS 像素判，游戏与窗口按物理像素判。** Electron 的顶栏是 CSS 布局 ⇒ CSS 像素
  = OS 的**逻辑**像素；Godot 的窗口像素（`window_get_size()` / `_input` 坐标 / `--screenshot` 的 PNG
  尺寸）是**物理**像素（`[godot] stretch:` 那行的 `viewport=` 与 `final=` 是自证：stretch 关掉后
  视口 = 整窗，`final_transform()` 只剩 DPI/`display/window/stretch/scale` 那一档）⇒ 不换算的话
  125% / 150% 的屏上我们的条会比 Electron **小一档**。所以：绘制时把画布换成
  「`final` 的逆 × `screen_get_scale()`」、命中时把窗口像素除**同一个**数
  （`titlebar_display_scale()`，一处数字两条路）⇒ 条高 32 CSS = 32×s 物理、图 19.2 CSS = 19.2×s 物理。
  实测（本机 `screen_get_scale()` = **1.000**，`content_scale_factor` = 1.000 ⇒ 真实 DPI 那一档在本机
  跑不到，只能用 `--display-scale` 强制）：
  | `--display-scale` | `titlebar:` 行 | 拖拽层实测高（截图逐行量） | 图标轮廓实测（高 × 宽） |
  |---|---|---|---|
  | 1.000 | `bar=1191x32 icon=19.2 scale=1.000` | 0..28 = **29 px**（28.8×1） | 17 × 239 px |
  | 1.500 | `bar=794x32 icon=19.2 scale=1.500` | 0..42 = **43 px**（28.8×1.5） | 26 × 359 px（17×1.53 / 239×1.50） |
  两档的 `icon=19.2` 与 `32` **没变**（只乘 `scale`）⇒ 不变式成立；命中也跟着走：`--display-scale 1.5`
  下窗口 `975,16` 命中 `settings`（`[godot] titlebar: settings (set_page) pages=0:init 1:settings`）、
  窗口 `1167,16` 命中 `close`（窗口即关）—— 画的格子与命中的格子是同一份数字。
  `--display-scale N` 是这一档的**诊断口**（覆盖 `screen_get_scale()`；本机屏幕缩放恰为 1，用它把
  DPI 路径跑起来）。⚠ 换个屏幕缩放或换个显示器时 `screen_get_scale()` 会自己变 ⇒ 正常用不传这个参数。
* **音量弹层**：悬停那两个音量控件时，条下沿挂一个竖直音量条（`.volume_popup`：圆角 8、底
  `#0F1830CC`、内边距 `8/10/10`、轨道 6×84 `#00000088`、填充 `#5A88E0`、白色 14 像素圆滑块）。按下=抓
  住、拖动=按 `y` 反算 `clamp(1 - (y-track.top)/84)` 并调 `sounds_set_bgm_volume` / `sounds_set_sound_volume`
  （与 TS 的 `VerticalSlider` 同一套公式；拖起来若非 0 还顺手取消静音）。滑块圆角/阴影是**近似**：
  `draw_rect` 没有圆角（用四个角上的圆补）、`box-shadow` 略去。
  ⚠ **开的条件只有"指针在按钮盒里"**（照 `.volume_hover:hover .volume_popup { display: block }`）：
  弹层**关着**时它是 `display: none`（不参与命中测试）⇒ 指针跑到按钮**下面**那条弹层带上**不该**弹出来；
  弹层**开着**之后指针落进它自己那块弹层才保持开着（`.volume_popup` 是 `.volume_hover` 的后代 ⇒ 祖先的
  `:hover` 仍成立）。这一条曾经漏掉前半截（把"在弹层里"无条件算进开的条件），见「2026-10-16」最后一条。
* **图从哪来**：那 11 张 `btn_*.png`（外加 `btn_any.png` 共 24 张）在**仓库的 `src/assets/`** 里，
  **不在数据包里**。缺省按"含 `src/assets/btn_1_1.png` 的目录"从**进程 cwd**与**可执行文件目录**往上找
  （Godot 跑工程会把 cwd 切到工程目录 ⇒ 往上 4 层就是仓库根），可用 `--icons <dir>` 覆盖；找不到就打印
  一次并只留命中盒。⚠ **打包/导出（`--export-release` 或把宿主拷到别处）时这 11 张 PNG 不会跟着走** ——
  得把它们一起发出去并用 `--icons` 指过去（或改走 `--root` 那份 `builtin_data` 的解析路径）。
* `--window-scale N`（缺省 1.5）：窗口 = **逻辑屏幕 794×450** × N，逻辑屏幕本身不动（UI/世界照旧在
  逻辑像素里画）—— contain/缩放/输入换算全在宿主这一侧（见上面 `--window-size` 那一条，
  `project.godot` 的 stretch 是 `disabled`），自绘顶栏按**窗口像素**铺满整窗。
  实测：1.5× 下用**窗口坐标**点 `595,337`（= 逻辑 397,225）点中启动页，再点 `595,483` 命中主菜单
  Settings（`pages=0:entry 1:settings`）；点自绘条右端的关闭格（窗口 `1176,15`）窗口即关并打
  `[godot] exit: … pages=…`；点设置格（窗口 `1047,16`）时 `[godot] titlebar: settings (set_page)
  pages=0:stage_mode_page 1:settings` —— 条上的点击既落了动作、又没漏给底下的游戏（见「画面存档」那两张）。
  **非等比尺寸**（窗口 `1400x500`，content `882x500+259+0`）下同样成立：窗口 `700,250`
  = `contain⁻¹` = 逻辑 `397,225`（`--click-window` 与 `--click` 两条命令给出同一状态）、窗口
  `1250,16` 命中设置格（`[godot] titlebar: settings (set_page) pages=0:init 1:settings`）、窗口
  `1380,16` 命中关闭格（条宽 `bar=1400x32` ⇒ 最右那格 = 窗口 1368..1400）。
* ⚠ 自绘条那一带在进游戏之前就被吞掉（`titlebar_consume` + `set_input_as_handled()`）—— 条上的点击是
  **窗口**动作，不会漏给游戏/UI。吞的范围与 Electron 一致：**只有控件盒 + 拖拽层（0..28.8）+ 打开的弹层**；
  条底那 3.2 像素的缝在那边也是漏给画布的（`.top_bar` 有 `pointer-events: none`、拖拽层只有 90% 高、
  条自己没有背景），这里同样漏。边缘那 6 像素缩放带仍然按**整个窗口**判、压过一切。
* ⚠ 照实记：拖拽/缩放走的是 OS 那条 API，**没能自动化验证**（要真人按住拖鼠标）；自动测过的是
  "系统边框真没了"（`[godot] window:` 行里 `size` 与 `deco`：`custom` 时 `1191x675 == 1191x675`，
  `native` 时 `794x450` 对 `810x489`，差的就是那圈装饰）、"条被画出来且有哪几个控件、画在哪"
  （`[godot] titlebar: icons=… bar=… icon=… scale=… controls(N)=…` 那行会在集合变化时打一次；截图里逐格量过：10 格时中心
  在 `871+32i+16`，9 格时在 `903+32i+16`）、"点击生效 / 不漏给游戏"（关闭格真把窗口关了；设置格真把
  `settings` 页压到第 1 层，且同一帧 `f1` 那一格从条上消失）、"悬停真的换状态"（`--hover-window` 停在
  BGM 那一格 ⇒ 音符从 15 像素宽变 19 像素宽 = 0.6 → 0.8，弹层同时弹出来）、"滑杆真的写了回去"
  （点 `951,100` 后滑块落到 32%、蓝条跟着缩 —— 而画的位置读的就是 `sounds_bgm_volume()`）、
  "拖拽层高亮只在 0..28.8"（`--hover-window 300,15` 量到 y<29 整条变亮 `(53,61,108)`、y=29 起回到
  `(11,23,94)`，与 `.wails_drag:hover` 的 `#88888855` 同口径）、"缩放后点击不偏"。

⚠ **在 PowerShell 里 `--` 必须写成 `'--'`**：PS 会把裸 `--` 当成自己的分隔符**吃掉**，npm 于是把
后面的 `--stage` 之类当自己的配置项吃掉，参数一个都传不到（实测症状：跑的是默认值、且 `bad
arguments` 时打印的 usage 里那串参数是"裸值"没有标志名）。`cmd` 下原样 `--` 即可；绕开 npm 用
`node native/tools/native.mjs godot-run --stage 2` 也最省事。
⚠ **带逗号的值也要加引号**：PS 里逗号是数组分隔符，`--click 397,225` 会被拆成两个参数 ⇒ 写
`--click '397,225'`（`--click-window` 同理）。
`GODOT_BIN` 可指定 Godot 可执行文件；不设就按 `PATH`（`godot4`/`godot`）→ 桌面上的
`Godot_v*_win64*.exe`（同版本优先 `_console` 变体，Windows 上只有它会把 `[godot]` 那几行打到 stdout）。

`LfwGodotHost` 是 `HeadlessHost` 的**子类** —— 装载 / `IZip` / 存档 / XML / `import_as_*` 复用同一批
源文件（与 `lfw_run`、wasm 宿主同一份），只按 §G3 换掉「帧从哪来」：**注入的虚拟时钟 + 固定步长**
（`ManualClock::add → 0` ⇒ 端口自己的 `Ticker` 不自驱；这正是 wasm 那边「一帧走两步」的坑）。
`_process(delta)` 只把 `delta` 当**节拍**喂进累加器，够一个步长才
`clock.advance(step)` + `world.update_once(step)`；`--delta` 只换节拍，不换步长。

**指针输入**：`_input()` 是平台事件唯一的入口（`_ready` 里 `set_process_input(true)`，GDExtension
必须显式开）—— 鼠标按下/抬起/移动/滚轮 → `LfwPointingEvent` → `HeadlessHost::emit_pointer_*`
→ `host/common/ui_input_handle.{h,cpp}` 的命中测试 → `POINTER_*` 命令 → `UINode` 分发。
坐标换算与 UI 的绘制**互为逆**：`_draw()` 在逻辑屏幕像素里画（`GodotUINodeRenderer` 的 `_box_*`），
逻辑屏幕恒为 794×450（窗口可以更大；`project.godot` 的 stretch 是 `disabled` ⇒ 缩放/居中/裁剪
由宿主自己做，见「窗口外观」）⇒ UI 逻辑像素（`scene = x/w*2-1, -(y/h)*2+1`）是**全局口径**，
窗口像素进 `_input` 后由宿主的 `contain_transform()` 逆变换换回逻辑像素。
注入用两个口：`--click <x>,<y>[@<frame>]` 走**逻辑**坐标、`--click-window <x>,<y>[@<frame>]` 走**窗口**
像素（用来验证换算：1.5× 下窗口 595,337 = 逻辑 397,225；1400×500 下窗口 700,250 = 逻辑 397,225），
与 `lfw_run --click` 同一条链。
它同时覆写 `create_world_renderer`（`LfwGodotHost::create_world_renderer`）返回 Godot 的世界渲染器，
与 `create_ui_node_renderer`（每个 `UINode` 一份 `GodotUINodeRenderer`，所有权归节点）——
后者把 UI 模型树翻成**同一批**绘制项，落进世界渲染器"正在写的那一帧"（`ui_begin/append/end_layer`，
按 `pass = -1|0|+1` 落位 = D1(a) 的五遍次序）；
`_process` 每个 step 之后按 `lfw_thin` 的同一口径补一次 `World::render_once`（本宿主不装
`IRenderScheduler`，`render_add` 回 0 ⇒ 世界自己**不会**渲染），再 `queue_redraw()`。
文字度量（D4/D5-10 划给宿主的那一格）由 `ThemeDB` 的默认字体算，在 `LFW::load` **之前**装进宿主
（UI 数据在装载期就按度量定文本节点尺寸）⇒ 与 headless 的零尺寸桩不同，**代价是布局与 TS 的
浏览器字体不逐位同宽**。
**音频**（2026-10-16 落地）：`lfw.sounds` 的语义与算式在 `LfwGodotHost`（`sounds/Modern.ts` 那一份，
一行 Godot 类型都没有），解码/播放在 `lfw_godot_node.cpp`（24 个音效槽 + 1 个 BGM，每槽一条总线 +
`AudioEffectPanner`）；诊断行 `[godot] sounds:` 在收尾打一次、给了 `--every` 时随变化打。

一次性准备（godot-cpp 与 API dump 都放在仓库外 / 构建目录，不进仓库）：

```
# 1) godot-cpp（仓库外）。上游**没有 4.7 线**（分支只有 4.0–4.5 + master/10.0.0）⇒ 用 4.5（头 27d9dd2），
#    绑定按下面那份 dump 生成（不是猜版本，是让引擎自己说出它的 API）
git clone -b 4.5 https://github.com/godotengine/godot-cpp.git %USERPROFILE%\godot-cpp-4.5
# 2) 让本机 Godot dump 它的 API / 接口头到 native\build\godot-api\
cd native\build\godot-api
<godot-console> --headless --dump-extension-api --dump-gdextension-interface
# 3) 第一次让 Godot 认这个工程（生成 .godot/extension_list.cfg）
#    ⚠ 不跑这步 Godot **静默**不加载扩展（只会在场景里报 Cannot get class 'LfwGodot'）
<godot-console> --headless --import --path native\host\godot\project
```

编 + 跑（`npm run native godot` 自己找 VS / cmake / ninja，与其它 target 同一条路）：

```
$env:GODOT_CPP_DIR = "$env:USERPROFILE\godot-cpp-4.5"
npm run native godot                       # 产物 native\host\godot\project\bin\lfw_godot.dll

$godot = "C:\Users\Gim\Desktop\Godot_v4.7.1-stable_win64_console.exe"
$root  = (Get-Location).Path               # 仓库根
& $godot --headless --path native\host\godot\project -- `
    --root "$root\dist" --zip "$root\native\build\host-data\prel" `
    --frames 300 --every 300 --delta 0.017
```

⚠ 三条实测容易踩的：
**① Godot 跑工程时会把 cwd 切到工程目录**（`--path` 的副作用；实测 `cwd=native/host/godot/project`）
⇒ `--root` / `--zip` 给**绝对路径**最省事（相对路径是相对工程目录，报错行里会连 cwd 一起打出来）。
**② 这一支不许 `/GR-`**：`Object::cast_to<T>` 走 `dynamic_cast`（`godot-cpp/include/godot_cpp/core/object.hpp:129`），
关掉 RTTI 后扩展一加载就把进程带走（实测退出码 `0xE06D7363`）⇒ 本 target **保留 RTTI**，只关
`_HAS_EXCEPTIONS`（RTTI 不改任何 `std::` 类型的布局，与 `/GR-` 的 `lfw_core` 混编对 `Value` 这条边界安全）。
**③ 改了 `host/godot/**` 的**头文件**就当"全量"重编**：ninja 这边**没有头文件依赖**（改 header 不触发
依赖它的 `.o` 重编）⇒ 类的布局/虚表一半新一半旧，表现是**退出时** `signal 11`（实测：跑得好好的、
摘要也照旧，一 `quit()` 就崩），**或者更阴的"某些 UI 行为莫名其妙"**（不崩、就是反应不对）。
现在 `npm run native godot` **自己会判**：`native/host` / `native/lfw` 下任一源文件比
`lfw_godot.dir` 里最新的 `.obj` 还新 ⇒ 先把整个对象目录删掉再全量重编（打一行
`host/lfw 下有比 .obj 更新的源文件 ⇒ 删掉 lfw_godot 的对象目录，全量重编`）。
手工作废那一步（`native\build\msvc-x64` 那边同一类坑照老规矩办：删 `.obj`/`.lib`/`.exe`）：
先删 `native\build\godot\host\godot\CMakeFiles\lfw_godot.dir` 再 `npm run native godot`。

三条摘要与 `lfw_run` **逐位一致**（连 `warns` / `ignored_images` / `renderer(±)` / `clock=` 都对得上）
—— 见下一节。

### 开放模式现在能走到哪（照实记）

从数据自己的首页 `init` 开始，指针 + 键盘都走真事件链（`--click` / `--key` 与真鼠标/真键盘同一条）：

```
init（启动页：CLICK ANYWHERE TO CONTINUE）-- 点任意处 --> init 的介绍动画 --> entry（入口菜单）
entry：点 Settings           ⇒ 1:settings（层 1 压上设置页）        ✅ 指针可用
entry：Game Start            ⇒ 0:loading → **装 `dist/data.zip`**（按 URL：剥掉 `?time=`/`?md5=`，
                               真 MD5 校验，中央目录 + DEFLATE）→ 0:main_page     ✅ 走得通
main_page：Stage Mode        ⇒ stage_mode_prepare_page（八人/选人框）  ✅ 指针可用
选人页（CharMenuLogic）：     ✅ **键盘可用**（`--key` / 真键盘）：a/j 加入、L/R 换人、
                               U 改队；倒计时走完 → "How many Computer Players?" → 电脑选人 →
                               Game Setting；`U U a` 命中 `btn_fight` ⇒ 开打
```

一条命令从入口页走到**真对局**（Godot 宿主；`--play` = 不 `boot_scene`，由数据页面驱动）：

```
$R = (Get-Location).Path; $g = "$env:USERPROFILE\Desktop\Godot_v4.7.1-stable_win64_console.exe"
& $g --headless --path native\host\godot\project -- --play --frames 1700 --every 200 ^
    --root "$R\dist" --zip "$R\native\build\host-data\prel" --delta 0.017 ^
    --click '397,225@10' ^
    --key 'j@450' --key 's@500' --key 'j@520' `      # Game Start → main_page → Stage Mode（八人框）
    --key 'j@560' --key 'j@580' --key 'j@600' `      # a ×3：加入（FighterSel→TeamSel→Ready）⇒ 倒计时
    … --key 'j@640' …'j@860' (10 次) `               # 倒计时里每次按 a 减 500ms ⇒ 提前结束
    --key 'j@1000' `                                 # 选电脑人数（com_num_7）
    --key 'j@1020' …'j@1440' (22 次) `               # 逐个电脑选人（每人 2 下）⇒ Game Setting
    --key 'w@1520' --key 'w@1540' --key 'j@1560'     # U U a ⇒ btn_fight ⇒ start_game
# [godot] key @frame 520 down j times=0 pages=0:stage_mode_prepare_page
# [godot] key @frame 1560 down j times=0 pages=0:stage_mode_page
# [godot frame   1600] entities=2 ghosts=0 hp=550.0 digest=4df88d26eaa707b2
```

要点（都是这次接线时踩出来的）：

- **`times` 从 0 起算**：`Keyboard.ts` 的 `_times_map.get(key) ?? -1` 先减后加 ⇒ 第一次按下事件里的
  `times` 就是 0，`LFW::on_key_down` 只在 `times == 0` 时翻 `KEY_EVENT`。宿主 `key_down` 必须照这个发
  （写成「第一次 = 1」会让所有按键静默失效）。
- **LFW 自己要进回调表**：`keyboard_add_callback` 原先是个空实现 ⇒ `emit_key_down` 没人收。
- **入口页的 `btn_game_start` 自带 `auto_focus`**（`entry_page.ui.xml`）⇒ 直接 `a` 就行；
  main_page 的焦点在第一个可见按钮（VS Mode）上，**再按一次 D 才是 Stage Mode**。
- **真 `.zip` 装进来的图要能被读**：`GodotWorldRenderer::read_resource` 原先只认
  `FsZipObject`（`--zip` 的目录）⇒ 菜单加载的 `data.zip` 里的精灵/背景读不出来（角色画成方块）。
  现在两种包对象都走 `read()`（真 `.zip` 的那条路经 `ZipFileObject`）。
- **真键盘的坑 `--key` 量不出来**：`--key <name>` 给的就是键名，**绕过**了"平台键 → DOM 键名"
  那一档（`dom_key_of_godot`）。真键盘必须让窗口自己收到 `InputEventKey`（`--play` + 真窗口，
  或 `PostMessage` 真 `WM_KEYDOWN/UP`）⇒ 开放模式下 `_input` 会把**每一条**键盘事件打一行
  `[godot] keyraw#<序号>: down|up dom='…' keycode=… phys=… uni=… echo=…`（序号连不连得上就知道
  日志有没有丢行），`keyfocus` 那行与 `[godot frame N]` 那行都带上了 `pages=`。
  「按攻击没反应」那个 bug 正是这条量出来的，见「2026-10-16」那节最后一条。

想知道开放模式没崩、还在推帧：`npm run godot '--' --play --every 300` 会每 300 帧打一行
（实测跑到 3300 帧以上、窗口仍活着）；关窗口会有 `[godot] exit: frames=… pages=…` 一行收尾。

### 与 Web 版对不上的地方（照实记）

拿上面「与 Web 版对拍」那条流水线跑出来的账（`webcmp-*` 截图 + 两侧的 UI 节点树对数值）。**已经修掉的**
记在「画面存档」那一节的描述里，这里是**还差**的：

| # | 现象（Godot ↔ Web） | 根因（已查到） | 状态 |
|---|---|---|---|
| 1 | `main_page` 菜单**少两项**：`生存排行` / `双人生存排行` | `MainMenuLogic.apply()` 按 `lfw.survival_rank_available` 显示/隐藏这两个入口（`src/LFW/ui/component/MainMenuLogic.ts:31-40`）；Web 侧由 App 调 `init_survival_rank(lfw)` 置真（`src/survival_rank.ts:243-262`，本机构建注了 `RANK_API_URL` ⇒ 列表会真的去 `lfj.gim.ink` 拉） | **缺口**：要真做就得给宿主加 HTTP 面（`get_rank_list_api` / `get_my_rank_api` / 上报），再把 `set_survival_rank_data` 灌进去 |
| 2 | 每行文字的高度**多 1 像素**（`version_name` 15 ↔ 14、`sound_warning` 46 ↔ 44、`long_text` 88 ↔ 84），宽度已经逐项对齐（±1） | 行高口径不同：TS 是 canvas 的 `fontBoundingBoxAscent + fontBoundingBoxDescent`，端口是 `Font::get_height(size)`（Arial 上 ≈1.167em ↔ ≈1.111em）。**宽度**那一半已经修好（字族 + 四边内边距 2，见上） | 允许偏差（`DESIGN.md:1526`：字体/设备相关）；再多行节点上差到几个像素 |
| 3 | 运行期切语言（设置页）不会更新已建出来的 UI 文本 | `set_lang` 的"重写节点文本 + 按新语言重度量"那一半在宿主侧（`ILfwHost::lang_apply`，`lfw.h:265`）；`HeadlessHost` 只切 i18n 表（`headless_host.cpp:484-489`，README 旧账）；首发语言因为设在 `load` 之前所以**不受影响** | 缺口（要照 `LFW.ts:157-197` 那三步实现：收集 → 改 `_i18n.lang` → 重度量/重设文本） |
| 4 | **世界那一遍的背景层**没有 UV 偏移动画（UI 那一遍 2026-10-16 已补），`opacity < 1` 的层也没乘（`mat.opacity` 那一档） | TS 是 `BgLayerRender.render`（`BgLayerRender.ts:110-174`）：`offsetX/Y += sec*offsetAnim*`，周期 = `min(源图, 目标)`，再 `tex.offset = pos_mod(offset, 周期)/周期`；`update_uv` 里 `opacity = info.opacity ?? 1` ⇒ `mat.opacity = opacity`。端口 `lfw_godot_renderer.cpp` 里连 `offsetAnim` 都没读、`it.a` 也恒 1 | **缺口**（照上面那份口径补一份就行：世界端没有 `anim_r` 旋转，只有 X/Y） |
| 5 | 入口页两张背景大脸（`bg_l_face` / `bg_r_face`，各 14 帧 `RandomVisible`）落在**不同的帧**上 | 两侧取的时刻不同（Web 那次 entry 是点完 4.7s；Godot 是第 400 帧 × `--delta 0.017`）⇒ `lifetime` 不同。不是"帧选择逻辑"不一致 | 观察值，不做结论（要判定得让两边落在同一个 `lifetime`） |
| 6 | 顶栏那一簇控件在 `main_page` 上个数可能不同 | 两侧的**显示条件**都读同一批状态（`c.bg_is_void` / `settings_page` / `first_page_init_demo` / 页栈深），但 Web 顶栏是 React 组件、Godot 是宿主自绘表；`first_page_init_demo` 只在 `/demo` 路径下为真 | 待逐格核对（截图上的小图标人眼/视觉模型都不可靠，得按 `--click-window` 逐格点） |

（第 7 条"八人框里 `Picture.set_src` 失败 3 次"已修 —— 根因是宿主的 `ui_image_load` 没给图片尺寸，
见下面「2026-10-16」的最后两条。）

### 2026-10-16：用户玩的时候报的（都已修）

* **"Launch 页文字歪了"** —— 症状是**所有居中/右对齐的文字整段往右铺**，量出来的数：
  警示文字本该在逻辑 `x∈[188,606]`（盒子中心 397），实际画在 `x∈[397,793]`（从盒子中心起画、并被右边界切掉）。
  根因：`CanvasItem::draw_string` 的 `alignment` 一栏**在 `width < 0` 时不生效**（那一档不会去算对齐偏移），
  而 `width = item.w`（折行）那条路又和 TS"只按 `\n` 切、不折行"的口径冲突。⇒ 改成
  **自己量行宽、自己摆 x**：`alignment` 固定 LEFT、`width` 固定 -1，锚点照 TS 的
  `padding_l + round(...)`（`lfw_godot_node.cpp` 的 `draw_text_item`）。修完实测
  警示文字 `x∈[286,905]`（窗口像素，×1.5 ⇒ 逻辑 `[190.7,603.3]`）= 盒子里居中 ✓。
* **"背景网格的 UV 移动动画怎么没了"** —— 不是"没了"：`_anim_x/_anim_y/_anim_r` 从 `cook` 期就一直在读
  （`sync_model`），但**没有一行代码用它们** ⇒ 启动页那张 `repeat 20x11` 的平铺网格在 Godot 里一直静止。
  已按 TS `UINodeRenderer.update_texture_attributes`（`UINodeRenderer.ts:369-388`）补上积分：
  先按 `offsetAnimR` 累进角度、再把 `offsetAnimX/Y` 旋进 `_uv_x/_uv_y`。侧向实测（第 200 帧 vs 第 220 帧，
  以 20 帧为单位）：图案右移 **12 窗口像素**（0.6 px/帧；解析值 0.506 px/帧，相关法的分辨率是 ±0.1 px/帧），
  与 Web 版同向 ✓。⚠ 只有 `_uv_y` **反号**：TS 加的是 three.js 的 v 轴（`flipY=true` ⇒ v=0 在图底），
  而这里喂的 `crop_y` 是图顶向下的行号 —— 这条是**推导**出来的（那张网格是自相似的 32×32 平铺，
  周期内相关法分不出上下，实测不出结论），注释写在 `lfw_godot_ui_renderer.cpp` 的积分处。
* **"bg uv 溢出变成最后一像素延申"（接在上面那条后面报的）** —— 真因是**取模的符号**：
  `std::fmod` 跟着被除数的符号走（`fmod(-1.5, 32) == -1.5`），而 `_uv_y` 恰恰是**负**的
  ⇒ `cy`/`sy0` 变成负数 ⇒ `draw_texture_rect_region` 的**源矩形越界**，引擎把源夹到纹理边界
  ⇒ 每个瓦片都被"挤"了一下、边缘那一行/列看起来被拉长。改成 TS 的**正模** `pos_mod`
  （`((a % b) + b) % b`，`BgLayerRender.ts` 用的就是它）⇒ 源窗口恒在 `[0, lw)`、`s + sw ≤ lw` ✓。
  与修之前同一帧相减：`mean=0.110 max=8 px>2=36548`（变化就落在图案错位的那些像素上）。
* **"按攻击无法触发高亮 UI 的点击 / 角色选择选不了 / 上下只能切前两个"（三条报的是同一个 bug）** ——
  真因在**宿主侧把 Godot 的键**翻成 DOM 键名时的**抬起那一半**：`dom_key_of_godot` 原先只有
  "查表（控制键）+ `get_unicode()`"两档，而 **Godot 的 `InputEventKey` 在抬起时不填 `unicode`**。
  实测（`--play` 下新加的 `keyraw#` 诊断，一条一行原始字段）：
  ```
  [godot] keyraw#1: down dom='j' keycode=74 phys=4194313 uni=74 echo=0
  [godot] keyraw#2: up   dom=''  keycode=74 phys=4194313 uni=0  echo=0   ← 抬起被静默丢掉
  [godot] keyraw#9: down dom='enter' keycode=4194309 ... uni=0           ← 查表那档反而没事
  ```
  ⇒ `HeadlessHost::key_up` 从没被调用 ⇒ 那个键永远留在 `pressed_keys` 里 ⇒ 下一次按下
  `times = prev + 1 != 0`，而 `LFW::on_key_down` **只在 `times == 0` 时翻 `KEY_EVENT`**
  ⇒ **任何字母/数字键"按一次之后就再也不响"**。这正好对上三条抱怨：
  `j`（玩家 1 的攻击）按第二次起无效 ⇒ "攻击键按了没反应"；`s`/`w`（玩家 1 的上下）第二次起无效
  ⇒ "按上下只能切前两个"；选人页里连按攻击本来是 `a` 重复推进 `加入 → 角色 → 队伍 → 倒计时`
  ⇒ "角色选择菜单也没法用了"。（`↓`/`↑` 是**有名字的**键，走查表那档，所以我头一次用 `↓`
  脚本化对拍时没复现出来 —— 教训：**`--key` 给的是键名，绕过了"平台键 → 键名"这一档**，
  真键盘的坑只能在真键盘（或真窗口的 `InputEventKey`）上量。）
  修法：`dom_key_of_godot` 加第三档 —— `unicode` 为空时用 `keycode` 兜**字母/数字**
  （`KEY_A=65`…、`KEY_0=48`…），顺手补齐**小键盘**（`KEY_KP_0..9` / `KP_PERIOD` …：DOM 的 `key`
  与小键盘无关，而玩家 2 的攻击键正是 `0`）。改完实测（真窗口 + `PostMessage` 真 `WM_KEYDOWN/
  UP`，一条命令走到 vs 准备页）：**6 次真按下 `j` 全部打出 `down j` + `up j` 成对**，
  页序 `init → entry → main_page → vs_mode_prepare_page`，且准备页里每按一次 `j` 后
  `[godot frame N] … pages=0:vs_mode_prepare_page digest=` 都变（= 状态机真的往前走），
  最后停在"有多少个电脑玩家?"那一步 —— 存图 `shots/realkeys-vs-prepare.png`。
  三条宿主摘要（`lfw_run` 的 3 条 + Godot 的 3 条）改前改后逐位相同。
  顺带把诊断补齐（都只在 `--play` / `--every` 生效）：`_input` 每条键盘事件打一行
  `keyraw#<序号>: down/up dom='…' keycode/phys/uni/echo`（序号能看出日志有没有丢行）、
  `keyfocus` 行加上 `pages=`、`[godot frame N]` 行加上 `pages=`。

* **"ninepatch有问题"** —— 症状：`nine_patch_test` 那一页整张 18×18 的框被**拉成** 400×200
  （圆角半径 ≈155 像素），而 Web 那边是正常的 7 逻辑像素边框。真因：UI 那一遍**根本没画九宫格**
  （`emit_image` 只有"整图 / 裁剪 / 平铺"一条路，`nine_patch` 那几个字段从烹饪期读进来之后没人用）。
  已按 TS `NinePatchGeometry` + `UINodeRenderer.next_geometry` + `shader/outline.frag` 补上
  （`GodotUINodeRenderer::emit_nine_patch`）：源窗口 = `us * clip_w + clip_x`（一倍图逻辑像素）、
  目标格子 = `t_s * l_w * |gsx|`（`t_s = 1/@Nx`）、镜像（全局缩放为负）= 列序反过来 + 每格内容再翻一次。
  实测（`--ui-page nine_patch_test`，与 Web 同区域归一化相减）：`items=1 → 9`、dump 里出现
  `np=28,28,28,28/72x72`（`!sprite/frame@4x.png`：72×72 的图、四边各 28 ⇒ 7 逻辑像素），
  `mean=34.2 → 4.5`（`px>24` 从 226232 掉到 889），像素列序与 Web 逐列一致；`有多少个电脑玩家?`
  那个框也跟着对上了（面板对面板 `mean=8.6`，残差是文字抗锯齿）。用了它的页：`how_many_computer` /
  `game_prepare_menu` / `dialog_bottom_right` / `dialog_bottom_long` / `nine_patch_test`。
* **"角色头像没显示"**（同一根因也解释了原来记在缺口表里的"八人框里 `Picture.set_src` 失败 3 次"）——
  症状：`CharMenuHead.join()` 之后头像那一格**什么都没有**，而 `--ui-dump` 打出
  `ui/head box=(230.0,93.0 0.0x0.0)` / `crop=(0.0,0.0 120.0x120.0)`（图**是**命中了的），
  同时每 `join` 一次报一条 `[Picture::set_src]Error: type of 'IUIImgInfo.dw' must be positive
  integer, but got NaN`。真因在**宿主边界**：`UIImgLoader::load` 照 TS 拿加载结果里的 `w`/`h`/`scale`
  去 `node.resize(w / scale, h / scale)`，而 `HeadlessHost::ui_image_load` 给的"零尺寸占位"里
  **没有这三个键** ⇒ `undefined / undefined = NaN` 写进节点尺寸 ⇒ 盒子 0×0 什么都画不出来；
  下一次 `set_src` 又拿 `Picture.width() = node.w()` = NaN 当 `dw` 上报 ⇒ 校验直接拒。
  （Godot 宿主继承的就是 `HeadlessHost`、自己也没覆写，所以它一样给不出尺寸。）修法两条：
  ① `HeadlessHost` 的占位改成 TS 口径的 `w/h/scale = 0/0/1`（零尺寸但**有限**，`0/1` 不再是 NaN）；
  ② `LfwGodotHost::ui_image_load` 覆写：用世界渲染器那张"命中条目 + `@Nx` + PNG 头"的表给真值
  （`w/h` = **结果位图**的自然像素；带 `crop` 操作时 = `dw/dh × scale`，见 `handle_image_operation_crop`）。
  实测（真键盘那一档）：`ui/head box=(170.0,33.0 120.0x120.0)` ✓、`set_src` 告警 **3 → 0** ✓、
  头像真画出来了（`sprite/RFACE@4x.png` 那张 `? / RANDOM / 隨機選角`，墨迹 `x∈[186,272]` 居在
  120 宽的盒子里）✓。
  顺手修好的还有同款的第二处：`cook_ui_info` 里"按 `img_info` 的 `w/h/scale` 给零轴补尺寸"那一步
  以前**永远跳过**（`img_info` 里没这三个键）⇒ 数据里只写 `img: {path}`、不写 `w/h` 的节点
  （`settings_ctrl` 的 `CS2..CS7` 那几张控制方式图标）尺寸一直是 0×0、画不出来；现在照 TS 取图片自身尺寸。
  两侧逐节点对过（`--ui-page settings_ctrl`）：Web `no_id_1710 cross=(0.0,0.0 106.0x91.0)`
  ↔ 宿主 `box=(40.0,28.5 106.0x91.0)`（同一张 `sprite/CS6.png`）✓。
* **"头像下方文字未能居中"** —— 症状：八人框里名字 / 角色 / 队伍三行文字贴在 120 宽的格子左边。
  真因是**文字块的摆放口径**：TS 里文字是"块尺寸"的一张网格，**块中心压在节点矩形中心上**
  （`mesh.position = round(w*(0.5-cx))` / `round(h*(cy-0.5))` —— 与节点矩形的平移 `_tran_x/_tran_y`
  是同一个式子），`text_align` 只在**块内部**排（`split_text_to_lines` 的 `l.x` 用的是"最宽一行 +
  左右 padding"，**不是**节点宽度）。端口以前把"块内部的那点偏移"直接当成"块在盒子里的偏移" ⇒ 等于**贴左**。
  一直没被发现的原因：数据里几乎没有"显式 `size` + 静态文字"的节点（静态文字节点的尺寸都由
  `auto_size_by_text` 按量出来的文字尺寸定 ⇒ 块宽 ≡ 节点宽，两种口径分不出来），
  `player_name` / `FighterName` / `player_team` 是少数"显式 `size: "120, 19"` + 运行时文字"的节点。
  修法：先量一遍所有行（块宽 = 最宽一行 + 4），块左边界 = 盒中心 − 块宽/2，再按 `text_align` 在块内排。
  实测（第 1900 / 2300 帧两张图，墨迹 = 亮度 > 128 的像素包围盒）：`player_name "1"` 墨迹中心 **229**
  （盒中心 230）、`FighterName "随 机"` `215..245` ⇒ 230、`player_team "无队伍"` `210..249` ⇒ 229.5、
  未加入那几格的 `加 入?` `339..377` ⇒ 358（盒中心 359）—— 全部落在盒中心 ✓。Web 侧同一个节点、同一个盒
  （`player_name geo=(170,156.5 290,175.5)`，两边 `--ui-dump` ↔ `--dump-ui` 逐位相同）的墨迹中心也在
  **230** ✓ ⇒ 两边同一条口径。（纵向那一半当时**没动**：仍是"盒顶 + padding + ascent"，块高 ≡ 盒高
  （自动定尺寸的节点）时与"块居中"恒等，显式 `size` 的节点差 ~0.5 像素 —— 这一半 2026-10-16 才补上，
  见下面「语言那一行的箭头不居中」那条。）
* **"很多 bg 有纯色且相对相机不移动的 Layer，这些 layer 渲染得不对"**（用户截图上狮林那一块"棕色台子"）
  —— 症状：bg_2 第 7 层 `{absolute: 1, color: "rgb(16,79,16)", w/h: 794×172, x: 0, y: 194, z: -4}`
  本该是屏幕底部那一整条深绿底块，Godot 里画成了**棕褐色块（217,135,97）** + 右边缘一条黑缝
  （15,18,25 = 窗口底色）。`217 = 0.85×255`、`97 ≈ 0.85×0.45×255` 正是"取不到图"占位色块那条公式
  `Color::from_hsv(hash(tag), 0.55, 0.85)` 的两个端值（`lfw_godot_node.cpp` 的 `draw_item`）。
  三个根因：
  ① `parse_color` 只认 `#hex`。烹饪出来的纯色层写的是 `rgb(r,g,b)` **字符串**（`dat_translator/bg_data.cpp`
  的 `bg_color_translate`），而 `rf-lf2` 那批手写 json5 写的是**数字**（`color: 4144959` = `0x3F3F3F`）
  ⇒ 前者解析失败、后者连图层都进不去（`str_or(color)` 给空串）。已按 three.js `Color.set` 的口径重写：
  **数字 = `0xRRGGBB`**、字符串 = `#rgb` / `#rrggbb` / `rgb()` / `rgba()`（⚠ 别拿 UI 那套
  `ui/utils/int_to_rgba` 当替身 —— 那个是 **ARGB**，`0x3F3F3F` 按它解出来 alpha = 0、整层透明）。
  ② 就算颜色解出来了也白搭：纯色层没有 `flat` ⇒ 掉进"没纹理"的占位那一档（占位块压根不看 `it.r/g/b`）。
  ③ `absolute: 1` 的层被算成 `world_x = 0` 再减相机 ⇒ 整层跟着相机跑。
  修法（都照 TS `BgLayerRender.build_nodes/render` + `BgRender.render`）：尺寸走
  `has_pic ? (dw ?? 源图宽) : (w || width)`（JS 的 `||`，`0` 落回后一个）；颜色**只在没有图时**生效
  （TS `if (!src_texture && color !== void 0) m.color.set(color)`）、纯色层 `flat = true`（一块纯填色
  矩形：不查纹理、不画占位）；`absolute` 层的坐标照 TS 挂在 `cam_node` 上（`position.x = cam_x`、`y` 不动）
  ⇒ 屏幕上 `x` 恒 = `info.x`、**与相机和 zoom 都无关**（非 absolute 仍是
  `cam*(1-zoom) + x + parallax - cam`）。实测：
  - 三条宿主摘要改前改后逐位相同 ✓（渲染不碰模拟）。
  - 世界那一遍（`--stage 0 … --vs` 第 600 帧、`cam=20.9`，与归档的 `shot-vs-stage0.png` 同一状态）：
    底块那一遍 **794 列全部落到纯 `(16,79,16)`**（`y ∈ [250.7, 427.3]`，被前面地面图挡住的行除外）；
    改前占位块只覆盖 `x ∈ [-20.9, 773.1]` ⇒ 右边 21 列直接露窗口底色。像素差的主项就是
    `(217,135,97) → (16,79,16)`（30660 像素）与 `(15,18,25) → 绿`（6103 像素）。
  - 与 Web 对拍（入口页键串走到真对局、`cam=0`；Web 侧 `native\build\bgfix\web\web-match-running.png`
    裁 `:76,0,625,354`）整帧 `mean 35.891 → 7.217`、`px>24 100435 → 45419`（残差主要是两边对局状态/招式
    不同）；底块 `y ∈ [255.3,427.3]`、`x ∈ [0,793.3]`，与 Web 那一带**逐像素同色**。
  - "不跟相机跑"这条不变量：同一局里按住 `d` 走到 `cam=105.5`，底块仍覆盖 `x ∈ [0,793.3]` ✓。
  - 顺带：以前 `--ui-page` 只能点世界之外的那些页 ⇒ 想要"只看世界那一遍"的干净图没有别的办法；
    现在配 `--ui-page center_pause_label`（只有几个文字节点的一页）就能拿到 —— `shot-vs-stage0.png`
    就是这么重出的（命令见「画面存档」，**改之前**那一张留在 `bg-color-before-vs-stage0.png`）。
  - **还差**（本次没动，见缺口表 #4）：`offsetAnim*` 的 UV 偏移动画、`opacity < 1` 那两档背景层
    （`ash_forest` 的 `ash_drop` 就是 `opacity: 0.5`）。

* **"角色似乎无法离开地面，无论跑跳还是普通跳、甚至被打倒都不会向上飞"** —— 这不是渲染问题，
  是**模拟**问题，而且根因只有一行：`LFW` 构造里给世界/工厂的状态表是**新建的空表**
  （`_states = std::make_unique<state::States>()`，2026-10-08 的 LFW 门面切片就带进来了）。
  TS 那边 `Entity` / `common_creator` 的 `states` 缺省值是**全局**的 `ENTITY_STATES`
  （`src/LFW/state/ENTITY_STATES.ts` ⇒ 端口 `state::entity_states()`），端口这条缝却自己造了一张空表：
  ⇒ 每次 `set_state` 都 **miss**、退化成 `States::fallback` 现造的 `CharacterState_Base`/`WeaponState_Base`
  ⇒ **写在状态对象里的逻辑全部不跑**（`CharacterState_Jump::enter` 的起跳初速度、`CharacterState_Dash::enter`
  的冲刺初速度、`on_landing` / `on_leave_ground` / `get_gravity` / `get_auto_frame` …），
  只剩**数据帧自己带的 `dvx`/`dvz`** 还在生效 ⇒ 水平跑动正常、垂直方向永远起不来。
  量出来的铁证（改前，`lfw_run --stage 1 … --every 1`）：场上 6 个实体**每一帧 `y` 都是 0.00**，
  进 `state=5`（Dash = 跑跳）之后就卡在那一帧链上（`x` 冻在 65.0、`wait` 归零、`is_on_ground` 一直 1），
  血量 600 帧不变（打不着）；临时在 `Entity::set_state` 里打一行就能看到
  `miss=1`、`global=0`，而且那张空表被 `fallback` 越填越大（`n=1,2,3…`）。
  修法：`LFW::_states` 改成**指向全局表**（`lfw.h` 一个字段类型 + `lfw.cpp` 一行赋值）。
  改后同一场景（`--every 10`）：
  ```text
  [  state] 102{state=5 frame=213 x=86.5 y=27.9 …}      ← 跑跳真的离地了
  [  state] 102{state=15 frame=219 x=235.5 y=0.0 …}     ← 落地回到站姿
  [  state] 102{state=3 frame=81 x=241.1 y=45.3 …}      ← 空中攻击（y=45.3）
  [  state] 102{state=12 frame=180 x=182.8 y=0.1 hp=393} ← 被打了：Falling + 掉血
  ```
  Godot 宿主里拿**真人**那一档复了一遍（`--play` 走到对局后按住 `k` = 玩家 1 的跳，
  临时诊断打印每个实体的 `state/x/y/vy/og`）：
  ```text
  101 st=4 x=48.25 y=0.000  vy=0.000 og=1   ← Jump 刚进
  101 st=4 x=48.25 y=18.582 vy=8.913 og=0   ← 离地
  101 st=4 x=48.25 y=85.866 vy=4.543 og=0
  101 st=4 x=48.25 y=109.449 vy=0.172 og=0  ← 最高点（≈109 逻辑像素）
  101 st=4 x=48.25 y=25.496 vy=-8.568 og=0
  101 st=0 x=48.25 y=0.000  vy=0.000 og=1   ← 落地回 Standing
  ```
  存图：`shots/match-air-dash-1191x675.png`（`--stage 1 --fighter 1 --fighter 4` 第 549 tick、
  `--ui-page center_pause_label` 只看世界那一遍：场上有人**悬在草地上方**）、
  `shots/match-states-1191x675.png`（第 2216 tick：躺着/跪着/站着三种状态 + 地上的武器/瓶子）。
  ⚠ **三条宿主摘要的值全变了**（下面那节已按新值改）：旧的 `7335aa25f4e1ce86` / `e4a9437292047044` /
  `f29d3bb1ea330c32` 是"状态机死掉"那一版的基线（改前三条在 `lfw_run` 与 Godot 上都逐位可复现 ——
  所以它们**只能证明两份宿主一致，证明不了与 TS 一致**）；现在
  `a7edd32e19a43ea9` / `13945ad1144c968d` / `61c42c78c9d0bcac`，`lfw_run` / `lfw_thin` / Godot 三边仍逐位相同。
  差分台面 **261/261 照样过** —— 因为 `world_fixture.h` 与 TS 的 `world.ts` **两边都显式传一张空
  `States`**（那条缝就是为台面留的），正好把 LFW 这条真实装配路径漏在外面。这是本片最该记住的一条：
  **台面绿 ≠ 装配对**。

* **"语言的箭头位置怎么不居中了？"** —— 症状：`设置 → 语言` 那一行 `◀ 简体中文 ▶` 的两个箭头**偏高**
  （和同一行的文字不齐）。真因是**文字块的纵向摆放**：TS 里文字 mesh 是**居中几何**（1×1 平面缩到块尺寸
  `w×h`），位置由 `UITextRenderer.update()` 的 `round(nodeH*(cy-0.5))` 给出 —— 那一点正是**节点矩形中心**
  ⇒ 块与矩形**同心**；端口把块的**顶边**钉在 `矩形顶 + padding` 上，盒高 ≡ 块高（`auto_size_by_text`
  的节点，尺寸就是 `measure_text` 按同一个块算出来的）时两者等价，**盒比自己那块文字大**时就偏上。
  `arrow_left` 正是那种节点：`size: "40,36"`、里面只有一个 `"◀"`（18px Arial ⇒ 块 22×25）⇒ 偏上
  `(36-25)/2 = 5.5` 像素。有意思的是同一个 `arrow_left` 的**高亮副本** `arrow_left_hl` 没有显式尺寸
  ⇒ 它的盒子就是那块 22×25、`--ui-dump` 打出来是 `box=(213.0,5.5 22.0x25.0)` —— 正好就是"TS 该画在哪"
  （块顶 5.5 = 盒中心 18 − 25/2）✓。
  修法：`block_h = 行数 × 行高 + padding×2`、`block_top = 盒中心 − block_h/2`（块内仍是"顶 + padding +
  ascent"起基线）。
  实测（`--ui-page settings_misc`，`--window-scale 1 --display-scale 1` ⇒ 794×450 与逻辑像素 1:1；量的是
  **蓝字墨迹**（`#5A73D6`）的包围盒中心，窗口取 `arrow_left` 的盒子 `x∈[204,244]`、`arrow_right` 的
  `x∈[636,676]`）：
  ```text
                       左箭头      右箭头     同行文字标签
  Godot 改前           11.50      11.50      16.92      ← 箭头比标签高 5.4 像素
  Godot 改后           16.50      16.50      16.92      ← 与标签齐平
  Web（同一页、同一行） 16.56      16.58      15.28      ← 墨迹中心的量化步长 1.27 像素（画布 625/794）
  ```
  ⇒ 改后与 Web 差 **0.06 / 0.08 像素**（改前差 5.1）。自动定尺寸的节点**一个像素都没动**：那种节点的
  `h` ≡ 块高（同一个 `Font::get_height` 算出来的），`(h - block_h)/2 = 0`。
  存图：`shots/settings-language-row-1191x675.png`（改后的整页；箭头与文字齐平）。

* **"顶栏两个音量条：鼠标在按钮下方（调节条的位置）就弹出来"** —— 真因是**开的条件多了一半**：
  `titlebar_update_hover` 里写成 `hover == i || 指针在弹层矩形里`，而 TS 的规则是
  `.volume_hover:hover .volume_popup { display: block }`（`src/App.module.scss:116`）——
  弹层**关着**时它是 `display: none`（不计入命中测试），只有指针在**按钮盒**（= `.volume_hover` 的盒子，
  里面就那一个按钮）里才开；开着之后指针落进它自己那块弹层才保持开着（弹层是 `.volume_hover` 的**后代**
  ⇒ 祖先的 `:hover` 仍成立）。于是"指针在弹层矩形里"这一条必须先要求**那一层已经在开**。
  修法：`if (hover == i || (_bar.popup == i && rect_contains(popup_rect, bx, by)))`。
  实测（`--play` + `--window-size 1191x675 --display-scale 1.5` ⇒ `bar=794x32`、bgm 格 = CSS `570..602`，
  窗口 `879,24` = 按钮、窗口 `879,120` = 弹层带里那一点；量的是弹层那块矩形 `x∈[859,898] y∈[48,204]`
  的"深色像素"）：
  ```text
  改前：指针在弹层带（879,120）  dark=4677/6084   ← 条自己冒出来（用户报的）
        指在按钮上（879,24）    dark=4677/6084
  改后：指针在弹层带（879,120）  dark=0/6084      ← 不出来 ✓
        指在按钮上（879,24）    dark=4677/6084   ← 正常 ✓
        先按钮、再挪进弹层     dark=4677/6084   ← 保持开着 ✓（`--hover-window` 两条）
  ```
  存图：`shots/titlebar-volume-hover-1191x675.png`（指在按钮上：弹出竖条）/
  `shots/titlebar-volume-below-only-1191x675.png`（只指在按钮下方：干净，没有竖条）。
  与模拟无关：三条摘要逐位不变。

* **"怎么没有声音"** —— 真因是**一直没接**：端口里 `lfw.sounds` 就是宿主这一层（TS 是 `__Sounds`
  → `__Modern`），而两份宿主（`HeadlessHost` / `LfwGodotHost`）都只把音量/静音**存成字段**、
  `sounds_play*` 只打一行 `--dev` 日志 ⇒ 从 WASM 到 Godot 都没有一处真的解码/播放
  （README 的缺口表与 DESIGN 也一直把音频记成"空实现"）。这一片把**播出侧**补上，语义照 `__Modern`：
  * **算式仍在宿主那一半**（`LfwGodotHost`，一行 Godot 类型都没有）：`get_l_r_vol`
    的**每声道**幅度（`finalBaseVol × 左右权重 × scale`，`playings = _playings.size + 1` ⇒ `1/√n` 衰减）、
    `apply_sound_volume` 只重算**正在播的**、`apply_bgm_volume` 的「静音只是 `gain = 0`，
    **不停播**」与「请求时就已经静音 ⇒ `ele.paused` 一直为真、解除静音才起播」、
    `play_bgm` 的 `name !== _prev_bgm_url` 早退 + 返回**请求号**闭包（旧闭包不许停新歌）、
    `Randoming('bgm_randoming', lfw.bgms, lfw.mt)` 抽 `'?'`、`sounds_bgm()/is_random()`
    给 `BGMSwitcher` 的真名、以及 `on_bgm_changed`（以前**从没发过** ⇒ 设置页那行「BGM: …」不会随
    对局换歌而更新）。
  * **引擎那一半**（`lfw_godot_node.cpp`）只做三件事：资源路径 ⇒ `AudioStream`
    （MP3 / OGG / WAV 头嗅探，走 `GodotWorldRenderer::read_resource` 同一套取字节：包 → 根目录）、
    把数字落到播放器上、播完把 `id` 还回宿主（`on_audio_finished` = TS 的 `src_node.onended`）。
    24 个音效槽 + 1 个 BGM 播放器；**每槽一条自己的总线 + 一个 `AudioEffectPanner`** ——
    `AudioStreamPlayer` 没有 pan 参数，而 TS 是**每声道**两个增益。
    送过去的是 `gain = (l+r)/2`、`pan = (r-l)/(l+r)`：在 Godot 4.7.1 的 panner 法则
    （`lvol = clamp(1-pan)` / `rvol = clamp(1+pan)`，且**单声道**输入下 `out.left = gain·(1-pan)`
    / `out.right = gain·(1+pan)`）展开后**逐值等于** `(l, r)`（算式写在 `audio_play` 的注释里）。
    音效实测全是 mono（`data/*.mp3` 的帧头 channel mode = 3）、只有 `bgm/main.wma.mp3` 是 stereo，
    而 BGM 走的是没有 pan 的那一路 ⇒ 这个等价关系覆盖了所有实际素材。
  * **音量初值照 TS**：`__Modern` / `App.tsx` 是 `volume 0.3 / bgm_volume 0.5 / sound_volume 1`
    ⇒ Godot 宿主在自己的构造函数里就设这三个数（`HeadlessHost` 那三个 1.0 **不动**：差分台面的
    `sndset` 用例把它们钉住了）。顺带把设置页对上了：`--ui-page settings_misc` 里
    `总音量 30` / `音量(音乐) 50` / `音量(音效) 100`（改前是 `100/100/100`）。
  实测（一条命令走到真对局，`--play` + 完整键串）：
  ```text
  [godot] sounds: mixer 24 sfx slots + 1 bgm (per-slot bus + AudioEffectPanner) driver=WASAPI mix=48000Hz
  [godot] sounds: preload=1 decode=4 fail=0 play=36 bgm=1 active=1 bgm_playing=1 random=0 bgm_path=bgm/main.wma.mp3 bgm_gain=0.150 last=data/m_ok.wav.mp3
  ```
  `decode=4` = 启动音 `builtin_data/launch/093.wav.mp3` + `bgm/main.wma.mp3` + 两个菜单音；
  `active` 随音效播完**回落**（0…8）⇒ `onended` 那条回环是通的；`fail=0`（没有读不到的资源）；
  `bgm_gain=0.150 = 0.3 × 0.5` 就是 TS 那两个初值乘出来的数。
  静音那一档也量过（真窗口 + `--click-window 879,24@…` 点顶栏那个 BGM 喇叭，
  `--window-size 1191x675 --display-scale 1.5`）：`bgm_gain` **0.150 → 0.000 → 0.150**，
  而 `bgm_playing=1` 全程不变 ⇒ 正是 TS 的「静音只是 `ele.muted`，**不停播**」；
  摘要也不动（`digest=8c1776fedfdb678e` 与同参数的 headless 跑逐位相同）。
  `--headless` 下驱动是 `Dummy`（数字照走 ⇒ 验收脚本不需要声卡），开窗那一档是 `WASAPI 48kHz`。
  ⚠ **三条宿主摘要逐位不变**（`a7edd32e19a43ea9` / `13945ad1144c968d` / `61c42c78c9d0bcac`）——
  音频是宿主侧的事，不碰模拟。
  **还差**：`sounds.play` 那条路没有"解码失败 ⇒ 重试"的对应（TS 是 `load().then(play)` 异步重放）——
  端口的解码是同步的，读不到就报一行 `[godot] sounds: read failed:`；`[godot] sounds:` 那一行只在
  你给了 `--every` 时逐次变化打（`--play` 自己玩的时候只在收尾打一行，免得刷屏）。

* **"测试用例没法看"** —— 主页那个「测试模式」按钮（`btn_test_cases` → `push_page(test_cases_page)`）
  点进去是**空的**：那一页的 `component: ["Tests"]` 在端口里没注册（`TestCases` 整棵 54 个文件 /
  2610 行没移植）⇒ 页面只有它自己的两个文字节点（`test_case_name` + 底部快捷键行）。
  这一片把它整棵搬过来了：
  * `native/lfw/ui/component/tests/`：`test_case.{h,cpp}`（= TS `TestCase.ts`，用例基类）、
    `tests.{h,cpp}`（= TS `Tests.ts`：17 组 `CASE_GROUPS` + FSM + 左右/上下/攻击的按键规则 +
    页面上那行 `Case: …`），以及 13 个目录下 **105 个用例类**（ball / bat / bg / bot / firen /
    firezen / freeze / jan / julian / louis / others / rudolf / weapons）—— 与 TS 文件、类名一一对应。
    注册：`regist_components()` 里 `regist_one<Tests>(u"Tests")`。
  * 三处**形状**改写（写在 `test_case.h` 的头注释里）：① TS 的子类用
    `override readonly director = new ActionDirector()…` **换掉**基类那一份，C++ 不能覆盖数据成员
    ⇒ 基类给虚访问器 `director()`、子类自己持一份成员覆写它；② TS 的 `oid: string | string[]`
    ⇒ 一律换 `std::vector<std::u16string>`；③ `hori_3/hori_2/verti_3` 是**箭头函数字段**
    （缺省参数里绑 `this.midX/midZ`）⇒ 端口用 `std::optional` 表达"没给就用 midX/midZ"。
  * `ActionDirector` **复用**已有的那一份（`ui/component/action_director.{h,cpp}`，
    `LittleFunnyAutoGame` 也在用它）—— 我一开始另写了一份，链接期 `LNK2005`（同一个类两个定义）
    把它抓了出来；顺带把 39 处 `.sort()` 改成那份的名字 `sort_actions()`。
  * 两个**踩过的坑**：① `using UIComponent::UIComponent;` 的继承构造会实例化本类的析构 ⇒
    成员里放 `std::vector<std::unique_ptr<TestCase>>` 时 `TestCase` 是**不完整类型**，
    MSVC 直接 `C2338 can't delete an incomplete type`（报在 `<memory>` 里、指到 `tests.h` 的
    `using` 那一行）⇒ 改成裸指针 + `~Tests()` 里统一 delete；
    ② `World::clear()` 是"把所有实体设成 `gone_frame_info`"（不是立刻删表）⇒ 切用例那一帧的
    `entities=` 会先掉到新用例自己那一个再涨回来，看诊断行时别当成没清干净。
  * 实测（`--ui-page test_cases_page`，`--zip prel --zip data` 两个包）：
    ```text
    初始（0-0，TS 的裸 TestCase）：entities=0、test_case_name = "None"
    --key d（= 游戏键 R）        ：Case: 0-1 All Fighters，entities=26 hp=13000（24 个战士两排 + 2）
    --key s ×2                  ：Case: 2-0 Firezen D^A 0（Firzen 反复 D^A，火球来去 ⇒ 4…8 起伏）
    --key s ×16 再 --key w      ：Case: 15-6 Dropped Weapon: Pick Up & Throw Still Hurts
                                  ← 「Up 取上一组的**最后**一个用例」这条规则对上了
    ```
    与 Web 版对拍那一页的**初始态**：两侧都是"整屏黑 + 顶部 `None` + 底部快捷键行"（Web 侧
    `native\build\web\web-ui-page-test_cases_page.png`）✓。⚠ **再往后的用例对不了**：Web 那边的
    抓图工具（`native/tools/web_shots.mjs`）没有注入按键的口子 ⇒ 只能比初始态，其余靠上面这些数字。
    存图：`shots/test-cases-case-none-1191x675.png`（初始态）/
    `shots/test-cases-all-fighters-1191x675.png`（0-1：两排战士）/ `shots/test-cases-bat-duj-1191x675.png`
    （3-0：Bat 的 D^J，空中一串残影）。三条宿主摘要逐位不变（差分 261/261 照过）。

* **"（上面那条修完之后）用鼠标点「测试模式」就崩"** —— 点**任何**一个主页菜单按钮（甚至只是在
  主页空白处晃一下鼠标）都会 `signal 11`，而同样的按钮用键盘（焦点 + `Attack`）激活却没事。
  根因在**指针状态的节点寿命**：`cmds/cmd_pointer_events.cpp` 的 `on_uis` / `down_uis` 会**跨帧
  持有 `UINode*`**（TS 的 `Set<UINode>` 同理）。TS 那边这些对象被集合引用着、GC 不会回收 ⇒ 页面
  销毁后对它们派发 `leave` 只是"给孤儿对象清个标志"（没有任何可见效果）；端口这边页面一 `delete`
  就是**悬垂指针**，下一次指针事件里那句 `ui->on_pointer_leave()` 直接崩。
  实测的触发链（临时在 `cmd_pointer_move` 里打点，一条命令复现）：
  ```text
  [ptrtrace] MOVE ... --paths=0,0,8|0,0,3|0,0|0,0,0 --pages=init|init|init|init   ← 点一下 init 页，4 个节点进了 on_uis
  ...（init 页随后被 destroy）...
  [ptrtrace] MOVE ... --b=-1 --pos=7381.7,1700  on_uis=4          ← 之后再动一下
  [ptrtrace]   -> on_pointer_leave 000001B8EBABC330 id=undefined  ← 读已释放的节点 ⇒ signal 11
  ```
  ⇒ 修法：`UINode` 的构造/析构维护一份**活着的节点集合**（`live_uinodes()`，`ui/uinode.{h,cpp}`），
  指针状态里那三个"跨帧派发"的循环（`POINTER_MOVE` 的 leave、`POINTER_UP`/`POINTER_CANCEL` 的
  cancel、`POINTER_ENTER` 的 leave）改成先 `live_items()` 筛一遍（死掉的顺手从集合里删掉）。
  这条**与测试模式无关**（是端口里早就有的雷）：以前没人用鼠标点过会换页的按钮 —— 之前几刀全是
  `--key`（焦点 + `Attack`）或"点了不换页"的按钮，正好绕开了它。
  修完实测：`--click '397,225@10' --key 'j@450' --click '397,315@600'`（**鼠标**点「测试模式」）
  进得去，进去之后再晃鼠标、再点、再 `--key d` 都正常：
  ```text
  [godot frame 600] pages=0:test_cases_page
  [godot] hover-win @frame 700 at=(595.0,150.0) pages=0:test_cases_page
  [ui] ui/test_case_name … text=20/Case: 1-0 Julian D^J      ← 菜单点进来之后按两次 d 也照切
  ```

### 2026-10-17：用户玩的时候报的（第二批，都已修）

* **"背景音乐有，但没 frame.sound"** —— `World::play_sound` 从第一刀起就是**空转**的宿主缝
  （`(void)sounds; (void)pos;`），所以帧音效 / 受击音效 / 落地音效一个都没响过。补的正是 TS 那一支：
  * `Entity::play_sound(sounds, pos)` 照 `Entity.ts:2311` 的 `play_sound` 做 **Message 帧的 x 夹取**
    （`centerx` / `width` / `facing`、`world.camera.position.x`、`world.dataset.screen_w / (bg.zoom_x ?? 1)`）；
    非 Message 帧把 `pos` **原样**转发（不重建 `Value` —— 台面靠 `world().play_sound(sounds, pos)`
    记 `play_sound:<sounds>@<pos>`，重建会让日志形状变）。
  * `World::play_sound` 的默认实现：数组逐条、单条一条，`!sounds?.length`（空串 / null / 数字）
    什么都不做 ⇒ `lfw().sounds_play(path, x, y, z)`（宿主那个 `h:sound=` 缝 / Godot 的音频槽）。
  * `entity.cpp` 里四处**绕过实体方法**直接调 `world().play_sound(...)` 的地方（`dead_sounds`、
    `frame.sound`、`flags.sound`、`drop_sounds`）改成走 `play_sound(...)` —— TS 就是 `this.play_sound(...)`
    （顺带把 Message 帧的夹取也带上了）。
  * 实测（`--ui-page test_cases_page` + 16 次 `s` 到 16-0 Red Book: GroupAttack，700 帧）：
    `[godot] sounds: … play=39 … last=data/012.wav.mp3`（帧音效 012/038 在响），差分 261/261，
    三条宿主摘要**逐位不变**（音频不进模拟）。
* **"Buff 会导致游戏崩溃"** —— 真凶是**没人给 buff 装 env**：`buff/registry.cpp` 的
  `BuffCreator<B>::create` 造的是 `new B(nullptr, id, kind)`（`Factory::create_buff` 手里只有 `LFW*`、
  拿不到 `BuffEnv`），`grant_buff` 拿到之后也没补 ⇒ `mount()` 的第一句
  `_env->world_buffs_set(...)` 就是空指针解引用。实测复现：`--ui-page test_cases_page` 十六次 `s`
  到 16-0（Red Book: GroupAttack）后跑到第 700 帧 `signal 11`（`EXITCODE=-1073741819`）。
  修法两处（都很小）：`grant_buff` 在"发牌"那一刻 `buf->set_env(env)`（新造的、从 `world.buffs`
  复用的都一样）；`WorldCollisionHost::create_buff` 让新 buff **出生即带** `&_buff_env`。
  ⚠ 差分台面为什么一直没抓到：`buff` 台面自己造 `TestBuff(&g_env, …)`、并且把
  `env->create_buff` 换成了台面自己的 lambda ⇒ **真工厂这条路一次都没被走到**（又一个"台面绿 ≠
  装配对"）。修完实测：同一条命令 700 帧 `EXITCODE=0`、`entities=9 hp=4411`。
* **"没支持 frame.pic 的旋转"** —— `pic.rad`（`loader/preprocess_pic.cpp` 早就算出 `rad/deg/__cos_r/__sin_r`）
  之前只算不用。现在 `emit_sprite` 照 TS `EntityMainRender.update_mesh_position`：
  * pivot = 矩形左上角 + `(ox, oy)`（缺省各 `w/2`、`h/2`），把**矩形中心**绕 pivot 转一次，
    角度交给宿主的 `GodotDrawItem::rot` 再绕矩形中心转一次（两次叠加 = 绕 pivot 转一次）；
  * **符号**：TS 的 mesh 位置算在 y 向上的局部系里、端口的绘制项是 y 向下的屏幕系（差一个镜像）
    ⇒ 屏幕角度取反；面朝左时 TS 的 `rotation.z` 与 `_sin` 一起翻 ⇒ 再反一次
    （`theta = facing < 0 ? rad : -rad`）；
  * 宿主 `draw_item` 用 `Transform2D`（平移到中心 → 旋转 → **局部**镜像）画，
    `flip_x` 在局部系里做恰是 TS 的 UV 镜像；描边的四邻偏移也放进这个局部系 ⇒ 轮廓跟着图转。
  * 实测（16-1 Green Book: Electrify，绿光环）：`render: … rot=1@-5.8905`
    （数据里那一帧 `rad: 5.890486` ✓），存图 `shots/rot-aura-497.png`（+ `-zoom` 放大）。
* **"没显示 frame.model"** —— 3D 模型帧整支接上了（新文件 `host/godot/lfw_godot_models.{h,cpp}`）：
  * 加载：`GLTFDocument::append_from_buffer` 读字节（数据包 → 根目录，与纹理同一条 `read_resource`），
    `generate_scene` 后 `PackedScene::pack` 缓存；同一路径的多个实体各自 `instantiate()`（Godot 的
    实例化会给蒙皮重绑骨架，等价于 TS 的 `SkeletonUtils.clone`）。
  * 画布：**每个实体一份** `SubViewport`（512×512、透明底、`UPDATE_ALWAYS`）+ 正交 `Camera3D`
    （竖直 512 世界单位）+ `WorldEnvironment`（环境光 0.7）+ `DirectionalLight3D`（1.4，位置
    -300,400,600 指向原点）—— 三个数字都是照 TS `WorldRenderer` 抄的。画布中心 = 模型局部原点
    ⇒ **1 世界单位 = 1 逻辑像素**，缩放由宿主 blit 时乘 `frame.scale_x/scale_y`。
  * 摆位：`base.models[id]` 的 `path/scale/offset/rotation` 与帧 `model` 的
    `id/anim/loop/reverse/hold_last/scale/offset/rotation`（`rad` 兜底 `rotation.z`）——
    旋转按 TS 的**四元数乘积**（base × frame）再拆回 XYZ 欧拉角（three.js 的次序，和 Godot 默认的
    YXZ 不同，所以自己算），面朝左时 y/z 取反。
  * 动画：交给 `AnimationPlayer`（glb 的片段名就是 `model.anim`），`loop` 改片段循环模式、
    `reverse` 用负速度。⚠ 与 TS 的差别：TS 按**实体 lifetime 差**推进（逐帧确定），这里按真 delta —
    画面不需要确定性（三条摘要只覆盖模拟）。
  * 实测：16-0 局里 `render: … model=1[weapons/book_bundle/book_red.glb|]`、
    `[godot] models: loaded=1 failed=0 live=1 weapons/book_bundle/book_red.glb(anims=0,…)`
    ⇒ 红书在手里显示正常（存图 `shots/model-book-295.png` + `-zoom`/`-close` 放大）；
    `--fighter robot` 那一局 `characters/robot/robot.glb(anims=14)` 也加载得到（14 个片段：
    Idle/Punch/Running/…）。
  * **没做**（数据里也没有）：`model.pose` 的骨骼姿态混合（`grep '"pose"'` = 0）、
    `model.seek/time_scale`（数据里为 0 条）。模型轮廓**做了**（见下面那条）。
* **（补）3D 模型的近裁剪面把模型"锯"掉一半** —— 第一次接上模型时相机是
  `set_orthogonal(512, 512, 4096)`（near 也写成了 512），相机又在 z=+512 ⇒ 整个 `z > 0` 的那一半
  被**近裁剪面**切了。robot 这种带厚度的模型一眼就看出来（用户原话："像是 Z 深的部分被截了"，
  截图里只剩一小团黄色碎片）。修法：`near = 0.05`、`far = 8×画布`，相机继续放在 z=+512
  ⇒ 可见 z 区间够 ±512。顺手把每个模型的 `SubViewport` 设成 `use_own_world_3d`（宿主那个场景是
  2D 的，隔离掉省得跟别的 3D 东西互相打扰）。
  修完实测（`--fighter robot --fighter 1 --stage 1 --ui-page center_pause_label --key 'j@100'`）：
  `model=1[characters/robot/robot.glb|Running]`，机器人整个身子（黄壳 + 白头盔 + 两只圆眼睛 +
  跑动姿势）都在，`shots/model-robot-104e.png`。
* **（补）模型轮廓** —— TS `update_model_outline` 是"反向外壳"（`BackSide` + `uOutline =
  (outline_width+1)/k`，`k` 取 hull 父节点的**世界**缩放）。Godot 侧的等价做法：每个表面复制一份
  材质、挂一个 `next_pass`（`StandardMaterial3D`：`unshaded` + `cull_front` + `grow`），`grow` 按
  那个 `MeshInstance3D` 的**全局**缩放折回网格局部单位（÷100 那一层骨架缩放就在这儿：
  一开始按节点缩放算，外扩量大了 100 倍 ⇒ 屏幕上炸出一片蓝色碎片）。
  ⚠ 材质是 `PackedScene` 里的共享资源 ⇒ 先 `duplicate()` 再改，否则给一个实体开轮廓等于全开。
* 诊断面顺带加了三样（`[godot] render:` 那一行，不进摘要）：`rot=<条数>@<角度>`、
  `model=<条数>[<path>|<anim>]`、以及加载报告 `[godot] models: loaded/failed/live + 每个 glb 的
  (anims=N,box=…)`。
* **（补）"血条应该是多层的"** —— 不是代码问题，是**本地数据包过期**：`dist/prel.zip` 是
  **2026-09-30** 的，而 `lf2s/origin/prel_data/ui/fighter_stat_l|r|s.ui.json5` 在 **2026-10-07**
  的提交「血条！」里才改成 **5 段**（`hp_t0..hp_t4` = `#f53535`/`#ffaa25`/`#27ee27`/`#4682B4`/`#a7beff`，
  `dark_hp_t0..t4` 同理）⇒ 端口解压出来的 `native/build/host-data/prel` 里 `hp` 只有一块
  `#EE3F3A`，按 TS 的规则（`FighterStatBar.update_tiers` 要求 `children.length >= 2`，每 500 血一段）
  自然一动不动、也不分层。
  修法（不是改代码）：`npm run build:prel`（产物在 `public/prel.zip`，vite build 再拷进 `dist/`）
  → 覆盖 `dist/prel.zip` → 重新解压 `native/build/host-data/prel`。实测：
  * 新布局里 `hp_t0..t4` / `dark_hp_t0..t4` 都在 ⇒ 2500 血的 Stage Mode 是**五段彩色**、掉血从
    第 5 段开始缩；
  * 三条宿主摘要**逐位不变**（prel 只影响 UI/启动资源，不进模拟）；
  * 差分 261/261 照过。
  ⚠ **踩坑记录**：`native/build/host-data/{prel,data}` 是**构建产物**（git 忽略），只在自己解压时
  更新 —— 数据源在 `lf2s/` 里改了，端口会**悄悄继续跑旧数据**，表现就是"Web 版有、Godot 没有"。
  改了 `lf2s/origin/**` 之后记得 `npm run build:prel`/`build:data` + 重解压。
* lint 基线更新：**923 clean / 0 failed / 94 warnings**（多的 84 条来自 `tests.cpp` 里那张
  裸指针用例表 —— `Tests` 的 `_owned/_retired` 为了"不完整类型"故意用裸指针，见类头注释）。

## 验收：宿主三条摘要（改完必跑）

同一份数据、同一命令**逐位可复现**；三条都过才算没打破 headless 行为：

```
native\build\msvc-x64\bin\lfw_run.exe --root dist ^
  --zip native\build\host-data\prel --frames 300 --every 300
  ⇒ digest=a7edd32e19a43ea9（warns=0）

… --zip native\build\host-data\prel --zip native\build\host-data\data ^
  --fighter 1 --fighter 4 --stage 1 --frames 900 --every 900
  ⇒ digest=13945ad1144c968d（warns=1）

… --zip native\build\host-data\prel --zip native\build\host-data\data ^
  --stage 0 --fighter 1 --fighter 4 --vs --frames 600 --every 600
  ⇒ digest=61c42c78c9d0bcac（warns=1）
```

Godot 宿主跑**同三条**（`--delta 0.017` 只是节拍、不进模拟；绝对路径见上一节 ⚠①）：

```
$R = (Get-Location).Path; $P = "native\host\godot\project"
& $godot --headless --path $P -- --root "$R\dist" `
    --zip "$R\native\build\host-data\prel" --frames 300 --every 300 --delta 0.017
& $godot --headless --path $P -- --root "$R\dist" `
    --zip "$R\native\build\host-data\prel" --zip "$R\native\build\host-data\data" `
    --fighter 1 --fighter 4 --stage 1 --frames 900 --every 900 --delta 0.017
& $godot --headless --path $P -- --root "$R\dist" `
    --zip "$R\native\build\host-data\prel" --zip "$R\native\build\host-data\data" `
    --stage 0 --fighter 1 --fighter 4 --vs --frames 600 --every 600 --delta 0.017
# [godot] done: frames=300 ups=60 digest=a7edd32e19a43ea9 warns=0 errors=0 ignored_images=311 renderer(+-)=6/4 clock=5000.0ms
# [godot] UI render calls: 300 (unhandled: 0)
# [godot] done: frames=900 ups=60 digest=13945ad1144c968d warns=1 errors=0 ignored_images=313 renderer(+-)=52/47 clock=15000.0ms
# [godot] UI render calls: 900 (unhandled: 0)
# [godot] done: frames=600 ups=60 digest=61c42c78c9d0bcac warns=1 errors=0 ignored_images=313 renderer(+-)=21/18 clock=10000.0ms
# [godot] UI render calls: 600 (unhandled: 0)
```

`warns=1` 是既有的 `DatMgr::_add_obj id duplicated…`（不是新告警）。⚠ `UI render calls: N (unhandled: M)`
两份宿主一个口径：谁**补**了 `render_once` 谁就有 N（`lfw_run` 是 0；Godot 与 `lfw_thin` 是帧数）。
**Godot 宿主现在是 `unhandled: 0`**（`create_ui_node_renderer` 覆写、UI 真画，§G2「UI 那一遍」）；
另外两份宿主仍回 `nullptr` ⇒ 那一份的 `unhandled == calls`（"没人画"是**有数**的）。`render:` 那一行是
世界那一遍的观测面（绘制项 / 背景层 / 实体 / 纹理成败），**不进三条摘要**；UI 那一遍对应的是
`[godot] ui:` 那一行（层数 / 节点 / 出项 / 文字 / 隐藏 / 空 / 裁掉 / 取不到图 —— 同样不进摘要）。
差分/变异/覆盖的跑法与判据见
`tests/differential/PROTOCOL.md`；**装载偶发乱码/NaN 那一类不确定失败已修**（根因与护栏见 DESIGN
「雷区」一节）⇒ 现在偶发失败**就是**回归，别再"重跑一次凑数"。

### 截图（看一眼画面）

`--screenshot <file.png> --shot-frame N`：推够 N 帧后把视口存成 PNG（`--shot-frame` 缺省 120）。
⚠ **不加 `--headless`** —— headless 没有渲染，存出来是空白（`Viewport::get_texture()->get_image()`
拿到空图）。⚠ 路径写**绝对路径**（cwd = 工程目录，见上面 ⚠①）。
⚠ stretch 关掉之后（见「窗口外观」）**视口 = 整个窗口** ⇒ 存出来的 PNG 就是**整窗**：
黑边 + 自绘顶栏 + 画面都在里面，尺寸 = 窗口像素（`794×450` 的窗口就是 1:1 的逻辑像素；
`1191×675` 的缺省窗口是 1.5× 的放大图；`1400×500` 那种非等比窗口是 `1400x500` + 左右各 259 黑边）。
（切片之前抓的是"内容区"：非等比窗口下顶栏与黑边都不在图里 —— 用户看不出条被切掉了。）

```
$R = (Get-Location).Path; $P = "native\host\godot\project"
& $godot --path $P -- --root "$R\dist" `
    --zip "$R\native\build\host-data\prel" --zip "$R\native\build\host-data\data" `
    --fighter 1 --fighter 4 --stage 1 --frames 900 --delta 0.017 `
    --screenshot "$R\native\build\shot-stage1.png" --shot-frame 300
# [godot] screenshot: D:/projects/lfj/native/build/shot-stage1.png 794x450 err=0 frame=300 life=300
# [godot] render: bg=bg_2 cam=41.5,0.0 scale=1.00,1.00 df=1.000 items=57 bg_layers=45 ents=6 hidden=0
#   no_pic=0 no_file=0 unnamed_tex=0 outline=6[#FF0000@0.80,1.0] textures=18 ok/0 fail
```

`textures=N ok/0 fail` = 宿主侧纹理缓存：字节经 `FsZipObject::read` 从数据包读出来（`@Nx` 回退由
`get_import_fallbacks` 给），解码用引擎自己的 `Image::load_png_from_buffer` —— **核心一个字节都不碰**

UI 那一遍另有两个诊断开关（都不进摘要）：`--ui-page <id>`（装载后把这一页设到第 0 层，等价于"点进这一页"；
id 取自烹饪好的 UI 表，缺省用数据自己的首页 `init`）与 `--ui-dump`（最后一帧**逐 UI 节点**打一行：
`pass` / 屏幕盒子 / 可见 / 累计 z / alpha / 图片与裁剪 / 平铺 / 文字长度）。看 UI 画面时先跑
`--ui-dump`，一眼就知道哪个节点没出项、哪张图没解析到。
（契约 D2 的分账）。

## 移植进度

| 步骤 | 范围 | 状态 |
|---|---|---|
| 0 | `core/` + 差分测试台 | ✅ 通过（MT19937 逐位一致，7564 行） |
| 0.5 | 差分台子泛化为可插拔 subject | ✅ 通过 |
| 1 | `utils/math/` | ✅ 通过（`math/scalar` 90 行、`math/plane` 52 行） |
| 1.5a | `utils/{easing,cross_bounding,utf8,times}` + `defines/i_bounding.h` | ✅ 通过（52 / 8 / 41 / 74 行） |
| 1.5b | `base/graves.h` + `utils/array/` + `utils/container_help/` | ✅ 通过（`collections/basic` 81 行、`collections/nested` 55 行） |
| 1.6 | `base/Expression`（V7）+ `Object`（V6）+ `JSON`/`JSON5` | ✅ 通过（`expression` 303+216、`value/object` 109、`json` 62+157、`json5` 302+111+6454 行） |
| 1.7 | `fields.ts`（字段描述 DSL + `fields()` + `reorder_fields` + `validate_fields`） | ✅ 通过（`fields` 77+155 行） |
| 2a | `defines/` 的**枚举**（52 个：47 生成 + 5 手写；覆盖已验） | ✅ 通过（`defines/all` 851 行） |
| 2b | `defines/` 的**字段表**（34 张，生成） | ✅ 通过（`defines_fields/all` 34 行） |
| 2c | `defines/` 的**运行时数据**（`Defines` 命名空间 67 条 + 7 个顶层对象 + 5 个函数） | ✅ 通过（`defines_runtime/all` 149 行）。`I*.ts` 结构体与 33 个 `*_new()` 只服务 `dat_translator`，运行时不用，暂缓 |
| 2d | `base/{FSM,Callbacks,NoEmitCallbacks}` | ✅ 通过（`base/core` 3127 行） |
| 3a | `dat_translator/CondMaker`（条件字符串构造器，所有默认条件的共同前置） | ✅ 通过（`cond_maker/all` 55 行） |
| 3b | `defines/` 名称/标签函数（`labels`，`set_hit_flag`/`set_bdy_kind` 的前置） | ✅ 通过（`labels/all` 107 行） |
| 3c | `dat_translator` 小助手（`take*` / `set_*` / `fixed_float` / `find_float` / `copy_*`） | ✅ 通过（`dat_helpers/all` 100 行） |
| 3d | `dat_translator` 帧跳转（`get_next_frame_by_raw_id` / `cook_next_frame_cost` / `add_next_frame`） | ✅ 通过（`next_frame/all` 83 行） |
| 3e | `dat_translator/ColonValueReader`（手写匹配，替代被禁的 `RegExp`） | ✅ 通过（`colon_reader/all` 52 行） |
| 3f | `dat_translator` 的 `cook_*` / `float_scaling_itr` | ✅ 通过（`cookers/all` 68 行） |
| 3g | `dat_translator/make_frame_state`（+ `foreach` / `ensure` 的 `Value` 重载） | ✅ 通过（`cookers/mfstate` 20 行） |
| 3h | `dat_translator/frame_behavior/*`（14 个模块）+ `make_frame_behavior` 分发器 | ✅ 通过（`cookers/fbehavior` 52 行一次全对） |
| 3i | `dat_translator` 字符串匹配器（`match_colon_value` / `match_block_once` / `take_blocks` / `delete_undefined`） | ✅ 通过（`string_matchers/all` 35 行） |
| 3j | `dat_translator` 的 `make_frames_special` / `make_entity_data`（+ `traversal`） | ✅ 通过（`entity_data/all` 22 行） |
| 3k | `dat_translator/make_itr_prefabs`（+ 手写 `entry:` 匹配器 / `to_num` / `is_non_empty_str`） | ✅ 通过（`itr_prefabs/all` 14 行） |
| 3l | `dat_translator` 的 `make_ball_data` / `make_weapon_data` | ✅ 通过（`entity_kinds/all` 17 行） |
| 3m | `dat_translator/make_bg_data`（+ `make_bg_layer` / `bg_color_translate`） | ✅ 通过（`bg_data/all` 11 行） |
| 3n | `dat_translator/post_process_obj_data`（装配层入口） | ✅ 通过（`entity_data/all` 29 行） |
| 3o | `dat_translator/EditBdy` + `cook_ball_bdy_get_hit_to_frame_20/30` | ✅ 通过（`ball_bdy/all` 11 行） |
| 3aa | `loader/get_val_from_entity`（39 条 getter 表）+ 惰性的 `get_val_from_lf2` / `get_val_from_world` | ✅ 通过（`entity/get_val` 319 行） |
| 3ab | `loader/get_val_from_collision`（86 条 getter 表；`attacker` / `victim` 是活实体 ⇒ 宿主缝） | ✅ 通过（`entity/collision_val` 672 行） |
| 3ac | `loader/preprocess_bdy` + `loader/preprocess_itr`（+ `preprocess_action` 的 `action.tester` 落地；14 个 `itr.kind` 分支的默认条件） | ✅ 通过（`loader_frames/all` 222 行） |
| 3ad | `loader/preprocess_frame` + `utils/read_nums`（帧装配：prefab 合并 / weapon 与 fighter 的状态默认值 / `cook_frame_indicator_info` / `fold_aabb` / `__hit_ground_*` / `center` / `pics`） | ✅ 通过（`loader_frames/all` 544 行；另有 `indicator_info` 那一路的失败通道） |
| 3ae | `loader/preprocess_entity_data`（实体数据的总装入口：四路 special / `itr_prefabs`·`bdy_prefabs` 逐条 / `base` 的图·音效 / `pre_*`·`post_hitkeys` 的 `__*_map` / `on_dead`·`on_exhaustion` / `portraits`·`frames` / `__pics` / `base.bot`） | ✅ 通过（`loader_entity` 新 subject，387 行） |
| 3 | `loader/get_val_*` 余下部分（`get_val_from_bot_ctrl` / `get_val_getter_from_stage`） | ✅ 通过（`entity/ball_ctrl`、`stage` 等 subject 均已搬） |
| 4r | `controller/BallController` + `helper/closer_one` | ✅ 通过（`entity/ball_ctrl` 174 行） |
| 4 | `entity` + `collision` + `buff` + `state` + `controller` + `bot` + `World` | ✅ 通过（整块搬完） |
| 4宿主 | 步骤 4 **宿主接入（M1：headless 可运行）**：`host/` 的 `FsZip`（目录当 zip）+ `HeadlessHost`（`ILfwHost` 最小实现：读盘 import / `ToolXML` / 手动时钟 / 空渲染）+ `lfw_run`（装包 → 起世界 → 手动推帧 → 摘要） | ✅ 通过（`prel` 包：2 个 gim 起 `tutorial` 舞台，300 帧逐位可复现；lint 9776/0）。`Entity.ts` 底部那四句模块级 `Factory.register_entity` 与 `IWorldLfw::acquire_entity` 缝 |
| 4XML | 步骤 4 **`ToolXML::parse`（XML 文本 → `IXMLElement`）**：fast-xml-parser 那套选项的形状口径（直接文本保留空白并按序拼、属性走 `String(value)`、无值属性 `"true"`、`ns:` 前缀去掉、CDATA 原样、只解五个命名实体），注释先剥、声明/PI/DOCTYPE 跳过 | ✅ 通过（完整 `data.zip` 现在能装：`fighters=26 weapons=19 balls=24 entities=5 stages=28 bg=16`；`--fighter 1 --fighter 4 --stage 1` 900 帧逐位可复现；lint 9776/0）。细节见 DESIGN §141 |
| 4主干 | 步骤 4 **主干**（宿主层：`stage/` 与 `World` / `LFW` / `Factory` / `Resources` / `Camera` / `Keys` **之前**能单独搬的部分，按依赖序：`I18N` → `loader/get_import_fallbacks` → `PlayerInfo` → `Camera` → `ZipMgr` → `Resources` → `Factory` → `stage/*` → `World` → `LFW`） | 进行中（`I18N` + `loader/get_import_fallbacks` ✅ 262 行；`PlayerInfo` ✅ 270 行；`ZipMgr` ✅ 114 行；`Camera` ✅ 369 行；`Resources` ✅ 136 行；`Factory` ✅ 92 行；`stage/Expressions` + `stage/Status` + `bg/{Background,Layer}` ✅ 70 + 83 行；`stage/Item` ✅ 622 行；`stage/Stage` ✅ 1045 行；`World`（状态与查询那半）✅ 638 行；`World::step` + `update_once` + `catch_up` + `start_update` + `Entity::release`（**非碰撞配对**那半；配对与 `collision_get` / `collisions_keeper.handle` 留给 4L）✅ 用例 315 行） |
| UI-T | **测试模式整棵**（`ui/component/Tests/**`，54 个 TS 文件 / 2610 行 → `native/lfw/ui/component/tests/**`：`TestCase` 基类 + `Tests` 页面 + 105 个用例类） | ✅ 落地（不在差分台面上——它是「按数据摆实体 + 定时按键」的宿主侧演示；验收靠 Godot 宿主 + Web 初始态对拍，见「2026-10-16」那条） |

**步骤 2–4 是修正过的。** 把 `import type` 排除后算运行时依赖图，得到两个关键事实：

1. `utils/` 到根目录只有两条边：`cross_bounding.ts → ../defines`（仅类型，无害）和
   `MersenneTwister.ts → ../../cases_instances`（`mt_cases` **调试探针**；已把 `Cases` +
   `mt_cases` + `mark`/`debugging`/`case`/`pure`/`load` 一起搬进 `native/lfw/cases.{h,cpp}` 与
   `utils/math/mersenne_twister.{h,cpp}`，见 DESIGN §57）；
   到 `base/` 只有一条边：`container_help/nested_map.ts → base/Graves`。
   ⇒ **补上 `Graves` 之后，`utils/` 就是一个完整、自洽的叶子。**
2. `defines/` 到根目录的 36 条边里 35 条都是 `→ ../fields`。
3. **`entity` / `collision` / `buff` / `state` / `controller` / `bot` / `(root)` 互相依赖，
   是一个约 1.3 万行的强连通块 —— 无法逐个搬，必须整块搬。**
   （之前把 `collision/` 当成步骤 2 是错的：它依赖 `buff` / `entity` / `World` / `LFW`。）

`utils/{schema,string_parser}` 属于数据装载路径，跟步骤 2/3 一起搬。

### 已知偏差（C++ 侧**没有**照搬的地方）

| 位置 | 偏差 | 原因 |
|---|---|---|
| `container_help/find.h` | 只实现了“按值找”。TS 版在可迭代对象未命中后还会退到 `for...in`，把 `[key, value]` 元组喂给谓词 | 对数值数组 + 数值谓词而言两条路径等价（元组参与数值比较恒为 false），但这个差异要记住 |
| `container_help/get_keys` + `foreach` 的对象分支 | 未移植 | `get_keys` 在 `src/LFW` 里没有调用点（只有 `index.ts` 的 re-export）⇒ **按需不搬**；`foreach` 的对象分支（`typeof any === 'object'` ⇒ 转 `traversal`）在端口里由调用点直接改用 `traversal`（见 `dat_translator/*`）⇒ 本函数只留数组分支 |
| `container_help/list_fn.h` | 不移植 | 整个 `src/LFW` 里唯一的真·反射，只有 `NoEmitCallbacks.add()` 一个调用点 ⇒ 改成显式注册表 |
| `math/mersenne_twister` | `pure()` 的 `mt` 是 `uint32_t`，TS 里 `twist()` 之后是 signed int32 的**同一批位模式** | 位模式全等；差分里直接打印 `mt[i]` 的地方先 `>>> 0`（`state` 哈希一直如此） |
| `math/mersenne_twister` | 不保留 `range(min, max, debugging)` 的**第三参** | TS 里是死参数（函数体只看 `this.debugging`） |
| `ensure.h` | 接受了 `std::vector` 而不是变参 | 语义等价；**但两边都不能传空 items**（TS 的 `item` 是必填项） |
| `BallController.chasing` | 存的是**引用快照**（建引用那一刻的字段），TS 的 `this.chasing` 是活实体 | 控制器层拿不到 `Entity`（走 `Value` 引用）。`update_lookup` 开头用 `reidentify` 按 `id` 从名单认领新引用，让「目标还在世界里」这条路径与 TS 逐字段一致；目标已离开名单时端口读旧快照（残差，见 DESIGN §5 第 1 条） |
| `BallController.update_lookup` 的 `self` | 由 `CtrlEnv` 的位置快照现搭（`self_ref`），不是 `entities[me]` | TS 读 `this.entity.position`；端口按分层约定不 include `entity.h`。`me` 只是调用方给的下标，两者只在「`me` 恰好指向自己」时等价 |
| `BallController.chasing` 的归属 | 放在 `BaseController` 上（TS 是 `BallController` 的字段） | `spawn` 的 `OpointMultiEnum` 分支只有 `BaseController*`（`is_ball_ctrl()` 门之后才写）；语义不变 |
| `NestedMap` | 用 `std::map`（按键序），不是 JS `Map` 的插入序 | 它的公开 API 不暴露迭代 ⇒ **序不可观测**。若将来给它加迭代方法，必须先补插入序 |
| `NestedMap::ref()` | C++ 独有的新增方法（返回内层值的引用） | 让 `NestedMultiMap::add` 能 O(1)；不影响已有行为 |
| `NestedMultiMap` | 内部统一存 `std::vector<V>`（TS 是 `V \| V[]` 两态） | 公开 API（`add`/`first`/`has`/`collect`/`remove`/`clear`）上两者行为一致 |
| `Graves` / `NestedMap` | TS 的 `delete` → C++ 的 `remove` | `delete` 是 C++ 保留字 |
| `fields.cpp` 的 `to_array` | TS 里叫 `as_array` | 避开与 `core/value.h` 的 `as_array`（返回 `const Array*`）重名 |
| `fields.cpp` 用 `Object` 顶替 TS 的 `Map` | 字段描述表在 C++ 侧是 `Object` | 两边等价（Map 插入序 = 对象的 `Object.keys` 序，已由差分验证）；C++ 的 `Value` 没有 Map 种类 |
| `fields.cpp` 对三类“TS 会抛异常”的输入 | 直接返回 / 当空字段表 | 无异常可用；且（`field_map` 为 `null`、`object` 字段缺 `fields`、`field` 为 `undefined`）在 `defines/` 数据里不可达 |
| `lfw/defines/*.h`（43 个） | **由 `native/tools/gen_defines_enums.mjs` 生成，不要手改** | 枚举是纯数据。改完 TS 重跑生成器；差分 `defines` 会验 |
| `FacingFlag` / `HitFlag` / `EntityEnum` / `CMD` / `BinOp` | **手写**，不在生成范围内 | 前 4 个的成员引用了同文件常量 / 同枚举成员 / 别的枚举（生成器不求值）；`BinOp` 是早期手写的 `bin_op.h` |
| 生成的 `bdy_kind_name_of` 等 | 命名 `xxx_name_of`（TS 里叫 `bdy_kind_name`） | 避开将来手写同名函数 |
| `lfw/defines/fields_gen.h` | **由 `native/tools/gen_defines_fields.mjs` 生成，不要手改** | 它跑真实的 TS 字段表、内嵌成 JSON5，运行时用 `json5_parse` 还原 |
| `lfw/defines/schemas_gen.h` | **由 `native/tools/gen_defines_schemas.mjs` 生成，不要手改** | 11 份 `Schema_*`（纯数据：无函数/无类实例）dump 成 JSON5；扫描根 = `src/LFW/defines` 全量 + `src/LFW/ui` 里导出 `Schema_*` 的模块（4AH 起） |
| `SchemaValidator` 的类类型分支 | TS 的 `typeof type === 'function'`（自定义类）、“值必须是字符串”、`Object.defineProperty` 惰性属性、`instance_getter/setter` 钩子不建形 | `Value` 装不下函数；已移植 10 份 schema 无此形态（DESIGN §88） |
| `preprocess_bg_data` 的 `Ditto.warn/error` | 端口加 `warnings` / `errors` **sink 参数**（宿主缝） | TS 是宿主包全局；台面两侧分别用 sink / 替换桩捕获成 `bgw`/`bge`（DESIGN §88） |
| `JSON.stringify` 会把 `-0` 写成 `0` | 生成字段表时用 | 当前 34 张表里没有 `-0`；若有，差分会在位模式上暴露 |
| `Entity::_team` 是 `std::u16string` | TS 的 `team` 保持原值（可能是数字）⇒ 数字队伍在端口里被字符串化（TS 存 `3`，端口存 `"3"`） | 队伍在真实数据里一直是字符串（`lfw.new_team` / 帧数据），端口内部也全程按字符串比较；只有「碰撞攻击者带数字队伍」这种人造输入会撞上，用例只喂字符串（9l） |
| `State_Frozen::leave` 里 `StateBase_Proxy::leave` 被调了两次 | TS 只调一次 `super.leave(e, next_frame)`，端口在 `e.apply_opoints(ice_piece_opoints())` 之后又多调了一次 | 9m 复核 `apply_opoints` 调用点时发现；`apply_opoints` 的相对顺序与 TS 一致，所以不影响 9m，但这多出来的一次是**真的多**（`get_proxy(e).leave`）⇒ 归状态层复核/修（现有 `entity_states` / `character_state_*` 用例观察不到） |
| `base/ValExpression` 的宿主面 | TS 的取数器是 `(e: Entity) => number`（`DEFAULT_VARS` 直接读 `e.frame.width` 等、`rand`/`pick`/`bag`/`flip` 读 `e.lfw.mt`）；端口把它收成 **Ctx 概念**：`frame_var(name)` + `mt()` | 端口没有能被 `base/` 依赖的 `Entity`（循环包含）⇒ 照 `Expression<Ctx>` 的既有约定模板化。取数器给 `double`：帧**缺字段**时 TS 拿到 `undefined`，那一支（`range(undefined, undefined)` 提前返回、`pick` 的 `v !== undefined` 过滤）端口不复现，用例只喂有值的帧（见 PROTOCOL §6.105） |
| `preprocess_opoint` 不写回 `__gen_*` | TS 把编译出来的 `ValExpression` **挂到记录上**；端口把九组编译结果**交还调用方**（`std::map<__gen_* 名, ValExpression>`），编译失败的字段不在表里 | `Value` 只有 7 种类型装不下函数（DESIGN §9.42 的既有结论）。差分时两侧都按「把 `__gen_*` 删掉」对齐（TS 侧由 harness 删），`?? opoint.__gen_x` 的「失败保持原值」语义照旧成立 |
| `host/`（宿主实现） | 渲染 / 音频 / 指针 / UI 图片是**空实现**（图片给零尺寸占位并计数） | 都是平台侧的东西；M1 只要「能起世界、能推帧」，它们不参与世界推进（DESIGN §140）。这条只针对 `HeadlessHost` / `lfw_thin`：**Godot 宿主**已经把渲染、文字度量、UI 图片、**音频**都接成真实现（音频见「2026-10-16」那条） |
| `host/HeadlessHost::md5` | **真 MD5**（RFC 1321，`host/common/zip_file.cpp`），与 `Ditto.MD5`（SparkMD5）逐位一致（字符串按 UTF-8 喂） | 与 TS 的差异只剩「上游是 JS 库、这边是自写实现」这一点，值域相同 |
| `host/FsZip` | 只吃「已解包」的目录（`--zip <dir>`）；**压缩包本体**在 `host/common/zip_file.{h,cpp}`（真 `.zip`：中央目录 + stored/deflate，ZIP64 拒绝） | 两条路并存：`--zip` 给目录、按 URL 加载的包（菜单 `load_data()`）给真 `.zip` |
| `host/` 的 `zip_*` | 下载 / 读 blob / zip 缓存在**内存里**实现：`zip_download` 按 URL 找本地文件 + 真 MD5 校验（不匹配 ⇒ `md5 mismatch`），`zip_get_stored` 是 `get_stored_download` 的内存版（键 = `md5("lfw-partial:" + url)`），模块 `/` 缓存在 `_zip_cache` | 宿主没有 OPFS/IndexedDB/网络（DESIGN §5）；「blob」用宿主内的**令牌**表示（TS 是 `Blob`），只在本宿主内流通 |
| `Entity.ts` 底部的模块级 `Factory.register_entity` | 端口用 `entity.cpp` 里一次**静态初始化**顶「模块副作用」 | C++ 没有模块初始化；时间点必须早于任何用户代码，差分台面靠「后注册覆盖」与 TS 对齐 |
| `ToolXML::parse` 的实体解码 | 只解 `&amp; &lt; &gt; &quot; &apos;`；十进制/十六进制引用（`&#65;` / `&#x42;`）**照抄** | 实测 fast-xml-parser 在这套选项下就不解数字引用（DESIGN §141.2 的探针表） |
| `ToolXML::parse` 的命名空间 | 只去 `ns:` 前缀，没有额外的 `xmlns` 处理 | 真实数据里 12 个 `.xml` 都不用命名空间（DESIGN §141.2） |
| `ToolXML::parse` 的宽容度 | 闭合标签与栈顶不同名时「忽略这次闭合」；`<!DOCTYPE …>` 跳到下一个 `>` | fast-xml-parser 本身很宽容；真实数据格式良好，这条只影响畸形输入（DESIGN §141.2） |
| `base/Ticker` / `base/FPS` 的三处省略 | ① `Ticker.TAG`（`static readonly`）不移植；② `ITimeout.add` 的 `...args` 不移植；③ `Ticker._tick` 的 `try { this._step_once() } finally { this._schedule() }` 写成顺序两句 | ① 全仓库没有读取点（同其它槽的约定）；② TS 源码里自己注明「无用的预留参数」；③ lint 禁 `try`/`catch`，且端口的 `on_step` 不抛 ⇒ 「抛异常也重排」这条路径不可表示（见 DESIGN §5） |
| `Number.prototype.toFixed` 只移植了 **f = 1** | 端口叫 `number_to_fixed_1`（`core/js_string.h`） | 唯一的调用点是 `get_short_file_size_txt`；一般化要 `10^f·m` 的大整数尾数（f ≤ 22 才进得了 128 位）。**别拿 `dat_translator/fixed_float` 顶替**：它返回数值、走浮点路径，只在 `\|x\|·10^f < 2^53` 时与 JS 等价（DESIGN §5 第 1 条） |
| `base/clock.h` 的空槽回落 | TS 里 `Ditto.Clock` / `Ditto.Timeout` 永远装着宿主；端口的 `clock()` / `timeout()` 可能是空槽 ⇒ `clock_now()` 回 `0.0`、`clock_hidden()` 回 `false`、`clock_add`/`timeout_add` 回 `0`（=「没有句柄」）、`clock_del`/`timeout_del` 变 no-op | 不是防御性编程：`Randoming::default_mt()` 在**静态初始化期**取时钟取种子，那时宿主还没装槽（与 `callbacks_warn()` 的 `if (warn)` 同款约定） |
| `get_val_from_entity` 的词是查表，不是属性查找 | TS 是 `entity_val_getters[word]`，`word` 撞上 `Object.prototype`（`constructor` / `toString` / `__proto__` …）会拿到一个**函数**而不是 `undefined`；端口是向量查表，查不到给 `nullptr` | 原型污染的产物、数据文件写不出这种词，复现了也只能崩在同一处 ⇒ 不复现（DESIGN §5 第 1 条）。用例只用普通拼错的词 |
| `get_val_from_world` 的回落投影不移植 | TS 是 `(e, ...arg) => fallback(e.world, ...arg)`；端口两个惰性文件都恒 `nullptr`，没有那层投影 | `ValGetter` 是裸函数指针（`base/expression.h`），捕获不了 `world → world.lfw` ⇒ 等 `LF2Val` 真有实现时按 getter 生成静态适配器（DESIGN §65.1） |
| `entity_val_getters` 里的碰撞类型判定读 `data_type` | TS 读活实体的 `c.attacker.data.type`；端口的 `Collision` 里是 `CollisionActor` 快照，只有 `data_type` | 成立的前提是「造碰撞的一方把 `data.type` 写进 `data_type`」（`collision_core` 的差分台子就是这个约定）；`length_of` 的非数组/非字符串分支、`Holding_W_Type` 的 `?? 0` 也一并不可达（DESIGN §5 第 3/4 条） |
| `collision_val_getters` 的活实体走宿主缝 | TS 的 `Collision.attacker` / `.victim` **就是**那两个活实体（读的时候才取字段）；端口的 `Collision` 只有 `CollisionActor` 快照（`collision/` 层看不见 `Entity`）⇒ 新增 `CollisionValEnv { find_entity(id) }`，按 `id` 把活实体交回来 | `collision/` 是「实体不知道我」的那一层；缝的先例是 `set_nbdy_normal_env`（DESIGN §67.2） |
| 找不到那个 `id` 时读实体的项给 `undefined` | TS 那边不存在「读了才知道对象没了」——`Collision` 里存的是活对象引用，只能靠 `undefined.x` 抛 `TypeError` 表达；端口 `Value` 的链式取字段一路给 `undefined` | 只有「实体已经不在世界里」才走得到，真实世界不会；差分里只比较两边都给 `undefined` 的那几个词（DESIGN §5 第 1 条） |
| `victim_is_chasing` 比的是 `id` 不是对象 | TS 是 `c.victim === c.attacker.ctrl.chasing`（同一个对象）；端口 `chasing` 与 `victim` 都是快照 ⇒ 比 `id` | 实体的 `id` 唯一，等价；同 `4r` 的 `reidentify` 是同一类问题（DESIGN §5） |
| `armor_work` 现搭一个 JS 视角 | TS 把整个 `Collision` 递给 `is_armor_work`；端口按它读的四项（`victim.armor` / `bframe` / `itr` / `aframe`）现搭一个 `Value` | 端口 `is_armor_work(const Value&)` 本来就是 JS 对象视角（`collision/is_armor_work.{h,cpp}`），`collision/` 层不需要认识 `Entity`（DESIGN §67.2） |
| `bdy.__tester` / `itr.__tester` / `action.tester` 存**源串** | TS 存 `new Expression(test, get_val_geter_from_collision)` 的编译结果（带函数字段的对象）；端口 `Value` 装不下 ⇒ 存源串，由消费侧（`collision.cpp` / `collision/keeper.cpp` 的 `CollisionCoreEnv::tester_run` 宿主缝）按需编译 | `Value` 只有 7 种类型（DESIGN §9.42 起的老结论）；消费侧本来就把 `tester` 当不透明值转交，签名不用动（DESIGN §68.2） |
| 加载期不编译判定器 | TS 在这三处会 `new Expression(...)` 解析源串（两端词都不认识时还会 `Ditto.warn`），端口只把串挂上去、不解析 | 那是副作用不是数据；`Expression` 的解析结果带函数字段、两端不可比（同 `__judger`，DESIGN §68.2 第 2 条） |
| `bdy` / `itr` 是**数组**时的行为 | TS 能往数组实例上挂 `__tester`；端口的 `Array` 只有元素、没有键位 ⇒ `bdy` 侧按失败处理，`itr` 侧两边都是「成功、无副作用」（实例是标量同理：`itr` 成功、`bdy` 失败） | 这类数据没有意义（`bdy` / `itr` 是对象字面量）；用例里 `itr` 侧有 `a()` / 标量，`bdy` 侧不写（DESIGN §8 第 1 条、DESIGN §68.3 第 6 条） |
| `preprocess_bdy` / `preprocess_itr` 的失败用 `bool` + `error` 出参 | TS 抛 `Error`（`prefab_error(...)`）；端口返回 `false`，只有 prefab 错误的文本能对上，TypeError 类的失败（`bdy` 是标量、`actions` 非数组、动作缺 `type` …）只有 `throw` 这一位可比 | 端口一律不用异常（既有约定）；harness 只打印以 `[` 开头的文本 |
| `preprocess_frame` 的 `__seq_map` | TS 是 `Map`，端口用 `Object` 顶替（渲染里都是 `{k:v}`） | `core` 没有 `Map`；键序不同（JS `Map` 保插入序，`Object` 把整数键前置升序）⇒ 差分用例里的 `seqs` 键只能升序 |
| `preprocess_frame` 不落地 `__gen_*` | `frame.opoint?.forEach(preprocess_opoint)` 的编译结果（九个 `__gen_*`）端口不写 | 同 `preprocess_opoint` 的既有约定（现解析走 `Entity::gen_or` → `World::gen_field` 宿主缝）；差分两侧都剥掉 |
| `preprocess_frame` 不落地 `frame.sound` 的加载任务 | TS 往 `jobs` 里 `push(lfw.sounds.load(...))`，端口不写 | 加载副作用不是数据（同 `A_SOUND` 的既有约定） |
| `preprocess_frame` 的 `frame` 是标量 | TS 读标量属性不抛、第一次写（`frame.width ??= 0`）才抛；端口在入口直接 `false` | 不给标量模型挂属性；差分只比「失败」这一位，`frame` 为标量时两边都是「无副作用地失败」 |
| `cook_frame_indicator_info` 的失败用 `bool` 返回 | V41 版是 `void`：`"w" in pic` 对原始值会抛、`?.forEach` 对非数组会抛、给标量挂 `__indicator_info` 会抛 —— 端口当时静默跳过 | 该函数只有 `preprocess_frame` 一个调用点；改成 `bool` 后两边对齐（数组目标仍算「成功」：TS 能挂属性，而渲染里看不见） |
| `read_nums` 的失败用 `bool` + `error` 出参 | TS 抛 `Error`（`[read_nums] failed, …`）；端口返回 `false`，文本逐字对齐 | 端口不用异常；`preprocess_frame` 的 `center` 会把这段文本透给 `msg=` |
| `traversal` 的**值版**补上字符串分支 | TS `Object.keys("ab")` 是 `["0","1"]` ⇒ 字符串也会走回调（`base.files` 就是这种输入）；端口原来对字符串直接返回 ⇒ 少走回调 | 这一刀按 `traversal_write` 的写法补齐（值版不写回、给的是那一个字符）；值本身在本 subject 里不可观察 |
| `preprocess_entity_data` 的 `__pre_hitkeys_map` / `__post_hitkeys_map` 用 `Object` 顶替 `Map` | TS 用 `new Map()`（键序 = 首次插入序、重复键不增 size） | `core` 没有 `Map`；`renderValue` 对两者输出同形（`{k:v}`），用例里的键都是短下标（不含整数键前置的那种排序差异） |
| `preprocess_entity_data` 不落地加载任务与 `data.xml` | TS 往 `jobs` 里 `push(images.load_img(...))` / 调 `sounds.load(...)`、末尾把 `xml` 挂成函数 | 副作用不是数据、函数装不进 `Value`（DESIGN §9.42）；端口只保留这些调用点的**失败面**（`jobs.push` / `jobs.length` / `Promise.all` 的可迭代要求 / `errors.length`） |
| `preprocess_entity_data` 的 `errors` 只做「缺失就失败」 | TS 有 `errors` 数组、末尾 `if (errors.length) Ditto.warn(errors)`；端口用 `error` 出参（单条）且不落地 `Ditto` | 与 `preprocess_bdy` / `preprocess_itr` / `preprocess_frame` 的既有约定一致（前述）；差分不比较 `errors` |
| `make_ball_special` 对稀疏输入不抛（**3t 遗留**） | TS 在 `id "220"` 这类分支上读 `data.frames[50]` 抛；端口的 `make_ball_special(Value&)` 是 `void`（没有失败通道）⇒ `frames` 缺失时跳过 | 会在 `preprocess_entity_data` 的 ball 分支暴露（`ed` 用例挑表里能跑通的 id，见 `mutations/preprocess_entity_data.mjs` 头部）|
| `make_fighter_special` 的 `ensure(data.base.group, …)`（**3y 遗留**） | TS 的 `ensure(output, item)` 对**非数组真值**（如 `group: 1`）会 `1.push(...)` 抛；端口 `ensure.h` 把非数组一律换成新数组 | 同上：`make_fighter_special(Value&)` 返回 `Value`、没有失败通道 ⇒ `preprocess_entity_data` 的 fighter 分支只能照端口语义走；`ed` 用例的 `group` 一律给数组 |
| `I18N` 的三张表用 `std::map` 顶 `Map` | TS 是 `new Map()`；端口 `_words` / `_lists` / `_alias_map` 都是 `std::map` | `core` 没有 `Map`；三张表都只做「按键取」、从不迭代 ⇒ 序不可观察（同 `NestedMap` / `preprocess_entity_data` 的既有约定）。`Map` **不做** ToString（数字键 ≠ 字符串键）这条语义靠「语言必须是字符串」保住：`words_of` / `lists_of` / `alias_of` 对非字符串语言一律当查不到；词键那一边照 JS 做 `to_string`（`key_at`） |
| `I18N` 不实现 `base_words` / `base_lists` 两个 getter | TS 里是 `this._words.get('')!` / `this._lists.get('')!` | `src/LFW` 里没有使用者（只有 `I18N.ts` 自己的声明），差分用例也不观察；同其它未移植槽的约定 |
| `PlayerInfo` 的字段用 `Value` | TS 的 `_info.name` 是 `string`、`local` / `mine` 是 `boolean`、`ctrl` 是 `CtrlDevice`、`keys` 是 `Record<GameKey,string>`，运行时都可能是别的 | 端口保留原值（同 `Entity::_team` 的既有约定）：构造参数 / `load` 的 JSON5 / 台面都可能给非类型值，用例专门喂 `null` / 数字 / 数组 |
| `PlayerInfo.loaded` 是**挂起**的 | TS 构造里 `this.loaded = this.load()`：那次 load 到第一个 `await` 之后才真正生效，所以构造后立刻注册的监听者也能收到 `load` 期间的回调；端口把那次 load 挂起，第一次 `loaded()` / `load()` 才落地 | 端口没有 promise / 微任务；挂起模型与 TS 的时序等价（台面里 `new` 之后都会读一次 `loaded()`） |
| `on_ctrl_changed` 只传两个参数 | TS 是 `(value, prev, player)`，第 3 个是 `PlayerInfo` 实例 | `Value` 装不下对象实例（DESIGN §9.42）；台面只比前两个参数 |
| `Ditto.warn` 只保留**第一个**参数 | TS 是 `warn(tag, ...)`；端口 `IPlayerInfoHost::warn(text)` | 差分只比第一条文本（`[PlayerInfo::load] …`），其余是日志上下文 |
| `Ditto.Cache.put` 没有失败面 | TS 的 `put(...)` 没 `await`（rejection 无人接）；端口 `cache_put` 返回 `void` | 与 TS 一样「写了就算」；`del` 仍有 `bool` 失败面（TS 那边是 `await` + try） |
| `Ditto` 没装好时不建模 | TS 在 `Ditto.Cache` 是 `undefined` 时会于 `get` / `del` 上抛 `TypeError`；端口假定宿主已装好 `cache_get` / `cache_del` | 台面一定装好；真实调用点（`DatMgr` / `stage`）也在装好 `Ditto` 之后才 `new PlayerInfo` |
| JS 属性读写语义的少数档没建模 | 端口的 `Array`（`std::vector`）装不下「挂在数组上的字符串键」与超长稀疏数组（`length` / 下标上限 1e6）；数组的「洞」在端口里是显式 `undefined`；字符串只认 `length` 与下标两种自有属性 | 这些档要 `_info.keys` 不是普通对象才碰得到（`PlayerInfo` 里造不出来）；`prop_get` / `prop_set` 按 JS 语义保留，台面不喂这些输入 |
| `to_lower_case` 只覆盖部分 Unicode | 覆盖 ASCII / Latin-1（除 `×`）/ Latin Extended-A / 希腊 / 西里尔 + `U+0130` 两码点特例；表外码点原样返回 | 键名实际只出现在这几段；`İ` 一档照抄 JS（`i` + `U+0307`），用例覆盖到了 |
| `ditto/zip/IZip` 只建模 `name` / `file(string)` / `file(RegExp)` / `md5` | TS 还有 `files` / `set` / `blob` | 缺的三条没有调用点 ⇒ 按需不搬；`file(RegExp)` 只认移植触及的固定模式表（`std::regex` 被 lint 禁），表外模式按「全串相等」处理 |
| `IZip.file` 不给抛错面 | 真实 zip 是纯查表、不会抛；TS 里宿主实现若抛会往外传 | 台面不脚本化「宿主自己抛」这种情形 |
| `IZipObject` 不做 `blob` / `uint8_array` | TS 是八个成员（`name` / `text` / `json` / `blob` / `blob_url` / `array_buffer` / `uint8_array` / `image_bitmap`，读法全 async） | 端口有其余六个；缺的两条没有调用点 ⇒ 按需不搬（值形状偏差另见本表的 `array_buffer` / `image_bitmap` 两行） |
| `ILoadedZip` 按**值**存进列表 | TS 的 `add(zip)` 存的是同一个对象引用（`unshift`）⇒ 宿主事后改 `{zip, info}` 在 TS 里看得见、端口看不见 | 真实调用点 `LFW.ts` 是现造现加；台面不造这种情形 |
| `ZipMgr.md5s()` 给 `Value[]` | TS 声明 `string[]`，但实际原样返回 `info.md5`（`?? '` 只吞 `null` / `undefined`） | 端口给 `Value` 不丢信息 |
| `IDataInfo` 只建模自有 8 个字段、且 `info` 必须非空 | TS 是普通对象（可挂别的键），`info` 为 nullish 时读 `info.md5` 会抛 `TypeError` | 台面只喂 TS 声明里的字段 |
| `ditto::vec2` 只收数字 | TS 的 `new Vector2(x, y)` 默认参只吃 `undefined`；显式 `null` 会原样写进 `x` / `y` | `Camera` 只用无参与数字形式；台面只喂数字 |
| `_dested` / `_locked` 的分量只能是数字 | TS 里 `_dested.x` 是 nullish 时 `?? this.destination.x` 会走后半；`jump_*` 也能把 `undefined` 写进 `position.x` | 记在偏差表；台面只喂数字 |
| `Camera` 读 `World::world_stage()` / `world_bg()` / `world_dataset()` 必须回对象 | TS 里 `world.stage` / `bg` / `dataset` 是 nullish 时读属性会抛 `TypeError`；端口的 `field_or` 对非对象给 `undefined` | 台面只喂对象（`undefined` 字段走的是 `to_number` ⇒ NaN）；这三条原来是 `ICameraWorld` 缝，相机直接持真 `World*` |
| `modern_screen_height()` 找不到键时回 0 | TS 的 `Defines.MODERN_SCREEN_HEIGHT` 是模块常量（450），不可能缺 | 端口走运行时表，缺键时 `defines::num` 给 0（`to_number(undefined)` 会给 NaN） |
| `IVector2` 只实现 `x` / `y` / `set` | TS 的 three.js `Vector2` 还有 `add` / `sub` / `length` / `clone` / `normalize` / `equals` | `Camera` 只读写两项；随用到的物理刀再补 |
| `base/dedup.h` 是直通 | TS 的 `deduped` 用模块级 `Map<string, Promise>` 做**并发**去重（同 key 的调用共享同一次执行，settle 后删条目） | 同步端口没有交错 ⇒ 共享观察不到；连带 `dedup_key` 拼出的键字符串在端口里不参与逻辑（台面只做顺序调用） |
| `IZipObject` 的 `array_buffer()` 给字节数组 | TS 是 `ArrayBuffer`（宿主对象） | 端口的 `Value` 装不下宿主二进制类型；台面把两边都渲染成字节列表 |
| `IZipObject` 的 `image_bitmap()` 给 `Value` 标记 | TS 是 `ImageBitmap`（GPU 资源） | 同上；真实数据由后续渲染刀决定怎么接 |
| `Ditto.XML.parse` 的结果是 `Value` 标记 | TS 是 `IXMLElement`（`tag` / `children` / `attrs` / `text` / `parent` + 一批方法） | 只判它的真值；`IXMLElement` 的成员随用到的刀再补 |
| `Resources` 的 `ImportResult.file` / `origin` 是 `Value` | TS 里是 `file?: string` / `origin?: string` | 回退那条路**不写** `origin`、`import_image_bitmap` 回退时 `file` 是 `paths[0]` ⇒ 用 `Value` 才能把「缺席」与空串分开 |
| `Resources` 的五个 `import_*` 是同步 + `bool` 失败出参 | TS 是 `async`，宿主失败靠 promise reject 往外传 | 端口无异常/无 promise；失败面用 `bool` + `error`，文案与 TS 的 `Error.message` 逐字对齐 |
| `FactoryKey` 是 `Value`，表与池用 `std::vector<pair<…>>` 而不是 `Map` / `Set` | TS 的 `Key = string \| number \| symbol`，`Map` / `Set` 按 SameValueZero 判键（`NaN` 也是合法键） | `Value` 装不下 `symbol` 与「`NaN` 当键」；用 `std::vector` 是因为 JS 的 `Map` / `Set` 迭代是**插入序**且覆盖时位置不变（`std::map` / `std::set` 会按键序重排） |
| `ICtrlCreator` 用**指针身份**当键 | TS 直接拿 `ctrl.constructor`（类本身）当 `Map` 键 | `Value` 装不下类；注册点（`register_ctrl`）与归池点（`BaseController::creator()`）用的是同一个指针 ⇒ 等价 |
| `BaseController` 新增 `creator()` / `set_creator()` | TS 靠 `ctrl.constructor` 反查（语言自带反射） | C++ 无反射：`acquire_ctrl` 新建时记下 creator，`release_ctrl` 从实例取回 |
| `acquire_ctrl` 复用时不带参 `reset()`（`player_id` 单独写） | TS 是 `ret.reset(player_id, entity)` | 端口 `BaseController::reset()` 无参（既有约定）；顺序仍是先写 `player_id` 再 `reset()` |
| `Factory::set_warn` 是进程级 sink | TS 是全局 `Ditto.warn` | 端口没有单例容器；机制同 `IPlayerInfoHost::warn` 等既有缝 |
| `IEntityCreators` 是 `std::function<Entity*(World*, const Value&, state::States*)>`，`World` / `LFW` 只前置声明；`IBuffCreator::create` 返回 `buff::Buff*` | TS 是 `(world, data, states) => Entity` 与带 `static KIND` / `static GROUPS` 的类 | 不构造世界；creator / 注册信息由宿主提供，端口只透传 |
| `Factory._usedALIAS` 不移植 | TS 声明了 `protected static readonly _usedALIAS = new Set<string[]>()` | 全仓库没有调用点（同其它只声明不用的槽）；同族的 `create_entity_with_player` / `create_components` / `register_component` / `components` 都已搬 |
| `stage/Expressions` 存的是**副本**（`std::vector`），不是 TS 那个数组本身 | TS 的 `_list` 就是内部数组、`reset(list)` 传回 `list()` 时靠**同一性**早退 | 端口的同一性判定改成「传进来的正是 `list()` 返回的那一份」（不能比地址：临时量可能落在同一格栈上）；对外可观察的行为一致 |
| `stage/Expressions::index()` 是端口新增的只读口 | TS 的 `_index` 是 `protected` | 台面要观测游标；`is_first` / `is_last` 只给两位信息 |
| `bg` 的 `info` / `data` 是 `Value` | TS 是 `IBgLayerInfo` / `IBgData`（普通对象） | 与既有约定一致；`{...info, x}` 的浅拷贝在端口要**显式复制** `Object`（`Value` 共享 `shared_ptr`） |
| `bg/Background` 的 `middle` 是小结构 `Middle` | TS 是对象字面量 `{ x, z }` | 同 `ditto::vec2` 的先例；台面只读两项 |
| `bg/Background` 的 `near` / `far` 两个访问器叫 `near_plane()` / `far_plane()` | TS 字段名就是 `near` / `far` | 那两个名字是 `<windows.h>` 的宏，端口不能直接用 |
| `bg/Background` 读 `data.base` / `data.layers` 走 `field_or` | TS 里 `data.base` 是 nullish 时读 `info.name` 会抛 `TypeError`；`data.layers` 非数组时 `for...of` 会抛 | 端口给 `undefined` / 跳过（台面只喂「对象 base + 数组或 nullish layers」） |
| `helper/Randoming` 模板化成 `RandomingT<T>`（`Randoming` 仍是 `RandomingT<Value>` 的别名） | TS 的 `Randoming<T>` 本来就泛型，`Item.randoming` 是 `Randoming<Randoming<IEntityData>>` | `Value` 装不下「`Randoming` 实例」⇒ 加一个 `RandomingItem<T>` 特化（元素是 `std::shared_ptr<Randoming>` 时 `taken` 的缺省与 `v != taken` 都用指针） |
| `helper/Randoming` 的 `default_mt()` 放在 `randoming_default_mt()` 里 | TS 只有一个静态 `Randoming.mt` 实例（不随元素类型分家） | 模板静态成员会每个 `T` 一份 ⇒ 实例必须放在非模板函数里 |
| `stage/Item` 的 `entity_callback` 按实体各建一份 | TS 是**一个**共享对象，`e.callbacks.del(this.entity_callback)` 传的是对象本身 | 端口的 `Callbacks::on()` 返回 `Remover`、监听体由容器持有 ⇒ 用「两个 `Remover` + 实体指针」记账（效果等价：`objects.delete(e)` + 不再监听 e） |
| `stage/Item` 的析构会摘掉所有监听 | TS 里那个回调会**一直挂在实体上**（JS 对象不会被析构，实体还强引用着 `Item`） | 端口必须摘，否则实体会拿着悬空的 `this` |
| `stage/Item` 的 `x` / `y` / `z` / `enemy_*` 传给 `mt.range` 前会 `to_number` | TS 的 `mt.range(min, max)` 里 `max - min` 是数值强转、`floor(...) + min` 是 JS 的 `+`（`min` 是字符串时会拼接） | 端口 `range(double, double)` 只吃数字 ⇒ 台面不喂非数字（`x z` 这种 `null` 档两边一致，已覆盖） |
| `stage/Stage` 的 `callbacks` 用 `CallbacksT<StageCallbackArgs>` | TS 是 `Callbacks<IStageCallbacks>`，回调签名里有 `Stage` 本身 | `Value` 装不下 C++ 对象 ⇒ 给一个专用 payload（`stage` + 两个值位），同 `FSM` 用 `CallbacksT<FSM*>` 的先例 |
| `stage/Stage` 的 `phase.__end_testers` / `dialog.__end_testers` 由宿主 `IStageLfw::end_testers(owner)` 提供 | TS 里 dat 层已经把 `end_test` 编成了 `IExpression<Stage>` **实例**数组 | `Value` 装不下表达式实例 ⇒ 宿主按「那份数据」交出列表，`Stage` 只负责 `reset` / `flow`（台面把 `__test` 就地转成对象上的 `__end_testers` 序号、实例存在宿主表里 —— 与 TS 的引用语义一致，也不能拿对象**指针**当缓存键：地址会被复用） |
| `stage/Stage` 的 `IDialogState` 用值拷贝的 `DialogState` | TS 是 `{...prev, list}` 对象字面量（每次换新对象，旧的那份留给回调） | 端口按值拷贝 ⇒ `prev` / `curr` 天然是两份；`list` 也是拷贝（TS 里 `[...prev.list, ...more]`） |
| `stage/Stage::warn` 是进程级 sink | TS 是全局 `Ditto.warn` | 同 `Factory::set_warn` 的既有写法 |
| `stage/Stage::set_phase` 的同一性早退用 `same_ref` | TS 的 `phase === this.phase` 是**引用**比较 | `strict_equals` 对对象是**深比较** ⇒ 端口单独写 `same_ref`（对象比指针） |
| `stage/Stage` 的 `_disposers` 永远是空的 | TS 里声明了 `_disposers` 却**没有任何 push 点** | 照抄成员与 `dispose` 里的调用；这条路径不可达（记在 `mutations/stage_main.mjs` 头部） |
| `stage/Stage::change_bg` 在 `world.bg` 为 null 时不抛 | TS 里 `prev_bg.dispose()` 没有 null 守卫（`world.bg` 为 undefined 时抛 `TypeError`） | `World` 构造里先建了 `bg` 再建 `Stage` ⇒ 该路径不可达；端口给守卫（台面只喂「有 bg」的世界） |
| `World::render_worker_id_` 用 `0` 表示 TS 的 `undefined` | `Ditto.Render.add` 的句柄在端口里走 `clock_add`（槽空时回 0），TS 那边没装 Worker 就是 `undefined` | 台面把 0 打成 `u` 对齐；`stop_render` 的「有没有句柄」判断也因此按 `!= 0` 写 |
| `World::fps_value()` 落空回 `NaN` | TS 的 `get FPS()` 在 `sync_render` 不是五个枚举值时返回 `undefined` | 端口的分量是 `double` ⇒ 用 `NaN` 顶替，台面把两者都打 `u` |
| `World::on_step_error` 的 `Date.now()` 与 `e.errors` | TS 读全局 `Date.now()`、参数是异常对象（`Ditto.warn(e)` + `e?.errors`） | 端口把时间收进时钟槽（`clock_now()`，与 `render_once` 同一套）、把「有没有 `errors`」收成 `bool`，第二句告警文本固定 |
| `World::mark_players_alive(Entity&, bool)` | TS 是 `world.mark_players_alive(this, alive)`（实体自报） | 端口原来只有 `mark_players_alive(bool)`，宿主那面少一个实体参数 ⇒ 补上（`entity.h` 与台面假宿主同步改） |
| `World` 的 `Defines.RANDOM_BG.id` 走运行时表 | TS 里是模块常量（`"?"`） | 端口 `defines_value` 缺键时给 `undefined` ⇒ 台面把 `Defines.RANDOM_BG` 当普通数据喂，`change_bg` 的随机分支才能按同一个值判定 |
| `ditto/xml` 的两份 TS 实现选 **tool** 那份当默认 | 浏览器版（`src/DittoImpl/xml/XMLElement.ts`）是 DOM + `XMLSerializer` + `xml-formatter`；tool 版（`tool/src/xml/*`）是纯内存 + fast-xml-parser | 缝的本意是 宿主装服务（DESIGN §9.68）；tool 版无平台依赖、Node 侧能直接跑差分；两边语义差记在下面几条 |
| `ToolXMLElement.as_object` 保留 `type` 属性 | 浏览器版 `if (attr.name == 'type') continue` 跳过它 | tool 语义；`dat_translator/xml` 的读写都按 tool 走 |
| `get_str_arr` / `get_num_arr` **忽略 `or`** | tool 版 `return ret`（缺省就是 `undefined`）；浏览器版是 `ret ?? or` | 端口接口因此只给 optional 版（没有 `or` 重载）；调用点自己 `??` 兜 |
| `as_number()` / `as_boolean()` 恒走缺省（**tool 的死路径**） | tool 版先调 `as_string()`，而它按 `type == 'string'` 挡一道 ⇒ number / boolean 元素永不算值（探针实测 `<number type="number">7</number>` 的 `as_number()` 是 `undefined`）；浏览器版直接读 `value ?? text` 能算 | 照抄 tool；连带 `get_num` / `get_bool` / `get_num_arr` 的子元素分支只有属性回落半边可观察（记在 `mutations/xml.mjs` 头部） |
| `text` 是**自身**文本 | 浏览器版是 `textContent`（含后代文本） | tool 语义；`stringify` 的「有子元素时文本被丢」也照 tool |
| `set_text` 写自身文本 | 浏览器版 `textContent = …` 会替换子节点内容（DOM 行为） | tool 语义（同上一行的 §「自身文本」口径） |
| `insert` 不先摘旧父；`remove` 只认直接子 | 浏览器版 `insert` 先 `child._parent?.remove(child)`、`remove` 用 DOM `contains`（祖先/后代都算） | tool 语义；端口用 `shared_ptr` 装「同一元素挂两个父」 |
| `from_number` 写**文本**（`<number type="number">7</number>`） | 浏览器版写 `value` 属性（`from_string` 两边都写 `value`） | tool 语义；读回时 `attr('value') ?? text` 两边都能接 |
| `stringify` 是 fast-xml-parser 的 `XMLBuilder` | 浏览器版是 `XMLSerializer` + `xml-formatter`（形状差远了） | 端口复刻 `format:true` 的全部形状：2 空格缩进、行尾 `\n`、同名子元素按标签分组、空子元素整块丢、`<x></x>` 不压成 `<x/>`、转义只有 `& < > " '` 五个（见 DESIGN §84） |
| `ToolXMLElement::insert` / `remove` 的 `static_cast<ToolXMLElement*>` | —— | 缝上只有这一种实现；宿主换实现要另写 |
| `CMDS` 是**惰性注册**（首次查表时一次性登记全部 36 条） | TS 在模块加载期按模块逐个 `CMDS.register(...)`（也是 36 条） | 端口没有加载期钩子 ⇒ 表建在 `cmds.cpp`（`register_defaults`）、次序照 `index.ts`；两边的命令表逐条对齐 |
| `CMDS::handle` 对全空白命令直接跳过 | TS 的 `this.inst.words[0].toLowerCase()` 会抛 `TypeError` | 端口无异常；「共同可观测量不存在」不算覆盖缺口（记在 DESIGN §89 与变异档头部） |
| `CMDS::args` 用 `std::map` | TS 是对象字面量：撞原型键（`constructor` 等）会读到函数 | 数据不可达不建形；`eq > 0` / 末次覆盖 / 缺席给 `undefined` 三条语义照抄 |
| `CMDS` 的默认表 + 台面 `__probe__` 都走 `register_cmd` | TS 的注册是 `CMDS.register` 静态方法 | 形状一致（键统一降格、helps 另存）；台面私货用大写键注册以暴露注册侧降格 |

> `native.mjs all` 里的 `coverage` 步骤会跑 `tools/check_defines_coverage.mjs`：
> 它用「运行时枚举 TS 导出」这条**独立于生成器**的路径，检查 TS 里的枚举/字段表/schema 有没有漏搬
> （4AH 起 `src/LFW/ui` 里导出 `Schema_*` 的模块也在扫描范围内）。

**注意修正过的顺序**：`loader/preprocess_*.ts` 在运行时依赖 `dat_translator`
（`CondMaker` / `set_hit_flag` / `make_entity_special` / `xml_x_entity_data` /
`cook_ball_frame_state_*`），所以 `dat_translator` 里那块**必须和 `loader/` 一起搬**，
不能跳过。`ui/` 永远不要先搬。

### `--vs`：按 TS 的对战模式构造场景

`lfw_run --vs` 走的是 TS `GamePrepareLogic.start_game` 的**对战模式分支**（`is_stage_mode === false`）
加 `VsModeLogic.on_start`，与默认的闯关口径区分开：

| 项 | 闯关（默认） | `--vs` |
| --- | --- | --- |
| 队伍 | 宿主硬编 `"1"` / `"2"` | `lfw.new_team()`（自增 `team_N`） |
| 朝向 | 按序号 `i%2` | `mt.pick([Left, Right])` |
| 站位 | `x = -80 + 160*i`、`z = 0` | `x = mt.range(screen_w/3, 2*screen_w/3)`、`z = mt.range(bg.far, bg.near)`（`cam_x` 宿主恒 0：没有准备页相机） |
| hp/mp | 覆盖成 500/500 | **不覆盖**（保持 fighter 数据）＋ `mp = mp_max * 2 / 5` |
| 世界开关 | —— | `paused = false`、`dataset.playrate = 1`、`dataset.infinity_mp = 0` |

```
native\build\msvc-x64\bin\lfw_run.exe --root dist ^
  --zip native\build\host-data\prel --zip native\build\host-data\data ^
  --vs --stage 0 --fighter 1 --fighter 4 --frames 900 --every 300
```

⚠️ 闯关模式的**站位/朝向/队伍**仍是宿主自己的口径（TS 是 `mt.range(40, 80) + cam_x`、
`FacingFlag.Right`、`slot_info.team || new_team`），没有改 —— 一是保持 DESIGN §140/DESIGN §141 那两条摘要基线
可比（`d9b00db799724a2b` / `eeecc812075e8b74`），二是这块要按 TS 补齐属于独立的切片。

## 与 Web 版对拍（参照实现）

完善 Godot 端最省事的办法：**把 Web 版跑起来当参照物**，同状态截图、归一到同一张「逻辑屏幕」再相减。
两个脚本都是零依赖（只用 node 内置模块）：

```
# 终端 1：把构建产物（`dist/`）当静态站点伺服
node native/tools/serve_dist.mjs --port 5177

# 终端 2：无头 Chrome + CDP 按脚本走完 init → entry → main_page → 关卡准备页 → 真对局，逐张截图
node native/tools/web_shots.mjs --out native\build\web
```

产出 `native\build\web\web-{init,entry,main-page,stage-prepare,stage-prepare-joined,match-running}.png`
（**整窗**：DOM 顶栏 + 画布），状态与 Godot 那边一一对应（Godot 的生成命令见「画面存档」里
`webcmp-*` 那些）。`stage-prepare-joined` 是**加入之后**的那一拍（连按攻击 40 次之后、`w w j` 开打之前）——
`web-init` 那一类"页面刚进来"的拍法看不到头像与三行文字，凡是只在"加入之后"才出现的东西
（头像、名字 / 角色 / 队伍）都拿它当参照物。
为什么不用 Electron：本机 `app.whenReady()` 会**卡死**（`--no-sandbox` / `--disable-gpu` 都试过）；
无头 Chrome + 手写 CDP 反而稳（Node 22 自带 `WebSocket`，不需要 puppeteer）。

| 参数 | 作用 |
|---|---|
| `--probe` / `--probe-only` | 打页面状态（`window.lfw` / `ui.id` / 脚本侧请求表 / 异常 / 网络）——「卡在装载页」时先跑它 |
| `--dump-ui` | 每张截图顺带打 UI 节点树（`cross`/`geo` + 文本）——与宿主 `--ui-dump` 的 `box=` **逐节点比数值** |
| `--every-s N` | 按 N 秒连拍（诊断用）；`--eval <js>` 在页面里跑一段表达式（支持 `await`） |
| `--headful` | 用真窗口跑（无头排查不出来时用；`--swiftshader` 退回软件 GL） |
| `--width` / `--height` / `--scale` | 窗口尺寸（缺省 794×450 逻辑 × 1.5） |
| `--ui-page <id>` | 装载完直接把这一页设到第 0 层、只拍这一页（与宿主 `--ui-page` 一一对应）——不用为看一页把整条流程点出来；目标页不在表里时会先点一下启动页把 `prel`/`data` 两张表 import 进来 |
| `--keep-open` | 拍完不关浏览器（继续手工看/继续挥脚本） |

归一化相减（Godot 那张整窗**就是**内容矩形；Web 那张要裁到画布的 box —— 实测 `76,0,1022,579`）：

```
node native/tools/shots_compare.mjs --scale 1 --blur 1 --skip-top 26 `
     --out native\build\web\norm-entry.png --diff native\build\web\norm-entry-diff.png `
     native\host\godot\shots\webcmp-entry-1191x675.png `
     native\build\web\web-entry.png:76,0,1022,579
```

⚠ **静态服务器对缺文件必须回 404**（`serve_dist.mjs` 里那条注释就是它）：TS 的 `Importer.import_as`
是**并发试多个候选 URL、取第一个成功**的（`src/DittoImpl/Importer.ts:74-100`），把 `./launch/bg.png`
这类缺文件当 SPA 路由回 `200 + text/html` 会被当成"命中" ⇒ `createImageBitmap(html)` 失败后退到
`new Image()` + blob URL ⇒ 图片永不 `load` ⇒ **整个装载页卡死**（症状：`builtin_data/launch/*.ui.json`
请求到一半就不动了；排查了半天才发现是自己的服务器在说谎）。只有**无扩展名**的路径才回退
`index.html`（SPA 路由），带扩展名的缺文件一律 404。

## 画面存档（Godot 宿主）

跑出来的截图留在 `native/host/godot/shots/`，便于直接打开查看（生成命令见下）。
⚠ 这个目录**在 `.gitignore` 里**（2026-10-16 起从 git 移除、文件保留在本地）：证据图随跑随换、
只对本地这一台机器有意义，要看某一张就照下面各条列出的命令**重跑**一遍（每条命令都给了完整参数）。

- `shot-stage1.png` / `shot-vs-stage0.png` —— 世界那一遍：狮林 bg_2，两名角色（含武器与影子）。
  `shot-vs-stage0.png` 2026-10-16 **重出**过（配 `--ui-page center_pause_label` 才看得干净：那一页只有几个
  文字节点，缺省落在首页 `init` 会把整个世界盖住）；**改之前**那一张留在 `bg-color-before-vs-stage0.png`
  —— 底下那一条是棕褐色占位块（217,135,97）+ 右侧黑缝，见「2026-10-16」那条"纯色 bg 层"。
- `match-air-dash-1191x675.png` / `match-states-1191x675.png` —— **状态机接上之后的对局**（2026-10-16
  那条"角色离不开地面"的取证；都是 `--stage 1 --fighter 1 --fighter 4` + `--ui-page center_pause_label`，
  所以图里只有世界那一遍，没有 HUD 盖着）：
  前者第 549 tick（`tick = thin dump 的 FRAME / 4`：那一档用了 `--sync-render FPS_120 --sub-render 4`）
  —— 场上有人**悬在草地上方**（`E id=196 pos=y 79.5`，`state=4` Jump）；后者第 2216 tick ——
  同一场里躺着 / 跪着 / 站着三种状态同框，地上还有武器与瓶子（`state` 真在跑）。
  生成命令：`npm run godot '--' --root <abs>\dist --zip <abs>\native\build\host-data\prel --zip
  <abs>\native\build\host-data\data --fighter 1 --fighter 4 --stage 1 --frames <N> --window-size
  1191x675 --delta 0.017 --ui-page center_pause_label --screenshot <out>.png --shot-frame <N>`。
- **`webcmp-{init,entry,main-page,stage-prepare,match}-1191x675.png`（第 10/400/700/760/1800 帧）** ——
  **与 Web 版一一对应的那五张**（生成命令见本节末）。同名状态下 Web 那边的截图在
  `native\build\web\web-*.png`（不进仓库），归一化后的叠图 + 差值图是
  `native\build\web\norm-*.png` / `norm-*-diff.png`。逐节点数值对比（`--ui-dump` ↔ `--dump-ui`）的
  差值清单在上一节「与 Web 版对不上的地方」。
- `ui-launch-early.png`（第 30 帧）/ `ui-launch.png`（第 300 帧）—— UI 那一遍：启动页（`init`）。
  第 30 帧那张还带着**加载指示器**（`SMALL_LOADING` 的 `ImgLoop` 换格）与 `loading: …` 状态文字；
  第 300 帧指示器已被逻辑隐藏。两张都是：整页底色（`rgb(16,32,108)`）+ 平铺背景（`launch/bg.png`，
  `repeatX=20 repeatY=11`）+ 6 条文本（`CLICK ANYWHERE TO CONTINUE` / 警告 / 版本号 / 桌面提示 / …）。
- `ui-main-menu.png`（第 400 帧）—— 主页 `main_page`：标题图（`sprite/MENU_CLIP.png` 裁剪 496×80）、
  左右两张角色大图（`sprite/MENU_BACK8/9.png`，`RandomVisible` 选一张）、12 个按钮的文字
  （`VS Mode` / `Stage Mode` / `Demo Mode` / `Move List` / `Tests Mode` / `Quit`；被选中的那个用
  `style_hover` 的白色 + 下划线，其余是 `style_normal` 的 `#5A73D6`）。
- `ui-char-select.png`（第 300 帧）—— 八人框 `char_menu`：8 个玩家槽（`CMA@4x.png` 的提示图 +
  `Player/Fighter/Team` 标签），**背景里是世界那一遍**（山景 + 角色），
  说明 UI 与世界两半在同一个宿主里叠在一条绘制序上。
- `ui-custom-titlebar.png` / `ui-click-window.png`（1191×675）—— **当前缺省开窗样子**（无系统边框 +
  自绘顶栏 + 1.5×）：前者是启动页，后者是"用**窗口坐标**点击后"的入口页（证明缩放后点击不偏）。
  上面那批 794×450 的是 `--window-scale 1`（1:1 逻辑像素，便于与 TS 逐像素比对；那时还是系统顶栏）。
- `ui-before-click.png` / `ui-after-click.png` —— **开放模式**（`--play`，真窗口、真节拍）的一对
  点击前后：前者是启动页（`init`：整页底色 + 平铺背景 + 居中的 `CLICK ANYWHERE TO CONTINUE`
  + 声音警告 + 版本号），后者是同一进程里**点了一下（397,225）之后**的入口菜单页（`entry`：
  `Little Fighter 2` 标题图、左右两张角色大脸、竖直菜单 `Game Start / Add Mods / Custom Game /
  Network Game / Settings`，`Game Start` 高亮）—— 这一对就是"指针真的接上了"的画面证据。
- `realkeys-vs-prepare.png`（第 2300 帧）—— **真键盘**（`PostMessage` 真 `WM_KEYDOWN/UP`，
  见「2026-10-16」那条"按攻击没反应"）走到 vs 准备页的样子：`玩家: 1 / 角色: 随机 / 队伍: 无队`
  + 中间 `有多少个电脑玩家? 0..7`（那个框是九宫格画的），8 个槽里其余 7 个还是
  `Press Attack to join!`（`CMA@4x.png`）。这一档同时是「头像 + 三行文字」两处修复的取证：
  1 号槽里有头像（`sprite/RFACE@4x.png` 那张 `? / RANDOM / 隨機選角`），三行文字的中心都落在
  120 宽的格子中心上（量法与数值见「2026-10-16」最后两条）。
  这张是"**连按攻击真的能选到角色**"的图：从 `main_page` 起 6 次真 `j` 一路推进到这一步
  （生成脚本：`native\build\realkeys_probe.ps1`，不进仓库）。
- `charmenu-joined.png`（第 1900 帧，同一串真键盘）—— **加入之后、倒计时还在走**的那一拍：
  1 号槽的头像 + `1 / 随 机 / 无队伍` 三行文字（都居中），其余 7 个槽还是 `CMA@4x.png` 的
  `Press Attack to join!` 提示图 —— `realkeys-vs-prepare.png` 那一拍有"电脑人数"对话框压在中路，
  这张干净，专门用来看槽内部（生成：同一份 `realkeys_probe.ps1` 把 `--shot-frame` 改成 1900）。
- `match-char-menu.png` / `match-running.png` / `match-running-later.png` —— **从入口页进对局**
  （`--click` + `--key` 脚本，一条命令；命令见「开放模式现在能走到哪」）：
  ⚠ 这三张是**状态对象还没接上**那个构建拍的（见「2026-10-16」最后一条"角色离不开地面"）；
  同一套脚本在修完的构建上会看到角色真的在跳/被打飞 —— 修完之后的图是
  `match-air-dash-1191x675.png` 与 `match-states-1191x675.png`。
  - `match-char-menu.png`（第 760 帧）—— 八人框，`Player: 1 / Fighter: Davis / Team: Team 1`。
    "Davis" 来自**数据包**（`--zip` 预装的 prel 里只有 `gim`）⇒ 这张图同时是"菜单把 `data.zip`
    真读进来了"的证据；空槽是 `Press Attack to join!`（`CMA@4x.png`），中间是
    `How many Computer Players?`（倒计时走完那一步）。
  - `match-running.png`（第 1800 帧）—— 真对局：bg_2 的分层森林背景、两个角色精灵（其中一个是
    数据包里的角色）、各自头顶血条（`Man. 1 - HP: 500`）、`STAGE 1-1` 与右下 `Stage mode (Difficult)`。
  - `match-running-later.png`（第 2400 帧，同一场）—— 600 帧之后：右边那位 `HP: 50`（打起来了）、
    两人位置都变了（左上的木桩怪还在原地，主角跑到右侧平台）⇒ 「在动」的证据。
- `titlebar-icons.png` / `titlebar-settings-click.png`（1191×675）—— **自绘顶栏那一簇控件**（照 Electron
  的 `src/assets/btn_*.png`，见「窗口外观」那张表）：
  - `titlebar-icons.png`（第 1800 帧，真对局里）—— 那一局能显示的**全部 10 个控件**（`controls(10)=`
    那行）：`dev_ui`（靠 `--key` 敲出 `gim.ink` 开的 `GIM_INK`）、`f4`（页栈 > 1）、`bgm` / `sound`
    （未静音 ⇒ 纯音符 / 有声波的喇叭）、`f1`（对局的 `bg_id` 非 VOID ⇒ 出现，未暂停 ⇒ 暂停条）、
    `settings`（齿轮）、`fullscreen`（向外四箭头）、`minimize`（横线）、`maximize`（单方块）、
    `close`（叉）。`f5` 不在（它只在 web demo 的 `init_demo` 里出现，端口永远走不到那一条）。
  - `titlebar-settings-click.png`（第 1950 帧，同一条命令 + 一次**窗口坐标**点击 `1047,16`）—— 点了设置
    那一格之后：`settings` 页被压到第 1 层（`pages=0:stage_mode_page 1:settings`，画面上就是 Misc
    Settings 那一页），**`f1` 那一格同时从条上消失**（`ui_id == "settings"` 那条条件）⇒ 既是"控件真能
    点"，也是"条件真的在求值"的证据。两次 `controls(N)` 的差值就是 `f1` 那一张。
  - `titlebar-hover.png`（第 1800 帧 + 一条 `--hover-window 951,16@1700`）—— 指针停在 BGM 那一格上：
    图缩到 **0.8**，条下沿弹出**竖直音量条**（`100%` 音量 ⇒ 滑块贴顶、蓝条满格）。悬停态只有
    `--hover-window`（一条 `InputEventMouseMotion`）推得动。
  - `titlebar-volume-drag.png`（同一条命令再补一次**窗口坐标**点击 `951,100`）—— 点在滑杆上：滑块/填充
    落到约 **31%**（`1 - (100-42)/84`），画面上的位置读的正是 `lfw.sounds_bgm_volume()`（宿主那位）
    ⇒ 拖动真的写回了 `sounds_set_bgm_volume`；同一张图里 BGM 那格已回到 0.6（指针在弹层上，不在按钮上）。
  - `titlebar-volume-hover-1191x675.png` / `titlebar-volume-below-only-1191x675.png`（各第 120 帧，
    `1191x675` + `--display-scale 1.5`；BGM 那一格 = CSS `570..602` ⇒ 窗口 `879,24` 是按钮盒里、
    `879,120` 是**按钮下方那条弹层带**）—— 前者 `--hover-window 879,24`：弹出竖条 ✓；
    后者 `--hover-window 879,120`：**什么都没有**（弹层关着时它 `display:none`、不算命中）
    —— 这一对就是「2026-10-16」最后那条"鼠标在按钮下方也弹条"的取证（改前两张一模一样）。
- `window-1400x500.png` / `window-1191x900.png` / `window-1191x675.png`（第 300 帧，`--titlebar custom`）
  —— **这一刀修的那个 bug**（"拉长窗口后，有按钮显示不了"）：切片的画布被 letterbox 关在内容区里
  （视口纹理本身就只等于内容区），自绘条画到窗口右端也被切掉。三张都是**整窗**截图，条铺满整窗宽、
  控件贴**窗口**右上角：
  - `window-1400x500.png`（非等比窗口）—— 内容 `882x500+259+0` 居中、左右各 259 黑边，
    8 个控件全在窗口右上角（`bar=1400x32`）。
  - `window-1191x900.png`（**用户那种"拉高"的窗口**）—— 内容 `1191x675+0+113` 居中，条在最顶上一行。
  - `window-1191x675.png`（缺省 1.5×）—— 内容 = 窗口、没有黑边；这张与切片之前的同名截图
    **逐像素相同**（0 像素差）⇒ 等比窗口下的渲染没被这一刀碰过。
- `window-dpi-auto.png` / `window-dpi-1p5.png`（`1191x675` + 一条 `--hover-window 300,10@60` 把
  `.wails_drag` 高亮那一层画出来）—— **顶栏尺寸不变式 + DPI 那一档**的实测：前者用屏幕自己的缩放
  （本机 **1.000**，与 `--display-scale 1` 逐像素相同），后者 `--display-scale 1.5` 强制 1.5 倍。
  与 `--titlebar none` 的同一帧相减（差值就是条自己画的像素）量到：拖拽层高 **29 px → 43 px**
  （28.8×1 → 28.8×1.5），图标轮廓 **17×239 px → 26×359 px**（比值 1.53 / 1.50），
  而 `titlebar:` 那行的 `icon=19.2` 与条高 `32` **两档一样**（只有 `scale=` 从 1.000 变 1.500）⇒
  条与图只随显示缩放放大、不随窗口尺寸变。命中同样跟着缩放走：`--display-scale 1.5` 下窗口
  `975,16` 命中 `settings`、`1167,16` 命中 `close`（见「窗口外观」那张表）。
- `window-clip-probe.png`（`1400x500` + `--clip-probe`）—— **游戏那一层真的被裁在内容矩形里**的量化
  证据：贴着逻辑屏幕边界**内外各 8 像素**画的洋红圈，只有边界**里面**那半圈出现（左边界内 4536 像素
  洋红、两条黑边里 **0** 像素；`1191x900` 的上下黑边同理 12 / 0）⇒ 逻辑屏幕外的绘制不会漏进黑边。
- `window-bug-before-1400x500.png` —— **修之前**同一条命令抓出来的样子（对照用：那时截图只有内容区
  882×500，右上角那一簇按钮压根不在图里、画面上也被切掉）。
- `window-entry-*.png` / `window-norm-*.png` —— **contain 缩放的归一化对照**（同一帧、三种窗口尺寸）。
  入口页（`--play --click '397,225@10'`，第 400 帧）分别在 `1191x675`（1.5×）、`1920x1030`（2.288×，
  左右各 52 黑边）、`1400x500`（1.111×，左右各 259 黑边）下各抓一张整窗图，再各自裁到 `window:` 那行的
  `content=宽x高+左+上`、按自己的 `scale=` 缩回 794×450 叠成一张（工具见下）：
  - `window-entry-bug-before-1191x675.png` / `window-entry-bug-before-1920x1030.png` —— **修之前**：
    标题图/文字挤在左上、"右脸"大图还多出一份 1:1 的小号镜像（那把 contain 冲掉的 bug）；
  - `window-entry-1191x675.png` / `window-entry-1920x1030.png` / `window-entry-1400x500.png` —— 修之后；
  - `window-norm-1191x675-vs-1920x1030.png`（修之后叠图，1191 在上）/ `window-norm-1191x675-vs-1400x500.png`
    （非等比）/ `window-norm-bug-before-*.png`（修之前叠图）/ `window-norm-diff-1191x675-vs-1920x1030.png`
    （修之后的逐像素差，放大 8 倍，肉眼可核对"剩下的只有文字笔画边缘"）。
  数字（`--blur 1 --skip-top 25`：顶栏那一层在**窗口像素**里、归一到逻辑网格后两张图必然不重合，故排除
  顶上 25 行）：修之前 `mean=6.173 px>2=59864 px>8=56097 px>24=30323 max=243.8`；修之后
  `mean=0.186 px>2=4185 px>8=475 px>24=33 max=34.8`（1400×500 那张 `mean=0.403 px>8=2757 px>24=234`）。
  剩下的差异只在文字/图边（两张的字体过采样 1.5 vs 2.289 不同，糊一下就掉）；**几何**另有两条硬证据：
  ① 周期性背景（`launch/bg.png`，逻辑周期 39.7 px）在窗口像素里的实测周期 = 40 / 44 / 59 / 79 / 91 px
  （对应 scale 1 / 1.11083 / 1.5 / 2 / 2.28841），② 标题图外框的位置与 1191×675 那张的预测值逐边相差
  ≤0.9 逻辑像素（阈值量出来的粒度本身就有 ±1 窗口像素）。

开窗截图的跑法（**别加 `--headless`**；`--ui-page` 是"装载后点进这一页"，缺省就是数据自己的首页 `init`）：

```
$R = (Get-Location).Path; $g = "C:\Users\Gim\Desktop\Godot_v4.7.1-stable_win64_console.exe"
# 与 Web 版对拍的那五张（缺省开窗：borderless + 自绘顶栏 + 1.5×；键串与 README 上面那条一样）
npm run godot '--' --play --frames 200 --screenshot native\host\godot\shots\webcmp-init-1191x675.png --shot-frame 200
npm run godot '--' --play --frames 400 --click '397,225@10' --screenshot native\host\godot\shots\webcmp-entry-1191x675.png --shot-frame 400
npm run godot '--' --play --frames 700 --click '397,225@10' --key 'j@450' --screenshot native\host\godot\shots\webcmp-main-page-1191x675.png --shot-frame 700
npm run godot '--' --play --frames 760 --click '397,225@10' --key 'j@450' --key 's@500' --key 'j@520' --screenshot native\host\godot\shots\webcmp-stage-prepare-1191x675.png --shot-frame 760
#   对局那张：`--key` 用上面「开放模式」那条完整键串（…'j@1440','w@1520','w@1540','j@1560'）+ `--shot-frame 1800`
npm run godot '--' --play --delta 0.017 --frames 1900 --click '397,225@10' @tk @ka --screenshot native\host\godot\shots\webcmp-match-1191x675.png --shot-frame 1800
# 当前缺省开窗样子（borderless + 自绘顶栏 + 1.5×）：启动页 / 用窗口坐标点击后的入口页
npm run godot '--' --play --screenshot native\host\godot\shots\ui-custom-titlebar.png --shot-frame 150
npm run godot '--' --play --click-window '595,337@20' `
    --screenshot native\host\godot\shots\ui-click-window.png --shot-frame 400
# 点击前后那一对（开放模式：不 boot_scene、真节拍；点击走 --click，PS 里逗号值要加引号）
npm run godot '--' --play --screenshot native\host\godot\shots\ui-before-click.png --shot-frame 200
npm run godot '--' --play --click '397,225@5' `
    --screenshot native\host\godot\shots\ui-after-click.png --shot-frame 400
# contain 缩放的归一化对照（入口页、同一帧、三种窗口尺寸；修 contain 那个 bug 之前的样子用 git 里的
# 提交跑同一条 —— `window-entry-bug-before-*.png` 就是它）：每张都**不加** --headless
npm run godot '--' --play --click '397,225@10' --screenshot native\host\godot\shots\window-entry-1191x675.png --shot-frame 400
npm run godot '--' --play --click '397,225@10' --window-size 1920x1030 --screenshot native\host\godot\shots\window-entry-1920x1030.png --shot-frame 400
npm run godot '--' --play --click '397,225@10' --window-size 1400x500 --screenshot native\host\godot\shots\window-entry-1400x500.png --shot-frame 400
# 再各自裁到 content=… 的内容矩形、缩回 794×450 叠图 + 逐像素差（工具自带 PNG 读/写，只用 Node 的 zlib）
node native\tools\shots_compare.mjs --blur 1 --skip-top 25 `
    --out native\host\godot\shots\window-norm-1191x675-vs-1920x1030.png `
    --diff native\host\godot\shots\window-norm-diff-1191x675-vs-1920x1030.png `
    native\host\godot\shots\window-entry-1191x675.png `
    native\host\godot\shots\window-entry-1920x1030.png:52,0,1817,1030
node native\tools\shots_compare.mjs --blur 1 --skip-top 25 `
    --out native\host\godot\shots\window-norm-1191x675-vs-1400x500.png `
    native\host\godot\shots\window-entry-1191x675.png `
    native\host\godot\shots\window-entry-1400x500.png:259,0,882,500
# 四档 --titlebar 的外部证据（Windows：Win32 style 位 + 窗口/客户区矩形 + 屏幕截图）。
# 脚本自己起 Godot、量完杀进程；两张 screen-*.png 就是 shots/window-frame-os-caption.png /
# shots/window-custom-no-os-frame.png 的来源（**屏幕**截图，不是 --screenshot）。
powershell -File native\tools\win_window_modes.ps1 -Modes "native,custom,frame"
# 下面这几张是 1:1 逻辑像素的老参照图（**加 `--titlebar native --window-scale 1`** 才复现得出来）
& $g --path native\host\godot\project -- --root "$R\dist" --titlebar native --window-scale 1 `
    --zip "$R\native\build\host-data\prel" --frames 200 --every 200 --delta 0.017 `
    --screenshot "$R\native\host\godot\shots\ui-launch-early.png" --shot-frame 30
& $g --path native\host\godot\project -- --root "$R\dist" --titlebar native --window-scale 1 `
    --zip "$R\native\build\host-data\prel" --ui-page main_page --frames 400 --every 400 `
    --delta 0.017 --screenshot "$R\native\host\godot\shots\ui-main-menu.png" --shot-frame 400
& $g --path native\host\godot\project -- --root "$R\dist" --titlebar native --window-scale 1 `
    --zip "$R\native\build\host-data\prel" --zip "$R\native\build\host-data\data" `
    --fighter 1 --fighter 4 --stage 1 --frames 900 --delta 0.017 `
    --screenshot "$R\native\host\godot\shots\shot-stage1.png" --shot-frame 300
# 世界那一遍（同一场但 `--vs`：第 600 帧就摆好了架势）。`--ui-page center_pause_label` 是"只看世界"的
# 钥匙：缺省那页（数据首页 `init`）会把整个画面盖住。`shot-vs-stage0.png` 就是这条重出的
# （**改之前**那一张留作对照：`shots\bg-color-before-vs-stage0.png`）。
& $g --path native\host\godot\project -- --root "$R\dist" --titlebar native --window-scale 1 `
    --zip "$R\native\build\host-data\prel" --zip "$R\native\build\host-data\data" `
    --stage 0 --fighter 1 --fighter 4 --vs --ui-page center_pause_label --frames 600 --delta 0.017 `
    --screenshot "$R\native\host\godot\shots\shot-vs-stage0.png" --shot-frame 600
# 从入口页打到真对局的三张（`--key` 脚本；`--play` = 不 `boot_scene`，由数据页面驱动）。
# 键串 = Game Start → Stage Mode → 加入（a×3）→ 倒计时里 a×13 提前收尾 → 选电脑人数（a×1）
#        → 逐个电脑选人（a×22）→ U U a 命中 btn_fight；写成数组省得抄三遍。
$keys = @(
  'j@450','s@500','j@520','j@560','j@580','j@600','j@620','j@640','j@660','j@680','j@700',
  'j@720','j@740','j@760','j@780','j@800','j@820','j@840','j@860','j@1000','j@1020','j@1040',
  'j@1060','j@1080','j@1100','j@1120','j@1140','j@1160','j@1180','j@1200','j@1220','j@1240',
  'j@1260','j@1280','j@1300','j@1320','j@1340','j@1360','j@1380','j@1400','j@1420','j@1440',
  'w@1520','w@1540','j@1560')
$key_args = @(); foreach ($k in $keys) { $key_args += @('--key', $k) }
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' @key_args `
    --frames 2000 --screenshot "$R\native\host\godot\shots\match-running.png" --shot-frame 1800
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' @key_args `
    --frames 2600 --screenshot "$R\native\host\godot\shots\match-running-later.png" --shot-frame 2400
# 选人页那一张：键串短一截（多一个 `a@580` = 换掉 Random 挑个真角色），停在第 760 帧
$cm_keys = 'j@450 s@500 j@520 j@560 a@580 j@600 j@620 j@640 j@660 j@680 j@700 j@720' -split ' '
$cm_args = @(); foreach ($k in $cm_keys) { $cm_args += @('--key', $k) }
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' @cm_args `
    --frames 820 --screenshot "$R\native\host\godot\shots\match-char-menu.png" --shot-frame 760
# 自绘顶栏那一簇的两张（同一场对局；`--play` + 同一串 `--key`）：
# ① 能显示的 10 个控件全在：开头多敲 g i m . i n k（= 作弊码 `GIM_INK` ⇒ `dev_ui` 那一格出现），
#    对局里 `bg_id` 非 VOID ⇒ `f1` 出现，页栈 > 1 ⇒ `f4` 出现。
$cheat = @('g@20','i@25','m@30','.@35','i@40','n@45','k@50')
$tk_args = @(); foreach ($k in $cheat) { $tk_args += @('--key', $k) }
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' @tk_args @key_args `
    --frames 1900 --screenshot "$R\native\host\godot\shots\titlebar-icons.png" --shot-frame 1800
# ② 同一场里用**窗口坐标**点设置那一格（1047,16 = 1191 宽窗口上第 6 格的中心）：`settings` 页压到第 1 层、
#    `f1` 那一格同时消失（`ui_id == "settings"`）—— 条上的点击只落在条上，没漏给底下的游戏。
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' --click-window '1047,16@1850' `
    @tk_args @key_args --frames 2000 `
    --screenshot "$R\native\host\godot\shots\titlebar-settings-click.png" --shot-frame 1950
# ③ 悬停那两格音量（`--hover-window` = 只推一条 `InputEventMouseMotion`，只有它推得动悬停态）：
#    951,16 是 BGM 那一格的中心（10 个控件时 = 1191 - 8×32 - 16）。
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' --hover-window '951,16@1700' `
    @tk_args @key_args --frames 1900 --screenshot "$R\native\host\godot\shots\titlebar-hover.png" `
    --shot-frame 1800
# ④ 同一条再加一次窗口坐标点击 951,100（落在弹层的滑杆上）⇒ 音量被设成 `1 - (100-42)/84 ≈ 0.31`。
& $g --path native\host\godot\project -- --play --root "$R\dist" --delta 0.017 `
    --zip "$R\native\build\host-data\prel" --click '397,225@10' --hover-window '951,16@1700' `
    --click-window '951,100@1740' @tk_args @key_args --frames 1900 `
    --screenshot "$R\native\host\godot\shots\titlebar-volume-drag.png" --shot-frame 1800
# ⑤ 整窗截图那一组（这一刀修的 bug：条曾被 letterbox 切掉；三张都是**整窗**）+ 裁剪观测量。
npm run godot '--' --titlebar custom --window-size 1400x500 --frames 300 --delta 0.017 `
    --screenshot native\host\godot\shots\window-1400x500.png --shot-frame 300
npm run godot '--' --titlebar custom --window-size 1191x900 --frames 300 --delta 0.017 `
    --screenshot native\host\godot\shots\window-1191x900.png --shot-frame 300
npm run godot '--' --titlebar custom --window-scale 1.5 --frames 300 --delta 0.017 `
    --screenshot native\host\godot\shots\window-1191x675.png --shot-frame 300
npm run godot '--' --titlebar custom --window-size 1400x500 --frames 120 --delta 0.017 --clip-probe `
    --screenshot native\host\godot\shots\window-clip-probe.png --shot-frame 120
# ⑥ 顶栏尺寸不变式 + DPI 那一档（本机屏幕缩放 = 1.000 ⇒ 用 --display-scale 强制；见「窗口外观」）
npm run godot '--' --titlebar custom --window-scale 1.5 --frames 120 --delta 0.017 `
    --hover-window '300,10@60' --screenshot native\host\godot\shots\window-dpi-auto.png --shot-frame 120
npm run godot '--' --titlebar custom --window-scale 1.5 --display-scale 1.5 --frames 120 --delta 0.017 `
    --hover-window '300,10@60' --screenshot native\host\godot\shots\window-dpi-1p5.png --shot-frame 120
#   两条配对的对照图（量差值用，不进 shots/）：同帧同场面 + `--titlebar none`
npm run godot '--' --titlebar none --window-scale 1.5 --display-scale 1 --frames 120 --delta 0.017 `
    --screenshot native\build\none-1.png --shot-frame 120
npm run godot '--' --titlebar none --window-scale 1.5 --display-scale 1.5 --frames 120 --delta 0.017 `
    --screenshot native\build\none-1p5.png --shot-frame 120
# 修之前同一条命令抓出来的样子（只在内容区里 ⇒ 右上角按钮被切掉；留作对照）
npm run godot '--' --titlebar custom --window-size 1400x500 --frames 300 --delta 0.017 `
    --screenshot native\host\godot\shots\window-bug-before-1400x500.png --shot-frame 300
```

⚠ **顶栏那几张的坐标**：条上的一切都按**窗口像素**判（1.5× 下 = 逻辑像素 × 1.5），所以要用
`--click-window` 而不是 `--click`（后者直接注入逻辑坐标，**绕过** `_input` ⇒ 走不到 `titlebar_consume`）。
`1047,16` 落在 `settings` 那一格：条从右边排，`settings` 右边固定有 `fullscreen / minimize / maximize /
close` 四格 ⇒ 它的中心恒为 `窗口宽 - 4×32 - 16`。悬停（拖拽层高亮 / 控件缩 0.8 / 音量弹层）要用
**`--hover-window <x>,<y>[@<frame>]`** —— `--click*` 只推按钮事件，推不出悬停态。

⚠ **关于 `!launch/bg.png`**（曾经以为"数据缺件"，**不是**）：TS 的 `Ditto.Importer.get_possible_url_list`
带 `roots = ["builtin_data"]`，路径若不以 `builtin_data/` 开头会**再试一遍 `builtin_data/<路径>`**
⇒ TS 找得到 `dist\builtin_data\launch\bg.png`。端口原先缺这一档（只试 `<root>/<路径>`），所以得靠
多加一个 `--root dist\builtin_data` 绕过；**现在 `HeadlessHost::resolve` 已按同一口径补上第二档**
（`headless_host.cpp`），`--root dist` 一处就够：`ui: … drawn=8 items=227 missing_img=0`。
