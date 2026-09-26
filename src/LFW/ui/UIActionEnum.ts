export enum UIActionEnum {
  Alert = 'alert',
  LinkTo = 'link_to',
  SetPage = 'set_page',
  PushPage = 'push_page',
  PopPage = 'pop_page',
  LoopImg = 'loop_img',
  /** 加载数据，默认加载: data.zip.json */
  LoadData = 'load_data',
  Broadcast = 'broadcast',
  Sound = 'sound',
  SwitchDifficulty = 'switch_difficulty',
  DestoryStage = 'destory_stage',
  RemoveAllEntities = 'remove_all_entities',
  Exit = 'exit',

  /** @deprecated 旧写法，仍兼容；改用 SetPage/PushPage/PopPage */
  SetUI = 'set_ui',
  /** @deprecated 旧写法，仍兼容；改用 SetPage/PushPage/PopPage */
  PushUI = 'push_ui',
  /** @deprecated 旧写法，仍兼容；改用 SetPage/PushPage/PopPage */
  PopUI = 'pop_ui',
}
