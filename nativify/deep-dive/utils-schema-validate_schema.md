# 深度分析：utils/schema/validate_schema.ts

> 运行时数据模式校验/清洗（元编程最重的文件）。自动评分 **5 / 5 极难** · 181 行

## 职责

`SchemaValidator`：按 `ISchema`（`defines/ISchema.ts` + `utils/schema/make_schema.ts`）对任意对象做递归校验与**原位惰性转换**：

- 类型检查（boolean/string/number/integer/array/object）
- 可空、正负、NaN、非空字符串等约束
- **惰性实例化**：对类类型属性，用 `Object.defineProperty(value, i, { get, set })` 在**读取时才**把原始值转换为类实例

## 为什么是最难移植的模式之一

| JS 特性 | 说明 | C++ 对策 |
| --- | --- | --- |
| `Object.defineProperty` + getter/setter 闭包 | 在运行时往**已有对象**上挂动态访问器，读取时懒转换 | **C++ 没有运行时属性描述符**。必须重设计：改为显式 `getInstance()` / 转换管线（`validate` 后立即物化），或写 `transform(raw) -> T` 函数，放弃“懒”语义 |
| `typeof value !== 'string'` 等运行时类型反射 | 对任意 JS 值做类型分派 | C++ 需 `std::variant` + `std::visit`，或明确输入类型（数据来自 JSON 反序列化，类型已知） |
| `value is T` 类型守卫 | 校验同时收窄类型 | C++ 返回 `std::optional<T>` / 错误码 |
| `Array.isArray` / `Number.isNaN` | 全局函数 | `std::vector` / `std::isnan` |
| `Object.keys` 遍历 | 动态字段枚举 | 若 schema 固定 → 编译期 struct；若动态 → `std::map`/反射框架 |

## 移植建议

1. **放弃“懒转换”语义**：在数据加载（`DatMgr`）阶段一次性校验+物化，C++ 侧为 `validate(raw, schema) -> optional<Instance>`。
2. schema 描述本身是数据（`make_schema` 生成的对象），可 1:1 转为 C++ 的 `Schema` 结构体。
3. 这个模块是**通用设施**，被 `defines` 下几乎所有 `I*Info` 的 schema 用到（`IFrameInfo.ts` 里的 `Schema_IFrameInfo` 等）。它定稿后，`defines` 数据层才能落地——**建议第一批移植**。
4. 若 C++ 侧 JSON 用 nlohmann/json，可直接在其 `from_json` 内做校验，把本模块能力内联。

## 预估

- 重设计 + 实现：1–2 周（含 `make_schema` 38 行）
