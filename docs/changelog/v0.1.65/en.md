# [v0.1.65](https://lf.gim.ink/0.1.65)

by [**Gim**](https://gim.ink)

<!-- git-range: b51be4294..HEAD -->

"Netplay UI moves into the game"

### What's New

- The netplay UI now lives in the game's own UI layer instead of stacking a DOM layer on top:
  - Connect page: server address, nickname and account login; press Enter to connect
  - Room list: auto / manual refresh, paging, player counts and password badges; type the password inline to join a locked room
  - Room page: ready / start, kick, change password, sync mode, start countdown
  - In-match overlay: a "Game Paused" panel when the match pauses or someone drops, with "Continue", "Continue Solo" and "Back to Lobby"
- Netplay chat overlay:
  - `T` opens the input, `Esc` puts it away; once the input is gone the message list lingers for 10 seconds like an incoming message before it fades out
  - Incoming messages pop the overlay up, and it fades out 10 seconds later
  - Room / global channel tags; entering a room switches the channel automatically
  - While only the message list is shown, keyboard and pointer input pass through to the game underneath

### Tweaks

- F5 turbo is now 10x (the old 1000x was close to instant)
- New console command `DATASET`: inspect a dataset key layer by layer (frame → entity data → background → world) and see the value actually in effect
- New console commands `POINTER_DOWN` / `POINTER_MOVE` / `POINTER_UP` / `POINTER_CLICK` / `POINTER_CANCEL`: replay pointer events from a hit list
- Demo matches restart automatically 5 seconds after they end
- Every live page in a layer is now updated (previously only the top one), so a stacked chat overlay no longer freezes its own timers and fade

### Fixes

- Fixed the page underneath not receiving keyboard / pointer input while the chat overlay was open
