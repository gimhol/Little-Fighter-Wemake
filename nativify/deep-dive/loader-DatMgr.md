# 深度分析：loader/DatMgr.ts

> 数据加载/预处理器（ZIP→XML→对象→预处理→注册）。自动评分 **5 / 5 极难** · 353 行 · async 为主

## 职责

- 从 `Ditto.Zip` 读取数据，经 `xml_to_*` 转换器生成 `IEntityData`/`IBgData`/`IStageInfo`
- 运行 `preprocess_*` 预处理（帧烘焙、itr 展开、别名注册）
- 通过 `Factory.register_ctrl(id, (a,b)=>new BallController(a,b))` 注册控制器工厂
- 并发加载（`jobs: Promise<any>[]`）、取消机制（`Inner` 的 `cancelled`）

## 关键 JS 模式与 C++ 对策

| 模式 | 说明 | C++ 对策 |
| --- | --- | --- |
| `async/await` + `Promise<any>[]` | 并发预处理管道 | **重构为同步或显式任务队列**：C++ 无 GC/事件循环，建议加载阶段同步化（或 std::async + future，但小心数据竞争） |
| `Promise<any>` | 非类型化异步作业 | 类型化任务（`std::vector<std::function<void()>>`） |
| `Factory.register_ctrl(id, closure)` | 运行时按 id 注册构造器 | 工厂表 `std::unordered_map<std::string, std::function<Controller*(Entity&)>>`；或编译期注册宏 |
| 字符串键 Map 群 | `data_map`/`alias_map`/`bot_map`/`randomings` | `std::unordered_map<std::string, ...>` |
| 取消令牌 | `inner_id !== this.id` 判断是否过期 | 版本号 int 字段，直接照搬 |
| `??` 默认回填 | `data.base.bot = data.base.bot ?? bot_map.get(...)` | `if (!d.bot) d.bot = ...` |

## 移植要点

1. **加载管线建议整体同步化**：数据量在内存里可一次加载（ZIP 解包后），C++ 侧加载时阻塞可接受，省去异步状态机。若坚持异步，用协程（C++20）或任务依赖图。
2. `preprocess_*`（20+ 个文件）是无状态纯函数链，优先移植，与 `dat_translator` 的 XML 解析配套。
3. XML 解析（`ditto/xml`）在 C++ 用 pugixml/tinyxml2 替代，输出映射到 `xml_to_*` 转换器。

## 预估

- 1–2 周（同步化方案）+ 预处理函数链 1–2 周
