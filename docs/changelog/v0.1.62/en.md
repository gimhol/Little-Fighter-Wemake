# [v0.1.62](https://lf.gim.ink/0.1.62)

by [**Gim**](https://gim.ink)

<!-- git-range: 60849a6bb..4053434ed -->

### Tweaks

- Bots: keep Z spacing only on Difficult and above; defend desire lowered again (they block less)

### Fixes

- Armor break never triggered in normal matches: the survival-rank-active check used the availability flag
- Survival rank difficulty is now fixed to Difficult instead of reusing the last picked one
- Background layer depth fighting: black edges showed up between adjacent layers
- Switching frames on the same character briefly made it vanish: images are now preloaded on spawn
