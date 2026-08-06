# defines/ItrKind.ts

> 源文件: `src/LFW/defines/ItrKind.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 193 |
| 大小 | 4087 bytes |
| import 数 | 0 |
| export 数 | 7 |
| 分类 | 纯函数工具 |
| **移植难度** | **★★☆☆☆ 2.5 / 5 —— 较易** |

## 检测到的语言特征

- `any` 类型使用 3 处
- enum 定义
- type 别名
- 箭头函数/回调
- 空值合并 ??
- 动态属性访问 obj[key]
- 模板字符串

## C++ 移植要点

- `src/LFW/defines/ItrKind.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 3 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- 动态属性访问 `obj[key]` 需改为明确的容器或字段，无法保留 JS 的鸭子类型。
