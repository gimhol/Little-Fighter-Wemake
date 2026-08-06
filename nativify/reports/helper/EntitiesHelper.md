# helper/EntitiesHelper.ts

> 源文件: `src/LFW/helper/EntitiesHelper.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 47 |
| 大小 | 1435 bytes |
| import 数 | 5 |
| export 数 | 1 |
| 分类 | 类+函数+数据混合 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- class 定义
- 箭头函数/回调
- getter/setter
- 数组高阶方法
- 动态属性访问 obj[key]
- 可空联合类型

## C++ 移植要点

- `src/LFW/helper/EntitiesHelper.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
- getter/setter 语义需在 C++ 中通过访问器方法保持。
- 可空联合类型建议用 `std::optional` / 指针表达。
