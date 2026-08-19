# v0.1.16

by [**Gim**](https://gim.ink)  2026-04-01 02:12:32

速度计算仍有区别，且放它一马

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

