import { OID, EntityGroup } from "../defines";
import type { IEntityData } from "../defines/IEntityData";
import { ensure } from "../utils";
import { make_fighter_data_bat } from "./fighters/make_fighter_data_bat";
import { make_fighter_data_davis } from "./fighters/make_fighter_data_davis";
import { make_fighter_data_deep } from "./fighters/make_fighter_data_deep";
import { make_fighter_data_dennis } from "./fighters/make_fighter_data_dennis";
import { make_fighter_data_firen } from "./fighters/make_fighter_data_firen";
import { make_fighter_data_firzen } from "./fighters/make_fighter_data_firzen";
import { make_fighter_data_freeze } from "./fighters/make_fighter_data_freeze";
import { make_fighter_data_henry } from "./fighters/make_fighter_data_henry";
import { make_fighter_data_henter } from "./fighters/make_fighter_data_henter";
import { make_fighter_data_jack } from "./fighters/make_fighter_data_jack";
import { make_fighter_data_jan } from "./fighters/make_fighter_data_jan";
import { make_fighter_data_john } from "./fighters/make_fighter_data_john";
import { make_fighter_data_julian } from "./fighters/make_fighter_data_julian";
import { make_fighter_data_justin } from "./fighters/make_fighter_data_justin";
import { make_fighter_data_knigt } from "./fighters/make_fighter_data_knigt";
import { make_fighter_data_mark } from "./fighters/make_fighter_data_mark";
import { make_fighter_data_monk } from "./fighters/make_fighter_data_monk";
import { make_fighter_data_rudolf } from "./fighters/make_fighter_data_rudolf";
import { make_fighter_data_sorcerer } from "./fighters/make_fighter_data_sorcerer";
import { make_fighter_data_woody } from "./fighters/make_fighter_data_woody";
import { make_fighter_data_louis } from "./fighters/make_fighter_data_louis";
import { make_fighter_data_louisex } from "./fighters/make_fighter_data_louisex";

export function make_fighter_special(data: IEntityData): IEntityData {
  const num_id = Number(data.id);

  if ((num_id >= 30 && num_id <= 39) || (num_id >= 50 && num_id <= 59)) {
    data.base.group = ensure(data.base.group, EntityGroup.Hidden);
  }
  if (num_id >= 1 && num_id <= 29) {
    data.base.group = ensure(data.base.group, EntityGroup.Regular);
  }
  switch ((data.alias_id ?? data.id) as OID) {
    case OID.Julian: return make_fighter_data_julian(data)
    case OID.Firzen: return make_fighter_data_firzen(data);
    case OID.LouisEX: return make_fighter_data_louisex(data);
    case OID.Bat: return make_fighter_data_bat(data);
    case OID.Knight: return make_fighter_data_knigt(data);
    case OID.Louis: return make_fighter_data_louis(data);
    case OID.Rudolf: return make_fighter_data_rudolf(data);
    case OID.Deep: return make_fighter_data_deep(data);
    case OID.Davis: return make_fighter_data_davis(data);
    case OID.Dennis: return make_fighter_data_dennis(data);
    case OID.Woody: return make_fighter_data_woody(data);
    case OID.Firen: return make_fighter_data_firen(data);
    case OID.Freeze: return make_fighter_data_freeze(data);
    case OID.Jack: return make_fighter_data_jack(data);
    case OID.Mark: return make_fighter_data_mark(data);
    case OID.Monk: return make_fighter_data_monk(data);
    case OID.Henry: return make_fighter_data_henry(data);
    case OID.Hunter: return make_fighter_data_henter(data);
    case OID.Justin: return make_fighter_data_justin(data);
    case OID.Jan: return make_fighter_data_jan(data);
    case OID.Sorcerer: return make_fighter_data_sorcerer(data);
    case OID.John: return make_fighter_data_john(data);
    case OID.Template: break;
    case OID.Bandit: data.base.group = ensure(data.base.group, EntityGroup._3000); break;
      break;
  }
  return data;
}


