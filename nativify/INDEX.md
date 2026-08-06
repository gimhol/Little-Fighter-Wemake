# LFW TS → C++ 移植难度索引

> 共 821 个文件。难度 1=微不足道 … 5=极难。
> 📌 = 有深度分析（见 [deep-dive/](./deep-dive/)）

| 难度 | 文件 | 行数 | 分类 | 深度分析 |
| --- | --- | --- | --- | --- |
| 5 | [`entity/Entity.ts`](./reports/entity/Entity.md) | 2558 | 类+函数+数据混合 | [📌](./deep-dive/entity-Entity.md) |
| 5 | [`World.ts`](./reports/World.md) | 1043 | 类+函数+数据混合 | [📌](./deep-dive/World.md) |
| 5 | [`ui/UINode.ts`](./reports/ui/UINode.md) | 874 | 类+函数+数据混合 | [📌](./deep-dive/ui-UINode.md) |
| 5 | [`LFW.ts`](./reports/LFW.md) | 816 | 类+函数+数据混合 | [📌](./deep-dive/LFW.md) |
| 4.5 | [`stage/Stage.ts`](./reports/stage/Stage.md) | 477 | 类+函数+数据混合 | [📌](./deep-dive/stage-Stage.md) |
| 4.5 | [`controller/BaseController.ts`](./reports/controller/BaseController.md) | 444 | 类+函数+数据混合 | [📌](./deep-dive/controller-BaseController.md) |
| 4.5 | [`loader/DatMgr.ts`](./reports/loader/DatMgr.md) | 385 | 类+函数+数据混合 | [📌](./deep-dive/loader-DatMgr.md) |
| 4.5 | [`ui/component/UIComponent.ts`](./reports/ui/component/UIComponent.md) | 276 | 类+函数+数据混合 | [📌](./deep-dive/ui-component-UIComponent.md) |
| 4 | [`bot/BotController.ts`](./reports/bot/BotController.md) | 768 | 类+函数+数据混合 | [📌](./deep-dive/bot-BotController.md) |
| 4 | [`dat_translator/make_fighter_data.ts`](./reports/dat_translator/make_fighter_data.md) | 594 | 纯函数工具 | [📌](./deep-dive/dat_translator-make_fighter_data.md) |
| 4 | [`ui/component/DemoModeLogic.ts`](./reports/ui/component/DemoModeLogic.md) | 453 | 类+函数+数据混合 | [📌](./deep-dive/ui-component-DemoModeLogic.md) |
| 4 | [`collision/CollisionKeeper.ts`](./reports/collision/CollisionKeeper.md) | 335 | 类+函数+数据混合 | [📌](./deep-dive/collision-CollisionKeeper.md) |
| 4 | [`ui/component/CharMenu/CharMenuLogic.ts`](./reports/ui/component/CharMenu/CharMenuLogic.md) | 298 | 类+函数+数据混合 |  |
| 4 | [`base/Expression.ts`](./reports/base/Expression.md) | 182 | 类+函数+数据混合 |  |
| 4 | [`utils/schema/validate_schema.ts`](./reports/utils/schema/validate_schema.md) | 181 | 类+函数+数据混合 | [📌](./deep-dive/utils-schema-validate_schema.md) |
| 4 | [`PlayerInfo.ts`](./reports/PlayerInfo.md) | 137 | 类+函数+数据混合 |  |
| 4 | [`dat_translator/bots/BotMaker.ts`](./reports/dat_translator/bots/BotMaker.md) | 96 | 类+函数+数据混合 |  |
| 3.5 | [`Ground.ts`](./reports/Ground.md) | 456 | 类+函数+数据混合 |  |
| 3.5 | [`defines/IFrameInfo.ts`](./reports/defines/IFrameInfo.md) | 449 | 纯函数工具 |  |
| 3.5 | [`defines/defines.ts`](./reports/defines/defines.md) | 409 | 纯函数工具 |  |
| 3.5 | [`ui/cook_ui_info.ts`](./reports/ui/cook_ui_info.md) | 317 | 纯函数工具 |  |
| 3.5 | [`ui/component/StageModeLogic.ts`](./reports/ui/component/StageModeLogic.md) | 246 | 类+函数+数据混合 |  |
| 3.5 | [`loader/preprocess_frame.ts`](./reports/loader/preprocess_frame.md) | 196 | 纯函数工具 |  |
| 3.5 | [`ui/xml_to_ui_info.ts`](./reports/ui/xml_to_ui_info.md) | 195 | 纯函数工具 |  |
| 3.5 | [`ui/component/DanmuGameLogic.ts`](./reports/ui/component/DanmuGameLogic.md) | 188 | 类+函数+数据混合 |  |
| 3.5 | [`stage/Item.ts`](./reports/stage/Item.md) | 172 | 类+函数+数据混合 |  |
| 3.5 | [`ui/component/SummaryLogic.ts`](./reports/ui/component/SummaryLogic.md) | 170 | 类+函数+数据混合 |  |
| 3.5 | [`ui/component/UIProps.ts`](./reports/ui/component/UIProps.md) | 115 | 类+函数+数据混合 |  |
| 3.5 | [`I18N.ts`](./reports/I18N.md) | 87 | 类+函数+数据混合 |  |
| 3.5 | [`ui/utils/check_field.ts`](./reports/ui/utils/check_field.md) | 71 | 类+函数+数据混合 |  |
| 3 | [`collision/Collision.ts`](./reports/collision/Collision.md) | 316 | 纯函数工具 |  |
| 3 | [`bot/state/BotState_Chasing.ts`](./reports/bot/state/BotState_Chasing.md) | 304 | 类+函数+数据混合 |  |
| 3 | [`defines/StateEnum.ts`](./reports/defines/StateEnum.md) | 295 | 纯函数工具 |  |
| 3 | [`defines/IOpointInfo.ts`](./reports/defines/IOpointInfo.md) | 267 | 纯函数工具 |  |
| 3 | [`ui/component/Slider/SliderHandle.ts`](./reports/ui/component/Slider/SliderHandle.md) | 263 | 类+函数+数据混合 |  |
| 3 | [`loader/preprocess_itr.ts`](./reports/loader/preprocess_itr.md) | 224 | 纯函数工具 |  |
| 3 | [`dat_translator/cook_frames.ts`](./reports/dat_translator/cook_frames.md) | 212 | 纯函数工具 |  |
| 3 | [`ui/component/FighterStatBar.ts`](./reports/ui/component/FighterStatBar.md) | 210 | 类+函数+数据混合 |  |
| 3 | [`dat_translator/make_stage_info_list.ts`](./reports/dat_translator/make_stage_info_list.md) | 202 | 纯函数工具 |  |
| 3 | [`bot/state/BotState.ts`](./reports/bot/state/BotState.md) | 200 | 类+函数+数据混合 |  |
| 3 | [`defines/IItrInfo.ts`](./reports/defines/IItrInfo.md) | 190 | 纯函数工具 |  |
| 3 | [`ui/component/LaunchPageLogic.ts`](./reports/ui/component/LaunchPageLogic.md) | 175 | 类+函数+数据混合 |  |
| 3 | [`ui/component/LittleFunnyAutoGame.ts`](./reports/ui/component/LittleFunnyAutoGame.md) | 152 | 类+函数+数据混合 |  |
| 3 | [`WorldDataset.ts`](./reports/WorldDataset.md) | 140 | 类+函数+数据混合 |  |
| 3 | [`base/InstFactory.ts`](./reports/base/InstFactory.md) | 123 | 类+函数+数据混合 |  |
| 3 | [`ui/UIStack.ts`](./reports/ui/UIStack.md) | 123 | 类+函数+数据混合 |  |
| 3 | [`ui/component/Tests/TestCase.ts`](./reports/ui/component/Tests/TestCase.md) | 121 | 类+函数+数据混合 |  |
| 3 | [`ditto/sounds/BaseSounds.ts`](./reports/ditto/sounds/BaseSounds.md) | 115 | 类+函数+数据混合 |  |
| 3 | [`Factory.ts`](./reports/Factory.md) | 114 | 类+函数+数据混合 |  |
| 3 | [`state/CharacterState_Falling.ts`](./reports/state/CharacterState_Falling.md) | 113 | 类+函数+数据混合 |  |
| 3 | [`base/NoEmitCallbacks.ts`](./reports/base/NoEmitCallbacks.md) | 112 | 类+函数+数据混合 |  |
| 3 | [`base/FSM.ts`](./reports/base/FSM.md) | 104 | 类+函数+数据混合 |  |
| 3 | [`fields.ts`](./reports/fields.md) | 103 | 纯函数工具 |  |
| 3 | [`ui/component/MiscSettingsLogic.ts`](./reports/ui/component/MiscSettingsLogic.md) | 103 | 类+函数+数据混合 |  |
| 3 | [`state/CharacterState_Lying.ts`](./reports/state/CharacterState_Lying.md) | 95 | 类+函数+数据混合 |  |
| 3 | [`ui/component/CameraCtrl.ts`](./reports/ui/component/CameraCtrl.md) | 94 | 类+函数+数据混合 |  |
| 3 | [`ui/component/IntegerPicker.ts`](./reports/ui/component/IntegerPicker.md) | 94 | 类+函数+数据混合 |  |
| 3 | [`dat_translator/FrameEditing.ts`](./reports/dat_translator/FrameEditing.md) | 82 | 类+函数+数据混合 |  |
| 3 | [`ui/component/Tests/ActionDirector.ts`](./reports/ui/component/Tests/ActionDirector.md) | 78 | 类+函数+数据混合 |  |
| 3 | [`ui/component/BackgroundSwitcher.ts`](./reports/ui/component/BackgroundSwitcher.md) | 66 | 类+函数+数据混合 |  |
| 3 | [`ui/component/ScaleAnimation.ts`](./reports/ui/component/ScaleAnimation.md) | 63 | 类+函数+数据混合 |  |
| 3 | [`bot/NearestTargets.ts`](./reports/bot/NearestTargets.md) | 62 | 类+函数+数据混合 |  |
| 3 | [`dat_translator/ColonValueReader.ts`](./reports/dat_translator/ColonValueReader.md) | 62 | 类+函数+数据混合 |  |
| 3 | [`ui/component/ReachableGroup.ts`](./reports/ui/component/ReachableGroup.md) | 62 | 类+函数+数据混合 |  |
| 3 | [`ui/component/PositionAnimation.ts`](./reports/ui/component/PositionAnimation.md) | 60 | 类+函数+数据混合 |  |
| 3 | [`ui/action/Actor.ts`](./reports/ui/action/Actor.md) | 57 | 类+函数+数据混合 |  |
| 3 | [`helper/Randoming.ts`](./reports/helper/Randoming.md) | 52 | 类+函数+数据混合 |  |
| 3 | [`ui/UIImgLoader.ts`](./reports/ui/UIImgLoader.md) | 51 | 类+函数+数据混合 |  |
| 2.5 | [`defines/IWorldDataset.ts`](./reports/defines/IWorldDataset.md) | 485 | 常量/静态数据 |  |
| 2.5 | [`defines/IEntityInfo.ts`](./reports/defines/IEntityInfo.md) | 240 | 纯函数工具 |  |
| 2.5 | [`defines/IBotDataSet.ts`](./reports/defines/IBotDataSet.md) | 211 | 类+函数+数据混合 |  |
| 2.5 | [`dat_translator/make_ball_special.ts`](./reports/dat_translator/make_ball_special.md) | 205 | 纯函数工具 |  |
| 2.5 | [`defines/ItrKind.ts`](./reports/defines/ItrKind.md) | 193 | 纯函数工具 |  |
| 2.5 | [`entity/DrinkInfo.ts`](./reports/entity/DrinkInfo.md) | 191 | 类+函数+数据混合 |  |
| 2.5 | [`ditto/sounds/ISounds.ts`](./reports/ditto/sounds/ISounds.md) | 181 | 纯函数工具 |  |
| 2.5 | [`dat_translator/make_weapon_special.ts`](./reports/dat_translator/make_weapon_special.md) | 172 | 纯函数工具 |  |
| 2.5 | [`entity/collision_action_handlers.ts`](./reports/entity/collision_action_handlers.md) | 170 | 纯函数工具 |  |
| 2.5 | [`buff/Buff.ts`](./reports/buff/Buff.md) | 146 | 类+函数+数据混合 |  |
| 2.5 | [`utils/math/MersenneTwister.ts`](./reports/utils/math/MersenneTwister.md) | 143 | 类+函数+数据混合 |  |
| 2.5 | [`entity/Summary.ts`](./reports/entity/Summary.md) | 133 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/VsModeLogic.ts`](./reports/ui/component/VsModeLogic.md) | 133 | 类+函数+数据混合 |  |
| 2.5 | [`dat_translator/xml/xml_x_entity_info.ts`](./reports/dat_translator/xml/xml_x_entity_info.md) | 131 | 纯函数工具 |  |
| 2.5 | [`animation/Animation.ts`](./reports/animation/Animation.md) | 121 | 类+函数+数据混合 |  |
| 2.5 | [`dat_translator/obj_dat_to_json.ts`](./reports/dat_translator/obj_dat_to_json.md) | 121 | 纯函数工具 |  |
| 2.5 | [`ui/component/GamePrepareLogic.ts`](./reports/ui/component/GamePrepareLogic.md) | 119 | 类+函数+数据混合 |  |
| 2.5 | [`ui/Style.ts`](./reports/ui/Style.md) | 116 | 类实现 |  |
| 2.5 | [`ui/component/Tests/Tests.ts`](./reports/ui/component/Tests/Tests.md) | 116 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/Flex.ts`](./reports/ui/component/Flex.md) | 112 | 类+函数+数据混合 |  |
| 2.5 | [`bot/state/BotState_Avoiding.ts`](./reports/bot/state/BotState_Avoiding.md) | 109 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/Tests/Bat/Bat_DUJ.ts`](./reports/ui/component/Tests/Bat/Bat_DUJ.md) | 107 | 类+函数+数据混合 |  |
| 2.5 | [`defines/HitFlag.ts`](./reports/defines/HitFlag.md) | 106 | 纯函数工具 |  |
| 2.5 | [`dat_translator/xml/xml_from_json.ts`](./reports/dat_translator/xml/xml_from_json.md) | 105 | 纯函数工具 |  |
| 2.5 | [`ui/read_info_value.ts`](./reports/ui/read_info_value.md) | 103 | 纯函数工具 |  |
| 2.5 | [`state/WeaponState_Base.ts`](./reports/state/WeaponState_Base.md) | 98 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/Tests/Firezen/Firzen_DUA.ts`](./reports/ui/component/Tests/Firezen/Firzen_DUA.md) | 93 | 类+函数+数据混合 |  |
| 2.5 | [`dat_translator/CondMaker.ts`](./reports/dat_translator/CondMaker.md) | 92 | 类+函数+数据混合 |  |
| 2.5 | [`bot/state/BotState_Idle.ts`](./reports/bot/state/BotState_Idle.md) | 88 | 类+函数+数据混合 |  |
| 2.5 | [`loader/get_val_from_entity.ts`](./reports/loader/get_val_from_entity.md) | 87 | 纯函数工具 |  |
| 2.5 | [`ui/component/Tests/Bot/BotAvoiding.ts`](./reports/ui/component/Tests/Bot/BotAvoiding.md) | 85 | 类+函数+数据混合 |  |
| 2.5 | [`Transform.ts`](./reports/Transform.md) | 77 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/Jalousie.ts`](./reports/ui/component/Jalousie.md) | 76 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/OpacityFlash.ts`](./reports/ui/component/OpacityFlash.md) | 76 | 类+函数+数据混合 |  |
| 2.5 | [`animation/Sequence.ts`](./reports/animation/Sequence.md) | 75 | 类+函数+数据混合 |  |
| 2.5 | [`ditto/Instance.ts`](./reports/ditto/Instance.md) | 74 | 纯函数工具 | [📌](./deep-dive/ditto-Instance.md) |
| 2.5 | [`state/CharacterState_Base.ts`](./reports/state/CharacterState_Base.md) | 72 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/CharMenu/CharMenuState_ComSel.ts`](./reports/ui/component/CharMenu/CharMenuState_ComSel.md) | 71 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/ImgLoop.ts`](./reports/ui/component/ImgLoop.md) | 71 | 类+函数+数据混合 |  |
| 2.5 | [`base/FPS.ts`](./reports/base/FPS.md) | 68 | 类实现 |  |
| 2.5 | [`ui/component/CharMenuHead.ts`](./reports/ui/component/CharMenuHead.md) | 67 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/TeamSituationText.ts`](./reports/ui/component/TeamSituationText.md) | 67 | 类实现 |  |
| 2.5 | [`state/States.ts`](./reports/state/States.md) | 65 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/StageSwitcher.ts`](./reports/ui/component/StageSwitcher.md) | 64 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/ComponentsPlayer.ts`](./reports/ui/component/ComponentsPlayer.md) | 63 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/CharMenu/CharMenuState_ComNumSel.ts`](./reports/ui/component/CharMenu/CharMenuState_ComNumSel.md) | 58 | 类+函数+数据混合 |  |
| 2.5 | [`loader/preprocess_entity_data.ts`](./reports/loader/preprocess_entity_data.md) | 57 | 纯函数工具 |  |
| 2.5 | [`ui/component/PlayerScoreCell.ts`](./reports/ui/component/PlayerScoreCell.md) | 57 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/BGMSwitcher.ts`](./reports/ui/component/BGMSwitcher.md) | 54 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/FnKeysCounts.ts`](./reports/ui/component/FnKeysCounts.md) | 54 | 类+函数+数据混合 |  |
| 2.5 | [`loader/get_val_from_collision.ts`](./reports/loader/get_val_from_collision.md) | 53 | 纯函数工具 |  |
| 2.5 | [`ui/component/LabelButton.ts`](./reports/ui/component/LabelButton.md) | 53 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/OpacityAnimation.ts`](./reports/ui/component/OpacityAnimation.md) | 53 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/Tests/Bg/Moon.ts`](./reports/ui/component/Tests/Bg/Moon.md) | 53 | 类+函数+数据混合 |  |
| 2.5 | [`ui/component/StageTitleText.ts`](./reports/ui/component/StageTitleText.md) | 52 | 类+函数+数据混合 |  |
| 2.5 | [`helper/WeaponsHelper.ts`](./reports/helper/WeaponsHelper.md) | 50 | 类+函数+数据混合 |  |
| 2.5 | [`entity/SummaryMgr.ts`](./reports/entity/SummaryMgr.md) | 47 | 类+函数+数据混合 |  |
| 2.5 | [`dat_translator/xml/diff_map_utils.ts`](./reports/dat_translator/xml/diff_map_utils.md) | 36 | 纯函数工具 |  |
| 2.5 | [`ui/component/RandomVisible.ts`](./reports/ui/component/RandomVisible.md) | 27 | 类+函数+数据混合 |  |
| 2.5 | [`utils/container_help/find.ts`](./reports/utils/container_help/find.md) | 27 | 纯函数工具 |  |
| 2.5 | [`ditto/importer/BaseImporter.ts`](./reports/ditto/importer/BaseImporter.md) | 17 | 类实现 |  |
| 2 | [`ditto/xml/IXMLElement.ts`](./reports/ditto/xml/IXMLElement.md) | 278 | 纯类型声明 (interface/type) |  |
| 2 | [`dat_translator/cook_ball_frame_state_3000.ts`](./reports/dat_translator/cook_ball_frame_state_3000.md) | 173 | 纯函数工具 |  |
| 2 | [`dat_translator/cook_ball_frame_state_3001_4.ts`](./reports/dat_translator/cook_ball_frame_state_3001_4.md) | 168 | 纯函数工具 |  |
| 2 | [`defines/IStagePhaseInfo.ts`](./reports/defines/IStagePhaseInfo.md) | 166 | 常量/静态数据 |  |
| 2 | [`ui/utils/color_map.ts`](./reports/ui/utils/color_map.md) | 160 | 常量/静态数据 |  |
| 2 | [`dat_translator/frame_behavior/make_fb_firzen_volcano_start.ts`](./reports/dat_translator/frame_behavior/make_fb_firzen_volcano_start.md) | 153 | 纯函数工具 |  |
| 2 | [`defines/IArmorInfo.ts`](./reports/defines/IArmorInfo.md) | 142 | 纯函数工具 |  |
| 2 | [`defines/ItrEffect.ts`](./reports/defines/ItrEffect.md) | 141 | 纯函数工具 |  |
| 2 | [`dat_translator/make_bg_data.ts`](./reports/dat_translator/make_bg_data.md) | 137 | 纯函数工具 |  |
| 2 | [`ui/component/Alignment.ts`](./reports/ui/component/Alignment.md) | 130 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/xml/xml_x_frame.ts`](./reports/dat_translator/xml/xml_x_frame.md) | 128 | 纯函数工具 |  |
| 2 | [`controller/BallController.ts`](./reports/controller/BallController.md) | 123 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/parase_indexes.ts`](./reports/dat_translator/parase_indexes.md) | 121 | 纯函数工具 |  |
| 2 | [`dat_translator/make_weapon_data.ts`](./reports/dat_translator/make_weapon_data.md) | 118 | 纯函数工具 |  |
| 2 | [`defines/IBdyInfo.ts`](./reports/defines/IBdyInfo.md) | 113 | 纯函数工具 |  |
| 2 | [`dat_translator/make_frame_state.ts`](./reports/dat_translator/make_frame_state.md) | 112 | 纯函数工具 |  |
| 2 | [`dat_translator/xml/xml_x_opoint.ts`](./reports/dat_translator/xml/xml_x_opoint.md) | 105 | 纯函数工具 |  |
| 2 | [`dat_translator/bots/make_bot_data_deep.ts`](./reports/dat_translator/bots/make_bot_data_deep.md) | 102 | 纯函数工具 |  |
| 2 | [`ui/utils/read_nums.ts`](./reports/ui/utils/read_nums.md) | 99 | 纯函数工具 |  |
| 2 | [`dat_translator/bots/make_bot_data_dennis.ts`](./reports/dat_translator/bots/make_bot_data_dennis.md) | 98 | 纯函数工具 |  |
| 2 | [`dat_translator/bots/make_bot_data_davis.ts`](./reports/dat_translator/bots/make_bot_data_davis.md) | 95 | 纯函数工具 |  |
| 2 | [`controller/KeyStatus.ts`](./reports/controller/KeyStatus.md) | 92 | 类+函数+数据混合 |  |
| 2 | [`utils/Times.ts`](./reports/utils/Times.md) | 90 | 类+函数+数据混合 |  |
| 2 | [`defines/IBgLayerInfo.ts`](./reports/defines/IBgLayerInfo.md) | 88 | 纯函数工具 |  |
| 2 | [`dat_translator/bots/make_bot_data_firen.ts`](./reports/dat_translator/bots/make_bot_data_firen.md) | 87 | 纯函数工具 |  |
| 2 | [`ui/component/_.ts`](./reports/ui/component/_.md) | 87 | 纯函数工具 |  |
| 2 | [`dat_translator/float_scaling_entity.ts`](./reports/dat_translator/float_scaling_entity.md) | 83 | 纯函数工具 |  |
| 2 | [`bg/Background.ts`](./reports/bg/Background.md) | 77 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Dialogs.ts`](./reports/ui/component/Dialogs.md) | 77 | 类+函数+数据混合 |  |
| 2 | [`ui/component/EndingPageLogic.ts`](./reports/ui/component/EndingPageLogic.md) | 77 | 类+函数+数据混合 |  |
| 2 | [`state/StateBase_Proxy.ts`](./reports/state/StateBase_Proxy.md) | 76 | 类实现 |  |
| 2 | [`dat_translator/xml/xml_to_stage_phase_info.ts`](./reports/dat_translator/xml/xml_to_stage_phase_info.md) | 75 | 纯函数工具 |  |
| 2 | [`ui/component/Sounds.ts`](./reports/ui/component/Sounds.md) | 75 | 类+函数+数据混合 |  |
| 2 | [`collision/handle_fall.ts`](./reports/collision/handle_fall.md) | 73 | 纯函数工具 |  |
| 2 | [`state/State_Base.ts`](./reports/state/State_Base.md) | 73 | 类+函数+数据混合 |  |
| 2 | [`defines/BdyKind.ts`](./reports/defines/BdyKind.md) | 71 | 纯函数工具 |  |
| 2 | [`ui/component/PlayerKeyEdit.ts`](./reports/ui/component/PlayerKeyEdit.md) | 71 | 类+函数+数据混合 |  |
| 2 | [`loader/get_import_fallbacks.ts`](./reports/loader/get_import_fallbacks.md) | 64 | 纯函数工具 |  |
| 2 | [`ui/utils/parse_rgba.ts`](./reports/ui/utils/parse_rgba.md) | 63 | 纯函数工具 |  |
| 2 | [`collision/handle_ball_frozen.ts`](./reports/collision/handle_ball_frozen.md) | 62 | 纯函数工具 |  |
| 2 | [`dat_translator/xml/xml_x_itr.ts`](./reports/dat_translator/xml/xml_x_itr.md) | 62 | 纯函数工具 |  |
| 2 | [`dat_translator/bots/make_bot_data_rudolf.ts`](./reports/dat_translator/bots/make_bot_data_rudolf.md) | 60 | 纯函数工具 |  |
| 2 | [`dat_translator/bots/make_bot_data_mark.ts`](./reports/dat_translator/bots/make_bot_data_mark.md) | 59 | 纯函数工具 |  |
| 2 | [`dat_translator/make_ball_data.ts`](./reports/dat_translator/make_ball_data.md) | 59 | 纯函数工具 |  |
| 2 | [`ui/component/Tests/Louis/LOUIS_JUMP_ATTACK.ts`](./reports/ui/component/Tests/Louis/LOUIS_JUMP_ATTACK.md) | 59 | 类+函数+数据混合 |  |
| 2 | [`defines/IChaseInfo.ts`](./reports/defines/IChaseInfo.md) | 58 | 纯函数工具 |  |
| 2 | [`dat_translator/fighters/make_fighter_data_louis.ts`](./reports/dat_translator/fighters/make_fighter_data_louis.md) | 57 | 纯函数工具 |  |
| 2 | [`dat_translator/xml/xml_x_next_frame.ts`](./reports/dat_translator/xml/xml_x_next_frame.md) | 56 | 纯函数工具 |  |
| 2 | [`controller/DoubleClick.ts`](./reports/controller/DoubleClick.md) | 55 | 类实现 |  |
| 2 | [`controller/SeqKeys.ts`](./reports/controller/SeqKeys.md) | 55 | 类+函数+数据混合 |  |
| 2 | [`bot/state/BotState_Following.ts`](./reports/bot/state/BotState_Following.md) | 52 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/take.ts`](./reports/dat_translator/take.md) | 52 | 纯函数工具 |  |
| 2 | [`animation/Easing.ts`](./reports/animation/Easing.md) | 51 | 类+函数+数据混合 |  |
| 2 | [`buff/Buff_MagicFlute.ts`](./reports/buff/Buff_MagicFlute.md) | 51 | 类+函数+数据混合 |  |
| 2 | [`buff/Buff_MagicFlute2.ts`](./reports/buff/Buff_MagicFlute2.md) | 51 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/frame_behavior/make_fb_jan_angle_blessing.ts`](./reports/dat_translator/frame_behavior/make_fb_jan_angle_blessing.md) | 51 | 纯函数工具 |  |
| 2 | [`state/CharacterState_Burning.ts`](./reports/state/CharacterState_Burning.md) | 50 | 类+函数+数据混合 |  |
| 2 | [`loader/get_val_from_bot_ctrl.ts`](./reports/loader/get_val_from_bot_ctrl.md) | 49 | 纯函数工具 |  |
| 2 | [`ui/component/FighterName.ts`](./reports/ui/component/FighterName.md) | 49 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PlayerName.ts`](./reports/ui/component/PlayerName.md) | 49 | 类+函数+数据混合 |  |
| 2 | [`defines/IWpointInfo.ts`](./reports/defines/IWpointInfo.md) | 48 | 纯函数工具 |  |
| 2 | [`ui/component/PlayerTeamName.ts`](./reports/ui/component/PlayerTeamName.md) | 48 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/cook_file_variants.ts`](./reports/dat_translator/cook_file_variants.md) | 47 | 纯函数工具 |  |
| 2 | [`helper/EntitiesHelper.ts`](./reports/helper/EntitiesHelper.md) | 47 | 类+函数+数据混合 |  |
| 2 | [`ui/component/LoadingContentText.ts`](./reports/ui/component/LoadingContentText.md) | 47 | 类+函数+数据混合 |  |
| 2 | [`ui/component/StageDialogListener.ts`](./reports/ui/component/StageDialogListener.md) | 47 | 类+函数+数据混合 |  |
| 2 | [`ui/component/StageTitleShow.ts`](./reports/ui/component/StageTitleShow.md) | 45 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Freeze/Freeze_DUJ.ts`](./reports/ui/component/Tests/Freeze/Freeze_DUJ.md) | 45 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Julian/Julian_DUJ.ts`](./reports/ui/component/Tests/Julian/Julian_DUJ.md) | 45 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Others/MoveStayCome.ts`](./reports/ui/component/Tests/Others/MoveStayCome.md) | 44 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Firezen/Firzen_FUSION.ts`](./reports/ui/component/Tests/Firezen/Firzen_FUSION.md) | 43 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Julian/Julian_DFA.ts`](./reports/ui/component/Tests/Julian/Julian_DFA.md) | 43 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Julian/Julian_DFJ.ts`](./reports/ui/component/Tests/Julian/Julian_DFJ.md) | 43 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Others/Come.ts`](./reports/ui/component/Tests/Others/Come.md) | 43 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Firen/Firen_DFJ.ts`](./reports/ui/component/Tests/Firen/Firen_DFJ.md) | 42 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Freeze/Freeze_DFA.ts`](./reports/ui/component/Tests/Freeze/Freeze_DFA.md) | 42 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Freeze/Freeze_DFJ.ts`](./reports/ui/component/Tests/Freeze/Freeze_DFJ.md) | 42 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Others/AllFighters.ts`](./reports/ui/component/Tests/Others/AllFighters.md) | 42 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Others/Follow.ts`](./reports/ui/component/Tests/Others/Follow.md) | 42 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/EditBdy.ts`](./reports/dat_translator/EditBdy.md) | 41 | 类+函数+数据混合 |  |
| 2 | [`ui/component/CharMenu/CharMenuState_PlayerSel.ts`](./reports/ui/component/CharMenu/CharMenuState_PlayerSel.md) | 41 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Others/FasterSlowerStandUp.ts`](./reports/ui/component/Tests/Others/FasterSlowerStandUp.md) | 41 | 类+函数+数据混合 |  |
| 2 | [`ui/component/WrapContent.ts`](./reports/ui/component/WrapContent.md) | 41 | 类+函数+数据混合 |  |
| 2 | [`ditto/image/ImageInfo.ts`](./reports/ditto/image/ImageInfo.md) | 40 | 类实现 |  |
| 2 | [`ui/component/SmoothNumber.ts`](./reports/ui/component/SmoothNumber.md) | 40 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PlayerScorePlayerName.ts`](./reports/ui/component/PlayerScorePlayerName.md) | 39 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Firen/Firen_DUJ.ts`](./reports/ui/component/Tests/Firen/Firen_DUJ.md) | 38 | 类+函数+数据混合 |  |
| 2 | [`utils/container_help/list_fn.ts`](./reports/utils/container_help/list_fn.md) | 38 | 纯函数工具 |  |
| 2 | [`helper/CharactersHelper.ts`](./reports/helper/CharactersHelper.md) | 37 | 类+函数+数据混合 |  |
| 2 | [`ui/component/CharMenu/CharMenuState_CountingDown.ts`](./reports/ui/component/CharMenu/CharMenuState_CountingDown.md) | 37 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Rudolf/Rudolf_DFJ.ts`](./reports/ui/component/Tests/Rudolf/Rudolf_DFJ.md) | 37 | 类+函数+数据混合 |  |
| 2 | [`ui/component/VerticalLayout.ts`](./reports/ui/component/VerticalLayout.md) | 37 | 类+函数+数据混合 |  |
| 2 | [`stage/Expressions.ts`](./reports/stage/Expressions.md) | 36 | 类+函数+数据混合 |  |
| 2 | [`loader/get_val_getter_from_stage.ts`](./reports/loader/get_val_getter_from_stage.md) | 35 | 纯函数工具 |  |
| 2 | [`state/CharacterState_Teleport2NearestEnemy.ts`](./reports/state/CharacterState_Teleport2NearestEnemy.md) | 35 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PrefixAndDifficultyText.ts`](./reports/ui/component/PrefixAndDifficultyText.md) | 35 | 类实现 |  |
| 2 | [`ui/component/Tests/Firen/Firen_DFA.ts`](./reports/ui/component/Tests/Firen/Firen_DFA.md) | 35 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Firen/Firen_DVJ.ts`](./reports/ui/component/Tests/Firen/Firen_DVJ.md) | 35 | 类+函数+数据混合 |  |
| 2 | [`ui/component/FadeOutOpacity.ts`](./reports/ui/component/FadeOutOpacity.md) | 34 | 类实现 |  |
| 2 | [`ui/component/FitChildren.ts`](./reports/ui/component/FitChildren.md) | 34 | 类+函数+数据混合 |  |
| 2 | [`ui/component/FighterHead.ts`](./reports/ui/component/FighterHead.md) | 33 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Freeze/Freeze_DVJ.ts`](./reports/ui/component/Tests/Freeze/Freeze_DVJ.md) | 33 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Others/BottomsUp.ts`](./reports/ui/component/Tests/Others/BottomsUp.md) | 33 | 类+函数+数据混合 |  |
| 2 | [`ui/component/FocusBehavior.ts`](./reports/ui/component/FocusBehavior.md) | 30 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Picture.ts`](./reports/ui/component/Picture.md) | 30 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PlayerScore.ts`](./reports/ui/component/PlayerScore.md) | 30 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PlayerNameInput.ts`](./reports/ui/component/PlayerNameInput.md) | 29 | 类实现 |  |
| 2 | [`ui/component/HoverBehavior.ts`](./reports/ui/component/HoverBehavior.md) | 28 | 类+函数+数据混合 |  |
| 2 | [`Cases.ts`](./reports/Cases.md) | 27 | 类+函数+数据混合 |  |
| 2 | [`helper/UIHelper.ts`](./reports/helper/UIHelper.md) | 27 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PlayerKeyText.ts`](./reports/ui/component/PlayerKeyText.md) | 27 | 类+函数+数据混合 |  |
| 2 | [`ui/component/PlayingTimeText.ts`](./reports/ui/component/PlayingTimeText.md) | 25 | 类+函数+数据混合 |  |
| 2 | [`ui/component/HorizontalLayout.ts`](./reports/ui/component/HorizontalLayout.md) | 23 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Jan/Jan_DUJ.ts`](./reports/ui/component/Tests/Jan/Jan_DUJ.md) | 23 | 类+函数+数据混合 |  |
| 2 | [`base/dedup.ts`](./reports/base/dedup.md) | 22 | 纯函数工具 |  |
| 2 | [`ui/component/Label.ts`](./reports/ui/component/Label.md) | 22 | 类实现 |  |
| 2 | [`ui/component/Players.ts`](./reports/ui/component/Players.md) | 22 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Tests/Jan/Jan_DUA.ts`](./reports/ui/component/Tests/Jan/Jan_DUA.md) | 22 | 类+函数+数据混合 |  |
| 2 | [`ui/component/UIComponentExpressionBuilder.ts`](./reports/ui/component/UIComponentExpressionBuilder.md) | 22 | 类实现 |  |
| 2 | [`ui/component/CharMenu/SlotState.ts`](./reports/ui/component/CharMenu/SlotState.md) | 19 | 类实现 |  |
| 2 | [`ditto/image/TextInfo.ts`](./reports/ditto/image/TextInfo.md) | 18 | 类实现 |  |
| 2 | [`ui/component/FlexItem.ts`](./reports/ui/component/FlexItem.md) | 18 | 类实现 |  |
| 2 | [`base/Callbacks.ts`](./reports/base/Callbacks.md) | 17 | 类+函数+数据混合 |  |
| 2 | [`ui/component/Reachable.ts`](./reports/ui/component/Reachable.md) | 17 | 类+函数+数据混合 |  |
| 2 | [`dat_translator/decode_lf2_dat.ts`](./reports/dat_translator/decode_lf2_dat.md) | 15 | 纯函数工具 |  |
| 2 | [`ditto/importer/ImportError.ts`](./reports/ditto/importer/ImportError.md) | 11 | 类+函数+数据混合 |  |
| 2 | [`animation/Sine.ts`](./reports/animation/Sine.md) | 9 | 类+函数+数据混合 |  |
| 1.5 | [`defines/FrameBehavior.ts`](./reports/defines/FrameBehavior.md) | 212 | 常量/静态数据 |  |
| 1.5 | [`entity/IEntityCallbacks.ts`](./reports/entity/IEntityCallbacks.md) | 159 | 纯类型声明 (interface/type) |  |
| 1.5 | [`defines/FacingFlag.ts`](./reports/defines/FacingFlag.md) | 154 | 常量/静态数据 |  |
| 1.5 | [`bot/DummyEnum.ts`](./reports/bot/DummyEnum.md) | 142 | 纯函数工具 |  |
| 1.5 | [`dat_translator/hit_next_frame.ts`](./reports/dat_translator/hit_next_frame.md) | 128 | 纯函数工具 |  |
| 1.5 | [`dat_translator/cook_frame_indicator_info.ts`](./reports/dat_translator/cook_frame_indicator_info.md) | 121 | 纯函数工具 |  |
| 1.5 | [`defines/IStageInfo.ts`](./reports/defines/IStageInfo.md) | 116 | 常量/静态数据 |  |
| 1.5 | [`defines/IDrinkInfo.ts`](./reports/defines/IDrinkInfo.md) | 113 | 纯函数工具 |  |
| 1.5 | [`dat_translator/make_fighter_special.ts`](./reports/dat_translator/make_fighter_special.md) | 110 | 纯函数工具 |  |
| 1.5 | [`defines/INextFrame.ts`](./reports/defines/INextFrame.md) | 100 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_x_frame_indexes.ts`](./reports/dat_translator/xml/xml_x_frame_indexes.md) | 96 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_woody.ts`](./reports/dat_translator/bots/make_bot_data_woody.md) | 87 | 纯函数工具 |  |
| 1.5 | [`collision/handle_itr_normal_bdy_normal.ts`](./reports/collision/handle_itr_normal_bdy_normal.md) | 86 | 纯函数工具 |  |
| 1.5 | [`state/ENTITY_STATES.ts`](./reports/state/ENTITY_STATES.md) | 85 | 纯函数工具 |  |
| 1.5 | [`utils/utf8.ts`](./reports/utils/utf8.md) | 81 | 纯函数工具 |  |
| 1.5 | [`ui/IUIInfo.dat.ts`](./reports/ui/IUIInfo.dat.md) | 80 | 纯类型声明 (interface/type) |  |
| 1.5 | [`state/spawn_ice_piece.ts`](./reports/state/spawn_ice_piece.md) | 77 | 纯函数工具 |  |
| 1.5 | [`dat_translator/cook_opoint.ts`](./reports/dat_translator/cook_opoint.md) | 76 | 纯函数工具 |  |
| 1.5 | [`defines/ITerrainInfo.ts`](./reports/defines/ITerrainInfo.md) | 76 | 纯函数工具 |  |
| 1.5 | [`defines/IFrameIndexes.ts`](./reports/defines/IFrameIndexes.md) | 73 | 纯函数工具 |  |
| 1.5 | [`defines/IFramePic.ts`](./reports/defines/IFramePic.md) | 73 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_from_stage_phase_info.ts`](./reports/dat_translator/xml/xml_from_stage_phase_info.md) | 72 | 纯函数工具 |  |
| 1.5 | [`dat_translator/cook_ball_frame_state_3006.ts`](./reports/dat_translator/cook_ball_frame_state_3006.md) | 70 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_from_bg_data.ts`](./reports/dat_translator/xml/xml_from_bg_data.md) | 70 | 纯函数工具 |  |
| 1.5 | [`dat_translator/make_frame_behavior.ts`](./reports/dat_translator/make_frame_behavior.md) | 68 | 纯函数工具 |  |
| 1.5 | [`ditto/cache/ICacheData.ts`](./reports/ditto/cache/ICacheData.md) | 68 | 纯类型声明 (interface/type) |  |
| 1.5 | [`collision/handle_armor.ts`](./reports/collision/handle_armor.md) | 67 | 纯函数工具 |  |
| 1.5 | [`defines/ICpointInfo.ts`](./reports/defines/ICpointInfo.md) | 67 | 纯函数工具 |  |
| 1.5 | [`collision/is_armor_work.ts`](./reports/collision/is_armor_work.md) | 66 | 纯函数工具 |  |
| 1.5 | [`collision/handle_itr_normal_bdy_defend.ts`](./reports/collision/handle_itr_normal_bdy_defend.md) | 64 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_julian.ts`](./reports/dat_translator/bots/make_bot_data_julian.md) | 64 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_john.ts`](./reports/dat_translator/bots/make_bot_data_john.md) | 63 | 纯函数工具 |  |
| 1.5 | [`loader/preprocess_ball_frame.ts`](./reports/loader/preprocess_ball_frame.md) | 62 | 纯函数工具 |  |
| 1.5 | [`collision/handle_weapon_is_hit.ts`](./reports/collision/handle_weapon_is_hit.md) | 60 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_from_data_lists.ts`](./reports/dat_translator/xml/xml_from_data_lists.md) | 55 | 纯函数工具 |  |
| 1.5 | [`entity/calc_v.ts`](./reports/entity/calc_v.md) | 55 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_to_velocity_info.ts`](./reports/dat_translator/xml/xml_to_velocity_info.md) | 54 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_freeze.ts`](./reports/dat_translator/bots/make_bot_data_freeze.md) | 52 | 纯函数工具 |  |
| 1.5 | [`dat_translator/cook_bdy.ts`](./reports/dat_translator/cook_bdy.md) | 52 | 纯函数工具 |  |
| 1.5 | [`dat_translator/get_the_next.ts`](./reports/dat_translator/get_the_next.md) | 52 | 纯函数工具 |  |
| 1.5 | [`defines/IPictureInfo.ts`](./reports/defines/IPictureInfo.md) | 52 | 纯函数工具 |  |
| 1.5 | [`controller/ControllerDoubleClicks.ts`](./reports/controller/ControllerDoubleClicks.md) | 49 | 类实现 |  |
| 1.5 | [`dat_translator/fighters/make_fighter_data_freeze.ts`](./reports/dat_translator/fighters/make_fighter_data_freeze.md) | 49 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Jump.ts`](./reports/state/CharacterState_Jump.md) | 49 | 类+函数+数据混合 |  |
| 1.5 | [`defines/IBgData.ts`](./reports/defines/IBgData.md) | 48 | 纯函数工具 |  |
| 1.5 | [`state/WeaponState_InTheSky.ts`](./reports/state/WeaponState_InTheSky.md) | 48 | 类+函数+数据混合 |  |
| 1.5 | [`ui/component/SettingsLogic.ts`](./reports/ui/component/SettingsLogic.md) | 48 | 类+函数+数据混合 |  |
| 1.5 | [`bot/state/BotState_StageEnd.ts`](./reports/bot/state/BotState_StageEnd.md) | 47 | 类+函数+数据混合 |  |
| 1.5 | [`base/IActionHandler.ts`](./reports/base/IActionHandler.md) | 46 | 纯函数工具 |  |
| 1.5 | [`ditto/zip/IZipObject.ts`](./reports/ditto/zip/IZipObject.md) | 46 | 纯类型声明 (interface/type) |  |
| 1.5 | [`loader/preprocess_bg_data.ts`](./reports/loader/preprocess_bg_data.md) | 46 | 纯函数工具 |  |
| 1.5 | [`animation/Periodic.ts`](./reports/animation/Periodic.md) | 44 | 类实现 |  |
| 1.5 | [`controller/ControllerKeyStatus.ts`](./reports/controller/ControllerKeyStatus.md) | 44 | 类实现 |  |
| 1.5 | [`utils/list_writable_properties.ts`](./reports/utils/list_writable_properties.md) | 44 | 纯函数工具 |  |
| 1.5 | [`animation/Loop.ts`](./reports/animation/Loop.md) | 43 | 类实现 |  |
| 1.5 | [`utils/type_check/is_num.ts`](./reports/utils/type_check/is_num.md) | 43 | 纯函数工具 |  |
| 1.5 | [`ui/component/PlayerCtrlType.ts`](./reports/ui/component/PlayerCtrlType.md) | 42 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/cook_itr.ts`](./reports/dat_translator/cook_itr.md) | 41 | 纯函数工具 |  |
| 1.5 | [`utils/schema/make_schema.ts`](./reports/utils/schema/make_schema.md) | 41 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_firzen.ts`](./reports/dat_translator/bots/make_bot_data_firzen.md) | 40 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_jack.ts`](./reports/dat_translator/bots/make_bot_data_jack.md) | 40 | 纯函数工具 |  |
| 1.5 | [`loader/check_frame.ts`](./reports/loader/check_frame.md) | 40 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Drink.ts`](./reports/state/CharacterState_Drink.md) | 40 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/bots/bot_front_test.ts`](./reports/dat_translator/bots/bot_front_test.md) | 39 | 纯函数工具 |  |
| 1.5 | [`utils/string_parser/match_all.ts`](./reports/utils/string_parser/match_all.md) | 39 | 纯函数工具 |  |
| 1.5 | [`utils/string_parser/match_block.ts`](./reports/utils/string_parser/match_block.md) | 39 | 纯函数工具 |  |
| 1.5 | [`dat_translator/frame_behavior/make_fb_chasing_same_enemy.ts`](./reports/dat_translator/frame_behavior/make_fb_chasing_same_enemy.md) | 38 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_x_cpoint.ts`](./reports/dat_translator/xml/xml_x_cpoint.md) | 38 | 纯函数工具 |  |
| 1.5 | [`state/State_Frozen.ts`](./reports/state/State_Frozen.md) | 38 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_louisex.ts`](./reports/dat_translator/bots/make_bot_data_louisex.md) | 37 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Teleport2FarthestAlly.ts`](./reports/state/CharacterState_Teleport2FarthestAlly.md) | 36 | 类+函数+数据混合 |  |
| 1.5 | [`ui/ui_load_img.ts`](./reports/ui/ui_load_img.md) | 36 | 纯函数工具 |  |
| 1.5 | [`utils/container_help/fisrt.ts`](./reports/utils/container_help/fisrt.md) | 36 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_justin.ts`](./reports/dat_translator/bots/make_bot_data_justin.md) | 35 | 纯函数工具 |  |
| 1.5 | [`dat_translator/fighters/make_fighter_data_firen.ts`](./reports/dat_translator/fighters/make_fighter_data_firen.md) | 35 | 纯函数工具 |  |
| 1.5 | [`ui/CrossInfo.ts`](./reports/ui/CrossInfo.md) | 35 | 类实现 |  |
| 1.5 | [`base/Debugging.ts`](./reports/base/Debugging.md) | 34 | 纯函数工具 |  |
| 1.5 | [`dat_translator/fighters/make_fighter_data_louisex.ts`](./reports/dat_translator/fighters/make_fighter_data_louisex.md) | 34 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Rowing.ts`](./reports/state/CharacterState_Rowing.md) | 34 | 类+函数+数据混合 |  |
| 1.5 | [`utils/container_help/traversal.ts`](./reports/utils/container_help/traversal.md) | 34 | 纯函数工具 |  |
| 1.5 | [`dat_translator/make_itr_prefabs.ts`](./reports/dat_translator/make_itr_prefabs.md) | 33 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_x_map.ts`](./reports/dat_translator/xml/xml_x_map.md) | 33 | 纯函数工具 |  |
| 1.5 | [`loader/preprocess_action.ts`](./reports/loader/preprocess_action.md) | 33 | 纯函数工具 |  |
| 1.5 | [`ui/component/FighterThumb.ts`](./reports/ui/component/FighterThumb.md) | 33 | 类实现 |  |
| 1.5 | [`dat_translator/bots/make_bot_data_monk.ts`](./reports/dat_translator/bots/make_bot_data_monk.md) | 32 | 纯函数工具 |  |
| 1.5 | [`utils/string_parser/take_blocks.ts`](./reports/utils/string_parser/take_blocks.md) | 32 | 纯函数工具 |  |
| 1.5 | [`dat_translator/frame_behavior/make_fb_firzen_disater_start.ts`](./reports/dat_translator/frame_behavior/make_fb_firzen_disater_start.md) | 31 | 纯函数工具 |  |
| 1.5 | [`ui/component/ScaleClickable.ts`](./reports/ui/component/ScaleClickable.md) | 31 | 类+函数+数据混合 |  |
| 1.5 | [`loader/preprocess_bot_data.ts`](./reports/loader/preprocess_bot_data.md) | 30 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Walking.ts`](./reports/state/CharacterState_Walking.md) | 30 | 类+函数+数据混合 |  |
| 1.5 | [`utils/make_private_properties.ts`](./reports/utils/make_private_properties.md) | 30 | 纯函数工具 |  |
| 1.5 | [`dat_translator/broken_piece_frames.ts`](./reports/dat_translator/broken_piece_frames.md) | 29 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_to_world_dataset.ts`](./reports/dat_translator/xml/xml_to_world_dataset.md) | 29 | 纯函数工具 |  |
| 1.5 | [`ditto/ITimeout.ts`](./reports/ditto/ITimeout.md) | 29 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Dash.ts`](./reports/state/CharacterState_Dash.md) | 29 | 类+函数+数据混合 |  |
| 1.5 | [`Keys.ts`](./reports/Keys.md) | 28 | 类实现 |  |
| 1.5 | [`bg/Layer.ts`](./reports/bg/Layer.md) | 28 | 类+函数+数据混合 |  |
| 1.5 | [`state/WeaponState_Throwing.ts`](./reports/state/WeaponState_Throwing.md) | 28 | 类+函数+数据混合 |  |
| 1.5 | [`ui/component/ExtraZipText.ts`](./reports/ui/component/ExtraZipText.md) | 28 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/fighters/make_fighter_data_julian.ts`](./reports/dat_translator/fighters/make_fighter_data_julian.md) | 27 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_x_non_empty.ts`](./reports/dat_translator/xml/xml_x_non_empty.md) | 27 | 纯函数工具 |  |
| 1.5 | [`ui/utils/parse_call_func_expression.ts`](./reports/ui/utils/parse_call_func_expression.md) | 27 | 纯函数工具 |  |
| 1.5 | [`utils/string_parser/take_sections.ts`](./reports/utils/string_parser/take_sections.md) | 27 | 纯函数工具 |  |
| 1.5 | [`dat_translator/cook_next_frame_cost.ts`](./reports/dat_translator/cook_next_frame_cost.md) | 26 | 纯函数工具 |  |
| 1.5 | [`dat_translator/frame_behavior/make_fb_bat_chase_start.ts`](./reports/dat_translator/frame_behavior/make_fb_bat_chase_start.md) | 26 | 纯函数工具 |  |
| 1.5 | [`dat_translator/take_not_zero_num.ts`](./reports/dat_translator/take_not_zero_num.md) | 26 | 纯函数工具 |  |
| 1.5 | [`ui/component/OpacityHover.ts`](./reports/ui/component/OpacityHover.md) | 26 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/edit_next_frame.ts`](./reports/dat_translator/edit_next_frame.md) | 25 | 纯函数工具 |  |
| 1.5 | [`dat_translator/frame_behavior/make_fb_jan_chase_start.ts`](./reports/dat_translator/frame_behavior/make_fb_jan_chase_start.md) | 25 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/merge_by_tag.ts`](./reports/dat_translator/xml/merge_by_tag.md) | 25 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Running.ts`](./reports/state/CharacterState_Running.md) | 25 | 类+函数+数据混合 |  |
| 1.5 | [`ditto/importer/IImporter.ts`](./reports/ditto/importer/IImporter.md) | 24 | 纯类型声明 (interface/type) |  |
| 1.5 | [`ui/component/ComponentFSMState.ts`](./reports/ui/component/ComponentFSMState.md) | 23 | 类实现 |  |
| 1.5 | [`ui/component/SineOpacity.ts`](./reports/ui/component/SineOpacity.md) | 23 | 类实现 |  |
| 1.5 | [`bot/state/closest.ts`](./reports/bot/state/closest.md) | 22 | 纯函数工具 |  |
| 1.5 | [`buff/Buff_Electroshock.ts`](./reports/buff/Buff_Electroshock.md) | 22 | 类实现 |  |
| 1.5 | [`dat_translator/find_float.ts`](./reports/dat_translator/find_float.md) | 22 | 纯函数工具 |  |
| 1.5 | [`defines/WpointKind.ts`](./reports/defines/WpointKind.md) | 22 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Caught.ts`](./reports/state/CharacterState_Caught.md) | 22 | 类+函数+数据混合 |  |
| 1.5 | [`types/globals.d.ts`](./reports/types/globals.d.md) | 22 | 纯函数工具 |  |
| 1.5 | [`ui/component/CharMenu/CharMenuState_Base.ts`](./reports/ui/component/CharMenu/CharMenuState_Base.md) | 22 | 类实现 |  |
| 1.5 | [`controller/ControllerUpdateResult.ts`](./reports/controller/ControllerUpdateResult.md) | 21 | 类实现 |  |
| 1.5 | [`ui/component/CharMenu/CharMenuState_GameSetting.ts`](./reports/ui/component/CharMenu/CharMenuState_GameSetting.md) | 21 | 类实现 |  |
| 1.5 | [`ui/component/FadeInOpacity.ts`](./reports/ui/component/FadeInOpacity.md) | 21 | 类实现 |  |
| 1.5 | [`base/Graves.ts`](./reports/base/Graves.md) | 20 | 类+函数+数据混合 |  |
| 1.5 | [`helper/BallsHelper.ts`](./reports/helper/BallsHelper.md) | 20 | 类+函数+数据混合 |  |
| 1.5 | [`loader/preprocess_next_frame.ts`](./reports/loader/preprocess_next_frame.md) | 20 | 纯函数工具 |  |
| 1.5 | [`ui/component/DifficultyText.ts`](./reports/ui/component/DifficultyText.md) | 20 | 类实现 |  |
| 1.5 | [`ui/component/HideWhenDialoging.ts`](./reports/ui/component/HideWhenDialoging.md) | 20 | 类+函数+数据混合 |  |
| 1.5 | [`bot/IBotTarget.ts`](./reports/bot/IBotTarget.md) | 19 | 类实现 |  |
| 1.5 | [`loader/preprocess_bdy.ts`](./reports/loader/preprocess_bdy.md) | 19 | 纯函数工具 |  |
| 1.5 | [`state/BallState_Base.ts`](./reports/state/BallState_Base.md) | 19 | 类实现 |  |
| 1.5 | [`loader/validate_ui_img_operation_crop.ts`](./reports/loader/validate_ui_img_operation_crop.md) | 18 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Injured.ts`](./reports/state/CharacterState_Injured.md) | 18 | 类+函数+数据混合 |  |
| 1.5 | [`state/CharacterState_Standing.ts`](./reports/state/CharacterState_Standing.md) | 18 | 类实现 |  |
| 1.5 | [`state/State_Burning.ts`](./reports/state/State_Burning.md) | 18 | 类实现 |  |
| 1.5 | [`state/State_TransformTo8XXX.ts`](./reports/state/State_TransformTo8XXX.md) | 18 | 类+函数+数据混合 |  |
| 1.5 | [`ui/LF2KeyEvent.ts`](./reports/ui/LF2KeyEvent.md) | 18 | 类实现 |  |
| 1.5 | [`dat_translator/take_num.ts`](./reports/dat_translator/take_num.md) | 17 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_from_world_dataset.ts`](./reports/dat_translator/xml/xml_from_world_dataset.md) | 17 | 纯函数工具 |  |
| 1.5 | [`loader/check_stage_info.ts`](./reports/loader/check_stage_info.md) | 17 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/xml_from_key_collection.ts`](./reports/dat_translator/xml/xml_from_key_collection.md) | 16 | 纯函数工具 |  |
| 1.5 | [`state/CharacterState_Transform2LouisEX.ts`](./reports/state/CharacterState_Transform2LouisEX.md) | 16 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/xml/xml_to_key_collection.ts`](./reports/dat_translator/xml/xml_to_key_collection.md) | 15 | 纯函数工具 |  |
| 1.5 | [`ui/LF2PointerEvent.ts`](./reports/ui/LF2PointerEvent.md) | 15 | 类实现 |  |
| 1.5 | [`ui/component/PauseHandling.ts`](./reports/ui/component/PauseHandling.md) | 15 | 类+函数+数据混合 |  |
| 1.5 | [`ui/component/StageTransitions.ts`](./reports/ui/component/StageTransitions.md) | 15 | 类实现 |  |
| 1.5 | [`ui/component/TextInput.ts`](./reports/ui/component/TextInput.md) | 15 | 类实现 |  |
| 1.5 | [`bot/state/BotState_Dead.ts`](./reports/bot/state/BotState_Dead.md) | 14 | 类实现 |  |
| 1.5 | [`controller/LocalController.ts`](./reports/controller/LocalController.md) | 14 | 类实现 |  |
| 1.5 | [`loader/preprocess_stage_phase.ts`](./reports/loader/preprocess_stage_phase.md) | 14 | 纯函数工具 |  |
| 1.5 | [`state/State_TransformToCatching.ts`](./reports/state/State_TransformToCatching.md) | 14 | 类实现 |  |
| 1.5 | [`state/State_WeaponBroken.ts`](./reports/state/State_WeaponBroken.md) | 14 | 类实现 |  |
| 1.5 | [`ui/utils/read_func_args.ts`](./reports/ui/utils/read_func_args.md) | 14 | 纯函数工具 |  |
| 1.5 | [`dat_translator/take_positive_num.ts`](./reports/dat_translator/take_positive_num.md) | 13 | 纯函数工具 |  |
| 1.5 | [`ditto/fullscreen/IFullScreen.ts`](./reports/ditto/fullscreen/IFullScreen.md) | 13 | 纯类型声明 (interface/type) |  |
| 1.5 | [`state/WeaponState_OnGround.ts`](./reports/state/WeaponState_OnGround.md) | 13 | 类实现 |  |
| 1.5 | [`ui/LFWUIEvent.ts`](./reports/ui/LFWUIEvent.md) | 13 | 类实现 |  |
| 1.5 | [`ui/component/FlexAlign.ts`](./reports/ui/component/FlexAlign.md) | 13 | 纯函数工具 |  |
| 1.5 | [`dat_translator/bots/frames.ts`](./reports/dat_translator/bots/frames.md) | 12 | 纯函数工具 |  |
| 1.5 | [`dat_translator/float_scaling_itr.ts`](./reports/dat_translator/float_scaling_itr.md) | 12 | 纯函数工具 |  |
| 1.5 | [`ui/utils/validate_ui_img_info.ts`](./reports/ui/utils/validate_ui_img_info.md) | 12 | 纯函数工具 |  |
| 1.5 | [`dat_translator/float_scaling_qube.ts`](./reports/dat_translator/float_scaling_qube.md) | 11 | 纯函数工具 |  |
| 1.5 | [`state/WeaponState_OnHand.ts`](./reports/state/WeaponState_OnHand.md) | 11 | 类实现 |  |
| 1.5 | [`animation/Delay.ts`](./reports/animation/Delay.md) | 10 | 类实现 |  |
| 1.5 | [`utils/container_help/loop_offset.ts`](./reports/utils/container_help/loop_offset.md) | 10 | 纯函数工具 |  |
| 1.5 | [`utils/container_help/set_obj_field.ts`](./reports/utils/container_help/set_obj_field.md) | 10 | 纯函数工具 |  |
| 1.5 | [`animation/Cosine.ts`](./reports/animation/Cosine.md) | 9 | 类+函数+数据混合 |  |
| 1.5 | [`dat_translator/copy_itr_info.ts`](./reports/dat_translator/copy_itr_info.md) | 9 | 纯函数工具 |  |
| 1.5 | [`dat_translator/edit_itr_info.ts`](./reports/dat_translator/edit_itr_info.md) | 9 | 纯函数工具 |  |
| 1.5 | [`dat_translator/xml/delete_undefined.ts`](./reports/dat_translator/xml/delete_undefined.md) | 9 | 纯函数工具 |  |
| 1.5 | [`utils/type_cast/to_num.ts`](./reports/utils/type_cast/to_num.md) | 9 | 纯函数工具 |  |
| 1.5 | [`dat_translator/copy_bdy_info.ts`](./reports/dat_translator/copy_bdy_info.md) | 8 | 纯函数工具 |  |
| 1.5 | [`dat_translator/edit_bdy_info.ts`](./reports/dat_translator/edit_bdy_info.md) | 8 | 纯函数工具 |  |
| 1.5 | [`state/State_15.ts`](./reports/state/State_15.md) | 8 | 类实现 |  |
| 1.5 | [`utils/container_help/take_number.ts`](./reports/utils/container_help/take_number.md) | 8 | 纯函数工具 |  |
| 1.5 | [`animation/Tangent.ts`](./reports/animation/Tangent.md) | 7 | 类+函数+数据混合 |  |
| 1.5 | [`utils/container_help/assign.ts`](./reports/utils/container_help/assign.md) | 7 | 纯函数工具 |  |
| 1.5 | [`utils/string_parser/match_hash_end.ts`](./reports/utils/string_parser/match_hash_end.md) | 7 | 纯函数工具 |  |
| 1.5 | [`utils/array/map_arr.ts`](./reports/utils/array/map_arr.md) | 6 | 纯函数工具 |  |
| 1.5 | [`controller/InvalidController.ts`](./reports/controller/InvalidController.md) | 5 | 类实现 |  |
| 1.5 | [`utils/array/loop_arr.ts`](./reports/utils/array/loop_arr.md) | 5 | 纯函数工具 |  |
| 1.5 | [`utils/type_check/instance_of.ts`](./reports/utils/type_check/instance_of.md) | 5 | 纯函数工具 |  |
| 1.5 | [`utils/type_check/is_arr.ts`](./reports/utils/type_check/is_arr.md) | 4 | 纯函数工具 |  |
| 1 | [`defines/OID.ts`](./reports/defines/OID.md) | 150 | 常量/静态数据 |  |
| 1 | [`defines/EntityVal.ts`](./reports/defines/EntityVal.md) | 120 | 常量/静态数据 |  |
| 1 | [`ui/IUIImgInfo.dat.ts`](./reports/ui/IUIImgInfo.dat.md) | 119 | 常量/静态数据 |  |
| 1 | [`defines/EntityGroup.ts`](./reports/defines/EntityGroup.md) | 110 | 常量/静态数据 |  |
| 1 | [`defines/CollisionVal.ts`](./reports/defines/CollisionVal.md) | 109 | 常量/静态数据 |  |
| 1 | [`defines/index.ts`](./reports/defines/index.md) | 108 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IStageObjectInfo.ts`](./reports/defines/IStageObjectInfo.md) | 100 | 常量/静态数据 |  |
| 1 | [`entity/IEntitySnapshot.ts`](./reports/entity/IEntitySnapshot.md) | 94 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/index.ts`](./reports/ui/component/index.md) | 94 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/CMD.ts`](./reports/defines/CMD.md) | 78 | 常量/静态数据 |  |
| 1 | [`defines/IBotRay.ts`](./reports/defines/IBotRay.md) | 72 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IDialogInfo.ts`](./reports/defines/IDialogInfo.md) | 72 | 常量/静态数据 |  |
| 1 | [`defines/actions/ActionType.ts`](./reports/defines/actions/ActionType.md) | 71 | 常量/静态数据 |  |
| 1 | [`animation/IAnimation.ts`](./reports/animation/IAnimation.md) | 68 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/GameKey.ts`](./reports/defines/GameKey.md) | 66 | 常量/静态数据 |  |
| 1 | [`dat_translator/index.ts`](./reports/dat_translator/index.md) | 64 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IBotAction.ts`](./reports/defines/IBotAction.md) | 64 | 纯类型声明 (interface/type) |  |
| 1 | [`IWorldCallbacks.ts`](./reports/IWorldCallbacks.md) | 57 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IBotData.ts`](./reports/defines/IBotData.md) | 57 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IVector2.ts`](./reports/defines/IVector2.md) | 57 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/IImageInfo.ts`](./reports/ditto/image/IImageInfo.md) | 57 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IDatIndex.ts`](./reports/defines/IDatIndex.md) | 54 | 常量/静态数据 |  |
| 1 | [`defines/ILegacyPictureInfo.ts`](./reports/defines/ILegacyPictureInfo.md) | 50 | 常量/静态数据 |  |
| 1 | [`dat_translator/xml/xml_x_entity_data.ts`](./reports/dat_translator/xml/xml_x_entity_data.md) | 49 | 纯函数工具 |  |
| 1 | [`defines/EntityEnum.ts`](./reports/defines/EntityEnum.md) | 49 | 常量/静态数据 |  |
| 1 | [`defines/IHitKeyCollection.ts`](./reports/defines/IHitKeyCollection.md) | 49 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/WeaponType.ts`](./reports/defines/WeaponType.md) | 49 | 常量/静态数据 |  |
| 1 | [`dat_translator/xml/index.ts`](./reports/dat_translator/xml/index.md) | 48 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IEntityData.ts`](./reports/defines/IEntityData.md) | 48 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_explosion_dua.ts`](./reports/dat_translator/bots/bot_explosion_dua.md) | 47 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_uppercut_dva.ts`](./reports/dat_translator/bots/bot_uppercut_dva.md) | 46 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_armor_info.ts`](./reports/dat_translator/xml/xml_x_armor_info.md) | 46 | 纯函数工具 |  |
| 1 | [`defines/SpeedMode.ts`](./reports/defines/SpeedMode.md) | 46 | 常量/静态数据 |  |
| 1 | [`dat_translator/bots/bot_explosion_duj.ts`](./reports/dat_translator/bots/bot_explosion_duj.md) | 45 | 纯函数工具 |  |
| 1 | [`ILFWCallback.ts`](./reports/ILFWCallback.md) | 44 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/bots/make_bot_data_henry.ts`](./reports/dat_translator/bots/make_bot_data_henry.md) | 44 | 纯函数工具 |  |
| 1 | [`defines/ISchema.ts`](./reports/defines/ISchema.md) | 44 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IStyle.ts`](./reports/defines/IStyle.md) | 44 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_ball_hit_other.ts`](./reports/collision/handle_ball_hit_other.md) | 43 | 纯函数工具 |  |
| 1 | [`collision/handle_ball_is_hit.ts`](./reports/collision/handle_ball_is_hit.md) | 43 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_chasing_skill_action.ts`](./reports/dat_translator/bots/bot_chasing_skill_action.md) | 43 | 纯函数工具 |  |
| 1 | [`defines/actions/IAction_StealValue.ts`](./reports/defines/actions/IAction_StealValue.md) | 43 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/math/line_plane_intersection.ts`](./reports/utils/math/line_plane_intersection.md) | 42 | 纯函数工具 |  |
| 1 | [`collision/handle_itr_kind_whirlwind.ts`](./reports/collision/handle_itr_kind_whirlwind.md) | 41 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/index.ts`](./reports/dat_translator/bots/index.md) | 41 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/xml/xml_x_frame_pic.ts`](./reports/dat_translator/xml/xml_x_frame_pic.md) | 41 | 纯函数工具 |  |
| 1 | [`defines/actions/IAction_Base.ts`](./reports/defines/actions/IAction_Base.md) | 41 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/bots/bot_ball_dfa.ts`](./reports/dat_translator/bots/bot_ball_dfa.md) | 40 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_rudolf.ts`](./reports/dat_translator/fighters/make_fighter_data_rudolf.md) | 40 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_ball_dfj.ts`](./reports/dat_translator/bots/bot_ball_dfj.md) | 39 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_stage_info.ts`](./reports/dat_translator/xml/xml_to_stage_info.md) | 39 | 纯函数工具 |  |
| 1 | [`ui/component/ISumInfo.ts`](./reports/ui/component/ISumInfo.md) | 39 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/bots/make_bot_data_louis.ts`](./reports/dat_translator/bots/make_bot_data_louis.md) | 38 | 纯函数工具 |  |
| 1 | [`dat_translator/cook_ball_frame_state_3005.ts`](./reports/dat_translator/cook_ball_frame_state_3005.md) | 38 | 纯函数工具 |  |
| 1 | [`dat_translator/cook_cpoint.ts`](./reports/dat_translator/cook_cpoint.md) | 38 | 纯函数工具 |  |
| 1 | [`defines/BinOp.ts`](./reports/defines/BinOp.md) | 38 | 常量/静态数据 |  |
| 1 | [`dat_translator/bots/bot_uppercut_dua.ts`](./reports/dat_translator/bots/bot_uppercut_dua.md) | 37 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_uppercut_duj.ts`](./reports/dat_translator/bots/bot_uppercut_duj.md) | 37 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/make_bot_data_sorcerer.ts`](./reports/dat_translator/bots/make_bot_data_sorcerer.md) | 37 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_drink_info.ts`](./reports/dat_translator/xml/xml_x_drink_info.md) | 37 | 纯函数工具 |  |
| 1 | [`defines/IVelocityInfo.ts`](./reports/defines/IVelocityInfo.md) | 37 | 常量/静态数据 |  |
| 1 | [`dat_translator/cook_wpoint.ts`](./reports/dat_translator/cook_wpoint.md) | 36 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_bdy.ts`](./reports/dat_translator/xml/xml_x_bdy.md) | 36 | 纯函数工具 |  |
| 1 | [`defines/StageVal.ts`](./reports/defines/StageVal.md) | 36 | 常量/静态数据 |  |
| 1 | [`ditto/cache/ICache.ts`](./reports/ditto/cache/ICache.md) | 36 | 纯类型声明 (interface/type) |  |
| 1 | [`state/index.ts`](./reports/state/index.md) | 36 | 纯类型声明 (interface/type) |  |
| 1 | [`bot/utils/is_ray_hit.ts`](./reports/bot/utils/is_ray_hit.md) | 35 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_bg_layer.ts`](./reports/dat_translator/xml/xml_to_bg_layer.md) | 35 | 纯函数工具 |  |
| 1 | [`index.ts`](./reports/index.md) | 35 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/ICookedUIInfo.ts`](./reports/ui/ICookedUIInfo.md) | 35 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/easing/IEasing.ts`](./reports/utils/easing/IEasing.md) | 35 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_weapon_hit_other.ts`](./reports/collision/handle_weapon_hit_other.md) | 34 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_picture_info.ts`](./reports/dat_translator/xml/xml_x_picture_info.md) | 34 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_dennis_chase.ts`](./reports/dat_translator/frame_behavior/make_fb_dennis_chase.md) | 33 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_from_stage_object_info.ts`](./reports/dat_translator/xml/xml_from_stage_object_info.md) | 33 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_bg_data.ts`](./reports/dat_translator/xml/xml_to_bg_data.md) | 33 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_wpoint.ts`](./reports/dat_translator/xml/xml_x_wpoint.md) | 33 | 纯函数工具 |  |
| 1 | [`defines/ChaseLost.ts`](./reports/defines/ChaseLost.md) | 33 | 常量/静态数据 |  |
| 1 | [`collision/index.ts`](./reports/collision/index.md) | 32 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/bots/bot_ball_cancelling.ts`](./reports/dat_translator/bots/bot_ball_cancelling.md) | 32 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_from_stage_info.ts`](./reports/dat_translator/xml/xml_from_stage_info.md) | 32 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_bg_info.ts`](./reports/dat_translator/xml/xml_to_bg_info.md) | 32 | 纯函数工具 |  |
| 1 | [`defines/IBgInfo.ts`](./reports/defines/IBgInfo.md) | 32 | 纯函数工具 |  |
| 1 | [`defines/actions/TAction.ts`](./reports/defines/actions/TAction.md) | 32 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/xml/xml_to_stage_object_info.ts`](./reports/dat_translator/xml/xml_to_stage_object_info.md) | 31 | 纯函数工具 |  |
| 1 | [`defines/ArmorEnum.ts`](./reports/defines/ArmorEnum.md) | 31 | 常量/静态数据 |  |
| 1 | [`state/spawn_buring_smoke.ts`](./reports/state/spawn_buring_smoke.md) | 31 | 纯函数工具 |  |
| 1 | [`collision/calc_itr_velocity.ts`](./reports/collision/calc_itr_velocity.md) | 30 | 纯函数工具 |  |
| 1 | [`entity/type_check.ts`](./reports/entity/type_check.md) | 30 | 纯函数工具 |  |
| 1 | [`loader/index.ts`](./reports/loader/index.md) | 30 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/frame_behavior/make_fb_julian_ball.ts`](./reports/dat_translator/frame_behavior/make_fb_julian_ball.md) | 29 | 纯函数工具 |  |
| 1 | [`defines/ChaseStratedy.ts`](./reports/defines/ChaseStratedy.md) | 29 | 常量/静态数据 |  |
| 1 | [`defines/IOpointMulti.ts`](./reports/defines/IOpointMulti.md) | 29 | 纯函数工具 |  |
| 1 | [`defines/OpointSpreading.ts`](./reports/defines/OpointSpreading.md) | 29 | 常量/静态数据 |  |
| 1 | [`defines/TeamEnum.ts`](./reports/defines/TeamEnum.md) | 29 | 纯函数工具 |  |
| 1 | [`collision/handle_injury.ts`](./reports/collision/handle_injury.md) | 28 | 纯函数工具 |  |
| 1 | [`dat_translator/take_raw_frame_mp.ts`](./reports/dat_translator/take_raw_frame_mp.md) | 28 | 纯函数工具 |  |
| 1 | [`stage/IStageCallbacks.ts`](./reports/stage/IStageCallbacks.md) | 28 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/index.ts`](./reports/ui/index.md) | 28 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_itr_kind_freeze.ts`](./reports/collision/handle_itr_kind_freeze.md) | 27 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/make_bot_data_bat.ts`](./reports/dat_translator/bots/make_bot_data_bat.md) | 27 | 纯函数工具 |  |
| 1 | [`defines/BotVal.ts`](./reports/defines/BotVal.md) | 27 | 常量/静态数据 |  |
| 1 | [`ditto/IRender.ts`](./reports/ditto/IRender.md) | 27 | 纯函数工具 |  |
| 1 | [`utils/container_help/ensure.ts`](./reports/utils/container_help/ensure.md) | 27 | 纯函数工具 |  |
| 1 | [`utils/math/calc_plane.ts`](./reports/utils/math/calc_plane.md) | 27 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_ball_continuation.ts`](./reports/dat_translator/bots/bot_ball_continuation.md) | 26 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/make_bot_data_jan.ts`](./reports/dat_translator/bots/make_bot_data_jan.md) | 26 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_bpoint.ts`](./reports/dat_translator/xml/xml_x_bpoint.md) | 26 | 纯函数工具 |  |
| 1 | [`defines/IBpointInfo.ts`](./reports/defines/IBpointInfo.md) | 26 | 纯函数工具 |  |
| 1 | [`defines/OpointMultiEnum.ts`](./reports/defines/OpointMultiEnum.md) | 26 | 常量/静态数据 |  |
| 1 | [`defines/SparkEnum.ts`](./reports/defines/SparkEnum.md) | 26 | 常量/静态数据 |  |
| 1 | [`utils/math/range.ts`](./reports/utils/math/range.md) | 26 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_chasing_action.ts`](./reports/dat_translator/bots/bot_chasing_action.md) | 25 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/bot_idle_action.ts`](./reports/dat_translator/bots/bot_idle_action.md) | 25 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_john_chase.ts`](./reports/dat_translator/frame_behavior/make_fb_john_chase.md) | 25 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_model_info.ts`](./reports/dat_translator/xml/xml_x_model_info.md) | 25 | 纯函数工具 |  |
| 1 | [`defines/TextureWrapping.ts`](./reports/defines/TextureWrapping.md) | 25 | 常量/静态数据 |  |
| 1 | [`defines/actions/IAction_Sound.ts`](./reports/defines/actions/IAction_Sound.md) | 25 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/utils/hex_to_rgba.ts`](./reports/ui/utils/hex_to_rgba.md) | 25 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/index.ts`](./reports/dat_translator/fighters/index.md) | 24 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/ICollisionSnapshot.ts`](./reports/collision/ICollisionSnapshot.md) | 23 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/Difficulty.ts`](./reports/defines/Difficulty.md) | 23 | 常量/静态数据 |  |
| 1 | [`defines/actions/IAction_Fusion.ts`](./reports/defines/actions/IAction_Fusion.md) | 23 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/IImageOp_Crop.ts`](./reports/ditto/image/IImageOp_Crop.md) | 23 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/render/IUINodeRenderer.ts`](./reports/ditto/render/IUINodeRenderer.md) | 23 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_weapon_is_picked.ts`](./reports/collision/handle_weapon_is_picked.md) | 22 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_bat_chase.ts`](./reports/dat_translator/frame_behavior/make_fb_bat_chase.md) | 22 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_chase.ts`](./reports/dat_translator/xml/xml_x_chase.md) | 22 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_colli_action.ts`](./reports/dat_translator/xml/xml_x_colli_action.md) | 22 | 纯函数工具 |  |
| 1 | [`defines/IExpression.ts`](./reports/defines/IExpression.md) | 22 | 纯类型声明 (interface/type) |  |
| 1 | [`loader/check_bdy.ts`](./reports/loader/check_bdy.md) | 22 | 纯函数工具 |  |
| 1 | [`ui/IUICallback.ts`](./reports/ui/IUICallback.md) | 22 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_itr_kind_magic_flute.ts`](./reports/collision/handle_itr_kind_magic_flute.md) | 21 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_boomerang.ts`](./reports/dat_translator/frame_behavior/make_fb_boomerang.md) | 21 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_x_qube.ts`](./reports/dat_translator/xml/xml_x_qube.md) | 21 | 纯函数工具 |  |
| 1 | [`defines/BotStateEnum.ts`](./reports/defines/BotStateEnum.md) | 21 | 常量/静态数据 |  |
| 1 | [`defines/FrameId.ts`](./reports/defines/FrameId.md) | 21 | 常量/静态数据 |  |
| 1 | [`loader/preprocess_opoint.ts`](./reports/loader/preprocess_opoint.md) | 21 | 纯函数工具 |  |
| 1 | [`ui/ICrossInfo.ts`](./reports/ui/ICrossInfo.md) | 21 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/easing/ease_in_out_quint.ts`](./reports/utils/easing/ease_in_out_quint.md) | 21 | 纯函数工具 |  |
| 1 | [`collision/handle_weapon_is_picked_secretly.ts`](./reports/collision/handle_weapon_is_picked_secretly.md) | 20 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_julian_ball_start.ts`](./reports/dat_translator/frame_behavior/make_fb_julian_ball_start.md) | 20 | 纯函数工具 |  |
| 1 | [`dat_translator/make_frames_special.ts`](./reports/dat_translator/make_frames_special.md) | 20 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_from_dialog_info.ts`](./reports/dat_translator/xml/xml_from_dialog_info.md) | 20 | 纯函数工具 |  |
| 1 | [`defines/IPurePlayerInfo.ts`](./reports/defines/IPurePlayerInfo.md) | 20 | 常量/静态数据 |  |
| 1 | [`ditto/image/IImageMgr.ts`](./reports/ditto/image/IImageMgr.md) | 20 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/fighters/make_fighter_data_knigt.ts`](./reports/dat_translator/fighters/make_fighter_data_knigt.md) | 19 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_jan_chaseh_start.ts`](./reports/dat_translator/frame_behavior/make_fb_jan_chaseh_start.md) | 19 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/parse_rect_qube.ts`](./reports/dat_translator/xml/parse_rect_qube.md) | 19 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_from_dat_index.ts`](./reports/dat_translator/xml/xml_from_dat_index.md) | 19 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_bg_terrain.ts`](./reports/dat_translator/xml/xml_to_bg_terrain.md) | 19 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_dat_index.ts`](./reports/dat_translator/xml/xml_to_dat_index.md) | 19 | 纯函数工具 |  |
| 1 | [`defines/IModelInfo.ts`](./reports/defines/IModelInfo.md) | 19 | 纯函数工具 |  |
| 1 | [`defines/actions/index.ts`](./reports/defines/actions/index.md) | 19 | 纯类型声明 (interface/type) |  |
| 1 | [`loader/preprocess_pic.ts`](./reports/loader/preprocess_pic.md) | 19 | 纯函数工具 |  |
| 1 | [`ui/component/ITeamSumInfo.ts`](./reports/ui/component/ITeamSumInfo.md) | 19 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/string_parser/match_colon_value.ts`](./reports/utils/string_parser/match_colon_value.md) | 19 | 纯函数工具 |  |
| 1 | [`dat_translator/make_entity_data.ts`](./reports/dat_translator/make_entity_data.md) | 18 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/xml_to_dialog_info.ts`](./reports/dat_translator/xml/xml_to_dialog_info.md) | 18 | 纯函数工具 |  |
| 1 | [`defines/GONE_FRAME_INFO.ts`](./reports/defines/GONE_FRAME_INFO.md) | 18 | 常量/静态数据 |  |
| 1 | [`ditto/keyboard/IKeyboardCallback.ts`](./reports/ditto/keyboard/IKeyboardCallback.md) | 18 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/make_sum_info.ts`](./reports/ui/component/make_sum_info.md) | 18 | 纯函数工具 |  |
| 1 | [`defines/CtrlDevice.ts`](./reports/defines/CtrlDevice.md) | 17 | 常量/静态数据 |  |
| 1 | [`defines/EMPTY_FRAME_INFO.ts`](./reports/defines/EMPTY_FRAME_INFO.md) | 17 | 常量/静态数据 |  |
| 1 | [`defines/IFullGameZipInfo.ts`](./reports/defines/IFullGameZipInfo.md) | 17 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/MinificationTextureFilter.ts`](./reports/defines/MinificationTextureFilter.md) | 17 | 常量/静态数据 |  |
| 1 | [`defines/SpeedCtrl.ts`](./reports/defines/SpeedCtrl.md) | 17 | 常量/静态数据 |  |
| 1 | [`defines/actions/IAction_NextFrame.ts`](./reports/defines/actions/IAction_NextFrame.md) | 17 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/index.ts`](./reports/ditto/index.md) | 17 | 纯类型声明 (interface/type) |  |
| 1 | [`entity/IDrinkInfoSnapshot.ts`](./reports/entity/IDrinkInfoSnapshot.md) | 17 | 纯类型声明 (interface/type) |  |
| 1 | [`helper/manhattan_xz.ts`](./reports/helper/manhattan_xz.md) | 17 | 纯函数工具 |  |
| 1 | [`ui/UIActionEnum.ts`](./reports/ui/UIActionEnum.md) | 17 | 枚举定义 |  |
| 1 | [`utils/math/base.ts`](./reports/utils/math/base.md) | 17 | 纯函数工具 |  |
| 1 | [`utils/math/probability.ts`](./reports/utils/math/probability.md) | 17 | 纯函数工具 |  |
| 1 | [`collision/handle_john_shield_hit_other_ball.ts`](./reports/collision/handle_john_shield_hit_other_ball.md) | 16 | 纯函数工具 |  |
| 1 | [`collision/is_fall.ts`](./reports/collision/is_fall.md) | 16 | 纯函数工具 |  |
| 1 | [`controller/index.ts`](./reports/controller/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/frame_behavior/index.ts`](./reports/dat_translator/frame_behavior/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/xml/xml_to_data_lists.ts`](./reports/dat_translator/xml/xml_to_data_lists.md) | 16 | 纯函数工具 |  |
| 1 | [`defines/CPointKind.ts`](./reports/defines/CPointKind.md) | 16 | 常量/静态数据 |  |
| 1 | [`defines/IDataLists.ts`](./reports/defines/IDataLists.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/OpointKind.ts`](./reports/defines/OpointKind.md) | 16 | 常量/静态数据 |  |
| 1 | [`entity/find_frame_direction.ts`](./reports/entity/find_frame_direction.md) | 16 | 纯函数工具 |  |
| 1 | [`entity/index.ts`](./reports/entity/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`helper/closer_one.ts`](./reports/helper/closer_one.md) | 16 | 纯函数工具 |  |
| 1 | [`loader/get_val_from_world.ts`](./reports/loader/get_val_from_world.md) | 16 | 纯函数工具 |  |
| 1 | [`ui/component/IPlayable.ts`](./reports/ui/component/IPlayable.md) | 16 | 纯函数工具 |  |
| 1 | [`ui/component/Tests/index.ts`](./reports/ui/component/Tests/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/utils/index.ts`](./reports/ui/utils/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/index.ts`](./reports/utils/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/math/index.ts`](./reports/utils/math/index.md) | 16 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/math/project_to_line.ts`](./reports/utils/math/project_to_line.md) | 16 | 纯函数工具 |  |
| 1 | [`base/index.ts`](./reports/base/index.md) | 15 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_rest.ts`](./reports/collision/handle_rest.md) | 15 | 纯函数工具 |  |
| 1 | [`defines/SyncRenderEnum.ts`](./reports/defines/SyncRenderEnum.md) | 15 | 常量/静态数据 |  |
| 1 | [`entity/EnterFrameResult.ts`](./reports/entity/EnterFrameResult.md) | 15 | 常量/静态数据 |  |
| 1 | [`utils/container_help/index.ts`](./reports/utils/container_help/index.md) | 15 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/cross_bounding.ts`](./reports/utils/cross_bounding.md) | 15 | 纯函数工具 |  |
| 1 | [`utils/math/normalize_plane.ts`](./reports/utils/math/normalize_plane.md) | 15 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_henry.ts`](./reports/dat_translator/fighters/make_fighter_data_henry.md) | 14 | 纯函数工具 |  |
| 1 | [`defines/BackgroundGroup.ts`](./reports/defines/BackgroundGroup.md) | 14 | 常量/静态数据 |  |
| 1 | [`ditto/sounds/ISoundsCallback.ts`](./reports/ditto/sounds/ISoundsCallback.md) | 14 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/CharMenu/index.ts`](./reports/ui/component/CharMenu/index.md) | 14 | 纯类型声明 (interface/type) |  |
| 1 | [`buff/_.ts`](./reports/buff/_.md) | 13 | 纯函数工具 |  |
| 1 | [`collision/ICollisionHandler.ts`](./reports/collision/ICollisionHandler.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`controller/IControllerDoubleClicksSnapshot.ts`](./reports/controller/IControllerDoubleClicksSnapshot.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/bots/constants.ts`](./reports/dat_translator/bots/constants.md) | 13 | 常量/静态数据 |  |
| 1 | [`dat_translator/bots/make_bot_data_hunter.ts`](./reports/dat_translator/bots/make_bot_data_hunter.md) | 13 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/make_bot_data_knight.ts`](./reports/dat_translator/bots/make_bot_data_knight.md) | 13 | 纯函数工具 |  |
| 1 | [`defines/CheatType.ts`](./reports/defines/CheatType.md) | 13 | 纯函数工具 |  |
| 1 | [`defines/IDatContext.ts`](./reports/defines/IDatContext.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IHoldKeyCollection.ts`](./reports/defines/IHoldKeyCollection.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_ABuff.ts`](./reports/defines/actions/IAction_ABuff.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_VBuff.ts`](./reports/defines/actions/IAction_VBuff.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/ui/IEventHandle.ts`](./reports/ditto/ui/IEventHandle.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`entity/face_helper.ts`](./reports/entity/face_helper.md) | 13 | 纯函数工具 |  |
| 1 | [`loader/check_itr.ts`](./reports/loader/check_itr.md) | 13 | 纯函数工具 |  |
| 1 | [`ui/component/CharMenu/ISlotPack.ts`](./reports/ui/component/CharMenu/ISlotPack.md) | 13 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/utils/isClass.ts`](./reports/ui/utils/isClass.md) | 13 | 纯函数工具 |  |
| 1 | [`utils/easing/ease_in_out_sine.ts`](./reports/utils/easing/ease_in_out_sine.md) | 13 | 纯函数工具 |  |
| 1 | [`utils/math/clamp.ts`](./reports/utils/math/clamp.md) | 13 | 纯函数工具 |  |
| 1 | [`IPlayerInfoCallback.ts`](./reports/IPlayerInfoCallback.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`animation/index.ts`](./reports/animation/index.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/fighters/make_fighter_data_firzen.ts`](./reports/dat_translator/fighters/make_fighter_data_firzen.md) | 12 | 纯函数工具 |  |
| 1 | [`defines/IDataMap.ts`](./reports/defines/IDataMap.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/keyboard/IKeyEvent.ts`](./reports/ditto/keyboard/IKeyEvent.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/xml/IXML.ts`](./reports/ditto/xml/IXML.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/zip/IZip.ts`](./reports/ditto/zip/IZip.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`loader/get_val_from_lf2.ts`](./reports/loader/get_val_from_lf2.md) | 12 | 纯函数工具 |  |
| 1 | [`ui/component/IFighterSumInfo.ts`](./reports/ui/component/IFighterSumInfo.md) | 12 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/container_help/map_no_void.ts`](./reports/utils/container_help/map_no_void.md) | 12 | 纯函数工具 |  |
| 1 | [`collision/handle_itr_kind_catch.ts`](./reports/collision/handle_itr_kind_catch.md) | 11 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_jan.ts`](./reports/dat_translator/fighters/make_fighter_data_jan.md) | 11 | 纯函数工具 |  |
| 1 | [`dat_translator/frame_behavior/make_fb_john_chase_leaving.ts`](./reports/dat_translator/frame_behavior/make_fb_john_chase_leaving.md) | 11 | 纯函数工具 |  |
| 1 | [`dat_translator/set_hit_flag.ts`](./reports/dat_translator/set_hit_flag.md) | 11 | 纯函数工具 |  |
| 1 | [`defines/IVector3.ts`](./reports/defines/IVector3.md) | 11 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_SetProp.ts`](./reports/defines/actions/IAction_SetProp.md) | 11 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/IImageOp_Color.ts`](./reports/ditto/image/IImageOp_Color.md) | 11 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/index.ts`](./reports/ditto/image/index.md) | 11 | 纯类型声明 (interface/type) |  |
| 1 | [`loader/preprocess_frame_pic.ts`](./reports/loader/preprocess_frame_pic.md) | 11 | 纯函数工具 |  |
| 1 | [`ui/IComponentInfo.ts`](./reports/ui/IComponentInfo.md) | 11 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/IUIKeyEvent.ts`](./reports/ui/IUIKeyEvent.md) | 11 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/make_team_sum_info.ts`](./reports/ui/component/make_team_sum_info.md) | 11 | 纯函数工具 |  |
| 1 | [`base/get_short_file_size_txt.ts`](./reports/base/get_short_file_size_txt.md) | 10 | 纯函数工具 |  |
| 1 | [`base/get_team_text_color.ts`](./reports/base/get_team_text_color.md) | 10 | 纯函数工具 |  |
| 1 | [`bot/state/index.ts`](./reports/bot/state/index.md) | 10 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/fighters/make_fighter_data_henter.ts`](./reports/dat_translator/fighters/make_fighter_data_henter.md) | 10 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_mark.ts`](./reports/dat_translator/fighters/make_fighter_data_mark.md) | 10 | 纯函数工具 |  |
| 1 | [`dat_translator/set_bdy_kind.ts`](./reports/dat_translator/set_bdy_kind.md) | 10 | 纯函数工具 |  |
| 1 | [`dat_translator/xml/one_or_arr.ts`](./reports/dat_translator/xml/one_or_arr.md) | 10 | 纯函数工具 |  |
| 1 | [`defines/StageActions.ts`](./reports/defines/StageActions.md) | 10 | 常量/静态数据 |  |
| 1 | [`defines/StageGroup.ts`](./reports/defines/StageGroup.md) | 10 | 常量/静态数据 |  |
| 1 | [`defines/actions/IAction_Defend.ts`](./reports/defines/actions/IAction_Defend.md) | 10 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/pointings/IPointingsCallback.ts`](./reports/ditto/pointings/IPointingsCallback.md) | 10 | 纯类型声明 (interface/type) |  |
| 1 | [`helper/index.ts`](./reports/helper/index.md) | 10 | 纯类型声明 (interface/type) |  |
| 1 | [`loader/preprocess_stage.ts`](./reports/loader/preprocess_stage.md) | 10 | 纯函数工具 |  |
| 1 | [`ui/utils/int_to_rgba.ts`](./reports/ui/utils/int_to_rgba.md) | 10 | 纯函数工具 |  |
| 1 | [`ui/utils/isUIComponentClass.ts`](./reports/ui/utils/isUIComponentClass.md) | 10 | 纯函数工具 |  |
| 1 | [`utils/container_help/foreach.ts`](./reports/utils/container_help/foreach.md) | 10 | 纯函数工具 |  |
| 1 | [`ITransform.ts`](./reports/ITransform.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`base/get_team_shadow_color.ts`](./reports/base/get_team_shadow_color.md) | 9 | 纯函数工具 |  |
| 1 | [`collision/handle_itr_kind_force_catch.ts`](./reports/collision/handle_itr_kind_force_catch.md) | 9 | 纯函数工具 |  |
| 1 | [`collision/handle_stiffness.ts`](./reports/collision/handle_stiffness.md) | 9 | 纯函数工具 |  |
| 1 | [`dat_translator/bots/IEditBotAction.ts`](./reports/dat_translator/bots/IEditBotAction.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/post_process_obj_data.ts`](./reports/dat_translator/post_process_obj_data.md) | 9 | 纯函数工具 |  |
| 1 | [`defines/IBounding.ts`](./reports/defines/IBounding.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/MagnificationTextureFilter.ts`](./reports/defines/MagnificationTextureFilter.md) | 9 | 常量/静态数据 |  |
| 1 | [`defines/actions/IAction_BrokenDefend.ts`](./reports/defines/actions/IAction_BrokenDefend.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_TurnFace.ts`](./reports/defines/actions/IAction_TurnFace.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_TurnTeam.ts`](./reports/defines/actions/IAction_TurnTeam.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/pointings/IPointingEvent.ts`](./reports/ditto/pointings/IPointingEvent.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/pointings/IPointings.ts`](./reports/ditto/pointings/IPointings.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/render/IWorldRenderer.ts`](./reports/ditto/render/IWorldRenderer.md) | 9 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/CharMenu/CharMenuState.ts`](./reports/ui/component/CharMenu/CharMenuState.md) | 9 | 枚举定义 |  |
| 1 | [`ui/component/make_fighter_sum.ts`](./reports/ui/component/make_fighter_sum.md) | 9 | 纯函数工具 |  |
| 1 | [`ui/component/make_player_sum.ts`](./reports/ui/component/make_player_sum.md) | 9 | 纯函数工具 |  |
| 1 | [`ui/utils/isUINodeClass.ts`](./reports/ui/utils/isUINodeClass.md) | 9 | 纯函数工具 |  |
| 1 | [`bot/index.ts`](./reports/bot/index.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`controller/IControllerDoubleClickData.ts`](./reports/controller/IControllerDoubleClickData.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`controller/IDoubleClickSnapshot.ts`](./reports/controller/IDoubleClickSnapshot.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/fighters/make_fighter_data_bat.ts`](./reports/dat_translator/fighters/make_fighter_data_bat.md) | 8 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_dennis.ts`](./reports/dat_translator/fighters/make_fighter_data_dennis.md) | 8 | 纯函数工具 |  |
| 1 | [`defines/INextFrameResult.ts`](./reports/defines/INextFrameResult.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IRect.ts`](./reports/defines/IRect.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/LF2Val.ts`](./reports/defines/LF2Val.md) | 8 | 常量/静态数据 |  |
| 1 | [`defines/WorldVal.ts`](./reports/defines/WorldVal.md) | 8 | 常量/静态数据 |  |
| 1 | [`defines/actions/IAction_Broadcast.ts`](./reports/defines/actions/IAction_Broadcast.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_Error.ts`](./reports/defines/actions/IAction_Error.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/ITextInfo.ts`](./reports/ditto/image/ITextInfo.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/keyboard/IKeyboard.ts`](./reports/ditto/keyboard/IKeyboard.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/UIEvent.ts`](./reports/ui/UIEvent.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/CharMenu/ICharMenuState.ts`](./reports/ui/component/CharMenu/ICharMenuState.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Others/index.ts`](./reports/ui/component/Tests/Others/index.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/easing/ease_linearity.ts`](./reports/utils/easing/ease_linearity.md) | 8 | 纯函数工具 |  |
| 1 | [`utils/math/normalize.ts`](./reports/utils/math/normalize.md) | 8 | 纯函数工具 |  |
| 1 | [`utils/math/round_float.ts`](./reports/utils/math/round_float.md) | 8 | 纯函数工具 |  |
| 1 | [`utils/string_parser/index.ts`](./reports/utils/string_parser/index.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/type_check/index.ts`](./reports/utils/type_check/index.md) | 8 | 纯类型声明 (interface/type) |  |
| 1 | [`collision/handle_body_goto.ts`](./reports/collision/handle_body_goto.md) | 7 | 纯函数工具 |  |
| 1 | [`collision/handle_healing.ts`](./reports/collision/handle_healing.md) | 7 | 纯函数工具 |  |
| 1 | [`collision/handle_super_punch_me.ts`](./reports/collision/handle_super_punch_me.md) | 7 | 纯函数工具 |  |
| 1 | [`controller/ISeqKeysSnapshot.ts`](./reports/controller/ISeqKeysSnapshot.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/fighters/make_fighter_data_deep.ts`](./reports/dat_translator/fighters/make_fighter_data_deep.md) | 7 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_jack.ts`](./reports/dat_translator/fighters/make_fighter_data_jack.md) | 7 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_sorcerer.ts`](./reports/dat_translator/fighters/make_fighter_data_sorcerer.md) | 7 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_woody.ts`](./reports/dat_translator/fighters/make_fighter_data_woody.md) | 7 | 纯函数工具 |  |
| 1 | [`defines/IQube.ts`](./reports/defines/IQube.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IVector4Like.ts`](./reports/defines/IVector4Like.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/actions/IAction_ReboundVX.ts`](./reports/defines/actions/IAction_ReboundVX.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`stage/index.ts`](./reports/stage/index.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/IUIPointerEvent.ts`](./reports/ui/IUIPointerEvent.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/CharMenu/SlotStep.ts`](./reports/ui/component/CharMenu/SlotStep.md) | 7 | 枚举定义 |  |
| 1 | [`ui/utils/IRGBA.ts`](./reports/ui/utils/IRGBA.md) | 7 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/math/clamp_add.ts`](./reports/utils/math/clamp_add.md) | 7 | 纯函数工具 |  |
| 1 | [`utils/math/floor_float.ts`](./reports/utils/math/floor_float.md) | 7 | 纯函数工具 |  |
| 1 | [`buff/index.ts`](./reports/buff/index.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/cook_bpoint.ts`](./reports/dat_translator/cook_bpoint.md) | 6 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_davis.ts`](./reports/dat_translator/fighters/make_fighter_data_davis.md) | 6 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_john.ts`](./reports/dat_translator/fighters/make_fighter_data_john.md) | 6 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_justin.ts`](./reports/dat_translator/fighters/make_fighter_data_justin.md) | 6 | 纯函数工具 |  |
| 1 | [`dat_translator/fighters/make_fighter_data_monk.ts`](./reports/dat_translator/fighters/make_fighter_data_monk.md) | 6 | 纯函数工具 |  |
| 1 | [`dat_translator/float_scaling_bdy.ts`](./reports/dat_translator/float_scaling_bdy.md) | 6 | 纯函数工具 |  |
| 1 | [`dat_translator/make_entity_special.ts`](./reports/dat_translator/make_entity_special.md) | 6 | 纯函数工具 |  |
| 1 | [`defines/IPicture.ts`](./reports/defines/IPicture.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IVector3Like.ts`](./reports/defines/IVector3Like.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/IReadable.ts`](./reports/ditto/IReadable.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/IImageOp_Flip.ts`](./reports/ditto/image/IImageOp_Flip.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`entity/StatBarType.ts`](./reports/entity/StatBarType.md) | 6 | 枚举定义 |  |
| 1 | [`stage/Status.ts`](./reports/stage/Status.md) | 6 | 枚举定义 |  |
| 1 | [`ui/component/Tests/Firen/index.ts`](./reports/ui/component/Tests/Firen/index.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Freeze/index.ts`](./reports/ui/component/Tests/Freeze/index.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/utils/IRGB.ts`](./reports/ui/utils/IRGB.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/array/make_arr.ts`](./reports/utils/array/make_arr.md) | 6 | 纯函数工具 |  |
| 1 | [`utils/container_help/filter.ts`](./reports/utils/container_help/filter.md) | 6 | 纯函数工具 |  |
| 1 | [`utils/easing/index.ts`](./reports/utils/easing/index.md) | 6 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/math/float_equal.ts`](./reports/utils/math/float_equal.md) | 6 | 纯函数工具 |  |
| 1 | [`cases_instances.ts`](./reports/cases_instances.md) | 5 | 常量/静态数据 |  |
| 1 | [`defines/IDeadJoin.ts`](./reports/defines/IDeadJoin.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IPairByFace.ts`](./reports/defines/IPairByFace.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IQubePair.ts`](./reports/defines/IQubePair.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/image/IImageOp_Resize.ts`](./reports/ditto/image/IImageOp_Resize.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/importer/index.ts`](./reports/ditto/importer/index.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/keyboard/index.ts`](./reports/ditto/keyboard/index.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/pointings/index.ts`](./reports/ditto/pointings/index.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/sounds/index.ts`](./reports/ditto/sounds/index.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`loader/preprocess_wpoint.ts`](./reports/loader/preprocess_wpoint.md) | 5 | 纯函数工具 |  |
| 1 | [`ui/IUIAction.ts`](./reports/ui/IUIAction.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Julian/index.ts`](./reports/ui/component/Tests/Julian/index.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/ITimesSnapshot.ts`](./reports/utils/ITimesSnapshot.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/array/index.ts`](./reports/utils/array/index.md) | 5 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/type_check/is_str.ts`](./reports/utils/type_check/is_str.md) | 5 | 纯函数工具 |  |
| 1 | [`bg/index.ts`](./reports/bg/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/conditions/hp_gt_0.ts`](./reports/dat_translator/conditions/hp_gt_0.md) | 4 | 常量/静态数据 |  |
| 1 | [`defines/IRectPair.ts`](./reports/defines/IRectPair.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`defines/IVector2Like.ts`](./reports/defines/IVector2Like.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/cache/index.ts`](./reports/ditto/cache/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/fullscreen/IFullScreenCallback.ts`](./reports/ditto/fullscreen/IFullScreenCallback.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/fullscreen/index.ts`](./reports/ditto/fullscreen/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/render/index.ts`](./reports/ditto/render/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/xml/index.ts`](./reports/ditto/xml/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ditto/zip/index.ts`](./reports/ditto/zip/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Firezen/index.ts`](./reports/ui/component/Tests/Firezen/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Jan/index.ts`](./reports/ui/component/Tests/Jan/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/container_help/get_keys.ts`](./reports/utils/container_help/get_keys.md) | 4 | 纯函数工具 |  |
| 1 | [`utils/schema/index.ts`](./reports/utils/schema/index.md) | 4 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/type_check/is_bool.ts`](./reports/utils/type_check/is_bool.md) | 4 | 纯函数工具 |  |
| 1 | [`bot/utils/index.ts`](./reports/bot/utils/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/conditions/index.ts`](./reports/dat_translator/conditions/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`dat_translator/fixed_float.ts`](./reports/dat_translator/fixed_float.md) | 3 | 纯函数工具 |  |
| 1 | [`ditto/ui/index.ts`](./reports/ditto/ui/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/action/index.ts`](./reports/ui/action/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/IUICompnentCallbacks.ts`](./reports/ui/component/IUICompnentCallbacks.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Slider/index.ts`](./reports/ui/component/Slider/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Bat/index.ts`](./reports/ui/component/Tests/Bat/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Bg/index.ts`](./reports/ui/component/Tests/Bg/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Bot/index.ts`](./reports/ui/component/Tests/Bot/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Louis/index.ts`](./reports/ui/component/Tests/Louis/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`ui/component/Tests/Rudolf/index.ts`](./reports/ui/component/Tests/Rudolf/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/type_cast/index.ts`](./reports/utils/type_cast/index.md) | 3 | 纯类型声明 (interface/type) |  |
| 1 | [`types/index.ts`](./reports/types/index.md) | 2 | 纯类型声明 (interface/type) |  |
| 1 | [`utils/type_check/Unsafe.ts`](./reports/utils/type_check/Unsafe.md) | 2 | 纯类型声明 (interface/type) |  |
