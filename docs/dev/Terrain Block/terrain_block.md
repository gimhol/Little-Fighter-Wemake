# 实体与地形“碰撞”

## 实体与斜坡

![terrain_slope_and_block](./terrain_slope_and_block.jpg)

实体进入 (x,y,z) 位置时，与斜坡产生“碰撞”，此时会产生“挤出点数组”，如图为[(block_x, z), (x, block_z)]，该“挤出点”与碰撞点越接近，其在“挤出点数组”顺序则越靠前。

## 武器丢出的问题（未解决）

![weapon_problem](./weapon_problem.png)

如图，当武器丢出, 发射点（发射点时武器持有者的wpoint决定的）在"terrain 1"内时，
目前的逻辑中，会尝试将武器挤出到"push point"，又被"terrain 2"挡住，
随后会尝试其他挤出点，导致错误的挤出。