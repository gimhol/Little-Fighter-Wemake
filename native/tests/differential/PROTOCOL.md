# 差分测试协议

目标：**同一份用例，TS 侧与 C++ 侧输出一致。**

TS 侧必须导入 `src/LFW` 下的**真实实现**（不是副本），C++ 侧是移植版。
任何一处语义偏差都会在文本 diff 里暴露出来。

---

## 0. 结构

```
tests/differential/
  run.mjs                      调度：自动发现 subject，两侧跑同一 case，逐行比对
  subjects/
    trace_util.h               公共工具（Line / hex16 / bits_hex / q_bits / split_ws）
    trace_util.ts
    <subject>.cpp              C++ 侧执行器 → CMake 自动生成 lfw_trace_<subject>.exe
    <subject>.ts               TS 侧执行器（esbuild 现场打包）
  cases/
    <subject>/<case>.txt       一个 subject 一个目录，可放多个 case 文件
```

`run.mjs` 用 `subjects/*.ts` 发现 subject（排除 `trace_util`），
再到 `cases/<subject>/` 找 case。所以**加一个 subject 不需要改 `run.mjs`，也不用改 CMake**。

---

## 1. case 文件（DSL）

### 1.1 通用规则

- `#` 到行尾是注释；空行忽略
- token 之间用任意空白分隔
- 缺省参数两边必须一致（见各 subject 的说明）

### 1.2 subject: `mersenne_twister`

```
seed  <number> [d]                      # mt.reset(seed[, true])；同时输出一行 run
int   <count>                           # 取 count 个原始 32 位整数
float <count>                           # 取 count 个 [0,1) 浮点（已量化到 1/1000）
range <min> <max> <count>               # 取 count 个 [min,max) 内的值
pick  <item> <item> ...                 # 用 items 建数组，pick 一次（不改数组）
take  <item> <item> ...                 # 用 items 建数组，take 一次（会移除元素）
state                                   # 输出当前 MT 状态哈希
mark  <token|"literal">                 # mt.mark = …
debug <0|1>                             # mt.debugging = …
case  <valueLiteral> ...                # mt.case(...)；输出参数个数（记录进 mt_cases）
cases                                   # mt_cases.submit()：整段文本 + submit 后的 cases.length
cinfo                                   # mt_cases 的 name / separator
creset                                  # mt_cases.reset()
pure                                    # mt.pure() 逐字段（matrix/upper/lower/index/seed/times/
                                        #   mt.length/mt[0]/mt[1]/mt[623]/mark）
load  <field> <value> [value]           # 以 mt.pure() 为底改一个字段后 mt.load(info)；
                                        #   输出参数回显 + state 哈希 + mark
pickv <valueLiteral>                    # mt.pick<T>(a)（Value 版）：返回值 + 操作后的 a
takev <valueLiteral>                    # mt.take<T>(a)：同上（会 splice，打印删除后的数组）
```

### 1.3 subject: `math`

镜像 `src/LFW/utils/math/*`。**参数缺省值必须与 TS 完全一致**，否则会假报差异。

```
clamp            <value> <lo> <hi>
clamp_add        <value> <offset> <lo> <hi>
normalize        <n> [<p>]                  # p 缺省 = 1000
float_equal      <x> <y>
equal            <x> <y>
eqgt             <x> <y>
eqlt             <x> <y>
range            <from> <to> [<gap>]        # gap 缺省 = 1
probability      <times> <p>
normalize_plane  <a> <b> <c> <d>
calc_plane       <x1> <y1> <z1> <x2> <y2> <z2> <x3> <y3> <z3>
line_plane       <a> <b> <c> <d> <x1> <y1> <z1> <x2> <y2> <z2> [<is_direction>] [<is_segment>]
project_to_line  <x> <y> <m> <n>
alias_normalize_plane  <a1> <b1> <c1> <d1> <a2> <b2> <c2> <d2>
alias_calc_plane       <18 个数>
alias_line_plane       <20 个数>
```

**`throw` 的映射**：TS 侧 `range` / `project_to_line` 会 `throw`，
C++ 侧返回 `std::optional` 的 `nullopt`。执行器把两者都渲染成 `null`。

**`alias_*` 是干什么的**：`normalize_plane` / `calc_plane` / `line_plane_intersection`
在 TS 里都返回**模块级共享的可变单例对象**。C++ 侧必须镜像这一点（返回 `const Plane*` /
`const Vec3*` 指向文件级 static），否则"先拿引用、再调用一次、回头读第一次的引用"这种
用法会静默出错。`alias_*` 连续调用两次并**同时输出两次捕获到的引用**：

- 若两侧都是共享单例 → 两次输出都等于**第二次**的结果
- 若 C++ 改成按值返回 → 第一次输出会是**第一次**的结果 → 差异暴露

### 1.4 subject: `utils`

镜像 `src/LFW/utils/`（`math/` 之外的部分）。

```
ease_linearity            <factor> [<from>] [<to>]
ease_linearity_backward   <v> [<from>] [<to>]
ease_in_out_sine          <factor> [<from>] [<to>]
ease_in_out_sine_backward <v> [<from>] [<to>]
ease_in_out_quint         <factor> [<from>] [<to>]
ease_in_out_quint_backward <v> [<from>] [<to>]
cross_bounding            <l0> <r0> <t0> <b0> <n0> <f0> <l1> <r1> <t1> <b1> <n1> <f1>
utf8_encode               <u16hex>...
utf8_decode               <bytehex>...
times_new                 [<min>] [<max>]
times_set_range           <a> <b>
times_set_lifes           [<v>]
times_set_min             <v>
times_set_max             <v>
times_set_value           <v>
times_reset
times_reborn
times_state
times_add                 <d>
times_write_nums
times_read_nums           <v> <min> <max> <lifes> <remains>
times_snapshot
times_read_snapshot       <v> <min> <max> <lifes> <remains>
```

缺省值：`<from>` = 0，`<to>` = 1；`times_new` 的 `<min>` = 0、`<max>` = `Number.MAX_SAFE_INTEGER`；
`times_set_lifes` = `-1`。

**名字映射**：TS 把 `backward` 挂在函数对象上（`ease_linearity.backward`），
C++ 侧是独立函数 `ease_linearity_backward`。TS 里 `times.min` / `times.max` /
`times.value` 是 getter+setter，C++ 里是 `min()` / `set_min()`。

**`utf8_encode` / `utf8_decode` 用十六进制 token 传参**，因为需要能表达
孤立代理项（`d83d`）、非法前导字节（`f8` / `ff`）这类 UTF-16 / UTF-8 的边角。
输出是**十进制**的字节值 / UTF-16 code unit 值。

### 1.5 subject: `collections`

镜像 `base/Graves` + `utils/array/*` + `utils/container_help/*`。

```
graves_new
graves_add            <v>
graves_take
graves_l

filter_gt             <t> <x>...
find_gt               <t> <x>...
find_last_gt          <t> <x>...
fisrt_gt              <t> <x>...
last_gt               <t> <x>...
map_no_void_gt        <t> <x>...
intersection          <x>... | <x>...
ensure                [<x>...] | <x>...
loop_offset           <current> <offset> <x>...
make_arr              <size>
map_arr_mul           <k> <x>...
map_arr_scalar        <k> <x>
loop_arr_idx          <x>...
loop_arr_scalar       <x>

nested_set            <k1> <k2> <v>
nested_get            <k1> <k2>
nested_has            <k1> <k2>
nested_del            <k1> <k2>
nested_clear
nested_multi_add      <k1> <k2> <v>
nested_multi_first    <k1> <k2>
nested_multi_has      <k1> <k2>
nested_multi_collect  <k1> <k2>
nested_multi_del      <k1> <k2>
nested_multi_clear
```

**谓词词汇表**：为了避免在 case 里写函数，谓词统一是“大于阈值”：

| 后缀 | 实际谓词 |
|---|---|
| `filter_gt` / `find_gt` / `find_last_gt` | `v => v > t` |
| `fisrt_gt` / `last_gt` | `v => v > t ? v : undefined` |
| `map_no_void_gt` | `v => v > t ? v * 2 : undefined` |

`|` 是两个数组的分隔符。`ensure` 的左侧为空 = output 是 `undefined`；
**右侧不能为空**（TS 的 `item` 是必填项）。

`make_arr` / `map_arr_*` / `loop_arr_*` 用的是恒等 / 乘常数这样的小函数 ——
测的是**辅助函数的机制**（含 `map_arr` / `loop_arr` 的标量分支），不是那个 fn。

---

## 2. 输出 trace

每行一个 token 序列，token 之间**单个空格**，行末**无空格**。
浮点一律输出 **IEEE-754 位模式的 16 位小写十六进制**（不做十进制格式化 ——
格式化本身就会引入差异）。

`null` 表示"无结果"（TS 的 `null` / `undefined` 或 `throw`，C++ 的 `nullopt` / `nullptr`）。

| subject | op | 输出 |
|---|---|---|
| mersenne_twister | `run` | `run <bits16>[ debug=1]` |
| | `state` | `state <hex16>` |
| | `int` | `int <decimal>` |
| | `float` | `float <bits16>` |
| | `range` | `range <bits16min> <bits16max> <bits16result>` |
| | `pick` / `take` | `<op> <bits16\|-> <remaining>` |
| | `mark` / `debug` | `mark <esc>` / `debug <0\|1>` |
| | `case` | `case <参数个数>` |
| | `cases` | `cases <esc(整段文本)> <submit 后的 cases.length>` |
| | `cinfo` | `cinfo <esc(name)> <esc(separator)>` |
| | `pure` | `pure <hex8×3> <index> <bits16seed> <times> <mt.length> <mt[0]/[1]/[623] hex8> <esc(mark)>` |
| | `load` | `load <参数回显…> <hex16state> <esc(mark)>` |
| | `pickv` / `takev` | `<op> <renderValue(返回值)> <renderValue(操作后的参数)>` |
| math | `clamp` `clamp_add` `normalize` | `<op> <bits16>` |
| | `float_equal` `equal` `eqgt` `eqlt` | `<op> <true\|false>` |
| | `range` | `range <count> <bits16>...` 或 `range null` |
| | `probability` | `probability <bits16>` |
| | `normalize_plane` | `normalize_plane <bits16> <bits16> <bits16> <bits16>` |
| | `calc_plane` | `calc_plane <bits16>×4` 或 `calc_plane null` |
| | `line_plane` | `line_plane <bits16>×3` 或 `line_plane null` |
| | `project_to_line` | `project_to_line <bits16> <bits16>` 或 `project_to_line null` |
| | `alias_*` | `<op> <两次捕获到的值依次输出>` |
| utils | `ease_linearity` / `_backward` | `<op> <bits16>` |
| | `ease_in_out_sine` / `_backward` | `<op> <bits16>`（量化） |
| | `ease_in_out_quint` / `_backward` | `<op> <bits16>`（量化） |
| | `cross_bounding` | `cross_bounding <bits16>×6` |
| | `utf8_encode` | `utf8_encode <byteCount> <byteDecimal>...` |
| | `utf8_decode` | `utf8_decode <u16Count> <codeUnitDecimal>...` |
| | `times_*` | `<op> <bits16>×5`（`times_add` 前面多一个 `<true\|false>`） |
| collections | `graves_add` | `graves_add <l.length>` |
| | `graves_take` / `graves_l` | `<op> <bits16\|->...`（`graves_l` 前面多一个长度） |
| | `filter_gt` `map_no_void_gt` `intersection` `ensure` `make_arr` `map_arr_*` `nested_multi_collect` | `<op> <count> <bits16>...` |
| | `find_gt` `find_last_gt` `fisrt_gt` `last_gt` `loop_offset` `nested_get` `nested_multi_first` | `<op> <bits16\|->` |
| | `nested_has` `nested_del` `nested_multi_has` `nested_multi_del` | `<op> <true\|false>` |
| | `loop_arr_idx` `loop_arr_scalar` | `<op> <count> <idxDecimal>...` |

### 2.1 判据：量化后再比（**不是**原始位模式）

**跨语言不要求原始浮点位级相同。** 判据是：

> 经过 `round_float(v)` 之后一致 —— 也就是 `Math.round(v * 1000) / 1000`。

两侧各自调用**自己那份真实实现**：

| | 实现 |
|---|---|
| TS | `src/LFW/utils/math/round_float.ts` |
| C++ | `lfw::round_float()`（`native/lfw/utils/math/round_float.h`） |

理由：`round_float` 是**游戏自己的可观测精度**。两个值量化到同一个格点，
对游戏而言就是同一个值；量化后不同，才是真的不同。
另外 `Math.round` 的半值规则（平局朝 +∞，且 `|x| < 0.5` 返回带符号 0）
本来就与 `std::round` 不同，所以这一步本身也在校验 `js_round`。

**量化只用在需要它的地方**，不是无差别套用：

| 类别 | 判据 | 为什么 |
|---|---|---|
| `mersenne_twister` 的 `float` / `range` 结果 / `pick` / `take` | 量化 | 浮点通道 |
| `mersenne_twister` 的 `int` / `state` / 剩余长度 | **逐位精确** | 整数与内部状态，是最后一道防线 |
| `math` 的 `probability` | 量化 | 内部走 `pow`（libm），跨实现不可保证 |
| `math` 其余全部 | **逐位精确** | 纯 IEEE 算术（`+ - * /`、比较、`std::floor`），精确是可达且是应有的标准 |
| `utils` 的 `ease_in_out_sine` / `_backward` | 量化 | `cos` / `acos` |
| `utils` 的 `ease_in_out_quint` / `_backward` | 量化 | `pow` |
| `utils` 其余全部（含 `ease_linearity` / `cross_bounding` / `utf8_*` / `times_*`） | **逐位精确** | 纯 IEEE 算术或整数 |
| `collections` 全部 | **逐位精确** | 下标 / 计数 / 整数，没有浮点运算 |

`-0` 与 `+0` 位模式不同（`8000000000000000` vs `0000000000000000`），
所以位模式输出顺带锁住了符号零的行为。
`math/scalar` 里刻意放了一批 `-0` 用例。

---

## 3. 状态哈希的字段顺序（**这是协议**）

FNV-1a 64（offset basis `0xcbf29ce484222325`，prime `0x00000100000001b3`）。
每个字段按**小端字节**喂入。

```
u32 matrix
u32 upper_mask
u32 lower_mask
u32 index
f64 seed          ← 注意是 f64，不是 u32（TS 存的是原始 number）
u64 times
u32 mt[0]
...
u32 mt[623]
```

改这个顺序 = **两侧同时改**，否则差分测试会报"状态不同"。
实现：C++ 见 `native/lfw/core/state_hash.{h,cpp}` + `mersenne_twister.cpp`
的 `state_hash()`；TS 见 `subjects/mersenne_twister.ts`。

---

## 4. 怎么跑

```
node native/tools/native.mjs test                 # 全部 subject、全部 case
node native/tools/native.mjs test mersenne_twister
node native/tools/native.mjs test math plane      # subject + case 名
```

产物落在 `native/build/gen/`：

```
trace.<subject>.<case>.cpp.txt    C++ 侧输出
trace.<subject>.<case>.ts.txt     TS 侧输出
```

diff 失败时脚本会打印**第一处不同的行号**与两侧内容 —— 那就是漂移点。

---

## 5. 加一个新的 subject

1. 写 `subjects/<name>.cpp`（`#include "trace_util.h"`）+ `subjects/<name>.ts`
   （`import ... from "./trace_util"`）
2. 建 `cases/<name>/*.txt`
3. `node native/tools/native.mjs build` —— CMake 的 glob 会自动生成 `lfw_trace_<name>.exe`

不用改 `run.mjs`，不用改 `CMakeLists.txt`。

---

## 6. 变异测试（每次加 subject 都该做）

差分测试"通过"本身不证明它有效。**必须故意写错一处，确认能被抓到。**

已验证过的：

| 变异 | 结果 |
|---|---|
| MT `twist()` 的 `x >> 1` 写成 int32 右移 | FAIL，第 7 行（前 5 个输出完全一样 —— 只有 `mt[i]` 最高位为 1 时才显形） |
| MT `next_float()` 加 `+1e-15`（亚量化） | PASS —— 容忍度确实生效 |
| MT 量化格点从 1/1000 改成 1/100 | FAIL，第 10 行（第一个 `float`） |
| `line_plane_intersection` 的 `is_segment` 去掉 eps 容差 | FAIL，第 36 行（`t = -1e-20`，落在 `[-eps, 0)` 内） |
| `utf8.cpp` decode 的 4 字节前导判定 `(b0 & 0xf8) == 0xf0` 放宽成 `b0 >= 0xf0` | FAIL，第 32 行（`f8 80 80 80 80` 本该被跳过） |
| `times.cpp` `set_range` 的 `_value = a` 改成 `_value = _min` | FAIL，第 7 行（`times_set_range 10 5`） |
| `graves.h` `add` 的 `_l[--_i]` 改成 `_l[_i--]` | FAIL（**崩溃**，不是漂移 —— 索引回绕后越界） |
| `nested_map.h` `clear()` 去掉 `kv.second.clear()` | FAIL，第 29 行（回收的内层 map 带着旧键） |

### 6.1 `native/tools/mutate.mjs`

每次手改编译再改回来太容易出错（忘了还原、锚点匹配到多处），所以有了运行器：

```
node native/tools/mutate.mjs native/tests/differential/mutations/<subject>.mjs
```

规格文件 `default export { subject, cases?, mutations: [{ note, file, from, to }] }`。
`cases` 是可选的字符串数组：只跑 `<subject>/<case>` 这几份用例（`test <subject> <case> --reuse-ts`）。
差分里一个 subject 的用例集会越攒越大（`entity` 现在 8 份、`main.txt` 68 KB），而一份变异通常
只有一两份用例看得见 —— 写上 `cases` 把测试那一段从 ~2.0s 压到 ~0.2s（整条 `build` + `test`
从 ~4.5s 到 ~2.8s）。
**不写就照旧跑该 subject 的全部用例**（既有 spec 一行不用改），而不该写 `cases` 的场合是
「这条变异可能被任何一份用例抓到」时。
运行器会：先确认每条 `from` 在目标文件里**恰好出现一次**（否则直接报锚点数并退出，不猜），
跑一次基线确认本来是绿的，然后**逐条**：改 → `build` → `test` → 还原。
编译失败也算 `killed`（说明变异打到了不可编译的地方，不是有效变异，要换）。
结尾统一还原并重建，最后输出 `subject`（含用的哪几份用例）、`N/总数 killed`，有存活就 exit 1。

存活（`SURVIVED`）意味着**用例没有鉴别力**，要补边界用例，而不是放过。

⚠️ Windows 上「应用变异」与「还原」这两次写入紧跟在 `build` 之后，
偶尔会撞上编辑器/索引器的**短暂文件锁**（`EBUSY`/`EPERM`）。
运行器对这两处写入做了 50 × 100ms 的退避重试（`writeWithRetry`），
重试仍失败才会退出。

### 6.2 `json5`（`JSON5.parse`，12 条全杀）

| 变异 | 抓它的用例 |
|---|---|
| `default` 丢 `case '/'`（不进注释） | `p5 "//c\n1"`、`/*c*/1` |
| `peek()` 不合并代理对 | `p5 "{\uD835\uDC00:1}"` |
| `read()` 代理对只前进 1 | `p5 "{\uD835\uDC00:1}"`（键被截断成孤立低代理） |
| `fail_identifier()` 丢 `column -= 5` | `s5 "{\\u0067:1}"`（错误列号 6→1） |
| `escape()` 的 `\0` 后不检查数字 | `p5 "\"\\01\""` |
| `zero` 丢掉 `sign` | `p5 "-0"`（dump 里数字打**位模式**，`-0` 才可分） |
| `value` 把 `+` 当负号 | `p5 "+123"` |
| `string` 引号闭合判断反转 | `p5 "{\"a\":1}"` |
| `afterPropertyValue` 漏 `}` | `p5 "{a:1}"` |
| `hexEscape` 第二位不校验 | `p5 "\"\\x4\""`（补的用例） |
| `unicodeEscape` 少读一位 | `p5 "\"\\u123\""`（补的用例） |
| `identifierNameStartEscape` 不校验码点类别 | `s5 "{\\u0067:1}"`（`g` 不是 ID_Start） |

### 6.3 `json5`（`JSON5.stringify`，12 条全杀）

| 变异 | 抓它的用例 |
|---|---|
| 引号选择反转（`'` ↔ `"`） | `q5 "a"` |
| 不转义选中的引号 | `q5 "a'b\"c"`（1 个 `'`、1 个 `"` → 选 `'`，必须转义） |
| `\0` 后跟数字不特判 | `q5 "a\u00001b"`（该输出 `'a\x001b'`） |
| 空格也被 `\x` 化（`c < ' '` → `c < '!'`） | `q5 "\u0020"` |
| 键的后续字符用 `id_start` 而非 `id_continue` | `w5 "{a1:1}"` |
| 键首字符长度恒为 1（不识别代理对） | `w5 "{\uD835\uDC00:1}"` |
| `cp_at` 不合并代理对 | `w5 "{\uD835\uDC00:1}"` |
| 对象成员漏逗号 | `w5 "{a:1,b:2}"` |
| 冒号后多一个空格 | `w5 "{a:1}"` |
| 字符串值不加引号 | `w5 "{a:'x'}"` |
| 布尔值互换 | `w5 "true"` |
| `null` 序列化成空串 | `w5 "null"` |

`q5` 是"把一段字符串直接 stringify"，`w5` 是"解析再序列化"，`c5` 验循环引用。
**`w5` 顺带覆盖了 `number_to_string`**（`-0` → `0`、`1e21` → `1e+21`、`0x10` → `16`）。

`w5` / `p5` 的第一个 token 之后可以插一个**可选标签**（`w5 <label> <text>`），
两侧都会把它原样打进输出行。真实数据用例（`real_data*.txt`，114 个文件）就靠它定位是哪个文件出问题。

### 6.3.1 真实数据用例

`cases/json5/real_data.txt`（114 个文件，全部 `w5`）与 `real_data_tree.txt`
（<4KB 的 86 个文件，`p5` 逐节点）由 `native/tools/gen_json5_real_data_cases.mjs`
从 `lf2s/**/*.json5` 生成。

⚠ **这类用例要断言"确实解析成功了"**：如果 114 个文件全部报同一个错，两侧当然"一致"，
但测试什么也没验。核对办法：

```powershell
Select-String -Path native\build\gen\trace.json5.real_data.cpp.txt -Pattern ' perr ' -AllMatches
```

应当为 0，且 `ok=` 等于文件数。**任何"批量喂数据"的对拍都要做这一步自检。**

### 6.4 `fields`（19 条全杀）

`fields.ts` 是“字段描述 DSL + 字段表 + 校验”，C++ 侧直接用 `Value`/`Object` 实现
（TS 的 `Map` 用 `Object` 顶替），所以共用同一套值字面量 DSL。
TS 侧用**仓库里真正的** `src/LFW/fields.ts` 当参照。

| 变异 | 抓它的用例 |
|---|---|
| `w()` 的第二个字符串不进 `desc` 分支 | `fw "int" 2 s "T" s "D"` |
| `w()` 的 `desc` 追加改成覆盖 | `fw "int" 3 s "T" s "D" s "E3"` |
| `fields()` 的 `order` 从 1 开始 | 任意 `ff` |
| `fields()` 先补 `key`/`order` 再合并源对象 | `ff o 1 a o 2 key s "old" order n 9` |
| `reorder_fields` 排序方向反向 | `fr o 3 c n 1 a n 2 b n 3 o 3 a…2 b…0 c…1` |
| `order` 为 `undefined` 也算已知字段 | `fr o 2 a n 1 b n 2 o 2 a o 1 order u b o 1 order n 1` |
| 重排时不先清空（`set` 原地更新 ⇒ 序不变） | 任意 `fr` |
| `known` 初始顺序反转（暴露稳定排序） | `fr … order n 1 … order n 1`（相等） |
| `to_array` 只看 `null` 不看 `undefined` | `fa u` |
| `to_array` 对数组返回拷贝 | `fas a 2 n 1 n 2` |
| `Object.assign` 的字符串索引键全取第 0 个 | `ff o 1 a s "x"` |
| `nullable` 不看真值 | `fv o 1 a z o 1 a o 2 type s "int" nullable b 0` |
| `array === 'auto'` 失效 | `fv o 1 a n 1 o 1 a o 2 type s "int" array s "auto"` |
| `array === true` 用真值判定 | `fv o 1 a n 1 o 1 a o 2 type s "int" array s "no"` |
| int 丢掉整数判定 | `fv o 1 a n 1.5 o 1 a o 1 type s "int"` |
| int 的 `min` 用 `<=` | `fv o 1 a n 2 o 1 a o 2 type s "int" min n 2` |
| options 用宽松相等 | `fv o 1 a n 1 o 1 a o 2 type s "int" options a 1 o 1 value s "1"` |
| options 列表里 `undefined` 用 `json_text` | `fv o 1 a n 9 … options a 2 o 1 value n 1 o 2 label s "x" desc s "d"` |
| 未知字段不告警 | 任意带多余键的 `fv` |

**两个真 bug 是用例抓出来的，值得记**：

1. **`Array.prototype.join` 把 `undefined` 变成空串，模板字符串变成 `"undefined"`**。
   `field.options.map(o => JSON.stringify(o.value)).join(', ')` 在某个 option 缺 `value` 时
   产出 `"1, "`，而我第一版复用了同一个 helper 得到 `"1, undefined"`。
   ⇒ **错误消息的文本也在对拍范围内，不是"无关紧要的输出"**。
2. **TS 里 `typeof null === 'object'`**，所以 `w()` 的 `Object.assign` 分支会吃 `null` 与数组
   （数组会把下标变成键 `"0"`/`"1"`），而**字符串走另一个分支**（当 title/desc）。

**三条“TS 会抛异常”的输入不能入对拍**（C++ 无异常）：`reorder_fields(obj, null)`、
`object` 字段缺 `fields` 且值为非空对象、`validate_value` 的 `field` 为 `undefined`。
都记进 `README.md` 的已知偏差表。

### 6.5 `defines`（46 个枚举，6 条全杀）

这个 subject **不需要输入**（`cases/defines/all.txt` 只是占位）：它把全部枚举 dump 出来与 TS 侧对拍。
输出格式：

```
E <EnumName>
F <成员名> <值|"...">        成员（按成员名排序）
R <值> <名字>                数值枚举的反向映射（按值升序，去重）
```

C++ 侧完全由 `lfw/defines/all_enums.h` 的注册表驱动、TS 侧由生成的
`subjects/gen/defines_enums.ts` 清单驱动 —— **两边都没有手抄的枚举名单**。

| 变异 | 结果 |
|---|---|
| 生成的 `BdyKind::Defend = 2000` → `2001` | killed（`F` 行） |
| 生成的 `name_of` 少一个 case | killed（`R` 行少一条） |
| 生成的字符串枚举 `kTeam_8 = u"8"` → `u"9"` | killed（`F` 行） |
| 手写 `HitFlag::Both = Ally \| Enemy` → 再加 `\| Ball` | killed（位组合值错） |
| 手写 `FacingFlag` 的反向映射把 `SameAsBearer` 写成 `SameAsCatcher` | killed（别名「后者胜」语义） |
| 手写 `EntityEnum::Ball` 从 `HitFlag::Ball` 改常量 `31` | killed（跨枚举引用） |

**⚠ 教训**：第一版生成的头里**同时**写了枚举初始值和表里的字面量 ⇒
前 3 条变异**全部存活**（比对的只是那张表）。改成表引用枚举成员后全杀。
⇒ 打变异时如果要用"改值"来验，先确认被改的那处**就是**被比对的那处。

### 6.6 `defines_fields`（34 张字段表，5 条全杀）

不需要输入（`cases/defines_fields/all.txt` 只是占位）：每张表打一行 `T <name> <render>`。
C++ 侧读生成的内嵌 JSON5（`json5_parse`），TS 侧读真正的 `src/LFW/defines/*.ts`。

| 变异 | 结果 |
|---|---|
| 字段表里的 `order` 值改错 | killed |
| `options` 的某个 `value` 改错 | killed |
| 非 ASCII 标题改错（`??比例` → `XX比例`） | killed |
| 整条字段被删掉 | killed |
| 字段 `type` 改错（`float` → `int`） | killed |

这个 subject 的价值有两层：① 验生成器内嵌的数据与 TS 一致；
② 验 `json5_parse` 能原样还原这些真实数据（**非 ASCII + 键序 + 嵌套表**）。

### 6.8 覆盖检查是差分的必需补充

**差分只能比"两边都有"的东西。** 当 C++ 的数据是**生成**出来的、TS 侧的清单也出自同一个生成器时，
生成器漏掉的东西会被两边同时漏掉 —— 差分测试**看不见**。

所以凡是生成的数据，都要配一条**从权威实现出发的独立覆盖检查**：

```
node native/tools/check_defines_coverage.mjs      # 已接进 native.mjs all 的 coverage 步
```

它不走正则，而是**运行时 import 全部 `defines/**/*.ts`**、扫导出、按形状分类，再与 C++ 注册表比对。
这条路径立刻查出一个真漏洞（`export const enum TerrainEnum` 从未被生成，796 → 851 行）。

判断"形状"的规则（避免误报）：

| 形状 | 判据 |
|---|---|
| 字段表 | 名字以 `_fields` 结尾 |
| 数值枚举 | **同时**有 `名→数` 与 `数→名` 两类条目 |
| 文本枚举（待人工确认） | 所有值都是字符串 |
| 标签表 | `*Descriptions` / `*Labels` / `*Names` / `*_LABEL_MAP` / `*_DESC_MAP`，或**键全是数字串且值全是字符串** |
| 别名 | 与前面某个枚举**是同一个对象**（按同一性归组，任一名字被注册即算覆盖） |
| 忽略 | 数组 |

**别名必须按对象同一性归组**，否则 `TE`/`E_Val`/`WT` 这类 `export const X = Enum` 会被误报成缺失。

### 6.9.1 `base`（`NoEmitCallbacks` / `Callbacks` / `FSM`，21 条全杀）

- **自由文本必须用 `esc()` 而不是 `to_ascii()` 渲染。** 溢出告警里有 `U+2014`；
  `to_ascii` 是 `static_cast<char>(c)` ⇒ `0x2014` 被截成 `0x14`，C++ 侧打印成空、TS 侧打印 `—`，
  diff 就停在这一行。这是本轮**唯一**的漂移，改用两侧共用的 `esc()` 后 3127 行全对。
- **等价变异体**：`pending_count()` 的 `_pendings.size() - _head` 改成 `_pendings.size()` **存活**。
  不是用例没鉴别力，而是 `compact()` 在每次 flush 收尾 / 溢出返回前都把 `_head` 归零
  ⇒ flush 之外 `_head` 恒为 0，两种写法等价。换成「`compact()` 后不把 `_head` 归零」就能杀
  （20/21 → 21/21）。
  教训：变异存活先判断**是否等价**，再决定是补用例还是换变异点。
- 时序用例必须显式包含（少一个就会漏）：派发期间的 `add`（新 listener 当次**不得**触发）、
  `once` 在一次 flush 内只触发一次、`del` 后重加排到末尾、溢出告警的复位（第二次溢出要再报一次）、
  `enter` / `leave` 的先后。

### 6.9.2 `defines_runtime`（`Defines` 运行时数据，9 条全杀）

- **序列化保真度也是被测对象**：生成器最初用 `JSON.stringify`，`-0` 变 `0`、`NaN` 变 `null`，
  差分停在第 51 行（`VOID_BG.base.near`）。改成自家 JSON5 序列化（`-0`/`NaN`/`Infinity` 原样）后全对。
- **两侧的「条目顺序」是测试基建，不是数据**：C++ 侧按 `Defines` 名排序、TS 侧把 TOP_LEVEL 放在前，
  造成「第 2 行就漂移」的假象。两侧统一 `sort()` 后，差分才反映真实内容。
- **`parse_value` 的 `s` 是独立 token**：`s"1"` 会报 `bad value literal`，正确写法 `s "1"`。
  这条坑使「空字符串」很久没被真测到——`isind ""` 传的是 2 个引号字符 ⇒ `!== 1` 与 `> 1` 等价，变异存活。
- **「缺失的成员」用存在性表达**，不要让访问器伪造默认值：`num()` 对未知名字回 0 是刻意的
  （真实调用点都传已知名），差分里用 `has`（C++ `find() != nullptr`）表达 `Defines[k] === undefined`。

### 6.9.3 `cond_maker`（17 条全杀；4 个存活者的分析）

- **`_HAS_EXCEPTIONS=0` + 空 `std::function` = 无输出崩溃**：`CondMaker` 的默认 `_term`
  初始为空，调用它抛 `bad_function_call`，在 `_HAS_EXCEPTIONS=0` 下变成 fastfail（退出码
  `0xC0000409`）；而且管道下 stdout 是**块缓冲** ⇒ 连 `printf` 的内容都看不到。
  定位靠直接跑 exe 看退出码。修法：构造时就填入默认格式化器（不能依赖“用之前会设”）。
- **变异存活先分三类**：这次 4 个存活里 3 个是**用例缺口**、1 个是等价变异。
  1. `opok` 的 mask 收窄是**等价**的（`"!"` 只在中途出现，外部观察不到）
     ⇒ 换成「`add` 的允许集合漏掉 `&&`」，立刻可杀。
  2. 「`done` 不再对片段 trim」等价于末尾 trim —— 除非**中段**片段两端有空白。
     补 `add n 1 == n 1` + `and s " a" == s "b"` 后杀死。
  3. `js_trim` 的 U+3000 / U+FEFF 分支没被覆盖 ⇒ 补用例。
  4. 「子错误不再向上传播」没被杀，是因为用例用 `empty` 当“坏运算符”，
     但 `not`/`wrap`/`add` 的运算符是**裸 token** ⇒ `empty` 被当成合法运算符 `"empty"`。
     改用 nullish 操作数才能真正触发子错误。
- 教训：**用例里“构造非法输入”的手段本身也要验证**（先确认它真的非法）。

### 6.9.4 `labels`（15 条全杀）

- **`falsy` 与 `nullish` 回退会给相反结果**：`bdy_kind_name` 用 `if (!ret)`，
  `wpoint_kind_name` 用 `??` ⇒ 前者把 `BdyKind["Normal"]`（=0）当成未命中。
  这是差分第一轮就抳到的真差异（第 88 行）。
- **记忆化是可观察行为**：`get_hit_flag_name` 会把组合名写回源表，而且**键用原始值**。
  只用“多次调用结果一致”无法验证它 ⇒ 在用例里 `dump` 整张表（开头一次、中间一次）
  才能看到表长变化与键的形状。
- **枚举对象的正/反向键都是字符串**：数字枚举 `obj[0]` 与 `obj["0"]` 命中同一键，
  所以 `bd_kind_name("0")` 会得到 `"Normal"`、而 `bdy_kind_name("Normal")` 得到
  `unknown_Normal`（falsy）。用例两边都要写。

### 6.9.5 `dat_helpers`（19 条全杀；两个“假存活”的原因）

- **声明顺序 = 无限递归**：`is_num(const Value&)` 写成 `is_num(*d)` 委托给
  `is_num(double)`，但后者声明在**后面** ⇒ 普通名字查找看不到它 ⇒ `double` 隐式转成
  `Value` ⇒ **自己调自己** ⇒ 爆栈（表现为 `C++ failed` 且无输出）。修法：把 `is_num(double)`
  提到前面。教训：**C++ 重载不要“先写调用方后写被调方”**。
- **“存活”先看是不是等价变异**：
  1. 「`is_positive`/`not_zero_num` 允许 0」存活 —— 因为我在 `take_num_impl` 里把
     `> 0`/`== 0` 又**内联了一遍**，那两个谓词根本没被调。改成调用谓词后立刻可杀。
  2. 「`is_num` 不再要求有限」存活 —— 因为 `is_num(const Value&)` 把检查也**内联了一遍**，
     `is_num(double)` 不可达。改成委托后立刻可杀。
  ⇒ 规律：**同一规则只能写一处**，否则变异打在死代码上，永远杀不掉。
- `toFixed` 不能用 `x * 10^f` 近似：`2.675 * 100` 会被舍成 `267.5`，而精确值是
  `267.4999…` ⇒ 平局判错。用 `std::fma` 的精确残差定平局（见 `DESIGN.md` §4.17）。

### 6.9.6 `next_frame`（17 条全杀）

- **共享常量对象的身份也要对拍**：`Defines.NEXT_FRAME_*` 在 TS 里是**同一个对象**，
  调用方改它会“污染”后续调用。C++ 若返回副本，普通对比看不出差异 ⇒ 用例里先用 `nfmut`
  改写，再重新取一次，看改动是否仍在（两侧一致才过）。
  同理：`NEXT_FRAME_*` 路径**不走** cook（提前 return），所以要有一条
  `nfc n 1000 ...` 证明 costs 对它无效。
- **变异可能写成“编译错误”**：把 `costs->get(id)` 改成 `costs->get(raw)` 时，`raw` 并不在
  那个函数作用域里 ⇒ 报 compile-error。这类变异**不算有效度量**（不是测试抓到的），
  要改成同作用域内可编译的等价改写（如 `js_string_of(*idv)`）。
- **幸存变异先看“用例是不是真的走到了那条分支”**：`edit_next_frame` 只对单对象生效的变异
  幸存，因为我用例把**对象**传了进去，数组分支从未进入。补 `newarrobj`（池里直接放对象数组）后即可杀。

### 6.9.7 `colon_reader`（14 条全杀；一条“转写错”抳出来的真差异）

- **转写/记忆不可靠，差异用权威源码裁决**：我先把 `read()` 的删除语句记成了
  `slice(0, index) + slice(index + match.length)`，于是 C++ 写了“正常”的删除，
  差分报出 `rem` 不同（TS 那边反而**变长**）。没继续猜——直接重读 `ColonValueReader.ts`，
  发现原文是 `slice(0, index) + slice(match.length)`（从头部等长删）⇒ 照抄后 49 行全对。
  ⇒ **不要用“更合理”的行为代替原行为**；“删掉错误”必须删到与原代码逐字一致。
- **等价变异换成可观察的**：`名字后的 \s* 只跳一个空白` 与“跳过整段”不可区分
  （空白数≠1 时两者都失败，=1 时也相同）⇒ 换成“完全不跳空白”，立刻可杀。
- **测试自己的断言也要能区分**：`edit_next_frame`、`\s*` 两次都因为“用例没真正走到那条分支/那个差异”
  而出现假存活。

### 6.9.8 `cookers`（16 条全杀；又一例「后续步骤把差异规整掉」）

- **等价变异的一种形态：后置步骤抹平了差异**。变异把 `cook_bdy` 的 `take` 换成 `get`
  （理论上键的插入位置不同）——但 `cook_bdy` 最后一定会 `reorder_fields` 把键序整体规整，
  于是差异不可见。换成“kind 归一化失效”后即可杀。
  ⇒ 判等价变异时，要往后看**后续步骤是不是会把差异擦掉**。
- **另一种：用例值区分不出两个算子**。`float_scaling_itr` 的 `floor` vs `round` 变异幸存，
  因为 `1.2345 * 10000` 略大于整数（两者同结果）。换成 `0.1235`（乘积略**小于**整数）
  和 `-0.1235` 后立刻可杀。⇒ 选边界值要瞄准**两个算子行为分岔的那个方向**。
- 补一个 `nf n 999` 检查点，专门验证 cook 没有污染 `Defines.NEXT_FRAME_*` 共享常量。

### 6.9.9 `cook_opoint`（追加 16 条，32/32 全杀）

- **后置用例会掩盖前序污染**：`cook_itr` 的“克隆 `caughtact`”变异一开始幸存——
  因为 `p2`（`action:999` + `facing:3`）会经由 `cook_opoint` 往**同一共享常量**
  `Defines.NEXT_FRAME_AUTO` 写 `facing`，恰好把前面的污染覆盖掉。
  ⇒ 共享状态检查点必须放在**可能写入它的第一处用例之前**。
- **“死代码路径”也是等价变异源**：硬编码帧列表 `['50','54','109']` 只能被
  `action` 是数字的路径走到（`action` 先被 `take` 删掉、只在数字分支重建）。
  传字符串 `"109"` 永远触发不到 ⇒ 必须用 `action: -109`（经 `get_next_frame_by_raw_id`
  变成 `id:"109"`）。**写用例前先确认“这条分支真的能到达”**。

### 6.9.10 `make_frame_state`（追加 17 条，49/49 全杀）

- **机制性等价要能说清“破口在哪”**：`foreach` 的对象分支在本仓库里观测等价（见
  DESIGN §4.21），所以 C++ 只写数组路径。但等价是有条件的 ⇒ 必须补一条**反例用例**
  把条件钉住（`bdy` 写成普通对象 `{a:1}` ⇒ 两侧都退化成“取到键字符串、`kind` 为
  `undefined`、跳过”），否则“等价”只是“我没测出来”。
- **强转写的值要快照下来**：`OLD_LouisCastOff` 的 5 个 opoint 是手抄的，差分一次过
  并不代表抄对了——所以变异里同时钉 `x` 的符号、`oid` 的 A/B、以及**字段顺序**
  （把 `x`/`y` 两行换位）。顺序类差异只在 `render` 按插入序输出时可见。

### 6.9.11 `frame_behavior/*`（追加 22 条）

- **链式赋值 `a = b = c = 1` 的副作用顺序是从右往左**（先 `c`）⇒ 对象键的**插入序**由此
  确定，而 `render` 按插入序打印 ⇒ 这是可观测语义，不能“顺手”按书写顺序写。
  （这是第二次栽在“键序可观测”上；第一次是 `Object::set` 对已有键原地更新。）
- **“看着像写反了”的映射不要改**：分发器把 `AngelBlessingStart` 映到 `jan_chaseh_start`、
  `DevilJudgementStart` 映到 `jan_chase_start`。差分一次就确认它是原样行为，
  再补一条“互换即被杀”的变异把这个事实钉住。
- **对象展开（spread）会在字面量中间插键** ⇒ 被展开的函数不能在目标对象上直接调用
  （只能“读回”它的结果再造字面量），否则键序变了。
- DSL 补充：`setarr <id> <key> <v1> <v2> …` 的**每个元素各自**写成 `o <n> <k> <v> …`，
  不要把两个元素合并成 `o 2 …`（那样第二个 `o` 会被当成下一个 key）。

### 6.9.12 `string_matchers`（13 条；先 12/13，补用例后全杀）

- **等价 / 用例缺口要分清，并且要能说出「差异在哪个方向上显形」**：`end_pos` 收在冒号处
  一开始幸存，我先拿 `a:b:c` 当反例——是错的：键回溯后剩下的部分不再构成匹配，两版输出相同。
  真正能区分的是**值里还含 `:`**（`a: b:c` ⇒ 正确版 1 条、变异版 2 条）⇒ 补 `a: b:c` /
  `k: v:w u: 1` 后立刻被杀。与 §6.9.8 的 `floor`/`round` 同源：**反例要瞄准分岔方向**，
  不能只是「看起来更刁钻」。
- **已知等价（没写成变异，写进文档）**：
  - `find_block` 的 `scan = s + 1` 重扫循环：非空 `start` 时，后面若存在 `end`，
    第一个 `start` 一定也能看到它 ⇒ 循环不可观察（写成这样是为了与正则语义逐字对应）；
  - `match_colon_value` 的前导/尾随 `trim()`：匹配器本就会从任意下标起扫，
    trim 与否对「最左匹配 + 全局迭代」的结果无影响 ⇒ 保留只为与源实现一致。
- **「同一规则只写一处」又救了一次**：`trim(start)` / `trim(end)` 原本在 `match_block_once`
  与 `take_blocks` 各写一遍，收敛成 `find_block_trimmed` 后变异点才只有一个。

### 6.9.13 `entity_data`（11 条；先 10/11，补用例后全杀）

- **「样本里放了目标字符」≠「目标字符被测试到了」**：`|` 保留规则的变异幸存，原因不是用例不够
  刁钻，而是含 `|` 的那个样本带了 `hash:""` ⇒ `??` 不回落 ⇒ **根本没走到文件名字符过滤**。
  补一个「无 hash + 文件名含 `|`」的样本后立刻被杀。
  教训：**先确认这条分支真的被走到**（同 §6.9.9 的「死代码路径」，只是这次死在「前置条件把
  分支短路了」）。
- **共享对象的原地修改要两边都能观察**：`make_entity_data` 改的是 ctx 里的 base ⇒ 用例除了打印
  返回值，还要 `dump` 原 ctx；否则「改成改副本」这种变异不会显形。

### 6.9.14 `itr_prefabs`（12 条；先 10/12，定性后全杀）

- **幸存 1：等价变异（后置步骤 erase 差异，第 3 次）**。`remain` 从“名字结尾”开始取、还是从
  “跳过空白后”开始取，在输出上没有差别——因为 `match_colon_value` 自己会 `trim`，而 `remain`
  本身不进输出。⇒ 判等价依旧要往后看：**这个中间值会不会被后续步骤规整掉**。
- **幸存 2：用例缺口**。“块存在且非空、但一个 entry 都没有”走的是 `list.length === 0` 的
  `undefined` 分支；而我的用例里这条被“块 trim 后为空”的**更早**分支挡住了 ⇒ 补 p14 后被杀。
  ⇒ 与 §6.9.13 同一条：**先确认目标分支真的能到达**。

### 6.9.15 `entity_kinds`（19 条全杀；但过程里踩了两个工具坑）

- **用例 DSL 的个数写错会伪装成“崩溃”**：`index o 4` 却只给 3 对键值 ⇒ 解析器错位，
  后续行被当成“第 4 个值”接着吃 ⇒ 症状是 `exit=2`（truncated）与**访问违例**混着出现，
  看起来像代码 bug。我用前缀二分 + 单键探测绕了很久才回到“先验证用例本身”。
  ⇒ **看到“崩了”先跑最小用例**；`o <n>` 要逐个数（这次一口气写错 9 行）。
- **变异锚点必须逐字照抄磁盘文本**：那个文件经过“创建失败 + 定点修补”⇒ 保留了**旧格式**
  （多行 `make_obj`），而我在变异里按**我想写的格式**写锚点 ⇒ 连续两次 `anchor occurs 0 times`。
  ⇒ 已把 `mutate.mjs` 改成**一次性列出所有坏锚点**，不再遇到第一个就退出。

### 6.9.16 `bg_data`（22 条；先 19/22 后全杀）

- **幸存变体必须“对已覆盖的输入真的不同”**：`bmp` 后缀的变异把条件改成“任意位置出现 bmp”
  ⇒ 我的用例里 `MidbmpX.bmp` 末尾**也是** `bmp` ⇒ 两版输出相同 ⇒ 看起来像“用例缺口”，
  实际是**变异方向没被覆盖**。补 `has_bmp_inside.gif`（中间有、结尾不是）后被杀；
  同理“至少 5 字符”的变异需要**恰好 4 字符**的样本（`abmp`）。
  ⇒ 定性时先问：**这个变异在我的输入集合上到底哪一步不同？**
- **前置的 `.trim()` 会把“前提”吃掉**：块内空行的变异幸存，因为 `make_bg_layer` 先对整个块
  `.trim()` ⇒ 块首的空行根本进不了 `split`。改成块**中间**的空行后立刻被杀。

### 6.9.17 `post_process_obj_data`（追加 5 条，16/16 全杀）

- **真值判断里的“空容器”是陷阱**：`ctx.index.groups` 用 `if (… && ctx.index.groups)` ⇒
  空数组**通过**（把 group 设成 `[]`）、`null` / `false` 不通过。用例要两边都写，
  否则“只判 null”的变异会活下来。
- **`as_object` 的 const 重载会咬人**：`Object* p = as_object(v);` 只有当 `v` 是**非 const**
  `Value` 时才给可变指针；声明成 `const Value v` 会拿到 `const Object*` 并编译失败。

### 6.9.18 `ball_bdy`（14 条全杀；含一次“前提条件”事故）

- **又一次“前提条件”**：`ctx.data.id` 被无条件访问 ⇒ TS 在 `data` 缺失时**抛错**，
  而 C++ 把它当成 `undefined` ⇒ 差分直接报 `TS failed`。这类输入要从用例里**剔除**，
  并在 DESIGN 里记成“有意保留的差异”。
- **C++ 端的 API 细节**：`CondMaker` 只有 **`add`**（没有 `add_`），`not_` / `and_` / `or_` 才带后缀。
  照 TS 的 `add(` 写就不会错；我按“成对”习惯写了 `add_`，编译一次报 10 处。

### 6.9 用例 DSL 的两个坑（我踩了 6 次）

值字面量是**前缀记法带个数**：`o <n> <k1> <v1> …`、`a <n> <v1> …`。
个数写错时症状分三种，都要会认：

| 症状 | 含义 |
|---|---|
| `value literal truncated at token i of n` | 个数**写多了**（或整行少了 token） |
| `bad value literal 'x'` | 个数写多了，多出来的位置被当成下一项的 kind |
| `line N: K trailing token(s) after op 'x'` | 个数**写少了**（`fields` subject 专有这个自检） |

三种都会**把整行的 token 逐行打印出来**，所以定位是直接的。
写用例时宁可用 `Select-String -Pattern '^fr '` 把同类行列出来逐个核对个数。

### 1.6 subject: `fields`（`fields.ts`）

TS 侧用**仓库里真正的 `src/LFW/fields.ts`**，C++ 侧是 `lfw/fields.cpp`。
因为描述符本身就是普通对象，所以直接复用值字面量；字段表是 TS 的 `Map`，
C++ 侧用 `Object` 顶替，TS 侧用 `new Map(Object.entries(o))` 还原。

```
fw "<type>" <n> <v1>..<vn>      构造描述符（type 取 string/float/int/boolean/object/map/空串）
ff <obj>                         fields(obj)         → 字段表
fm <map>                         fields_map_2_fields_obj
fr <obj> <map>                   reorder_fields（就地重排）后打印 obj
fa <v>                           to_array
fas <v>                          to_array 是否与原数组同一个引用
fv <data> <map>                  validate_fields → 1 行 ok + 每行 `e <err>` / `w <warn>`
```

`fields` subject 额外有“残留 token”自检：任何 op 解析完后若还有 token 未消费，直接报错
（挡的是“个数写少了”这类静默错误）。

输出统一走 `trace_util` 的 `render_value` / `renderValue`：
`u` / `z` / `b0|b1` / `n<number_to_string>:<16位十六进制位模式>` / `s"..."`（`esc` 转义）/
`[...]` / `{"key":...}`（键按 `Object.keys` 序，TS 的 `Map` 也渲染成 `{}`）。
**同一个 `render*` 两边必须产出完全相同的文本**，所以 `Map` 与 `Object` 的差异在这里被抹平。

### 1.7 切词器曾经在静默地截断参数（重要）

`split_ws` 原来按空白切，**不认引号**。后果：

- `p5 "[1, 2]"` 被切成 `p5` / `"[1,` / `2]"` —— 两侧拿到的是**同一个被截断的**
  参数，所以对拍照样"通过"，只是**根本没测到想测的东西**。
- 改成引号感知后，`json/parse` 的输出行数从 **150 → 157**，说明原来确实有 7 行
  在测残料。（`json5/parse` 也从 304 → 302。）
- 同一处还有 `#` 注释剥离：原来是 `replace(/#.*$/, "")`，引号里的 `#` 也会被砍。现在只在引号外识别。

**教训**：对拍两侧用同一个有缺陷的解析器时，"通过"是假的。
**测试基础设施本身的缺陷不会被对拍发现** —— 只能靠"输出行数/覆盖范围符合预期"来察觉。
所以每次加 subject 时顺手核对一下行数是否合理，是有价值的。

（另外：用例文件里的**真实换行**仍然不可用 —— `readCaseLines` / `std::getline`
先按行切。控制字符一律写成 `\uXXXX` 转义，由 `parse_js_string_literal` 还原。）

`json5` 的 TS 侧参考实现就是 `node_modules/json5` 本身 —— **它是要对齐的真相源，不是待测对象**。
被验的是 `native/lfw/core/json5.cpp` 与它的逐字节一致。

顺带一条：移植 `lib/parse.js` 的 `string` 状态时我"记得"上游允许字符串里出现裸换行，
差点把 `fail_char` 改成放行。查源码才发现**上游就是报错的**（只有 `\u2028`/`\u2029` 放行并 warn）。
**差分测试的价值之一就是阻止你"修"一个不是 bug 的地方。**

倒数第二条值得记：`Graves::add` 的 `_l[_i--]` 会让 `_i` 回绕成 `SIZE_MAX`，
下一次访问直接越界崩掉。**这是我自己写的 bug**，`/W4` 没报，差分测试第 6 行就抓到了。
顺带说明：差分的失败形式有两种 —— “漂移”（能逐行定位）和“崩溃”（只能知道哪一侧挂了），
两者都是有效的失败信号。

**另外两条的教训**：

- `nested_map.h` 的那条最初**没被抓住** —— 因为当时用例里 `clear()` 之后设的键
  正好是之前设过的键，回收的脏 map 被覆写了。补上“`clear()` 后设一个**不同**的键，
  再查旧键应当不存在”才变可区分。**回收池（`Graves`）的 bug 必须用“回收后访问旧键”来抓。**
- 两个变异一起打上去时，二者都报 “C++ failed” 而分不清是谁 —— **变异测试要一个一个来。**

P.S. TS 侧那个 `Times.lifes` 的无限递归（`return this.lifes`）就是在写 `times` subject 时
被执行器直接撞出来的 —— `RangeError: Maximum call stack size exceeded`。

**最后一条值得记一笔**：最初写的边界用例是错的（算出来 `t = 0.5`，离边界很远），
变异**没被抓住**。原因是 `t > 1+eps` 与 `t > 1` 只在 `1 < t <= 1+eps` 时才有区别，
而在 1 附近 double 的间距恰好等于 eps —— **只有 `t = 1.0000000000000002` 一个值可分**。
负侧宽松得多（0 附近是次正规数，`[-eps, 0)` 里有很多 double）。
所以边界用例是**搜出来的，不是猜出来的**。

### 6.9.19 `ball_frame_state`（22 条全杀；本轮抓出两类假通过）

- subject `ball_frame_state`（5 个 op：`fs15` / `fs3000` / `fs3001` / `fs3005` / `fs3006`），
  用例 20 个样本 / **21 行输出**，变异 **22/22 全杀**。
- **假通过一：`set` 会静默吞掉多余 token。** 值字面量个数写少时（`o 2` 写了 3 对）
  解析器**只取前 2 对**就返回，`set` 不检查剩余 token ⇒ 后半段（`behavior` / `bdy` / `actions`）
  **根本没被设置**，而 TS 侧同样被吞 ⇒ 差分“通过”。这一批 8 个幸存变异里有 6 个源于此。
  ⇒ **对策（已落地）**：两个 harness 的 `set` 分支都加了“剩余 token 非空就报错退出”的检查
  （C++：`trailing token(s)`；TS 同样），让计数写错立刻变成硬失败。
- **假通过二：`index` 无人读取。** `index 一律写 0` 变异存活 ⇒ 查证 `ball_bdy.cpp` 与 TS 侧
  都不引用 `ctx.index`（`{...ctx, bdy, index}` 只为了对齐源形状）⇒ 这是**等价变异**，已删除，
  不是用例缺口。判据：先问“它对我已覆盖的输入到底哪一步不同”。
- **真 bug（差分先过、变异杀掉）**：`_3001` 的 itr 分支我写成了宽松 `equals`，
  而 TS 是 `switch (itr.kind)`（严格）。原用例的 itr `kind` 都是数字 0 ⇒ 差分看不见；
  补一个 `kind s "0"`（字符串）的样本后立刻分开。⇒ “严格/宽松”这类点位必须有
  **同值不同类型**的样本，否则差分与变异都看不出区别。
- 覆盖要点：`kind` 用 `n 0` / `s "0"`（宽松命中）/ `n 1` / 缺键；`data.id` 用 `s "212"` /
  `n 212`（宽松命中）/ `s "209"` / `n 209`（严格不命中）/ `s "214"`（special）/ `s "1"`；
  `frame.bdy` 缺键 / `u` / `z` / 数组；itr `kind` 数字与字符串；`behavior` 1 / 10 / 3 / 缺键；
  `_3006` 的 bdy 带与不带已有 `actions`（区分 append 与 replace）。

### 6.9.20 `hit_next_frame`（26 条全杀；锚点两个新坑）

- subject `hit_next_frame`（8 个 op：`drink`/`super_punch`/`punch`/`jump`/`defend`/`weapon_atk`/
  `jump_atk`/`turn_back`），用例 8 个样本 / **15 行输出**，变异 **26/26 全杀**。
- **差分抓到的漂移（唯一一条）**：我漏了字面量的**外层 `B` 键**。
  TS 是 `assign(frame.key_down, { B: { id, wait, facing } })` ⇒ 结果是 `key_down.B` 而不是把
  三个字段直接放到 `key_down` 上。这种“嵌套字面量少了一层”的错误，只要输入里 `key_down` 已存在
  就能看出来 ⇒ 用例必须同时覆盖“已存在 / 不存在 / 空对象 / falsy”四种。
- **变异锚点坑一：行内含多语句。** `{u"id", s(u"210")},` 并不是独立行，它和
  `  return make_arr({make_obj({{` 同在一行 ⇒ 只写这一行当锚点会得到 `anchor occurs 0 times`。
  教训：从文件里**复制**锚点，不要凭印象重打。
- **变异锚点坑二：`.mjs` 里的 `\uXXXX` 会被 JS 先解释。** C++ 源码里中文写作转义序列
  `u"\u8df3..."`，而写进变异文件的模板字符串会被 JS 先变成**真实汉字** ⇒ 与源码不匹配。
  必须写 `\\uXXXX`（双反斜杠）才能匹配源码里的字面转义。
- **`assign` 的范围**：只实现对象源。JS 对 Array/String 源会拷下标键，但 LFW 的真实调用点
  只有 `turn_back` 两处（都是对象字面量）⇒ 未实现，并在 DESIGN §4.31 记录（不是隐性差异）。

### 6.9.21 `parase_indexes`（两个存活教了“测试面归属”）

- subject `parase_indexes`（op `parse`，把整段 dat 文本写成一行字面量：
  `parse s "json5" s "<object>\nid:\s100\s...\n<object_end>"`），用例 18 行，变异 **19/19 全杀**。
- **前两个存活变异都是 `match_hash_end` 的**（改成 `rfind` 取最后一个 `#`、只有 `\r` 才终止捕获）。
  原因不是用例缺样本，而是**测试面错位**：`parase_indexes` 传给 `match_hash_end` 的永远是
  `split_lines` 之后的**单行**，换行/多 `#` 的规则在那里**永不可达** ⇒ 等价变异。
  ⇒ 对策：把这两条变异交给 `string_matchers` subject（那里能直接喂多行文本），并给它的 harness
  加 `hash` op（`hash s "a#b\nc#d"`）；`string_matchers` 用例 35 → **48 行**，变异 **15/15 全杀**。
- 教训：**变异放在哪个 subject 上，取决于哪个 subject 能构造出该分支的前置条件**；
  跟单元调用的工具函数，其边界要在“能被直接调用”的那个 subject 上测。
- 另一个真实收获：`/.dat$/`（通配）与 `endsWith(".dat")`（字面）并存，样本要同时覆盖
  `a.ddat`（只被前者命中）与 `a.doc`（都不命中 ⇒ stage 报错）。
- 工艺：`trim_str`/`js_trim` 这类逐字相同的重复实现必须先合并再写新调用方，
  否则同一规则会有第三份（合并后 `cond_maker`/`bg_data` 差分重跑仍绿）。

### 6.9.22 `cook_frames`（27/27；一次 AV 调试 + 两类归因边界）

- subject `cook_frames`（op `cook`，用例用 `new/set` 构造 `{text, base}`），**20 行全对**，变异 **27/27 全杀**。
- **AV 调试法**：C++ 挂掉且**无任何输出** ⇒ 用 `Get-Content <case> -First N` 截断做二分（每步 4 行）
  定位到具体用例，再用最小样本（拆开可疑的两个分支）分离。本轮根因是
  `frame.hit` 为 **truthy 非对象**（dat 里 `hit:` 后接 `id:` 被 `match_colon_value` 解析成字符串 `"id:"`）
  ⇒ `as_object` 得 nullptr 后解引用。TS 在同样输入下抛 TypeError（属“前提不满足”），
  C++ 改为跳过并写入 DESIGN §4.33（有意差异，不写进用例）。
- **差分抓到的真差异**：`base.files` 缺失时 TS 用解构默认值 `{}`，我给了 undefined。
  注意：**解构默认值只在属性为 undefined 时生效，对象本身为 undefined 会直接抛** ⇒
  `base` 必须由用例显式提供。
- **归因边界样本**（先问“它对哪个输入才会不同”）：
  - `content ≥ 1` 的边界需要“`\s+`(2nd) 之后的第一个字符紧接 `<frame_end>`”
    ⇒ `<frame> id x<frame_end>`（name 空、content 1 字符）；
  - `zero_as` 分支需要 `next: 0`；
  - `not_zero_num` 分支需要**非数字真值**（`dvy: abc` ⇒ `to_num` 回退成字符串）。
- 无效变异提醒：把 `row` 改成 `col` 会**编译失败**（作用域外）——那不是有效度量，要换成可编译的等价破坏。

### 6.9.23 `make_ball_special`（24/24；前提条件与锚点缩进）

- subject `make_ball_special`（op `ball`），**17 行全对**，变异 **24/24 全杀**。
- **前提条件（TS 会抛错，样本必须提供）**：
  - `id` 为 `JanChase`/`FirzenChasef`/`FirzenChasei` 时必须给 `base.hit_sounds`；
  - `id` 为 `JanChase`/`JanChaseh` 时必须给 `frames['50'/'51'/'52']`（**全部三支**，代码无条件访问）；
  - 这类崩在差分里表现为 `TS failed` + `TypeError: Cannot read properties of undefined`。
- **锚点缩进要从文件里复制**：chase 组内的 `for` 是 **4 空格**、其内部是 **6/8 空格**；
  我按 8/10 写锚点直接 0 次匹配（上一轮也踩了同类的“锚点行含多语句”）。
- **嵌套锚点要分两次调用**：若一条变异的 `from` 是另一条的**子串**，同一次 `multi_replace` 里
  先执行的替换会让后面的锚点失效（本轮 `invisible`/`invulnerable` 两条就是这种关系）。
- 杂项：首行 `const Value item = make_obj({{u"oid", ...` 与后续对齐行要一起写进锚点，
  否则以 `{u"oid"...}` 开头的锚点匹配不到。

### 6.9.24 `make_weapon_special`（29/29；"少字段"也是 bug）

- subject `make_weapon_special`（op `wsp`；另外用 `piece <name>` / `pmut <name> <idx> <literal>`
  直接验证 `broken_piece_frames` 的**共享性**：改一次再读应看到同一个数组被改），**42 行全对**，变异 **29/29 全杀**。
- **差分抓到的真 bug（不崩，只是少字段）**：`as_object(make_aa(idx))` 传入**临时** `Value`，
  临时析构 ⇒ `Object` 被释放（`make_shared` 计数归零）⇒ 悬垂 ⇒ 表现为“`aa` 展开的 `dvy`/`dvx` 全没了”。
  ⇒ **少字段也要当 bug 查**，别只看崩溃。修法：先存局部变量再取指针。
- **前提条件**：`data.base` 必须存在（TS 无条件访问 `data.base.group` / `data.base.type`）
  ⇒ 每个样本都要给 `base`；这类崩在差分里表现为 `TS failed` + `Cannot read properties of undefined`。
- **等价变异提醒**：`delete frame.itr` 对“本来就没有 `itr` 的帧”是 no-op ⇒ 要区分该分支，
  样本必须让那个帧**同时**带 `state = Weapon_Rebounding` 与 `itr`（本轮就是这么补上的）。
- 共享常量：`broken_piece_frames` 的 27 个数组在 JS 里是可变的模块级常量 ⇒ C++ 必须返回
  `static` 的同一实例，否则 `pmut` 那组用例会漏。

### 6.9.25 `make_stage_info_list`（25/25；两条等价变异 + 一条写坏的变异）

- subject `make_stage_info_list`（op `mkstage`，整段 dat 文本写一行字面量），**22 行全对**，变异 **25/25 全杀**。
- **差分抓到的漂移**：只差**键插入序** —— `p.health_up = p.respawn = {...}` 是链式赋值，
  右侧先算 ⇒ `respawn` 先插入。又一次验证“链式赋值从右往左”。
- **等价变异（已删并记录）**：
  1. `collapse_ws_newlines`（`\s+\n+` → `\n`）：它的输出只拿去给 `match_colon_value` 与
     `match_hash_end`，而前者的空白无关结果、后者的结果又会被 `.trim()` 抹平 ⇒ 在当前调用面**不可观察**。
  2. `is_stage_end` 里的 `strict_equals(next, "end")`：删掉后会走 `find` 失败分支，
     而 `"end"` 永远不在 id 列表里 ⇒ 同样为真 ⇒ 等价。
- **写坏的变异**：我为了“取消排序”在前面**又插了一个**恒返回 `false` 的 `stable_sort`，
  但原来的 sort 照旧执行 ⇒ 顺序不变 ⇒ 变异无效（不是幸存，是没生效）。
  ⇒ 要破坏排序就改**比较器本身**（`return av < bv;` → `return false;`）。
- 归因补样本：`bound` 行里的 `music` 需要“同一行同时有 bound 与 music”；
  `nid < 49` 的边界需要 `id: 49`；排序需要乱序输入（30/3/12）。

### 6.9.26 `cook_file_variants` + `frame_editing`（各 13/13；一条不可观察变异）

- subject `cook_file_variants`（op `cfv <id>`）**14 行全对**、`frame_editing`
  （op `kd`/`ht`/`sq`，另有把字面量写进共享 `costs` 的 `set C <key> <literal>`）
  **24 行全对**；两个变异文件各 13 条、**13/13 全杀**。
- **DSL 陷阱（本轮踩了两次，务必记住）**：`o N` 里的 `N` 是**键值对的个数**，
  不是 token 数。`o 2 id s "50"` 会被判为“声明 2 对只给了 1 对” ⇒
  `value literal truncated at token 10 of 9`。正确写法是 `o 1 id s "50"`，
  两组就是 `o 2 id s "50" facing n 1`。
  注意报错信息里的 token 下标由 `parse_value` **先算后判**，偶尔会读到 vector 末尾之外，
  在 Windows 上表现为 `0xC0000005`（而不是干净的 exit 2）⇒ 见到“无输出 + AV”先怀疑字面量计数。
- **两条“第一版没杀掉”的教训**：
  1. `strip_suffix` 取最后一个点：只放一个多点样本没用，因为 `infos[0]` 必须**正好是**那个
     多点文件（`std::sort` 后 `a.b.pb.png` 排在 `a.b.png` 前面）⇒ 样本要构造成
     `a.a.png` / `a.ab.png` / `a.ac.png` / `a.ad.png` 这种“基准自身含两个点且字典序最小”。
  2. gap 间隔不一致：字母必须**连续**（否则中间会 break，`indexes` 长度不够），
     但下标要**跳** ⇒ 插中间干扰项 `abb.png` / `abd.png`（字典序排在 `a.png` 与 `ac.png` 之间，
     且本身不是 `a` + 单字母，不会被 `findIndex` 选中）。
- **`frame_editing` 补样本的归因**：
  - `zero_as` 写成 `repeat`：只有 `id` 为 `"0"` 才可观察 ⇒ `kd f17 s "F" n 0`
    （输出 `{id:"0"}` 而非 `{}`）。
  - `seq` 少写“跳过 falsy”：`u`/`z` 走 else 分支本来就什么都不做 ⇒ **等价**；
    必须用 `n 0`（`is_num` 为真但 falsy）与 `s ""` 才可观察。
  - `seq` 普通分支丢掉旧值：同一键要 `sq` **两次**。
  - 数字 next / 对象 next 的 cook：`sq <id> s "F" n 10`、`set C 50 {mp,hp}` + `sq <id> s "K" {id:"50"}`。
  - `facing` 用宽松相等：样本给 `facing s "2"`（字符串）。
- **一条已删的不可观察变异**：把 `cook_one` 里对象的浅拷贝改成直接用入参 `v`。
  源对象在 DSL 里只能是**内联字面量**（没有“引用 `g_objs` 中对象”的语法），
  就地改写它无法被任何观察点看到 ⇒ 记作**测试缺口**（不是等价变异，生产路径下源对象来自
  帧表、是可达的）⇒ 后续 `make_fighter_data` 的集成用例会从真实数据取源对象，届时可覆盖。
  **后续修正（§6.9.27）**：`make_fighter_data` 落地后确认这条缺口**仍在** —— `FrameEditing`
  的 `nexts` 参数在两个方面都只能是内联字面量（帧表里的引用走的是 `is_str/is_num` 分支），
  所以"对象浅拷贝"这一条目前无法用 DSL 观察；保留为已知缺口。

### 6.9.27 `make_fighter_data`（37/37；两条等价变异）

- subject `make_fighter_data`（op `reset` / `c <key> <literal>` / `f <frameKey> <literal>` /
  `s <frameKey> <subKey> <literal>` / `run`）**38 行全对**，变异 **37/37 全杀**。
- **本轮最大的教训：变异"存活"要先问「这条语句的效果最后可见吗」**。
  Walking/Running 分支会 `delete frames[frame_id]`，看上去写进去的字段都白写了；
  但 `round_trip_frames_map` 持有的是**同一对象**，`make_round_trip_frames` 又会把它重新写回
  `frames` ⇒ `wait`/`dvx`/`dvz` **依然可观察**。前提是同一个 `name` 至少有 **2** 个帧
  （否则 `2*len-2 === 0`，一个副本都不生成）。本轮 3 条"看似等价"的变异就是靠这个维度救回来的。
- **归因要顺着"谁来覆盖它"往下追**：
  1. `next` 的 cook 类型（`"next"` vs `"hit"`）需要 `next` 对象自带 `mp: -5`（只有负值才会被
     `type === "next"` 取反），并且该帧的 `state` **不能**是 Standing/Jump/Walking ——
     否则紧随其后的 `hit_next_frame_turn_back` 会把 `next` 整个换掉，差异被吞掉。
  2. `mp/hp` 互换需要 `mp: 4300` 这种 `hp` 非零的值（`mp` 在 ±1000 内时 `hp` 恒为 0，看不出互换）。
  3. `walking_speedz` 的默认值只能在 `state` **不是** Walking 的帧上观察（否则第三段 switch 会用
     真实值把 `dvz` 覆盖回去）。
- **改完用例一定要重新 `build`**：本轮出现过一次假 drift（`ctrl_x`/`ctrl_z` 键序），实际是
  变异测试还原源码后没有重编译，exe 还是旧的。
- **链式赋值再中一次**：`frame.ctrl_x = frame.ctrl_z = 1` 是 `ctrl_z` 先；而 `case 5~8` 是两条
  独立语句（`ctrl_z` 在前）。同一份代码里两种写法并存，差分直接抓出来。
- **两条等价变异（已删并记录）**：
  1. `cook_file_variants(ret)` 与 `cook_transform_begin_expression_to_hit(ret.frames)` 互换顺序 ——
     一个只碰 `ret.base.files`、另一个只碰 `frames[*].{key_down,key_up,hit,seqs}`，互不干扰，
     且我们的 `cook_file_variants` 不会抛异常 ⇒ 不可观察（TS 里顺序只影响"抛错前完成的工作"）。
  2. `if (tframes.keys().empty()) return;` 改成恒假 —— `cook_marker` 自己会用
     `tframes.get(...) == nullptr` 全部 continue ⇒ 无副作用。
- **`o N` 计数写错本轮又犯了 8 次**（`o 2` 后面给了 3 对之类）。养成习惯：
  写完 `f`/`c`/`s` 行后先数一遍键值对。

- **同一条语句在两条分支上各写了一遍时，一个变异只能覆盖其中一条**：`cook_next_frame_cost(item, "next", …)`
  在 `next` 的**数组**分支和**单值**分支里各出现一次，第一条变异只打数组分支 ⇒ 单值样本救不了它。
  修法是让样本同时覆盖两种形态（`next a 2 …` 与 `next o 3 …`），并**再补一条针对另一分支的变异**。
  这是本轮最后一条幸存（也是唯一一条）真正的归因。### 6.9.28 `obj_dat_to_json`（27/27；一条等价变异）

- subject `obj_dat_to_json`（op `reset` / `t s "..."` 逐行拼数据 / `i <key> <literal>` 设 datIndex /
  `run`，失败时输出 `E <message>` 以便和 TS 的 `throw` 对齐）**14 行全对**，变异 **27/27 全杀**。
- **手写正则时"贪心回溯"的迭代方向常常是等价的，别急着补样本**：`(\S*)\s*:` 里 `\S` 不含空白，
  `\S*` 的长度直接决定下一个字符，所以"`g` 从最长递减"与"从 0 递增"给出**同一个**解。
  本轮先把它当成用例缺口，推导后确认是等价变异并删掉。
- **规则有优先级，前一条会吃掉后一条本来能观察的输入**：`key:number`(R4) 永远优先于
  `key:value`(R5) 与 `key number`(R6)，所以 `a 1:2` 观察不到 R5/R6 的差别；要区分 R5 与 R6，
  必须构造"**有冒号但冒号后不是数字**"的行：`a: b 1`（R5 ⇒ `a = "b"`；R6 ⇒ `b = 1`）。
- **"`\S*` 取到行尾"这种变异必须用同一行里含空格的输入**（`head: a b.bmp`），
  因为 `name: davis` 取到行尾与取到空白前的**结果相同**。
- **前缀判定放宽要用"像前缀但更长"的行观察**：`startsWith(line, "file(")` → `"file"` 需要
  `file_extra 1` 这样的行（原版走 `key number`，变异会被当成第 N 个贴图文件）。
- 字节级陷阱：`PowerShell` 的 `[System.IO.File]::WriteAllLines` 会把整个文件换成 **CRLF**，
  之后 `.mjs` 里的变异锚点（LF）会**全部**失配（本轮报了 20 条 bad anchor）。
  修法：`ReadAllText` + `-replace "`r`n", "`n"` + `WriteAllText`，改完再重新编译验证。
- `utils/string_help.h` 的 `replace_all` 只有**(字符串, char16_t, char16_t)** 版本，
  两个反斜杠 → `/` 这类多字符替换要手写（`make_stage_info_list` 也是这么做的）。
### 6.9.29 `loader_helpers`（23/23；一笔平台差异）

- subject `loader_helpers`（op `b n <1|2>` / `pic|fpic|wp|phase|stage <literal>`）**22 行全对**，
  变异 **23/23 全杀**。覆盖 `make_buring_smoke` + `preprocess_pic`/`preprocess_frame_pic`/
  `preprocess_wpoint` + `preprocess_stage`/`preprocess_stage_phase`。
- **差分抓到一笔真实的平台差异**：`pic o 3 rad u deg n 45 x u` 时 `__sin_r` 在 C++ 与 TS 上
  末位不同（`0.7071067811865476` vs `…75`）。`rad = deg*PI/180` 两边完全一致，差的是
  `std::sin` 与 V8 `Math.sin` 的实现 ⇒ **不是移植错误**，用例改用 90° 避开，并在 DESIGN 记录。
  ⇒ 以后凡是走三角函数的用例，选角度要挑"两边精确一致"的点（0°/90° 等）。
- **falsy 判定的跨度容易搞错**：`preprocess_frame_pic` 的 `if (!pic) return pic` 是宽松 falsy
  （`pic z` 要返回 `null` 而不是 `undefined`）；而 `preprocess_pic` 里的 `typeof x === "number"`
  连 `0` 都算数字 ⇒ 不能用 truthy。这两个"松/紧"混在同一个文件里，变异要分别覆盖。
- **`reorder_fields` 的语义**：只重排键表里**存在**的键，不在表里的键保持原相对顺序
  ⇒ 用它来区分"两个键表"的变异，必须让输入里同时有**只在 A 表**和**只在 B 表**的键，
  否则两表结果一样（本轮 `stage`/`phase` 的"用错键表"两条变异就是这么才被杀掉的）。
- `defines::find("OID.BrokenWeapon")` **取不到**（注册表里没有该前缀）⇒ 直接用 `oid::kBrokenWeapon`。
### 6.9.30 `loader_more`（29/29；三条靠"改输入顺序/改 falsy 种类"救回来）

- subject `loader_more`（op `bf` / `bg` / `rp` / `rpm`）**25 行全对**，变异 **29/29 全杀**。
  覆盖 `preprocess_ball_frame` + `preprocess_bg_data` + `resolve_prefab`。
- **变异存活先问"我的数据真的触发了那条分支吗"**，本轮连续踩了 3 次：
  1. `kind === JohnShield` 的补充动作**有额外前提**（`frame.on_dead` 为真）⇒ 只给 kind=9
     而不给 `on_dead`，那 4 条变异全都白跑。
  2. `Whirlwind`(15) 与 `Freeze`(16) 是**两个**排除项，用 15 只能杀掉"漏掉 Whirlwind"，
     要另造一个 kind=16 的 itr 才杀得掉"Freeze 写成 Block"。
  3. `cook_ball_frame_state_3005` 与 `_3006` 都只动 `frame.bdy[*].actions` ⇒ 没有 `bdy` 时
     两者输出一样的空 frame ⇒ 分派互换的变异不可观察。**必须给 bdy**。
- **`reorder_fields` 类的变异要靠"输入顺序 ≠ 目标表顺序"观察**：`layers` 里写
  `z, x, w, file` 才能区分 `bg_layer_info_fields` 与 `bg_info_fields`；写成 `file, x, z` 时
  两张表都只命中 `file`，结果完全一样。
- **`!truthy(x)` 与 `is_undefined(x)` 的差别用 falsy 非 undefined 的值观察**：prefab 写 `n 0`
  时前者判为"缺失"、后者会继续展开。
- **`ref ?? prefab_id` 的优先级要用同时带两者的对象**（`ref: "A", prefab_id: "B"`）才可观察。
- **一条真等价变异（已删）**：`res.value = has_base ? spread_assign(base, obj) : obj;` 改成
  无条件 `spread_assign(base, obj)` —— 无 base 时 `base` 是 undefined，`spread_assign` 只复制
  `obj` 的键值 ⇒ **渲染结果完全相同**（对象身份不同但这是不可观察的）。等以后有身份敏感的比较
  （如 `===` 判断）时再考虑恢复这条变异。
- **harness 侧的桩**：`preprocess_bg_data` 在 TS 里要 `lfw.images`，且内部会 `SV.validate` →
  `Ditto.warn/error`，而 `Ditto.error` 在 node 下**不存在** ⇒ TS harness 里给
  `lfwStub = {images:{…}, sounds:{…}}` 并把 `Ditto.warn/error` 打桩成空函数。
  这些都不影响数据，C++ 侧相应逻辑本来就不移植。
### 6.9.31 `indicator_info`（22/22；一条真等价变异）

- subject `indicator_info`（op `cfi <frameLiteral>`）**16 行全对**，变异 **22/22 全杀**。
- **同一个函数里"两种默认值"并存，必须用两个 helper**：`opoint/bpoint/wpoint` 的 `z` 是
  `o.z || 0`（任何 falsy ⇒ 0），而 `cpoint` 的 `x/y/z`、`bdy/itr` 的 `z/l/w/h/x/y` 是解构默认
  （**只有 `undefined` ⇒ 0**，`null`/`""`/`0` 原样留着）。C++ 分别对应
  `or_zero_if_falsy` / `or_zero_if_undefined`。把它们的实现互换，只有**直接写进输出对象**的
  那些字段（`bdy`/`itr`/`bpoint` 的 `z`、`bdy.w` 写空串）才杀得掉 —— 这四个方向的变异都留着。
- **`"w" in pic` 是键存在性判定**：`pic` 存在但没有 `w` 键时会走 `frame.width` 分支；
  去掉这个判定（只判 `pic` 真值）的变异要用"只有 `h` 没有 `w` 的 pic"才杀得掉。
- **`!w || !h` 的"或"改成"与"** 要用"一真一假"的输入（有 `width` 没 `height`）才可观察。
- **一条真等价变异（已删）**：`cpoint` 的 `ox`/`oy` 从 `or_zero_if_undefined` 换成
  `or_zero_if_falsy` —— 这两个值**只**参与 `add`/`sub`（内部 `to_number`），`null` 与 `0`
  数值相同 ⇒ 渲染结果一致。注意同样的替换在 `or_zero_if_undefined` 本体上**是**可观察的。
- 老毛病又犯一次：`o N` 数字数错 ⇒ `parse_value` 越界 ⇒ **无输出 + 退出码 `0xC0000005`**
  （不是干净的 exit 2）⇒ 见到 AV 先数字面量计数。
### 6.9.32 `loader_actions`（33/33；无等价变异）

- subject `loader_actions`（op `bd` / `pa` / `pnf`）**68 行全对**，变异 **33/33 全杀**。
  （3ac 起 `pa` / `pnf` 也会把编译产物剥掉：`preprocess_action` 现在会写 `action.tester`
  （端口存源串），TS 侧一份编译对象 ⇒ 两边都删掉再比；那份 spec 重跑仍 33/33 全杀。）
- **抛出路径也要渲染数据**：三个 op 的输出统一是 `<op> ok|throw <render(value)>`。
  如果抛出不渲染，就分不清"抛在 frames 还是 states" —— `if (!expand_comma_keys(holder))
  return false;` 的传播变异会活下来。渲染之后，"删了原键、新键没建成"这种**部分变更**
  也变成可观察量。
- **整数键重排是最好用的差分锤**：`o 2 1,2 <数组> 3 <数组>` 里 `"1,2"` 是普通字符串键、
  `"3"` 是整数键；展开后 `"1"`、`"2"` 变成整数键 ⇒ `Object.keys` 序从 `["3","1,2"]` 变成
  `["1","2","3"]`。这一条同时盖住了 `traversal` 的快照语义与 `Object::keys()` 的
  "整数升序在前"规则。
- **无逗号的键也必须留在用例里**（让 `a,b` 与 `b` 共存）：`if (ks.size() <= 1) return;`
  改成 `ks.empty()`，只有在"前面的展开已经改过键序、且该键不是整数键"时才可观察
  （删除+重插会把键挪到末尾）。
- **字符串的 `[...s]` 按码点切**：用例写 `s "\ud83d\ude00"`（**不能直接写 emoji**，否则
  `to_ascii` 丢信息）；`esc` 会把代理对逐码元转义成 `\ud83d\ude00`，两侧输出都是纯 ASCII。
- **六种 next-frame 类型要各自一条 `data z` 用例**：只写"类型匹配 + data 正常"的用例，
  删掉某个类型的变异会活下来（此时分派与不分派都返回 `true`）。同类陷阱：`is_sound_type`
  删掉 `V_SOUND` 也要一条 `v_sound data z`。
- **两条等价项没写成变异**：① `sound_path_iterable` 里的 `is_nullish(data)` 是冗余的
  （`field_of` 对 nullish 已经返回 `undefined` ⇒ 后续 `is_str`/`as_array` 同样为假）；
  ② `[...v]` 的"浅拷贝 vs 直接引用"不可观察（`Value` 渲染按值递归）。
### 6.9.33 `bots_build`（50/50；无等价变异）

- subject `bots_build`（op `fr` / `ba <name> [args]` / `bae <name> [args]`）**53 行全对**，
  变异 **50/50 全杀**。
- **写变异能反推出真实移植错**（本轮两条）：① `override_z` 一开始收 `double`，把
  `{...ray_1, z: zable}` 写成了取负后的数字 —— `zable` 是字符串 `"3"` 时 JS 的第二个 ray 里
  `z` 是**字符串**；② `cond.add(EntityVal.MP, '>=', mp)` 的右操作数被写成了 `to_number`
  之后的数字。两条都只在"参数不是数字"时可见 ⇒ 用例里放了 `s "3"` / `s "0"` / `s "5"`。
- **`if (mp > 0) cond.add(...)` 的变异必须配 `bae` 用例**：`expression` 是用
  `mp > 0 ? cond.done() : void 0` 算的，所以"把 `>` 改成 `>=`"在 `ba` 下**不可观察**
  （`cond` 的内容没进输出）；只有 `bae` 的 edit 回调读 `cond.done()` 才看得见 ⇒
  `bae ... n 0` 这类用例是必需的。
- **`min_mp` 缺省值的变异**要用"参数真正缺省"的用例（`ba bot_chasing_action s "q" a 0 u u`），
  只给显式实参的用例杀不掉。
- `zable` 的三个方向：`truthy(zable) && z > 0` → `truthy(zable) && z >= 0` 需要
  **truthy 但数值为 0** 的输入（`s "0"`）；→ `z >= 0`（去掉 truthy）需要 **zable 缺省**。
- `frames` 既要"元素个数"变异也要"键序互换"变异；`range` 是闭区间（`v > to` 才 break），
  "少一个"的变异正好卡在这个坑上。
- **harness 侧**：TS 的 rest 参数必须真展开（`...spreadArg(args, n)`），且
  `IEditBotActionFunc` 要**显式调用并传入 edit 回调** —— 否则 `bae` 与 `ba` 输出相同，
  一整批 edit 相关变异会假活。

### 6.9.34 `bots_data`（37/37；无等价变异）

- subject `bots_data`（op `mb` / `mbf` / `mbs` / `mbd` / `mba`：渲染 `bot` / 先读
  `frames`/`states` 取值器 / `bot.dataset` / `bot.actions`）**20 行全对**，变异 **37/37 全杀**。
- **取值器本身要有用例**：`frames`/`states` 取值器会在字段缺失时**补一个键**，
  只用 `set_frames` 过的角色测不出来 ⇒ 专门给 `hunter`（只调 `set_dataset`）来一条
  `mbf hunter`，`child_object` 的键名变异才杀得掉。
- **整数键**：`set_states([StateEnum.Catching], …)` 的键是 `'' + [9]` = `"9"` ⇒ 整数键，
  按 `Object.keys` 排到字符串键前；`set_frames([...])` 则是 `"0,1,2,3,walking_0,…"` 字符串键。
- **TS 的"对象或函数"两种实参**：C++ 用 `as_action` 重载收口（`Value` 原样 /
  `EditBotActionFunc` 调 `f(nullptr)`），两个方向的变异都要有（丢值 / 不调用）。
- **harness 侧**：TS 的 `m.frames` / `m.states` 要用 `void m.frames` **真的读一次**，
  否则取值器不执行、补键的差异看不见。
- **写角色文件反推出真 bug**：`bot_ball_dfa` 的 `min_x` 默认 120 被 `bot_front_test` 的 0
  覆盖 ⇒ 补 `ba bot_ball_dfa n 25`（只给一个实参）这种用例才暴露；现在构建层的用例里
  也留着 `ba bot_ball_dfa n 25 u n 80` 之外的"只传必需参数"形态。
- 当前 5 个角色里 `jan` 的 edit 是 `(a, c) => { return a }`（恒等）⇒ 这条 edit 路径
  **不可观察**（等价），而 `monk` 的 edit 会改写 `keys` ⇒ 可观察。写变异时要挑对角色。

### 6.9.35 `bots_data` 第二批（87/87；一条真等价变异已换掉）

- 差分从 20 行扩到 **42 行**（新增 davis / jack / justin / louis / mark / sorcerer +
  3 条 `reg`），变异从 37 扩到 **87 条全杀**。
- **注册表要用"显式列 oid"的 op**：`reg 38 11 31 33 36 39 37 6 32 35 34` —— 从用例里读 oid
  列表，两侧各自在**自己的**注册表里查（输出 registry 序过滤后 + 每个 oid 的 `bot.id`）。
  这样绕开了"TS 侧 22 个 vs C++ 侧 11 个角色"的必然差异，又能杀掉"工厂注册到错 oid"
  这类变异（`register_maker(oid::kMark, make_bot_data_davis)` 就靠它杀）。
- **一条真等价变异（已换）**：把 `set_frames(arr({num(39)}))`（整数键）与
  `set_frames(range_array(270,289))`（字符串键）互换 —— `Object.keys` **总是**把整数键排在
  字符串键之前，插入序不影响输出 ⇒ 渲染完全一致。要测"插入序可变"必须换**两条字符串键**的
  `set_frames`（改成了 `frames.punchs` ↔ `range(240,269)`）。
- **"就地改 + 展开"的组合**（`mark` 的 `cancel_d>j`）要注意展开的是**改过之后**的那个对象；
  且 `Array::push_back` 可能让 `at(0)` 失效 ⇒ 先拷一份再 push。
- 数值字面量一律用 `num(...)` 包一层：`Value(39)` 这种写法在 `int` → `double`/`bool`
  两条转换路径上**歧义**，编译不过。
- 三个新 include 是编译期报错逼出来的：`cond_maker.h`（`CondMaker` 不完整类型）、
  `constants.h`（`DESIRE_RATIO_X_4`）、`defines_data.h`（`defines::num`）。
- anchor 写反的教训又来一次：3 条变异的 `from` 写成了"变异后"的样子 ⇒ 报 `anchor occurs 0 times`；
  改 `from`/`to` 时顺手不要把**同一个文件里另一条变异的 to** 当成 from（`num(101)` 那次就是这么错的）。

### 6.9.36 `bots_data` 第三批（130/130）

- 差分 42 → **64 行**，变异 87 → **130 条全杀**（累计 17/22 个角色）。
- **anchor 会因新函数而"撞车"**：新角色大量复用同一句
  `cond.and_(sv(bot_val::kEnemyOutOfRange), u"!=", Value(1.0));`、
  `as_action(bot_ball_dfa(num(150), Value(), num(120), num(800)))`、
  `arr({sv(u"d>a"), sv(u"d>j"), sv(u"d^j"), sv(u"dvj")}))` ⇒ 4 条老变异变成
  `anchor occurs N times`。**只能补上下文消歧**（往前或往后带 1~3 行）。
  其中"往后带"时要注意目标函数是不是文件里**最后一个**（`sorcerer` 就是），
  否则上下文对不上（那次写成 `BotMaker make_bot_data_woody() {` 结果 0 次匹配）。
- 改 `make_bot_data.cpp` 时踩了个自己的坑：`oldString` 里带了
  `BotMaker make_bot_data_bat() {` 但 `newString` 里漏了 ⇒ 函数头被吃掉、并且出现两个
  `register_all_bots`。**大段替换后务必 `Select-String '^BotMaker make_bot_data_'` 核一遍**。
- `select-string` 核完还要注意：CMake 不会拦"声明了没定义"（只在链接期报 `LNK2019`）——
  subject 里引用了还没实现的 `make_bot_data_john` 就会链接失败。

### 6.9.37 `bots_data` 第四批（174/174）

- 差分 64 → **82 行**，变异 130 → **174 条全杀**；**22/22 个角色完成**。
- **`reg` 行只在"顺序"上报漂移，是所有逐 oid 值都对时的典型形态**。不要急着改 C++ 注册顺序，
  先问"TS 侧的注册顺序由谁决定"：`BotMaker.register` 在**模块求值期**跑，故顺序 = `index.ts`
  里 `export *` 的书写顺序（即文件名排序，`rudolf` < `sorcerer`）。
  差分 harness 逐文件 `import` 会把自己的写序强加给 TS ⇒ **必须从 barrel 导入**，
  否则测的是 harness 而不是产品代码。
- `rays_of` 返回 `const_cast` 出来的 `Array*`，`push_ray_with_z(Array*, double)` 因此是非 const 形参；
  写成 `const Array*` 会在编译期报 `C2440`（`const Object*` → `Object*`）。
- `edit_mark_cancel()` 被 `mark` / `firen` / `dennis` **三方共用**，改动它等于同时改三个角色——
  写变异时若锚点落在这里，要确认三者的期望漂移是一起出现的。
- 新角色继续大量复用旧句子（`cond.and_(sv(bot_val::kEnemyOutOfRange), u"!=", Value(1.0));` 等），
  本轮又出现 6 条 `anchor occurs 2/3 times`，同样只能补 1~3 行上下文消歧。

### 6.9.38 `fighters_special`（133/133）

- 差分 **93 行全对**，变异 **133 条全杀**（23 个 `make_fighter_data_*` + 分发器）。
- ⚠️ **`o N` 写小的危害比"崩溃"更隐蔽**：两侧 `parse_value` 都只读 N 对、**静默忽略**剩余 token
  ⇒ 数据没被构造出来，TS 于是抛 `Cannot read properties of undefined`，C++ 静默返回原值，
  差分报出来的是一条看不懂的崩溃行。**给 harness 加「`idx != t.length` 即报错」是必需的自检**，
  否则每写一个用例都要人工逐字核对计数。
- **分发器必须保住"严格字符串"这一点**：`switch (alias_id ?? id)` 里若把非字符串 `to_string()` 化，
  数字 id（`n 38`）会开始命中 —— 用例里 `id n 38` 与 `id s "38"` **成对**写才锁得住。
- **链式赋值 `a = b = c` 的键序**又一次生效（`max_hp, hp, max_mp, mp`）；
  沿用 `cook_frames`/`make_stage_info_list` 的经验，凡是"两个字段同值"就顺手写一例。
- **等价变异（已记录不写）**：`filter(Boolean)` 的 truthy 判定与紧随的 `as_object == nullptr`
  检查结果重合（任何 falsy 值两条路都跳过）⇒ 对那句写变异必然存活，属于测试面缺口而非代码缺口。

### 6.9.39 `translator_tail`（35/35）

- 差分 **63 行全对**，变异 **35 条全杀**；`dat_translator` 顶层**只剩 `xml` 之外的收尾**。
- **重构会打掉变异锚点**：把 `float_scaling_itr` 的函数体提升成共享的 `scale_num_field` 后，
  `cookers.mjs` 里那条打在旧函数体上的变异立刻变成 `bad anchor`。**收口"同一规则两处写"
  时必须同步迁移变异**，否则下一轮跑 `cookers` 会直接失败。迁移后要确认新锚点所在文件
  已被某个 subject 覆盖（这里是 `translator_tail`），否则变异会"合法但永远存活"。
- **等价变异（已记录不写）**：① `decode_lf2_dat` 的 `if (buf.size() <= 123) return;`
  —— 循环从 123 开始，越界自然不迭代 ⇒ 守卫与循环上界冗余；
  ② 给帧上**不存在的键**调 `round_truthy_field`（`cur == nullptr` 直接返回）是空操作。
- **"字段存在"≠"能观察到该字段被处理"**：`ctrl_z n 7` 经 `round_float` 后仍是 `7` ⇒
  "漏掉 ctrl_z"的变异存活。要用 `7.0004` 这类**取整后确实改变**的值，
  与 `cook_frames` 轮"选值要瞄准算子分岔方向"是同一条教训。
- `edit_info` 的数组源分支必须有用例（`a 2 s "x" s "y"` ⇒ 写成整数键 `0`/`1`，
  按 `Object.keys` 排在字符串键之前）。

### 6.9.40 `entity_helpers`（62/62）

- 差分 **153 行全对**（含 `NSlot` 105 项 / `SSlot` 18 项全表），变异 **62 条全杀**。
- **"我写了这个用例"≠"这个分支被执行到了"**（本轮 5 条存活里最典型的一条）：
  "数组匹配用严相等"杀不掉，是因为**前一句的松相等先短路了** —— `[5] == "5"` 经 ToPrimitive
  本来就成立，`array_contains` 根本进不去。要逼出数组分支，`a` 必须**松相等也不等于** `id`
  （`a 2 n 7 n 5` 的 ToPrimitive 是 `"7,5"`）。
  与 `make_entity_data` 轮"样本里放了目标字符 ≠ 测到了那条分支"同类。
- 其余 4 条存活的归因都是"缺边界值"：`FixedLf2` 需要**非默认 direction** 才与 `value` 区分；
  `AccTo` 的 `<=`/`<` 需要 `current == target`；`is_object_data` 要逐个枚举分支都测；
  `is_bg_data` 的松/紧相等需要**非字符串**的值（`["background"]`）。
- **`calc_v` 的 `acc`/`direction` 默认值只对 `undefined` 生效**：`null` 与 `undefined` 结果不同
  （`direction: null` 会让 `value *= null` 得 0；`undefined` 才取默认 1）。C++ 必须用
  `holds_alternative<monostate>` 而不是 `is_nullish`。
- **枚举表要"整表对拍"**：槽位布局这类常量表，只测几个点会漏掉重排/漏项；把
  `NAME=value` 全表打出来对拍，才让"顺序即语义"真正进入测试面。

### 6.9.41 `controller_helpers`（55/55）

- 差分 **102 行全对**，变异 **55 条全杀**（4 个类：双击状态机 / 序列匹配 / 按键时长 / 7 槽映射）。
- **第三种等价变异形态：与后继操作交换**。`arr.indexOf(expected)` 取**首匹配**还是**末匹配**
  不影响结果 —— `splice` 只删一个匹配项，剩下的多重集相同，后续匹配自然相同。
  （前两种是"冗余守卫/后置步骤抹平"与"死代码"。）判等价时要看这条语句的**结果集**是否被
  后继操作抹平，而不是看它"看起来有没有语义"。
- **常量表要逐个条目都摸一遍**：7 槽映射只按了 3 个槽 ⇒ 漏掉的槽上的变异不可达。
  与 `is_object_data` 漏掉 Ball 分支、`is_bg_data` 只测字符串值同类。
- **状态机的用例要按"状态转移图"来写**：`reset` 漏清 `used` 杀不掉，是因为 `reset` 出现在
  `used=b1` 那次 `load` **之前**；`hit` 漏清 `used` 杀不掉，是因为前一句 `reset` 已经清零。
  ⇒ 每条"清理/赋值"语句的前置状态必须**真的非默认**，否则该语句不可观察。
- harness 参数序统一为 `<sub> <name> ...`（`dc new a s "d"`），字符串参数一律走值字面量
  （与 `dc`/`ks` 一致），避免"裸 token vs 值字面量"两套解析混用。

### 6.9.42 `bot_helpers`（差分 201 行，变异 99/99 全杀）

- op：`de`（DummyEnum 整表 + `dummy_updaters` 键集）/ `ent`（实体注册表 put/del）/
  `dxz`（`manhattan_xz`）/ `ray`（`is_ray_hit`）/ `cl`（`closest`）/ `nt`（`NearestTargets`
  的 new/look/del/sort/clear/snap）。
- **"无 sub 的 op"要在通用 `<sub> <name>` 解析之前分流**：`dxz me a` 只有两个操作数，
  一开始按 `<sub> <name>` 读会读到越界 token（`std::string` 越界构造出空串 ⇒ 报
  `unknown entity ''`，很迷惑）。凡操作数个数与其它 op 不同的 op，一律提前处理。
- **实体注册表必须用插入序容器**（`std::vector<std::pair<...>>` + 线性查找），与 TS 侧 `Map`
  同序；否则 `name_of(值)` 反查在"两个实体值相等"时会给出不同名字（`std::map` 按名字排序）。
- `nt new <name> <max>` 的 `max` 收**值字面量**（`n 3`），与 `defendable` 一致；
  一开始按裸 token 收 ⇒ 用例里的 `n` 会变成多余的 token，被 trailing 自检抓住。
- 每个 op 都打**整表**：`targets=[名字:距离:defendable]` + `ents=[名字…]`（插入序）
  ⇒ `splice` 插到第几格、挤掉的是谁、集合里删掉的是谁，全部可见。
- **`DummyEnum` 有两个成员同值**（`"18"` ×2，TS 源码原样）。字符串枚举没有反向映射，
  `Object.keys` 就是 24 项、**声明序即遍历序** ⇒ 整表逐项对拍才能锁住重排/改名/改值。
  `dummy_updaters` 只对拍**键集**（值为 `undefined` 的那些键也在），且键序走 JS 的
  "整数键优先"规则 ⇒ C++ 侧先建 `Object` 再 `object_keys()`，别手工排序。- **第五种等价变异形态：被紧邻的"对称算子"抹平**。"`manhattan_xz` 的 `dz` 用反了 a/b"
  （`pb.z - pa.z` 代 `pa.z - pb.z`）杀不掉 —— 紧跟着就是 `abs()`，差一个负号完全不可观察。
  与"与后继操作交换"同类但成因不同：那条是**结果集**被抹平，这条是**值落在后续算子的核里**
  （`abs` 的核 = 符号）。写变异前先看下一句是不是 `abs`/平方/取整这类吃掉符号的算子。
- **"默认值写错"必须让两条路径的返回值能区分**：`is_ray_hit` 的 `max_z` 默认 10000 写成 100000
  长时间存活，因为我的越界样本走完 `continue` 之后算出的 `hit` 恰好也是 `false`
  ⇒ 早退分支（返回 `reverse`）与继续分支（返回 `hit`）都渲染成 `b0`。
  要么把 `max_d` 放大到"继续算就是命中"（`max_d n 1000000000` 配 `dz = 20000`），
  要么让 `reverse` 是真值。**两个分支的结果必须分岔，否则整条分支不可观察**。
- **"同一规则的另一种写法"要按算子分岔点选值**：`round` vs `round_float` 用 `3.3335`/`3.3334`
  （`round` 后平手、`round_float` 后有 0.001 的差，一条用例同时锁住"用哪个算子"和"平手保留先到者"）。
- ⚠️ **harness 自检抓到了两次 `o N` 计数错误**（`o 3` 当作两对、`o 4` 实际五对）：
  "解析完 `idx != t.length` 即报错"这条自检在本轮第二次证明是必需的。
- ⚠️ **`mutate.mjs` 的 baseline 检查能立刻暴露"二进制与源码不一致"**：手工恢复源码后忘了
  rebuild，会以 `baseline already failing`（exit 1、无明细）失败 —— 见到这个报错先想
  "是不是刚手工改过源码/mtime"。

### 6.9.43 `collision_helpers`（差分 243 行，变异 99/99 全杀）

- op：`ent put|del`（实体注册表）/ `col mk|del`（用已注册实体拼 collision：attacker/victim
  + itr/bframe/aframe 三个字面量）/ `ds <entity> <key>`（`Entity.dataset`）/
  `ifall` / `armor` / `civ` `<collision>`。
- **无 sub 的 op 必须提前分流**：`ds`/`ifall`/`armor`/`civ` 的操作数个数与 `ent`/`col` 不同，
  按 `<sub> <name>` 读会读到越界 token；C++ 侧越界 `std::string` 构造会直接 AV（no output），
  比报错更难查。**这条规则上轮已写过一次，本轮又踩 ⇒ 新 harness 一律先在 `op` 上分流。**
- **TS stub 要复用产品里的真规则**，不要手抄：`Entity.prototype.dataset` 用
  `Object.getOwnPropertyDescriptor` 取出后 `.call(this, name)`；`weight` / `state` 这两个
  "有逻辑的 getter" 同样挂到 stub 上（其余 `position`/`facing`/`armor`/`hp`/`fall_value`
  是普通字段或直通 getter，直接放字面量即等价）。这样对拍的是**产品实现**而不是 harness 的复述。
- **越界输入要主动排除**：`Entity.dataset` 的链里 `frame`、`world.bg.data`、`world.dataset`
  不是可选链，缺一个 TS 就抛 ⇒ 用例必须给全路径；"TS 抛、C++ 不抛"的输入记为契约外差异。
- **回看输出值确认分支**：本轮 5 条存活全部来自"样本 `position.x` 写成 0"⇒ `diff_x > 0`
  这条分支从未执行。写完用例必须抽查输出（`native/build/gen/trace.<subject>.<case>.ts.txt`），
  确认落在预期分支上。
- 注意 TS 侧 `is_fall` / `is_armor_work` / `calc_itr_velocity` 取的是 `collision` 对象，
  harness 里用 `{ attacker, victim, itr, bframe, aframe }` 一一对上，缺一个 key 就会
  "TS 抛异常" —— 与上面"越界输入"同一条。

### 6.9.44 `summary_helpers`（差分 146 行，变异 57/57 全杀）

- op：`ent put|del`（实体注册表）/ `sm <sub> <mgr> ...`（`new`/`get`/`items`/`release`/`clear`/
  `dmg`/`kill`/`apply`）/ `sg items|get <id>`（模块级单例）/ `su <sub> <mgr> <id> ...`
  （`on`/`set`/`reset`/`rel`/`snap`）。
- **`su` 是"两个名字"的 op**：`su <sub> <mgr> <id>` 的操作数与 `sm`/`ent` 都不同
  ⇒ 必须在通用 `<sub> <name>` 解析**之前**分流（这条本轮第三次踩，已上升为铁律）。
  另外 `su snap|reset|rel` 只有 4 个 token、`su set|on` 有 5+ ⇒ 入口守卫要用 `< 4`。
- **回调要"五类事件各注册一个监听器"**：漏掉哪类，那类 setter 的"缺守卫 / 守卫取反 /
  守卫用严相等"变异就会存活（重复设同值是可观察的唯一方式）。
- **模块级单例要给"数值视图"**：`sg items` 只列 id，看不到 `kill`/`dmg` 的增减
  ⇒ 必须再加 `sg get <id>`；否则 `apply_damage` 的三条分支变异全部存活。
- 结构性怪癖（TS 原样，不是 bug）：`apply_damage` 把击杀记到**单例**上，而伤害记在 `this` 上；
  只有把「命名 manager 的视图」和「单例视图」分别打出来才锁得住。

### 6.9.45 `drink_stiffness`（差分 63 行，变异 44/44 全杀）

- op：`di new|set|load|snap|empty <name|id> ...`（`DrinkInfo` 构造 / 逐字段 setter /
  `from_snapshot` / `to_snapshot` / 三个 `*_empty`）/ `stf <entity> <itr 字面量>`
  （`handle_stiffness`）/ `ent put|del`（实体注册表）。
- **`stf` 的操作数形态是 `stf <entity> <literal>`（2 个）**，与通用 `<sub> <name>` 不同
  ⇒ 必须在通用解析**之前**分流。终于是第四次；`di` 的 `new|load` 后面是**不定长**字段列表，
  但前两个 token 形态与通用解析一致（`di new d1 …`），所以 `di` 可以走通用解析。
- **TS 类字段初始值要逐字搬**：`hp_h_value: number = 0` 等 9 个字段在 C++ 侧必须是
  `Value _x = Value(0.0);`（成员初始化式）而不是 `Value()`（variant 默认是 `monostate`）
  ⇒ 否则 `snap` 少 9 个 `0`。
- **TS 默认参数 ≠ `??`**：`new Times(0, info.hp_h_ticks)` 对 `undefined` 吃默认
  `Times.MAX`，对 `null` 走 `Number(null) = 0`。用例里要同时有 `z`（`null`）与
  省略该键（`undefined`）两种输入，才锁得住 `ticks_bound`。
- **`A || B` 的变异需要两侧都"可单独决定结果"**：`mp_h_empty` 的 `>=` 被第二个
  `||` 项掩盖 ⇒ 必须给一条 `mp_h_value` 为**真值**且 `mp_h` 落在
  `hp_h_total` 与 `mp_h_total` **之间**的用例。
- `handle_stiffness` 的 `shaking` 回退**只**读 `attacker.world.dataset.itr_shaking`
  （不走 `entity_dataset`），而 `motionless` 走四级回退 ⇒ 实体样例要能区分"只有 world 级有值"
  （`shk`）与"连 world 级都没有"（`nsw`，期望 `undefined` 而非继续外扩）。

### 6.9.46 `mt_random`（差分 143 行，变异 55/55 全杀）

- op：`mt new <name> <seedLiteral>`（注册一个 `MersenneTwister`）/ `ent put|del` /
  `rn new|create <name> <mtToken> <srcLiteral> [<dupLiteral>]` /
  `rn src|get|dump <name>` / `ip spawn <name> <idLiteral>` / `ip table` /
  `ip dvx|dvy|x|y <mtToken> <entName>`。
  `<mtToken>` 是**裸 token**：`-` 表示 `undefined`（⇒ 用静态默认 mt）。
- **`ip table` 只有 2 个 token** ⇒ 必须在通用 `<sub> <name>` 解析**之前**把整个 `ip` 分流
  （铁律第 5 次）。`mt`/`rn`/`ent` 的 token 形状与通用解析一致，不用分流。
- **共享模块不能放 `subjects/` 顶层**：`run.mjs` 的 `readdirSync(SUBJECTS_DIR).filter(f => f.endsWith(".ts"))`
  不递归但会把顶层的每个 `.ts` 都当成 subject ⇒ 放 `subjects/shared/`。
- **要改 `Date.now()` 必须在 `Randoming` 之前求值**：`Randoming.mt = new MersenneTwister(Date.now())`
  是**模块求值期**执行的，所以 patch 模块要在 import 列表里排第一
  （`import "./shared/patch_date"` 在 `import { Randoming } …` 之前，ESM 依赖按 import 顺序求值）。
  这样两侧的默认 mt 种子一致 ⇒ 连"默认通道"的取值也能逐位对拍。
- **不放回抽样 ⇒ n 次覆盖全表**：`Randoming` 的非 duplicate 分支是 `cur.splice(idx,1)`
  ⇒ 连抽 n 次（n = 源数组长度）必然恰好覆盖每个元素一次
  ⇒ 只要在用例里打 9 次 `ip dvx` + 13 次 `ip dvy`，数组里任何单个元素的变异都被杀，
  不必逐条目写用例。
- **`round` vs `floor` 要用非整数半径**：`w/4` 为整数时两者同值
  ⇒ 用 `w = 2 / 10 / -10`（`ip x m1 e4 → n1`，floor 会给 0）。
- **`range(min, max)` 在 `min == max` 时不消耗随机数** ⇒ `ip x`（`w = 0`）之后必须**再抽一次**，
  否则"是否消耗"不可观察。
- **`A || B` 之外的第二类"短路掩盖"**：`if (!is_object(e)) return 0;` 在**缓存赋值之前**
  ⇒ "非实体"不重置模块级缓存 ⇒ 用例要在两次同 mt 的调用**之间**插一次非实体调用，
  才区分得开"短路在前"与"短路在后"（本轮 `ice_piece_dvy` 的守卫就是这样补杀的）。

### 6.9.47 `expression` 加固（差分 928 行，变异 69/69 全杀）

- op：`g <name> <literal>` / `x <name>`（全局取值表）/ `b <源码…>`（构造 + 打印整棵树）/
  `d <idx>`（重放整棵树）/ `r <idx>`（`run(0)`）/ `clr` + `log`（**getter 调用日志**）。
- **求值顺序与短路必须用「getter 调用日志」观察**：只打 `run` 的结果看不出短路有没有生效
  （结果常常一样），而日志能精确给出「哪几个操作数被求值、按什么顺序」。
  `r 0` 只记 `["a"]` 就证明 `a==9&b==2&c==3` 的 and 组短路真的跳过了后两个操作数。
- **每个 `.txt` 是独立进程**：全局表不跨文件共享 ⇒ 新增用例文件要自己把 `g` 再来一遍。
- **节点字段要位精确渲染**：`val_1`/`val_2` 只打类型标签（`vtag`）时，
  「值取错」类变异（取 `word_2` 而不是 `word_1`）只有在类型恰好不同的输入上才被杀
  ⇒ 换成 `render_value`（带 `n<最短串>:<位模式>`）。
- **第 6 形态的等价变异：死代码**。`&`/`|` 分支里去尾 `)` 的 `while` 循环不可达
  （见 `DESIGN.md §4.58` 的推导）⇒ 打在它上面的两条变异永远杀不掉，已删并留下推导。
  判等价不能只看「它有没有语义」，要看**可达性**。
- **冗余守卫**：`if (x === false) continue; x = x && f();` 里那个 `continue` 是多余的
  （`&&` 已经短路）⇒ 删掉它是等价变异；但把条件**取反**是可观察的。
- **TS 构造器遇到多余 `)` 会静默丢弃剩余操作数**（`(A==B))&(C==D)` 只剩 `(A==B)`），
  这是原样行为，C++ 照抄 ⇒ 用例要把它钉住。
- **构建链提速**（`mutate.mjs` 现在会打印 `总耗时 / ms per mutation / 最慢的一条`）：
  - 单条变异 ~9 s → 4.1 s（69 条约 4.6 分钟）。三个固定开销：`vcvars64.bat` 5400 ms/次、
    46 个 exe 全量重链、每条都重跑 TS 打包与 node。
  - `native.mjs build <subject>` ⇒ `--target lfw_trace_<subject>`；
    `native.mjs test <subject> --reuse-ts` ⇒ 复用 `trace.*.ts.txt`（前提：变异只改 `native/lfw/**`，
    `mutate.mjs` 会断言）。
  - 断言失败时先查「有没有残留的 `native/build/mutate-backup/`」—— 有就说明上一次跑被中断了，
    源文件可能还是变异体。
- **`native.mjs` 报的 "N clean / 0 warnings" 不是编译器告警**（那是 `check_lfw_cpp_includes.mjs`
  的纯文本检查）⇒ 编译器告警要自己看构建输出，否则会漏掉 `C4458` 这类。

### 6.9.48 `mersenne_twister` 加固（差分 7614 行，变异 49/49 全杀）

- op：`seed <n>` / `state` / `int <count>` / `float <count>` / `range <min> <max> <count>` /
  `pick <…>` / `take <…>`。
- **`state` 是内部状态的 FNV-1a 64 指纹**（两侧各一份手写实现，逐字段喂字节）：
  `_matrix` / `_upper_mask` / `_lower_mask` / `_index` / `_seed` / `_times` / `_mt[0..623]`。
  它能把"行为等价但内部状态不同"的点位（比如 `_index` 初值 625 vs 624）抓出来。
  ⚠️ 但**打指纹的时机很关键**：要在"刚好设置完"的时刻打 —— 见下条。
- **内部状态字段的指纹要在其刚被设置时打**：`_index` 初值的差异只在**首次抽取之前**可观察
  （首次 `int` 就会 `twist` 并把 `_index` 归零，之后两边完全一致）。
  原用例的 `state` 全打在若干次抽取之后 ⇒ `reset：初始 index 少 1` 存活。
  修法：`seed` 之后**立刻**打一次 `state`。
- **`pick` / `take` 要打印操作后的剩余数组**，否则"删错了哪个下标"不可观察：
  每次调用都在从 token 新建的数组上操作，删对删错只差一个元素，而打印的 `size` 都是少 1。
  顺带要覆盖：空数组（`pick` / `take` 不带参数）、单元素、重复元素。
- **`range(min, max)` 在 `min == max` 时提前返回且不消耗随机数**，返回 `min`
  ⇒ `range(-0, 0)` 的 `-0` 位模式要锁住。用例成对写：`range -0 0 1` + 紧随其后的 `int`
  （同时锁"返回的是 min"与"没有消耗随机数"）。
- **新等价形态：差异小于后继量化步长**。`next_float` 的除数 `2^32` 改成 `2^32-1` 相对差 2.3e-10，
  而 `floor_float` 把结果量化到 1/1000 ⇒ 要可观察得让 `int/2^32*1000` 落在整数下方 2.3e-7 以内
  （即 `int` 恰为 2^29 的倍数）。十来个种子里抽一万次也遇不上 ⇒ 判为不可观察，
  改成测「除数写成 2^31」。
- 「少哈希一个槽」（`for (i < k_N - 1)`）是**证明用例对 `_mt[623]` 敏感**的好变异，值得每种指纹都加一条。
- 快速路径效果：本 subject 的变异只碰一个 `.cpp` ⇒ **2.2 s/条**（49 条 109 s）。

### 6.9.49 `math` 加固（差分 154 行，变异 61/61 全杀）

- op：`clamp` / `clamp_add` / `normalize` / `float_equal`·`equal`·`eqgt`·`eqlt` / `range` /
  `probability` / `normalize_plane` / `calc_plane` / `line_plane` / `project_to_line` /
  `alias_normalize_plane`·`alias_calc_plane`·`alias_line_plane`。
- **`alias_*` 三个 op 是查"共享返回对象"的**：TS 与 C++ 都用**模块级共享 `result`**
  （`normalize_plane` 返回 `Readonly<Result>`、`calc_plane`/`line_plane_intersection` 返回指针，
  都是同一个对象）。连着用两组不同参数调用再一起打印，才能证明"第二次调用把第一次的结果
  覆盖掉了"这种共享语义被照抄了。
- **harness 不要替被测代码补默认值**：`normalize` 原先写死 `normalize(n, 1000)`，让头文件里的
  默认参数永远用不到 ⇒ "默认值写错"的变异存活。改成 2 token 走默认、3 token 显式传。
- **补样本要按"变异点的分岔方向"选参数取值**：
  - `pow(m, 2)` → `pow(m, 3)` 只在 `m ∉ {0, 1}` 时可区分（`pow(1,3)==pow(1,2)`）⇒ 补 `m = 2/3`。
  - `vx = x2` → `vx = x1` 只在 `x1 != x2` 时可区分 ⇒ 补起点≠终点的 `is_direction` 样本。
- **`round_float` 与 `== 0` 的组合会让 `abs` 变冗余**：`round_float(-0.0004)` 是 `-0`，
  `-0 == 0` 为真 ⇒ `round_float(abs(x-y)) == 0` 与 `round_float(x-y) == 0` 等价。
  这类"看起来该有区别"的变异要先算一遍 ±0/NaN 的边界再判等价。
- header 变异（`clamp.h` / `round_float.h` …）会让所有包含者重编译 ⇒ 单条可达 20 s；
  这是正确性换算力，不可省。`.cpp` 变异只要 2 s（单 target 快速路径）。

### 6.9.50 `value` 加固（差分 489 行，变异 71/71 全杀）

- op：`lit` / `arr` / `obj` / `hold` / `get`·`idx` / `elem` / `set`·`str` / `oset`·`oprop` /
  `ohas` / `odel` / `okeys` / `olen` / `eq`·`seq` / `ton` / `tos` / `lt`·`gt`·`le`·`ge`。
- **`hold <value>` 返回一个自增句柄号，且会把它打印出来**。句柄序号是**从文件开头累计**的，
  不是"块内第几个"。我一开始按"块内第 0/1/2"写 `oprop 0 0` …，结果全打到了前面某个空对象上
  （trace 里是一片 `oprop - -` / `ohas false` / `okeys ""`），两个变异因此存活。
  ⇒ **harness 现在支持 `-` 表示"最近一次 `hold`"**（两侧同步），新用例一律用 `-`；
  需要引用更早的句柄时才读 trace 里打印出来的真实序号。
- **`strtol` 在 Windows 上是 32 位 `long`**：20 位的句柄号会饱和到 `INT_MAX` ⇒ 报
  `handle 2147483647 out of range`。句柄是索引，不是数据；数据里的 20 位数字要走字符串 token。
- **想要"同一个值被读两次"的观测**：`okeys`（升序整数键在前、字符串键按插入序）用于钉住键序，
  `olen` 钉住数量，`oprop` / `ohas` 钉住取值与存在性，`odel` 钉住删除结果 —— 这四者缺一不可，
  否则"少删一个键""查错下标"这类变异会被别的输出掩盖。
- 20 位键样本同时钉住 `is_array_index` 的**长度上限**：去掉上限后 `2^64` 溢出成 `0`，
  `okeys` 的表现从 `"18446744073709551616"` 变成 `"0"`。
- `strict_equals` 的 `undefined`/`null` 关系要**左右各测一遍**（`seq u X` 与 `seq X u`），
  否则"只判了一侧"的变异存活。

### 6.9.51 `utils` 加固（差分 321 行，变异 108/108 全杀）

- op：`ease_linearity` / `ease_linearity_backward` / `ease_in_out_sine` / `ease_in_out_sine_backward` /
  `ease_in_out_quint` / `ease_in_out_quint_backward` / `cross_bounding` / `times_*` /
  `utf8_encode` / `utf8_decode` / `chk` / `tonum` / `tonum_or`。
- **⚠ 默认实参必须能在 C++ 侧"用不到"**：`ease_*` 的 `from` / `to` 有默认值，而 harness 原先
  无条件填 `0` / `1`（正好等于默认值）⇒ 头文件里的默认值**永远走不到**，"默认值写错"的变异必存活。
  修法：**按实参个数分派** —— C++ 侧
  `ease_at(tok, [](double a){...;}, [](double a,double b){...;}, [](double a,double b,double c){...;})`
  （用 3 个 lambda 分别绑定 1/2/3 实参重载），TS 侧给缺的形参传 `undefined`（JS 默认值对
  `undefined` 生效，所以 TS 不需要分派层）。**C++ 没有 `undefined`**，这层分派是跨语言共用一份
  用例时必须自己造的。
  - 同一坑的另一处：`Times` 的 `ctor(0, MAX)` / `set_lifes(-1)` / `add(1)` 三个默认值。
  - 用例写法：`ease_linearity 0.5 10`（2 实参）⇒ `to` 用默认值 1 ⇒ 结果 5.5 而不是 0.5。
- **`type_check` / `type_cast` 的观测形状**：
  - `chk <name> <valueliteral>`（name ∈ `is_num` / `is_positive` / `not_zero_num` / `is_int` /
    `is_str` / `is_non_empty_str`）⇒ `chk <name> true|false`。TS 侧一张 `Record<string, fn>` 表，
    C++ 侧 `if/else if` 链，两边都**在名字未知时报错退出**（别默默返回 false）。
  - `tonum <valueliteral>`：TS 走**1 实参重载**返回 `number | undefined`，C++ 走
    `std::optional<double>` ⇒ 有值时打位模式、无值时打 `u`。
  - `tonum_or <valueliteral> <n>`：显式给回落值，专门钉"回落值写错 / 判断的是原值而不是转换结果"。
- 三条**真等价**（已删，理由写在文件头）：
  1. `ease_in_out_quint.backward` 的 `ratio < 0.5` → `<= 0.5`（0.5 处上下两支同值 0.5）。
  2. `Times::_value` 的类内成员初值（构造器里的 `set_range` 会覆盖它，死存储）——
     但 `_lifes` / `_remains` 的初值**不会**被覆盖，是可观测的。
  3. `Times::add` 的 `_remains > 0.0` → `>= 0.0`（能到这行就说明 `!= 0`）。
- **判"某个字段有没有差分覆盖"时先看 harness 有没有读过它**：`Times::is_max` / `is_min` 原先
  从没被任何 op 读过 ⇒ 加 `times_is_max` / `times_is_min` 才可观测。

### 6.9.52 `json` 加固（差分 250 行，变异 76/76 全杀）

- op：`jstr <valueliteral>`（`JSON.stringify`，`undefined` 渲染成 `-`）、
  `jparse "<JSON文本>"`（先打 `ok`/`err`，ok 时再逐层 dump）。
- **`jparse` 的输出行数随内容变**，所以不能再用"用例行数 == 输出行数"来自检空转；
  这里靠"每个语义分支都至少有一条能翻盘的用例"来保证。
- **两条踩到的用例缺口（补样本要沿变异点的分岔方向）**：
  1. **`\uXXXX` 的十六进制有 `0-9` / `a-f` / `A-F` 三段** —— 样本里全是小写与数字时，
     "删掉大写分支"完全不可见。补 `"\u00E9"` / `"\uD83D\uDE00"` / `"\u00aB"` / `"\uABCD"`。
  2. **删除某条检查后别让下游检查兜住它**：`{"a" 1}` 看似是"为冒号检查写的用例"，
     把 `!= u':'` 删掉后它依然 err（跳过空格与 `1` 会撞上 `}`，由"键必须是字符串"兜住）⇒ 空转。
     要构造**跳掉一个字符后恰好拼得出合法文档**的输入：`{"a"9 1}` / `{"a"1 2}`。
- **故意不打的 5 类（构造上不可判别，别浪费跑批时间）**：
  1. `quote()` 的 `(c >> 12) & 0xf` —— 该分支只处理 `c < 0x20`，`c >> 12` 恒为 0。
  2. `str()` 的 `i + 4 > s.size()` → `i + 3 > ...` —— 能过检查又四字符全十六进制的输入不存在。
  3. `digit()` 的 `i < s.size()` → `i <= s.size()` —— `s[size()]` 是 `'\0'`。
  4. `write()` 末行 `if (o == nullptr) return false;` —— 不可达。
  5. 去掉 `++i` / 去掉越界判断 / 递归自调用 —— 死循环或越界读（UB），不是"漂移"。


### 6.9.53 `collections` 加固（差分 194 行，变异 68/68 全杀）

- op 新增：`fisrt_any` / `last_any`（1 实参重载）、`intersection_lt`（显式 `std::less<double>`）、
  `map_arr_nil`（空 / `null` 输入）、`ensure_val <valueliteral> | <valueliteral…>`
  （`Value&` 重载，按项数分派 1 项 / 多项）。
- **四处"harness 没把实参用上 ⇒ 变异不可见"**：
  1. 1 实参的 `fisrt()` / `last()` 此前**没有任何 op**（只有 2 实参版）⇒ `fisrt_any` / `last_any`。
  2. `map_arr` / `loop_arr` 的回调此前只用了第一个实参
     （`[k](double v, auto, const std::vector<double>&) { return v * k; }`）⇒
     **下标写错 / 第三参传空 vector 全部不可见**。改成 `v * k + i * 10 + arr.size()`（两侧同式）。
     注意 `loop_arr` 一直可观测（它本来就把收到的下标打出来），同族两个函数"一个测到一个没测"。
  3. `ensure.h` 的 `Value&` 重载从未被任何 subject 观测（哪怕生产调用点全在它上面）⇒ `ensure_val`。
  4. `intersection` 默认谓词是 `equal_to`，`push_back(c1)` ↔ `push_back(c2)` 在匹配点恒等
     ⇒ 必须显式换谓词（`intersection_lt`）才可分辨。
- **一条真等价**：`nested_map::clear()` 末尾 `_map.clear();` 删掉 —— 内层 map 已被逐个清空，
  残留的空内层 map 让 `get`/`has`/`remove` 一律未命中（与"外层键不存在"同观），
  之后的 `set` 走新建分支还是"已有 k1"分支结果一致，差别只有私有对象池里空 map 的条数 ⇒ 不可观测。
- **不值得打的（构造不可判别 / UB）**：graves 的 `_l[_i--]`、让 `_i` 越界回绕的三种改法、
  `ensure` 模板版守卫取反、`map_arr` 的 `!list.has_value()` 守卫、`loop_offset` 不可达的
  `idx >= len`、对象池回收与 `if (_map.empty()) return;` 的删除 —— 逐条理由见
  `mutations/collections.mjs` 头部第 1–12 条。
- 本 subject 最慢的一批是**头文件**变异（每条都要全量重编译）：6.9 s/变异量级；
  作为对照，`value` 那轮 2.6 s/变异（多为 `.cpp`）。


### 6.9.54 `core` 加固（差分 10969 行，变异 112/112 全杀）

- 用例：`core/js_num` 85→116、`core/to_number` 152→197（`number_to_string` 98 与 fuzz 10558 不动）。
- **三条补样本的通用形态**：
  1. **常量表缺项**：`is_str_white_space` 的 14 个码点里 `\v`(0x000b) / `\f`(0x000c) 从没被用过 ⇒
     补 `"\u000b1"` / `"1\u000c"` 一类样本后 14 条码点变异全杀。
  2. **修正分支只在极窄域生效**：`Math.round` 的 `r - x > 0.5` 要 ≥2^52 的**奇数**才会触发。
  3. **路径门槛**：`parse_radix` 的舍入（`keep/rest/half/sticky`）只在输入 >64 位（`shifted > 0`）时
     才走 ⇒ 60 位的"tie"（`0x40000000000004`）是空转。补 `0x10000000000000800`（half-even 不进位）与
     `0x10000000000000810`（sticky 真 ⇒ 进位到 `2^64+4096`）后 5 条舍入变异全杀。
- **自查工具必须先对拍**：自己写的 `parse_radix` 模拟器在**无 `0x` 前缀**的字符串上用 `from = 2`，
  等于丢了前两位十六进制，据此"搜到"的样本是别的数 ⇒ 两句无效样本、2 条变异假幸存。
  改成"模拟器 vs 真实 exe 逐条比位模式"才发现（注意 `execFileSync` 捕获的 `\r` 会造成假 MISMATCH）。
- **两条真等价**（已删）：`js_to_int32` 的分界 `0x80000000u → 0x7fffffffu`（MSVC 的窄化就是截低 32 位，
  两支恒等）；`parse_radix` 的满位阈值 `64 → 63`（只改移位时机，指数/尾数不变、低位进 sticky ⇒
  判决不变，20 万条随机长输入零差异）。
- 速度：本 subject 全是 `.cpp`，2.4 s/变异（每条都要跑一遍 10558 行 fuzz）。


### 6.9.55 `transform` 加固（差分 339 行，变异 45/45 全杀）

- **新工具 `native/tools/ts_scope.mjs <root.ts>…`**：按"值可达 / 仅类型可达"两类量依赖闭包，按目录汇总，
  并标注 `native/lfw` 是否已有同目录。判断切片顺序、区分"DI 缝（interface-only）"与"真要搬的值代码"
  全靠它 —— 本轮据此把 `ditto/`（值依赖 0）判为按需注入、把 `buff/`（值依赖 315 文件）排到 Entity 之后。
- ops：`new` / `pos` / `scale` / `rot` / `sx|sy|sz|rx|ssx|ssy|ssz`（属性入口）/ `move` / `scale_to` /
  `rotate_to` / `update` / `arrived` / `snap`（打主值 + 目标值 + smoothing）。缺参一律传"未给"
  （C++ `std::nullopt` / TS `undefined`）⇒ 默认值留在被测代码里，可被变异打到。
- 每条 op 的实参个数都过 `check(lo, hi)` 硬校验（多给/少给立刻 exit 2），防止 arg 计数写错静默吞 token。
- **第一次 drift**：`move_to` 的第 4 参在 TS 是对象 `{rate}`、在 C++ 是 `std::optional<double>`，
  harness 起初把裸数字传给 TS ⇒ TS 静默用默认 0.1。此类"两侧形参形状不同"的接口必须在 harness 里显式翻译。
- 两条用例缺口（到达吸附、setter 清 smoothing）见 DESIGN §4.66。


### 6.9.56 `ground` 加固（差分 310 行，变异 58/58 全杀）

- ops：`clear` / `seg <type> <x1> <x2> <z1> <z2> <h1> <h2> [id]` / `base` / `abyss` / `step` /
  `y <idx> <x> <z>` / `segment <x> <z>` / `enterable <idx> <x> <y> <z>` /
  `block <idx> <x> <y> <z> [px] [py] [pz]` / `intersect <6>` / `wall <6>`。
  地形用一个可变 `vector`（C++）与同一个数组对象（TS 桩 `{bg:{data:{terrain}}}`）承载，
  索引越界/多给少给 token 一律 exit 2。
- **三条补样本的通用形态**（本轮 10 个幸存者全部由此消灭）：
  1. **被跳过的对象必须能改变赢家**（同高段的边界样本是空转）。
  2. **镜像几何会命中另一分支**（`x1>x2` 的段上，"左墙"实际走的是 `seg.x1` 分支）。
  3. **阈值要构造"恰好等于"与"恰好跨过"**（`> _step` 需要墙比射线高 >10；`<= _step` 需要表面恰好高出 y1）。
- 一条**真等价**：`intersect_wall` 的 `max_h - min_y <= _step` → `<`。证明见 DESIGN §4.67。
- 观测口径：所有数值走 `num_hex`（NaN → "nan"，其余位模式）；可缺的字符串字段打印成 `-`。
- 顺带记录 `--rank`：`native/tools/ts_scope.mjs --rank <dir>` 按"未移植值闭包行数"排序，
  用它纠正了三处切片误判（`ditto` 是 DI 缝、`buff` 依赖 Entity、`WorldDataset` 并非叶子）。

### 6.9.57 `controller_input` 加固（差分 104 行，变异 72/72 全杀）

新增 subject `controller_input`，观测量来自三族 op：

- `ks <sub>`：`new` / `hit <name> <key> <值|-> <time>` / `end` / `use` / `reset` / `load` / `snap` / `slot` / `flags` / `raw`
- `res <sub>`：`new` / `fire <nf> <time> <keys> <kind>` / `fire2` / `clear` / `snap`
- `gktable <labels|label|agk|conflicts|conflict>`

值字面量一律用带标签写法：`n 5` / `s "x"` / `a 3 …` / `o 2 k v k v` / `u` / `z` / `b 1`。
**`o N` / `a N` 的计数必须与实际元素数一致**，否则解析器会越界读；已在 `trace_util.h` 的 `o` 循环
补边界断言，错误改为显式报错退出。

差分记录：`ControllerResult::fire` 的守卫改为 JS 真值判定（`fire(nf = 0)` 必须失败）。

### 6.9.58 `base_controller` 加固（差分 866 行，变异 133/133 全杀）

harness op：

- `env <sub>`：`hit_dur` / `dbl_int` / `facing` / `alive` / `human` / `bot` / `team` / `pos` / `fstate`，
  以及映射位 `kd` / `ku` / `hf` / `hl` / `pre` / `post` / `seq` / `tpre` / `tpost` / `dpre` / `dpost`
- `ctl <sub>`：`new` / `reset` / 队列 `start` `hold` `end` `db_hit` `click` `dbl_click` `kd` `ku` `ck` /
  `update` / `tst` / `flags` / `dbhit` / `lr|rl|ud|du|jd|dj` / `keys` / `dbs` / `kraw` / `seqtest` /
  `sametest` / `log` / `q` / `envdump`

写用例时必须留意的三件事（都因变异存活才暴露出来）：

1. **判空顺序**：环境里每个映射位都要显式设置；`ctl new` 之后若紧接着发 `env bot 0`，
   「默认非机器人」这条就再也观测不到。
2. **门的独立性**：同拍门（`keys.d.is_hit()`）与顺序门（`_key_list` 长度 ≥ 3）会在同一次 update 里互相吃掉。
   要单测顺序门，必须在映射**尚未挂载**时先建出 `_key_list`，等命中窗口全部过期，再挂映射。
3. **等价类**：`d0.facing != -1 || d1.facing != -1` 这类「双操作数同向」的判定，
   只有**混合朝向**才能让单侧改值产生差异；单侧朝向时两个操作数互相兜住，等于等价。

harness 教训：**会改状态的调用与状态快照不可同处一个表达式**。
`emit("… " + flag(ctl.is_db_hit(k)) + " " + render(ctl.dbc.to_snapshot()))` 在 MSVC 下会先算快照，
把 `step()`（`time = -time`、`data[0] ← data[1]`）的效果吃掉，制造假漂移。必须先取值、再格式化。

### 6.9.59 `collision_handlers` 加固（差分 60 行，变异 30/30 全杀）

harness op：

- `env aid "A"` / `env vid "V"` / `env rest <n>` / `env create_ok <0|1>`
- `env itr <值>` / `env dataset <值>` / `env itr_motionless <值>`
- `run <super|picked|stiff|goto|rest|flute>`

输出为「调用序列 + 落地值」：

```
run flute set_arest:n0 buff_get:magic_flute_to_V:b0 create:magic_flute:magic_flute_to_V:b1 \
  set_attacker:magic_flute_to_V:A set_victim:magic_flute_to_V:V mount:magic_flute_to_V \
  | motionless=b1 shaking=u arest=n0 buffs=n1
```

TS 侧要用**带 setter 的假 Buff**并在 `create_buff` 时把同一个对象放进 `buffs`，
否则第二次取回的是朴素对象，`buf.lifetime = 0` 不会进日志，两侧就对不齐。

### 6.9.60 `buff` 加固（差分 139 行，变异 61/61 全杀）

harness op：

- `env entity <id|@> <0|1>` / `env pos <id> x y z` / `env frame <id> centery height pic_h`
- `env data <值>` / `env create_entity_ok <0|1>` / `env create_buff_ok <0|1>`
- `buff new <id> <kind值>` / `buff use <id>`（切到 grant 出来的 buff，**别名**语义）
- `buff hook <none|update|tick|end>` / `buff oid <s>` / `buff fid <s>`
- `buff level|lifetime|duration|ticks <n>` / `buff attacker_id <s>` / `buff attacker_entity <s>`
- `buff victim|add_victim|del_victim <id>` / `buff del_id <id>` / `buff reset <id>`
- `buff mount|unmount|update <d>` / `buff place_center|show|del_fx <id>` / `buff clear|upd_fx`
- `buff read <快照值>` / `buff snap` / `buff log`
- `grant <kind> <攻击者id> <受害者id> <duration>`

输出 = 「状态字段 + 调用序列」，状态含 `id/lvl/mounted/lifetime/duration/ticks/dead/aid/atk/nfx/victims`。

写用例时的两个陷阱：
1. `update_effects()` 会**先清过期再重建**，所以想打 `show_effect` 的「不校验存活」必须直接调 `show`，
   走 `upd_fx` 会被前面的清理掩盖。
2. `Times.add(d)` 的差异要在**全新 buff**（`_value` 为 0）上打，否则 `add(1)` 也可能正好触顶，
   两侧都触发 hook 而看不出差别。

### 6.9.61 `collision_core`（差分 258 行，变异 72/72 全杀）

harness op：

- `env dataset <值>`（`min_vrest` / `vrest_offset` / `itr_arest`）
- `env a <字段> …` / `env v <字段> …`：
  `id`(裸字面量) `pos`(3 个值) `data_id`(裸字面量) `data_type` `frame` `prefabs` `bear`
  `marks`(0/1) `dropping`(0/1) `arest` `catcher`(0/1) `hurtable` `invul` `bot_ignore`
  `team` `emitter` `spawn` `bot`(0/1)
- `env itr <值>` / `env bdy <值>` / `env ally 0|1` / `env vrest 0|1` / `env dev 0|1`
- `env load_ok 0|1` / `env load_names <数组>` / `env idx <i> <j>` / `env new_id_base`
- `env pool <值>` / `env pool_ok 0|1` / `env pool_handlers <n>`
- `new` / `get` / `test` / `snap` / `snapset <字段> <值>` / `from_snap` / `clone` /
  `slot 0|1` / `state`

约定与陷阱：
1. **裸字面量 vs 值语法**：`env a id "A"`、`snapset aid "A"` 用裸字面量；
   其余值位置（含 `pos` 的每个分量、`snapset` 的每个数字）都要走值语法
   （`n <数>` / `s "串"` / `a <个数> …` / `o <数> <k> <v>…` / `u` / `z` / `b 0|1`）。
2. `env a pos` 与 `data_type` 在两侧都按值语法解析（历史上写成裸数字会直接解析失败）。
3. `__tester` 在真代码里是 `Expression` 实例：`run(c)` 是方法、`debug` **也是方法**，
   且判定是 `if (c.lfw.dev && bdy.__tester.debug) Ditto.Log('bdy.__tester:', bdy.__tester.debug())`
   —— **dev 为真就记录，不看返回值真假**。harness 里 TS 侧把 `__tester` 包成
   `{run, debug()}`，C++ 侧 `tester_run` / `tester_debug` 产生同样的日志；
   TS 侧同时把 `Ditto.Log` 重定向到同一日志（两边都用 `String(x)` 口径渲染）。
4. `get_bounding` 由「假世界」提供：读 `frame.__cube`（6 个数）。
5. 对象池语义：`acquire_collision` 返回带预设字段的新对象（`pool` / `pool_handlers`
   控制），`pool_ok 0` 走 TS 的 `|| {}` 分支。
6. `get` 的观察点：`new`/`get`/`from_snap` 的结果会被写进 `slot`，
   用 `slot 0|1` 切换、`state` 打印；`clone` 会切到另一个 slot，
   于是「一边 `load_handlers` 清空、另一边也变」这种共享语义可以直接看到。

### 6.9.62 `action_handlers`（差分 110 行，变异 70/70 全杀）

harness op：

- `env injury <值>` / `env real_injury <值>`（碰撞体上的两个伤害量）
- `env data_found <值>` / `env no_data`（`lfw.datas.find` 的结果）
- `env ally 0|1`（`attacker.is_ally(victim)` 的结果）
- `env mt_int <n>`（`lfw.mt.int()` 的返回值，用于 `FUSION` 的随机分支）
- `env a|v|e <字段> …`：`hp` `hp_r` `hp_max` `mp` `mp_max` `vel`(速度 x) `face` `team`
  `data` `bot`(0/1，同时影响 `is_bot_ctrl`) `src_emitter` `emitter` `bearer`(0/1) `fuse_bys`
- `act <类型字面量> <动作值>`（类型是**裸 JS 字符串字面量**，动作整体走值语法）

输出：`act <类型> ret=<返回値> || <调用日志> | <状态快照>`；
状态包含双方 hp/hp_r/mp/速度/朝向/队伍、受击方的无敌三连、`fuse_bys`(只印 id)、
`dismiss_data`/`dismiss_time`、双方 bot 标志，以及本动作创建出的 buff 的
`lifetime/duration/level`（`buff=none` 表示没建）。

三条必须注意的假实现约定：
1. `victim.data.type` 是**从 `data` 里取 `type`**，所以用例必须给实体设 `data`，
   不能只设一个独立的「类型」字段。
2. 假 `play_sound(sounds, pos = this.position)` 要带默认参数，才能复刻真 `Entity` 的行为。
3. `grant_buff` 会真的跑起来（C++ 侧用真 `buff::Buff`、TS 侧用假 buff 对象），
   所以 `BuffEnv`/`factory`/`world.buffs` 必须齐备；只有 `create_buff` 这一件事被记录，
   其余 setter 静默 —— 事后用「回读 buff 的 lifetime/duration/level」来观测施放结果。

### 6.9.63 `collision_handlers2`（差分 63 行，变异 49/49 全杀）

harness op：

- `env itr <值>`（`injury` / `arest` / `motionless` / `shaking` / `catchingact` / `caughtact` / `dvx` / `dvz`）
- `env dataset <值>`（碰撞体的 dataset，给 `handle_rest`/`handle_stiffness` 用；
  `handle_injury` 的恢复率另见 `env recov`）
- `env rest <值>` / `env recov <值>`（`world.dataset.hp_recoverability`）
- `env vel <值>` / `env velz <值>`：**仅 C++ 侧**注入 `calc_itr_velocity` 的 x/z 分量；
  TS 侧是真算，所以这两个 op 在 TS 侧只做占位消费
- `env a|v <字段> <值>`：`hp` `hp_r` `type`(决定 `is_fighter`) `weight` `fall` `fall_max`
  `defend` `defend_max` `resting` `catch_max` `catching`(0/1) `catcher`(0/1) `marks`(0/1)
  `elec_dur` `itr_fall` `hit_sounds` `motionless` `src_emitter` `ice` `state` `face` `dataset`
- `run injury [scale] [keep]` / `run catch` / `run freeze` / `run efreeze` / `run shield`

输出：`run <名字> || <调用日志> | <状态>`；状态含双方 hp/hp_r/fall/defend/resting/toughness/
catch_time/catching/catcher/shaking/motionless/速度，以及碰撞体的 `inj/inj_r/rinj/rinj_r`
和本次创建的 buff（`lifetime/duration/level`）。

三条假实现约定：
1. 假实体的 `dataset(key)` 要把 `electrify_duration` 映射到用例的 `elec_dur`，
   `world.dataset` 要是「用例 dataset + `hp_recoverability`」的合并视图。
2. `data` 要按实体返回各自的 `type`（默认 8=Fighter），`indexes.ice` 与 `base.hit_sounds`
   也从用例取值。
3. `summary_mgr.apply_damage` 与 `Ditto.warn` 都被重定向到同一日志；
   日志里实体一律用 `A:`/`V:` 前缀。
### 6.9.64 `collision_handlers3`（差分 267 行，变异 78/78 全杀）

harness op：

- `env itr <值>`（`bdefend` / `injury` / `fall` / `motionless` / `shaking`）
- `env dataset <值>`：碰撞体 dataset，供 `handle_rest` / `handle_stiffness` 与护甲的世界级兜底
- `env rest <值>` / `env recov <值>` / `env itr_motionless <值>` / `env armorwork 0|1`
- `env acube <值>` / `env bcube <值>`：`{left,right,bottom,top,near,far}`。假 `spark_point`
  固定取 `(a.left, b.right, a.top)`，两侧同式，用来捕捉「两个 cube 写反」的变异
- `env a|v <字段> <值>`：**一行只允许一个字段，出现多余 token 直接报错退出**。
  字段：`hp` `hp_r` `tough` `tough_max` `velx` `vely` `velz` `posx` `posy` `posz` `team`
  `state` `base_type` `bearer`(0/1) `type`(8/16/32) `armor` `in_the_sky` `hit_sounds`
  `itr_fall` `dataset` `ice` `marks`(0/1) `elec_dur` `src_emitter` `motionless` `fall`
  `fall_max` `defend` `defend_max` `resting` `catch_max` `catching` `catcher`
- `run whirlwind` / `run ballhit_a` / `run ballhit_b` / `run armor`

输出：`run <名字> || <调用日志> | <状态>`。日志含实体动作（统一 `A:` / `V:` 前缀）、
`spark:x:y:z:类型`、`snd:类型:x:y:z`，以及只有 `armor` 才有的 `ret:0|1`；状态含双方
hp/hp_r/tough/tough_max/速度/team/state/motionless/shaking 与碰撞体的 `inj/inj_r/rinj/rinj_r`，
外加本次施放的 buff 的 `lifetime/duration/level`。

三条约定：
1. **`env armorwork` 是 `is_armor_work()` 的替身**。TS 侧真函数由 `bframe.state` 驱动，
   harness 把 `armorwork 0` 映射成 `bframe.state = Injured`，因此**不能**在 `armorwork 1`
   的同时又把 `itr.bdefend` 设到 200——那种组合下真函数会返回 false 而 C++ 侧仍是 true。
   `bdefend >= 200` 这条分支属于 `is_armor_work` 自己的单元，不在本 harness 覆盖范围内。
2. 假实体的 `dataset(key)` 先查实体自身、再落到世界 dataset；在用例可控范围内与 TS
   `Entity.dataset()` 的 `frame.dataset ?? data.base ?? world.bg.data.dataset ?? world.dataset`
   等价。
3. `handle_armor` 结尾会跑 `handle_injury`，所以 `summary_mgr.apply_damage` 与
   `factory.create_buff` 要像 6.9.63 那样接上（Electroshock 分支靠 `marks=1` + Fighter
   受害者触发）。

### 6.9.65 `collision_handlers4`（差分 84 行，变异 81/81 全杀）

harness op：

- `env itr <值>`（`bdefend`）/ `env bdy <值>`（`kind`）/ `env aframe <值>`（`behavior`）
- `env dataset <值>`：碰撞体 dataset，供 `handle_rest` / `handle_stiffness` 使用
- `env rest <值>` / `env itr_motionless <值>`
- `env a|v <字段> <值>`：**一行只允许一个字段，出现多余 token 直接报错退出**。
  字段：`hp` `hp_r` `state` `facing` `base_type` `velx` `vely` `velz` `frame_id`
  `throwings` `in_the_sky` `arest` `dropping`(0/1) `hit_sounds` `type`(8 = Fighter)
- `run ballhitother` / `run weaponhitother`

输出：`run <名字> || <调用日志> | <状态>`。日志含实体动作（统一 `A:` / `V:` 前缀，覆盖
`set_hp` / `set_hp_r` / `set_velocity` / `set_arest` / `enter_frame` / `set_dropping` /
`play_sound`）、`handlers` 缝的 `A:set_motionless` / `V:set_shaking` / `A:set_arest` /
`add_v_rest`，以及 `faf:<frame_id>:<throwings>:<in_the_skys>`；状态含双方
`hp/hp_r/state/facing/base_type/vel/arest/dropping/frame_id`。

三条约定：
1. 假 `find_align_frame` **固定返回 `"faf_result"`**，三个入参只进日志不进返回值。因此
   「把 `enter_frame` 的实参写死成 `"faf_result"`」这类变异仍然不可观测（返回值本就等于该
   常量），变异规格里用的是「换成 `a->frame_id()`」这种可观测写法。
2. `handlers` 缝的 `attacker_set_arest` 会**回写假实体的 `arest`**：TS 侧 `attacker.arest = ...`
   走的就是实体 setter，C++ 侧若只打日志不回写，状态行会漂移。
3. `env a type` 驱动 `Handlers4Env::is_fighter`（真身是 `entity::is_fighter_data(data)`），
   所以 `type = 8` 是 Fighter、`type = 0` 不是；「非 Fighter 受害者」靠 `type = 0` 构造。

### 6.9.66 `collision_weapon_is_hit`（差分 115 行，变异 85/85 全杀）

harness op：

- `env itr <值>`（`injury` / `bdefend` / `fall` / `motionless` / `shaking`）
- `env dataset <值>` / `env recov <裸数字>` / `env itr_motionless <值>` / `env rest <裸数字>`
- `env velx|vely|velz <裸数字>`：`calc_itr_velocity` 缝的注入值，语义等同 `itr.dvx/dvy/dvz`
- `env acube <值>` / `env bcube <值>`：`{left,right,bottom,top,near,far}`。假 `spark_point`
  固定取 `(a.left, b.top, a.near)`，两侧同式，用来捕捉「两个 cube 写反」的变异
- `env a|v <字段> <值>`：**一行只允许一个字段，出现多余 token 直接报错退出**
- `run hit`

输出：`run hit || <调用日志> | <状态>`。日志含四个前置 handler 的痕迹（`set_arest` /
`set_motionless` / `set_shaking` / `set_hp(_r)` / `set_toughness` / `summary:...`），以及
`set_dropping` / `sp:...` / `spark:...:<kind>` / `set_velocity:...`（只列实际写入的分量）/
`leave_ground` / `mark:<tag>` / `pick:<indexes>` / `enter_frame_by_id` / `set_team`；状态含双方
`hp/hp_r/tough/state/face/base_type/team/bearer/dropping/on_ground/data_id/vel` 与碰撞体的
`inj/inj_r/rinj/rinj_r`。

三条约定：
1. `env velx/vely/velz` 的语义是 **`itr.dvx/dvy/dvz`**，不是最终速度：假 `calc_velocity` 还会再乘
   `attacker.facing`（即真算式里的 `x_direction`）。所以 `env a face -1` 时注入 7 得到 -7，
   与真算式一致；把朝向因子漏掉是本轮第一次差分的唯一残留漂移。
2. 受害者刻意设为非 Fighter（`type = 16`），令真 `is_fall()` 恒为真，`calc_itr_velocity` 的 y 分量
   才等于 `dvy`；否则真算式给 0 而缝给注入值，会造出假漂移。
3. `itr.fall` 的临界值是 **100**（`140 - DEFAULT_FALL_VALUE_DIZZY`）。用例卡 99/100；
   卡 139/140 会让 `is_fly` 的三条变异全部不可观测。

### 6.9.67 `collision_fall`（差分 113 行，变异 84/84 全杀）

harness op：

- `env itr <值>`（`fall` / `effect`）
- `env dataset <值>` / `env acube <值>` / `env bcube <值>`
- `env velx|vely|velz <裸数字>`：`calc_itr_velocity` 缝的注入值
- `env a|v <字段> <值>`：**一行只允许一个字段，出现多余 token 直接报错退出**
- `run fall`

输出：`run fall || <调用日志> | <状态>`。日志顺序固定为 `set_toughness` → `set_fall_value` →
`set_defend_value` → `set_resting` → `set_velocity` → `sp:` → `spark:x:y:z:<kind>` →
[`drop_holding`] → `enter_frame` / `enter_frame_by_id`；状态含双方
`hp/hp_r/tough/fall/fall_max/defend/resting/state/face/vel`。

三条约定：
1. `env velx|vely|velz` 的语义是 **`itr.dvx/dvy/dvz`**：假 `calc_velocity` 会再乘 `x_direction`，
   并把同一个方向值写进 `ItrVelocity::x_direction`（也就是 `turn_face` 的输入）。为对齐真算式，
   假实体把 `weight` 与 `ivx_f/ivy_f/ivz_f` 固定为 1，且 `fall_value` 在该函数开头就被清零
   ⇒ 真 `is_fall()` 恒为真 ⇒ y 分量正好等于 `dvy`。
2. `x_direction` 的 position-based 分支必须在缝里复刻：`effect ∈ {FireExplosion(22),
   Explosion(23)}` 或 `attacker.state == HeavyWeapon_InTheSky(2000)` 时为 -1，否则取
   `attacker.facing`。假实体位置恒为 0，所以 `diff_x > 0` / `diff_x < 0` 两条都不成立。
3. `critical_hit` 支持对象（`{1: [...], -1: [...]}`）与数组两种形态；**缺键时 TS 会抛
   `TypeError`**，所以用例只覆盖「对象含两个键」与「数组且方向为 +1」两类。

### 6.9.68 `collision_n_bdy_normal`（差分 175 行，变异 100/100 全杀）

harness op：

- `env itr <值>`（`effect` / `injury` / `bdefend` / `fall` / `motionless` / `shaking`）
- `env dataset <值>` / `env bframe <值>` / `env aframe <值>` / `env armorwork 0|1`
- `env acube <值>` / `env bcube <值>` / `env rest <裸数字>` / `env itr_motionless <值>`
- `env velx|vely|velz <裸数字>`：`calc_itr_velocity` 缝的注入值
- `env a|v <字段> <值>`：**一行只允许一个字段，出现多余 token 直接报错退出**
- `run hit`

输出：`run hit || <调用日志> | <状态>`。一次 run 只会出现其中一条路径的日志（`Ignore` 直接返回；
armour 命中短路；四个 effect 分组各自成套；impact 路径要么 `is_fall` 早退、要么走完全程）。

三条约定：
1. `env velx|vely|velz` 的语义是 `itr.dvx/dvy/dvz`，缝里要复刻真算式的三件事：`x` 乘
   `x_direction`（`position_based` 时恒为 -1）、**`y` 只在 `is_fall` 为真时才取注入值**（否则为
   0）、`z` 直传。漏掉 `y` 的门控会让 impact 路径的 y 分量出现假漂移。
2. `armorwork` 必须与 TS 侧真 `is_armor_work` 同真同假：`armorwork 1` 的用例要让真函数返回 true
   （`fulltime` 真、`bframe.state` 允许、effect 非火非冰、`bdefend < 200`、`aframe.state !== 3006`）；
   `armorwork 0` 的用例只能配「无 armor」或让 `bframe.state` 落在失效集合（如 `Injured`）。
3. 每次进入 impact 尾段之前都要**显式重置 `fall`**（`env v fall n ...`）：`handle_fall` 会把
   `fall_value` 清零，而 `is_fall` 对 `fall_value <= 0` 恒真 ⇒ 不重置就会整段尾逻辑被早退跳过
   （首轮 25 条变异存活全是这个原因）。

### 6.9.69 `collision_n_bdy_defend`（差分 110 行，变异 65/65 全杀）

harness op：

- 与 6.9.68 相同，另加 `env bdy <值>`（防御方 bdy），以及 `env a|v defend_ratio <值>`。
- `env itr <值>` 里可用 `effect` / `bdefend` / `injury` / `actions`；`bdy.actions` 走 `env bdy`。
- `run hit`。

输出：`run hit || <调用日志> | <状态>`。日志里 `dispatch:<handler_type>:<action>` 表示 action 分发；
整段只会有三种形态之一：守卫移交（出现 `handle_itr_normal_bdy_normal` 的痕迹）、破防分支
（`spark:...:broken_defend` + 两组 `A_BROKEN_DEFEND` 过滤）、未破防分支
（`spark:...:defend_hit` + 两组 `A_DEFEND` 过滤）。

三条约定：
1. **action 分发是缝**，不是真 `run_action`：`dispatch` 的第一个参数就是 TS 里的 handler key
   （`A_NEXT_FRAME` / `V_NEXT_FRAME`），第二个参数是原始 action 对象。因此「分发给哪个 key」
   与「`action.type` 的白名单」都可观测，而 handler 本体由 `action_handlers` 单元覆盖。
2. `actions` 只按数组迭代；TS 对非数组值会抛 `TypeError`，端口用 `as_array` 守卫（宽容）。
   用例只用数组与 `null` / 缺失。
3. **每条防御用例之前都要重置 `defend`**：`defend_value -= bdefend` 会累积，不重置就会从
   「未破防」掉进「破防」，三条 bdy 分支的变异会因此全部存活。

### 6.9.70 `collision_ball_frozen`（差分 151 行，变异 89/89 全杀）

harness op：

- `env itr <值>`：`kind` 用值语法（`env itr o 1 kind n 0`，字符串形式 `s "0"` 也在用例里）。
- `env a|v group <值>` / `state` / `type` / `face` / `frame` 走值语法；
  `posx` / `posy` / `posz` 走裸数字；`spawn 0|1` 是裸标志。
- `run hit`。

输出：`run hit || <调用日志> | <双方状态> | ret=0|1`。
日志里 `A:spawn:oid:kind:x:y:z:action:face` 与 `V:enter_frame:gone` 带实体身份。

三条约定：
1. **`frame` 是对象**：`env a frame o 4 centerx n 5 centery n 6 width n 0 height n 0`。
   只要对象里字段数与 `o <n>` 不符，harness 会直接报 `value literal truncated`。
2. **`spawn` 的返回标志要分别设在 `a` 和 `v` 上**：守卫读的是 `a.spawn` 的返回值，
   只改 `v` 那条不能覆盖「忽略返回值」这一支。
3. 用例里凡是「影响分支判定」的字段（`group` / `state` / `type` / `face` / `frame` /
   `pos*` / `spawn`）在切换场景时都要显式重置，别依赖上一轮残留。

### 6.9.71 `collision_healing`（差分 55 行，变异 22/22 全杀）

harness op：

- `env itr <值>`：`injury` 用值语法，字符串（`s "6"`）与缺失都要覆盖。
- `env a|v dataset <值>`：**只用对象**。`dataset` 是实体上的普通属性读，传 `null` 属于契约外。
- `run heal`。

输出：`run heal || <调用日志> | <双方 dataset> buff=<id>/<lifetime>/<duration>/<level>/<attacker>`；
无 buff 时写作 `buff=none`。

三条约定：
1. **`duration` 必须显式打印**：handler 返回 void，公式算错只能从 `grant_buff` 之后的 buff 状态
   里看出来。harness 的 `create_buff` 要把返回的 `Buff*` 存进全局，状态文本再读它。
2. **假 buff 实体的 id 要和实体一致**（见 DESIGN §19.3），否则 buff id 会分叉。
3. 用例要同时覆盖：`injury` 的假值（`0` / `""` / 缺失 / 键名写错）、`ceil` 的进位与整除、
   两个 `max(1, …)` 的钳制（含 `0` 与 `0.5`）、dataset 缺键造成的 NaN、字符串 `injury` 的强转。

### 6.9.72 `collision_keeper`（差分 108 行，变异 45/45 全杀）

harness op：

- `env a|v type <裸数字>`：`collision.attacker/victim.data.type`。
- `env a|v state <裸数字>`：供 `a_state` / `v_state` 过滤使用（目前只有 `v_state` 有用例）。
- `env itr <值>` / `env bdy <值>`：必须**都存在**，真实现会直接读它们的 `.kind`。
- `env handlers <值>`：预置 `collision.handlers`（数组，元素被当作名字）。
- `run load`。

输出：`run load || handlers=[<名字,…>] | ret=0|1`。

三条约定：
1. **一条用例一个探针**：表格里有 19 条配置，每条至少要有一个能命中的 `(a,v,itr,bdy)` 组合，
   否则「删掉该条」或「改该条的枚举」都不可观测。
2. **要专门造「同 key 多命中」的用例**（`(Ball, Normal, Ball, Normal)`）以及
   **状态过滤**的用例（武器三条配置的 `v_state`）。
3. `pack_a` / `pack_b` 的位移与 `|` / `+` 都是不可观测的（双向自洽、无碰撞）；
   想让它可观测必须**制造键碰撞**（丢掉 kind）。

### 6.9.73 `collision_keeper_handle`（差分 77 行，变异 48/48 全杀）

harness op：

- `env dev 0|1`：对应 `Ditto.DEV` / `CollisionCoreEnv::dev`。
- `env data <值>`：包成 `{base: <值>}`，模拟 `victim.data`。
- `env a|v id s "…"` / `env a|v type <裸数字>` / `env a|v state <裸数字>`。
- `env itr <值>` / `env bdy <值>`：`kind` 与 `actions` 都放这里；`actions` 的每个元素是
  `o 3 type s "…" pretest b 0|1 tester o 1 r b 0|1`。
- `env handlers <值>`：handler **名字**数组（两端都会做成同名桩函数）。
- `run hunt`。

输出：`run hunt || <日志>`，无状态文本。

三条约定：
1. `itr` 与 `bdy` 必须都存在（真实现直接读它们的 `.kind`）。
2. **`actions` 只能是数组或 `null`**：`actions?.map` 对非数组会抛 `TypeError`，端口用
   `as_array` 宽容 ⇒ 非数组属契约外。
3. 想观测「测试预计算的时机」，同一个 run 里必须**同时**有 handler 日志与 tester 日志。

### 6.9.74 `buff_marks`（差分 41 行，变异 30/30 全杀）

harness op：

- `env cls s "group_attack"` / `s "electrify"`：选类。
- `env kind s "…"` / `env id s "…"`：构造参数（`kind` 不参与子类逻辑，只为快照/工厂）。
- `env victim s "V1"`：追加一个受击者（累计；`run make` 时全部挂上）。
- `env vpos o 3 x n … y n … z n …`、`env vframe o 3 centery n … height n … pic_h n …`：
  作用于**最后一个**追加的受击者。
- `env mark o 2 key s "…" value s "…"`：给最后一个受击者**覆盖式**写一个标记。
- `run make` / `run mount` / `run unmount` / `run effect`（`effect` 即 `update(0)`）。

输出：`run <op> || <日志> | <状态>`；状态含 `id=`、`victims=[…]`、`marks=[<实体>{key=value,…}]`、`fx=x/y/z`。

三条约定：
1. **受击者是累计的**：第二次以后 `run make` 会带上之前所有受害者，所以「只处理第一个受害者」
   这类变异从第二个场景起就可观测。
2. **想观测 `del_mark` 的条件删除**，必须在 `mount` 之后用 `env mark` 把标记值改成外来值，
   再 `run unmount`。两个类各要一个这样的场景。
3. 状态文本里**不要打印 `mounted`**：端口有 public `mounted()`，但 TS 的 `_mounted` 是
   protected 且没有 getter，TS 侧读不到。挂载与否改从 `world_buffs_set:` 日志观测。

### 6.9.75 `buff_healing`（差分 52 行，变异 42/42 全杀）

harness op：

- `env cls s "healing"` / `s "mp_healing"`；`env kind` / `env id`。
- `env victim s "V1"`（累计）；`env vdata o 4 hp_healing_value n … hp_healing_ticks n …
  mp_healing_value n … mp_healing_ticks n …`、`env vhp o 2 hp n … hp_r n …`、
  `env vmp o 2 mp n … mp_max n …`、`env mark o 2 key s "…" value s "…"`：都作用于**最后一个**受害者。
- `env ticks n …` / `env duration n …`：需要已有 buff（先 `run make`）。
- `run make|mount|unmount|tick <d>|duration <amount>`。

输出：`run <op> || <日志> | <状态>`；`duration` 的输出是 `d=<值>`。

三条约定：
1. **`run tick <d>` 的 `d` 要写成 `>= tips`**（即当前 `ticks`）才能每次触发 `on_tick`；
   想观测「累积」本身就把 `d` 写小、多调几次。
2. `duration_of` 的用例要覆盖：整除与不整除、`value`/`ticks` 为 `0` 的钳制、`0` 与负数金额。
3. 「越界钳制」类变异（`min(hp_r, …)` / `min(mp_max, …)`）必须把**起始值放到离上限不足一次回复量**
   的位置，否则钳制永远不生效。

### 6.9.76 `buff_electroshock`（差分 60 行，变异 22/22 全杀）

harness op：

- `env id s "B1"` / `env kind s "Electroshock"`。
- `env victim s "V1"`：**重新选中**语义（已在列表里就先移除再压到末尾），后续 `env v*` 作用于它。
- `env vtype n 8` / `env vstate n 11`（**值字面量**，可用 `s "12"` 造字符串状态）；
  `env vwait 0`（**裸数字**）；`env vpos o 3 x n … y n … z n …`、
  `env vframe o 3 centery n … height n … pic_h n …`。
- `env duration 8`（**裸数字**）；需要已有 buff（先 `run make`）。
- `run make|init|mount|unmount|tick <d>`。

输出：`run <op> || <日志> | <状态>`；状态含 `id=` / `victims=[…]` / `ticks=` / `dur=` / `life=`，
以及逐受害者的 `state=[…]` / `type=[…]` / `wait=[…]`。

覆盖面（这是杀掉全部 22 条变异的关键，逐条都要留）：

1. **`mount` 的守卫场景必须把列表里**每个**受害者都固定成能被守卫拦下的状态**。
   用例先只用一个受害者（`V1`）跑完 Injured/Falling 的 `n` 与 `s` 四种组合，
   **最后**才引入第二个受害者（`V2`，状态 `n 0`）来观测「两个受害者都被处理」。
   反过来写（先有 `V2`）会让时长无论如何都被 `V2` 减半，四条守卫变异全部存活。
2. **数值与字符串两种状态形态都要覆盖**：`n 11` / `s "11"`、`n 12` / `s "12"`、
   `n 14` / `s "14"`。`mount` 是宽松比较（两种形态都拦），`on_tick` 是严格比较
   （只拦数值形态），差异只能靠字符串用例暴露。
3. **特效居中要用 `centery != height / 2` 的帧数据**：例如 `centery n 4 height n 10`
   ⇒ 居中挂点比裸 `y` 少 `1`。（`centery 4 height 8` 时两者恰好相等，变异会存活。）
4. **`run tick <d>` 的 `d >= ticks`**（`init` 后是 `3`），否则 ticker 不触发、`on_tick` 与
   特效创建都不会发生。
5. 非战士（`env vtype n 16`）用例用来观测 `is_fighter_data` 守卫。

### 6.9.77 `buff_magic_flute`（差分 82 行，变异 58/58 全杀）

harness op：

- `env cls s "mf1"` / `s "mf2"`、`env id` / `env kind`（字符串）。
- `env attacker s "A1"`（字符串；`s ""` = 无攻击者，`run make` 时不再 `set_attacker`）。
- `env victim s "V1"`：**重新选中**语义（已在列表里就先移除再压到末尾），后续 `env v*` 作用于它。
- `env vtype` / `env vstate` / `env vhp` / `env vhp_r` / `env vfallinjury` / `env vtough` /
  `env vteam` / `env vindexes`：**值字面量**；`env ateam`：值字面量，作用于 `attacker` 指向的实体。
  例：`env vindexes o 2 falling o 2 -1 a 2 s "30" s "31" 1 a 1 s "35" in_the_skys a 2 s "40" s "41"`
- `env vvy`：**裸数字**。
- `run make|init|tick <d>`。

输出：`run <op> || <日志> | <状态>`；状态含 `id=` / `victims=[…]` / `ticks=` / `dur=` / `life=`，
以及逐受害者的 `hp=[…]` / `hp_r=[…]` / `fall=[…]` / `tough=[…]` / `team=[…]` / `vy=[…]` / `type=[…]`。

覆盖面（杀掉全部 58 条变异的关键）：

1. **`on_update` 每次 `tick` 都跑**，`on_tick` 只在 `_ticker.add(d)` 为真时跑
   ⇒ 想同时观测两段就必须 `run tick 3`（`init` 后 `ticks = 3`）。
2. **`calc_v` 的四种输入都要给**：`vy = 0`（未达目标，回 `current + acc`）、
   `vy = acc`（恰达目标，原样保留）、`vy > acc`（超过目标，原样保留）、`vy < 0`（反向仍在加速）
   —— 少任何一种，「方向取反」「换模式」「当前与目标互换」都会漏杀。
3. **类型比较是严格的**：必须有 `env vtype s "8"` 与 `env vtype s "16"` 两条
   （否则 `strict_equals` → `equals` 的两条变异必存活）。
4. **状态比较也是严格的**：`env vstate s "12"` 用来区分
   `!strict_equals(state, Falling)` 与 `!equals(state, Falling)`。
5. **两个天空状态要各给一次**（`n 1000` 与 `n 2000`）：前者杀 `&&` → `||`，
   后者杀「第二个条件写成了第一个枚举」。
6. **`in_the_skys` 的数组长度必须 ≥ 2**，才杀得掉 `index_0` 的 `at(0)` → `at(1)`；
   `falling` 也要同时给 `"-1"` 与 `"1"` 两个键才杀得掉键写错。
7. **「字段不重置」陷阱**：每个 `run make` 之前都要**显式重置** `vstate` / `vhp` / `vhp_r` /
   `vvy`（前一轮 `on_tick` 已经把 `hp` 扣过、`vy` 被写回），否则下一段场景静默走偏。

### 6.9.78 `state_base`（差分 46 行，变异 37/37 全杀）

harness op：

- `env victim s "V1"`（字符串）。
- `env state`：**值字面量**（可写 `n 1700`，也可写 `s "1700"` 造字符串状态）。
- `env dataset`：值字面量对象，例 `env dataset o 2 hp_healing_value n 10 hp_healing_ticks n 2`；
  两个键都可以缺（缺 `hp_healing_value` 时 `max(1, undefined)` 是 NaN，时长整体变 NaN）。
- `env pos`：对象 `o 3 x n … y n … z n …`。
- `env velx` / `env velz`：**值字面量**，`u` = 速度缺失。
- `run make|leave|restrict <x> <y> <z>|update`（`restrict` 的三个参数是**裸数字**）。

输出：`run <op> || <日志> | <状态>`；状态含 `state=` / `pos=[x:y:z]` / `vel=[vx:vz]` /
`granted=<buff id>:<duration>` / `marks=[key=value,…]`。

覆盖面（杀掉全部 37 条变异的关键）：

1. **`leave` 要覆盖四种状态输入**：`n 1700`（命中）、`n 0`（不命中）、`s "1700"`（严格比较不命中）、
   以及缺 `hp_healing_value` 的场景（渲染出 `nNaN`）。
2. **`on_restrict` 要覆盖四条路径**：只有 x 动（`restrict 10 0 0`）、只有 z 动（`0 0 10`）、
   只有 y 动（`0 10 0`，会把 x 与 z **一起**刷）、什么都没动（先 `env pos o 3 x n 5 …` 再 `restrict 5 6 7`
   —— 这条是「恒调用 `set_velocity`」与「`||` 变 `&&`」的唯一观测点）。
3. **两个轴的速度必须不同符号**（`velx n 2` / `velz n -2`）：否则「x/z 写反」「取错速度」都不可观测。
4. **必须有不触发钳制的速度**（`0.25` / `-0.25`）来区分「越界返回上下界」与「原样返回」。
5. **必须有缺失速度**（`velx u` / `velz u`）：`undefined !== null` 为真，
   这条是「`is_null` 把 missing 也算 null」的唯一观测点，也是 `clamp` 原样返回非数的观测点。

### 6.9.79 `character_state_base`（差分 68 行，变异 50/50 全杀）

harness op：

- `env victim s "V1"`（字符串）；`env onground 0|1`（**裸数字**）。
- `env state`：**状态对象**的 state（构造参数，值字面量，可用 `s "2"` 造字符串）。
- `env vstate`：**实体**的 state（值字面量，可用 `s "2"`）；`up` / `landing` 读的是它。
- `env hp` / `facing` / `holding` / `onlanding` / `velx` / `velz`：值字面量
  （`holding`/`onlanding`/`velx`/`velz` 可写 `u`）。
- `env dataset` / `indexes` / `frames`：值字面量对象。典型：
  `env indexes o 5 landing_2 s "40" default s "50" heavy_obj_walk s "60" in_the_skys a 2 s "70" s "71" falling o 2 1 a 2 s "80" s "81" -1 a 2 s "90" s "91"`
- `run make|update|landing|up|auto|sudden|caught`。

输出：`run <op> || <日志> | ret=<返回值|-> | <状态>`；
状态含 `state=`（状态对象）/ `estate=`（实体）/ `hp=` / `face=` / `onground=` / `holding=` / `vel=[x:z]`。

覆盖面（杀掉全部 50 条变异的关键）：

1. **`run up` 之前必须同时设 `env vstate`**（实体状态）与 `env holding`；
   四种状态各跑一次，再加一次 `vstate s "2"` 区分严格/宽松比较。
2. **`holding` 要覆盖 `u`（缺失）、`0`、`1`（非 Heavy 的数值）、`2`（Heavy）、`s "2"`（字符串 Heavy）**：
   `s "2"` 是「严格比较 → 宽松比较」的唯一观测点。
3. **`run sudden` / `run caught` 之前必须把 `falling` 两层键都恢复到索引对象里**
   （本单元为「缺 falling 时返回 undefined」另有一段无 falling 的场景，
   若忘了恢复，六条「取到哪一帧」的变异全部不可观测）。
4. **`indexes` 里 `in_the_skys` 要 `a 2`**，才杀得掉 `index_0` 的 `at(0)` → `at(1)`；
   `frames` 要同时给出 `"40"` / `"50"` / `"60"` / `"70"` 四帧，
   才分得清「取错索引键」与「取错帧表」。
5. **`env onground` 的三种组合都要有**（地面 / 空中 hp>0 / 空中 hp<=0），
   再叠加 `holding` 的 Heavy，才能把 `get_auto_frame` 的三段优先级逐条钉住。
6. **ESM 循环依赖坑**：harness 里必须**第一行**写
   `import "../../../../src/LFW/entity/Entity";`（只为副作用），否则
   `CharacterState_Base.ts` 的**值导入** `import { Entity } from "../entity/Entity"`
   会把 `Entity → ENTITY_STATES → CharacterState_Caught → CharacterState_Base` 的环拉起来，
   打包结果在 `CharacterState_Caught extends undefined` 上直接崩。
   （`State_Base.ts` 用的是 `import type`，所以上一单元没踩到。）

### 6.9.80 `character_state_basic`（差分 82 行，变异 37/37 全杀）

harness op：

- `env cls s "standing"` / `s "running"` / `s "injured"`（选被测类）。
- `env usedefault 1`：不带状态构造（`new CharacterState_Standing()` 等），验证默认参数。
- `env victim s "V1"`（字符串）；`env onground 0|1`（**裸数字**）。
- `env state` / `vstate` / `hp` / `facing` / `vteam` / `ground_y` / `holding` / `onlanding` /
  `dataset` / `indexes` / `frames` / `pos` / `velx` / `velz`：值字面量。
- `run make|update|enter`。

输出：`run <op> || <日志> | <状态>`；
状态含 `state=` / `hp=` / `ground=` / `pos=[x:y:z]` / `vel=[x:z]` /
`holding=` / `holding_team=` / `team=`。

覆盖面（杀掉全部 37 条变异的关键）：

1. **`Standing` 要覆盖四种位置/血量组合**：存活且贴地（`y == ground_y`，什么都不做）、
   存活且高于地面（进 `in_the_skys[0]`）、`hp = 0`（进骤死帧）、
   **`hp = 0` 且高于地面**（这一条专门用来观测 `return` —— 少了它就杀不掉「穿透到地面分支」）。
   再加 `hp = u`（缺失血量按存活算）。
2. **`Running` 的四种 vx/vz 组合缺一不可**：`vz = 0`（不拖拽）、`vx > dz`（减）、
   `vx < -dz`（加）、`|vx| <= dz`（原样）。
   另外必须有 **`vz < 0`** 的一次，才杀得掉「丢掉 `abs`」；`vx = u` 与 `vz = u` 各一次。
3. **`Injured` 的 holding 要覆盖 `u` / `1` / `2` / `s "2"`**：
   `s "2"` 是「严格比较 → 宽松比较」的唯一观测点，`1` 是「换枚举值」的观测点。
4. **`holding.team` 的写入必须有日志**（见 DESIGN §28.4），否则「顺序」类变异存活。
5. `env holding` 要**重置** `holding_team`（对齐 TS 里换了一个全新的 holding 对象）。

### 6.9.81 `character_state_walking`（差分 52 行，变异 34/34 全杀）

harness op：

- `env victim s "V1"`（字符串）。
- `env ctrlud 0|1` / `env ctrllr 0|1` / `env hweapon 0|1`：**裸数字**。
- `env waitflag <数字>`：**裸数字**，`handle_wait_flag` 的返回值。
- `env state|hp|vwait|frame|ground_y|holding|indexes|pos`：值字面量（`vwait` 可 `u`）。
- `run make|update`。

输出：`run <op> || <日志> | <状态>`；
状态含 `hp=` / `wait=` / `waitflag=` / `frame=` / `pos=[x:y:z]` /
`ground=` / `holding=` / `hweapon=` / `ctrl=UD LR`。

覆盖面（杀掉全部 34 条变异的关键）：

1. **`e.wait` 被写回之后必须显式重置**（`env vwait u`）：
   Heavy 分支会把 `wait` 设成 `waitflag`（真值），此后所有「空闲」场景都会被静默跳过。
   本轮首轮 2 条存活正是这个老坑的第四次命中。
2. **四种 holding 组合都要有**：`hweapon 1` + `holding 2`（进 wait 分支）、
   `hweapon 1` + `holding 1`（是武器但非重型）、`hweapon 1` + `holding s "2"`（严格比较）、
   `hweapon 0` + `holding 2`（是重型但不是武器）。
3. **ctrl 的三种输入**：`ud=1`、`lr=1`、两者都 0；`wait` 的 `u` / `0` / `3` 三种。
4. **`hp<=0` 且高于地面**必须单独造一条，否则「穿透到地面分支」不可观测。
5. `indexes.in_the_skys` 要 `a 2`，才杀得掉 `index_0` 的 `at(0)` → `at(1)`。

### 6.9.82 `character_state_caught_rowing`（差分 59 行，变异 39/39 全杀）

harness op：

- `env cls s "caught"` / `s "rowing"`；`env victim s "V1"`（字符串）。
- `env has_holding 0|1`（**裸数字**）。
- `env state|prevstate|fall|fallmax|vteam|velx|vely|holding|onlanding|dataset|indexes`：值字面量
  （`velx`/`vely`/`fall`/`fallmax` 可 `u`）。`prevstate` 是传给 `enter` 的 `{ state: … }`。
- `run make|enter|update|landing`。

输出：`run <op> || <日志> | <状态>`；
状态含 `fall=` / `fallmax=` / `vel=[x:y]` / `has_holding=` / `holding=` / `holding_team=` / `team=`。

覆盖面（杀掉全部 39 条变异的关键）：

1. **`has_holding` 与 `holding` 必须交叉组合**：
   `has_holding 1 + holding 2`（掉落 + 改阵营）、`has_holding 1 + holding 1`（只掉落）、
   `has_holding 1 + holding s "2"`（严格比较）、**`has_holding 0 + holding 2`**（都不做）。
   最后一条是「掉落守卫被删」「改阵营不看守卫」两个变异的唯一观测点；
   **注意进入该场景前要把 `holding` 也设成重型** —— 只设 `has_holding 0` 而沿用上一条的
   `holding 1`，两条变异都会因为 `1 !== 2` 而**静默存活**（本轮唯一一次存活）。
2. **`Rowing` 的 `prevstate` 要有 4 种**：`n 12`（命中）、`n 0`（不命中）、
   `s "12"`（严格比较）、以及配 `S = Falling` 之外的状态值。
3. **`calc_v` 的 `Default` 分支要三种 `vely`**：正值（`5` → 取目标 `-12`）、
   小负值（`-5` → 取目标 `-12`）、**更小的负值（`-20` → 原样保留）**。
   少了最后一种，「把 `prev_vy` 写成常量」与「换模式」两条变异杀不掉。
4. **`velx` 要有正、负、`0`、`u` 四种**：`0` 是 `>= 0` 与 `> 0` 的唯一分界；`u` 观测 `>=` 对非数的结果。
5. `indexes` 要同时给 `landing_1` 与 `default`，才分得清「回落索引取错」。

### 6.9.83 `state_misc`（差分 58 行，变异 42/42 全杀）

harness op：

- `env cls s "weapon_broken"` / `s "to_catching"` / `s "to_louisex"` / `s "to_8xxx"` / `s "ball"`。
- `env victim s "V1"`（字符串）。
- `env state|vstate|vtype|finddata|findfighter|transformtype`：值字面量。
  `finddata` / `findfighter` 是 `datas_find*` 的返回值；`transformtype` 是 `transform()` 后实体新的 `data.type`。
- `run make|landing|update|enter|leave`。

输出：`run <op> || <日志> | <状态>`；
状态含 `state=` / `vstate=` / `type=` / `shaking=` / `motionless=` / `vel=[x:y:z]`。

覆盖面（杀掉全部 42 条变异的关键）：

1. **`to_8xxx` 要覆盖 4 段**：`vtype 4 + transformtype 8`（新变成 Fighter，报告）、
   `vtype 8`（类型没变，不报告）、`transformtype 16`（新类型不是 Fighter，不报告）、
   `finddata u`（没查到数据 ⇒ 不 transform、`new_type` 仍是旧的）、
   `state s "8008"`（字符串状态被 `typeof` 守卫挡掉）、以及 `transformtype s "8"`（严格比较）。
2. **`ball` 要覆盖 4 个球状态 + 一个非球状态 + 一个字符串状态**：
   `3000` 是「四个条件用 `||` 连」的观测点，`s "3001"` 是「严格 → 宽松」的观测点。
3. **`to_louisex` 要覆盖 `findfighter` 有/无两种**。
4. `to_catching` 与 `to_louisex` 的 `enter_frame(find_auto_frame())` 都要能观测到
   （假实体把 `find_auto_frame()` 打成 `{id:"AUTO"}` 并记日志）。

### 6.9.84 `character_state_dash`（差分 63 行，变异 42/42 全杀）

harness op：

- `env victim s "V1"`（字符串）；`env ctrlud -1|0|1` / `env ctrllr -1|0|1`（**裸数字**）。
- `env state|prevstate|pos|ground_y|velx|vely|velz|facing|dataset`：值字面量（`vely` 可 `u`）。
- `run make|enter`。

输出：`run <op> || <日志> | <状态>`；
状态含 `pos=[x:y:z]` / `ground=` / `vel=[x:y:z]` / `face=` / `ctrl=ud,lr`。

覆盖面（杀掉全部 42 条变异的关键）：

1. **早退守卫要有 4 种组合**：贴地 + 有垂直速度（不早退）、悬空 + 有垂直速度（早退）、
   悬空 + 垂直速度 `0`（不早退）、悬空 + `vely u`（不早退）；再加贴地 + `vely 0`。
2. **x 方向五条支路各至少一次**，且**每次都显式设 `velx`**（上一场景会写回）：
   `prevstate 2` + `velx 5`（Running 支）、`prevstate s "2"` + `velx 5`（宽松比较观测点）、
   `prevstate 1` + `velx 5`（「别的状态」观测点）、`ctrllr 1` / `ctrllr -1`（LR 支）、
   `velx 5` / `velx -5` / `velx 0` / `velx u`（四条速度支）。
3. **两组零速度场景**：`facing 1` 与 `facing -1`（见 DESIGN §32.2 的第二条警告）。
4. **`ctrllr -1` 与 `ctrlud -1`**：符号必须能透传到速度上（`LR * dx`、`UD * dz`）。
5. **`ctrlud` 三种取值**（`0` 保留原 z、`1` 正、`-1` 负）。

### 6.9.85 `character_state_burning`（差分 51 行，变异 37/37 全杀）

harness op：

- `env victim s "V1"`（字符串）；`env catcher 0|1`（**裸数字**）。
- `env indexes|wdata|facing|bounced|velx|vely|velz|landingvel|onlanding`：值字面量
  （`velx` 可 `u`）。`wdata` 是 `world.dataset` 的内容；`landingvel` 是 `{x, y}`。
- `run make|enter|update|leave|landing`。

输出：`run <op> || <日志> | <状态>`；
状态含 `bounced=` / `facing=` / `vel=[x:y:z]` / `catcher=`。

覆盖面（杀掉全部 37 条变异的关键）：

1. **每个 `landing` 场景都要显式设 `env bounced n 0`**（见 DESIGN §33.3 的第二条警告）。
2. **`||` 的两侧要各自单独成立一次**：
   `y=5, x=0`（左侧成立、右侧短路不读）、`y=6, x=0`（两侧都不成立 ⇒ else）、
   `y=6, x=4`（右侧成立）、`y=6, x=-4`（右侧靠 `abs` 成立）。
   少了 `y=6, x=0` 就杀不掉「左右阈值互换」；少了 `x=-4` 就杀不掉「去掉 `abs`」。
3. **`bounced` 要有 `0` / `1` / `u` 三种**：`1` 是「已弹跳 ⇒ 直接躺下」的观测点，
   `u` 是真值判定（缺失即假）。
4. **`facing` 的三种速度输入**：`0`（不转头）、正、负、以及 `u`（缺失 ⇒ 不转头）。
5. **`enter` 要跑两次**（有/无 catcher），并观察它写出的
   `set_bounced:false` 与 `handle_ground_velocity_decay` 日志。
6. **`leave` 之前先把 `bounced` 置真**，才能观测到它被清回 `false`。

### 6.9.86 `character_state_teleport`（差分 106 行，变异 61/61 全杀）

harness op：

- `env cls s "nearest"|"farthest"`；`env state`（值字面量）；`env victim s "M1"`。
- `env facing|seg`（值字面量）；`env gy <裸数字>`。
- `env pos o 3 x n .. y n .. z n ..`；
  `env ent o 6 id s ".." fighter b .. ally b .. hp n .. x n .. z n ..`
  （按 id 覆盖或追加，保留插入序）。
- `run make|default|enter`。

输出：`run <op> || <日志> | <状态>`；
状态含 `id=` / `pos=[x:y:z]` / `face=` / `seg=` / `gy=`。

覆盖面（杀掉全部 61 条变异的关键）：

1. **`env cls` 之后必须重新 `run make`**（见 DESIGN §34.3 的第二条警告）。
2. **自身实体要真的进列表**（TS 侧放 `victim` 本身），并把自身位置调到「最近」
   （`env pos o 3 x n 1 ..`），否则杀不掉「丢掉自身过滤」。
3. **非战斗实体要排在最近处**：`N1(fighter=0, x=1)` + `N2(fighter=1, x=20)`，
   否则 `!is_fighter || is_self` 的 `||` → `&&` 不可观测。
4. **死实体要排在最近处**：`D1(hp=0, x=1)` + `D2(hp=10, x=30)`。
5. **两个 z 不同的候选**：`Z1(x=6, z=100)` + `Z2(x=7, z=0)`。
   原文 z 项恒为 0 时选 `Z1`（`x = -114`）；z 项一旦变成真的就选 `Z2`（`-113`）。
6. **等距平局**：`T1(5)` / `T2(-5)`（近敌保留先到的）；
   `V1(5)` / `V2(-5)`（远盟同理）。少了它们杀不掉 `dis < best` → `<=`。
7. **远盟要有非等距场景**（`A1(5)` / `A2(40)` ⇒ `x = -80`）：
   只有等距场景时「谓词忽略搜索方向」两边同解，杀不掉。
8. **`facing` 要 `1` / `-1` 各一次**，且要有 `x != z` 的场景（`-89 / 4`），
   否则看不见 `ground_segment(x, z)` / `ground_y(seg, x, z)` 的实参顺序。
9. **最后一条候选要能胜出**（`W1(40)` / `W2(2)`），否则杀不掉「跳过最后一个」。
10. **同一个受害者的 x 要中途改变**（`MC`：`x=0` 时选 `C1(6)`，改成 `x=-6` 后选 `C2(-7)`），
    否则「不读自身 x」不可观测。
11. **`run default`** 覆盖两个构造默认实参（`state=400` / `state=401`）。

### 6.9.87 `weapon_state_base`（差分 163 行，变异 73/73 全杀）

harness op：

- `env state|indexes|ionground|ithrow|isky|frames|onlanding|base|wt|dh|vstate|fid|vel|nf|align`
  （值字面量）；`env hp|hpr <裸数字>`；`env onground <真值>`。
- `run make|auto|landing|update|leaveground|rebound`。

输出：`run <op> || <日志> | <状态>`；状态含 `hp=` / `hpr=` / `dh=`，
`auto` 额外带 `fid=`。

覆盖面（杀掉全部 73 条变异的关键）：

1. **`auto` 要覆盖「贴地 / 空中 / `indexes` 为假值 / 键不在表里 / 空数组」五种**：
   空数组那条会让 `to_string(缺失)` 变成键 `"undefined"`，正好也是 `indexes` 守卫的观测点。
2. **`rebound` 的反弹系数要分别用「表值 / `base` 覆盖 / 表外的武器类型」跑一遍**：
   表外类型（`wt n 9`）会同时触发三处 `??` 兜底；
   `wt n 5`（Drink，表尾）与 `wt n 2.5`（小数）分别锁住范围检查的两半。
3. **`is_bounce` 的五个项各自都要有「只靠它成立」的用例**，尤其第 4 项
   （`dvx >= min_z`）要**正反各一条**：`x=3` 时原文成立、`z=3` 时原文不成立，
   互换 `dvx`/`dvz` 的变异才杀得掉。
4. **`Heavy` 不可用于 align 分支**（见 DESIGN §35.2 第 6 条），
   要用 `wt n 0`（None）与 `wt n 4`（Baseball）来覆盖 align。
5. **`min_x` / `fast_*` 的边界要卡在等号上**：
   `base` 里把阈值设成 `2`，再用 `x=±4`（`bounce_x=0.5`）让 `dvx` 恰好等于 `±2`。
6. **速度要出现小数**（`x/y/z = -1.2345 / -1.2345 / 1.2345`），
   否则三条 `round_float` 变异不可观测。
7. `dh` / `hp` / `hpr` 每段重置；`vstate` 要出现**字符串** `s "1002"` 一次，
   用来看 `==` 与 `===` 的区别。

### 6.9.88 `state_base_proxy`（差分 113 行，变异 55/55 全杀）

harness op：

- `env cls s "proxy"|"15"|"frozen"`、`env state`（构造参数）、
  `env data|indexes|frames|onlanding|wdata|hbtype|vx|vz|vel|rid|pos|rxyz`（值字面量）、
  `env vstate`（实体状态）、`env hp <裸数字>`、`env catcher|onground <真值>`。
- `run make|default|update|leave|restrict|preupdate|enter|dead|landing|leaveground|gravity|auto|sdf|cef|ffbi`。

覆盖面（杀掉全部 55 条变异的关键）：

1. **类型矩阵要走全四种**：`data.type = 8`（Fighter）/ `16`（Weapon）/ `32`（Ball）/
   `4`（Ohters，落到 `_proxy`），外加一次 `env data u`。
   ⚠️ `EntityEnum::Ball = HitFlag::Ball = 0x20 = 32`，**不是 4**。
2. **每种类型都要有一组「只有它能产生」的日志**：
   Fighter → `auto` 返回 `stats["4"]`、`landing` 用 `landing_2="22"`、`sdf`/`cef` 有返回、
   `leaveground` 在读 `falling`；
   Weapon → `auto` 用 `on_ground="9"`、`landing` 用 `on_ground`、`leaveground` 无条件进 auto 帧；
   Ball → `enter` 里 `set_shaking`/`set_motionless`/`set_velocity`；
   `_proxy` → 全空。
3. **`HealSelf` 场景必须先改 `env state` 再 `run make`**（见 DESIGN §36.2 第 7 条），
   否则 `leave` 走不进 buff 分支，「调用两次」不可观测。
4. **`State_Frozen.enter` 的 `super_enter` 要能看见**：只有 Ball 目标装了 `enter`，
   所以要用 `data.type = 32` + `vstate = 3001` 再跑一次 `enter`。
5. **`hbtype` 要给一次字符串**（`s "2"`），才能区分 `==` 与 `===`。
6. **落地的速度阈值要卡三档**：`y = 20`（不触发）、`y = 10`（恰好等于 `5*2`，杀 `<`）、
   `y = -7`（在 `5` 与 `10` 之间，杀「不乘 2」）、`y = -10`。
7. `env state n u` / `run default` 两个场景用来锁住「构造默认实参」。

### 6.9.89 `weapon_state_misc`（差分 203 行，变异 61/61 全杀）

harness op：

- `env cls s "onground"|"onhand"|"throwing"|"inthesky"`；`env state`（构造参数）、
  `env newteam|team|motionless|bmotion|dh|base|wt|behavior|fid|onlanding|vstate|vx|vy|vz|align|indexes|throwg|justg|isky|ithrow|gval|vel`
  （值字面量）、`env hp|hpr <裸数字>`、`env bearer|dropping <真值>`。
- `run make|enter|update|landing|preupdate|gravity`。

输出：`run make` 带 `s=`（构造参数）、`gravity` 带 `r=`；状态文本
`team= dh= hp= hpr= motionless= bmotion= dropping=`。

覆盖面（杀掉全部 61 条变异的关键）：

1. **`base` 必须是对象**：`update` 与 `hit_ground_rebouncing` 里 TS 直接读
   `base.fast_vx` / `base.bounce_x`（没有 `?.`），`env base u` 会当场抛异常；
   另外 `o` 的计数是**键值对个数**（`o 3 fast_vy … fast_vx … fast_vz …`），
   第一轮把它写成 `o 2` 时多余字段被静默丢弃，边界用例形同不存在。
2. **Throwing 的 `||` 链要三种组合**：两个都有值（看优先级）、
   `throw_on_ground` 为 falsy（`0` / `u`）时掉到 `just_on_ground`、
   只有 `throw_on_ground`（验 `just` 侧不是唯一来源）。
   ⚠️ 两者都缺失会让 C++ 把 id 渲染成字符串 `"undefined"` 而 TS 渲染 `u`，
   用例**故意不覆盖**这种组合（变异规格头注已写明）。
3. **`is_boomerang` 的宽松比较要给一次字符串**（`behavior s "3"`）：
   同一场景同时锁住 `gravity` 的取整与 `enter` 的速度缩放。
4. **`enter` 的 `drop_hurted` 重置要带着 `dh b 1` 进**，否则不可观测；
   `dh` 属于 `hit_ground_rebouncing` 会写回的字段，每段场景都要重置。
5. **OnHand 需要「bearer 更大」与「自身更大」两个方向**（区分 `max` 与 `min`），
   外加 `bearer` 缺失、`motionless` 为 0、`NaN`、数字字符串四种守卫边界。
6. **`fast_*` 的三层兜底各要一个场景**：`base` 覆盖（`fast_vx=10` 对表值 4.5）、
   表值（`wt=4` 的 `fast_x=4.5`）、未知类型兜底 99（`wt=9`，`vy/vz=5` 不够快）、
   `null` 兜底（`fast_vx z`）。`fast_y`/`fast_z` 的中间表项与 Heavy 的关系见规格头注。
7. **六个比较的等号都要卡**：每个轴取精确值与 ±(值+0.5)；
   负半轴还要覆盖 `vx`（`-3/-3.5`）与 `vz`（`-3/-3.5`）——
   `vz > fast_z` 的 `>`→`>=` 是第一轮唯一存活者，靠 `vz=3/3.5` 补杀。
8. `wt s "2"` 一次，用来看重型守卫的 `!=` 与 `!==`；
   `dropping b 1` 进 `update`，用来看 `set_dropping(false)`；
   `nf` 缺失时只留 `find_align_frame` 日志，用来看 `set_dropping` 与
   `enter_frame` 都在 `if (nf)` 里面。

### 6.9.90 `burning_drink`（差分 149 行，变异 38/38 全杀）

harness op：

- `env cls s "burning"|"drink"`、`env state`（构造参数）、
  `env data|indexes|frames|onlanding|wdata|vstate|hbtype|hpmax|mp|mpmax|pos|vx|vy|vz|facing|bounced|holdhp|holdhpr|drink|mtrange|vel`
  （值字面量）、`env hp|hpr <裸数字>`、`env catcher|onground|holding <真值>`。
- `run make|default|enter|update|leave|landing`。

输出：`run make|default` 带 `s=`（构造参数）；状态文本
`hp= hpr= hpmax= mp= mpmax= state= bounced= facing= holding= hhp= hhpr= drink=<快照> pos=[…]`。

覆盖面（杀掉全部 38 条变异的关键）：

1. **两条路线用同一个 `cls` 开关**：`burning` 走 `State_Burning` 的代理分派，
   `drink` 走 `CharacterState_Drink` 的 update。
2. **Burning 要把四种 data 都跑一遍**：Fighter=8（`CharacterState_Burning`）、
   Weapon=16（`WeaponState_Base` 的 landing）、Ball=32（`BallState_Base` 的 enter，
   需 `vstate n 3001`）、其它=4（裸 `State_Base`）。
3. **Fighter 的 landing 要五档**：`on_landing` 帧优先、y 阈值下弹跳、
   `bounced` 挡住弹跳、x 速度分支（跳过第一条 dataset 读取）、y 恰好等于阈值（`<=` 闭区间）。
4. **`indexes.bouncing` 是 `{"-1":[_, id]}`**，`id` 在 `[1]`；`lying` 是 `{"-1": id}`。
   两个索引形状都必须是**字符串**帧 id，否则 C++ 的 `to_string` 与 TS 原样渲染会打架。
5. **Drink 的 `drink` 用对象字面量构造真 `DrinkInfo`**，状态文本直接打 `to_snapshot()`，
   连三个 `Times` 的内部状态一起锁住（`drink_stiffness` 已验证过快照渲染一致）。
6. **tick 门控要三套**（hp / hp_r / mp 各一个 `*_ticks n 2` 的场景）：
   `add()` 第一次 false、第二次 true，否则「删掉 `add()`」的变异不可观测。
7. **三段钳制各要一个错位场景**：hp 用 `hp_max`、hp_r 也用 `hp_max`（原文如此）、
   mp 用 `mp_max`；`hp_max u` 场景让 NaN 传播可见。
8. **「单段为空」与「全空」都要有**：全空场景锁掉罐子 + `mt.range(-6,6)/2`
   的日志（含参数与商），单段为空场景锁住 `&&` 链不提前触发。
9. `env hpmax|mp|mpmax` 是 Value 字面量而不是裸数字，才能表达 `u`（NaN 场景）。

### 6.9.91 `character_state_jump`（差分 103 行，变异 48/48 全杀）

harness op：

- `env state|pos|gy|jx|jy|jz|jt|jumpflag|dvals|onlanding|landing1`（值字面量）、
  `env lr|ud <裸数字>`、`env bot <真值>`、`env held s "..."`（`ctrl.is_end(key)`
  为真表示该键**未**按住；harness 用「`held` 里是否含该字符」实现）。
- `run make|default|enter|update|landing`。

输出：`run make|default` 带 `s=`（构造参数）；状态文本
`pos=[x:y:z] gy= jx= jy= jz= jt=`；日志逐条打缝调用（`handle_ground_velocity_decay`、
`ctrl_is_end:<键>`、`prev_frame`、`dataset:<键>`、`world_dataset:<键>`、
`set_velocity:x:y:z`、`enter_frame(:by_id)`、`update_velocity`）。

覆盖面（杀掉全部 48 条变异的关键）：

1. **`gy` 要变一次高度**（`gy n 2` 配 `pos.y n 2` / `n 3`），锁住「落点判断读
   `position.y` 而不是 x/常量」；之后**必须把 `pos.y` 复位**（本片 `pos y n 0`），
   否则后续所有 update 都早退、半个变异表失去观察面。
2. **五个按键各来一档**（`held s "R"` / `"L"` / `"U"` / `"D"` / `"j"`），
   再补 `held s "RLUDj"`（x、z 的两步互相抵消）与 `held s ""`（五键全松）。
3. **`atom_time` 两档**：`1`（整数步）与 `1.2345`（锁 `round_float` 的累加取整）。
4. **`atom_time n 0` 是必备用例**：只有它能让计步后的 `jumping.t` 为 0，从而走到
   起跳插值的 `else`（`vy = min = 4`）。否则「条件读成 `jumping.y`」的变异会存活
   （本片第一次跑变异实测 SURVIVED，补了这一档才杀掉）。
5. **起跳参数要互相可区分**：`dvals` 的行内顺序无关，但值取
   `10/3/5/7/11/13`（height / h_f / distancez / z_f / distance / x_f），
   任意两条读串了都会改变 `vy` 或 `vx`。
6. **`lr`/`ud` 取 ±1 两档**（`lr 1 / ud -1` 与 `lr -1 / ud 1`）锁符号与交叉。
7. **`jumpflag` 三档**：`b 1`（起跳）、`s "0"`（宽松真值仍起跳）、`n 0`（跳过起跳）。
8. **`jt`/`jy` 非零档**（`n 2` / `n 1`）锁插值的分子分母不互换、`min` 不乘不加。
9. **机器人分支单独一档**（`bot b 1`）：只推进 `t`、`y`，不读任何键。
10. **landing 三档**：`onlanding` 有帧（帧优先、跳过 `landing_1`）、
    `landing1 s "L1"`（`enter_frame_by_id` + `update_velocity({dvz:4,ctrl_z:Control})`）、
    `landing1 s "L9"`（锁读取时机与值）。
11. `landing1` 必须是**字符串**：C++ 的 `to_string(undefined)` 渲染成 `"undefined"`
    而 TS 打 `u`，所以这一档有意不覆盖（同 §37.3）。

### 6.9.92 `character_state_falling`（差分 173 行，变异 77/77 全杀）

harness op：

- `env state|dataid|frameid|onlanding|idxbounce|idxfalling|idxcritical|idxlying|shaking|wait|hp|facing|vx|vz|bounced|fuse|fall|fallmax|defend|defmax|rest|restmax|finj|tinj|pos|dvals|vel`
  （值字面量）、`env vy <裸数字>`、`env catcher <真值>`。
- `run make|default|enter|update|landing|leave`。

输出：`run make|default` 带 `s=`（构造参数）；状态文本
`pos=[x,y,z] vel=[x,y,z] dataid= frameid= hp= facing= bounced= fall=/<max> defend=/<max> rest=/<max> finj= tinj=`；
日志逐条打缝调用（`ctrl_reset_key_list`、`catcher_drop_catching`、`drop_holding`、
`ref_set_velocity:<fighter>:x:y:z`、`dismiss_fusion:<frame>`、`leave_ground`、
`handle_ground_velocity_decay:<factor>`、`enter_frame`、`enter_frame_by_id`、
`set_velocity`、`world_dataset:<键>`）。

覆盖面（杀掉全部 77 条变异的关键）：

1. **缓存要用「同一 data id 的第二次 enter」来锁**：`env dataid` 在
   `A` / `B` / `C` 之间切换，配合改 `idxbounce`。A 的缓存必须保持**建表时**的集合
   （改了 `idxbounce` 之后再 `update` 旧帧仍走衰减、走新帧则下落），B 才用新集合。
2. **`idxbounce` 每个方向要有两个 id**：只喂一个 id 的话「每个方向只加第一个」
   这类变异不可杀（本片第一版就漏了，补了 `B2` 的 update 场景才杀掉）。
3. **`idxbounce` 缺省一档**（`idxbounce u` + 新 data id）：既锁 `?.` 门，
   也锁「不为空表建缓存」——随后补上真值再 `enter` 一次，必须重新建表。
4. **`update` 四档**：缓存命中（只打 `handle_ground_velocity_decay:0.7`）、
   未命中（打 `enter_frame:{"id":…}`）、`shaking n 1` 与 `shaking u`（都不出力，
   `NaN > 0` 为假）、`wait n 1` 与 `wait u`（都不出力）。
5. **`vy` 窗口四档 + 中间档**：`4 → 0`、`3 → 1`（严格比较）、`-3 → 1`、`-4 → 2`、
   `0 → 1`。
6. **方向四档**：`vx 1 / facing 1`、`vx 1 / facing -1`、`vx 1 / facing 2`、
   `vx 1 / facing 0`（`Infinity > 0` 为真）、`vx -1 / facing 1`、`vx 0`（`0 > 0` 为假）。
7. **融合三段**：`hp 5`（不进）、`vx 0`（得到 `-0`，trace 里与 `0` 不同）、
   `vx -3 / vy -2 / vz 4`（第一个 +3、第二个 −3，且 vy/vz 原样透传）、
   `fuse a 0`（空表不得 `dismiss_fusion`）、`fuse u`、`hp u`（`NaN <= 0` 为假）。
8. **landing 十一档**：`on_landing` 真帧优先；`on_landing z`（`null` 为假）继续走；
   y 阈值的 `<=` 闭区间（`vy == 阈值`）；`|vx|` 的 `>` 开区间（`|vx| == 阈值` 不弹）；
   负 `vx` 锁 `abs`；`bounced` 已是 `n 1`（非布尔真值）挡弹跳；
   `bouncing` / `falling` / `critical_hit` 三对 **id 故意重叠**
   （`B2` 同时在 bouncing[1] 与 falling[-1]，`C1` 同时在 falling[1] 与 critical[-1]），
   顺序写错就会取到另一侧；最后一档谁都不匹配落到 `facing`。
9. **`bouncing` / `falling` 用数组、`lying` / `critical_hit` 用裸字符串**：
   两种索引形状都跑到（`find_direction` 的 `a == f.id` 与 `Array.isArray` 两条路）。
10. **`leave` 一档多值**：`bounced n 1` + 六个不同数值
    （`fall 3 / fallmax 9 / defend 4 / defmax 8 / rest 5 / restmax 7 / finj 6 / tinj 2`），
    状态文本一次锁住「都恢复成 max」与「inj 归零」，写错字段/写错 max 都会露。
11. `super.leave` 的 HealSelf 分支不在本片（`state 12`），`state_base/main` 负责。

### 6.9.93 `character_state_lying`（差分 235 行，变异 84/84 全杀）

harness op：

- `env state` 是**构造参数**，`env estate` 是**实体自身**的 state；
  其余
  `pos|gy|frameid|hp|hpr|hpmax|holdtype|holdteam|team|tough|tmax|trest|la|ld|lc|wait|dvals|deadjoin|deadgone|reserve|wakeup|motionless|invul|blink|outline|puppets|held`
  （值字面量）、`env holding <真值>`。
- `run make|default|enter|update|leave|dead|findframe`
  （`dead` 直接调 `on_dead` 钩子，`findframe` 直接调 `find_frame_by_id` 钩子）。

输出：`run make|default` 带 `s=`；`run findframe` 带 `r=`；状态文本
`pos= hp=/<hp_r>/<hp_max> team= tough=/<max> trest= la= ld= lc= wait= holding= holdteam=
deadjoin= deadgone= reserve= wakeup= motionless= invul= blink= outline= frameid= gy=`；
日志逐条打缝调用（`ctrl_reset_key_list`、`ctrl_is_end:<键>`、`drop_holding`、
`holding_set_team:<值>`、`world_dataset:<键>`、`blink_and_respawn` / `blink_and_gone`、
`world_etc:x:y:z:kind`、`handle_ground_velocity_decay:<factor>`）。

覆盖面（杀掉全部 84 条变异的关键）：

1. **`enter` 的持有物三档**：无持有物（不下发 `holding_set_team`）、轻武器
   （`drop_holding` 但保留队伍）、重武器（`base_type n 2` → 下发
   `holding_set_team:<team>`）、未知类型（`holdtype u`）。
2. **`on_dead` 的六个场面**：无 reserve / 无 join / 无 gone（什么都不做）；
   `reserve n 2` + 队伍命中傀儡（`blink_and_respawn(gone_blink_time)`）；
   `reserve n 1`（递减到 0 → **不**复活）；`dead_join` 挡住 `dead_gone`；
   `dead_gone n 1` 走 `blink_and_gone`；`puppets a 2 s "1" s "2"` 证明队伍是
   在**所有**傀儡里找的；`puppets a 0` 证明空集合永远不命中；
   `env reserve s "3"` 证明 `--` 是数值语义。
3. **`run dead` 独立一档**：脱离 `enter` 的 hp 门，单独锁 `on_dead` 的三段分支
   （外加 `reserve n 1` + 命中队伍这一档，用来杀「递减写成 `+1` / 不递减」）。
4. **`update` 要有「另一键偶数」的上下文**：攻击分支会提前 `return`，
   所以测「松开防御键」的场景必须让 `env la n 2`（偶数），否则整段被短路
   （本片第一版漏杀 3 条，实测修正）。
5. **攻击分支五档**：奇数为真（`la n 1`）、偶数跳过（`la n 2`）、负奇数
   （`la n -3`，锁 `truthy(fmod)` 而不是 `== 1`）、小数（`la n 1.5`）、
   字符串（`la s "3"` → 记数变成 `"31"`，锁 `js_add`）；外加 `wait n 0` 与
   `wait u`（都挡住攻击分支但继续走防御分支，锁 `>` 与 NaN）。
6. **防御分支四档**：奇数生效（`ld n 3`）、偶数跳过、`ld n -3`（锁 `truthy(fmod)`）、
   `ld u`（NaN 不生效）、松开键时不动 `wait`（锁 `pressing_d`）；
   另有一档 `atom_time n 1.2345`，用来锁 `round_float(wait + atom_time)`
   （整数 `atom_time` 下「取不取整」不可观测）。
7. **`leave` 七档**：无 join；`wakeup_invuln n 1`（刷 blink/invul）；
   `wakeup_invuln n 0`（什么都不做）；join 有 hp（`hp = hp_r = hp_max = join.hp`，
   顺手锁 `team` / `reserve` 的 `??` 兜底与 `world_etc(...,"6")` / 清 `outline` /
   清 `dead_join` / 置 `wakeup_invuln`）；**`join.hp n 0`**（`0` 不是 nullish →
   胜出，hp 三连变 0，锁 `??` 与 `||` 的区别）；`join.hp u` 与 `join.hp z`
   （都回退到 `hp_max`）；实体还活着（`hp n 1`）时整段跳过；`dead_join z` 同理。
8. **`findframe` 六档**：四个条件各来一档反例（`hp u` / `pos.y n 1` 高于地面 /
   `estate n 3` / `dead_join` 有值），外加全绿的一档（`r={"id":s"F0"}`）。
9. `env state` 与 `env estate` 必须分开：前者是构造参数，后者才是
   `find_frame_by_id` 里 `e.state === StateEnum.Lying` 的比较对象
   （第一版把两者混用，`findframe` 的绿档其实一直返回 `u`）。

### 6.9.94 `entity_states`（差分 1127 行，变异 49/49 全杀）

harness op：

- `env type <值字面量>` + `env code <裸数字>`（喂 `run fallback`）。
- `run size | dump | head | tail | get <键字面量> | has <键字面量> | fallback | fallback2 | setdup`。

输出：

- `run size || n=<条数>`；
- `run dump | head | tail ||` 后跟若干行 `k=<键> cls=<类名> s=<状态值>`
  （`dump` 打**全部 1040 条**，逐条比对整张表；`head` 打前 2 条、`tail` 打后 2 条，
  用来便宜地观察「重设键是否挪位置」）；
- `run get <键> || r=<类名|none> s=<状态值|none>`、`run has <键> || has=b0|b1`；
- `run fallback | fallback2 || [same=b0|b1] r=… s=…`（`fallback2` 连调两次，
  `same` 直接反映「命中缓存返回同一实例」）；
- `run setdup ||`（对已存在的数字键 `0` 重新 `set` 成另一个类）。

覆盖面（杀掉全部 49 条变异的关键）：

1. **`dump` 把整张表打出来**：键、类名、状态值三列一次锁死接线
   （任何一条「A 状态被换成 B 状态」的变异都会在这里露出来）。
2. **数字键 ≠ 字符串键**：`run get n 0` 命中 `CharacterState_Standing`，
   而 `run get s "0"` 必须是 `none`；`8001` / `"8001"`、`-1` / `"-1"` 同理；
   `has` 也各来一遍。
3. **非数字键**：`run get z / b 1 / u` 都是 `none`（键编码不能把它们和
   `"0"`、`"undefined"` 混到一起）。
4. **`fallback` 四路分派各来一档**：`8` → `CharacterState_Base`、
   `16` → `WeaponState_Base`、`32` → `BallState_Base`、`23`（其它）→ `State_Base`；
   另加 `u`（`String(undefined)` 造出 `"undefined_23"`）与 `s "8"`（字符串 type 走默认分支，
   但**复用**数字 8 那次建好的 `"8_23"` 条目 → 条数不变，锁住「字符串键共享」）。
5. **`fallback` 要连调两次**（`run fallback2`）才能锁「命中缓存返回同一实例」，
   同时 `run size` 证明只新增一条。
6. **`fallback` 的键是字符串而不是数值**：`type n 8 code 0` 之后
   `get n 0` 仍是 `Standing`，`get s "8_0"` 才命中 `CharacterState_Base`。
7. **`setdup` + `head`/`tail`/`size`**：对已存在的键重设只换值不挪位置
   （`size` 不变、`tail` 依然以 `LandGoto94` 结尾、`get n 0` 的类名与状态值都变了）。
8. **`set_all_of` / `set_in_range` 的规模**由 `size`（1040）与 `dump` 锁住：
   少一条、多一条、边界差一（`TransformTo_Max`）都会露。
9. `env type` 是**值字面量**（能表达 `u` / `s "8"`），`env code` 是裸数字。

### 6.9.95 `world_dataset`（差分 65 行，变异 55/55 全杀）

harness op：

- `env pure <真值>`（`b 0|1`、`n 0|1`…，喂构造函数）、`env hook s "<键>"`（注册 `on_<键>_change`）。
- `run make | default | keys | dump | get <键字面量> | has <键字面量> | tracked <键字面量> | set <键字面量> <值字面量>`。

输出：

- `run make || pure=b0|b1 keys=<键列表>`；
- `run default || same=b1 keys=<键列表>`（`same` 判定懒加载单例是否是同一实例）；
- `run keys || <逗号分隔的键列表>`、`run dump || {<排序后的整张表>}`（值带 `n<值>:<hexbits>` 形式）；
- `run get <键> || <本次日志> | v=<值|u>`、`run has <键> || has=b0|b1`、
  `run tracked <键> || tracked=b0|b1`；
- `run set <键> <值> || <本次日志>`，日志项为
  `field_change:<键>:<新值>:<旧值>` 与 `dataset_change:<键>:<新值>:<旧值>`（按发生顺序、逗号分隔，无通知则为空）。

覆盖面（杀掉全部 55 条变异的关键）：

1. **`run dump` 打整张 103 键表**：任何一条默认值写错（`-16.299999`、`794`、`450`、
   `sync_render`/`difficulty` 的 `3`）、漏一条、多一条、写重一条都会在这里露出来；
   排序按键序锁死（`GIM_INK`/`HERO_FT`/`LF2_NET`/`UPS` 在最前）。
2. **`run keys` 区分两种托管形态**：非纯数据集被装了非枚举访问器 →
   列表只有 `__is_world_dataset__`；纯数据集是普通可枚举字段 → 列表是全部 103 条加标记键之外的字段，
   顺序与声明顺序一致（专门加了 `itr_fall`/`itr_shaking` 对调、`itr_fall` 丢一条/多一条、
   末尾多一条这些变异来锁顺序与重数）。
3. **`run tracked` / `run has` 三档交叉**：`jump_height`（在表里 → 托管 b1）、
   `__is_world_dataset__`（在实例里但不在表里 → 存在 b1、托管 b0）、
   `nope`（不存在 → 都不成立）；`run get nope` 必须是 `u` 而不是 `0`。
4. **`set` 的通知顺序与参数**：第一个 `run set jump_height n 24.5` 先 `field_change` 后
   `dataset_change`（顺序颠倒会被杀），两条日志的 `(curr, prev)` 与键名都被比对。
5. **严格相等的静默**：同值重设、`u`→`u`、`0`→`-0`（`n0:0000000000000000` vs `n0:8000000000000000`）
   都必须是空日志，同时 `run get` 证明值确实被保存下来了。
6. **新键与未托管键**：`run set zz n 5` 之后 `run keys` 里出现 `zz`、`has=b1`、`tracked=b0`、
   `get` 有值且日志为空；`run set __is_world_dataset__ b 0` 走「存在但不托管」那条路，
   同样空日志但值变成 `b0`。
7. **`pure` 数据集**：`run keys` 全量可枚举、`tracked gravity=b0`、`has gravity=b1`、
   `has __is_world_dataset__=b0`，并且对它 `set`（含新键）完全静默（日志为空仍能读回新值）。
8. **默认实例的持久性**：`run default` 两次都是 `same=b1`；
   `run set jump_height n 12` 之后再 `run default` 仍读到 `n12`、`tracked=b1`。
9. **`env hook` 只对指定键生效**：`jump_height` 之外（`gravity`/`screen_w`/`screen_h`/`difficulty`）
   的 `set` 只有 `dataset_change` 一条日志，锁住「键钩子按名查找、整体回调对所有托管键生效」。

### 6.9.96 `entity`（差分 2326 行，可执行变异 750/750 全杀；另有 67 条本主题不可观测，见 spec 头部）

harness op：

- `env dataset <键字面量> <值字面量>`（真 `WorldDataset` 的 `set`）、
  `env bg <键字面量> <值字面量>`（`world.bg.data.dataset` 那一层）、
  `env team s "<队伍>"`（宿主 `new_team` 的返回值）。
- `run make <数据字面量>`（新实体）、`run reset <数据字面量>`（同一实体重跑 `reset`）。
- `run frame <帧字面量>`（直接换 `this.frame`，用来观察帧层：`state`/`bot_ignore`/`dataset`/
  `on_dead`/`on_exhaustion`/`id === "gone"`）。
- `run get <字段>` / `run set <字段> <值字面量>`（字段表见下）。
- `run slots`（`stat_slots()`）、`run armor`（重跑 `reset_armor()`）、
  `run catch <数字>` / `run addcatch <数字>` / `run catching`、
  `run role <值字面量>` / `run autorole`、
  `run dataset <键字面量>` / `run itrfall <itr 字面量>`、
  `run ctrl none|base|base_released|human|human_bare|bot|same`、
  `run hook dead|gravity <值字面量>|none`、`run summaries`。
- 物理层（9b 追加）：
  `run setvel <x> <y> <z>`（三个 `Value` 字面量，`u`/`z` 就是 `undefined`/`null`，
  用来区分「跳过写」与「写进去」）、`run leaveground`（`leave_ground()`）、
  `run pos <x> <y> <z>` / `run ground <数字>`（窥视写 `position` / `_ground_y`，
  因为 `set_position` 属于 World 切片）、
  `run link bearer|catcher|holding|catching self|none`（`bearer`/`catcher` 等是公开字段）、
  `run gravity`（`handle_gravity()`）、
  `run gdecay <factor>`（`handle_ground_velocity_decay`，`u` 触发默认 1）、
  `run vdecay <accx> <accz> <factor>`（`handle_velocity_decay`，`u` 分别触发
  `accz = accx` 与 `factor = 1`）、
  `run velocity <vinfo 字面量>`（`update_velocity`，`o <对数>` 直接给键值对）、
  `run land <帧字面量>|self`（`self` 把 `_landing_frame` 指向当前帧对象本身）、
  `run keys <LR> <UD> <jd>`（重建 base 控制器并按需按下 `L/R`、`U/D`、`d/j`，
  使 `LR`/`UD`/`jd` 分别为 -1/0/1）。
- 帧查找 / 标志层（9c 追加）：
  `run prev`（`get_prev_frame()`）、`run findframe <id 字面量>`、`run autoframe`、
  `run align <id 字面量> <src 字面量> <dst 字面量>`、`run suddenframe`、`run caughtframe`、
  `run facingflag <flag 字面量>`、`run waitflag <wait 字面量> <帧字面量>`、
  `run framewait <帧字面量>`、`run waitblock <裸数字>`（写 `_from_wait_block`）、
  `run buddy <数据字面量>` / `run buddyset <字段> <值字面量>`（第二个实体，用来让
  catcher 与 bearer 有不同朝向）、`run link … buddy`。
  `run hook` 追加 `frameid|autoframe|sudden|caught` 四个子命令，其中 `frameid` 多一个
  `echo` 形式（把入参原样返回，锁「传进钩子的是查找 id」）；`run hook none` 清空六个钩子。
- 快照层（9d 追加）：`run snap`（当前 `to_snapshot`）、`run snapbuf`（把当前快照存进缓冲区）、
  `run snappoke <槽位名> <值字面量>` / `run snappokestr <槽位名> <值字面量>`（改缓冲区的一个槽位）、
  `run snappokeid <槽位名> self|buddy`（把活实体的 id 塞进槽位，避免把 id 写死）、
  `run snapapply`（把缓冲区喂给 `read_snapshot` 并打印回读后的快照）、
  `run copy <字符串>`（`copies.add`，打印 `added=b0|b1`）、
  `env data <id 字面量> <数据字面量>`（填 `lfw.datas.find` 的表）。
- 恢复层（9e 追加）：`run rec <stat|hp|mp|toughness|fall|defend>`（直接调那六支恢复函数）、
  `run set atom_time <数字>`（窥视写 `_atom_time`）。
  这两组 op 配合 9d 的 `snapbuf` / `snappoke` / `snapapply` 精确摆位 `Times` 的五个槽位。
- 标记 / 发射者层（9f 追加）：`run mark <键> <值> [prev]`、`run delmark <键> [值]`
  （都打印 `v=b0|b1` 与**排序后**的 marks 转储 `k:v,k2:v2`）、
  `run ally self|buddy`（同时打印双方的 `team`）、
  `run emit <下标> <id 字面量>` / `run emitid <下标> self|buddy`（写发射者数组，
  后者塞活实体的 id 以免写死）、`run getemitter <下标>`（渲染解析到的实体，`u` 表示解析不到）、
  `run opointz <self|buddy|null> <opoint 字面量>`（同时打印 `state`）。
- 状态接线层（9g 追加）：`run reg <数字>` / `run regbare <数字>` / `run regkey <键字面量>`
  （往 harness 自己的 `States` 里注册「会打日志的假状态」/「没有钩子的裸 `State_Base`」/
  任意键的假状态）、`run setstate <数字>` / `run setstateb <数字>`（`set_state`，
  后者作用于 buddy）、`run statesdump`（按插入序打印注册表的 `键:类名`）、
  `run resetstates <数据字面量>`（`reset(data, states)`，与不带注册表的 `run reset` 对照）。
  `run hook …` 语义不变，只是改成配置假状态的钩子开关。
- v_rest / 关系层（9h 追加）：`run vrest <aid> <kind> <rest>`（构造一条只填
  `aid`/`itr.kind`/`rest` 的 collision 再 `add_v_rest`）、`run vrestget <aid>`、
  `run vrestdel <aid>`（三个都打印三张表的大小 `n/b/s` 与 `g=<get_v_rest>` 回读）、
  `run vrestdump`（**按键排序**打印三张表，每条渲染成 `键:kind:rest`）、
  `run flag <self|buddy>`（`get_flag`，同时打印双方的 `team` 与自己的
  `_data.type` 原文与 `hp`）、`run cleanhold` / `run cleancatch` / `run dropcatch`、
  `run blinkgone <数>` / `run blinkrespawn <数>`（打印 `blinking` 与 `_after_blink` 窥视值）、
  `run itrground <数组字面量>`（`update_itr_bdy_hit_ground`，顺带打印 `position`/`ground_y`）、
  `run linkb <字段> <self|buddy|null>`（`run link` 的 buddy 镜像，回指必须能双向摆位）。
- 帧进入链 / 位置层（9i 追加）：`run setpos <x> <y> <z>`（`set_position`，三个都是
  `Value` 字面量）、`run updatepos`（`update_position`）、
  `run setframe <帧字面量>`（`set_frame`，打印 opoint 的 `interval_id` 列表）、
  `run enter <帧字面量> [b 0|1]` / `run enternext [b 0|1]`（拿当前帧的 `next`）/
  `run enterid <id 字面量> [b 0|1]`（`enter_frame_by_id`）、
  `run followbearer` / `run followcatcher`、`run drop`（`drop_holding`）、
  `run pick`（`pick(*buddy)`）、`run transform <data 字面量>` / `run transnext`
  （`transform` / `transfrom_to_another`）、`run terrain <地形字面量>`（换 `terrain`，
  用于 `Ground::y`）、`run vratt <aid> <px> <pz>`（只写阻挡者的 `attacker.px/pz`
  以便 `update_position` 的 blockers 分支可观测）、`run copyself`（把自己塞进
  `copies`）、`run frameb <帧字面量>`（写 buddy 的当前帧）、
  `run bkeys <LR> <UD> <jd>`（`run keys` 的 buddy 版：`follow_*` 里有一项速度乘
  **对方控制器**的 `UD()`）。
  `run hook` 追加 `viewpos|viewframe|viewenter`：假状态在 `enter` 里调
  `EntityStateView` 的三个转发（本主题唯一能驱动它们的入口），
  `view_busy` 防止 `set_frame` 触发的状态进入再回调成环。
  观察点同时扩到「进入的帧 / 被放下侧的状态 / 挑选计数」：
  `itrground` 的 `f=`/`w=`、`dropcatch` 的 `f=`、`drop` 的 `bf=`/`bpv=`、
  `pick` 的 `bdr=`/`bf=`、`follow*` 的 `f=`/`dr=`、`setframe` 的 `p=`/`bp=`、
  `summaries` 的 `p <id>:<picking_sum>`。

输出：

- `run make|reset || id=<id> | <日志>`；
- `run get <字段> || <日志> | v=<值>`、`run set <字段> <入参> || <日志> | v=<值>`；
- `run slots|armor|catch|addcatch || <日志> | v={<槽位对象>}`；
- `run frame <帧> || <日志> | v=<帧>`、`run dataset <键> || <日志> | v=<值>`；
- `run role|autorole || <日志> | v=[<name_visible>,<wakeup_invuln>,<dead_gone>]`；
- `run ctrl <种类> || <日志> | v=base|human|bot`；
- `run summaries || <日志> | graves=<数> items <id>:<hp_lost>/<mp_usage> …`；
- `run setvel <x> <y> <z> || <日志> | v=<velocity> pv=<prev_velocity> g=<is_on_ground>`；
- `run leaveground || <日志> | p=<position> g=<is_on_ground>`；
- `run pos … || <日志> | p=<position>`、`run ground … || <日志> | g=<ground_y>`；
- `run link <字段> <to> || <日志> | b=<bearer?> c=<catcher?>`；
- `run gravity || <日志> | v=<velocity>`（同样打印 `pv`/`g` 的变体见
  `gdecay`/`vdecay`/`velocity`）；
- `run gdecay <factor> || <日志> | v=<velocity> pv=<prev_velocity>`；
- `run vdecay <accx> <accz> <factor> || <日志> | v=<velocity> pv=<prev_velocity>`；
- `run velocity <vinfo> || <日志> | v=<velocity> pv=<prev_velocity> g=<is_on_ground>`；
- `run land <帧>|self || <日志> | v=<landing_frame>`；
- `run keys <LR> <UD> <jd> || <日志> | lr=<0|1|-1> ud=<…> jd=<…>`；
- `run prev || <日志> | v=<prev_frame>`；
- `run findframe <id> || <日志> | v=<帧>`、`run autoframe || <日志> | v=<帧>`；
- `run align <id> <src> <dst> || <日志> | v=<{id:…}>`；
- `run suddenframe || <日志> | v=<帧 id 或 NEXT_FRAME_AUTO>`；
- `run caughtframe || <日志> | v=<帧 id> p=<position>`；
- `run facingflag <flag> || <日志> | v=<新朝向> f=<当前 facing>`；
- `run waitflag <wait> <帧> || <日志> | v=<新 wait> w=<当前 wait>`；
- `run framewait <帧> || <日志> | v=<算出的等待>`；
- `run waitblock <数字> || <日志> | v=<b0|b1>`；
- `run snap|snapbuf|snapapply || <日志> | n=<105 个 num 槽位> s=<17 个 str 槽位>`
  （枚举顺序、逗号分隔，共用 `render`，数字带位模式）；
- `run snappoke <槽位名> <值> || <日志> | v=<值>`、`run snappokestr … || <日志> | v=<值>`；
- `run snappokeid <槽位名> <self|buddy> || <日志> | v=<该实体的 id>`；
- `run rec <哪种> || <日志> | hp=… hpr=… mp=… mpmax=… r=… t=… tr=… fv=… dv=…`；
- `run copy <字符串> || <日志> | added=<b0|b1>`；
- `run mark|delmark <键> … || <日志> | v=<b0|b1> marks=<排序后的 k:v 列表>`；
- `run ally <self|buddy> || <日志> | v=<b0|b1> team=<自己队伍> other=<对方队伍>`；
- `run emit <下标> <id> || <日志> | n=<发射者数组长度>`、
  `run emitid <下标> <self|buddy> || <日志> | n=<发射者数组长度>`；
- `run getemitter <下标> || <日志> | v=<实体或 u>`（渲染成 `{"id":s"…"}`）；
- `run opointz <self|buddy|null> <opoint> || <日志> | v=<返回值> state=<当前 state>`。
- `run reg|regbare|regkey … || <日志> | n=<注册表大小>`、
  `run statesdump || <日志> | v=<键:类名 列表>`；
- `run setstate|setstateb <数字> || <日志> | n=<注册表大小> st=<b0|b1>`；
- `run resetstates <数据> || <日志> | id=<新 id>`；
- `run vrest <aid> <kind> <rest> || <日志> | n=<vrests 大小> b=<blockers 大小> s=<superpunchs 大小> g=<该 aid 的 rest>`；
- `run vrestget|vrestdel <aid> || <日志> | n=… b=… s=… g=…`；
- `run vrestdump || <日志> | n=[键:kind:rest,…] b=[…] s=[…]`（两侧都按键排序）；
- `run flag <self|buddy> || <日志> | v=<位组合> t=<自己队伍> ot=<对方队伍> ty=<_data.type 原文> h=<hp>`；
- `run cleanhold|cleancatch || <日志> | sh=<b0|b1> sb=… sc=… sr=… bh=… bb=… bc=… br=…`（八位关系探针）；
- `run dropcatch || <日志> | v=<b0|b1> sh=… br=…`（同一套八位探针）；
- `run blinkgone|blinkrespawn <数> || <日志> | bl=<blinking> ab=<after_blink 或 null>`；
- `run itrground <数组> || <日志> | p=<position> g=<ground_y> f=<帧 id> w=<wait>`
  （9i 之后 `enter_frame` 已是真方法，进入的帧直接从 `f=` 读，不再有缝日志）；
- `run linkb <字段> <to> || <日志> | sh=… br=…`（八位关系探针）；
- `run setpos <x> <y> <z> || <日志> | p=<position> pv=<prev_position> g=<ground_y>`；
- `run updatepos || <日志> | p=<position> pv=<prev_velocity> v=<velocity>`；
- `run setframe <帧> || <日志> | f=<帧 id> pf=<上一帧 id> lf=<landing_frame> ar=<arest>
  mt=<motionless_ticks> in=<invisible> bl=<blinking> iv=<invulnerable>
  op=[<opoint 的 interval_id 列表>] p=<position> bp=<被放下侧 position 或 z> <八位关系探针>`；
- `run enter|enternext|enterid <入参> [b 0|1] || <日志> | r=<gone|notfound|entered|fallback>
  f=<帧 id> w=<wait> fa=<facing> bl=<blinking> pf=<上一帧 id> ar=<arest> mt=<motionless_ticks>`；
- `run followbearer|followcatcher || <日志> | p=<position> pv=<prev_position>
  v=<velocity> fa=<facing> team=<队伍> f=<帧 id> dr=<dropping>`；
- `run drop || <日志> | <被放下那一侧的 position> <team> <dropping> <bearer?> <holding?>
  <vrests 数> bf=<帧 id> bpv=<prev_position>`（前面还有八位关系探针，`held=[…]`，
  `z` 表示没有 buddy）；
- `run pick || <日志> | <八位关系探针> vrests=<武器 v_rest 数> bdr=<武器 dropping> bf=<武器帧 id>`；
- `run transform <data>|transnext || <日志> | v=<b0|b1> idx=<transform_index>
  data=<_data.id> tr=<transforms> cp=<copies 的 id 列表>`；
- `run terrain <地形> || <日志> | g=<ground_y>`；
- `run bkeys <LR> <UD> <jd> || <日志> | lr=<0|1|-1> ud=<…> jd=<…>`。

日志项（按发生顺序、逗号分隔）：`on_*_changed:<self|?>:<新值>:<旧值>`、`on_dead:<self>`、
`on_ctrl_changed:<vc>:<前一个>:<self>`（控制器渲染成 `base|human|bot|u`）、
`mark_players_alive:b0|b1`、`release_ctrl:<控制器>`、`acquire_ctrl`、
`create_ctrl:<data id>:<player id>`、`judge:<判定值>`、`apply_opoints:<打碎件>`、
`play_sound:<音效>`、`broadcast:<消息>`、`state_on_dead`、`state_on_restrict`。

`run get`/`run set` 认得的字段（两侧同名）：
`id`、`origin_data_id`、`hp/mp/hp_r/hp_max/mp_max`、`resting/resting_max`、
`fall_value/fall_value_max`、`defend_value/defend_value_max/defend_ratio`、
`toughness/toughness_max/toughness_resting/toughness_resting_max`、
`catch_time_max`、`reserve`、`blinking/invisible/invulnerable/arest`、
`outline_color/outline_alpha/outline_width/outline_enabled`、`mix_color/mix_strength/greyscale`、
`name/team/variant`、`bot_ignore/group/state/type/base_type/weight/gravity/itr_motionless`、
`frame/prev_frame/data/armor/dead_join/transforms/itr/bdy/drink/ref/ctrl`、
`emitter/src_emitter`、`lifetime/spawn_time/render_effect_time`、
`mounted/ghosted/stat_bar/wait/facing/motionless/shaking/fallinjury/throwinjury`、
`name_visible/wakeup_invuln/dead_gone/ctrl_visible/puppet/is_on_ground`、
`jumping.x|y|z|t`、`aabb_min_x/aabb_max_x/l_len/r_len`、
物理层追加：`velocity/prev_velocity/position/prev_position`（`{x,y,z}`）、
`dvx/dvy/dvz`、`atom_time`、`landing_frame`；帧查找层追加：`from_wait_block`（`b0`/`b1`）；
快照层追加：`dismiss_time`、`dismiss_data`、`catching`/`catcher`/`bearer`/`holding`
（后四个渲染成 `{id}` 或 `null`），`landing_frame`/`transforms`/`dead_join` 同时可 `set`。

覆盖面（杀掉全部 115 条变异的关键）：

1. **`reset()` 的每个槽位都有读数**：默认值段一次读 30 多个 getter，
   加上 `run slots` 的 9 个私有槽位（`catch_time`、`toughness_r_value`、
   `fall_r_value`、`defend_r_value`、五个恢复 tick 的 `max`），
   所以「漏初始化 / 初始值写错 / 从数据集快照错」都会露。
2. **`??` 与 `||` 的分界**：`env dataset` 改掉 `hp_max`/`mp_max`/`resting_max` 后
   `run get` 仍读构造时快照（`_hp_max` 家族），而 `run dataset <键>` 直接读四层回退；
   `armor n 0` 用例锁 `armor || null`；`group`/`player.name` 的空值锁 `||` 的真值语义。
3. **严格相等的静默**：`reserve n 7` 连打两次、`arest n 1.5` 连打两次、
   `catch n 0` 连打两次、`resting/toughness_resting` 的 `1.00049`（取整后不变）
   都是空日志，同时紧随其后的 `run get` 证明值确实存下来了。
4. **`fall_value`/`defend_value` 的「未取整比较 + 取整存储」**：
   `fall_value n 20.00049`（当前 20）必须**发通知且存 20**。
5. **下降时的连锁恢复顺序**：先 `on_resting_changed` 再自己的通知；
   `toughness` 下降时 `toughness_resting` 被抬到 `toughness_resting_max`（无通知）。
6. **`hp` 的死亡分支逐守卫**：`hook dead` 打上状态钩子；`d2` 有 `brokens`/`dead_sounds`
   → `apply_opoints` + `play_sound`；把 `frame.id` 换成 `"gone"` 或把 `state` 换成 `9998`
   → 两条都不打；帧层 `on_dead` 优先于数据层（`fod6` vs `dod6`）；
   `mp` 的耗竭分支同理（帧层 `on_exhaustion`）。
7. **摘要**：`run summaries` 在每次 hp/mp 下降后打 `id`/`hp_lost`/`mp_usage`，
   锁「累加而不是覆盖」「`is_independent(team)` 才记队伍一份」（队伍 `"12"` 那段）。
8. **人类控制器的活着通知**：`mark_players_alive` 只在「人类控制器 + 跨过 0」时打；
   `hp` 从 50 到 0（base 控制器）不打，切到 `human` 后再降到 0 才打 `b0`。
9. **控制器三态**：`none`（`undefined` → 提前返回，不打日志）、`same`（同一对象 → 提前返回）、
   `base_released`（`d` 键 `_d_time > _u_time` → `gravity` 走 `gravity_d` 那一支，
   配合 `env dataset` 把两个键设成 1 与 2 就能分辨）、`human_bare`（无名玩家 → `Player 9`）。
10. **`run reset` 的重入**：重设后 id 变新、`origin_data_id` 换、`reserve`/`outline_*`/`name`
    复位、`render_effect_time` 归零、`callbacks.clear()` 让随后的 `run set` **完全静默**、
    `name_visible`/`dead_gone` 由 `auto_key_role()` 重算。
11. **`run armor` 的通知顺序**：`on_toughness_max_changed` 在 `on_toughness_changed` 之前
    （对应 TS 的 `this.toughness = this.toughness_max = …`）。
12. **`frame` 层**：`state`/`bot_ignore`/`dataset`/`on_exhaustion`/`on_dead` 都从帧上读，
    与 `bg`/`base`/`world` 三层组成四层回退（`env bg` 设 55、base 30 → 读 30）。
13. **`set_velocity` 的跳过与写入**：`run setvel u z u` 什么都不改（`prev_velocity` 也不动），
    `run setvel n 0.1235 u u` 证明写入前 `round_float`（千分位）；
    `run setvel n 1 n 0 u`（y = 0）**不**触发 `leave_ground`（`is_on_ground` 保持 `b1`），
    `n 2` 触发且 `position.y` 被抬到 `ground_y + 0.1`。
14. **`leave_ground` 的 `eqlt` 窗口**：`pos 5 / ground 5` 必须把 y 抬到 `5.1`；
    `7 > 5`、`5.1 > 5` 都不动 y；每次都把 `is_on_ground` 清成 `false`。
15. **`dvx/dvy/dvz` 的四种形态**：缺键 → `u`、`dvz z` → `z`、`fvx_f` 缺失 → `NaN`、
    `fvx_f = 0.5` 时 `5 → 2.5`（`dvy` 走 `bg` 层、`dvz` 走 `env dataset` 的 `0.25`）。
16. **`handle_gravity` 的五守卫 + 三态开关**：`motionless`/`shaking`/`bearer`/`catcher`
    各有一条「值不变」的读数；`pos 0 / ground 0` 与 `pos -1` 都不掉速度；
    `gravity_enabled: b0` 与 `z`（null）都不掉，「缺键」（默认 `true`）掉；
    `d` 键按下时用 `gravity_d`、松开时用 `gravity`。
17. **落地区分与摩擦三件套**：`land self`（同一对象）用 `land_friction_*`，
    `land` 成等值但不同一的对象用 `friction_*`；`gdecay n 2` / `gdecay n 0.5`（指数）
    / `gdecay n 0` 与默认 `u` 各一条。
18. **`handle_velocity_decay` 的双钳位**：`keys 0 0 0` 时 `ctrl_x/ctrl_z` 把目标速度清零
    （钳到 0）；`keys 1 0 1` 时保留帧值（钳到 ±dvx/dvz）；`keys 0 1 0` 只放开 z；
    `keys -1 0 0` 走 `x += accx` 一支；`dvx: null` 把 **null** 写回（该轴不动），
    `x == dvx` 且 `accx` 为 `NaN` 时也不动。
19. **`update_velocity` 的九种 `SpeedMode`**：`Default`（含负值软目标）、`Extra`、
    `Fixed`、`FixedAcc`、`Acc`、`FixedLf2`、`AccTo`（含「已超过目标不动」）、
    `FixedAccTo`（不吃方向）、`vxm s "4"`（宽松相等命中）与 `vxm` 缺省（= `Default`）。
20. **加速度补默认**：`AccTo` + `acc_x` 缺失/`z`（null）→ 取 `dvx`；`acc_x n 0` → 不取
    （`0 == void 0` 为假）→ `calc_v` 拿到 0 加速度 → 原地不动。
21. **控制器分派**：`run keys` 造出 `LR/UD/jd` 的 -1/0/1，配合 `ctrl_x/y/z`
    的 0/1/2/3 覆盖「`!ctrl` 用 `facing`」「`Control` 用 `LR|UD|jd` 当方向」
    「`Enable`/`Disable` 一律 1」「`LR/jd/UD == 0` 时 `Control`/`Disable` 不命中」。
22. **`update_velocity` 的写回**：只写 `velocity`（不动 `prev_velocity`）、
    写回时再 `round_float`（`0.1 + 0.2` 必须回到 `0.3`）、`vy > 0` 也不 `leave_ground`
    （`run set is_on_ground n 1` 之后仍是 `b1`）。
23. **`atom_time` 的三个缩放点**：`env dataset atom_time n 2` 之后新建的实体
    （`run get atom_time` = 2）验重力 `v -= g * 2`、摩擦 `pow(f, 2)`、`acc_* *= 2`。
24. **`findframe` 的严格 `switch`**：`run findframe u` → 当前帧；`run findframe z`
    **不**走 `case void 0`，而是查 `frames["null"]`（查不到 → auto 帧），两条结果不同即证严格；
    `s "none"`/`s "self"` → 当前帧，`s "auto"` → auto 帧，`s "gone"` → `GONE_FRAME_INFO`，
    `s "nope"` → auto 帧，`n 7` 走数字键查表。
25. **钩子返回值的真值判定**：`run hook frameid s "hookf"` 命中（连 `n 0` 穿透）、
    `run hook frameid n 0` 落到 switch；`run hook frameid echo` 把入参原样返回，
    于是「传进去的是查找 id」与「传进去的是实体 id」会打出不同结果。
26. **`find_auto_frame` 的 nullish 链**：`hook autoframe z` 穿透到 `frames["0"]`；
    `frames o 1 "0" n 0` 时返回 `0`（假值也算命中，不回退当前帧）；`frames` 清空 → 当前帧。
27. **`find_align_frame` 的对齐**：命中（`(idx + 1) % dst.length` 回绕）、
    未命中（`indexOf` 得 -1 → `dst[0]`）、只有 `dst` 有长度 → `dst[0]`、
    `dst` 为空/`z` → `find_auto_frame()`。
28. **`prev` 读写**：`_prev_frame` 初值 `u`，`run land`/`run set` 之后可读回。
29. **`suddenframe`/`caughtframe` 的 `||` 兜底**：钩子返回 `0`/`""` 也落到
    `Defines.NEXT_FRAME_AUTO`（与 `findframe` 的 `??` 链区分）；无钩子时直接读常量。
30. **`caughtframe` 的就地抬升且不取整**：`ground_y = 0.1235`、`position.y = 0` →
    抬到 `1.1235`（`p=` 打出未取整值）；`position.y = 5 > ground_y` 时不动。
31. **`facingflag` 的 12 支矩阵**：`3`(Ctrl) 在 `LR = -1/0/1` 三态、`6`(AntiCtrl) 同三态、
    `2`(Backward)、`-1`/`1`(Left/Right)、`7`(VX) 与 `8`(AntiVX) 在 `vx > 0 / < 0 / == 0`
    三态、`9`(Trend) 的「`LR` 优先于 `vx`」与 `LR == 0` 回退、default 支的
    `u`/`s "3"`/`n 3.5`（非数字/非枚举值一律回 `facing`）。
32. **`4`/`5` 是共用别名**：`link catcher buddy` 时 4/5 跟着 buddy 的朝向（`-1/0/2`）；
    把 catcher 清空、改把 buddy 接到 `bearer` 上，4/5 仍**忽略 bearer** 回退 `this.facing`
    —— 这就是「catcher 支在前、bearer 支是死代码」的判别力来源。
33. **`waitflag` 的四级判定**：`u`+帧与 `z`+帧都命中第一支（宽松 `== void 0`）、
    `n 3` 走 `is_positive`、`s "3"` **不**算正数（`is_positive` 只认 number）、
    `s "i"` 与「没有帧」都回 `this.wait`、`s "d"` 走差值支（帧缺 `wait` → `NaN` 被
    `max(0, …)` 留下）、其余字符串/对象走 `get_frame_wait`。
34. **`framewait` 的两半**：`env dataset wait_offset` 参与求和；`run waitblock 1` +
    `atom_time 2` 之后必须减 **`_atom_time`**（写成常量 1 会被杀）。

35. **全槽位 poke 往返（本片的骨干）**：`snapbuf` → 105 次 `snappoke`（每个 num 槽位一个
    互不相同的值）+ 17 次 `snappokestr` → `snapapply` → `snap` 必须把 105 + 17 个值
    原样回显，随后 60 多个 `run get` 再从实体侧确认一遍。任何「写错槽位 / 漏写槽位 /
    读错槽位 / tick 块落错位置」都会露。
36. **`?? NaN` 槽位与裸槽位的两分**：`RESTING_MAX` / `FALL_VALUE_MAX` / `DEFEND_VALUE_MAX` /
    `DEFEND_RATIO` / `CATCH_TIME_MAX` / `DISMISS_TIME` 各喂一次 `n NaN`：写侧是
    `x ?? NaN`、读侧是 `num_or_null`（NaN → null），于是 `run snap` 打回 `NaN`、
    `run get` 落到数据集默认；再喂一次普通数字，六个槽位都要变成该数字。
    `MP_MAX` 与 `HP_MAX` 则相反：`z` 进去出来还是 `null`（`run snap` 打 `null`、
    `run get` 落到数据集默认），`HP_MAX n 7.5` 打 `7.5`。
37. **布尔四件套是 `!== 0`**：两段场景用**不同真值模式**（`0 / 2 / 0 / z` 与 `z / 0 / 5 / 0`）
    覆盖 `BOUNCED` / `DROP_HURTED` / `DROPPING` / `IS_ON_GROUND`：
    `null` 必须变 **true**，`2`/`-1`/`5` 也是 true，只有 `0` 是 false；
    于是「取反」与「收成 `truthy`」两种变异都被杀（`DROP_HURTED` / `DROPPING` 各补一次
    `z`，否则两者在数字 poke 下无法分辨）。
38. **`copies` 的 Set 语义**：三次 `run copy`（`c1`、`c2`、`c1`）打出 `added=b1/b1/b0`；
    `COPIES = "b,a,b"` → 去重且保序成 `b,a`；`COPIES = "x,"` → 多出一个空成员
    （`x,` 两个成员）；空串 → 清空。
39. **`transforms` 的双重条件**：1 元素数组（`TRANSFORM_0` 有值、`TRANSFORM_1` 必须为空）、
    两个 id 只有一个能查到（→ `null`）、两个都能查到（→ 2 元素数组）、第一个为空（→ `null`）。
40. **`dead_join` 的 JSON 往返**：`run set dead_join o 2 d n 3 kids a 2 n 1 s "x"` 之后
    `run snap` 的 `DEAD_JOIN` 槽位是 `JSON.stringify` 的结果；`snappokestr DEAD_JOIN s ""`
    → null；`snappokestr DEAD_JOIN s "{\"d\":5}"` → `json_parse` 回读成对象。
41. **实体引用槽位**：`link catcher buddy` / `link bearer none` / `link catching self` /
    `link holding buddy` 之后 `run snap` 的四个 id 槽位分别是 `b1` / `''` / 自身 id / `b1`，
    `run get` 反向确认（`{id}` 或 `null`）；再用 `run snappokeid`（把活实体 id 塞进槽位）
    构造两段**四个槽位两两不同**的场景——`catching=self / catcher=buddy / bearer=self / holding=self`
    与 `catching=buddy / catcher=self / bearer=self / holding=buddy`——把「四个槽位互相读错」
    以及「`holding = catcher`」这类变异全部杀掉。
42. **`read_snapshot` 全程静默**：每一行 `run snapapply` 的回调日志都必须是空的——
    它直接写私有字段，不走 setter。
43. **赋值顺序（id / data → 帧查找）**：`env data` 的记录自带 `frames` 表（`f-7` / `f-8`）；
    `DATA_ID → "d1"` 之后再 `FRAME_ID → "f-7"`，`run get frame` 必须拿到**新数据**的帧；
    `FRAME_ID → "f-8"` + `PREV_FRAME_ID → "f-7"` 让当前帧与前帧是**两个不同对象**，
    才能分辨「帧槽位读了前帧」这类错位；`FRAME_ID → "nope"` 落到 auto 帧；
    `FRAME_ID → "gone"` 给 `GONE_FRAME_INFO`；`LANDING_FRAME_ID → ""` 给 `null`、
    `→ "auto"` 给 auto 帧。
44. **字符串槽位的压平**：`NAME = ""` → `run get name` 是 `null`；`AFTER_BLINK` poke 非空值
    必须出现在快照里；`DISMISS_DATA_ID` 能查到就写 `dismiss_data`、查不到就写 `null`、
    空串则跳过查找；`TEAM` 原样保留（不做空串 → null）。

45. **`Times` 门控**：`hp_r_ticks = 3` 时连续三次 `rec hp` 只有第三次真的加血
    （前两次 `add` 返回假）——「不判断门控直接加」会被杀；把 `HP_R_TICK_REMAINS` 通过
    快照设成 0 之后**永远**不再触发（`Times` 的耗尽语义）。
46. **两段式分支与帧开关**：`toughness_recovering` / `stat_recovering` 的排空支
    需要 `frame.toughness_recover` / `frame.stat_recover`；`run frame` 把它设成 `b0` 时
    排空支必须原地不动、设成 `b1` 时按 `_atom_time` 排（`atom_time = 2` 时一次排 2），
    并夹在 `0` 与各自的 max 之间。
47. **getter 兜底的 NaN 传染**：`env dataset mp_r_ratio u` / `hp_r_value u` 之后
    比率与增量都变 `NaN`，`set_*` 照写 `NaN`（位模式 `nan`）——锁「夹取/取整丢掉了 NaN」。
48. **`hp_recovering` 夹的是 `_hp_r`**：快照把 `HP_R` 设成 30（`hp_max` 是 40）后
    `hp = 25` + 增量 7 必须停在 30 而不是 32（后者会被 `set hp` 的 `hp_max` 夹住看不见），
    `run get hp_r` / `run get hp_max` 把两个上限都摆出来。
49. **`mp_recovering` 的四个守卫**：`_hp = 0`、`_mp = mp_max`、`blinking = 1`、
    `invisible = 1` 各一条「值不变」的读数，其中后两个走 `truthy`。
50. **比率公式的 500 夹取**：`HP = 520 / HP_MAX = 600` 且 `mp_r_ratio = 1` 时，
    夹后 `min(500, 500) = 500` 给出 `+1`，不夹则 `min(520, 600) = 520` 给出 `+2`。
51. **三位小数取整**：`mp_r_ratio = 0.33333333333`、`HP = 12 / HP_MAX = 200` 时
    `(200 - 3.99999999996) / 100 = 1.9600000000004` 必须被 `round_float` 收成 `1.96`，
    harness 打印数字的位模式所以能分辨；`min`/`max`、`/100` vs `/10`、少了 `+1`
    同样在这条与相邻场景里被杀。
52. **写入必须走 setter**：六支恢复函数的每个赋值在正确实现里都会打
    `on_hp_changed` / `on_mp_changed` / `on_toughness_changed` 等日志，
    「直接写私有字段」的变异在 `run rec` 行的日志里立刻露。
53. **四个 tick 区间互不相同**（`hp_r_ticks 3` / `mp_r_ticks 2` / `toughness_r_tick 2` /
    `fall_r_ticks 5` / `defend_r_ticks 4`），任何「读了别的数据集键 / 用了别的 tick」
    都会在门控次数上错位。
54. **标记的宽松 `==`**：先存 `k9 = "3"`，再用 `run mark k9 ok n 3`（数字 3）命中
    `set_mark`；`k7 = "7"` + `run delmark k7 n 7` 命中 `del_mark`
    （第一轮变异就是在这条上活下来，补了这一对场景才杀掉）——「严格比较 / 不看 prev /
    把 null 当期望值」三种写法都会在这些行分叉；`run mark kZ v s ""` 则是
    「缺键不该等于空串」的反例。
55. **`del_mark` 的返回值就是 `Map.delete`**：`kd` 存在时「prev 不匹配 → `b0` 且不删」、
    「`z` → `b1` 且删掉」、「无 prev → `b0`（已删）」三连，
    转储在每一步都跟着变，所以「删了却报 false」「报了 true 却没删」都必须露。
56. **`is_ally`**：队伍相等 / 不等 / 空串相等 / `"x"` 四条读数，
    再配合 `run buddy` 重造实体（同一实体 `self` 恒真）——「比较对象写错」「恒真」「取反」被杀。
57. **发射者下标的 JS 语义**：`0`（指向 buddy，能解析）、`1`（先 `"nobody"` 查不到
    → `u`，再 `emitid 1 buddy` → 能解析）、`2`（空串 id）、`3`（越界）、`-1`（负）、
    `1.5` 与 `0.5`（分数）——「不查整数」「只看 0 号槽」「空串照查」都会露。
58. **空串 emitter id**：把实体 id 用快照窥视口改成 `""`（`snappokestr ID` +
    `snapapply`）之后 `run getemitter 0` 仍是 `u`——此时宿主 `find_entity("")`
    是能查到实体的，所以「漏了 `if (!id) return;`」立刻变成「返回那个实体」。
59. **出弹点速度的四态矩阵**：状态 `3000 / 1002 / 3006 / 2000` 各给
    `3.5`（`Defines.DEFAULT_OPOINT_SPEED_Z`），`3009` / `s "1002"` / `1002.5` /
    `z` / `u` 一律 `0`；再加上 `speedz n 7`（先胜出）、`speedz z`（原样返回）、
    `null` emitter（非 fighter）、`self` emitter（`type = 1`，非 fighter）
    与 `buddy` emitter（`type = 8`，fighter）的对照，四个分支与两个守卫全被锁死。
60. **注册表查找与兜底**：`run setstate 20`（`reg 20` 注册过）直接命中数字键；
    `run regkey s "31"` 只注册了字符串键 `"31"`，所以 `run setstate 31` 落到
    兜底键 `"1_31"`（`statesdump` 里能看到新建的 `State_Base`）——
    「数字键 / 字符串键同编码」与「兜底键格式写错」两种变异都会露。
61. **兜底按 `_data.type` 严格分派**：同一批代码在不同实体上跑出
    `s"8_40":CharacterState_Base` / `s"16_41":WeaponState_Base` /
    `s"32_42":BallState_Base` / `s"4_43":State_Base`，再加上 `type s "8"`（字符串）
    仍然得到 `State_Base`——四个类名加一条字符串类型的场景，把四个分支与「严格比较」全钉住。
62. **兜底缓存**：同一个未注册代码连打两次 `setstate`，第二次必须完全静默
    （对象同一性早退），注册表大小也不变。
63. **leave / enter 的帧**：`setstate` 时当前帧 `g1f`、上一帧 `g1p`，日志里 `leave` 必须带
    `g1f`、`enter` 必须带 `g1p`；假状态的日志自带**自己的状态键**，
    所以「leave 的是旧状态还是新状态」也能分辨。
64. **进入钩子里的整批转发**：假状态的 `enter` 一次读出 `id / frame / prev / hp / hp_max /
    mp / motionless / shaking / state / is_on_ground / team / data_type / jumping_x /
    velocity_x|y|z / position`，并在进入时调 `set_motionless` / `set_hp_r`（读回值不变）；
    18 条 `EntityStateView` 转发因此各有一条变异可杀。
65. **`reset` 清 `_state`**：激活状态 + 打开 `on_dead` 钩子后 `run reset`，
    再打空血量必须**没有** `state_on_dead` 日志。
66. **`reset` 重设 `_states`**：`run reset`（默认 `ENTITY_STATES`）之后 `setstate 71`
    （只在 harness 注册表里）静默，而 `run resetstates`（`reset(data, states)`）之后
    同样的 `setstate 71/72` 立刻打出 `n71>enter` / `s"1_72">enter`——
    `reset` 里的 `this._states = states`（9a 就抄了，但一直没有观察点）由此锁死。
67. **v_rest 的三张表与「覆盖不删旧镜像」**：`run vrest s "w2" n 6 n 4`（进
    `superpunchs`）之后 `run vrest s "w2" n 14 n 9`（进 `blockers`），`run vrestdump`
    必须显示 `vrests`/`blockers` 里是新值、`superpunchs` 里还是旧值 —— 顺带把
    「kind 交换」「键换成 `vid`」「镜像写错表」三类变异全部杀掉。
68. **kind 是严格比较**：`run vrest s "ws" s "14" n 1`（Block 的字符串形）、
    `run vrest s "w6" s "6" n 2`（SuperPunchMe 的字符串形）、`run vrest s "wu" u n 2`、
    `run vrest s "wz" z n 6` 四条都不进镜像；`run vrestdump` 的 `b`/`s` 大小不变即锁死
    `strict_equals`（两个 kind 各自换 `equals` 都会被杀：`"14"` 与 `"6"` 各锁一边）。
69. **`get_v_rest` 的真值折叠**：`n 0` 与 `n NaN` 两条 `rest` 都读回 `n0`，
    未知 id 也读回 `n0`；`del` 之后同一 id 再读仍是 `n0`，
    而 `vrestdel` 的三张表大小同时下降。
70. **key 字符串化**：`run vrest n 5 …` 与 `run vrestget n 5` / `run vrestget s "5"`
    命中同一条 —— 数字 token 与字符串 token 落到同一个 `std::u16string` 键上。
71. **`reset` 清三张表**：`run reset` 之后 `run vrestdump` 打 `n=[] b=[] s=[]`，
    再 `run vrestget s "w2"` 仍是 `n0`。
72. **`get_flag` 的位组合**：`hp = 0 / -5 / 0.5 / 10` 与 `type = 8 / 2.7 / "8" / u / -1`
    交错出场，覆盖 `<= 0` 边界、`|= Dead`、`js_to_int32(type())`
    （`2.7 → 2`、`"8" → 8`、`undefined → 0`、`-1` 淹没整数值）。
73. **关系清理的两个分支**：`run linkb bearer self` / `run linkb bearer buddy`
    （`catcher` 同理）分别覆盖「对方回指自己 ⇒ 连对方字段一起清」与
    「回指别人 ⇒ 只清自己这侧」，八位探针 `sh sb sc sr bh bb bc br` 是判据。
74. **`drop_catching` 的四个场景**：没有 `catching`（`v=b0` 且无日志）、
    回指自己、回指别人、连打两次（第二次 `v=b0`）；9i 之后 `enter_frame` 是真方法，
    「一定请求 auto 帧」由随后 `f=` 上出现的 auto 帧 id 锁住。
75. **`blink_and_*` 不走 setter**：`run blinkgone n -3` 得 `bl=-3`，
    紧跟的 `run set blinking n -3` 得 `v=n0` —— 「直接写字段」与
    「`round_float(max(0, v))` setter」的分歧就此锁死；`run snap` 另外把
    `AFTER_BLINK` 槽位纳入快照覆盖。
76. **`update_itr_bdy_hit_ground` 的四条判定**：缺 `on_hit_ground`、假值
    `on_hit_ground`、`on_hit_ground` 带缺省的 `{y,h}`、`y` 为 `z`、
    `y/h` 为字符串数字、`y` 为负、边界相等（`fG`：`3 > 3` 为假 ⇒ 进帧）、
    `centery` 缺失（NaN ⇒ 比较为假 ⇒ 仍进帧）、`ground_y = NaN`、
    以及「前一条被跳过、后一条照进」（`fM`/`fN`，`continue` 与 `break` 的分界）。
77. **`set_position` 的轴跳过与取整**：`run setpos n 1.2345 u z`（只写 x，且
    `round_float` 到千分位）、`run setpos u u u`（全跳过 ⇒ 一条日志都不打、
    `prev_position` 不动）、`run setpos s "8.5" s "9" n -0.5`（字符串数字与负数）、
    `run setpos n NaN n 0 n 0.0000001`（NaN 照写、`0.0000001` 取整成 0）——
    四个轴跳过变异与两个取整变异都被这些点杀。
78. **`set_position` 的 `prev_position` 哨兵**：`run pos` 先把 `prev_position`
    设成非 MIN_SAFE，再 `run setpos` 读回 `pv=` 证明**没有**被复制；
    实体刚 `reset` 时（`prev_position.x == MIN_SAFE`）第一次 `setpos`
    会把 `prev_position` 整体复制成 `position`。
79. **四条 restrict 请求的顺序与去重**：`run restrict o 3 x n 2 y n 3 z n 4`
    之后逐轴单独变化（`n 10 n 10 n 10`、`n 2 n 3 n 7`、`n 5 n 3 n 4`、
    `n 2 n 5 n 4`、`n 2 n 5 n 5`）把 `rx`/`rz`/`ry`/`rr` 四个帧分别拉出来；
    「只变一个轴」的场景同时锁 `||` 与 `&&`，等值轴场景锁 `!=` 的方向。
80. **`on_restrict` 的状态钩子**：`run setstate 80` + `run setframe … on_restrict`
    让状态参与，`run setpos n 70 n 80 n 90` 后位置与速度同时可见
    （速度被 `clamp_velocity` 钳到 0.5，位置走 `assign_position` 直写）。
81. **`_ground_y` 来自地形段**：`run terrain` 依次给 SlopeH / SlopeV / Flat h1 /
    未知类型 / 只有 `type`/`h1` 的退化段，`run setpos` 的 `g=` 覆盖
    `Ground::y(terrain, x, z)` 的 x/z 换参与回退。
82. **`update_position` 的 blockers 两轴四组合**：`run vratt` 把阻挡者的
    `px/pz` 摆到实体前方/后方，`vx`/`vz` 正负各一次 ⇒ 「朝阻挡者方向的轴清零」
    与 `prev_velocity` 的同轴写入各有观察点（积分用的是 `prev_velocity`，
    少写一次这一步就会偏）。
83. **`update_position` 的门与半步**：`shaking` / `motionless` 两个门分别
    开一次，`run updatepos` 的位置不变；`atom_time` 用 `run get atom_time`
    读出来验证梯形积分 `(v + prev_v) * 0.5 * dt`。
84. **`set_frame` 的 gone / interval 过滤**：`run opoints` 摆三条
    （mode 1 + k1、mode 1 + k2、mode 2 + k3），`run setframe` 带
    `opoint a 2`（k1、k3，都是 mode 1）⇒ 只剩 k1（k2 的 interval 消失、
    k3 的 mode 不对）；`run setframe o 1 id s "gone"` 清空整张表。
85. **`set_frame` 的标志与收尾**：`invisible n 0.4` / `blinking n 1.6` /
    `invulnerable n -3`（直写字段，不是钳过的 setter）、`itr` 空数组 ⇒
    `arest` 归零、`cpoint` 缺失 ⇒ 清 `catching` + `catcher`、`broadcasts` 两条、
    `holding` / `catching` 的 follow 收尾各有场景（buddy 的关系探针可见）。
86. **`enter_frame` 的四态**：`Gone`（当前帧 id 是 `"gone"`，`run enter o 1 id s "k1"`
    仍返回 `gone`）、`NotFound`（`o 0` 与 `id s "nope"`）、`Fallback`
    （`o 0 b 1` ⇒ 落到 auto 帧且 `wait` 被更新）、`Entered`。
87. **`handle_next_frame_result` 的扣血扣蓝**：`run enter o 3 id s "a1" mp n 2 hp n 3`
    在 `infinity_mp` 开/关两组里各打一次，紧跟 `run get hp` / `run get mp`
    对照；`mp_mode` 的两支与 hp 的 `<=` 边界用 `hp n 5 mp n 400 mp_mode n 0/1`、
    `run set hp n 5` 之后再来一次钉住。
88. **`get_next_frame` 的数组分支**：`run enter a 1 u`（全假项）、
    `run enter a 0`（空数组）、`run mtseed` 固定后 `run enter a 2`（无裁判 ⇒
    mt 挑一个）与 `run enter a 3`（带 `__judge` ⇒ 0 的那条被跳过、日志里少一条
    `judge:`）、`run enter o 1 id a 2 …`（id 本身是数组 ⇒ 先 mt 挑 id）。
89. **`get_next_frame` 的 `frame.next === which` 分支**：`run frame o 2 id s "f2"
    next o 3 …` 摆出 `next` 对象后 `run enternext`，`run set hp n 5` / `run set mp n 4`
    让 hp/mp 恰好命中 ⇒ 走 `hit.d ?? NEXT_FRAME_AUTO` 的跳转；
    `run frame … next o 1 id s "k2"`（`next` 没有 hp/mp）走另一支。
90. **`follow_bearer` 的两条 wpoint 公式**：`kind` 有值（走 `cx/cy/wb` 全式）与
    `kind` 缺失（走丢 wpoint 的短式）各一次；`weaponact` 不匹配时
    `enter_frame_by_id(…, true)` 把武器拉回 `b5`，hp ≤ 0 时改走 `drop_holding`。
91. **`follow_bearer` 的投掷分支**：`dvx n -4 dvy n 3 dvz n 2` + `env dataset`
    的三个 `wv*_f` + `weight n 4` + `run bkeys 0 -1 0`（对方按住 U）
    ⇒ 位置重算、`vz = UD * dvz * wvz_f`、`vx = (dvx/weight - |vz|/2) * facing`、
    对齐帧 `hx` 全部可见；`bearer` 快照 bug 就是这一场景杀的。
92. **`follow_catcher` 的两支**：`throwvx/throwvy/throwvz` 有值（投掷冲量 +
    `tv*_f` + 对方 `UD`）与全 0（贴身公式）各一次，后者的 `bcy`/`bfy`/`bcz`
    三项分别被「b 侧 cpoint 有/无」两个场景钉住。
93. **`drop_holding` 的克隆与对齐帧**：`run vrest s "vk" n 14 n 1` 之后
    `run drop`，被放下那一侧的 `vrests` 数从 0 变 1（克隆而非共享）；
    `run frameb` 的 `hl` 帧 + `on_hands`/`throwings` 让对齐帧算出来，
    另外 `run link holding buddy` 缺 `cpoint` 的场景走 `{id:"auto"}`。
94. **`pick` 的三次拒绝**：`run pick`（成功，`picking_sum` +1 且队伍摘要也 +1）、
    第二次 `run pick`（`holding` 已有 ⇒ 早退）、`run linkb bearer self` 之后
    `run pick`（武器已有 bearer ⇒ 早退）；`run summaries` 打印摘要对照。
95. **`transfrom_to_another` 的环与 copies**：`run transform` 两次 +
    `run set transforms a 1 o 4 …`（含 `frames` 245/246）+ `run enter …
    transfrom_to_another b 1` ⇒ `next_idx == 0` 时请求帧 245（`f=` 看得见，
    换 246 会被杀）；`run copy` / `run copyself` + `run set mounted` 覆盖
    「还挂着的复制体也被 `transform`」「掉队的从 `copies` 删掉」。
96. **`transform` 的控制器替换**：非 human ⇒ 打 `create_ctrl:<data id>:<player id>`，
    human ⇒ 不打（用例先 `run ctrl human` 再 `run transform`）；
    `reset()` 的 `player_id` 是 `""`，harness 的 `make_ctrl(0)` 曾经给 `"7"`
    —— 这一支就是它对齐的依据。

### 6.9.97 `MersenneTwister` 调试面 + `Cases`（差分 7747 行，变异 115/115 全杀）

- 新用例 `cases/mersenne_twister/mt_debug.txt`（133 行）；`mt_basic.txt` 不动（7614 行基线）。
- 新增 op 见 §1.2；`seed` 多了可选尾参 `d`（`reset(seed, true)`）。
- **每个观察点的作用**：
  1. `cinfo` 钉 `Cases.name` / `separator`（`\uffe5`，输出走 `esc`）。
  2. `cases` 同时打印 `submit()` 的整段文本**和** submit 之后的 `cases.length`
     ⇒ 「拼接顺序 / 分隔符 / 编号连续 / submit 清空」四件事各有独立见证；
     连打两次 `cases` 让「清空」可观察。
  3. `mark` / `debug` / `case` 三件套是条目文本的三个自由度：前缀、有无、参数。
     `case` 覆盖空参、原语（`n` / `s "a b"` / `b 1` / `u` / `z`）、数组、对象
     —— 其中 `u`/`z` 在 `join` 里必须变**空串**（`[a b,true,-0.5,,]`）。
  4. `pure` 逐字段打印（`mt.length` + `mt[0]`/`mt[1]`/`mt[623]` 三个**不相邻**的槽）：
     只拷首尾的变异会被 `mt[1]` 杀，`mt` 不拷会被 `mt[0]` 杀。
     ⚠️ TS 侧打印前先 `>>> 0`（`twist()` 之后是 signed int32 的同一批位模式，见 DESIGN §53.2-9）。
  5. `load` 每个字段一条 line：`matrix`/`upper`/`lower`/`index`/`seed`/`times`/`mt`（0·1·5·622·623）/
     `mark`；每条都回显参数 + `state` 哈希 + `mark` ⇒ 「改了哪一格」与「漏改」都可分辨。
     之后的 `int` / `float` / `state` 证明载入回来的状态**能接着抽**。
  6. `pickv` / `takev`（`Value` 版）覆盖数组（打印删除后的数组）· 空数组（走 `i >= size` 守卫）·
     非数组（原样返回）· 假值（`undefined` / `null` ⇒ `undefined`）。
  7. `creset` 之后再推两条 ⇒ `reset()` 清 `times`（编号从 1 重来）与清 `cases` 两件事都在。
  8. 调试开/关在同一用例里来回切（`debug 0` 段必须零条目，`debug 1` 段必须每条都在），
     并且 `seed 42 d` / `seed 7`（不带尾参）钉住「第二参覆盖 `debugging`」。
- **不可观测项**（6 条，已写进 `mutations/mersenne_twister.mjs` 头部）：`sus_cases` 无调用点、
  `range` 的第三参是死参数、`pure().mt` 的别名 vs 拷贝（C++ 值语义）、`load`/`reset` 的
  `*this` 返回值、`MersenneTwisterInfo` 的字段默认值、`log_entry` 与 `++_times` 的先后。

### 6.9.98 `mt.mark` 探针回填（`entity` 2363 行 / `mt_random` 158 行 / `burning_drink` 157 行；变异 759/64/41 全杀，其中 9k 新增 21 条）

- 三个 subject 各有新增观察口：
  * `entity`：`run mtdebug <valueLiteral>` / `run mtmark` / `run mtcases`
    （`| mark=<render>`、`| text=<render> n=<render>`），新用例 `mt_probe.txt`（37 行）；
  * `mt_random`：`mt dbg <name> <valueLiteral>` / `mt mark <name>` / `cases`
    （`cases` 是顶层 op，与三段式的 `mt <name> <sub>` 并列）；
  * `burning_drink`：`run mtmark`（`| mark=<render>`），TS 侧 holder 双件的
    `lfw.mt.mark` 改成 getter/setter 对并打 `holding_mt_mark` 日志（与 C++ 缝逐字对齐）。
- **`mark` 的观察有两条路**：`mt mark` 看「当前值」，`cases` 看「每一条抽取时的值」
  ⇒ 「mark 写在抽取之后」这类顺序变异靠后者杀（条目会挂到上一个 mark 上）。
- ⚠️ **`run mtseed` 会 `reset()`** ⇒ `mark` 清空、`debugging` 回 `false`；
  场景里每个 `mtseed` 之后都要重新 `mtdebug 1`，否则一条条目都没有。
- `mt_cases` 是进程内单例：`mtcases` / `cases` 输出整段文本**并清空**，
  场景按「转储即清空」排（同一 subject 的多个用例文件各自独立进程，互不影响）。
- 本刀覆盖到的 mark：`gnf_1`（id 数组分支）、`gnf_0`（数组分支；元素没有 id 时
  递归那层不会再改 mark）、`dh_v`（`follow_bearer` 的 Drop 分支）、
  `ice_piece_x` / `ice_piece_y` / `ice_piece_vx`、`r1`（`Randoming` 自带 name）、
  `drink_drop`（`CharacterState_Drink` 掉落分支）。
- `dh_1` 不可观察（原因见 DESIGN §54.1-3），已记录在 `mutations/entity.mjs` 头部。

### 6.9.99 `Entity` 的 opoint 生成簇 `spawn` / `on_spawn` / `attach`（`entity` 2479 行 = main 2326 + mt_probe 37 + spawn 116；变异 820/820 全杀，其中 9l 新增 61 条）

- 新用例 `cases/entity/spawn.txt`（116 行），16 个场景：正常生成（`se_1` → `pick(oid)`
  → `find_data` → `create_entity_with_bot` → `on_spawn` → `attach`）、同 id 进 `copies`、
  `unimportant` × `entity_count` 355/356 边界、`oid` 缺失 / `datas` 里没有这个 oid、
  `pos_type` 两支（需要非零 `centerx`/`centery` 才分得开）、`__gen_{x,y,z}` 的三态
  （有生成器 / 生成器回 undefined / 根本没有这个字段）、`__gen_{dvx,dvy,dvz,facing}`、
  hp·mp 四档覆盖（含「`max_hp` 不是数字」「只有 `max_hp`」两条）、Fixed/Extra 速度模式、
  `spawnv` 的 offset+facing、`OpointKind.Pick` 的丢弃与双向链接、`Ball_Rebounding` 的
  `lastest_collided` 替换、`attach` 的三支（ghost 标记、mounted 守卫、`frame.id == ""` → auto 帧）。
- 新增 op：
  * `env ecount <值>` / `env gtime <值>`（`world.list_entities().length` / `world.game_time` 的桩值）；
  * `env gen <kind 字面量> <值字面量>` / `env genclear`（注册 / 清空 `__gen_*` 常量发生器，
    同时挂到 opoint 与它的 `action` 上）；
  * `run spawn <opoint 字面量>` / `run spawnv <opoint 字面量> <4 个值字面量>`
    （后者给 `offset_velocity`（x/y/z）与 facing）；
  * `run spawndump`（转储**最后一次生成尝试**的实体；失败时是 `none`）；
  * `run attach <值字面量>`（对当前实体 `attach` 并转储它自己）；
  * `run lastcollided <id 字面量> <队伍字面量>`（写 `lastest_collided.attacker`）。
- **观察面**：每次生成都打印「宿主日志 + 新实体关键槽位 + 父实体的 `copies`」，
  日志里的 `create_entity_with_bot:<数据转储>` / `play_sound:<sounds>@<pos>` /
  `add_entities:<id>:<spawn_time>` 分别钉住「用了哪份数据」「进帧时的音效与位置」
  「attach 的时机与时间戳」。
- ⚠️ TS 侧工厂建出来的实体也要 `bindHostSpies`（否则它的 `play_sound` 走真实实现，
  日志里少一条）；但**不绑回调** —— 端口侧生成的实体在宿主里没有回调注册。
- ⚠️ `Ball_Rebounding` 判定读的是发射者**帧**的 `state`（`Entity.state` = `frame.state`）
  ⇒ 场景里先用 `run frame` 换成 `state: 3003` 的帧；`run setstate` 只动状态机的 `_state`。
- ⚠️ `ud = ctrl.UD()` 只在发射者 `type == 8`（`HitFlag.Fighter`）时生效 ⇒ 用例末尾把发射者
  换成 `type n 8` 的实体，并用 `run keys 0 ±1 0` 给出 `ud = 1 / -1`，否则
  `o_speedz * ud` 永远不可观察。
- 已知偏差：端口 `Entity::_team` 是 `std::u16string`，数字队伍会被字符串化（TS 保持原值）
  ⇒ `run lastcollided` 只喂字符串队伍（README 已知偏差表）。
- `Entity::apply_opoints`（opoint 列表的消费方，含 `world.list_entities` / multi / spreading /
  ball ctrl `chasing`）留下一刀；占位缝 `IEntityHost::apply_opoints` 仍在。

### 6.9.100 `Entity::apply_opoints`（opoint 列表的消费方）（`entity` 2587 行 = main 2326 + mt_probe 37 + opoints 108 + spawn 116；变异 863/863 全杀，其中 9m 新增 43 条 + 1 条按构造等价（不列））

- 新用例 `cases/entity/opoints.txt`（138 行源文件 / 108 行 trace），13 个场景：interval
  记账的四个分支（新条目 / mode=0 重复 / mode=1 命中后按 tick 早退或放行 / `interval_mode n 2`
  的未命中）、`multi` 数字（`0` / `2.5` 走浮点条件）、敌人谓词的 `max` 夹紧与 `skip_zero`、
  友军谓词（含 `src_emitter` 排除）、Emitter（`emitters` 末位 + `find_entity`）、名单里混
  非 fighter 与 fighter、`type` 不认识 / 非数字非对象（count 0）、spreading 三态 +
  `FloatRange` 覆盖速度、`inherit_speed_*`（`0` vs 缺失）、ball ctrl 的 `chasing`
  （多目标取模 / Emitter 的 `[0]` / 空名单且 `min > 0` 的 `null` / 非 ball ctrl 不写）、
  名单边界（空名单的 default `min`、`hp = 0`）、`spawn` 失败 ⇒ 后面的 opoint 连记账都不做、
  两个调用点（`set_frame` 帧里的 `opoint` 与 `set_hp` 死亡分支的 `base.brokens`）。
- 新增 / 改名 op：
  * `env ents <token>…`（候选名单，token 是 `self` / `buddy` / `sp<N>`；无参数 = 空名单）；
  * `env ballctrl b 1`（新实体的控制器按 ball ctrl 打标，读 `lfw.factory.acquire_ctrl`）；
  * `run opoints <数组字面量>`（**真调** `Entity::apply_opoints`，打印
    `n=`（记账长度）/ `itv=`（`interval_id:tick` 列表）/ 宿主日志 / 最后一次生成的实体）；
  * `run seedop <数组字面量>`（**原 `run opoints` 改名**：只往记账表里塞条目，
    9i 的 `interval_mode` 场景用）；
  * `run spawndump` 增加 `ball=b0|b1` 与 `chasing=<{"id":…}|z>`（两个都打才能看出
    「往基控制器上写 `chasing`」这件事）。
- **观察面**：`n=` / `itv=` 钉住记账，`list_entities:<key>:<count>` 钉住谓词筛出来的条数，
  `dump_spawn` 钉住「第几次生成的实体长什么样」（含 `ball=` / `chasing=`），
  `create_entity_with_bot` / `play_sound` / `add_entities` 仍是 9l 的那三条。
- ⚠️ **候选名单只记 token、筛的时候现查**：真实 `World` 每次筛的是「当前」世界里的实体，
  而 `run make` / `run buddy` 会**换掉**实体。第一版在 `env ents` 时快照裸指针 ⇒ 换过之后是
  悬垂指针 ⇒ 谓词读到释放后的内存、恰好返回 false，把「友军谓词不看 `hp`」这条真变异
  **遮成了存活**。两侧同时改成「token + 现查」（C++ `candidate_of(tok)` / TS 同款）后立刻被杀。
- ⚠️ TS 侧 `get_next_frame(undefined)` 会抛 ⇒ 用例里**每个 opoint 都必须带
  `action: {id:"0"}`**（会话侧生成器自动补）。
- ⚠️ TS 侧 `run opoints` 打印当行字面量**必须先取 `r(list)`**：`applyGens` 把生成器挂到
  opoint 上之后再转储，会把函数对象打印进去 ⇒ 两侧不同形。
- 已知偏差 / 不建模：真实 `World.list_entities` 会**按 key 缓存**筛选结果（同名第二次不再
  过谓词）—— 缓存层属 World 切片，差分 harness 每次真筛（两侧一致即可）；
  `BallController` 未移植 ⇒ `is_ball_ctrl` / `chasing` 暂放 `BaseController`，等它的刀再搬。
- 不可观察项（记录在 `mutations/entity.mjs` 头部）：`Spreading` 分支里
  `sp.x = __gen_spread_x ?? sp.x` 的回落值恒等于 0（`sp` 是刚构造的 `(0,0,0)`，且这一支里
  `sp.x` 只被这一行赋值）⇒ 回落写 `sp.x` 与写字面量 `0` 按构造等价。
- ⚠️ **发现并修掉一个 `find` 的保真缺口**（新场景「`set_frame` 的帧 `opoint`」暴露的）：
  TS 的 `find`（`utils/container_help/find.ts`）在可迭代对象上扫完元素后**还会**跑一遍
  `for (const k in p0) if (p1([k, p0[k]])) return [k, p0[k]]`（两个循环之间没有 `else`）。
  对数组来说这会把 `["0", v0]`… 交给同一个谓词；谓词按字段读时（`o => o.interval_id === x`）
  从 pair 上读到 `undefined` ⇒ 「拿 `undefined` 去比」的谓词会在元素一个都不匹配时**拿到真值**。
  `set_frame` 的 opoint 压实正是这种谓词（`find(v.opoint, o => o.interval_id === interval_id)`）
  ⇒ 端口原来的内联循环会丢掉 TS 保留的那条记账项。端口新增
  `lfw::find_array`（`utils/container_help/find.h`）把回落显式建模（元素扫完没命中就把 pair
  视图再喂同一个谓词），`set_frame` 改用它；用例里那条 `interval_mode: 1` 且没有 `interval_id`
  的记账项就是这个缺口的观察点。其余数组版 `find` 调用点的谓词对 pair 都为假（如
  `is_fighter(c.attacker)`），暂时不可观察，随各自的刀再过一遍。
- `IEntityHost::apply_opoints` 占位缝**已删除**（`State_Frozen` / `set_frame` / `set_hp` 全走
  真方法）；9i 那条锚在占位缝调用上的变异（`set_frame skips the frame opoints`）已更新锚点。

### 6.9.101 `Entity::update` / `update_ghost` 与它们的下游（`entity` 3163 行 = main 2326 + mt_probe 37 + opoints 108 + spawn 116 + update 576；变异 955/955 全杀，其中 9n 新增 92 条、另有 5 条原理可观察但本主题场景到不了；全量重跑时曾暴露 9m 名单里 1 条按构造等价的误列、已撤出）

- 新用例 `cases/entity/update.txt`（642 行源文件 / 576 行 trace），19 组场景：时钟 /
  `_lifetime` / 帧朝向 / 帧 hp·mp 消耗、`mt.case` 标记（debugging 开 / 关）、融合解散
  （成员位置同步 / `dismiss_time` 到点 / `y != 0` / ctrl 按键 / 解散后清空）、v_rest 掩码与
  整项删除、arest / invisible / invulnerable 递减、闪烁四支（只递减 / Gone / Respawn 的三条
  子路）、opoint 计时表、恢复层（stat / toughness）、wait / motionless 记账、
  wait=0 的 next / auto、子步切分（`1 / 4 / 8 / 9 / 2.5 / 0.5 / 0`）、抓人、被抓、
  控制器结果、落地判定（落 / 斜坡 / 离地 / 不可站立 / 落地伤 / 命中地面 / 关系挂起）、
  AABB（默认 / 自定义 / 朝向翻转 / facing 0）、`update_ghost`，以及本刀补的边界组
  （恢复层的可见槽位 / `blinking` 减成负数 / Respawn 的友军分支 / `dismiss_fusion` 的成员
  复位 / opoint 的字符串 `interval` / `is_on_ground` 已在岸上 / `y - ground == step` /
  `decrease * atom_time` / 被抓的五个分支 / `caught` 跟 catcher / `holding` 跟 bearer /
  三个视图转发 / ghost 的子步与 `bearer` 门）。
- 新增 / 复用的 op：
  * `env puppets <token>…`（`world.puppets.values()`，token 同 `env ents`）、
    `env stage <key> <值>`（`player_l` / `player_r` / `far` / `near`）、
    `env groundstep <值>`、`env rankmode b 0|1`；
  * `run update` / `run updateg`（真调 `Entity::update` / `update_ghost`，打印 `dump_tick`）；
  * `run buddy` / `run buddyframe` / `run buddyset <字段> <值>` / `run linkb <字段> <token>` /
    `run bkeys`（第二个实体的帧 / 字段 / 关系 / 控制器方向）、`run buddydump`
    （hp / hp_r / mp / frame / pos / v / facing / inv / invu / ml / prev_cp / catcher / catching）；
  * `run fuseby <token>` / `run fuseclear`（`fuse_bys` 链）；
  * `run get` / `run set` 的 `resting` / `toughness_resting` / `hp_r` / `catch_time` /
    `throwinjury` / `motionless` / `blinking` / `invisible` / `invulnerable` 等槽位。
- `run hook preupdate|stateupdate|landing|leaveground`：`update()` 走的四个状态钩子
  （假状态的日志）。`run hook viewdata|viewdismiss`（**本刀新增**）：让假状态去读
  `EntityStateView::dataset` / `world_dataset` 两个查找与 `dismiss_fusion` 转发 ——
  这三个只有真实状态代码才走得到。`viewdata` 把两个查找并排打进日志
  （`state_view_dataset:<帧层>:world=<世界层>`：帧的 `dataset` 子对象给 7、世界 dataset 给 9，
  两侧互换即漂移），`viewdismiss` 调 `dismiss_fusion("112")` 后打当时的帧 id。
- **观察面**：`dump_tick`（`at` / `life` / `wait` / `mticks` / `blink` / `after` / `inv` /
  `invu` / `arest` / `catch` / `throwinj` / `fallinj` / `on_ground` / `landing` / `prev_cp` /
  `fuse` / `aabb` / `lr` / `frame` / `pos` / `pv` / `v` / `pvv` / `hp` / `hp_r` / `mp` /
  `team` / `facing` / `motionless` / `shaking` / `catcher` / `catching` / `fromwait` /
  `n` / `itv`）钉住绝大部分；`buddydump` 钉住「只写对方」的那几处；
  宿主日志（`create_entity_with_bot` / `play_sound` / `add_entities` / `state_on_restrict` /
  `on_mp_changed` / `state_on_dead`）与钩子日志（`>enter:` / `>leave:` / `state_pre_update`
  等）钉住副作用。
- ⚠️ **`run keys` 每次都装一台新控制器**：`KeyStatus::hit` 只写当次控制器的按键状态，
  `_key_list` 攒不出 `d` + 序列 ⇒ `frame.__seq_map` 的命中序列路径在本主题里测不出来
  （`refresh_ctrl_env` 的 `seq_map` 来源因此不可观察，见 spec 头部）。
- ⚠️ **`position.x` 被 Respawn 分支写成 `NaN` 之后不会自己恢复**：`stage` 缺键时
  `max/min` 得 `NaN`；下面所有以 `x` 为观察点的场景（AABB 尤其）要先 `run pos` 复位。
  `update_ghost` 不刷新 AABB ⇒ ghost 段落打印的是上一 tick 的残留。
- ⚠️ **`spawnv` 生成体的位置来自 opoint 的 `x` / `y` / `z`**（缺字段 ⇒ `NaN`），
  `spawnv` 的后四个参数是偏移与朝向；用例里不要拿这种实体当位置观察点。
- ⚠️ 对象字面量的对数必须与 `o <n>` 一致：多写会被静默忽略（`run frame o 3 … dataset o 1 …`
  里 `dataset` 就被丢掉了 ⇒ 帧层查找读不到），少写会报
  `value literal truncated in object`。
- 不可观察项（记录在 `mutations/entity.mjs` 头部）：`collision_list` / `collided_list` 的清空
  （tick 内无回读）、`refresh_ctrl_env` 的 `__seq_map` 来源与 `transforms[0]` 的 pre/post
  映射对（见上）、`world_puppets` 的 `team` 槽与 `entity_view` 的 `emitters`（消费者只有
  状态钩子与 `summary_mgr.apply_damage`，本主题一个都不走）。

### 6.9.102 `base/ValExpression` + `loader/preprocess_opoint`（`base` 用例 3127 → 3429 行 = core 3127 + val_expr 302；变异 87/87 全杀，其中本刀新增 66 条）

- 新用例 `cases/base/val_expr.txt`：解析结构（空白剥离 / `text` / `tag` / 数字与小数点的
  边角）、逐字错误文案与 `@下标`、四则的优先级与结合性、一元负号的递归、括号、
  DEFAULT_VARS（`w`/`h`/`cx`/`cy`）与自定义变量的覆盖、五个调用（`rand`/`pick`/`bag`/`flip`/
  `round`）的取值与 `mark`、`bag` 的重填与兜底、`preprocess_opoint` 的九组字段
  （成功 / 全失败 / 保持原值 / 部分字段 / 混合）。
- 新增 op：
  * `x <src…>` / `xt <tag> <src…>` / `xw <hex16>…`：造一个 `ValExpression` 并打
    `D <idx> <esc(text)> <esc(tag)> <esc(err)|->`。`x` 把 token 用**空格**拼起来当源
    （空白由被解析方剥离）；`xw` 用 4 位十六进制**码元**拼源，用来打 U+3000 / U+00A0 /
    U+FEFF 这类用例文件里写不出来的空白。
  * `get [<n>]`：对**最近创建**的那个表达式连调 n 次（缺省 1）：
    `G <idx> <n> <esc(mark)> <bits16>…`（结果是位模式；`mark` 是**调用之后**的）。
  * `mtseed <n>` / `mdraw <min> <max>` / `mmark`：`MD <bits16>` / `MM <esc(mark)>`。
    `mdraw` 是「抽一次看消耗了几个随机数」的老办法（§4.57）。
  * `frame <w> <h> <cx> <cy>` / `var <name> <v>` / `varclr`：假宿主的帧与自定义变量（静默 op）。
  * `po` / `ps <field> <valueLiteral>` / `pc` / `pkeys`：`preprocess_opoint` 的单条记录。
    `pc` 打 `PC <成功条数>` + 九行 `PG <__gen_* 名> <成功?> <err|-> <get 位模式|-> <保持的原值|->`，
    打完之后把记录里的 `__gen_*` **删掉**（§4.40 的对齐约定：TS 侧把函数对象挂在记录上，
    端口不挂）⇒ `pkeys` 才能对上键序。
- ⚠️ **`get` 取「最近一个」而不是按下标**：用例里表达式是逐行造的，按下标引用要人工数行
  （首版就数错了：`get 30` 打的是常量 `1+2`，六个 `3.0` 看上去还挺正常）。
- ⚠️ **`x` 的 token 是用空格拼的**：`x 1 + 2` 与 `x 1+2` 的源都是「剥离空白后等价」的
  `1+2`；想构造**有意义的**空白（或 `1 2` 这种想测「拼接」的地方）必须用 `xw`。
- ⚠️ **宿主面是 Ctx 概念**：TS 侧给的是 `{ frame: {width,height,centerx,centery}, lfw: { mt } }`，
  端口给的是 `frame_var(name)` + `mt()`（见 README 偏差表）。帧**缺字段**时 TS 拿到
  `undefined`，那一支（`range(undefined, undefined)` 提前返回、`pick`/`bag` 的
  `v !== undefined` 过滤）不复现 ⇒ 用例只喂有值的帧。
- 不可观察 / 有意不覆盖（另见 DESIGN §58.4）：非字符串的 `gen_*`（TS 抛 `TypeError`，无 trace）、
  `mark` 挪到实参之后的等价写法、`gen_*` 为真值非字符串的分支。

### 6.9.103 `base/clock.h` 补全 + `base/Ticker` + `base/FPS`（`base` 用例 3429 → 3660 行 = core 3127 + val_expr 302 + ticker 231；变异 141/141 全杀，其中本刀新增 54 条；另有 1 条按构造等价、撤出名单）

- 新用例 `cases/base/ticker.txt`（231 行）：15 个场景 —— 启动时的两路分流（Timeout / Clock）、
  `delay == sleep_threshold` 的边界、`Clock.hidden()` 为真、`resync(immediate)`、
  rate 窗口（含 `el` 恰好等于 `ratewin` 与 resync 之后两种状态的重新累计）、`cost` 的 EMA
  （让 `spent` 在步间变化）与 `_span` 的 slew、`on_step` 里重入 `resume`/`pause`/`stop`、
  `spent` 为 0 / 8、base 的 5% 换挡（含 `step_ms == 0`）、`dt` 夹到 4 倍与
  `max_lag_steps` 三种取值、`pause`/`resume`/`stop`/`resync` 的组合与五种 no-op 状态、
  `step_ms == 0` 时 `rate` 回落 0、FPS 一场。
- 新增 op：
  * 假宿主：`clk set <ms>` / `clk adv <ms>` / `clk hidden <0|1>` / `clk pend`（打
    `PEND clock=<n> tout=<n>`）、`fire`、三个旋钮 `tk maxspan|maxlag|ratewin <v>`
    （`safety`/`slew`/`sleep_threshold` 没有 op，用例走它们的默认值 —— 见 DESIGN §59.4 第 10 条）。
    假时钟与假定时器的动作会打日志：`CLK add <id>` / `CLK del <id>` /
    `TOUT add <id> <bits16(delay)>` / `TOUT del <id>`，`id` 两侧都从 1 递增。
  * `tk new [<step_ms>]`（缺省 16）/ `tk start` / `tk stop` / `tk pause` / `tk resume` /
    `tk resync <0|1>` / `tk stepms <ms>` / `tk spent <ms>` / `tk inside <resume|pause|stop|resync>` /
    `tk dump`：
    `TK run=<bool> pend=<bool> pause=<bool> base=<bits16> span=<bits16> step=<bits16>
    rate=<bits16> cost=<bits16> dl=<bits16> last=<bits16> tid=<id> wid=<id>`。
  * `fps new [<retention>]` / `fps update <dt>` / `fps reset` / `fps dump`：
    `FPS value=<bits16> dur=<bits16> ret=<bits16>`。
- ⚠️ **`tk inside <m>` 是重入钩子**：让**下一次** `on_step` 在打完 `STEP` 之后回调 Ticker 自己
  （`resume` / `pause` / `stop` / `resync(true)`），用完即清（`tk new` 也清）。这是 `_schedule`
  守卫三个因子里 `_running` / `_paused` 两个**唯一**的可观察入口 —— `_tick` 在调 `on_step`
  之前就把 `_pending` 清了（这正是「宿主在一步中间改状态」的模拟）。
- ⚠️ **`fire` 是「触发待触发的回调」，Timeout 优先**：Timeout 被触发时假时钟会**自动前进**
  `delay`（模拟真实定时器的到期）；Clock 被触发时不动时钟。**必须先 `clk set <截止点>`** ——
  `step_once` 里 `t0 < _deadline` 直接返回，时钟给早了 trace 就是「什么都没发生」。
  重入钩子那几段还要注意 `_deadline` 是 `start` 用**当时**的时钟算的（`start + step_ms`）：
  改了 `clk set` 之后必须重新 `tk new` + `tk start`，否则钩子那一枪步进不了。
- ⚠️ **`tk new` 会清空两个待触发队列**（harness 语义，不是端口语义）：模拟 TS 里换一个
  `Ticker` 实例 = 旧回调随 world 一起弃掉。没有它，上一场景的残留回调会被下一场景的
  `fire` 触发。
- ⚠️ **`tk start` 之前 `base`/`rate` 还是 0**：`_base` 只在 `start`/`resume`/`resync`/`step_once`
  里赋值 ⇒ `tk new 16; tk dump` 打出 `base=0`（TS 侧读私有字段得到同一结果）。
- ⚠️ **`pause` 不看 `_running`**（TS 原文）：`tk stop; tk pause; tk dump` 打出 `pause=true`，
  要再 `tk resume`（被 `!_running` 拦下、什么也不做）才能看到它「卡住」。
- `mt_random` 侧无新 op，只因 `IClock::now_ms` → `now` 改名同步了 `TestClock`
  （`IClock` 现在有四个纯虚方法，假时钟必须四个都实现）。
- 不可观察 / 有意不覆盖（另见 DESIGN §59.4）：`Ticker.TAG`、`ITimeout.add` 的 `...args`、
  `_tick` 的 `finally`、`_schedule` 守卫里的 `_pending` 因子、`_tick` 的 `!_running` 早返回、
  `dt` 夹取的下界、`IClock.del` 收到未知句柄。（守卫的另两个因子 `!_running` / `_paused`
  用 `tk inside stop` / `tk inside pause` 已覆盖。）

### 6.9.104 `base` 的三个叶子助手 + `core` 的 `toFixed(1)`（`core` 用例 10558+98+116+197 → +`to_fixed` 487 行；`base` 用例 3660 → 3905 行；变异 core 127/127、base 163/163 全杀，其中本刀新增 core 15 条 + base 22 条；core 另有 1 条按构造等价、撤出名单）

- 新用例：
  * `cases/core/to_fixed.txt`（487 行）：`0 / -0 / .25·.75 系（恰好 .5 的尾数）/ 整数 / 2^53 /
    .95 进位边界 / 小于 0.05 的极小值 / 次正规数 / 1e21 分界（含 `|x| ≥ 1e21` 走 ToString 的
    `"1.0075e+21"`）/ NaN 与 ±Infinity`，再加 **400 条固定种子的随机位模式**。
  * `cases/base/color_size.txt`（245 行）：八个真实队伍 + Independent(空串) + 六个查不到的键、
    text/outline 两套 fallback 语义的对照（`gtt 9 ""` vs `gto 9`）、B/KB/MB/GB 四段分界、
    `.replace(".0","")` 的「只替第一处」、`/1024` 与 `/1000` 分辨得出来的取值，以及三种量级的随机取值。
- 新增 op：
  * `core`：`to_fixed <bits16>` → `to_fixed <bits16> <结果串>`（不转义，与 `to_string` 同款；
    TS 侧就是真 JS 的 `.toFixed(1)`）。
  * `base`：`gtt <team> [<fallback>]` → `GTT "<team>" "<fallback|->" "<color>"`、
    `gto <team>` → `GTO "<team>" "<color>"`、`gsf <bits16>` → `GSF <bits16> "<text>"`。
- ⚠️ **队伍名/fallback 按 JS 字符串字面量读**：`""` 就是 `TeamEnum.Independent` 的键
  （它在数据里的 key 就是空串）；`gtt` 的 fallback **省略**才等于 TS 的 `undefined`（走默认参数），
  写 `""` 是显式空串 —— 这一格语义差别正是 60.2 第 7 条要钉的东西。
- ⚠️ **`gsf` / `to_fixed` 吃的是 16 位十六进制位模式**（`bits_from_hex` / `f64FromBits(BigInt("0x"+…))`）：
  负数、NaN、1e30 这种值用十进制 token 表达不了。**生成用例时别写 `hi & 0xffffffff`** ——
  JS 的 `&` 会把高位变成负数，再 `BigInt(...)` 就会得到 `-f60494f` 这种 token（生成器踩过一次）。
- 不可观察 / 有意不覆盖（另见 DESIGN §60.4 与 `mutations/base.mjs` / `mutations/core.mjs` 的头部）：
  颜色字段恒为非空字符串（`!color->empty()` 那一半、TS 的 `0` 假值与数字原样返回分支都不可达）、
  `toFixed` 只做 f = 1、`team` 只收字符串。

### 6.9.105 `loader/get_val_from_entity`（+ 惰性的 `get_val_from_lf2` / `get_val_from_world`）（`entity` 用例 2326+37+108+116+576 → +`get_val` **319** 行 = 3482；变异 54/54 全杀，全部为本刀新增）

- 移植：`loader/get_val_from_entity.{h,cpp}`（39 条表项 + `get_val_getter_from_entity` 查表）、
  `loader/get_val_from_lf2.h` / `loader/get_val_from_world.h`（TS 里就是只有 `default` 的 switch ⇒
  两处恒 `nullptr`，注释里写明「等 `LF2Val` 有实现时只改这两个文件」）。
  `IEntityHost` 新增两缝（都带默认实现，旧 harness 一行不用改）：`is_cheat(name)`（`lfw.is_cheat`）、
  `survival_rank_available()`（`world.lfw.survival_rank_available`，与既有 `survival_rank_mode` 是两个字段）；
  `Entity` 新增 `host()` 访问器（自由函数要问宿主）。
- 新增 op（`entity`）：
  * `run gv <词>` → `run gv s"<词>" || <日志> | has=<0|1> v=<值>`（`has=0` 时 `v=-`：
    TS 的 `undefined` 不能被调用，所以查不到就**不调用**）。词按 JS 字符串字面量读。
  * `run supern <n>` → `e.superpunchs` 清空后塞 n 条（只关心条数）。
  * `run buffset <kind…>` → `e.buffs` 清空后按行尾的 kind 字面量逐个插入（TS 侧是 `Buff` 的最小
    子类 `FakeBuff`，`HitByMagicFlute` 只读 `kind`）。
  * `run addcoll <collided|collision> <attacker type> <victim type> <aframe> <itr> <bframe>` →
    两条碰撞链各追加一项；`aframe` / `itr` / `bframe` 用**对象字面量**（`o 1 state n 3` / `o 0`），
    `type` 是 `data.type`（4/8/16/32 = Entity/Fighter/Weapon/Ball）。
  * `run collclear <collided|collision|both>`。
  * `env cheat <名字> b 0|1`、`env rankavail b 0|1`（两个宿主接缝）。
  * `run set transform_index <v>`（`NUMERIC_FIELDS` / `get_num` / `set_num` 两侧都补了这一格）。
- 新用例 `cases/entity/get_val.txt`（**319 行**，11 个场景）：39 个词全过一遍 + 5 个查不到的词；
  `trend_x` / `press_*` 的 `-0`（`facing = -1` 且方向键 0 ⇒ `n0:8000000000000000`）；`hp_p` 的
  `hp_max = 0`（`Infinity` 与 `NaN`）与恰好 `.5` 的 round；`?.length` 的八种类型（含**字符串算长度**）；
  `holding*` 的四种 buddy 与解链；`super_punch` 的 0/1/3/2；`hit_by_magic_flute` 的字符串 kind
  （TS 的 `==` 是松散的 ⇒ `"10" == 10` 为真）；碰撞两条链的空/单条/多条/缺字段/四种 type。
- ⚠️ **`o <n>` 的对数必须写对**：`run buddy o 2 … base …` 少写一对 ⇒ TS 的 `reset` 直接读
  `data.base.resting_max` 抛 TypeError（差分台面先崩、看不出是语义问题）。每次 `run make` / `run buddy`
  都要给 `base` 记录。
- ⚠️ **`gv` 的词必须是「自有的键」**：TS 的 `entity_val_getters[word]` 是属性查找，
  `constructor` / `toString` / `__proto__` 会命中原型链拿到函数而不是 `undefined`（差分里会真去调用它、
  然后爆栈）。用例只用普通拼错的词（`no_such_word` / `""` / `"TrendX"` / `"trend_X"`），
  原型链那条差异记在 DESIGN §61.4 第 1 条。
- 不可观察 / 有意不覆盖（另见 DESIGN §61.4 与 `mutations/get_val.mjs` 的头部）：
  `get_val_from_lf2` / `get_val_from_world`（死分支）、`IEntityHost` 两个默认实现（被替身覆盖）、
  记忆 Map、`Holding_W_Type` 的不可达 `?? 0`、`length_of` 的非数组/非字符串分支（同值）。
- 未搬：`get_val_from_collision`（~90 条，要「两个真实实体的碰撞」台面）、
  `get_val_from_bot_ctrl` / `get_val_getter_from_stage`（要 `BotController` / `Stage`）。

### 6.9.106 `controller/BallController` + `helper/closer_one`（`entity` 用例 2326+37+108+116+576+319 → +`ball_ctrl` **174** 行 = 3656；变异 **49/49** 全杀）

- 移植：`controller/ball_controller.{h,cpp}`（`reset` / `chase_point` 惰性初始化 /
  `set_chase_point` / `aim_at` / `update_lookup`（含 `reidentify` 与 `self_ref`） / `should_chase` /
  `update` / `update_chasing` / `calc_dir` / `stop_chasing`）、`helper/closer_one.{h,cpp}`
  （`Value` 版，同 `manhattan_xz`）、`defines/empty_frame_info.h`（`BallController.frame` 的初值）、
  `entity/entity_flag.h`（`flag_between`，`Entity::get_flag` 改成调它）、`core/same_ref.h`
  （从 `entity.cpp` 抽出来共用）、`entity/entity_ref.{h,cpp}`（`ref_of`：实体 → `Value` 引用）。
- 改动：`BaseController::{is_ball_ctrl,reset,update}` 改 `virtual`，`chasing` 从 `Entity*` 变成
  `Value` 引用（`spawn` 的 `OpointMultiEnum` 三处改 `ref_of(*e)`）；`CtrlEnv` 新增
  `hp` / `type` / `frame`，由 `refresh_ctrl_env` 填。
- 新增 op（`entity`）：
  * `run ctrl ball` → 造真 `BallController` 挂到实体上（TS 侧同款 `new BallController(...)`），
    印 `v=ball`。**可以有第二条**（用例靠它看 `reset` 的字段初值）。
  * `run ball <point|aim|lookup|should|dir|stop|update|closer> …` → 每条先 `refresh_ctrl_env()`，
    观察点 = `chasing`（打成 `{id}`/`null`，与 TS 的 `idRef` 逐字对齐）/ `pt` / `dir` /
    `leave` / `gaveup` / `lr,ud,jd` / 六个键的 `hit|hold`。候选名单复用 `env ents` 那一份
    （与 `run list_entities` 同款：C++ 侧 `ref_of` 成引用，TS 侧直接传实体）。
  * `run ball closer <s> <t1> <t2>` → 直连 `helper/closer_one`（TS 侧调真函数），三个 token
    都走 `candidate_of`（`z` / `nil` = `null`，认不出的 token = `undefined`），结果打成 `{id}`/`null`。
  * 每个 token 都是 `candidate_of` 那套：`self` / `buddy` / `spN`。
- ⚠️ **harness 给实体的 `position` 补了 `clone`**（非枚举 + `configurable`）：TS 侧轻量 position
  对象没有真 `Vector3` 的 `clone`/`copy`，而 `chase_point` 的惰性初始化要用 —— 是台面补丁，
  不是端口语义。`configurable` 是为了让第二条 `run ctrl ball` 能重新定义。
- ⚠️ **`chasing` 的观察点从 `id_ref(Entity*)` 改成「引用的 `id`」**：TS 侧一直打的是
  `{ id: e.id }`，所以逐字输出没变（既有用例的轨迹不受影响，已全量复核）。
- ⚠️ **队伍默认值**：台面上 `lfw.new_team` 是常量 `"1"` ⇒ 没设过队伍的两个实体算同队
  （`flag_between` 给 `Ally`）。造「敌人」场景时必须显式写 `run set team` / `run buddyset team`。
- ⚠️ **`o <n>` 的对数必须写对**（第三次踩）：`run frame o 3 … chase o 3 …` 里外层是
  `id`/`state`/`chase` 三对，写成 `o 4` 会被台面判「literal 被截断」直接报错。
- 不可观察 / 有意不覆盖（另见 DESIGN §62.3 与 `mutations/ball_controller.mjs` 的头部）：
  `update_lookup` 的两处「更远就丢」过滤（要三个以上候选，harness 只有 `self`/`buddy` 两个槽；
  把「球自己」当候选时距离恒 0 也压不出差异）、`self_ref` 的三个分量（候选唯一时距离不参与决策）、
  `flag_between` 里 `js_to_int32(a_type)` 那一项（用例的 `flag = 61` 下同真同假）、
  `set_chase_point` 的 `debugger` 断言、`reset` 的 `frame = EMPTY_FRAME_INFO`（`same_ref` 同值）。

### 6.9.107 `loader/get_val_from_collision`（86 条 getter 表）（`entity` 用例 2326+37+108+116+576+319+174 → +`collision_val` **672** 行 = 4328；变异 **122/122** 全杀）

- 移植：`loader/get_val_from_collision.{h,cpp}`（86 个 getter + `collision_val_getters()` 表 +
  `get_val_getter_from_collision(word)` 查表；词与顺序照抄 `defines/CollisionVal.ts`）。
- 新增宿主缝（同 `collision/n_bdy_normal.h` 那套）：
  `struct CollisionValEnv { std::function<const Entity*(const std::u16string& id)> find_entity; };`
  + `set_collision_val_env(env)`。理由：TS 的 `Collision.attacker` / `.victim` 是**活实体**
  （读的时候才取字段），端口的 `Collision` 只有 `CollisionActor` 快照，而 `collision/` 层
  不认识 `Entity`。`loader/` 可以 include `entity/entity.h`，所以缝装在 loader 这一侧。
  宿主侧就是世界的实体表（harness：`world.entity_map.get(id) ?? null`）。
- 新增 op（`entity`）：
  * `run cvwho <攻方> <受击方>` → 只写 `attacker.id` / `victim.id`，顺带把双方的 `frame`
    搬进 `aframe` / `bframe`（TS 侧就是 `{attacker, victim, itr, bdy, aframe: a.frame, bframe: v.frame}`）。
    token 是 `self` / `buddy` / `spN` / `none`；`none` = 世界外的 id（`__outside__`）。
    实体帧不是对象时（`EMPTY_FRAME_INFO` 是对象，缺帧才是）给空对象 —— 两边都必须是对象，
    否则 TS 侧 `undefined.state` 会抛。
  * `run cvclear` → 复位成「两个 `id` 都在世界外 + 四个空对象」的碰撞。
  * `run cvset <itr|bdy|aframe|bframe|aid|vid> <值>` → 逐个覆盖（`aid`/`vid` 只改 id）。
  * `run cvkey <self|buddy> <hit|start|db> <键…>` → `hit` = `keys[k].hit(1)`（`_d_time = 1`）、
    `start` = `keys[k].hit()`（TS 默认参数 ⇒ `_d_time = ctrl.time`，`is_start` 才为真）、
    `db` = `dbc[k].press(ctrl.time, undefined, 1000)`（`is_db_hit` 才为真）。回显七个键的
    `hit` / `start` / `db` 三个掩码。
  * `run cv s "<word>"` → `get_val_getter_from_collision(word)` 查表再调用；表里没有印
    `has=0 v=-`（TS 的 `undefined` 不能调用），有则 `has=1 v=<值>`（同 `run gv`）。
- 观察点：键位那 42 个词返回的是 **boolean**（`b0`/`b1`），其余是数字 / 字符串 / `u`。
  `hit_flag` 的两个词缺字段时给 `61`（`HitFlag::AllEnemy`）。
- ⚠️ **`Entity::state()` 就是 `frame.state`**：`run set state` / `run setstate` 都不改它
  （`run get state` 一直是 `NaN`）⇒ 想让 `a_falling` / `v_falling` 为真必须 `run frame` /
  `run buddyframe` 换帧。
- ⚠️ **帧 id 为空 = `frame_id::None`**：`run make` / `run buddy` 造出来的实体拿的是
  `EMPTY_FRAME_INFO`（id 空），`BallController::should_chase` 会因为 `frame_id::None` 直接否，
  于是 `run ball lookup` 永远找不到目标 —— 要让球追到人，受击方必须先 `run buddyframe`。
- ⚠️ **互相 `bearer` 的实体再改帧会无限递归**（`set_frame → follow_bearer → enter_frame →
  set_frame`）：TS 侧同样爆栈（`RangeError: Maximum call stack size exceeded`），端口忠实复刻
  ⇒ **持有位那一节放在用例最后**，且只设单向关系（`run link bearer buddy` / `run linkb holding self`）。
  清链用 `run link bearer none`（`to` 认不出就是 `nullptr`）。
- ⚠️ `run set group` / `run set armor` 不存在（这两个字段只从实体数据来）⇒ 要换只能
  `run buddy <data>` 重建；`run buddyset position` / `velocity` 也不存在（`set_value` 的白名单里
  没有），所以 `a_closing_speed_*` 的三档只靠攻方的 `run pos` / `run setvel` 造（受击方守在原点）。
- ⚠️ `o <n>` 的对数必须写对（第四次踩）：`base o 3 type n … armor o 2 … group a 1 …` 这种嵌套字面量
  少写多写都会报「literal 被截断」。
- 不可观察 / 有意不覆盖（另见 DESIGN §63.3 与 `mutations/collision_val.mjs` 的头部）：
  「世界里找不到这个 id」的那几个空值护栏与 `find_entity` 没装的分支（TS 无法表达）、
  `same_team` 的两个参数交换（`is_ally` 对称）、`with_both` 的 `Value()` / `Value(0.0)`。
- ⚠️ `tools/mutate.mjs` 新增可选字段 `cases: [...]`：只跑这几份用例（一份变异通常只有一两份
  用例看得见）。不写就照旧跑该 subject 的全部用例，既有 spec 不受影响。

### 6.9.108 `loader/preprocess_bdy` + `loader/preprocess_itr`（新 subject `loader_frames`，222 行；变异 **166/166** 全杀）

- 移植：`loader/preprocess_bdy.{h,cpp}`、`loader/preprocess_itr.{h,cpp}`（14 个 `itr.kind` 分支的
  `??=` 默认条件 / `set_hit_flag` 兜底 / Pick 的两条 `pretest` 动作 / Heal 的 `dvx` 进帧 /
  Whirlwind 的 `injury = injury ?? void 0`），外加 `loader/preprocess_action.cpp` 补 `action.tester`。
- 函数形态：`bool preprocess_bdy(Value& ctx, std::u16string& error)`，`preprocess_itr` 同款。
  从 `ctx` 读 `data` / `frame` / `bdy`|`itr`，**成功时把结果写回 `ctx.bdy` / `ctx.itr`**
  （= TS 调用点的 `l[i] = preprocess_bdy({...ctx, bdy: n})`），失败返回 `false`；
  `error` 只在 prefab 解析失败时是 TS `prefab_error(...)` 的 message。
  `lfw` / `jobs` 不落地（端口 `preprocess_action` 不接收它们，`A_SOUND` 只校验 path 可迭代）。
- 新增 subject `loader_frames`（`subjects/loader_frames.{ts,cpp}`）两个 op，参数是一个 ctx 字面量：
  * `bdy <ctx>` → `bdy <ok|throw> <data> <frame> <结果> t=<探针>`，失败再跟 `msg=<文本>`
    （`<frame>` 位置也印出来：`kind 0` + `frame.state 10` 那条路会改 `bdy`，`frame` 自己不该变）。
  * `itr <ctx>` → `itr <ok|throw> <data> <结果> t=<探针>`（+ 同样的 `msg=`）。
  * TS 侧：ctx 里补 `lfw`（`sounds` stub）与 `jobs`，并把 `preprocess_bdy` / `preprocess_itr` 的
    **返回值写回** `ctx.bdy` / `ctx.itr`（真实调用点就是这么写的）；
    `Ditto.error` / `Ditto.warn` 要换成空实现 —— `new Expression(...)` 在两端词都不认识时会调
    它们（默认实现是 `not a function`，会直接把这一行变成 `throw`）。
- ⚠️ **`__tester` / `action.tester` 的值两端不可比**：TS 挂的是编译好的 `Expression`（内部含函数
  字段），端口存的是**源串**（见 DESIGN §64.2）。所以两侧都先探针、再剥键：
  * 探针 `t=`：`__tester` 与**每条** `action.tester` 的 `-`（键不在）/ `u`（在、值假）/ `s`（在、值真），
    逗号分隔（`bdy` / `itr` 自己的在前，然后是 `actions` 里逐条）。
    这三位是**必须**的：`bdy.__tester = test ? … : void 0` 两种形态都会建键，而 `itr` 侧
    `if (itr.test)` 只在有 test 时建键 —— 只看渲染（剥掉后）这处差别完全不可见。
  * 剥键：递归删 `__tester` / `__judger` / `tester`（`__judger` 只有 TS 侧会写，
    端口 `preprocess_next_frame` 不写，同 6.9.x 的既有约定）。
- ⚠️ `msg=` 只比以 `[` 开头的文本：`prefab_error` 的 message 两端逐字相同，而其它失败
  （`bdy` 是标量、`actions` 不是数组、动作缺 `type`、`A_SOUND` 的 `path` 不是字符串/数组……）
  在 TS 里是 TypeError，文本不可能一致 ⇒ 只比 `throw` 这一位，`-` 表示“不比文本”。
- 观察点：`set_hit_flag` / `set_bdy_kind` 会连带写 `hit_flag_name` / `kind_name`；
  `test` 是**字符串数据**，CondMaker 的括号与 `&&`/`||` 顺序全在字符串里（错一个就差分出来）。
- ⚠️ **关系比较与 `switch` 不同**：`between(kind, 1000, 1999)` 是 JS 的 `>=` / `<=`
  （`"1005"` 会被数字化 ⇒ 进老式 goto），而 `switch (itr.kind)` 是 `===`（`"1"` 不命中任何分支）。
  用例里 `kind s "1005"` 与 `kind s "1"` 各有一行。
- ⚠️ `set_default` 那一族（`??=`）要用 `is_nullish`：`null` / `undefined` 才写默认值，
  `0` / `""` / `false` **不写**。反过来 `hit_flag ?? AllBoth` 是“兜底重写”，已有值时也会重写一遍
  （连带 `hit_flag_name`）。Whirlwind 的 `injury = injury ?? void 0` 会**建出键并给 undefined**
  ⇒ 渲染里看得见 `injury:u`。
- 不可观察 / 有意不覆盖（另见 DESIGN §64.4 与 `mutations/loader_frames.mjs` 头部）：
  `bdy` / `itr` 是**数组**时（TS 能往数组上挂 `__tester`，端口的 `Array` 没有键位；
  `itr` 侧两边一致所以用例里有 `a()`，`bdy` 侧端口按失败处理故不写）、`ctx` 不是对象、
  CondMaker **每组首项**的 `.add` ↔ `.and_` / `.or_` ↔ `.and_` / `wrap` ↔ `add`（空 maker / 空组上
  生成的串完全相同）、`motionless` / `shaking` / `dvx` 的 `is_nullish` → `!truthy`（默认值本身就是 `0`）。

### 6.9.109 `loader/preprocess_frame` + `utils/read_nums`（`loader_frames` 增 `frame` / `rn`，544 行；变异 **213/213** 全杀；`indicator_info` 69 行 / **40/40**）

- 移植：`loader/preprocess_frame.{h,cpp}`（`bool preprocess_frame(Value& ctx, std::u16string& error)`，
  成功写回 `ctx.frame`）、`utils/read_nums.{h,cpp}`（`bool read_nums(const Value& src, double len,
  const Value& fallbacks, std::vector<Value>& out, std::u16string* error = nullptr)` —— `len` 是
  `double`，因为 TS 的参数就是 number，负长度必须走 `len < 1 ⇒ []`；用 `size_t` 会把 `-1` 变成
  2^64-1 并把补长循环变成吃内存的死循环）。`utils/read_nums` 的落点：TS 在 `ui/utils/`，
  `ui/` 没移植而它是纯函数。
- 同时也是 `cook_frame_indicator_info` 的**失败通道**（V41 时是 `void`，三类 TS 会抛的形态被静默
  跳过）—— 现在返回 `bool`：`"w" in pic` 对原始值、`?.forEach` 对非数组、给标量挂
  `__indicator_info`。数组目标仍算成功（TS 能挂属性，而渲染里看不见）。
- `loader_frames` 新增两个 op（参数照旧是字面量）：
  * `frame <data> <frame>` → `frame <ok|throw> <data> <帧> t=<探针>`，失败再跟 `msg=<文本>`。
    探针 = 帧自己（恒 `-`）+ `/bdy` + `/itr`，每个列表逐项给 `__tester` 的 `-`/`u`/`s` 与它
    `actions` 里每条 `tester` 的同款字母，逗号分隔 —— `__tester` 装不进 `Value`，只能这样比。
  * `rn <src> <len> [<fallbacks>]` → `rn ok <数组> fb=<第三参渲染> msg=-` /
    `rn throw - fb=<第三参渲染> msg=[read_nums] failed, …`。第三参**会被就地补长**
    （`fallbacks.push(fallbacks[len-1] || 0)`），所以把它也渲染出来才看得见。
- ⚠️ **剥键表扩了**：除 `__tester` / `__judger` / `tester` 之外还要剥九个 `__gen_*` 与
  `__gen_facing`（`make_buring_smoke` 的 `action.__gen_facing` 与 `preprocess_opoint` 的九个
  `__gen_*` 都是编译产物，端口不落地 —— 宿主按 `IEntityHost::gen_or(...)` 现解析）。
- ⚠️ `msg=` 的规矩照旧（只有以 `[` 开头的文本两端可比），本刀起 `[read_nums] failed, …` 也进了
  这一类 —— 端口的 `read_nums` 把文本逐字对齐（`to_string` 就是 JS 的 `String()`，
  数组会 join 成 `NaN,NaN` 这种）。
- ⚠️ **`data.processed != false` 是松散门**：只有 `false` / `0` / `""` / `null` 才算「未处理」，
  才会进 ball / weapon 两段；`undefined != false` 为真 ⇒ **缺省数据的走法是空分支**。
  fighter 段是**独立的 `if`**，不受它管。用例里 weapon 那组必须显式带 `processed` 才算覆盖。
- ⚠️ `preprocess_ball_frame(ctx)` 收到的是**当前 ctx**（`ctx.frame` 还是原始帧），而
  `preprocess_frame` 后面继续操作 `merged.value` ⇒ prefab 命中时两者不是同一个对象，端口照抄。
- ⚠️ `traversal` 对**非空字符串**给下标（`Object.keys("ab") = ["0","1"]`），回调里的 `o[k] = …`
  在严格模式下会抛 ⇒ 端口 `each_entry` 对非空字符串直接失败；数字 / 布尔是空表 ⇒ 不遍历、不失败。
  `hit` / `hold` / `key_down` / `key_up` / `seqs` 五处都走这条路（用例里有 `hit s "x"`）。
- ⚠️ `read_nums` 的两个怪癖：`is_num_arr` = 「是数组且**没有 NaN**」（不要求元素都是数字），
  越界判断是 `idx > src.length`（**不是 `>=`**）⇒ `idx === length` 时读成 `undefined`。
- ⚠️ `fold_aabb`：`x2 = x1 + w` 的 `+` 是 `js_add`（`w` 是字符串时会**拼接**），四轴的旧值都走
  `??` 回落；`z` / `l` 的解构默认值只在 `undefined` 生效。
- ⚠️ ball 的 `on_x/y_restrict` 自动补里 `data.type == Ball` 与状态白名单是**松散**比较
  （`"32"` / `"3000"` 也命中），而 `landable` 与 `Boomerang` 段是**严格**比较。
- 不可观察 / 有意不覆盖（另见 DESIGN §65.4 与 `mutations/preprocess_frame.mjs` 头部）：
  `ctx` 不是对象、weapon 分支里不可达的 `d == nullptr`、`pics` 与帧内**普通** `bdy`/`itr` 的
  写回（就地改同一个对象 ⇒ 恒等；命中 prefab 时是新对象，用例专门钉住这条）、`fold_aabb` 前
  那段不可达的 `else { return false; }`、`breakfall` 里不可达的 `o == nullptr`、
  `preprocess_ball_frame` 里 `data.base` 缺失（V41 遗留，用例一律给 `base`）。
### 6.9.110 `loader/preprocess_entity_data`（新 subject `loader_entity`，387 行；变异 **121/121** 全杀）

步骤 3 的**总装入口**：`DatMgr` 拿到的实体数据在这里补齐成运行时形状。端口
`bool preprocess_entity_data(Value& ctx, std::u16string& error)`，从 `ctx` 读
`data` / `lfw` / `jobs` / `errors`，成功时**就地改** `ctx.data`（TS 返回的就是同一个对象）。

- **顺序**（照抄 TS）：四路 special（`make_ball_special` / `make_weapon_special` /
  `make_fighter_special`，fighter 还要 `data.pre_hitkeys ??= {ja:{reset_keys,transfrom_to_another,
  expression}}`，`make_fighter_special` 的返回值**丢掉**）→ `itr_prefabs` 逐条（weapon 时
  `itr.test ??= "v_falling==0"`）+ 写回 → `bdy_prefabs` 逐条 + 写回 → `lfw` / `data.base` 两道
  解构 → `small`/`head`（`is_non_blank_str`）与三张音效表（`?.forEach`）→
  `__pre_hitkeys_map` / `__post_hitkeys_map` → `on_dead` / `on_exhaustion` → `files` 与
  `jobs.length` / `Promise.all` → `portraits` → `frames` + `__pics` → `base.bot` →
  `processed = true` → `errors.length`。
- **`ed` op**：`ed <ctx>`，输出 = `ed` + `ok`/`throw` + `ctx.data` 的渲染，失败再补
  `msg=`（只比较以 `[` 开头的文本）。TS 侧 `await` 这个 async 函数，`lfw` 缺失时补桩
  （`images.load_img` / `load_by_pic_info` / `sounds.load` 返回 `undefined`），`Ditto.warn` /
  `Ditto.error` 空实现，渲染前删掉 `data.xml`。
- **剥键**：`__tester` / `__judger` / `tester` / 九个 `__gen_*`，外加 bot 动作的 `judger`；
  `Map`（两张 `hitkeys` 表）的值要递归进去（里面的帧和 `data.<x>_hitkeys` 是同一批对象）。
- **四处「绕不过去」的细节**（详见 DESIGN §66.2）：
  1. `traversal` 值版对字符串也要给下标（`base.files` 是字符串时每个字符都 push 一次）；
  2. `pre_hitkeys` 的字符串回调有 `k.length < 2` 提前 return ⇒ **短字符串不抛、≥ 11 位才抛**，
     端口在 `build_hitkeys_map` 里单独判，不能套用 `traversal_write` 的「非空字符串直接失败」；
  3. `__pics` 读的是**回调参数**的 `frame.pics?.length`，不是 `preprocess_frame` 的返回值；
  4. `data.__pics = max(pics, data.__pics || 0)` 的 `|| 0` 会把 `NaN` 归一成 0。
- **用例**：`cases/loader_entity/all.txt` **387** 行（14 组：入口 / `processed` 空门 / 四路 special
  （含 `make_*_special` 表里真会写东西的 id）/ `pre_hitkeys ??=` / 两张 prefab 表 / `small`·`head`
  / 三张音效表 / `jobs` 失败面 / 两张 `hitkeys` 表的三道门（含 11 位字符串与 11 元素数组）/
  `on_dead`·`on_exhaustion` / `portraits` / `files` / `frames`·`__pics` / `base.bot` /
  `lfw`·`errors` / 组合与失败点）。
- **变异**：`mutations/preprocess_entity_data.mjs` **121/121 全杀**（其中 2 条打在
  `traversal.h` 的值版字符串分支、2 条打在 `type_check.h` 的 `is_non_blank_str`）；8 类
  按构造等价 / 不可达 / 遗留偏差记在该名单头部与 DESIGN §66.4。
- **用例层的两个坑**：prefab 表必须挂在 `data.frame_prefabs` / `data.itr_prefabs` 上
  （挂在 ctx 上 = 哑弹）；`deg 45` 的 `Math.sin` 与 UCRT `std::sin` 差 1 ULP，用例避开。

### 6.9.111 `I18N` + `loader/get_import_fallbacks`（新 subject `i18n`，262 行；变异 **67/67** 全杀）

- **移植面**：`native/lfw/i18n.{h,cpp}`（`set_lang` / `add` / `alias` / `canonical` / `string` /
  `strings` / `lang`）与 `native/lfw/loader/get_import_fallbacks.{h,cpp}`
  （`bool get_import_fallbacks(const Value& name, std::vector<std::u16string>& fallbacks,
  std::u16string& suffix)`）；进 `CMakeLists.txt`（C++ 源 406 → 408）。
- **`gif` op**：`gif <name>`，输出 `gif ok <备选名数组> suffix=<后缀>`，`name` 不是字符串时
  `gif throw - suffix=- msg=-`（TS 在 `path.endsWith` 上抛，不是 `[` 开头的文本 ⇒ `msg` 只记 `-`）。
- **实例 op**：`new <id>` / `add <id> <langs>` / `lang <id> <lang>`（`set_lang`；输出
  `ok`/`throw` + `cur=` 当前语言 + `msg=`，失败时 `cur` 必须还是旧值）/ `alias <id> [lang]` /
  `canonical <id> [lang]` / `str <id> <name> [lang]` / `strs <id> <name> [lang]`。
  `I18N` 的三张表是私有 `Map`、不能直接渲染 ⇒ 输出只走这些返回值。
- **默认参数**：TS 的 `alias(lang = this._lang)` / `canonical(lang = this._lang)` /
  `string(name, lang = this._lang)` / `strings(...)` 的默认只对 **`undefined`** 生效（显式写 `u`
  也算）⇒ 两端都用 `langArg` 把「缺省或 `u`」换成 `it.lang`。注意 `canonical` 显式 `u` 时 TS 是
  `alias(this._lang) ?? this._lang`：默认参数**先生效**，所以「没别名」时给的是 `this._lang`
  （`''`）而不是 `undefined`。
- **六处「绕不过去」的细节**（详见 DESIGN §67.2）：
  1. `lang == ''` 是**松散**比较 ⇒ 直接复用 `core/value.h` 的 `equals`（`[null] == ''` 也是真）；
  2. `_words.get(lang)` 是 `Map.get`（**不做** ToString：数字 `5` ≠ 字符串 `'5'`），而 `m?.[name]`
     是对象取键（**要做** `to_string`）—— 这一条自测抓出（`str i5 n 5` 曾返回数字 `5`）；
  3. `add` 里字符串值先记别名（**空串也算**），`alias` 的 `if (!next) break` 又把空串别名当
     「没有别名」；
  4. `join('\n')` 与 `'' + x` 两种字符串化不能混（前者把 `null`/`undefined` 当空串，后者给
     `"null"`/`"undefined"`）；
  5. `split_path` 复刻 JS `substring`（`lastIndexOf === -1` ⇔ 从 0 起；端点反了会交换）；
  6. 图分支 14 个候选名要 `filter(v => v !== name)`（`a.png` / `a.webp` 会过滤掉最后那条）。
- **用例**：`cases/i18n/all.txt` **262** 行（16 组：`gif` 非字符串入口 / 三种图后缀 / 目录切分
  （`ui/a.png`、`a/.png`、`@2x/.png`、`a/@2x.png`、`a\\b.png`）/ 音分支 / 无分支；`add` 三道门 /
  别名 + 字符串词 + 数组词 + 非对象词 / 非对象词图夹在中间；`alias` 链与空串别名、环、松散
  `lang == ''` 各档、词键类型转换；非字符串 `lang` / `name`；`set_lang` 失败后语言不变；同名语言
  二次 `add`；数组词的两种字符串化；空串词与空数组词）。
- **变异**：`mutations/i18n.mjs` **67/67 全杀**（全部本刀新增，含 24 条打 `i18n.cpp`、22 条打
  `get_import_fallbacks.cpp`）；7 类按构造等价 / 不可达记在名单头部与 DESIGN §67.4，其中
  「基表种子」与「`substring` 端点交换」两条是**先当可杀、实测等价**后撤出的。
- **量表坑**：`join_lines` 那条变异的锚点里 `u'\n'` 写在 JS 模板串中必须转义成 `u'\\n'`，否则
  锚点是真换行 ⇒ `anchor occurs 0 times`。

### 6.9.112 `PlayerInfo`（+ `core/js_string` 的 `to_lower_case`、`defines` 的 `get_default_keys_value`）（新 subject `player_info`，270 行；变异 **76/76** 全杀）

- **移植面**：`native/lfw/player_info.{h,cpp}`（`IPlayerInfoHost` 的 `cache_get` / `cache_del` /
  `cache_put` / `warn`，`PlayerInfoCacheEntry`，`PlayerInfoCachePut`，`class PlayerInfo`）；
  `core/js_string.{h,cpp}` 新增 `to_lower_case`；`core/value.{h,cpp}` 把 `is_array_index` 提到
  `lfw::`；`defines` 新增 `get_default_keys_value(player_id)`；`CMakeLists.txt` 408 → 409。
- **`new <pid> [name] [local] [mine]`**：`name` / `local` / `mine` 都是**值**（`u` ⇒ 走 JS 默认值
  `id` / `true` / `true`，`z` / `0` / `""` 照存）；构造完先 `watch` 再读一次 `loaded()`（端口的
  「构造函数那次 load」是挂起的，见 DESIGN §68.2 第 2 条），然后才记 `new:<pid>` —— 这一步与 TS
  的 `await pi.loaded` 对齐（否则 `load` 期间的回调在 TS 侧会多出来）。
- **`dump <pid>`**：`info=` / `name=` / `ctrl=` / `local=` / `mine=` / `is_com=` / `loaded=` /
  `fighter=` 一次打全（`name` / `ctrl` 走 getter，专门盯这两个字段读错的情况）。
- **`cache_*`**：`cache_ok <pid> <text>`（`data` = 该文本的 UTF-8）/ `cache_bytes <pid> <a …>`
  （逐元素 `& 0xff`）/ `cache_other <pid> <v>`（真值非字节 ⇒ `decodeUTF8` 抛；假值等于
  `cache_nulldata`）/ `cache_nulldata` / `cache_blob <pid> <text>` / `cache_blobbytes` /
  `cache_blobfail`（`blob.arrayBuffer()` 抛）/ `cache_blobother`（`blob` 是真值但没那个方法 ⇒
  也按抛）/ `cache_missing`（`get` 回 `undefined`）/ `cache_getfail`（`get` 抛）/
  `cache_delfail`（`del` 抛）。
- **日志**：宿主调用与回调合成一条流（`get:` / `del:` / `put:name|type|version|逗号分隔字节` /
  `warn:`（只第一条文本）/ `cb:name:…` / `cb:ctrl:…`（前两参）/ `cb:is_com:…` /
  `cb:key:…`），每行用例处理完就刷出 ⇒ 差分逐行比。
- **TS 侧**：`Ditto.setup({ Cache: 假实现, JSON5: __JSON5, warn: … })`；`__JSON5` 取自
  `src/DittoImpl/JSON5`（真 `json5` 包），与端口 `json5_parse` 同源。
- **四处「绕不过去」的细节**（详见 DESIGN §68.2）：① `keys` 是 `default_keys_map` 里的**共享
  对象**（改一个玩家会改到同表的所有玩家）；② 构造函数那次 `load()` 是挂起的；③ 解构默认值只
  认 `undefined`（`ctrl: null` 会写进 `null`，缺席才用**当前** ctrl）；④ `set_key` 的严格短路
  在 `key.toLowerCase()` **之前**（拿 `"A"` 撞已存的 `"a"` 不算相同）。
- **用例**：`cases/player_info/all.txt` **270** 行（构造默认值 / 缓存入口 / `load` 失败面 /
  blob 字节 / `save` 的宿主调用 / `load` 应用 payload / `keys` 不是普通对象 / `set_key`·`get_key`
  / 共享键表 / 三个 `set_*` 的短路与回调 / `toLowerCase` 的码点段，共 11 组）。
- **变异**：`mutations/player_info.mjs` **76/76 全杀**（`player_info.cpp` 67 条、`js_string.cpp`
  8 条、`defines.cpp` 1 条）；7 类按构造等价 / 不可达记在名单头部与 DESIGN §68.4。
- **两个坑**：`const Value lowered(std::u16string(*k));` 会被解析成函数声明（most vexing parse）
  ⇒ 变异体里写 `{...}`；payload 的 `keys` 装数字时第一个下标就会抛，想杀「数组下标读错」得把
  数组元素换成字符串。

### 6.9.113 `ZipMgr`（+ `ditto/zip` 的 `IZip` / `IZipObject`、`defines/IDataInfo`）（新 subject `zip_mgr`，114 行；变异 **33/33** 全杀）

- **移植面**：`native/lfw/zip_mgr.{h,cpp}`（`IZipResult` / `ILoadedZip` / `class ZipMgr`）；
  `ditto/zip/i_zip.h` + `ditto/zip/i_zip_object.h`（各只有本刀读得到的方法）；`defines/i_data_info.h`
  （8 个字段，一律 `Value`）；`CMakeLists.txt` 409 → 410。
- **`zip <zid> <name>`** / **`zfile <zid> <path> miss|hit <fname>`**：造一个假数据包并脚本化它的
  `file(path)`。每次调用都推一条 `call:<zipname>|<path>` ⇒ `find` 的两重循环顺序与候选名表的
  顺序/去重都能从日志上看出来（这是本刀最值钱的观测面）。
- **`info <iid>`** / **`imd5 <iid> u|z|s "md5"`**：造一份 `IDataInfo`；`u` = 没有 `md5` 这个键、
  `z` = 显式 `null`（两者在 `?? ''` 下同结果，但能钉住端口 `is_nullish` 的写法）。
- **`add <zid> <iid>`** / **`clear`**：`add` 走 `unshift`（后加载优先），`clear` 原地清空。
- **`dump`**：`len` / `all`（按列表序打 zip 名）/ `zips` / `md5s`（`renderValue` 的数组）/ `infos`
  （个数 + 每份 info 的 `md5` 原样渲染）—— 三个 getter 的顺序与元素来源都钉住。
- **`find <0|1> p <n> <path…>`**：`find` 的结果条数与每条的 `origin` / `file.name` / `zip.name`。
  `origin` 打的是**原样字符串**（`[zip.name]file.name`），专门杀格式串变异。
- **TS 侧**：两个假类实现 `IZip` / `IZipObject`（`file` 每次返回新对象，端口返回同一份对象 ——
  台面只比较 `name` 文本，不比较对象身份）。
- **四处容易写错的语义**（详见 DESIGN §69.2）：① 候选名表的顺序是「原名（按输入序）→ 各路径的
  备选名（按路径序）」，且去重是**全局**的；② `exact === true` 时既不去重也不扩展（重复路径
  命中两次）；③ 两重循环是「数据包（后加载优先）× 候选名」；④ `md5s` 的 `?? ''` 只吞
  `null` / `undefined`（`md5: 0` / `''` 原样给）。
- **用例**：`cases/zip_mgr/all.txt` **114** 行（空表 / 单包命中与未命中 / 多路径顺序 / `exact` 的
  去重差别 / `origin` 与查询路径不同 / 图片与音频后缀的回退扩展 / 多包后加载优先 / `all` 返回
  内部数组 / `clear` 后重载 / `md5` 的三种形态 / 带空格的路径，共 12 组）。
- **变异**：`mutations/zip_mgr.mjs` **33/33 全杀**（`zip_mgr.cpp` 31 条、`zip_mgr.h` 2 条；分五个
  组：三个 getter / `add`·`clear` / 候选名表 / 两重循环与 `origin` / `length`）。顺序类变异靠
  「同一路径多个回退名都命中」与「两个包 × 两条路径」两组用例杀。
- **一个坑**：新建的源文件必须是 **LF**。变异脚本的多行锚点写在模板字面量里，而 JS 会把
  `CRLF` 规范化成 `LF`；Windows 上新建的文件是 `CRLF` ⇒ 多行锚点报 `anchor occurs 0 times`。

### 6.9.114 `Camera`（+ `ditto/instance.h` 的 `vec2`、`defines/i_vector2.h`）（新 subject `camera`，369 行；变异 **93/93** 全杀）

- **移植面**：`native/lfw/camera.{h,cpp}`（`ICameraWorld` 的 `world_stage` / `world_bg` /
  `world_dataset`，`class Camera`）；`ditto/instance.h` 的 `vec2`；`defines/i_vector2.h` 的
  `Vector2`；`CMakeLists.txt` 410 → 411。
- **`sf <stage|bg|dataset> <field> <value>`**：给假世界的一个字段赋值，值走值字面量（`u` / `z` /
  `s "…"` / `n …`）⇒ `undefined`、`null`、字符串、`NaN`、缺字段这些 JS 强转路径都能压到
  （端口的字段读是 `field_or` + `to_number`）。
- **`new`**：`new Camera(world)`（假世界是同一份 bag，只换一个新的相机）。
- **`dump`**：`destination` / `position` / `velocity` / `locked` / `dested`（浮点打位模式、
  `NaN` 打 `nan`、`null` 打 `z`）。
- **`reset` / `undest` / `unlock` / `jx <n>` / `jy <n>` / `dest <n> <n>` / `lock <n> <n>`**。
- **`pos <n> <n>` / `dset <n> <n>` / `vel <n> <n>`**：直接摆好三个向量再 `update` ⇒「越界」
  「已对齐」「`|v| >= |max_v|` 封顶」「反向」这些分支能精准命中。
- **`update`**。
- **读次数可观察**：假世界那三个对象分别走 `Proxy`（TS）与 `ICameraWorld`（端口），每次读都记
  `w:stage` / `w:bg` / `w:dataset` ⇒「`world.stage` 被读两次」「`_locked` 时一次都不读」都能验。
- **四处容易写错的语义**（详见 DESIGN §70.2）：① 两个 `do { ... } while (0)` 互相独立，x 块的
  `break` 不拦 y 块；② `destination.x` 的夹取发生在越界判断**之前**；③ `bg.zoom_y ?? 1` 只吞
  `null` / `undefined`（`0` 保留 ⇒ `cam_max_y` 得 `-Infinity`）；④ `_locked` 时 `jump_*` 会把
  速度清零且完全不读世界。
- **用例**：`cases/camera/all.txt` **369** 行（基础 API / 全空世界 / 常规推进 / 越界 / 已对齐 /
  `_dested` 参与 / y 块与 `cam_max_y` / `zoom_y` 四种形态 / `height` 门限三档 / 字符串与缺字段 /
  锁定 / 反向与 `NaN` / 两段收敛循环 / `atom_time` 边界 / `screen_w` 为 0 与区间倒置，共 15 组）。
- **变异**：`mutations/camera.mjs` **93/93 全杀**（构造与复位 / 锁定分支 / 顶部三个读取 / x 块 /
  y 块五组）。三条一开始存活、补用例才杀掉的：「`cam_y` 取 `_dested.x`」（补 `dest` 的 x ≠ y）、
  「`zoom_y` 缺失时落回 2」（补 `far` 很大使 `cam_max_y` 的第二项取胜）、「y 的封顶分支」（补
  `vel n 0 n 500` 让 `|v| >= |max_v|`）。
- **一个台面坑**：`dest(number_of(...), number_of(...))` 的两次调用会推进同一个 token 游标，而
  C++ 不保证实参求值顺序（MSVC 右到左）⇒ 读成 `(y, x)`；TS 是左到右。差分第一轮就抓到了。

### 6.9.115 `Resources`（+ `base/dedup.h`、`IZipObject` 的五个读取方法）（新 subject `resources`，136 行；变异 **44/44** 全杀）

- **移植面**：`native/lfw/resources.{h,cpp}`（`ImportResult`、`IResourcesHost`、`class Resources`）；
  `base/dedup.h` 的 `deduped`；`ditto/zip/i_zip_object.h` 补五个读取方法；`CMakeLists.txt` 411 → 412。
- **`zip` / `zfile <zid> <path> miss|hit <name>`**：假数据包。**`zval` / `zfail` 的 key 是「被查询的
  路径」**，不是命中对象的名字（命中对象的名字可以不同，用来验 `file` 与 `origin` 的写法）。
- **`zval <zid> <path> <method> <value>` / `zfail <zid> <path> <method> <msg>`**：命中文件的某个读取
  方法返回什么 / reject。没脚本化就**报错退出**（TS 侧同样），避免「两边都没报却对不上」。
- **`netval <method> <value> <hit>` / `netfail <method> <msg>`**：宿主 `Importer.import_as_*`。
- **`xmlparse <value> | null | fail <msg>`**：`Ditto.XML.parse` 的返回；`null` / `u` 是「解析出假值」
  ⇒ 走 `[Resources::import_xml] failed to parse` 那条。
- **`rjson` / `rres` / `rimg` / `rabuf` / `rxml <path> [1|0]`**：调对应入口，打 `data` / `file` /
  `origin`，失败打 `throw:<文案>`。台面把 `zip.file` 的每次调用、`Importer.*` 的调用（含候选表）
  与 `XML.parse` 的入参都记进日志 ⇒ 候选名表顺序与「走包还是走网络」可验。
- **四处容易写错的语义**（详见 DESIGN §71.2）：① `find(paths, true)` 的第二个参数恒为 **true**
  （备选名扩展在前面已经做过）；② 回退那条路的 `origin` **缺席**，而 `import_image_bitmap` 的
  回退用 `paths[0]`（不是宿主给的命中 URL）；③ `import_xml` 的 `file` 是 `file?.name || paths[0]`
  （空名也退回）、`origin` 仍写 `tag`，且解析结果假值必须抛；④ 宿主失败原样往外传（端口是
  `bool` + `error`，文案逐字对齐）。
- **用例**：`cases/resources/all.txt` **136** 行（空包回退 / 五个方法的命中 / 非 exact 的回退扩展 /
  回退名也没命中 / `paths[0]` 的三处差别 / xml 的 `file` 三态 / 命中文件读取失败 / 宿主失败 /
  `XML.parse` 三态与命中文本路径 / 假值 `data` / 后加载优先 / 名字与路径不同 / 带空格路径，共 13 组）。
- **变异**：`mutations/resources.mjs` **44/44 全杀**。第一轮 7 条存活全是**用例写错**：`zval` 的
  key 写成了命中对象的名字（读取直接抛 ⇒ `file` / `origin` 的变异走不到），以及 `XML.parse` 的
  「假值 ⇒ 抛」只在宿主文本也失败时才被压到。
- **一个不变式**：`base/dedup.h` 是**直通**（TS 的并发去重同步端口观察不到）⇒ 连带键字符串
  不参与逻辑，变异名单里没有它们（记在偏差表与 DESIGN §71.4）。

### 6.9.116 `Factory`（+ `controller/base_controller.h` 的 creator 身份）（新 subject `factory`，92 行；变异 **35/35** 全杀）

- **移植面**：`native/lfw/factory.{h,cpp}`（`FactoryKey` / `IEntityCreators` / `ICtrlCreator` /
  `IBuffCreator` / `FactoryWarn` / `class Factory`）；`controller/base_controller.h` 加
  `creator()` / `set_creator()`；`CMakeLists.txt` 412 → 413。
- **`regent <key> <label>` / `regctrl <key> <label>`**：登记一个 creator，`label` 只回显在日志里。
  `label == miss` 表示这个 creator 返回 `undefined` ⇒ 用来验 `create_entity` 的「creator 给假值」
  与 `create_entity_with_bot` 的提前返回。
- **`regbuff <kind> <group>…`**：op 的剩余 token 就是 `GROUPS`（用来验分组登记的顺序与去重）。
- **`ce` / `cebot <pid> …` / `acq-e` / `rec-e` / `newctrl` / `acq-ctrl` / `rel-ctrl` / `cbuff` /
  `rec-buff`**：其余入口；实体 / buff / 控制器的**池取出顺序**与「复用时会再跑一次
  `reset` / `init`」都从日志里看得到（后进先出）。
- **`dump`**：三张注册表的**键列表** + `buff_groups`（扁平 `g=[k,…]`）+ 三个池的「键 = 条数」
  （`cgraves` 的键渲染成 creator label；`bgraves` 的键是 kind 值）⇒ 表的**插入序**、覆盖语义与
  归池键都能逐行比对。
- **四处容易写错的语义**（详见 DESIGN §72.2）：① 表是插入序 + 覆盖时**位置不变**
  （端口 `std::vector` + `map_set`）；② `create_buff` 的
  `get(kind)?.take() ?? new B(lfw, id, B.KIND)` 拆成「池不存在」与「take 到 `nullopt`」两步，
  两条路都要 `reset(id)` + `init()`；③ 归池键不对称（`recycle_buff` 用 `buff.kind`、
  `recycle_entity` 用 `data.type`、`release_ctrl` 用 `ctrl.constructor`）；④
  `create_entity_with_bot` 是 `data.type` 查 creator、`data.id` 查控制器 oid。
- **用例**：`cases/factory/all.txt` **92** 行（注册与重复告警 / 实体三态 / 实体池 LIFO /
  `create_entity_with_bot` / 控制器命中·未命中·复用 / buff 命中·未命中·复用 / 数值键与分组去重 /
  数值 oid / 数值 KIND / 键同一性 / 两实体回收后的取出顺序，共 12 组）。
- **变异**：`mutations/factory.mjs` **35/35 全杀**。一条 `pool_of(..., nullptr)` 因模板推导失败
  算过 `compile-error`（`K` 只能从 vector 推）⇒ 显式 `static_cast<const ICtrlCreator*>(nullptr)`。
- **一个不变式**：`FactoryKey` 是 `Value`，表的键相等走 `strict_equals`（`1` 与 `"1"` 分开）；
  控制器表的键是**指针身份**（`ICtrlCreator*`）而不是 TS 的「类本身」⇒ 记在偏差表与
  DESIGN §72.3。

### 6.9.117 `stage/Expressions` + `stage/Status` + `bg/{Background,Layer}`（新 subject `stage`，`expr` 70 行 + `bg` 83 行；变异 **46/46** 全杀）

- **移植面**：`native/lfw/stage/expressions.h`（`IExpression<T>` + `Expressions<T>`）、
  `native/lfw/stage/status.h`、`native/lfw/bg/layer.{h,cpp}`、`native/lfw/bg/background.{h,cpp}`；
  `CMakeLists.txt` 413 → 415。
- **Expressions 侧 op**：`it <b…>`（假表达式按脚本吐真假值、日志记 `call:<i>:arg=<值>`）、
  `arg <值>` / `run` / `flow` / `next`、`resetsame`（传 `exp.list` ⇒ 走同一性早退）、
  `resetcopy`（传新数组 ⇒ 清空再灌）、`expdump`（`n` / `i` / `is_first` / `is_last`）、`status`。
- **Background 侧 op**：`data <值>` / `new` / `bgdump` / `layer <n i>` / `upd` / `disp` /
  `lset <n i> <字段> <值>`。
- **`lset` 是本刀的关键观测手段**：它改的是**数据里**那层（不是层实例的 `info`）⇒
  非 loop 层的 `info` 与数据**同一个对象**（改得动）、loop 副本是 `{...info, x}` 的**浅拷贝**
  （改不动）——把「副本是不是共享」钉死。
- **四处容易写错的语义**（详见 DESIGN §73.2）：① `reset` 的**同一性早退**（TS 的 `_list` 就是内部
  数组；端口只能判「传进来的正是 `list()` 返回的那份」，**不能比地址** ⇒ 临时量的栈地址会复用）；
  ② `flow` 里 `is_last` 必须在 `run` 之前取，循环条件是 `!pass || is_last`；③ `Layer` 的
  `cc`/`c1`/`c2` 是**严格 `undefined`**（`null` 不算）、`offsetAnim*` / `absolute` 是**真值**判定；
  ④ `Background` 的 `?? 0` / `?? 1` **只吞 nullish**（`zoom_y: 0` / `false` 保留成 0）。
- **用例**：`cases/stage/expr.txt` **70** 行（11 组）、`cases/stage/bg.txt` **83** 行（10 组）。
- **变异**：`mutations/stage.mjs` **46/46 全杀**。第一轮 3 条存活：两条是**用例没喂到**
  （`is_static` 只看 `cc` 那条要「cc 缺 + c1/c2 都有」的层；名字那条被对象的**重复键**吃掉了
  ⇒ 拆成两条），一条按构造等价（`flow` 里 `is_last` 的取值时机）⇒ 撤出名单。
- **一条不变式**：端口 `Expressions` 存的是**副本**，`reset` 的同一性改成「传进来的正是
  `list()` 返回的那一份」⇒ 记在偏差表与 DESIGN §73.3。

### 6.9.118 `stage/Item`（+ `helper/Randoming` 模板化）（`stage` 增用例 `item`，622 行；变异 **93/93** 全杀）

- **移植面**：`native/lfw/stage/item.{h,cpp}`（`IItemEntity` / `IItemHost` / `Item`）、
  `native/lfw/helper/randoming.{h,cpp}`（`RandomingT<T>` + `RandomingItem<T>` +
  `randoming_default_mt()`；`Randoming` 仍是别名）；`CMakeLists.txt` 415 → 416。
- **Item 侧 op**：`mtseed <n>`（给假宿主一个可复现的 MT）、`datas <id> <info>`（登记一条 data）、
  `datasgroup <名> <src…>`（登记一个 oid 分组）、`far <x>` / `near <x>` / `team <n>` /
  `aboss <b>` / `diff <值>`（假宿主五面）、`phase <n>`（推进 MT）、`info <键> <值>…`（给下一条
  `newitem` 的 `info`）、`newitem`（按 `info` 构造 `Item`）、`upd` / `updn <次数>`、
  `spawn`（直接调一次，绕过 `update` 的门）、`rel`（`release`）、`itemdump`
  （`rel` / `f` / `times` / `data` / `objs` / `delay` / `rq`）、`dead <标签>` /
  `teamchg <标签>`（对着假实体触发回调）。
- **假实体是「日志式」的**：每个 setter（`hp` / `hp_max` / `hp_r` / `mp` / `mp_max` / `pos` 三个分量 /
  `dead_join` / `enter_frame*` / `outline_color` / `reserve` …）都往日志里打一行
  ⇒ **赋值的顺序与次数**都成了可比量。本刀两次真·漂移（`hp = hp_r = hp_max` 的**从右往左**
  赋值序、`x` 缺省要不要抽随机）就是被这个抓出来的。
- **假宿主把每次读也打进日志**（`h:far` / `h:near` / `h:team` / `h:aboss` / `h:diff=<值>` /
  `h:find=<oid>` / `h:group=<名>` / `h:create=<oid>`）⇒ 「读了几次 `difficulty`」这种
  TS 的 `?.` / 默认参数**惰性求值**语义也可观测（`hp_map?.[difficulty]` 只在 `hp_map`
  非 nullish 时才读 `difficulty`）。
- **两个入口都要用**：`upd <n>` 走 `update`（有 `end_delay` 那道 120 拍的门 + `times` 分支），
  `spawn` 直接调（能把「`times` 递减」「soldier 的 `times >= 1` 判定」单独钉住 ——
  只靠 `update` 到不了那几个分支）。
- **`dead` / `teamchg` 是 C++ 侧才会踩的坑**：`Item` 被 `newitem` 覆盖后，实体上还挂着捕获
  悬空 `this` 的回调 ⇒ 端口必须 `~Item()` 摘监听（TS 没有析构所以看不出差别；不摘就是
  `0xC0000005`）。
- **`mtseed` 的位置很关键**：`Item` 的两次 `Randoming::get()` 都会推进同一个 MT ⇒ 用例里
  每次「抽随机」之前都把种子重置到同一个值，才能让两边对上（也才能让变异可观察）。
- **用例**：`cases/stage/item.txt` **622** 行（10 组：单条 data + 120 拍刷新与出列 / 未命中 /
  数组与数值 id / 空分组与内外两层 randoming / hp·mp 的四种 difficulty 与 `hp_map`·`mp_map` /
  `times` 减到 0 / 位置六档 / `facing`·`act`·`join`·`outline_color`·`reserve` / soldier 五档 /
  出列与 `release`）。
- **变异**：`mutations/stage.mjs` 从 46 条扩到 **93/93 全杀**（本刀新增 48 条）。第一轮 8 条存活，
  三个成因：① 用例没喂到（`hp_map` / `mp_map` 被我写进了 **data** 而不是 `info`；`join` 没喂
  「缺 `join_team`」那档；`z` 的 `is_num` 要「`y` 有、`z` 没有」）；② 语义上到不了（`times == 0`
  的 item 在构造里就已是 `undefined`；soldier 的 `times == 0` 会先 `release` ⇒ 递减不到；
  `times` 递减那条必须**直接调 `spawn`**）；③ 一条用例写错（`times` 那组引用的 id 在那一刻
  还没 `datas` 登记 ⇒ `spawn` 直接早退，变异不可观察）。
- **模板化的连带**：`Randoming` 的定义文本变了 ⇒ `mutations/mt_random.mjs` 的 8 条锚点跟着改名，
  另有 3 条的 `to` 文本在 `RandomingT<std::shared_ptr<Randoming>>` 下**无法实例化**
  （往模板里塞 `Value(NullTag{})` / `strict_equals`）⇒ 改成 `RandomingItem<T>::null_taken()`
  与 `RandomingItem<Value>::loose_ne` 内的 `!strict_equals`（语义等价、两边都能编译）。
  `mt_random` 仍 **全杀 0 compile-error**。

### 6.9.119 `stage/Stage`（`stage` 增用例 `stage`，1045 行；变异 **108/108** 全杀）

- **移植面**：`native/lfw/stage/stage.{h,cpp}`（`IStageEntity` / `IStageWorld` / `IStageLfw` /
  `StageCallbackArgs` + `StageCallbacks` / `Stage : IItemHost`）；`IItemEntity` 增 `team()`；
  `CMakeLists.txt` 416 → 417。
- **op 表**（`s` 前缀的是 Stage 侧，`squest` 是查询）：
  - 世界：`sbg <值>`（换掉世界的 bg）、`schangebg <值>`（调 `Stage::change_bg`，用于第二次调用）、
    `sdiff <值>`（`dataset.difficulty`）、`sbgfind <键> <值>` / `sstagefind <键> <值>`
    （登记 `datas.backgrounds` / `datas.stages`，**按数据自己的 `id` 查、重复 id 取最后一条**）、
    `splayer <值>`（`lfw.players`）、`stmseed <n>`。
  - 假实体：`sent <标签>`、`sentdata <标签> <值>`、`sentce <标签> <值>`（设 `data.base.ce`）、
    `sentteam` / `sentctrl` / `senthp` / `senthpmax` / `senthpr` / `sentmp` / `sentmpmax` /
    `sentmounted` / `sentx` / `sentbearer`、`sentities <标签…>`、`spuppets <标签…>`、
    `steamlike <标签>`（把 `e.team` 设成当前 `Stage.team`）。
  - Stage：`sdata <值>` / `snew` / `sfree` / `sprop`（把 `world.stage` 指到当前 Stage）/
    `sphase <n>` / `supd [n]` / `sdisp` / `skill <all|soldiers|boss|others>` /
    `spushd <数组>` / `snextd` / `scleard` / `sstopbgm` / `sdump` / `squest`。
- **`snew` 会挂五个回调监听**（`on_stage_finish` / `on_chapter_finish` /
  `on_requrie_goto_next_stage` / `on_phase_changed` / `on_dialogs_changed`），回调里只打摘要
  （`cb:phase=<curr id>,<prev id>` / `cb:dlg=<index>/<len>,<index>/<len>`）：整对象渲染会牵扯键序。
- **读/写的对齐原则**：假实体**写**打日志、**读**静默（TS 那边是属性读）；假世界的每次**读**
  都打一行（`h:bg` / `h:stage=` / `h:ents=` / `h:pupts=` / `h:diff=` / `h:camjump=`），
  `set_bg` 连**旧 bg 的层数**一起打 ⇒ `change_bg` 里的 `prev_bg->dispose()` 才有观测手段。
- **`squest` 是本刀的关键观测口**：一次打出 `ce` / `is_phase_end` / `is_dialog_end` /
  `all_boss_dead` / `all_fighter_dead` / `dialog_cleared` / `should_goto_next_stage` /
  `world_pause` / `control_disabled` / `weapon_rain_disabled` / `next_stage`。
  ⚠️ C++ 侧那些调用**必须**先按 TS 的顺序求到局部量再拼字符串：`operator+` 是函数调用、
  参数求值顺序未指定（MSVC 从右往左），而 TS 的模板字符串插值严格从左往右 —— 否则
  `should_goto_next_stage()` 会抢在 `ce()` 前面跑，宿主日志顺序直接漂。
- **`__end_testers` 两边都用数据里的 `__test`**：TS 台面在 `snew` / `spushd` 时把它就地转成
  `__end_testers`（真的表达式实例数组），C++ 侧 `IStageLfw::end_testers(owner)` 读对象上同一个
  字段 —— 那里存的是**序号**（`prepare_data` 把实例表塞进宿主池、序号写进对象），于是同一份
  数据对象永远拿到同一批实例（`reset` 复用同一批实例，游标语义才一致）。
  ⚠️ 别拿 `const Object*` 当缓存键：对象释放后地址会被复用 ⇒ 同一份用例**每次跑出来都不一样**
  （行数在当时是 742 / 740 / 732 之间跳，`is_phase_end()` 有时跑表达式有时不跑）。定位手法：临时在
  每个 op 前打一行标记、再在 `end_testers` 里打诊断，按 op 分组比对多个变体；改成序号后连跑
  25 次哈希一致。
- **用例**：`cases/stage/stage.txt` **1045** 行（23 组：构造 / `change_bg` 的早退与第二次调用 /
  `enter_phase` 的边界 / hp·mp 恢复与复活 / `player_jump` / items 的 `spawn` 与 `update` 出列 /
  dialog / `kill_*` 与 `dispose` / `fsm` 与三种 finish 回调 / 相位音效 / `phase.__end_testers` /
  `next` 是空串 / `ce` 的几档 / `spawn` 的 `times`·`ratio` / `should_goto_next_stage` 的 bot；
  16) 起的 8 组是按存活的变异补的：恢复·复活的 `>= 1` 支与 `respawn_x`、dialog 的空数组·
  `dialog_time`·`clear` 与「结束就推对话」、空 `phases` 的 `enter_phase`、`ce` 的非 `Team_1` 与
  未 `mounted`、非 boss 的 fighter / 非 fighter 的 item、should_goto 的 `>=` 与玩家判定、
  `VOID_STAGE` 的早退、`id` 的 `|| ""`）。
- **变异**：新档 `mutations/stage_main.mjs`（subject `stage`、`cases: ["stage"]`，
  **108/108 全杀**）。第一轮 115 条里 26 条存活：6 条按构造等价或不可达撤出（`is_nullish` vs
  `!truthy`、`hp_recovery` 的 `|| 0` vs `?? 0`、`hp_recovery_r` 与 `hp_recovery` 同源、
  `player_facing` 的 `is_num` 守卫、`spawn_count <= 0` vs `< 0`、`update` 里 released 的再
  `update`、`kill_*` 的队过滤恒真 —— 都记在文件头与 DESIGN §75.4），20 条补用例后杀掉
  （旧 bg 的层数、`schangebg`、`phase.__test`、`hp_respawn_r` 表、`next s ""`、`cam_jump_to_x 0`、
  不同队的实体、`ce` 的三档、`times`·`ratio`、bot、`dead e0`、`dispose` 的队伍/武器、`smtmark`）；
  剩下的 109 条里又活 18 条 ⇒ 再撤出 1 条（`dispose` 的 `_disposers`：TS 里没有 push 点、恒空）
  并用 16)~23) 那 8 组杀掉其余 17 条。
- **另记三个 harness 侧的坑**：① TS 的 `FakeItemEntity` 原来只打 `set team` 的日志、**不存值**
  ⇒ `Stage::kill_*` 读 `e.team` 时两边分叉（C++ 侧存了值）⇒ 补成 getter/setter；
  ② `senthp` / `senthpr` / `sentmp` 这类「台面摆初值」的操作在 C++ 侧走的是**静默**方法
  （`set_hp_value`），TS 侧一开始走了 `hp` 的 setter（会打日志）⇒ 补一组 `set_*_value`；
  ③ puppets 里的假实体必须有 `data.base`（TS 的 `c.data.base.ce` 会抛），C++ 侧有 `field_or`
  守卫 ⇒ 用例统一给 `sentdata`。

### 6.9.120 `World`（新 subject `world`，八份用例共 638 行；变异 **133/133** 全杀）

- **移植面**：`native/lfw/world.{h,cpp}`；`entity/entity.{h,cpp}` 的
  `mark_players_alive(Entity&, bool)`；`entity/entity_ref.cpp` 的 `ref_of` 补 `data`（真 bug，
  见 DESIGN §76.4）；`CMakeLists.txt` 418。
- **op 表**（都带 `w` 前缀，避免与 `stage` 台面撞名）：
  - 世界：`wnew`（建世界）、`wdump`（一条摘要行）、`wds <键> <值>` / `wdsdump`、
    `wbg <值>` / `wstage <值>`、`wbgdata <值>` / `wstagedata <值>`（登记假 `datas`）、
    `wrandbg <值…>`（`get_random_bg` 的返回值脚本）、`wdatas <oid> <值>`（`datas.find`）、
    `wplayer <id>` / `wplayerfighter <id>`、`wcheat <名> <0|1>`、`wmtseed <n>`、
    `wlayer <0|1>`（`lfw.layers` 里的假 UI 层）、`wcmds <0|1>` / `whandle`。
  - 实体：`wadd <标签> <值>`（真 `Entity` + `add_entities`）、`wreadd <标签>`、
    `went <标签> <字段>`（`hp` / `hpr` / `team` / `puppet` / `ghosted` / `facing` / `pos` /
    `ctrl` / `pid` / `frame` / `gone` / `ground` / `llen` / `rlen` / `bearer` / `catcher`）、
    `wteamsame <标签>`（把队伍设成当前舞台的队伍）、`wlist <名>`（连调两次看缓存）、
    `wdel` / `wdels`、`wfind <id>`、`wmark <标签> <0|1>`、`wgame <0|1>`、
    `wcount <键> <n>` / `wcountsdump`、`wcol <id> <aid> <vid> <dist>` / `wcolsdump` /
    `wcolq <aid> <vid>`。
  - 渲染与时间：`wclockset <ms>` / `wtick <ms>`（假时钟，`Ditto.Clock` 一个槽、`Ditto.Render` 一个槽 ——
  4K 拆开的，见 §6.9.121）、
    `wrender <dt>` / `wcam` / `wcamdest <x> <y>` / `wui` / `wbase` / `wfps` / `wrstart` / `wrstop` /
    `wstopupdate` / `wsleep` / `wawake` / `wserr <n> <0|1>`。
  - 边界与特效：`wbound <标签>` / `wrestrict <标签>` / `wbounding <标签> <frame 值> <info 值>`、
    `wsection <x>` / `wrandx [exclude]` / `wcnt <x>` / `wgsadd <s> <n>` / `wgsdump`、
    `wspark <x> <y> <z> <f>` / `wetc <x> <y> <z> <f>` / `wfill <n>`（把幽灵表撑到 n 条）。
  - 清理：`wclear` / `wdispose` / `wreset`；回调：`wcb <名>`（注册 11 个世界回调里的一个）。
- **`wcb` 是本刀的观测主力**：`on_stage_change` / `on_cam_move` / `on_pause_change` /
  `on_fn_locked_change` / `on_fps_update` / `on_fighter_add` / `on_puppet_add` /
  `on_dataset_change` / `on_counts` / `on_disposed` 十个都能装监听并打一行摘要
  （端口侧的 `WorldCallbackArgs` 把 TS 的位置参数打包成一个结构，台面各按字段打）。
- **TS 侧要装的东西**（端口侧都是注入的假件，没有对应步骤）：
  `Ditto.setup({ Vector2, Vector3, Clock, Render, WorldRender: 空壳, warn, Cache: 挂起的 Promise,
  JSON5, DEV })`；`world.renderer` 换成假件；假 `lfw` 的 `get world()` 指回世界（`Stage.dispose`
  会读 `lfw.world.puppets`）；`Date.now` 接到假时钟（`on_step_error`）；
  `CMDS.register("__probe__", …)`（`handle_cmds` 在端口侧是宿主缝，TS 侧用它把「有没有被调到」
  变成同一条日志）。
- **用例**：八份，共 638 行 —— `basic` 55（构造 / `dataset` / `change_bg` 的四种入参 /
  `change_stage` 的早退与回落 / `RANDOM_BG` 的 `LF2_NET` 两路）、`bound` 116（`get_bound` 的四支、
  `restrict` 的夹取与三类早退、`clear`/`dispose`/`reset_game_time`）、`callbacks` 72（十个回调）、
  `entities` 96（实体表 / puppet / 计数 / 碰撞对）、`misc` 53（`handle_cmds` / `on_step_error` /
  `base_step_ms` / 休眠）、`render` 63（时钟 / 渲染 / 相机 / UI / 暂停 / FPS 的五支）、
  `spark` 73（火花·杂项 / 武器分带 / `get_bounding`）、`teams` 110（`team_*` / 存活统计 /
  `game_result` 的每一支）。
- **变异**：新档 `mutations/world.mjs`（subject `world`，八份用例全跑，**133/133 全杀**，
  0 compile-error）。第一轮跑出 33 条存活，逐条查完发现**全都是用例没写到位**（不是端口问题），
  于是按下面的顺序补台面 / 改用例（每一条都对应一次「改完再跑」）：
  1. `bound` 的舞台数据一开始只写顶层 `player_l` / `enemy_l`，可 `set_stage` 之后紧跟的
     `enter_phase(0)` 会用 `phases[0]` **覆盖**它们（没有 `phases` 时两边都退回 `bg` 的左右界、
     反而**相等**）⇒ `get_bound` 的「队内 / 队外」两支打印出同一个数，翻不翻转都看不出来。
     给舞台数据补 `phases a 1 o 4 player_l … enemy_l …`（值再和顶层错开），并补一条
     `wbound`（`wteamsame` 之前）把两支都打出来；
  2. `bound` 的 `wclear` 落在「舞台不是 VOID_STAGE」那一支 ⇒ `set_stage` → `Stage::dispose`
     先把实体全设成 gone，把 `clear` 自己那段 `set_frame(GONE_FRAME_INFO)` 盖住。
     在 `wclear` 前加一句 `wstage s "VOID_STAGE"`（顺带把 `set_stage` 的 `dispose` /
     `enter_phase(0)` 两处暴露出来，两条变异一起进档）；
  3. `callbacks` 里先 `wadd` 再改 `ctrl` ⇒ `wreadd` 时 `entity_map` 已命中、整体早退，
     `on_puppet_add` 从没发过。改成 `wmk`（只造实体）+ `went … ctrl/pid` + `wreadd`，
     并把「再挂一次」单独留一行；
  4. `entities` 的「hp = 0 不记账」那条只写了注释没写 `hp`（默认 hp > 0，两边都记账）⇒
     补 `went f4 hp n 0`；另加一个 `hp 10` 的新实体走「human + hp > 0 ⇒ 记账」那半；
  5. `teams` 的「空队伍 ⇒ drawn」其实队伍里还有活人（另加的 `d` / `p1` / `p2`）⇒ 末尾补一段
     把活着的战士全打死再 `wgame 1` / `wgame 0`（空表 + 真舞台才能和 `'over'` 分开）。
  另外 4 条变异按构造等价 / 暂时够不着撤出（构造里的 bg 数据、构造里的 `set_scale`、`set_paused` 的同值早退、
  `reset_game_time` 要等 4K），8 条按不可观察列在档头 —— 其中
  「`clear` 里 bg 判等失效」是跑完第二轮才确认**按构造等价**（等号成立时 `Stage::change_bg`
  自己也有「同 id 早退」）。

### 6.9.121 `World` 的 `step` / `update_once` / `catch_up` / `start_update`（`cases/world/step.txt`，315 行；变异 **95/95** 全杀）

- **移植面**：`native/lfw/world.{h,cpp}`（`step` / `update_once` / `catch_up` / `start_update`、
  `WorldUpdateOptions`、`before_update` / `after_update`、`set_step_error_count`；`IWorldLfw` 增
  `clear_cmds` / `clear_broadcasts` / `ctrl_update_lookup` / `dev` / `debug`）、
  `native/lfw/entity/entity.{h,cpp}`（`IEntityHost::del_entity`、`Entity::release()`）、
  `native/lfw/base/render_scheduler.h`（**新**：`IRenderScheduler` + `render_add` / `render_del`
  槽）；`CMakeLists.txt` 与 lint 数到 440 个源文件。
- **换槽（4J 的坑）**：`Ditto.Clock` 一次性、`Ditto.Render` 重复 ⇒ 渲染不许再挂在时钟槽上（不然
  `stop_update` 之后假时钟还回调已删的 `Ticker`，ASAN 报 heap-use-after-free，见 DESIGN §77.2 /
  §77.4）。台面因此有两个槽：`FakeClock`（一次性 + 顺带跑到点定时器与渲染帧）与
  `FakeRenderScheduler`（重复）。
- **op 表增量**（`world` subject）：
  - 推进：`wstep` / `wupdate <dt>` / `wcatchup` / `wrupdate`（`start_update`）/ `wstopupdate` /
    `wticker`（把 `Ticker` 的 running / pending / base / span / deadline / last_step / rate /
    cost 与 `world.TU` 打一行）/ `wtick <ms>`（推假时钟）/ `wextra <n>` / `wexbudget <ms>`。
  - 钩子与休眠：`whook <none|before|after|both|sleep|setsync>`（`sleep` 会在钩子里 `sleep()`、
    `setsync` 会把 `sync_render` 改成 0）、`wsleep` / `wawake`。
  - 观测：`wcamt`（相机 destination）、`wtrscaleto <x> <y> <z> <rate>`（`transform.scale_to`）、
    `wentump <标签>`（**不在 `entities` / `ghosts` 里的实体**也能打一行）、`wbcpush <s>`、
    `wreset`。
  - 回调：`wcb on_ups_update` / `on_fighter_del` / `on_puppet_del` / `on_disposed` 这四个是本刀
    新用上的（`step` 的清运、`update_once` 的 UPS）。
- **dump 增量**：`|spt=`（`stage.phase_time`）、`|sft=`（`stage.time`，`fsm.update(1)` 每帧 +1，
  用来盯 `stage_->update()`）、`|bgu=`（`bg.update_times`）；实体行补 `pos.y` / `pos.z` /
  `state` / `aabb_min_x`。
- **用例要点**：三帧推进（帧名 wait → next、体力、AABB 排序、武器分带、存活计数、相机目标）、
  暂停三支、zoom = 2 与 zoom = 0（falsy 兜底）两个后台、`world_pause` 的舞台（`step` 在实体循环
  之前 return）、相机目标四支（local → human → puppet → fighter → 都不满足）、`_gones` 清运
  （`frame` 写成 gone / `state` 写成 `Gone(9998)` / `hp 0` 三种进法）、幽灵两支、`update_once`
  的 Sync / Half / need_FPS / need_UPS 门、`catch_up` 的预算、钩子（含 `sleep` 与 `setsync`）、
  `Ticker` 与 `base_step_ms` 坏值、`Ditto.DEV` + 355 实体的调试打印。
- **变异档**：`mutations/world_step.mjs`（`cases: ["step", "render"]`，95 条）。档头写清了 16 条
  「不可观察 / 构造等价 / 留给下一刀」的理由：碰撞表两清（4K 没东西往里写）、buff 四句（台面还没
  有真 `Buff`）、`Entity::release` 里除挂载门外的五句（`_mounted` 恒 0）、`_gones` 跳过那一支
  （同一帧就先被压实摘掉）、`_gones` 清运里那次 `mark_players_alive`（冗余）、`Entity::update`
  重写 `position` 导致相机 z 求和恒 0、`update_once` 里 `worker != nullptr` 那一段（假时钟推不动
  `Ticker` 的步进）。

### 6.9.122 `World` 的碰撞配对与 `collision/` 的 82 条缝（`cases/world/collision.txt`，345 行；变异 **38 条 36 全杀 / 2 存活 / 0 compile-error**）

- **台面**：不新增 subject —— 这一刀的两侧都是**真代码**。TS 侧跑真 `World.step`（真
  `collision_get` / 真 `collisions_keeper`），C++ 侧跑端口 `World::step` + `WorldCollisionHost`
  的接线。用例只需造一颗「帧带 `itr`」的实体和一颗「帧带 `bdy`」的实体，`wstep` 一次。
- **用例要点**：两颗实体 x 相同（`a_max_x < b.aabb_min_x` 的 `break` 不影响；z 轴的 AABB 剔除也
  要让 `a_max_z < b_min_z` 为假）、判定框 `x=-40 w=80` 相交、`hit_flag 61`（AllEnemy）让
  `itr_flag & victim.data.type` 与 `bdy_flag & attacker.data.type` 都命中、
  `is_ally` 为假 ⇒ `ally_flag = Enemy` 也被命中、双向 `emission` 为空 ⇒ 队伍那条不拦。
  观测量：`pc=1`（配对比次）、`col=1`（本帧加入的碰撞）、受击方 `hp` 从 20 掉到 15（走
  `handle_itr_normal_bdy_normal` → `handle_injury`）；另有 `h:warn` 的 `spark` 缺数据告警。
- **用例结构**（一个世界、十二组实体，x 分段：0 / 3000 / 6000 / 9000 / 12000 / 15000 / 1000×4 /
  24000 / 27000）：单向（`A` 带 `itr`、`B` 带 `bdy`）锁「配对 + 伤害」；双向（`C`/`D` 都带 `itr` 与
  `bdy`）锁 `c1` 与 `c2` 两条都 `add_collision`；`hit_flag 16` 那一组锁 `itr_flag & victim.data.type`
  的失败路径（`pc` 加一但 `col` 不增）；同队（`went G team t1` / `went H team t1`）那一组锁
  `attacker_is_ally`；`SuperPunchMe`（itr kind 6）那一组锁 `handle_super_punch_me`
  → `victim.add_v_rest`（`vrests` 从 0 变 1）；`Catch`（itr kind 1）那一组锁 `handle_itr_catch`
  （`catching` / `catcher` 互指 + 两条 `catchingact` / `caughtact` 告警）；`Pick` / `Pick 的 bot 门` /
  `Block`（`handle_rest`）/ `Freeze` / `rest` 支 / 部分重叠的判定框 见下面的分批清单。
- **帧里的 `itr` / `bdy` 必须是数组**（`a 1 o 7 …`）：写成 `o 1 0 …` 会得到 Object，
  `collision_get` 的 `itr?.length` 判空直接返回 `null`（本例第一次跑就是 `col=0`）。
- **台面补的两条假面**（TS `subjects/world.ts`）：`lfw.acquire_collision()` 必须**存在且静默**
  （真实池子永远空 ⇒ `|| {}`；端口那边池子在宿主里、不经过测试台，所以 TS 侧不能记日志），
  `lfw.factory.create_buff` 给一条静默 stub（端口由 `IWorldLfw::create_buff` 回答，默认造不出）。
- ⚠️ **`test` 不 build，`build <subject>` 只建 subject**：改完库再跑 `test` 会拿**旧的库**，
  表现为「我明明改了却没生效」。本次踩到：`keeper.cpp` 的 `victim.data.base.hit_sounds` 改完
  直读之后仍看到旧的 `h:datasfind=<vdata_id>` 多一行，一度以为是新偏差，实际是库没重建
  （`build`（不带 subject）之后那一行消失）。**改库后先 `build` 再 `test`**。
- **`KeeperEnv` 加字段时**：`set_keeper_env(env)` 会把当时那份 `env` **拷**进全局槽 ⇒ 新缝必须在
  `set_keeper_env` **之前**绑定，否则 `handle` 调用到空的 `std::function`（`-fno-exceptions` 下
  直接 `__fastfail`，表现为二进制零输出、退出码 `0xC0000409`）。
- **观测量扩展（同一刀的第二趟）**：`dump_entity` 两侧补 11 个碰撞观测量（`motionless` /
  `shaking` / `catching` / `catcher` / `holding` / `vrests.size` / `collided_list.length` /
  `collision_list.length` / `resting` / `fall_value` / `is_on_ground`），用例加两组：
  `SuperPunchMe`（itr kind 6）⇒ 受害方 `vrests` 从 0 变 1；`Catch`（itr kind 1）⇒ `catching` /
  `catcher` 互指 + 两条 `[handle_itr_catch] catchingact / caughtact got undefined` 告警。
  六组实体上这些字段都取到了非零值（`motionless` 8、`shaking` 8、`vrests` 1、`collided_list`
  1/5、`collision_list` 1、`resting` 5、`fall_value` 100）⇒ 回写类的缝全部可锁：变异档 14 → **25**。
- **扩展当场抓到的漏接**：`WorldCollisionHost::handle` 起初没补 `c.dataset`（TS 是
  `attacker.world.dataset`）⇒ `handle_stiffness` 的 `itr_shaking` 回退读到 `undefined` ⇒
  `shaking` 变 `NaN`（TS 是 8）。补 `c.dataset = _world->world_dataset();` 后一致。
  ⇒ 先把观测面铺开，再接「看不见」的缝，是值得的顺序。
- ⚠️ **`renderValue(数字)` 打的是 `n<十进制>:<十六进制位模式>`**：`st=n1:3ff0000000000000` 是
  **一个**字段（state），不是两个。按 `:` 切 dump 行做分析时会多算一段（本次差点据此以为
  「dump 多了一个观测量」；用带标签的临时 dump 对了一次才确认）。
- **十组实体 = 十条支路**（4L 收尾第二批）：除第 1–6 组外又加了四组 ——
  - `x=1000` **Pick**（itr kind 2）：攻击方 `M`（`ctrl base`）捡起躺在地上的武器 `N`
    （`type 16` + 帧 `state 1004`）⇒ `handle_weapon_picked` → `attacker.pick(weapon)`，
    观测是 **`M.holding` 从 `-` 变成武器 id**（同时武器被挂到手上 ⇒ 它的 `x` 变 `nan`，两侧一致）。
  - `x=1000` **Pick 的 bot 门**：`S` 用 `ctrl bot`、`T` 的**帧**里带 `bot_ignore: 1` ⇒
    `collision_test` 里 `bot_ignore == 1 && is_bot_ctrl` 这条门。⚠️ 实测这条门在本用例里
    **不可观察**（手工把 `a.bot_ignore` 置 `Value()` / `a.is_bot_ctrl` 置恒假，输出逐行不变）——
    带 `bot_ignore` 的那件武器和 `Weapon_OnGround` 的状态机纠缠，配对要么没成、要么成了但
    keeper 那一趟没有配置命中 ⇒ 观测全为零。所以变异档里**没有**这两条（理由写在档头）。
  - `x=24000` **Block**（itr kind 14）：`handle_rest`（这次 `rest` 为 0）⇒
    `attacker_set_arest(max(dataset.min_arest, itr_arest + arest_offset))` ⇒ dump 补了 `arest`
    这一列后 `arest = 20` 可观测。
  - `x=27000` **Freeze**（itr kind 16）：`fall_value` 递减 + `injury 1` + `handle_rest` +
    `handle_stiffness`（`motionless = 8`）+ `enter_frame_by_id(data.indexes.ice)`。
- **`arest` 也进了 dump**（`dump_entity` 末尾，两侧同序）：`resting` / `fall_value` /
  `is_on_ground` 之后。变异档随之 25 → **29 条**（新增 Pick 分发 / Freeze 分发 /
  `attacker_pick_victim` / `attacker_set_arest`）。
- ⚠️ **帧里必须给 `centerx` / `centery`，否则判定框全是 `NaN`**（4O 抓到的台面坑）：
  `world.get_bounding(e, frame, box)` 用 `frame.centerx` / `frame.centery` 算 `left` / `top`，
  帧里没有这两项 ⇒ `to_number(undefined)` = `NaN` ⇒ **每个立方体都成了 `NaN`** ⇒
  `collision_test` 的重叠判定（`ac.left > bc.right || …`）全都不成立 ⇒ 判定形同虚设
  （表现：所有同 x 的实体都能配对、`collided_list` 能到 7）。补上 `centerx n 0 centery n 0`
  之后几何才真的生效（用例输出不变 —— 因为同 x 的框本来就重叠 —— 但 `get_bounding` 的
  left/right、bottom/top 两条变异从 SURVIVED 变成 killed）。
- **第 11 组：`rest` 支**（itr kind 14 + `vrest n 5`、没有 `arest`）⇒
  `collision_get` 算出 `rest = max(dataset.min_vrest, 5 + dataset.vrest_offset)` ≠ 0 ⇒
  碰撞 `id` 换成 `core.new_id()`，`handle_rest` 走 `if (c.rest) { victim_add_v_rest; return; }`
  ⇒ 受害方 `vrests` 变 1。这一组把 `victim_get_v_rest`（`collision_test` 里的 `rest` 重复门）
  与 `core.new_id` 两条缝也变成可观察。
- **第 12 组：部分重叠的判定框**（itr 框 `x=-40 w=80`、bdy 框 `x=20 y=20 w=80 h=80`）⇒
  left/right、bottom/top 互换会真的把某一对挤成不相交 ⇒ 两条变异 killed（前十一组两组框
  完全重合，左右上下互换是对称的 ⇒ 观察不到）。z 方向（`near` / `far`）两组框都是默认值
  ⇒ 仍然观察不到（要 `z` / `l` 不同的框）。
- **第 13–16 组：`Whirlwind` / `weapon_is_hit` / `ball_hit_other` / `healing`**（4P）：四组的
  碰撞都成了（各 `collided_list` +1，两侧一致），但**效果观测不到**：
  - `handle_itr_kind_whirlwind`（itr kind 15）对 Fighter 受害方只 `set_velocity`（甩出去要等下一帧）；
  - `handle_weapon_is_hit`（攻击方 itr kind 5 = WeaponSwing、受害方 `type 16` + 帧 `state 1000`
    = `Weapon_InTheSky`）同样只改速度；
  - `handle_ball_hit_other`（攻击方 `type 32` = Ball + 普通 itr、受害方 Fighter + bdy Normal）
    只改速度 / 血；
  - `handle_healing`（itr kind 8 + `injury 5`）只往 buff 表里塞一条 `Healing`（buff 表没进 dump）。
  于是 dump 里再补 6 列速度（`velocity.x/y/z` + `prev_velocity.x/y/z`，两侧同序）—— **本台面里
  它们全是 `0`**（`set_velocity` 之后在同一个 `step` 里被清掉；位置到 dump 时也回到原地）⇒
  这一刀**没有新增变异条目**（按惯例把理由写进档头）。要锁这四条支路得换观测法：只跑 handler
  不跑完整 `step`，或把 buff 表 / 「本帧内的速度」也进 dump。
- ⚠️ **六组实体并不互相隔离**：`step` 里地图边界的回中逻辑会把 x ≥ 3000 的实体挪到地图中心
  （x = 1588），而这一步发生在**实体推进之后、配对之前** ⇒ 第 2–6 组在配对那一瞬全在同一 x
  （受击方 `collided_list` 到 5）。x 分段只决定配对前的排序，别指望它隔离；好处是交叉配对让
  六条 handler 支路（stiffness / `SuperPunchMe` / `Catch` …）都跑到了。值都在 map 内的实体
  （第 1 组 x=0）才真正只跟自己那一段互配。
- ⚠️ **一个进程里可以有多个世界，但要轮流步进**（4M 之前是「只能有一个」）：11 个 Env 挂在模块级
  全局槽上，宿主发布时登记自己（`g_published`）、`ensure_published()` 按需重发、析构时只有
  「当前发布者」才清空槽 ⇒ 旧世界的宿主被销毁后，槽里不会留下指向它的 lambda。本用例把六组实体
  放在**同一个世界**里按 x 分段（段与段之间靠 `a_max_x < b.aabb_min_x` 的 `break` 隔开）；
  「换世界」那条路径由 `cases/world/lifecycle.txt` 单独锁（见 §6.9.123）。
- **4Q：三个视图合并成一个 `EntityCollisionView`**（`entity/entity_collision_view.{h,cpp}`，详见
  DESIGN §78.8）。两处直接派生改成虚基类（`struct IFallEntity : virtual IHandlerEntity`、
  `struct IWeaponIsHitEntity : virtual IHandlerEntity`）⇒ 菱形消失，一个类同时实现
  `INdbdyDefendEntity` / `IWeaponIsHitEntity` / `IActionEntity` + `IH3Entity` + `IH4Entity` +
  `IFrozenEntity` + `IHealingEntity` + `buff::IBuffEntity`（三边同名方法体本来就逐字相同 ⇒ 直接
  去重）。连带两处（都不改行为）：① 虚基类指针不能再 `static_cast` 回视图（`C2635`）⇒ 宿主建
  视图时登记一张 `IHandlerEntity*` → `Entity*` 反向表、`ICollisionViewHost` 加
  `entity_of_handler()`（`IActionEntity` / `IH3Entity` 是非虚基类，`static_cast` 照旧）；
  ② `IFallEntity::velocity_x()`（`double`）与 `IActionEntity::velocity_x()`（`Value`）同名同参不同
  返回类型没法共用一个重写 ⇒ 后者改成 `double`（调用处 `-to_number(x)` → `-x`）。宿主的
  `_handler_views` / `_weapon_views` / `_action_views` 合成 `_collision_views`，`handler_view` /
  `weapon_view` / `action_view` 三个访问器（调用点一个没动）返回**同一实例**。**观测量一条不加**：
  本用例 345 行逐行一致、`all` 157/157、变异仍 **38 条 36 全杀 / 2 存活 / 0 compile-error**
  —— 档里视图那三条（`catcher` / `set_catching` / `set_catcher`）的 `from` 串已从
  `EntityHandlerView::` 改锚到 `EntityCollisionView::`，仍然被杀。

### 6.9.123 宿主生命周期（`cases/world/lifecycle.txt`，54 行；与 6.9.122 共用一个变异档）

- **场景**：同一进程里 `wnew` 两次 —— 第一个世界造一组会碰撞的实体并 `wstep`，然后 `wnew`
  （旧 `World` 被 `unique_ptr` 析构 ⇒ `WorldCollisionHost` 析构 ⇒ 模块级 Env 槽的归属变更），
  第二个世界再造一组并 `wstep`。两侧输出逐行一致，且第二组观测与第一组同形。
- **修法**（`native/lfw/world_collision.{h,cpp}`）：`g_published` 记录「当前发布者」；
  `ensure_published()` 在 `collision_get` / `collision_test` / `handle` 三个公开入口各调一次
  （不等就重发，成本一次指针比较）；析构时只有 `g_published == this` 才 `clear_globals()`
  （把 11 个槽 set 成空 Env）并复位登记。
- ⚠️ **这条用例锁不住「悬垂 lambda 真被调用」**：TS 侧没有这个概念，台面上也没有「不建新宿主
  就去摸碰撞层」的 op（任何碰撞层入口都会先 `collision_host()` 惰性建宿主 ⇒ 顺手重发）。
  它是设计性的防御，用例锁的是「换世界之后仍能正常步进 + 两侧一致」。也因此这一刀**没有**
  对应的变异条目（改坏 `ensure_published()` / `clear_globals()` 的都是不可观察的）。
- **踩坑**：改这条时先 `build`（不带 subject）再 `test` —— 只 `build world` 不会重建库，
  差分台面会拿旧库跑，表现为「改了没生效」（§6.9.122 同款坑）。

### 6.9.124 `ditto/xml` 方言的主体（新 subject `xml`，四份用例共 278 行；变异 48/48 全杀）

- **参照侧 = `tool/src/xml`**（`ToolXMLElement` / `ToolXML`，TS 台面直接 `import`；`fast-xml-parser`
  由 esbuild 从 `tool/node_modules` 解析）。两份 TS 实现（浏览器 DOM 版 / tool 纯内存版）的语义差
  归 README 偏差表；端口默认实现 = tool 那份（`native/lfw/ditto/xml/tool_xml_element.{h,cpp}` /
  `tool_xml.{h,cpp}`），详见 DESIGN §80。
- **`stringify()` 复刻 fast-xml-parser `XMLBuilder({format:true, ignoreAttributes:false,
  attributeNamePrefix:'@_', suppressEmptyNode:false})`**：2 空格缩进、每行尾 `\n`、**同名子元素按
  标签分组**（同一标签聚到一起、首次出现定组序 —— `[a,b,a]` 输出 `a,a,b`）、空元素（无属性/无子元素/
  无文本）整块被丢（自己是 `""`、在父里连标签都不出现）、`<x></x>` 不压成 `<x/>`、转义只有
  `& < > " '`、有子元素时文本被丢、空根回 `""`。用例 `quirks` 专锁这些形状。
- **tool 的两处「怪但照抄」**：① `as_number()` / `as_boolean()` 先调 `as_string()`，而它按
  `type == 'string'` 挡一道 ⇒ 对 number / boolean 元素**恒走缺省**（浏览器版不走 `as_string`）；
  ② `get_str_arr` / `get_num_arr` **忽略 `or`**（端口接口因此只给 optional 版）。两者的函数体
  尾段/合并顺序中不可观察的部分记在 `mutations/xml.mjs` 头部的「有意不覆盖」。
- ⚠️ **台面坑一：子元素分支的门是「标签 = 名字」且「标签是类型名」**。`get_str` / `get_str_arr` 读
  `children_by_tag(name)` 之后还要过 `as_string()`（`type == 'string'`）⇒ `<sound value="…">` 这种
  「业务名标签」的元素**读不出来**（tool 与端口一致）；要观察子元素优先/合并顺序，子元素必须写成
  `<string>` / `<number>` … 或 `<value type="string">`。`reads` 用例专门留了这两组「别名的子元素」。
- ⚠️ **台面坑二：`or` 值参数用裸 token**（字符串带引号 / 数字 / `0|1`），不吃 `parse_value` 的
  类型化字面量（`s "def"` 会留下 `"def"` 没消费 ⇒ 报 trailing token）。
- ⚠️ **台面坑三：`bytag` / `bytagi` 出来的别名是裸指针**（父元素持有），只给读口用；`ins` 只受理
  工厂造的根（C++ 侧 `shared_ptr` 才能双重挂载 —— tool 的 `insert` 不先摘旧父）。
- `parse` 未搬（`ToolXML::parse` 回 `nullptr`）：LFW 里真调用点只有 `LFW.ts` / `Resources.ts`
  （后续刀），`dat_translator/xml/*` 全走 `create` / `from_*`。
- 全量差分 **168/168**、lint 全清。

### 6.9.125 xml 方言读写层（`cases/xml/layer.txt`，148 行；变异 `xml_layer.mjs` 44/44 全杀）

- **台面 op**：在 `xml` subject 上加了一组通用读写 op —— `dv <dvar> [literal]`（数据对象）、
  `dset/ddel/ddump`、`dvp <dvar> <fn> <eid|-> [arg]`（读口按函数名分派；`eid` 给 `-` =
  `undefined`）、`dvo`（`one_or_arr`/`non_empty`）、`dvm`（`merge_by_tag`，可选 target）、
  `wrv <eid> <fn> <dvar> <tag>`（写口，打 `wrv|<eid>|<esc stringify>`）、
  `wrins <parentEid> <fn> <dvar> <tag>`（`xml_x_t_next_frame` 一串挂父上）。两侧函数名
  用 TS 原名（`xml_2_bdy` / `xml_x_bdy` …），后续批次照此扩表。
- ⚠️ **`or` 回落是 any**：`el.get_str(name, ret.name)` 里 `ret.name` 可能是数字/布尔/undefined
  ⇒ 端口的 `xml_util.h` 用 `Value` 装 `or`；`xml_2_qube` 的 `rect/qube/旧值` 链也按「原样回落」
  实现（不能折成 `optional<double>`）。
- ⚠️ **`merge_by_tag` 的用例要用 parser 真会读的字段**：第一版用例给 `<base a="1">` 这类
  字段，`xml_2_bdy` 全忽略 ⇒ 合并/不合并输出一样，两条变异存活；换成 `id`/`name` 才锁住。
- ⚠️ **裸属性**：`XMLBuilder` 把值恰为字符串 `"true"` 的属性渲染成裸属性（`<action pretest>`），
  由本批往返用例抓出（§80 的 `stringify` 需带这条；`quirks` 增补一组用例）。
- 读口 `xml_2_armor_info` 的 `-`（undefined）与写口假值守卫（`wrv ... u` 打 `u`）都有用例；
  `xml_2_cpoint` 的 `reorder_fields` 在本批不可观察（记在 `mutations/xml_layer.mjs` 头部）。

### 6.9.126 xml 方言读写层第二批（`cases/xml/layer2.txt` 150 行 + `cases/xml/entity.txt` 71 行；变异 `xml_layer2.mjs` 65/65 全杀）

- **台面扩展**：`dvp` 从「可选一个 arg」改成**多参**（`args` 向量，`xml_2_map` 需要
  「tag + reader 名」两参）；新增三个 op —— `wrl <name> <fn> <dvar> [tag] [wfn]`（列表
  写口：`xml_x_hit_key_map` / `xml_x_picture_info_map` / `xml_x_model_info_map` /
  `xml_x_frame_pic_map` / `xml_x_map`（最后多给一个 writer 名），打
  `wrl|<name>|n=…` + 逐项 `wrl|<name>|<j>|<esc stringify>`，列表项存 `<name>:<j>` 可再
  `ins` 挂到别的元素上）、`wjson <dvar> <tag> [keyOrder 字面量]`、`wstages <dvar>`
  （`xml_from_stage_info`）。`readers`/`writers`/`parsers` 表按 TS 函数名全量补齐；
  `parsers` 里 `xml_2_frame_indexes`/`xml_2_frame_model`/`xml_2_partial_world_dataset`
  这类「收 `IXMLElement | undefined`」的用 lambda 包一层指针。
- **默认 tag 的写法**：`xml_x_dat_index` / `xml_x_entity_data` / `xml_x_bg_data` /
  `xml_from_world_dataset` 的 tag 给 `-` 表示走 TS 的缺省参数（C++ 调无 tag 重载）。
- ⚠️ **`xml_2_bg_layer` 需要下标**：TS 的 `xml_2_non_empty(el, "layer", xml_2_bg_layer)`
  走 `Array.map`，`z` 的兜底链用到 map 下标 ⇒ C++ 侧 `xml_x_non_empty.h` 新增
  `XmlElementParserIdx`（`Value(const IXMLElement&, size_t)`）与同名重载；
  `readers` 表里直接给下标（`xml_2_bg_layer` 单测走 `dvp` 的自选 index）。
- ⚠️ **`merge_by_tag` 的 parser 收引用**：`xml_2_partial_world_dataset` 收指针 ⇒
  `parsers`/调用点要用 lambda 转一手（`[](const IXMLElement& e){ return …(&e); }`），
  否则重载解析报「无法从 overloaded-function 转换」。
- ⚠️ **`Array` 没有迭代器**：端口里对本家 `lfw::Array` 只能下标循环（`a->size()` /
  `a->at(i)`），不能写 range-for（`for (const Value& v : *a)` 编译不过）。
- ⚠️ **缺省参数 + `defines` 查表**：`xml_x_frame` 的 `behavior_label`/`state_label` 用
  `defines::find`（`defines_data.h`，**不是** `defines.h`）查生成的
  `FRAME_BEHAVIOR_LABEL_MAP` / `StateEnumNames`（TOP_LEVEL 表 +2）。
- 变异档头部「有意不覆盖」：`xml_x_map` 两行死代码（`get_str(or)` 只读不写）、
  `delete_undefined`/`reorder_fields` 的渲染不可观察、`xml_x_partial_world_dataset`
  的假值面、`xml_from_json` 的 attrs 数组分支（`attrsOf` 已滤数组）。
- 用例教训：**单元素数组 vs 多元素**的切片分支（`xml_2_frame` 的 `pics` 只在长度 > 1
  时出来）、**没有子元素 / 没有 name** 的边界（`xml_2_bg_data` 的 terrain、
  portraits 的空串键）——第一轮 4 条变异存活全是这类「用例没喂到该分支」，补三行
  用例即全杀。

### 6.9.127 `animation/` 家族（5 份用例共 287 行；变异 `animation.mjs` 76/76 全杀）

- **新 subject `animation`**：`mk <id> loop|anim|delay <v>|easing [begin] [end]|sine|
  cosine|tangent [b] [h] [s]|seq [ids...]`；`set <id> <prop> <num>`（`duration`/`time`/
  `value`/`direction`/`fill_mode`/`reverse`/`times`/`count`/`offset`/`bottom`/`height`/
  `scale`/`val_1`/`val_2`）；`seteasing sine|linearity|quint`；`call <id>
  start [0|1]|end [0|1]|calc|update <dt>|auto_trip <0|1> <dt>|continue|reset|set <c> <t>`
  （后三条是 `Loop` 的）；`seqpush <seq> <id>`；`get <id> <prop>` 打
  `get|<id>|<prop>|<payload>`：数字 = **量化位**（1e-3 粒度 `qb`）、布尔 `b1/b0`、
  `seq` 的 `curr` 打**下标**或 `u`（空表空指针）、`anims` 打个数。
- ⚠️ **NaN 位型**：`strtod("NaN")`（MSVC，全 1 payload）与 V8（`7ff8…`）不同位 ⇒
  台面统一 `isnan ⇒ "nan"` 后再量化（`qb`），否则 `get a time NaN` 一行就把差分卡死。
- ⚠️ **三角**：用例避开 `tan` 极点（`time = 250` / `750`，周期 500）与巨大实参——
  `Periodic.start(1)` 会把 time 设成 `MAX_SAFE_INTEGER`，续接 `update`/`calc` 的参数
  归约 V8 vs UCRT 会超 ulp 分歧 ⇒ 先 `set time` 小值再算。
- ⚠️ **`mk d delay N` 是值不是时长**：`Sequence` 用例必须再补 `set d duration N`，
  否则 seq 总时长为 0、`update` 早退 + 段扫描全 inert（第一轮 5 条逆放侧变异因此存活）。
- ⚠️ **头文件缺省实参不可观察**：台面 `mk` 对 `easing` / `sine` 等一律显式补参 ⇒
  改头里的 `= 1` 之类不会被差分抓住（变异档记「有意不覆盖」）。
- 变异档另记「有意不覆盖」：`Loop.continue_` 的 `times <= 0` 同观分支、`Easing.calc`
  的因子 clamp（time 已被夹住）、会死循环的 `update` 改写（`time ±= 0`、去 `done()`
  早退）、`easing.cpp` 换 `ease_linearity` 会缺 include（编译不过 ⇒ 换成 lambda）。

### 6.9.128 schema 家族（`cases/schema/*.txt` 3 份 313 行；变异 `schema.mjs` 47/47 + `schema_wiring.mjs` 6/6 全杀）

- **新 subject `schema`**：`nv <vid>`（新建 `SchemaValidator`）、`sch <sid> <TableName>`
  （生成表里的真 schema）、`schv <sid> <literal>`（台面自搭 schema——schema 也是 Value，
  直接走值字面量文法）、`val <vid> <sid> <literal>`（`v|<vid>|<sid>|b0/1|e=N|w=N` +
  `ve|…` / `vw|…` + `vv|…` 校验后的值）、`rz <vid>`（reset 后打计数）、`cst` / `cph`
  （`check_stage_info` / `check_phase_info`，后者两个字面量：stage / info）。生成表由
  `node native/tools/gen_defines_schemas.mjs` 产出（TS 侧 `subjects/gen/defines_schemas.ts`
  引真模块，两边同源）。
- 用例教训：`o N` 的 **N 手数错**是这台面最容易踩的坑（首跑 4 处截断，报错会打整行 token
  dump，照着数就行）；`val` 的 errors **累积**（想干净计数记得 `rz`）。
- ⚠️ 断言消息里的 path 是 `make_schema` 的产物：`IStageInfo.phases.phases`（items 的
  `{key, ...items}` 展开次序）、`IBgData.terrain.ITerrainInfo.x1`（items 自带 key 覆盖外层）、
  自搭 schema 缺 `path` 时字面打 `undefined` —— 差分靠这些**逐字**对齐。
- `loader_more` 侧：`bg` op 输出后面跟 `bgw` / `bge`（TS 台面把 `Ditto.warn/error` 换成收集器；
  端口走 sink 参数）。`Ditto.warn/error` 收的是**整个数组**（一次一个参数）⇒ 台面展开成逐条行。

### 6.9.129 cmds 家族第一批（`cases/cmds/*.txt` 5 份 683 行；变异 `cmds.mjs` 56/56 全杀）

- **新 subject `cmds`**：`cmd s "…"`（直过 `CMDS::handle`）、`wcmds s "…"…` + `handlecmds`
  （队列过 `World.handle_cmds` 缝）、`h s "key"`（查 handler 有无）、`hdump`（世界快照：
  paused / fn / diff / playrate / inf / cam / lock / dest / lim / st / bg / cnt / pup / ents /
  ghosts / cmds）、`ds <key> <literal>`、`bdata`/`sdata`、`bg`/`stage`、`cheat <name> <0|1>`、
  `mk`/`add <label> <data>`、`ent <label> hp|hpr|mp|team <literal>`、`pup <pid> <label>`。
- 台面私货 `__probe__`：两侧同名注册（**大写键**注册，暴露注册侧降格），打
  `p|/pw|i|/pp|i|/ps|i|/pn|i|/pns|i|` 与 `pa|<key>|s|n|ns` 各键（键名表两边必须一致）。
- ⚠️ **实体 id 恒来自假 `new_id`**（`e1/e2/…`，与创建顺序绑定；`data.id` 只进
  `_origin_data_id`）—— `KILL`/`DESPAWN` 用例里的 id 词要照**创建顺序数**；label 只是台面
  自己的把手（`ents=` 打的是真 id）。
- ⚠️ **dump 实体带 `:fr=`（帧 id）**：`World::del_entity` 只换 gone 帧、**不摘表** ⇒ 没有
  这个字段时「删除 vs 打空血」在 `ents=` 里同观（第一轮 DESPAWN 变异因此存活）。
- ⚠️ **全空白命令禁止**：TS `CMDS.handle` 对它 `TypeError`（`words[0]` 是 `undefined`）——
  用例的 `cmd`/`wcmds` 别发。
- ⚠️ **未移植的 11 条命令**（SPAWN / SET_PUPPET / F4 / F8 / cheat 族 / KEY_EVENT /
  POINTER_EVENTS）在 TS 登记、端口没有 ⇒ `h s "…"` / `cmd s "…"` 都不许碰。
- ⚠️ `ds` 的 key 是**裸词**（`ds playrate n 5`），不是带 `s` 标签的字面量。
- ⚠️ 舞台击杀族（`kill_all` / `kill_boss` / `kill_others` / `kill_soliders`）只扫
  `stage.items` —— 台面没有重生流程 ⇒ 它们都是空转，**方法互换**不可观察（变异档记
  「有意不覆盖」；守卫 / 文案 / 计数三层已覆盖）。
- ⚠️ 假件细节：`factory.acquire_ctrl` 必须回**非空**基类控制器（TS `add_entities` 对
  fighter 会无判读 `ctrl.player_id`）；`fakeLfw.world` 的 getter 要接回世界实例
  （`Stage.dispose` 读 `this.lfw.world.puppets`）；`Ditto.setup` 要给 `WorldRender`
  占位类（`World` 构造里 `new` 一下就会被换掉）。

### 6.9.130 cmds 家族第二批（`cases/cmds/{cheat,spawn,set_puppet,f8}.txt` 4 份 227 行；变异 `cmds2.mjs` 58/58 全杀）

- 新 ops：`data <literal>` / `fdata <literal>` / `wdata <literal>`（三张假数据表——`data` 给 SPAWN 的
  `datas.find`（全表）、`fdata` 给 SET_PUPPET 的 `get_fighters`（**只认这张**）、`wdata` 给 F8 的
  `get_weapons_of_group`（按 `group` 过滤并**回拷贝**））；`player <pid> <name>`（真造 `PlayerInfo`，
  SET_PUPPET 的玩家口）；`ctrl <label> <bot|human> <pid>`（直造控制器挂实体：`is_human` 看词、
  `player_id` 用给定词——「human 但 pid 不同」这个换控分支的唯一挂载手段，第一轮正因缺它存活一条
  变异）。
- 新假件日志：`h:loadplay=<path>`（`sounds.play_with_load`）、`h:cheatchanged=<cmd>|0/1`、
  `h:datasfind=<oid>`、`h:fdatafind=<id|u>`（miss 打 `u`，两侧对齐）、`h:wpgroup=<group>`、
  `h:entadd=<id>|<hex>`（第二参走 hex —— `1.0` vs `1` 的格式差会假红）、`h:randominfo=<eid>`、
  `h:ceplayer=<pid>` / `h:cebot=`（空 pid 打 `""`）、`h:acqlocal=<pid>`、`h:release`（换控 setter
  先释放旧控制器）。
- `hdump` 实体列尾追加 **`:did=`**（`data.id` 原值）——SET_PUPPET 换数据（`transform`）靠它才可观测
  （帧 / 名 / 位置都可能同观）。
- ⚠️ **数据对象要带 `frames`**：SPAWN / SET_PUPPET 结尾都 `attach()` → 找 auto frame →
  `data.frames["0"]`，缺了直接炸（用例里的 `o …` 字面量别省这棵子树）。
- ⚠️ **`player` op 前先给 `Cache` 占位**：`PlayerInfo` 构造走 `load()`（读 `Ditto.Cache`），
  台面 setup 给 `get: () => new Promise(() => {})` 即可（照 `world` subject 的形态）。
- ⚠️ **`ctrl` op 的 `player` 字段**（`{ id: 7, name: "P7", mine: true }`）只为不炸——判定只读
  `__is_human_ctrl__` 与 `player_id`。
- ⚠️ 作弊码用例的观测面只有 `h:cheatchanged` / `h:loadplay`（dataset 写入无读取口）——宽松比较
  早退的情形靠「回调日志**缺席**」来断言（`ds GIM_INK b 1` / `s "1"` 后 `GIM_INK 1` 无日志，
  `n 5` 后有）。

### 6.9.131 `loader/DatMgr`（`cases/dat_mgr/*.txt` 6 份 544 行；变异 `dat_mgr.mjs` 82/82 全杀）

- 新 subject `dat_mgr`：资源链走**真 `Resources` + 空 `ZipMgr`**（都 miss ⇒ 落到宿主桩），
  `lfw` 只给 `resources` / `images.load_img` / `images.load_by_pic_info`（静默，加载任务不落地）/ `mt`
  （种子 12345）/ `emit_progress` 四个成员；`Ditto.Importer` / `Ditto.XML` / `warn` / `error` 全脚本化。
- ops：脚本化 `jfile <path> <value>` / `xtree <path> <tree>`（`o 3 tag s … attrs o … kids a …`
  递归建元素）/ `jfail` / `tfail` / `clearat <json|text> <path>`（该次 import 前先 `mgr.clear()`）/
  `clearimg <path|->` / `unhook`（清掉所有钩子）/ `spark`；动作 `load <paths…>` / `clear` /
  `dispose` / `innerid`；查询 `dump` / `find` / `botof` / `bgh` / `stg` / `stgz`（整个关卡对象
  的 render）/ `botst` / `findbot` / `findmoves` / `fwv` / `fwpred`（谓词重载）/ `fobjv` / `fentv` /
  `ffv` / `fbgv` / `objg` / `fg` / `wg` / `fng` / `bgg` / `randg` / `randgc`（同实例 + 一次 get）/
  `bgr` / `rbg` / `ctrls` / `mkctrl`。
- ⚠️ `import_*` 每次回**深克隆**（TS `JSON.parse(JSON.stringify(v))`，C++ 递归拷贝）：真导入每次
  解析新对象，而复用同一对象会在第二次 cook 撞上 TS 的 `data.xml = …`（`_add_object` 先挂了
  只读 getter）。
- ⚠️ `clearat` / `clearimg` 是**堆叠**的钩子：一段测完要 `unhook`（或 `clearimg -`），否则后续
  的 load 全在第一个内置图片就打回（本次调试踩过：取消用例后半段全被吃掉）。
- ⚠️ `xtree` 里 `attrs` 只放字符串；`xml_parse` 按**文本**查树 —— `xtree` 把文本设成 path 本身
  （`tfiles.set(p, p)`），所以 `xml:` 日志两侧都是路径。
- ⚠️ 台面闭了 RTTI（`/GR-`）⇒ `mkctrl` 的标签用 creator 身份（`c->creator() == …`），**不要
  `dynamic_cast`**（CFG 会直接崩，本次踩过）。
- ⚠️ `o N` 的 N 要数对：`o 2 id s … name s … bg s …` 里 `bg` 会被**静默当尾随 token 丢掉**
  （两测一致所以不红，但用例语义偏了——关卡那几行踩过）。
- ⚠️ C++ 侧假件 `Factory::set_warn` 要接进同一个日志（TS `Factory.register_ctrl` 重复注册会
  `Ditto.warn`，不接的话重加同 id 的用例两侧漂）。

### 6.9.132 helper 家族 + `Keys` + `JoinQueue`（`cases/helpers/*.txt` 4 份 214 行；变异 `helpers.mjs` 58/58 全杀）

- 新 subject `helpers`：实体是**真 `Entity`**（挂假 `IEntityHost`），`attach` 的观测点在宿主的
  `add_entities`（打 `attach|<id>|<team>` 并把实体推进 world 表；TS 假实体的 `attach()` 打同款
  日志）。`IHelperLfw` / `IKeysLfw` / `IUiHelperLfw` 三个缝全是脚本化假件；`mt` 种子 12345。
- ops：`mk <id> <type> <e|g>`（预置实体）/ `fdata` / `wdata <id> <g1|g2|->` / `dumpents` /
  `ob.all`·`ba.all`·`ch.all`·`we.all` / `ob.at <i>` / `ob.a` / `ob.b` /
  `ob.add <n> <team> <type> <id>` / `ch.add`·`ch.addr <n> <team> <f|->` / `we.add`·`we.rand`·
  `we.addr` / `ob.delall` / `cfail <n>`（接下来 n 次 `create_entity` 回空）/ `ob.tr`；
  `keys.{mount,unmount,time,get,list,hit,end,isstart,isend,use,reset,ts}`；
  `ui.{add,clear,all,push,set}`；`jq.{new,enq,deq,rm,has,size,all,clear}` / `pick`。
- ⚠️ **`EntityEnum` 是数值**（Fighter=8 / Weapon=16 / Ball=32）：台面/用例里的 `type` 字段必须
  用数值；第一版用了字符串 `"Ball"`，两侧的 `is_ball_data` 都恒 false ⇒ `ba.all`/`ch.all` 全是空
  列表，**五个 `all()` 家族变异集体存活**才发现（「两侧一起空」的假绿）。
- ⚠️ TS 台面的 `parseValue(t, i)` 要**下标元组**（内部 `idx[0]++`），裸 key 走
  `keyOf(next())`（裸 token）——裸 token 别过 `parseValue`（`a` 会被当数组字面量前缀）。
- ⚠️ 本台面 op 的数字实参既有裸 token（string）又有 `key_of` 出来的 u16 ⇒ C++ 侧加了
  `to_double` 的 u16 重载（`trace::to_double` 只吃 `std::string`）。
- ⚠️ 打印**数据对象**要取 `.id`（`field_or(v, u"id")`）：直接 `fmt_id(Value)` 会打 `u`
  （对象不是字符串）——`we.rand` 的 src 第一次就踩了。
- ⚠️ `wdata` 的多组切分 C++ 侧按 `|`（`csv_list` 是逗号切分，别复用）。
- `keys.*` 的 lifetime 读数由日志计数钉：TS `is_start()` / `end()` / `hit()`（缺省）都读
  `ctrl.time` ⇒ 缝的 `lifetime` 每次一条 `lifetime` 日志（`hit <k> <t>` 给了显式 t 则**不读**）。
- `keys.list` 用 TS 侧 `Object.keys(keys).filter(k => k.length === 1)` 钉字段顺序（键是枚举
  短名 `L/R/U/D/a/j/d`）；C++ 侧打 `Keys::list()`。

### 6.9.133 `LFW` 门面第一批（`cases/lfw/*.txt` 4 份 125 行；变异 `lfw.mjs` 11/11 全杀）

- 假 Ditto 包（`install_ditto`）要点：`Ditto.Timeout`/`Ditto.Render` 必须是**对象**
  （`add`/`del`；Render 另有 `raf`/`caf`）；`MD5`/`JSON5`/`Vector2/3`/`Importer`/`XML`/`DEV`
  给空壳即可；`warn/error/Log/debug` 统一 `'<tag>|' + args.map(render_value).join('~')`
  （C++ 侧同名 join 规则，首参前是 `|`，其余是 `~`——**两参以上**才看得出）。
- 时间/随机种子：`Date.now = () => 12345` 必须在 `new LFW(false)` **之前**打，C++ 侧同值走
  `ILfwHost::now()`（`_mt` 与 `_i18n` 都是构造时建）。
- 构造轨迹即用例 `basic` 的前段：`snd_init img_init kbd_init kbd_cbadd pt_init
  cache:forget×3 zip:forget wr_init pt_cbadd …`；`pt_cbadd` 在 `wr_init` **之后**、层 push
  与 i18n 之前——动构造顺序先改台面再改端口。
- 回调用统一的 `listen()`：22 个键同款渲染（`self` / `pl:<id>` / `n:<num>` / `b:<0|1>` /
  `s:<text>` / `u`）；`on_progress` 的第三实参**恒存在**（未给 size 渲染 `u`），所以
  `emit_progress` 与 `emit_progress_size` 的轨迹同形。
- 数值一律走 `num()`（`n<js>:<hex>`）；`mtrange` 直接读 `_mt.range`（TS 侧取
  `(lfw as Rec)["_mt"]`，字段是私有的），C++ 侧 `mt_ref()`——两边的抽取端口必须逐位同流。
- 实体缝：TS 侧 `Factory.entity_creators.set(8, …)` 的假实体要带 `data`
  （`ObjectsHelper.add` 会读 `entity.data.id` 找控制器）；C++ 侧注册真 creator
  （`new lfw::Entity`，`g_ent_host` 静默槽）——两侧都打 `entadd:create|<id>`。
- 用例值字面量语法：数字是 `n <v>`（如 `setlangbad n 5`）、键是裸词或 `"引号串"`；
  `mtrange`/`switchdiff` 这类**纯数字**参数直接写数字（写成 `n 1` 会被当键串吞掉，
  TS 侧 `Number("n")=NaN` 静默错）。

### 6.9.134 `LFW` 加载流程（`cases/lfw/load.txt` 144 行；变异 `lfw.mjs` 累计 25/25 全杀）

- kind 迷你语言（`imp <url> <kind>` / `lzadd <zid> <path> <kind>`，两侧同名同义）：
  `-`=undefined / `o`={} / `a`=[] / `k:<n>`={"<n>":"1"} / `str:<v>` / `md5:<v>`={"md5":v} /
  `w:<n>`={"":{"<n>":"1"}}（走 i18n 顶层语言键）/ `spk`=内置 spark 数据 / `e`=读失败（抛 "boom"）。
- `imp` 的键是 URL **去掉 `?` 之后**的部分（端口侧的 `no_cache_url` 会加 `?time=`）。
- TS 侧 Importer **每次现造值**：`cook` 会给数据对象挂 `xml*` 访问器，复用同一个对象再 cook
  一次会崩（"Cannot set property xml"）。
- TS 侧 warn/error/Log/debug 渲染前用 `safe_render` 剥掉 `xml`/`xml_roundtrip`/`xml_roundtrip_ok`
  与函数值字段 —— C++ 侧不建这些形，不剥两边 warn 文案对不上。
- `uis` 的 `add/clear/all` 与 `layers.set_page` 在 TS 侧是包装日志（`ui:add|n` / `ui:clear` /
  `ui:all` / `layers:set_page|<id>`）；C++ 侧是 `ILfwHost` 缝 + `FakeLayers.set_page` 里补一次
  `ui_all` 读（真 `UILayers.set_page` 会在 `uis.all` 里找页，台面照样记出来）。
- **首次 `load` 必须在任何 `loaddata`/`zips.add` 之前**（`is_first = zips.length === 0`）；
  用例第一段就是无 md5 的 `prel.zip` 首次加载。
- 数据包假 zip（`lznew/lzadd`）：`file(name)` 恒打 `lz:file`、`file(regex)` 打
  `lz:rgx|<zid>|<pattern>`（pattern 就是 TS 正则的 `source`，两侧逐字一致）；对象读值打
  `lz:json` / `lz:text`。`zips` op dump 名称与 md5；`bgms` op dump 音乐名。
- 首屏用的内置数据在 fake 侧全脚本化：`builtin_data/launch/strings.json`、`_index.json`（给 `a`
  表示 0 个内置页）、`data/spark.obj.json5`（给 `spk`）。内置页为 0 ⇒ 首次 load 会走
  `layers:set_page|undefined` 且 `ui:add|0`。
- 右侧（C++）`img:load|<path>` / `imp:json|<key>` / `layers:set_page` 等全是台面假宿主打的；
  改这些日志前先看一眼 TS 侧同名包装。

### 6.9.135 `LFW` URL 流程（`cases/lfw/url.txt` 103 行；变异 `lfw.mjs` 累计 40/40 全杀）

- `cachelog` 是开关：TS 构造期每个 `PlayerInfo` 都读一次 `Cache.get`，不关会污染所有用例；
  url 用例首行打开它（C++ 侧对应 op 是空操作，其 `zip_cache_*` 缝本就只在 URL 流程里被调）。
- URL 脚本 op：`stored <url> <md5> <token>`（`zip_url|md5` → blob 令牌）、
  `blob <token> <zid>` / `buf <token> <zid>`（令牌 → 假 zip，read_blob/read_buf 用）、
  `dl <url> <stored|blob|fail> <token> <md5|-`（下载 md5 令牌，`-` 即 undefined）`> <size>`、
  `cacheblob/cachedata <key> <name> <token>`、`cachelate <key> <name> <token>`、
  `impinfo <key> <zip-url|-> <md5|->`、`url <info_url>`。
- `stored`/`dl` 的键是**计算出来的 zip_url**（含 `?md5=`，无 md5 不含）；相对 info_url 或
  绝对 zip_url 时 `full_zip_url` 原样返回。`cachelate` 的 key 是 **md5**（Cache.get 键），
  不是 URL。
- `dl` 会先回调 `progress(50, size)` → 台面上的 `on_loading_file`（进度文本里能看到
  `1.1MB` / `2KB` 等，`short_size` 的变异就靠它）。
- 失败文案两侧一致：`unscripted import` / `unscripted blob` / `unscripted buf` / `dl-fail` /
  `[LFW::load_zip_from_url] info json url got: …`（都是字符串，TS 侧抛同名字符串）。

### 6.9.136 `ui_base`（UI 叶层：颜色 / 文本解析 / CrossInfo；`cases/ui_base/*.txt` 3 份 76 行；变异 15/15 全杀）

- op：`hex <str>` / `inti <n>` / `col <kind>` / `colget <kind>` / `callexpr <text>` /
  `funcargs <text> <name> [min]` / `cross <6 nums>` / `crossmix <6 nums>`。
- `kind` 迷你语言：`str:<v>` / `num:<v>` / `z`（null）/ `-`|`u`（undefined）。
  `colget u` 打 `undef`（Map 未命中）、`colget z` 打 `null`（`Map.get(null)` 的 null 结果
  与未命中同形，台面按 `undef`/`null` 区分的是**参数**而不是结果）。
- 值全部用 bench 的 `num()` 打印（`n<js>:<hex>`）；空 `name`/失败统一打 `null`。
- 带空格/括号的文本要整词加引号（`col "str:rgba( 4 , 5 , 6 , 0.25 )"`），
  两侧都先 `key_of` 去引号再拆 `str:`/`num:` 前缀。
- `crossmix` = 第二个对象里 `bottom` 是字符串、`mid_y` 是 null、`mid_x` 缺失（钉
  `CrossInfo.set` 的 number 过滤）；两侧都用「完整数字对象」作对比对象算 `cmp`。
- 颜色用例里有几条专门钉缓存/大小写：`col str:"#AbCdEf"` 后 `colget str:"#AbCdEf"`
  必须 miss（TS 缓存的是小写键），`col str:RGB(1,2,3)`/`Argb(...)` 钉大小写折叠。

### 6.9.137 `ui_style`（Style / isClass；`cases/ui_style/*.txt` 2 份 42 行；变异 10/10 全杀）

- op：`obj <oid>` / `oset <oid> <field> <kind>` / `sf <sid> <oid>` / `sget` / `sset` / `sver` /
  `stouch` / `sassign <sid> <oid>` / `sdata <sid> <oid>`（直接赋对象，别名）/
  `sdatastyle <sid> <sid2>`（浅拷贝）/ `snew <sid>` / `iscls <a|b|c|none> <...>`。
- `kind`：`num:` / `str:` / `bool:` / `u`（undefined）/ `z`（null）。
- 值渲染用 `sv()`：`undefined` ⇒ `u`、`null` ⇒ `z`、其余走 `render_value`（两侧同名）。
- 字段名必须用 IStyle 真字段（`padding_t`/`font`/`smoothing`/`scale`/`shadow_blur`…）——
  TS 侧 `sget/sset` 直接打在 `Style` 实例的属性上，不存在的键两边都读 `undefined`。
- 版本号用例钉三档语义：`sset num:6` 后 `sset str:6` **不涨**（宽松 `==`）；`sassign`
  同值不涨（严格）；`stouch`/`sdata`/`sdatastyle` 无条件涨。
- `iscls` 的链在台面里硬编码：TS 用真类 `ClassA ← ClassB ← ClassC`，C++ 用
  `ClazzTag{parent}` 三步链，`none` 两侧都是 `null`/`nullptr`。

### 6.9.138 `ui_value`（read_info_value；`cases/ui_value/value.txt` 35 行；变异 11/11 全杀）

- op：`uinew <id>` / `uparent <id> <pid>` / `val <id> <name> <kind>` / `tval ...`（写
  `values` / `template_values`）/ `find <id> <name>` / `puv <id> <type> <kind>` /
  `puierr <type> <uikind> <valkind>`（`ui` 直接给 kind，用来测三条 ui 校验）。
- kind：`num:` / `str:` / `bool:` / `arr` / `arr12`（`[1,2]`，钉报错文案的 `${ui}`）/
  `obj` / `u` / `z`；type：`null` / `bool` / `num` / `str` / `j01` / `jobj` / `jarr`。
- **带空格的 kind 要加引号**（如 `"str:  $val:a"`）：两侧台面对 kind token 都先
  `key_of`/`keyOf` 去引号。
- TS 的 parse 报错有两种形状：ui 三连校验是普通 `Error`，类型不符是 `{ui, error}` ⇒
  TS 台面 catch 里 `e.error ? e.error.message : e.message` 取文案（C++ 只有文本）。
- 渲染用 `sv()`：`u`/`z`/`render_value`（`bool` 打 `b1`、对象打 `{}`、数组打 `[]`）。

### 6.9.139 `ui_img_info`（validate_ui_img_info；`cases/ui_img_info/value.txt` 37 行；变异 9/9 全杀）

- 这张表来自 `Schema_IUIImgInfo`：生成器 `gen_defines_schemas.mjs` 的扫描根已扩到
  `src/LFW/ui`（只捞「导出 `Schema_`」的模块），`schemas_gen.h` 的表数 11。
- op：`tag`（打 TAG 常量）/ `v <vid> <值>`（带数组，逐条打 `ve`/`vw`）/ `vd <vid> <值>`
  （不传数组：C++ 传 null、TS 用默认参）——`vd` 专锁「null 指针 == 默认空数组」语义。
- 值字面量走 `parse_value`/`parseValue`（`o`/`a`/`s`/`n`/`b`/`u`/`z`）。
- 用例钉住的怪癖：`x`（`int + nagetive:false`）对 `1.5` 和 `-1` 同报
  `non-nagetive integer`；`nine_patch` 是裸 `{type:'object'}` ⇒ 空对象过、带键全告警；
  数组入参（`typeof [] === 'object'`）会走 object 分支；properties 按表顺序早退
  （`x n -1 w n 0` 只报 x）。

### 6.9.140 `xml_to_ui_info`（xml 台面 op `x2ui`；`cases/xml/ui.txt` 193 行（15 次 `x2ui`）；变异 16/16 全杀）

- op：`x2ui <eid>`（复用 xml 台面的 `new`/`attr`/`text`/`ins` 构造要素）→ 打
  `x2ui|<render_value(info)>` 一行。
- 用例覆盖：默认键存在性（`id` 直赋档 = 有键但 `u`）、属性直赋 / nums（`"1,,2"` → `[1,0,2]`、
  `""` → `[0]`、`"x"` → `[NaN]`）、布尔只认 `'true'`、递归 items（`ref` 短路）、values 的
  Object.assign 覆盖保位、actions（属性逗号分数组 + trim、子元素合并、无 name 走 text 的
  逗号分/trim、ACTION_PLACES 外不进）、components（cls 回落 tag、args 空串不建键、weight
  `Number`、properties 子元素）、style（数值转换就地覆盖、空 style 元素给 `undefined`）、
  img（空 path 回落 src、`dw=0` 回落 w、x 缺省 NaN）、template（id > name > `''`）。

### 6.9.141 `find_ui_template` / `merge_ui_template`（lfw 台面新 op；`cases/lfw/cook.txt` 35 行；变异 14/14 全杀）

- op：`uinew <id> <值>`（登 UI 对象）/ `uinest <子> <父>`（挂 `parent` 链）/ `uifind <id> <模板名>`
  / `uimerge <-|id> <原值>` / `devon`/`devoff`（翻 `lfw.dev`）/ `impsoft <key>`（TS 抛
  ImportError 形状、C++ 记 `impfail` —— find 都要吞掉才算「找不到」）。
- 用例钉住：父链真值命中 / null 命中继续走 / 候选次序（json5 先、显式扩展名排最前）/ `@/` 替换 /
  `{}` 不算命中 / 三次候选全失败 + warn + `{}` / merge 无 template 原样返回 / 展开键序
  （`id, component, values, template, template_values`）/ dev 两轮拼接 / values 浅并（余下赢）。
- TS 侧假 importer 配套：`import_as_text` 静默抛 ImportError 形状（C++ 侧 `import_as_text`
  同样不落日志）；`.ui.xml` 候选只测失败路。

### 6.9.142 `ui_load_img`（lfw 台面 op `uimg` / `imgset`；`cases/lfw/uimg.txt` 15 行；变异 9/9 全杀）

- op：`imgset <img_key> <值>`（脚本 `images.load_img` 的返回；未脚本 ⇒ 报 `unscripted image`）/
  `uimg <vid> <img 值>`（跑 `ui_load_img`，成功 `uimg|<vid>|ok|<返回>`、失败
  `uimg|<vid>|err|<esc(错误)>`）。
- 宿主的 `img:load|<key>|<path>|<ops>` 与 `img:pin|<key>` 日志就是被断言的对象：**key 的拼法**
  （flip 缺省补 `0`、其余 nullish 空串）由脚本化的 key 反查；`ops` 渲染直接钉 crop/flip 的
  条件与键序。
- 用例钉住：全缺省（key `?x=h:,,,,,,0,0`、ops `[]`）/ 全给（crop 在 flip 前、`{type:'crop',
  ...img}` 键序）/ 只 `flip_y`（op 里 `x:0` 默认）/ `dw=0` 被验证器拦（`positive integer`）/
  `flip_x:0` 在场不触发 flip / 空对象与 `null` 的校验错 / 未脚本化图的失败传播。

### 6.9.143 `cook_ui_info`（lfw 台面 op `ucook`；`cases/lfw/ucook.txt` 35 行；变异 19/19 全杀）

- op：`ucook <-|id> <值>`（parent 走 `uinew`/`uinest` 的脚本表）→ 成功
  `ucook|<渲染>`、失败 `ucook|err|<esc(消息)>`。
- 渲染用台面的 `render_cycle_safe`：cook 的 `items` 会挂 parent 成环，环上打 `~circ`
  （DAG 共用仍照常展开）；TS 侧 catch 取 `{ui, error}.error.message`（严格类型错）或
  `Error.message`（校验错）。
- 用例钉住：id/name 的 `''` 回落与 `no_id_N` 计数器 / component 三种来源（裸串、`<id>!f(a,b)`
  表达式、对象就地补 id/name）+ weight 稳定降序 / actions（数组、对象项、`null` 跳过）/ img
  字符串与对象两路（`dw ?? w`、校验、`ui_load_img` 的 key）/ size 三档（raw.size → img →
  屏幕）与 `!h && w` 的 floor 换算 / items 递归（parent 环）与空 items 删键 / 严格类型错的
  消息文本。

### 6.9.144 事件层 + `UIImgLoader`（lfw 台面新 op；`cases/lfw/event.txt` 15 行 / `imloader.txt` 31 行；变异 15/15 全杀）

- 事件 op：`newp <id> <x> <y> <z> <btn>` / `newk <id> <player> <0|1> <gk> <key>` /
  `stp`/`sti <id>`（两个事件表合并查找）/ `rdp`/`rdk <id>`（打全部字段 + `stopped`）。
- 图片 op：`imnode <lid> <nid|->`（自动建节点；`-` ⇒ getter 回 null）/ `imjid <lid>`（观测
  `_jid` 的 value/min/max）/ `imignore <lid>` / `imload <lid> <img 值>` / `imset <lid> <path>`。
  成功打 `imload|ok|<图>`，失败打 `imload|err|<esc>`（out-of-date 追加 `|ood|`，端口同步测不到）。
- 用例钉住：stopped 三态与两种 stop 的差异 / 事件字段搬运（pressed 布尔、game_key 与 key 的
  区分）/ `ignore_out_of_date` 后 jid 全 0 / `add` 推进 jid / `w/scale` 的 resize 参数 /
  缺 w/h/scale 的 NaN / 节点缺失与宿主失败的两种错误文本。

### 6.9.145 `UINode` 第一段（lfw 台面新 op；`cases/lfw/uinode.txt` 125 行；变异 44/44 全杀）

- 建树 op：`nod <nid> [parent] <data>` / `noc <nid> <parent> <data>`（data = 完整 cooked 形对象
  字面量，pos/size/center/scale 都是数组）/ `nadd <pid> <cid>` / `nfn <nid> <-|目标>`（直接调
  `set_focused_node` 观测量）/ `ncb <nid> <ev>`（九事件挂回调；日志带节点引用）。
- 读 op：`nrd <nid> <what>`：[pos|scale|size|center]×分轴 / cross / rect / geo / gp / flags
  （4 位：可见|自身可见|禁用|自身禁用）/ op（opacity|global_opacity）/ bg / fg（都被打印成
  `字符串|alpha`）/ outline（三值）/ id（`id|name|depth`）/ depth / lifetime（自身 update 次数）/
  ptr（over|down|click）/ foc（focused|focused_node 引用）/ state / value <name> / hit x y /
  clip / fc <id> / fcn <name> / sn <id> / ln <id> / fp <id>。
- 写 op：`nset <nid> <what> …`：x/y/z/w/h/cx/cy/cz/sx/sy/sz/visible/disabled/opacity/clip/
  focused/background(-)/foreground(-)/backgroundAlpha/foregroundAlpha/outlineColor|Width|Alpha/
  move3 x y z / resize3 x y z / center3 x y z / scale3 x y z / global_pos x y z / update dt。
- 指针 op：`npd|npm|npu|npc <nid>`（打 `np|<nid>|<op>|stop=<0|1|2>`）、`npl|npe <nid>`。
- 用例钉住：构造默认与数据三旗 / 几何 setter 的 round_float 边界与缓存失效（
  `set_scale` **不清**）/ `global_pos` 陈旧（父 move3 不影响子缓存，自己 update 才清，
  `update` 无变化不清）/ `hit` 的原始 data.size / 树查询与宽松数字 id / 可见性递归与
  `invoke_all_on_hide` 跳过自身不可见子节点 / 焦点链（禁用拒收、`set_disabled` 清焦点、
  auto_focus）/ 指针五态 / `update` 跳过禁用子节点。

### 6.9.146 `UINode` 第二段：文本/图像/i18n（`cases/lfw/uinode_txt.txt` 61 行；变异 24/24 全杀）

- 写 op：`nset <nid> text <s>`（样式缺省 = 节点 Style）/ `text2 <s> <样式值>`（`z`/`u` 也走节点 Style）/ 
  `texti <值>`（直挂 `set text`）/ `image <值>`（`z`=null、`u`=undefined）/ `style_assign <值>` / `style_touch`。
- 读 op：`nrd <nid> text` → `text|null|<文本>|w|h|scale|sv|sj`（`sv` = `v<版本>` 或 `-`；`sj` = 样式 JSON 或 `-`，
  JSON 走 esc）；`nrd image`（原值渲染，null=`z`）；`nrd color`。
- 假宿主 `measure_text` 返回 `{text, w: 文本长*4, h: 10, scale: 1}`，并打 `measure|<文本>|<样式>`
  （TS 侧 Style 实例先归一成 `.data`，所以两侧日志同形）。
- 用例钉住：i18n 命中复用（无 measure）/ 不命中重测（三种样式回落）/ 无 i18n 直挂；
  auto-size 的四道拦截（`w&&h` 直用、缺 w/h 测、`raw.size` 拦、无父不调）；`set_text` 的版本分支
  （重复跳过 / `style_touch` 版本变 / `assign` 数据变）、JSON 分支、`texti` 同键跳过与样式变化重调、
  零宽走测、scale 除法与 0 回落 1；`image` 的 `z`/`u`、`color` 默认空串。

### 6.9.147 UI 骨架：页面栈 + 生命周期 + 输入 + 动作（`cases/lfw/uinode_life.txt` 59 行 + `uilayer.txt` 70 行；变异 38/38 全杀）

- 节点 op：`nmk <nid> <parent|-> <data>`（`UINode::create`：items 计数递归）、`nml <nid> <层号|-> <data>`
  （挂在真层上的"非栈顶"节点）、`nlife <nid> start|stop|resume|pause`、`nclick <nid> <btn>`
  （打 `click|<nid>|stop=`）、`nkey <nid> down|up <gk> <key> [1=预 stop]`（打 `nkey|…|stop=`）、
  `nact <nid> <值>`（`actor.act` 直发）、`nrd <nid> kids`（子节点数量 + 引用）。
- 层 op：`uipg <id> <数据>`（给 `uis` 补页，供真 `UILayers` 查找）、`rlnew`、`rlpush`、
  `rlset|rlpushp <idx> <id>`、`rlpop <idx> <min_pages> <incl> <until|->`、`rlinfo`（层数 + 每层
  `idx:pages:topid`，洞打 `-`）、`rlui/rlz <idx>`、`rlfind <idx> <nid>`（id/depth）、`rlfocus`、
  `rlfn <idx>`（focused_node 引用）、`rltree <idx>`（`id(子数)[…]`）、`rlact <idx> <nid|-> <值>`、
  `rldisp`；`unpatch`（TS 侧复原 `uis.add/clear/all` 与 `layers.set_page` 补丁；C++ 空操作）。
- 用例钉住：生命周期 actions 顺序（子先于父 start）/ lifetime 复位 / 焦点的 pause-存 resume-还原 /
  show-hide 转发 / 鼠标三键与 stop_propagation / 键盘：预 stop 早退、子节点先、焦点才派发、
  a/j 键位映射 / actor：广播、数组、假值、参数缺省、NaN→undefined、未知 handler warn、
  set_page 经假缝 / create 计数（非法 count 落 1、嵌套）/ `pop_page` 非栈顶不弹 /
  层栈：同 id 早退、z 叠层号、min_pages、until、inclusive（只有首个 on_pause）、弹空层、dispose。

### 6.9.148 UI 缝换真实现：接线第一段（`uinode_life.txt` 63 行；变异档升至 40/40）

- 宿主缝删除：`create_layers` 与 `ui_cook_path`/`ui_cook_value`/`ui_xml_to_info`/`ui_add`/
  `ui_clear`/`ui_all` 全部移除；LFW 直建真 `UILayers`（含栈回调→`ui_changed`）、
  `load_ui`/`load_builtin_ui`/首屏查找走真 `cook_ui_info`/`xml_to_ui_info`/`ui_helper`。
- 台面同步：删 `FakeLayers` 与缝假实现；TS 侧移除 `uis.add/clear/all` 与 `layers.set_page` 补丁
  （`ui:add`/`ui:all`/`layers:set_page` 日志两侧同时消失，`load` 用例行数 144 → 137）；
  `unpatch` 变占位；`listen` 对 `on_ui_changed` 记 `?`/`u`（不再 render 节点）；
  新增 `flset <id>` / `flpush <id>`（驱动 `lfw.layers` 第 0 层，打声效与 `on_ui_changed` 行）。
- 用例新增：`uipg pgX` + 第 2 层 set_page（建页）/同 id 早退/push_page/再早退；
  `flset/flset/flpush/flset` 覆盖第 0 层（接线层）的建页、早退与 on_push。

### 6.9.149 schema 类类型与惰性实例 + make_schema（`cases/schema/inst.txt` 58 行；变异 29/29 全杀）

- 校验器 op：`nvg <vid>`（getter+setter 钩子；日志 `ig|<vid>|<raw 渲染>|<类名>|<路径 esc>` /
  `is|<vid>|<值渲染>|<raw 渲染>|<类名>|<路径 esc>`，路径经 esc 所以带引号）、`nvgo <vid>`（只 getter）、
  `nvso <vid>`（只 setter）；getter 先查 `gres <键> <值>` 表（键两侧都去引号：C++ `key_of`、TS `keyOf`），
  落空按 `nullable != false` 回 `null`（渲染 `z`）或报错。
- 值 op：`vset <vvid> <值>` 存值；`valv <vid> <vvid> <sid>`（拿存档值跑 `validate`，打印同 `val`，
  **不含** `vv` 行—— TS 侧渲染存档会触发访问器）；`gn <vid> <vvid> <键>` 打印
  `gn|<vid>|<vvid>|<键>|ok|…` 或 `…|err|<esc(消息)>`（TS 读取即触发访问器；C++ 按 target+key 找
  `DefinedInstance` 后 `get_instance`，找不到就普通读）；`sn` 同理（写触发 setter）。
- schema op：`mks <sid> <meta>`（`make_schema`；字面里的 `$cls:X` 在 TS 侧还原成假类 `FakeNode`/`FakeComp`，
  根无 key 的 TS 异常被台面吞成 undefined）、`psch <sid>` 打印
  `psch|<sid>|k=…;t=…;p=…[;n=…][;props=[名称={…};…]][;items={…}]`（`t` 为类时打 `s"$cls:<名>"`）。
- 用例钉住：对象属性命中/未命中/nullable 默认/`nullable:false` 报错、钩子缺边的两条文案、
  数组项按下标记录（不删元素）与越界键回落普通读、`default:` 类类型分支的字符串限制、
  delete 后重定义（`nullable` 与未命中报错）、嵌套对象里的类属性（内层键被删）、
  无惰性属性时 `gn/sn` 普通读写；make_schema 的类简写（含裸 `$cls:` 标记）、
  对象 items 展开（items 自己的 key 盖 meta key）、原始属性跳过、根无 key、path 拼接。

### 6.9.150 UIProps + UIComponent 基类 + UINode 组件循环（`cases/lfw/uicomp.txt` 119 行；变异 18/18 全杀）

- 台面假组件 `FakeComponent`/`bench::FakeComp`（`TAGS=["FakeComp"]`，PROPS：n/s 必填，pick/ok/arr/strs/b0/
  stop_click/stop_key/del_at 可空，sub/other 是类类型）注册进 `Factory.components`；全程打
  `fc|<f_name>|<evt>|…`（`init/add/del/start|lrud/stop/resume|lrud/pause/show/hide/foucs/blur/click/kdown/kup/
  pdown·pmove·pup·pcancel·pleave·penter/update/|delreq`），`props` dump 一行（校验失败打 `err|<errors用|拼>`）。
- 组件 op：`cadd <nid> <cid> <props>`（直造实例 + `add_components`）、`cdel <nid> <cid>`、`lcomp <nid>`
  （数量 + 每行 `fc|list|<i>|<TAG>|<f_name>|<id>|<name>|<b1|b0>`）、`cupd <nid> <dt>`（`node.update`）、
  `cset <nid> <cid> <0|1>`（`set_enabled`）、`cfind <nid> <cid> <which>`（`find_node` 迷你语言）；
  `ncb` 新增 `comp_add`/`comp_del`（打 `cb|<nid>|comp_add|<f_name>#<id>|<节点>`）。
- 用例钉住：create 装配次序（init→子先 add→父 add）、props 全字段 dump（含惰性 `sub=node:<id>` /
  `other=comp:…`）、`$val:` 命中/落空、校验失败 err、生命周期与显隐/焦点转发次序（组件 vs 子节点）、
  key down/up 两侧次序与 `stop_key` 短路、指针转发、`update` 与 `del_at` 延迟删除、`enabled` 跳过 update、
  add/del 回调、find_node 迷你语言（parent/parent:N/self/id:/name:/bro:*）；`recycle_keys` 的
  `keys already registered` warn 钉住 `array_del` 怪癖。

### 6.9.151 UINode renderer 缝（`cases/lfw/uicomp.txt` 149 行；变异 23/23 全杀）

- 台面 `UINodeRenderer` 假实现（宿主 `create_ui_node_renderer` 每节点给一个）全方法打
  `rend|del_self|on_start|on_stop|on_resume|on_pause|on_show|on_hide|on_foucs|on_blur|<节点>`；
  TS 侧靠 `Ditto.setup({ UINodeRenderer })` 注入，C++ 侧是 `FakeHost::create_ui_node_renderer`。
- 用例新增：`nset t1 focused 1/0`（驱 `rend|on_foucs/on_blur` 与组件的 `foucs/blur`）、非根节点 `t2` 的
  pause/resume（钉 `del_self` 只给根节点）；其余用例行数同步增长（`uilayer` 199、`uinode` 165、
  `uinode_life` 111）——两边同源，不需改用例。
- ⚠ 台面坑：`items` 里建的子节点**不在** `g_nodes`（只有 `nmk`/`nml` 登记的才能被 `nlife`/`cadd` 等引用），
  直接 `nlife tk …` 会 `map::at` 失败 ‐– 要测子节点就用 `nmk <新 id> <父 id>` 另建一个。

### 6.9.152 组件族第一批（`cases/lfw/components.txt` 97 行；变异 16/16 全杀）

- 新主题用例 `components.txt`：覆盖 `FocusBehavior`（id/name/空 三种 behavior 串，钉 `trim + toLowerCase` 与
  `default` 兜底）、`HoverBehavior`（`focus` 与非 `focus`）、`OpacityHover`（父观察步骤、自观察显式参、
  缺省参首帧悬停、起始即悬停）、`SineOpacity`（缺省 + 显式五参）、`FadeInOpacity`（带透明度数据 + 无参）；
  `nrd opacity` 读节点透明度观测量。
- 组件注册两边同源：C++ 是 `ui::regist_components()` 在 `LFW` 构造器里调（幂等），
  TS 是 `LFW.ts` 构造器调 `regist_components()` —— 不再有宿主缝。
- ⚠ 变异坑：`OpacityHover` 的 `set_reverse(false)` 初值会被 `auto_trip` 首拍归一化，改它是**等效变异**
  （必然存活）；改 `_p = num(3)` 为 `_p = std::nullopt` 能从父观察步骤杀掉。
- ⚠ TS 成员初始化器（`new Easing(0,1).set_duration(150)`）在 C++ 要显式构造器落参；漏了只在
  「缺省 duration + 悬停首帧」才能暴露（drift `n0 vs n0.4999…`）。

### 6.9.153 动画族组件（`cases/lfw/anim.txt` 138 行；变异 22/22 全杀）

- 新台面 op：`wpause <0|1|2>`（`world.set_paused` + 读回 `paused`，PauseHandling 用）与
  `cplay <nid> <cls> <start|stop|replay> <0|1>`（按类标签找组件驱动 IPlayable + 打印 `ok/none` 与 `enabled`）。
- ⚠ **`vec3(i)`/`nums` 的参数是「一个数组参数」**（`a 3 n x n y n z` 或 `"x,y,z"` 串），不是三个连续参数：
  Scale/Position 的 args 形如 `[play, reverse, [x,y,z], duration, [x,y,z], duration, …]`。
- Scale/Position 首段恒为 Delay（`i == 0` 时 prev 自比），且 `done` 时只 `set_enabled(false)` 不再写节点。
- TS 假 `Vector3` 需补 `equals`/`clone`/`sub`（Scale/Position 会调；之前假实现只有 `set`）。
- FadeOutOpacity 的缓动是**默认** ease_in_out_sine（没显式 `set_easing`）；OpacityAnimation 段间才用 `ease_linearity`。

### 6.9.154 布局族组件（`cases/lfw/layout.txt` 40 行；变异 16/16 全杀）

- 新台面 op `calign <nid>`：找节点上的 `FlexItem`，跑一遍 props 校验并打 `calign|<nid>|<align|null>|<错误数>`
  （TS 侧校验失败走 catch 打 `err`；两边都带错误数）。
- ⚠ 无 `component` 键的节点数据是 `o 5`（id/pos/size/center/scale），有组件才是 `o 6` ——
  対数字数错了会报 `value literal truncated in object`。
- VerticalLayout/HorizontalLayout 会跳过不可见子节点（用例里都放了隐藏子 + `nset <id> visible 0` 钉住）；
  VerticalLayout 的 `pos_list` 是 unshift+pop 配对，打乱顺序能直接观察到 y 错位。
- 用例里 vl1 的 `center` 取 `0.5,0.25`（非零 cy），否则 `yy` 里的 center 项观察不到。

### 6.9.155 Picture / ImgLoop / SmoothNumber（`cases/lfw/{img,smooth}.txt` 113/44 行；变异 15/15 全杀）

- 新台面 op `pic <nid> <rd|src|setw|seth|setimg|istart|istop> [arg]`（Picture/ImgLoop 驱动；`setimg` 用
  **真 ImageInfo** 建模，C++ 侧按同字段序拼同一对象）与 `snew/srd/svalue/starget/smode/sspeed/sfactor/smdiff/supd/shandle`
  （SmoothNumber 脚本；`snew` 里挂的 handler 每次调用打 `scb|<id>|<value>|<done>`）。
- ⚠ `image.clone()` 会带上 ImageInfo 的 **全部声明字段**（含 12 个 `u` 可选项）——台面拼对象时字段与顺序都要对齐，
  否则 `nrd image` 的 json 直接漂移。
- ⚠ ImgLoop 的 idx 永远是 `floor(value) < count`（循环在 `time>=duration` 处回卷），**越界分支只能靠
  `col*row < count` 造**（用例：col2×row1 网格 + count10 ⇒ idx≥2 隐藏）。
- ⚠ stop/start 的 `times` 差异要 **回卷之后再多跑几步** 才看得到（done 只在回卷帧置位，下一帧才停）。
- 台面自重构：组件/工具驱动 op 已抽到单函数 `run_comp_ops`（主 else-if 链块嵌套超 MSVC 上限）。
