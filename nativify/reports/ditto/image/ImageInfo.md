# ditto/image/ImageInfo.ts

> 源文件: `src/LFW/ditto/image/ImageInfo.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 40 |
| 大小 | 1221 bytes |
| import 数 | 5 |
| export 数 | 1 |
| 分类 | 类实现 |
| **移植难度** | **★★☆☆☆ 2 / 5 —— 容易** |

## 检测到的语言特征

- `any` 类型使用 1 处
- class 定义
- Object.* 反射方法
- 可选链 ?.
- 泛型默认 any
- 可空联合类型

## C++ 移植要点

- `src/LFW/ditto/image/ImageInfo.ts` 包含类实现，需整体设计 C++ 类的所有权、拷贝/移动语义与生命周期。
- 重点处理：getter/setter（→ 访问器或普通方法）、静态可变状态（→ 全局/单例）、Map/Set（→ std::unordered_map/set）、回调（→ std::function / 观察者）。
- 存在 1 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 可空联合类型建议用 `std::optional` / 指针表达。
- Object.* 反射方法需替换为显式代码或序列化框架。
