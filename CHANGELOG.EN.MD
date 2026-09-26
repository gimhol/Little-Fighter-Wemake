# Changelog

## [v0.1.56](https://lf.gim.ink/0.1.56)

by [**Gim**](https://gim.ink)

<!-- git-range: d94a6368..2087ecaf9 -->

### What's New

- Move List (main menu entry): live move demos for every fighter
  - Each move plays automatically with real inputs and loops; the move name, inputs, description and MP cost are shown
  - Demos deal real damage / healing, and the pressed keys are displayed overhead
  - The list scrolls with the wheel or by dragging; hover or click a row to switch to that move, and the list auto-scrolls to the current one
  - New Template tutorial demos: walk, defend (guard break), dodge (landing roll), punch combo, run attack, jump attack, catch & throw, breakfall, etc.
  - Hidden fighters (Mark / Jack / Sorcerer / Monk / Jan / Knight / Bat / Justin / LouisEX / Firzen / Julian) appear after enabling the cheat
- New background "Octagon": a cage-fighting arena (chain-link cage, ceiling lights, crowd, logo fight mat)
- New background "Football Field": a full-size stadium pitch
  - Textured grass with mowing stripes; complete soccer markings: halfway line, center circle, penalty & goal areas, penalty spots, penalty arc, corner arcs, goal nets
  - Stands, crowd, ad boards and sky around the pitch
  - Both Octagon and Football Field join the normal random background rotation
- Desktop: automatic mod loading — data packs in the `mods/` folder (next to the program, and in the user data folder) are loaded at startup (later ones override earlier ones); `mods.json5` adjusts the order or disables packs, `--mods <dir>` adds one on the fly, `--no-mods` turns loading off

### Tweaks

- Data conversion: grid separator lines are now removed from source images with a mask (some sprites could keep a trace of them)
- Desktop: the installer now defaults to the product-name folder ("Little Fighter Wemake")
- Desktop: pushing a version tag now builds and publishes the installer / portable build via GitHub Actions
- Fixed: with background zoom other than 1 (Football Field 0.5, Octagon 2), the auto camera and character follow were offset horizontally / vertically (fighters could drift off-screen)
- Maps from the extra data pack now come after the built-in maps (background list and rotation order)
- Dev panel: the previewer was rebuilt with three tabs (background / entity / image); the canvas can be dragged to pan and scrolled to zoom
- Survival rank: the solo board is now grouped by fighter, the 2P board by the pair of fighters, each keeping its own best score
- Update checks now read `latest.json`, which carries the commit hash and avoids a cache making it report a stale version

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW

## [v0.1.55](https://lf.gim.ink/0.1.55)

by [**Gim**](https://gim.ink)

<!-- git-range: 61e6ae33..9bfa1ac3 -->

### What's New

- Bilibili danmu game: viewers join the fight from chat
  - Three modes: Free-for-All, 8-Team Melee and Co-op Challenge
  - Enter the room or send a message to join (Co-op claims an unclaimed Template slot first; the other modes join directly while there is room), then send a fighter nickname (e.g. 「拳王」 for Davis, 「奶妈」 for John) to switch to that fighter
  - Co-op scales enemy counts with the fighters on stage; queue cap 50, stage cap 32, and 5 minutes without any interaction removes you from the queue
  - Cheer keywords (default: 加油 / 666 / 应援) heal your fighter for 15% (3s cooldown); gifts, guards and super chats count as cheers too
  - The in-game panel rotates hints, and the "switch fighter" hint shows 3 random fighter nicknames
  - Scoreboard: spawns, kills, deaths, damage and cheers accumulate per viewer with configurable weights and persist across sessions; the built-in board page works as an OBS browser source (auto refresh every 10s)
- LFW desktop client (Bilibili interactive playable)
  - Frameless window; tray menu to toggle the co-op server, allow LAN access to the game page, copy the LAN address, open the data tool, copy the data tool command, open the data folder, show the game window and quit
  - Bundled co-op server, data tool and converters (ffmpeg and ImageMagick included) — no Node install required; drop an LF2 folder (or a conf file) onto start.exe to start converting
  - The co-op server picks the next free port when the default one is taken
  - Standalone installer with auto-update: checked at startup, downloaded in the background, applied on restart
  - Menu and hint texts are multilingual (follows the in-game language, fully customizable); config lives in danmu.json5 with a full help.md bundled
- Volume buttons (BGM / SFX) now pop up a vertical slider on hover (mouse environments)
- While playing online, a new settings button and panel: key bindings and input devices, master / BGM / SFX volume, language, team outline, render rate and stats display — all without interrupting the game
- Opoint generation expressions: spawn position (`gen_x` / `gen_y` / `gen_z`), initial velocity (`gen_dvx` / `gen_dvy` / `gen_dvz`) and spreading (`gen_spread_x` / `gen_spread_y` / `gen_spread_z`)
  - Variables `w` / `h` / `cx` / `cy`; functions `rand` / `pick` / `bag` (draws without repeats) / `flip` / `round`
  - Examples: `rand(-w/6, w/6)`, `round(rand(round(w/4), round(3*w/4)))`

### Tweaks

- Burning smoke is now driven by generation-point expressions
- Demo mode lineups and titles adjusted
- Data packs (zip) are now decompressed on demand

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW

## [v0.1.54](https://lf.gim.ink/0.1.54)

by [**Gim**](https://gim.ink)

<!-- git-range: 6f011c5a..2190304b -->

### What's New

- New "stand-attack distance" data for fighters and weapons: a dead zone and a max distance
  - Bots now back off first when too close, then attack from a standstill
  - Bots will not stand and attack from beyond the max distance
  - Defaults are set for each weapon type and can be overridden in data
- Frames now support a `blinking` field in XML, the editor and at runtime

### Tweaks

- While backing off, bots keep a small gap on the Z axis instead of retreating on the same line
- Bots pinned in a corner now slip out of the corner first
- Bots switch to attacking when they can no longer open up distance, instead of hugging the edge doing nothing

### Fixes

- Fixed buff effects sometimes lingering, and sometimes showing up at the origin (0,0)

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW

## [v0.1.53](https://lf.gim.ink/0.1.53)

by [**Gim**](https://gim.ink)

<!-- git-range: 6f70d033..1a5edbac -->

### What's New

- Picking up the red, blue or green book now grants a buff
  - Red book "Group Attack": your attacks can hit multiple targets (with an aura effect)
  - Blue book "MP Recovery": restores MP over time — the MP bar flashes while it is active
  - Green book "Electrify": your attacks electrify the enemy (stun + lightning effect)
- Books left on the ground are now cleaned up after a while

### Tweaks

- Book buff duration 1800 → 1080
- When the book bundle shatters, the red and green books scatter faster (1.5 → 2.5)
- MP recovery no longer ends early when MP is full
- Bots no longer pick up the red / blue / green books; bots now brake before picking up weapons
- Updated textures for the red book's aura and the green book's lightning

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW

## [v0.1.52](https://lf.gim.ink/0.1.52)

by [**Gim**](https://gim.ink)

<!-- git-range: d91f1e79..2e6715d7 -->

### What's New

- Electroshock effect: fighters hit by an electroshock (e.g. Louis's run attack) now show a lightning effect on them; it follows the fighter and disappears when the state ends

### Tweaks

- The "Template" fighter's head portrait is now a 4x-resolution texture (sharper on high-resolution screens)
- Added a "How to Report a Problem" guide (Chinese / English), plus an English version of "Thoughts on the Differences from LF2"

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW

## [v0.1.51](https://lf.gim.ink/0.1.51)

by [**Gim**](https://gim.ink)

<!-- git-range: d3d6cb08..09697a3f -->

### What's New

- The web build now checks for new versions (on lf.gim.ink only) and shows a notice in the bottom-right corner when one is out, with a one-click update button
- The browser extension now shows a "!" badge on its icon when an update is detected; the game then tells you to restart the browser to apply it

### Tweaks

- Survival single-player ranks (non-Bilibili) are now keyed by client + fighter, so one client's different fighters each get their own row
- Survival rank now reports the same phase number as the game itself (no more +1)
- The frame rate option in settings now has a note: the rendered frame rate is limited by your device and display refresh rate, so the selected value may not be reached
- Airborne fighters are easier to knock down
- Longer hit stop and hurt shaking (6 → 8); ball weapons have a much longer hit stop (2 → 8)
- Magic flute buffs are stronger: damage 1 → 2, duration 2 → 3
- Book weapons are much more fragile: bundle durability 800 → 400 (200 → 180 HP lost on landing); each book durability 750 → 200 (48 → 20 HP lost on landing); the bundle's hit damage 60 → 50; how books are held was also tweaked
- Weapons no longer hit fighters that are falling (knocked away)
- Julian's D>A: hover overshoot ("reverse only after passing the target by this much") is now per-axis and acceleration is higher; the ball and AI look for targets more often (every 2 frames, timed per entity)
- Scoreboard names are simplified: human players show their player name, other fighters show the fighter name
- Build tool: identical input now produces identical output; PNGs are optimized, so data packs are smaller
- Bounds cleanup: players and enemies are each limited by their own bounds; drink items use the stage's drink range, while other weapons and projectiles are no longer limited by it

### Fixes

- A thrown weapon that hits someone now enters its dropped state, so its attack no longer works after it lands
- Whether you can recover from a magic flute hit is now checked via the buff itself (no longer via collision records, so it does not break after the victim flies away)
- Fixed caught fighters not leaving the caught state when a catching move transforms the catcher
- Fixed "Little Fighter 2" being misspelled as "Litter Fighter 2" in the launcher texts
- Fixed the shadow occasionally showing up as a white square (the shadow is hidden while its texture is unavailable, then comes back automatically)
- Fixed the super punch condition: a single hit is now enough (it previously required more than one)

### Thanks

- Thanks to "Sauce" (酱油), "布利.白" and the QQ group members I can't name, for their feedback, support and encouragement
- Thanks to the many more who have tried LFW

## [v0.1.49](https://lf.gim.ink/0.1.49)

by [**Gim**](https://gim.ink)

"ON THE BOARD!"

### What's New

- New Survival Rank mode
- New 2-player Survival Rank
- Data packs support resumable downloads
- Backgrounds support foreground layers

### Tweaks

- Reworked UPS control: closer to the intended design and more stable; UPS is limited to 30 / 60; new "Perf" toggle in settings
- New multiplayer "Sync mode: Auto / Lockstep / Delay" (recommended from the worst RTT in the room), plus real-time player name sync
- Julian's D>A is weaker; Firzen's AI is stronger; book-type weapons no longer appear in VS mode or the random weapon pool
- Knocked-away weapons no longer hurt anyone while falling; picking a weapon up by rolling over it now requires holding the attack key
- Weapon drops are more spread out
- Added Romanian and Hungarian, so new texts are now covered by 12 languages (not proofread): German / Spanish / French / Hungarian / Italian / Japanese / Korean / Dutch / Polish / Portuguese / Romanian / Russian
- Tab no longer triggers the browser's default focus switching and can be used as a game key
- Other tweaks & performance work

### Fixes

- Fixed the client keeping stale data-pack info after the data pack was replaced on the server
- Fixed misaligned player names in multiplayer

## [v0.1.47](https://lf.gim.ink/0.1.47)

by [**Gim**](https://gim.ink)

"UNZIP !"

### What's New

- You can now switch the language (unproofread)
  ![switch_lang_w400.gif](docs/image/switch_lang_w400.gif)
- New weapon: Book Bundle + Book x3 (the first 3D-model weapon; heavy weapon / light thrown 3D-model weapons)
- ![unzip_w400.gif](docs/image/unzip_w400.gif)

### Weapons / Feel

- Light weapons flung by a whirlwind now count as the whirlwind's side, so they won't hit your own team
- Thrown weapons no longer land super-fast consecutive hits when flung by a whirlwind
- When a heavy weapon hits someone, the victim's velocity direction is now decided by their relative positions
- Weapons can only be picked up while on the ground

### Fixes

- Fixed wrong team-alive checks in campaign mode
- Campaign shutter animation is now pure black

## [v0.1.46](https://lf.gim.ink/0.1.46)

by [**Gim**](https://gim.ink)

### News

- New weapon: Basketball (an experiment in "multi-sprite overlay" & "sprite rotation")
![davis & basketball 'playing'](docs/image/bskb_davis.gif)

- New map: Pixel Ruler ("for testing some things")
![test case in the Pixel Ruler](docs/image/px_rl.gif)

### Misc

- Adjusted Rudolf's back-and-forth transform logic to roughly match LF2
- Adjusted Louis D^J+J..J logic to roughly match LF2
- Adjusted Freeze D>J so it can be broken correctly now
- Adjusted boomerang behavior to be closer to LF2
- Adjusted armor logic; Julian/Knight are now closer to the original (and weaker)
- Adjusted version name generation; you can now see the git commit ID for the version
- Adjusted UI text rendering
- Adjusted camera behavior when switching to shorter maps
- Adjusted Bot return-to-center position (randomized)
- Adjusted weapon bounce-on-landing behavior
- Various other adjustments; unknown if there are more issues
- Fixed a multiplayer failure caused by playing a random next BGM track when the current one ends
- Fixed an issue where the shadow blocks entities when they hug the top edge of the map
- Fixed an issue where a held weapon couldn't rescue hostages
- Fixed an issue where a held weapon couldn't bounce balls

## [v0.1.45](https://lf.gim.ink/0.1.45)

by [**Gim**](https://gim.ink)  2026-07-18 08:11:51

Nekketsu!

### News

- Terrain support is now available!
- A new map Nekketsu F01 originating from a parallel world

![image.png](https://lfwm.gim.ink/user/2/825/2d5932aa982e7d36e5fc21c77ca0b9c2 "image.png")
[YouTube Video](https://www.youtube.com/watch?v=mM2UD2EEK5A)
[Bilibili Video](https://www.bilibili.com/video/BV1BDTX6eEtq/)

### Misc

- Fixed the issue found in v0.1.42 ~ v0.1.44
- Numerous adjustments have been made; potential bugs may still exist
- Optimized the loading logic for image assets

## [v0.1.42](https://lf.gim.ink/0.1.42)

by [**Gim**](https://gim.ink)  2026-06-17 18:21:58

### News

- Louis (Ex)'s run attack and dash attack now apply an electric stun effect

![ltp1.webp](https://lfwm.gim.ink/user/2/797/bb0d676ae2726a32f52f670243f0fec1 "ltp1.webp")

### Misc

- Fixed the issue found in v0.1.35 ~ v0.1.41
- Adjusted the throw position calculation to prevent characters from being hit by enemies they threw
- Fixed the issue where custom game packs failed to download
- Added a return-to-game function on the custom game page
- Reduced memory usage and GC frequency
- Tweaked the idle auto-play logic on the main menu
- Fixed unresponsive issues on the ending page
- 改进文本渲染效率

## v0.1.34

by [**Gim**](https://gim.ink)  2026-06-10 13:01:41

### News

- Bat's bats now have lifesteal

![bat_new_duj.webp](https://lfwm.gim.ink/user/2/754/9300b5c285d074e10b7099bb1c1dda36 "bat_new_duj.webp")

- Higher FPS now looks smoother
    
    Now supports fixed 60FPS / 120FPS
    
![Screenshot 2026-05-18 171130.png](https://lfwm.gim.ink/user/2/754/877c89b7d2f371c583d287e00114791a "Screenshot 2026-05-18 171130.png")

### Fighters

- Rudolf
    - Fix 'transfrom' issues

### Misc

- Adjust weapon related visuals (But Boomerang is still broken)
- Fix several minor issues

## v0.1.27

by [**Gim**](https://gim.ink)  2026-05-31 22:38:34

“Bot Age 1”

### News 

- Added new command Follow(DJJJ)

![bot_resp_follow.webp](https://lfwm.gim.ink/user/2/725/376d401aa631a0ec3d029184995ddf75 "bot_resp_follow.webp")

- Bring "Lee on Road" back
    - Thanks [Dan](https://github.com/Glooring) for providing the data 
    - [Dan](https://github.com/Glooring) is currently working on the **LF2 Unified**
    - **LF2 Unified** can perfectly restore the original game experience. Please Stay tuned

![lorbg.webp](https://lfwm.gim.ink/user/2/725/cf6f1c2a82a2347375063c522cf69397 "lorbg.webp")
    
### Bots

- Bots can now auto keep away from the boundary of stage correctly
- Bots can now pick up items after rolling or braking while running
- When all human players have 0 HP in Stage Mode, ally will rescue Criminal
- Bots become smarter when using melee with weapons
- Bots have a higher chance to throw small weapons
- Bots will not avoid the enemy without get-up invincibility

### Fighters

- Common
    - Increased skill usage probability
    - Certain attacks will no longer stop to defend against reflectable balls, breakable balls or thrown weapons
        - Example: Firen D>J | Dennis D>J | LouisEX Running
    - Normal attacks that consume MP can still be performed when MP ≤ 0
        - Example: Henry | Rudolf | Hunter
- Woody
    - Lower probability to use teleport
    - Higher probability to use (D>J) after teleport
- Firen
    - Blazing Burst (D>J) can no longer reflect balls
- Rudolf
    - Higher probability to use Clone (DvJ)
    - Higher probability to use Invisibility (D^J)

### Weapons

- Common
    - Hitting a heavy weapon will change its team

### Misc

- Fixed various minor issues
- Collision detection performance may have been improved
- When entities exceed 355, the following entities will no longer be created
    - Firzen D^A tail, Jan D^A tail, Jan D^J tail, weapon fragments, ice fragments, fire particles

## v0.1.26

by [**Gim**](https://gim.ink)  2026-05-31 22:38:43

#### News
- **Recapture the laggy feel of childhood**
- Rudolf D<>A can now directly use his **Super Punch**
  - Designed to show the differences between LFW and classic LF2
  - LFW supports longer combo input sequences
    ![jkhgfd.gif](https://lfwm.gim.ink/user/2/687/3b726f48c299348391dccdb112ecb217 "jkhgfd.gif")

#### Values & Game Logic
- Armor Mechanics
  - Fixed an issue where armor remained effective even when a target’s current frame armor value ≤ 0
    - This bug made Julian and Knight overly tanky
  - Fixed arrows bouncing instead of disappearing when striking through armor

- Fixed bugs related to `opint.spreading = OpointSpreading.FloatRange`
  - Caused Julian D>A’s ball projectile to only spawn with downward initial velocity

- Fixed an issue where objects spawned by opoint would skip the 0th frame instantly
  - Weakened certain projectiles (e.g. Henry / Monk / Louis / LouisEx D>A)
  - Caused inconsistent behavior for multiple ball-type skills

- Fixed a glitch allowing teleportation near 0 HP targets (Woody D^J / DvJ)
- Immediately reset `arest` if a frame contains no itr data
  - Matches original LF2 behavior

#### Controls & Gameplay
- Revised input priority order, new sequence: **D , < , > , ^ , v , J , A**
  - Old order: `< , > , ^ , v , A , J , D`
  - Previously, pressing J+A while standing would trigger a normal attack instead of a jump attack (same for running jump attacks)

- Reworked double-tap sprint logic
  - Removed the awkward behavior of instantly resuming sprinting after stopping

- Adjusted `itr.dvy` calculation to enable more consistent combos
- Keeps input buffer states during most hit reactions (excluding knockdown and knockback)

#### Misc

- Added colors for Team5 ~ Team8
- Adjusted Demo Mode
  - Demo now randomly uses bots to play stage mode
  - The demo will automatically restart after ending
- Added zoom support for background layers
- Fully rewritten AI evasion logic for Bots
- Fixed inability to access settings from the main menu
- Added support for running the game at **30 UPS / 90 UPS / 120 UPS**
  ***Certain in-game calculations will function differently across UPS values.***
- Online matches are locked to 30 UPS
- Mobile devices default to 30 UPS
- ~~Attempted render interpolation (improves smooth FPS at low UPS)~~

## v0.1.25

by [**Gim**](https://gim.ink)  2026-08-14 11:03:56

- After falling, press Attack/Defend to get up earlier or later
![padfssu.gif](https://lfwm.gim.ink/user/2/669/38aa82e326d62dd9607fda24a95b9861 "padfssu.gif")
- More options are available in the settings page
![Screenshot 2026-04-21 033948.png](https://lfwm.gim.ink/user/2/669/c03e3776bf0710ddb87302c7ac9145a9 "Screenshot 2026-04-21 033948.png")
- Reduce render frequency on mobile devices by default
- Fixed an issue where audio only plays after switching windows
- Optimized text rendering performance
- Improved bot behavior
- The health bar will flash when skills restore HP
- Fixed the issue where Freeze (D>A) Ball could assimilate John's (D>J) Shield

## v0.1.24

by [**Gim**](https://gim.ink)  2026-04-24 17:04:01

“Bot Age 0”

- Adjusted bot defense logic (no longer defends frequently)
- Increased bot move frequency
- Adjusted behavior for ranged characters (Henry / Rudolf / Hunter)
- Rescued bot allies can no longer be carried over to the next stage
- Fixed burned/frozen characters not dropping heavy weapons
- Fixed Ball spread logic (Firzen/Jan/Bat)
- F8 now drop all droppable weapons (if allowed)

## v0.1.22

by [**Gim**](https://gim.ink)  2026-04-14 17:30:46

"Dead Men Tell No Tales"

- Player can't say Stay/Move/Come at 0 HP
- Easier to use: STAY(DDDD), MOVE(DADA), Come(DJDJ)
- Fixed ally bots not responding to "Come". (And will move closer to "Come" position)
- Clean up objects on next stage
- Fixed team-outline not working
- Fixed incorrect motionless duration when Ball hits
- Enemies no longer have wakeup invulnerability in Stage Mode
- Enemies status bars are no longer shown by default in Story Mode
- Adjusted bot behavior logic
- Adjusted MP recover rate
- More test cases

## v0.1.21

by [**Gim**](https://gim.ink)  2026-04-11 00:50:55

- VS Mode, starting MP is set to 40%
- Fixed wpoint.kind 3 (Freeze DvJ)
- Fixed Henry's D^J attack damage (was too high)
- Fixed itr.kind 15,16 (Freeze D^J)
- Empty Bottle drops with random velocity
- Auto foucs 'Reset Random'
- Fixed Char-Menu Logic
- More Test Cases
![ebdrv.gif](https://lfwm.gim.ink/user/2/596/6eb9586b8710c1666661babb518d77aa "ebdrv.gif")
![hupgzv.gif](https://lfwm.gim.ink/user/2/596/65945a40218279bb1df17787e1f67b95 "hupgzv.gif")

## v0.1.20

by [**Gim**](https://gim.ink)  2026-05-31 22:39:00

- Add Test Cases Page
- 
![image.png](https://lfwm.gim.ink/user/2/526/9749944b3c34185d210009172535cd20 "image.png")
- Bg: Moon
- Allow Bg Override World Dataset 

![bg_override_gravity.gif](https://lfwm.gim.ink/user/2/526/b2e4632972bcbde3340a0727446647bc "bg_override_gravity.gif")
- Will muted when hidden
- Dividers in picture removed
- Volume no longer spikes
- Firen groud-fire/explosion fixed
- Fix Weapon throw gravity
- Fix ScoreBoard of Stage-Mode & Vs-Mode & Demo-Mode
- Add field "ball_itr_motionless" to dataset
- Weapon State 3006(for Felix Jump Attack from RN)
- Change Logic of State 100 (for Aquila from RN)
- Fix Bot data preprocess logic
- Force set frames 220-225 to state 11 (for RN)
- Force set frames 226-229 to state 16 (for RN)
- Force set gone object hp to 0 (for RN)

## v0.1.19

by [**Gim**](https://gim.ink)  2026-05-31 22:39:12

"Limited New Attempts"

- Jump height now depends on key hold duration

![normal_jump_small_Jump.gif](https://lfwm.gim.ink/user/2/512/9e912642f3c7b772d5a64e2f22163ea8 "normal_jump_small_Jump.gif")
- Moves fixed
    - Firzen D^A 
    - Jan D^A 
    - Jan D^J
- Stage Mode
  - Fixed unable to enter next stage
  - Fixed initial enemy count not scaling with players
- Others
  - Adjusted hitstun jump logic
  - Fixed bots rarely attacking
  - Attempted fix for browser crashes

## v0.1.18

by [**Gim**](https://gim.ink)  2026-04-01 02:12:20

"More optimize, More bug"

- fix: allow set touchscreen player in ctrl settings
![Screenshot 2026-03-12 225759.png](https://lfwm.gim.ink/user/2/499/2ae82287d8e3574d8ff00aacb744125d "Screenshot 2026-03-12 225759.png")

- fix: display fn keys counts
![fn_key_counts.gif](https://lfwm.gim.ink/user/2/499/937839997343f20094b463b561a81f03 "fn_key_counts.gif")

- fix: more variables in world-dataset
- fix: no longer converts certain data
- fix: dash/jump/breakfall vy caculation
- fix: julian/kngiht armor, henry d^j, john d^a
- fix: touchpad ^^vv<><>dada
- fix: zwidth of itr & bdy
- fix: bgm-swithcer in vs-mode
- fix: minor adjustment about ball be hit

## v0.1.17

by [**Gim**](https://gim.ink)  2026-04-01 02:12:25

Optimization of touch-screen operation experience, and other tweaks


![aaa.gif](https://lfwm.gim.ink/user/2/487/3768e3eb9731d41dd714144bd4d68539 "aaa.gif")
![bbb.gif](https://lfwm.gim.ink/user/2/487/155928adc4be6a436ba5a59405129fd9 "bbb.gif")

- fix: fall-in-air when fall_value <= dizzy_value
- fix: obj now stays at spawn point for a short while
- fix: vx calculation
- fix: gravity = 0.4375
- fix: weapon_throwing_gravity = 0.21875
- fix: throw_victim_vy_factor = 1.15
  - it is for the "henry throw + d>a"
  - uncertain it will cause other problems

## v0.1.16

by [**Gim**](https://gim.ink)  2026-04-01 02:12:32

***vx calculation is still different from lf2. but let's move on.***

- fix: change dvx calc method
- fix: vy = 0 when hit(not fall)
- fix: weapon drop will no longer 'follow_bearer' 
- fix: will enter next frame immediately when wait = 0
- fix: about ball.hit_Fa=3
- fix: ball.frame.landable = 0(allow ball fly to underground)
- fix: opoint & dvz 550
- fix: same id bg will be replace(allow mod to overwrite original data)
- fix: same id data will be replace(allow mod to overwrite original data)
- fix: when frame.state == 1001, it no longer ignore itr.kind != 5
- fix: allow load MersenneTwister
- fix: more FacingFlag (SameAsBearer, OpposingBearer)
- fix: more speed ctrl mode
- chore: fix FFMPEG_CMD
- fix: julian ball bug
- fix: gamepad bug

## v0.1.15

by [**Gim**](https://gim.ink)  2026-04-18 13:47:53

- fix: 修复按键跳转未消耗hp/mp的问题
- fix(dev): invisible_blinking
- fix(dev): arest_after_motionless/vrest_after_shaking
- fix: arest/vrest messing
- fix: wrong expression about back-dash
- fix: weapon_throwing_gravity
- fix: jump_x_f/jump_z_f/jump_h_f/dash_x_f/dash_z_f/dash_h_f
- fix: state 9998 will not itr
- fix: louis dja
- fix: firen+freeze
- fix: outline effect
- fix: itr effect 20 & Weapon
- fix: some object remove team outline
- fix: fragment_shader
- fix: drop_catching
- fix: caught falling

## v0.1.14

by [**Gim**](https://gim.ink)  2026-04-01 02:12:42

- fix(game): When there are no enemies for Firzen's d^a, it will no longer split
- fix(tool): Support negative MP consumption
- fix(game): Fix the problem of abnormal stat display
- fix(game): Fix the issues that after an enemy surrenders, the attack target is not removed and the team stroke color does not change
- fix(game): Fix the bug that the weapon follows with a one-frame delay
- fix(game): Fix the problem that when throwing someone, the position of the thrown person is incorrect
- fix(game): When taking damage, the armor value returns to 0
- fix(game): Refactored the implementation of tracking and adjusted its effect
- fix(game): Fix the problem of the ball having a 2-times Z-axis speed
- fix(game/tool): The ball no longer collides with the ground by default
- fix(game/tool): Itr supports on_hit_ground (For Firzen/Jan's ball, it originally only judged whether it landed based on centery)
- fix(dev): Support exporting world-tuning data
- fix(game): Fix the problem of too high defense value (it takes 4 hits to break the defense)

- Thanks to "Sauce" and "Memento" for their feedback

## v0.1.13

by [**Gim**](https://gim.ink)  2026-04-01 02:12:47

- feat(prel): In the bottom-left corner of the 'VS Mode Prepare Page', the background music can be switched by clicking the left/middle/right mouse button
- fix(game): fix the problem of being unable to switch difficult
- fix(game): Fix the incorrect performance when two people pick up a weapon as the same time
- fix(game): fix the performance when two people grab one person as the same time
- fix(game): Support background music overwrite with the same name under multiple mods
- fix(game): For the caught character and the held weapon, their wait value will no longer decrease
- fix(game): Allow the cpoint or its xy of the caught character to be lost, and its performance aligns with the original version
- fix(game): Fix the problem of incorrect channel effect of the battle sound in the main page (it will be quieter)
- fix(game): After leaving the main page, objects in the scene can be correctly cleared
- fix(game): Allow the wpoint or its xy to be lost, and its performance aligns with the original version (comparable to Henry shooting an arrow backwards while dashing with a weapon)
- fix(data): Beer is no longer regarded as a 'Stage Weapons' (beer will no longer drop randomly during 'Stage Mode')
- fix(tool): Weapons outside the range of [100,199] are no longer regarded as 'Stage/VS Weapons' (they will no longer drop during Stage/VS Mode)

## v0.1.12

by [**Gim**](https://gim.ink)  2026-04-01 02:12:52

- fix: The MP recovery speed has been corrected. (It was too fast before...)
- feat: Mod supported
- fix: Removed the buttons on the main page whose functions are not yet supported
- feat: Some pages now support viewing the version number and the file name of the Mod
- chore: there will be some fighting on the 'Main Page' :D

## v0.1.9

by [**Gim**](https://gim.ink)  2026-04-01 02:12:57

- fix: The attacked will drop the heavy weapons they are holding correctly
- fix: Adjusted the performance of hitting and being hit by baseball-like weapons
- fix: The boomerang can track enemies now
- feat: You can see your own latency in the room list
- feat: In the room, you can see the latency of all room members
- fix: Fix the issues of bots not using moves and being overly defensive
- feat: Custom game supported

## v0.1.5

by [**Gim**](https://gim.ink)  2026-04-01 02:13:01

- feat: add “team outline” effect
- fix: fix the problem that the background and level buttons do not respond
- fix: fix the problem of incorrect display on the scoreboard
- fix: weapon will have a more reasonable effect
- fix: Improved the performance of the weapon's bounce when it hits the ground
- fix: Fixed the problem of incorrect starting point for weapon throwing
- fix: Fixed the issue that airborne weapons can't be hit again
- feat: Rooms can now be password - protected
- fix: It's no longer possible to join a room that has already started or where all players are ready
- fix: The survival mode will correctly display the current stage number
- fix: The "GO->" will no longer be displayed in the survival mode
- fix: The "GO->" will no longer be displayed in the last sub-level of the mission - passing mode
- fix: Fixed the problem of incorrect relationship between difficulty and the number of enemies in the mission-passing/survival mode (the problem was that there were too many enemies)

### v0.1.4

2026-01-17

- fix: fix the problem that the background and level buttons do not respond
- fix: fix the problem of incorrect display on the scoreboard
- fix: Improved the performance of the weapon's bounce when it hits the ground
- fix: Fixed the problem of incorrect starting point for weapon throwing
- fix: Fixed the issue that airborne weapons can't be hit again
- feat: Rooms can now be password - protected
- fix: It's no longer possible to join a room that has already started or where all players are ready
- fix: The survival mode will correctly display the current stage number
- fix: The "GO->" will no longer be displayed in the survival mode
- fix: The "GO->" will no longer be displayed in the last sub-level of the mission - passing mode
- fix: Fixed the problem of incorrect relationship between difficulty and the number of enemies in the mission-passing/survival mode (the problem was that there were too many enemies)

### v0.1.3

2026-01-15

- fix: weapon will have a more reasonable effect

### v0.1.2

2026-01-15
