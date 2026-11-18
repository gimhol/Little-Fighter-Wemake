# 联机服务器（生产部署说明）

> 这里是 lfj.gim.ink 那台服务器的部署/运维笔记；只想知道怎么跑服务器，请看 [多人联机游戏文档](../docs/Multiplayer%20Online%20Game/README.MD)。

## 目录结构

```
/root/backends/
├── lfj -> lfj_backup/<时间戳>/     # 当前使用的 release（软链，每次部署整目录替换）
├── lfj_backup/<时间戳>/            # 历史 release（只放程序，不放数据）
├── lfj_config/                     # 稳定配置，不进 release
│   ├── .env                        # 端口、管理员密码、数据路径（权限 600）
│   └── server.config.json.bak      # 旧版完整配置备份（已弃用）
├── lfj_ranks/                      # 排行榜数据（每个类型一个 <type>.json）
└── lfj_data/                       # 审计日志 / 封禁名单 / 玩家建议
```

**数据与配置一律不放在 release 目录**：部署会换掉整个目录。

## 部署

```bash
cd server
npm run flow     # = npm run build && fdeploy（rollup 构建 + 上传）
```

- `npm run build` 里的 `scripts/copy-env.mjs` 会把 `.env`、`server.config.json5` 拷进 `dist/cjs`
- 部署器开了 `SYMLINK_MODE`：先上传到新的 `lfj_backup/<时间戳>/`，再把 `lfj` 软链指过去
- 随后执行 `deployer.config.json5` 的 `SSH_POST_CMD`：

  ```
  install -m 600 /root/backends/lfj_config/.env /root/backends/lfj/.env && pm2 restart lfj
  ```

  机器相关的配置**只认** `lfj_config/.env`；这一步失败就不会重启（旧进程继续用正确配置跑）。

## 配置分层

| 层 | 位置 | 内容 |
| - | - | - |
| 通用配置（进 git） | `server/server.config.json5` | `rest` 设置、`ranks.allowed_types`、`ranks.max_per_type` |
| 机器相关 + 密钥 | `/root/backends/lfj_config/.env` | `HTTP_PORT`、`ADMIN_PWD`、`RANKS_DIR`、`RANKS_AUDIT_PATH`、`RANKS_BANS_PATH`、`SUGGESTIONS_FILE_PATH` |

优先级：命令行参数 > 环境变量 > 配置文件 > 默认值。

## 常见操作

- **改管理员密码 / 端口 / 数据路径**：编辑 `/root/backends/lfj_config/.env` → `pm2 restart lfj`（下次部署也会自动带上）
- **重置周榜**：停服后替换或删除 `/root/backends/lfj_ranks/survival_week.json`，再 `pm2 restart lfj`
- **看榜单条数**：`curl 'https://lfj.gim.ink/api/ranks/survival_all?limit=1'`
- **备份**：打包 `lfj_ranks/` 与 `lfj_data/` 即可；`lfj_backup/` 只是程序历史

## 注意

- 2026-11-17 曾出现“所有排行显示 0 条”：那次部署的 release 缺配置文件，服务端回退到空的 `<release>/ranks.json`，数据其实一直在 `lfj_ranks/`。现在路径由稳定的 `.env` 提供，避免重演。
- 配置里不要再写 `ranks.db`：本机 Node 低于 22.5 时 `node:sqlite` 不可用，会静默回退到文件存储，切到 SQLite 就等于换成一个空库。
