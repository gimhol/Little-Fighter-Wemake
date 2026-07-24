# 角色“变体”

## 原版中的角色“变体”

LF2中，以某种隐晦的方式来支持角色在不同队伍中的颜色。

闯关模式下，人质`frame.state == 80XX`时，变为 ID 为 XX 的角色。

当角色数据中图片如下，已 Bandit 为例, 即可使用Bandit的蓝色版本

``` plaintext
file(0-69): sprite\sys\bandit_0.bmp  w: 79  h: 79  row: 10  col: 7
file(70-139): sprite\sys\bandit_1.bmp  w: 79  h: 79  row: 10  col: 7
file(140-209): sprite\sys\bandit_0b.bmp  w: 79  h: 79  row: 10  col: 7
file(210-279): sprite\sys\bandit_1b.bmp  w: 79  h: 79  row: 10  col: 7
```

对应关系:

| 原图 | 原图描述 | 变体图 | 变体描述 |
| --- | --- | --- | --- |
| file(0-69) | 红色 Bandit 图1 | file(140-209) | 蓝色 Bandit 图1 |
| file(140-209) | 红色 Bandit 图2 | file(210-279) | 蓝色 Bandit 图2 |

不符合规则的角色的图片显示会不正确...

## LFW中的角色“变体”

角色数据示例, 还是 Bandit:

``` json
{
  "base": {
    "name": "Bandit",
    "files": {
      "0": {
        "id": "0", "path": "sprite/sys/bandit_0.png",
        "variants": [ "2" ], // <<<< files[0] 的队伍1变体图为 files[2]
      },
      "1": {
        "id": "1", "path": "sprite/sys/bandit_1.png",
        "variants": ["3"], // <<<< files[1] 的队伍1变体图为 files[3]
      },
      "2": {
        "id": "2", "path": "sprite/sys/bandit_0b.png"
      },
      "3": {
        "id": "3", "path": "sprite/sys/bandit_1b.png"
      }
    },
}
```

通过variants，可以指定不同队伍下角色的变体图片。

因为有`files[0].variants = ["2"]`, 队伍1的 Bandit，
在尝试显示 `files[0]` 的图片时，会自动显示为`files[2]`的图片。

同理，你可以以此为每个队伍都添加变体图片。
只需要这样写：`files[0].variants = ["2", "4", "6", ...]`
(当然,`files`中必须存在`files[4]`,`files[6]`)
