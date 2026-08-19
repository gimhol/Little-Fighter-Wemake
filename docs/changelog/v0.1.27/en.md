# v0.1.27

by [**Gim**](https://gim.ink)  2026-05-31 22:38:34

“Bot Age 1”

### News 

- Added new command Follow(DJJJ)

![bot_resp_follow.webp](https://lfwm.gim.ink/user/2/725/376d401aa631a0ec3d029184995ddf75 "bot_resp_follow.webp")

- Bring "Lee on Road" back
    - Thanks [Dan](https://github.com/Glooring) for providing the data. 
    - [Dan](https://github.com/Glooring) is currently working on the **LF2 Unified**
    - **LF2 Unified** can perfectly restore the original game experience. Please Stay tuned.

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

