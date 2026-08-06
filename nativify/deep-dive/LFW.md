# 深度分析：LFW.ts

> 对外门面（Facade）+ 全局静态状态 + 资源/命令中枢。自动评分 **5 / 5 极难** · 816 行 · 12 处 any

## 职责

- 静态入口：`LFW.instance` / `LFW.world` / `LFW.fighters` 等大量静态 getter 转发
- 管理 ZIP 资源（`prel.zip.json` / `data.zip.json`）与版本信息
- 命令执行（`cmds`）、作弊码（`_cheat_keys` / `_cheat_gkeys`）、键盘事件广播
- UI 栈管理、I18N、声音、`Graves<Keys>` / `Graves<Collision>` 缓存池
- `Factory` 创建实体，`DatMgr` 加载数据

## 关键 JS 模式与 C++ 对策

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| 静态可变状态 | `static instances: LFW[]`、`static _INFO` | 类静态成员 + 单例；注意初始化顺序（static init order fiasco）→ 用函数局部静态 |
| 静态 getter/setter 链 | `static get world()` 等十几条 | 静态访问器方法；`instance` 为 null 时 JS 返回 undefined，C++ 需 `std::optional`/指针 |
| `Map<string, {...}>` | `_strings`、`_cheat_gkeys`、`_keys_graves` | `std::unordered_map`；Graves 池建议 `std::deque`/vector 复用 |
| `any[]` 参数 | `debug(..._1: any[])` | 变参模板或格式化日志接口 |
| `Number(Date.now())` | 随机种子 | `std::chrono` 时间戳 |
| `Readonly<IGameZipInfo>` 全局配置 | `DEFAULT_INFO` | `constexpr` 结构体 |
| 事件对象数组 | `events: LFWKeyEvent[]`、`broadcasts: string[]` | 每帧清空的 `std::vector`，语义简单 |

## 移植要点

1. **LFW 是唯一必须保持“静态可访问”的类**——C++ 中大量模块通过 `LFW.instance` 访问全局。建议提供 `LFW::instance()` 全局单例，或改为显式依赖注入（更符合 C++ 风格，但改动面大）。
2. **资源管理**：`ZIPS` 是字符串/对象数组，C++ 侧对应 `std::vector<std::variant<std::string, Zip*>>` 或拆成两个容器。
3. **作弊码**：字符串拼接匹配（`_cheat_keys` 累积按键），可保留字符串逻辑，无性能压力。
4. **UI 栈**：`_ui_stacks: UIStack[]` 与 `ui/` 层强耦合，若 UI 层最终保留 JS，则 LFW 中 UI 相关字段通过 FFI 桥接。

## 预估

- 2–3 周（作为收尾整合层；依赖 Entity/World/UI/DatMgr 全部就绪）
