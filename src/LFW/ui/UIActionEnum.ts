export enum UIActionEnum {
  Alert = 'alert',
  LinkTo = 'link_to',
  SetPage = 'set_page',
  PushPage = 'push_page',
  PopPage = 'pop_page',
  /** 在当前页面上打开弹窗：`open_modal(ui_id)` */
  OpenModal = 'open_modal',
  /** 关闭当前层弹窗：`close_modal()` / `close_modal(ui_id)` */
  CloseModal = 'close_modal',
  LoopImg = 'loop_img',
  /** 加载数据，默认加载: data.zip.json */
  LoadData = 'load_data',
  Broadcast = 'broadcast',
  Sound = 'sound',
  SwitchDifficulty = 'switch_difficulty',
  DestoryStage = 'destory_stage',
  RemoveAllEntities = 'remove_all_entities',
  Exit = 'exit',
}
