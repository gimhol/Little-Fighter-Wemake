import { Defines, T_E, type IPropsMeta } from "../../defines";
import { Entity, type IEntityCallbacks } from "../../entity";
import { StatBarType } from "../../entity/StatBarType";
import { UINode } from "../UINode";
import { Label } from "./Label";
import { Picture } from "./Picture";
import { SmoothNumber } from "./SmoothNumber";
import { UIComponent } from "./UIComponent";

interface IFighterStatBarProps {
  dark_hp_bar?: UINode
  hp_bar?: UINode;
  dark_mp_bar?: UINode;
  mp_bar?: UINode;
  fall_value_bar?: UINode;
  defend_value_bar?: UINode;
  toughness_bar?: UINode;
  head_img?: Picture;
  name_txt?: Label;
}
export class FighterStatBar extends UIComponent<IFighterStatBarProps> {
  static override readonly TAGS: string[] = ["FighterStatBar"];
  static override readonly PROPS: IPropsMeta<IFighterStatBarProps> = {
    dark_hp_bar: UINode,
    hp_bar: UINode,
    dark_mp_bar: UINode,
    mp_bar: UINode,
    fall_value_bar: UINode,
    defend_value_bar: UINode,
    toughness_bar: UINode,
    head_img: Picture,
    name_txt: Label,
  };
  protected entity?: Entity;
  protected defend_value_max = new SmoothNumber().handler(() => this.update_defend_value())
  protected defend_value = new SmoothNumber().handler(() => this.update_defend_value())
  protected fall_value_max = new SmoothNumber().handler(() => this.update_fall_value())
  protected fall_value = new SmoothNumber().handler(() => this.update_fall_value())
  protected toughness = new SmoothNumber().handler(() => this.update_toughness())
  protected toughness_max = new SmoothNumber().handler(() => this.update_toughness())
  protected hp_max = new SmoothNumber().handler(() => { this.update_hp(); this.update_hp_r() })
  protected hp_r = new SmoothNumber().handler(() => this.update_hp_r())
  protected hp = new SmoothNumber().handler(() => this.update_hp())
  protected mp_max = new SmoothNumber().handler(() => { this.update_mp_max(); this.update_mp() })
  protected mp = new SmoothNumber().handler(() => this.update_mp())
  protected dark_hp_bar_w: number = 200;
  protected hp_bar_w: number = 200;
  protected dark_mp_bar_w: number = 200;
  protected mp_bar_w: number = 200;
  protected fall_value_bar_w: number = 200;
  protected defend_value_bar_w: number = 200;
  protected toughness_bar_w: number = 200;
  protected healing: boolean = false;
  protected cbs: IEntityCallbacks = {
    on_hp_changed: (_, v) => {
      this.hp.target = v;
      if (v > 0) {
        this.props.dark_mp_bar?.set_scale(1, 1, 1)
        return;
      }
      this.hp_r.target = 0;
      this.mp.target = 0;
      this.defend_value.target = 0;
      this.fall_value.target = 0;
      this.toughness.target = 0;
      this.props.dark_mp_bar?.set_scale(0, 1, 1)
    },
    on_hp_max_changed: (_, v) => { this.hp_max.target = v; },
    on_hp_r_changed: (_, v) => { this.hp_r.target = this.hp.target > 0 ? v : 0; },
    on_mp_max_changed: (_, v) => { this.mp_max.target = v; },
    on_mp_changed: (_, v) => { this.mp.target = this.hp.target > 0 ? v : 0; },
    on_defend_value_max_changed: (_, v) => { this.defend_value_max.target = v; },
    on_defend_value_changed: (_, v) => { this.defend_value.target = this.hp.target > 0 ? v : 0; },
    on_fall_value_max_changed: (_, v) => { this.fall_value_max.target = v; },
    on_fall_value_changed: (_, v) => { this.fall_value.target = this.hp.target > 0 ? v : 0; },
    on_toughness_max_changed: (_, v) => { this.toughness_max.target = v; },
    on_toughness_changed: (_, v) => { this.toughness.target = this.hp.target > 0 ? v : 0; },
    on_data_changed: () => this.update_head()
  }
  protected direction: string = '';

  set_entity(entity: Entity | undefined) {
    if (this.entity === entity) return;
    if (this.entity) {
      this.entity.callbacks.del(this.cbs)
      this.entity.stat_bar_type = this.entity.stat_bar_type ^ StatBarType.UI;
    }
    this.entity = entity
    if (entity) {
      this.hp_max.target           /**/ = entity.hp_max
      this.hp_max.handle()
      this.hp_r.target             /**/ = entity.hp_r
      this.hp_r.handle()
      this.hp.target               /**/ = entity.hp
      this.hp.handle()
      this.mp_max.target           /**/ = entity.mp_max
      this.mp_max.handle()
      this.mp.target               /**/ = entity.mp
      this.mp.handle()
      this.defend_value_max.target /**/ = entity.defend_value_max
      this.defend_value_max.handle()
      this.defend_value.target     /**/ = entity.defend_value
      this.defend_value.handle()
      this.fall_value_max.target   /**/ = entity.fall_value_max
      this.fall_value_max.handle()
      this.fall_value.target       /**/ = entity.fall_value
      this.fall_value.handle()
      this.toughness_max.target    /**/ = entity.toughness_max || 1
      this.toughness_max.handle()
      this.toughness.target        /**/ = entity.toughness;
      this.toughness.handle()
      entity.callbacks.add(this.cbs)
      entity.stat_bar_type = entity.stat_bar_type | StatBarType.UI;
    }
    this.update_head();
  }
  override on_show(): void {
    if (this.props.dark_hp_bar) this.dark_hp_bar_w = this.props.dark_hp_bar.w
    if (this.props.hp_bar) this.hp_bar_w = this.props.hp_bar.w
    if (this.props.dark_mp_bar) this.dark_mp_bar_w = this.props.dark_mp_bar.w
    if (this.props.mp_bar) this.mp_bar_w = this.props.mp_bar.w
    if (this.props.fall_value_bar) this.fall_value_bar_w = this.props.fall_value_bar.w
    if (this.props.defend_value_bar) this.defend_value_bar_w = this.props.defend_value_bar.w
    if (this.props.toughness_bar) this.toughness_bar_w = this.props.toughness_bar.w
    this.direction = this.props_holder.str('direction') ?? ''
  }
  update_defend_value(val = this.defend_value.value, max = this.defend_value_max.value) {
    const node = this.props.defend_value_bar;
    if (!node || max === 0) return;
    node.set_scale(val / max, 1, 1);
  }
  update_fall_value(val = this.fall_value.value, max = this.fall_value_max.value) {
    const node = this.props.fall_value_bar;
    if (!node || max === 0) return;
    node.set_scale(val / max, 1, 1)
  }
  update_toughness(val = this.toughness.value, max = this.toughness_max.value) {
    const node = this.props.toughness_bar;
    if (!node || max === 0) return;
    node.set_scale(val / max, 1, 1);
  }
  update_hp(val = this.hp.value, max = this.hp_max.value) {
    const node = this.props.hp_bar;
    if (!node || max === 0) return;
    node.set_scale(val / max, 1, 1);
  }
  update_hp_r(val = this.hp_r.value, max = this.hp_max.value) {
    const node = this.props.dark_hp_bar;
    if (!node || max === 0) return;
    node.set_scale(val / max, 1, 1);
  }
  update_mp(val = this.mp.value, max = this.mp_max.value) {
    const node = this.props.mp_bar;
    if (!node || max === 0) return;
    node.set_scale(val / max, 1, 1);
  }
  update_mp_max() {
    const node = this.props.dark_mp_bar;
    if (!node) return;
    node.set_scale(1, 1, 1);
  }
  update_head(): void {
    const { entity } = this;
    if (entity) {
      const { head } = entity.data.base;
      this.props.head_img?.set_src(typeof head === 'string' ? head : '')
    } else {
      this.props.head_img?.set_src('')
    }
  }
  update_name() {
    const { name_txt } = this.props;
    if (!name_txt) return;
    const name0 = this.entity?.name.trim() ?? 'NONE'
    const name1 = this.entity?.data.base.name.trim() ?? ''
    let name = name0 || name1;
    if (name0 !== name1 && name0 && name1)
      name = `${name1} (${name0})`
    name_txt.set_text(name)
  }
  update_team() {
    const { name_txt } = this.props;
    if (!name_txt) return;
    const team = this.entity?.team ?? 0;
    const { txt_color, txt_outline_color } = Defines.TeamInfoMap[team] || Defines.TeamInfoMap[T_E.Independent]
    name_txt.node.outlineColor = txt_outline_color;
    name_txt.node.style.fill_style = txt_color;
  }
  override update(): void {
    this.update_name();
    this.update_team();
    const { entity, props: { hp_bar } } = this
    if (hp_bar) {
      this.healing = !!entity?.healing && (entity.lifetime % 8) < 4;
      hp_bar.children[0].color = this.healing ? 'rgb(255,130,130)' : 'rgb(255,0,0)'
    }
    this.defend_value_max.update()
    this.defend_value.update()
    this.fall_value_max.update()
    this.fall_value.update()
    this.toughness.update()
    this.toughness_max.update()
    this.hp_max.update()
    this.hp_r.update()
    this.hp.update()
    this.mp_max.update()
    this.mp.update()
  }
}
