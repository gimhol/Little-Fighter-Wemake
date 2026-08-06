# nativify — LFW (TypeScript) → C++ 移植可行性报告

本目录评估 `src/LFW/` 下 **821 个 TypeScript 文件**改写成 C++ 实现的难度，并给出逐文件报告。

> 生成工具：`nativify/analyze.mjs`（仅依赖 Node 内置模块，可随时重跑）
> 数据来源：2026-08-06 扫描

## 目录结构

```
nativify/
├── README.md                 ← 本文件（方法/结论/策略）
├── SUMMARY.md                ← 难度分布统计 + 最困难文件清单（自动生成）
├── INDEX.md                  ← 全部 821 个文件难度索引表（自动生成）
├── analyze.mjs               ← 分析/报告生成脚本
├── data/metrics.json         ← 每文件原始指标（自动生成）
├── reports/                  ← 逐文件报告（自动生成，镜像 src/LFW 目录结构）
│   ├── entity/Entity.md
│   ├── World.md
│   └── ...
└── deep-dive/                ← 核心文件人工深度分析（手写）
    ├── entity-Entity.md
    ├── World.md
    └── ...
```

## 方法

对每个 `.ts` 文件（去除注释与字符串后）自动检测影响 C++ 移植的指标：

- **规模**：行数、字节数、import/export 数
- **语言特征**：`any`/`unknown`、class/enum/interface、getter/setter、static、
  Map/Set、string 键容器、JSON、正则、async/await、DOM/浏览器 API、二进制、
  动态属性访问 `obj[key]`、回调/事件、instanceof、展开运算符、可空联合等
- **分类**：纯类型 / 枚举 / 常量数据 / 纯函数 / 类实现 / 混合
- **难度**：1（微不足道）~ 5（极难），由规模+结构+宿主依赖+类型摩擦加权得出

难度为**启发式评分**，用于横向排序与优先级决策；`deep-dive/` 目录对核心文件给出人工复核结论。

## 总体结论

| 指标 | 值 |
| --- | --- |
| 文件数 | 821 |
| 总行数 | 47 367 |
| 平均难度 | 1.8 / 5 |
| 难度 ≥ 4 的文件 | 37（真正的硬骨头） |
| 纯类型/枚举/常量文件 | 227（≈28%，几乎是机械映射） |

**判断：整体可行，但应分层、分批移植，且不建议 1:1 逐文件重写。**

### 关键架构发现：Ditto 注入层

整个逻辑层通过 `ditto/Instance.ts` 的 `Ditto` 单例访问宿主能力（渲染/音频/输入/定时/网络/XML/ZIP）。
这正好对应 C++ 的抽象接口层——**先定 `IDittoPack` 接口，再决定各平台实现**，是整个移植的边界。

### 分层策略（按批次）

| 批次 | 范围 | 理由 | 难度 |
| --- | --- | --- | --- |
| 1 | `defines/` `utils/` `utils/math/` `utils/string_parser/` `base/`（FSM、Times、Callbacks、MersenneTwister） | 纯数据/纯函数/通用设施，无平台依赖，是其它一切的地基 | ★1–2.5 |
| 2 | `entity/Entity.ts` + `state/` + `collision/` | 核心模拟层，最大工作量 | ★5 |
| 3 | `controller/` + `bot/` + `stage/` + `World.ts` + `Ground.ts` | 依赖批次 1、2 | ★3–5 |
| 4 | `loader/` + `dat_translator/`（仅运行时所需部分） | 数据加载 | ★3–4 |
| 5 | `ditto/` 平台实现 + `ui/`（视方案） | 宿主桥 + UI | 视方案 |

### 三个方向性决策（建议先定）

1. **UI 层（`ui/` 188 个文件）**：成本最高。建议**保留 JS 或 FFI 桥接**，不整体 C++ 化。
2. **dat_translator（188 个文件）**：离线构建工具链，**保留 JS/脚本层**，C++ 只消费生成的 JSON。
3. **Ditto 宿主能力**：C++ 侧用 SDL2/GLFW 等原生实现，或继续由 JS 宿主注入（FFI），二选一。

### 复用的 C++ 库建议

| 需求 | 建议库 |
| --- | --- |
| JSON（数据加载） | nlohmann/json |
| XML（LF2 数据） | pugixml / tinyxml2 |
| ZIP | minizip / libzip |
| 渲染/窗口/输入 | SDL2 + OpenGL/WebGPU，或宿主 FFI |
| 音频 | SDL_mixer / miniaudio |
| 数学 | 自写 `Vec2/Vec3` 值类型（替代 `Ditto.Vector3` 堆分配） |
| 哈希表 | `std::unordered_map`；热路径用整型键 |

## 读报告的顺序建议

1. `SUMMARY.md` — 全局分布
2. `INDEX.md` — 按难度排序的完整清单
3. `deep-dive/` — 核心文件人工分析（Entity、World、Ditto、UI、CollisionKeeper、validate_schema 等）
4. `reports/<路径>.md` — 具体文件细节
