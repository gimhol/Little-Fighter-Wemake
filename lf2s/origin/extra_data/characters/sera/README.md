# Sera（灵刃·赛拉）

均衡型剑舞者。攻击距离更长，攻守兼备。

## 数据

- 角色数据：`sera.obj.json5`
- 精灵图：`sprite/0.png`、`sprite/1.png`（79x79 格，10 列 x 7 行，80px 步距）
- 头像：`sprite/face.png`（120x120）、`sprite/s.png`（40x45）
- 弹丸数据：`sera_wave.obj.json5`，贴图 `sprite/sera_wave.png`

## 数值

| 项目 | 值 |
| --- | --- |
| HP | 540 |
| MP | 560 |
| 行走速度 | 4.2 |
| 奔跑速度 | 8.4 |
| 强度(ce) | 1 |

## 招式

| 招式 | 输入 | 消耗 | 说明 |
| --- | --- | --- | --- |
| 双月斩（Double Moon Slash） | D + v + A | 40 MP | 近身判定 |
| 升龙斩（Rising Slash） | D + ^ + A | 35 MP | 近身判定 |
| 灵刃波（Spirit Wave） | D + > + A | 40 MP | 发射弹丸 |

输入里的 **D** 是防御键，方向按角色朝向理解（`>` 为前方）。数据里对应的按键序列：`Da / Ua / Fa`。

## 来源

精灵图与数据均由 `scripts/gen-fighters.mjs` 程序化生成，不使用任何第三方素材。
修改外观/数值请改脚本后重新运行：

```bash
node scripts/gen-fighters.mjs sera
npm run build:data
```
