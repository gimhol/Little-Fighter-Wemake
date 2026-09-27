# [v0.1.58](https://lf.gim.ink/0.1.58)

by [**Gim**](https://gim.ink)

<!-- git-range: ec11c1a35..56177bf66 -->

### What's New

- Multiplayer server admin page: open `http://<server host>:<port>/admin` in a browser (the desktop client's tray has an "Open admin page" item)
  - Overview: online clients / players in game / admins / rooms / uptime / memory
  - Room list with details (close a room), client list (kick), player token list (copy / revoke), rank lookup, and the list of registered API routes
  - Auto-refresh every 5 seconds by default (adjustable); admin endpoints need an admin token — the desktop client generates one on first launch and stores it in `admin.json` in the data folder; `?token=<token>` works too

### Tweaks

- Fixed: toggling "Start multiplayer server" in the desktop client's tray made the server exit immediately (the bundled server was missing build-time constants such as `__GIT_COMMIT__`)
- Fixed: the desktop packaging now injects the server's build info, so the version and commit show up in the logs
