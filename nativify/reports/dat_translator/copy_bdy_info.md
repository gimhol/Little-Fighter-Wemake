# dat_translator/copy_bdy_info.ts

> 源文件: `src/LFW/dat_translator/copy_bdy_info.ts`

## 基本信息

| 项目 | 值 |
| --- | --- |
| 行数 | 8 |
| 大小 | 209 bytes |
| import 数 | 1 |
| export 数 | 1 |
| 分类 | 纯函数工具 |
| **移植难度** | **★☆☆☆☆ 1.5 / 5 —— 极易** |

## 检测到的语言特征

- `any` 类型使用 1 处
- function 声明
- JSON 序列化
- 展开运算符 ...

## C++ 移植要点

- `src/LFW/dat_translator/copy_bdy_info.ts` 为纯函数工具模块，无类状态，是移植性价比最高的部分。
- 重点处理：泛型参数（TS 泛型→C++ template）、可空参数（→ std::optional）、回调参数（→ std::function）与容器算法（→ std 算法）。
- 存在 1 处 `any`，需逐一推断真实类型或引入 variant/泛型。
- JSON 处理需引入第三方库（nlohmann/json 等）或自定义解析。
- 展开运算符需展开为循环或可变参数模板。
