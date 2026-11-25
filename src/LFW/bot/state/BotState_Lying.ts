import { AGK, BSE, Defines, Difficulty, GK, StateEnum } from "../../defines";
import { is_weapon, type Entity } from "../../entity";
import { BotState_Base } from "./BotState";

/** 疯狂难度下，倒地时每帧尝试翻滚的概率 */
const CRAZY_ROLL_CHANCE = 0.0025;
/** 困难难度下，倒地时每帧尝试翻滚的概率（极低） */
const DIFFICULT_ROLL_CHANCE = 0.001;

/**
 * 倒地
 *
 * - 简单/普通：什么都不按（倒地时不再输出按键）
 * - 困难/疯狂：有一定概率翻滚（倒地时双击方向键），困难概率极低
 * - 近战角色触发翻滚时一半朝目标、一半远离；远程角色始终远离
 * - 起身后按最近的敌人/躲避对象回到 Chasing / Avoiding，而不是一律回 Idle
 */
export class BotState_Lying extends BotState_Base {
  readonly key = BSE.Lying;
  override enter(): void {
    this.c.key_up(...AGK);
  }
  override update(): BSE | undefined {
    const { c, me } = this;
    if (me.hp <= 0) return BSE.Dead;
    if (me.state === StateEnum.Lying) {
      const chance = this.roll_chance();
      if (!chance) return;
      const en = c.chasings.get();
      if (!en) return;
      if (c.desire('lying_roll') >= Defines.desire(chance)) return;
      c.db_hit(this.roll_key(en));
      return;
    }
    /* 起身了：按最近的目标回到对应状态 */
    const { en, av } = this;
    const closest = this.closest(en, av);
    if (av && av === closest) return BSE.Avoiding;
    if (en && en === closest) return is_weapon(en) ? BSE.Picking : BSE.Chasing;
    return BSE.Idle;
  }
  /** 当前难度下，倒地翻滚的概率（0 表示不滚） */
  private roll_chance(): number {
    switch (this.difficulty) {
      case Difficulty.Crazy: return CRAZY_ROLL_CHANCE;
      case Difficulty.Difficult: return DIFFICULT_ROLL_CHANCE;
      default: return 0;
    }
  }
  /** 远程角色：bot 数据里走攻盲区 w_atk_m_x > 20（这类会想拉开距离再出手） */
  private get is_ranged(): boolean {
    return (this.c.dataset.w_atk_m_x ?? -1) > 20;
  }
  /**
   * 翻滚方向键（翻滚帧会按 FacingFlag.Ctrl 转向，按键方向就是翻滚方向）
   *
   * 近战角色一半朝目标、一半远离；远程角色始终远离
   */
  private roll_key(en: Entity): GK {
    const en_right = en.position.x >= this.me.position.x;
    const toward = !this.is_ranged &&
      this.c.desire('lying_roll_toward') < Defines.desire(0.5);
    if (toward) return en_right ? GK.R : GK.L;
    return en_right ? GK.L : GK.R;
  }
}
