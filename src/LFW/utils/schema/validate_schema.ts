import type { IClazz, ISchema } from "../../defines/ISchema";

interface InstanceGetter<T> {
  (raw_value: any, clazz: IClazz<T>, schema: ISchema): T | undefined | null;
}
interface InstanceSetter<T> {
  (value: T | undefined | null, raw_value: any, clazz: IClazz<T>, schema: ISchema): void;
}
export class SchemaValidator {
  static readonly Default = new SchemaValidator();
  protected _get_instance?: InstanceGetter<any>;
  protected _set_instance?: InstanceSetter<any>;
  protected _errors: string[] = [];
  protected _warnings: string[] = [];
  get errors(): ReadonlyArray<string> { return this._errors }
  get warnings(): ReadonlyArray<string> { return this._warnings }
  instance_getter<T>(func: InstanceGetter<T>) {
    this._get_instance = func;
    return this
  }
  instance_setter<T>(func: InstanceSetter<T>) {
    this._set_instance = func;
    return this
  }
  validate<T>(value: any, schema: ISchema<T>): value is T {
    const { type } = schema;
    const r = () => _wrong(value, schema, this._errors)

    if (value == null || value == void 0) {
      const ret = schema.nullable || schema.type == 'null';
      if (!ret) return r()
      return ret;
    }
    switch (type) {
      case Boolean: case "boolean":
        if (typeof value !== 'boolean') return r();
        break;
      case String: case "string":
        if (typeof value !== 'string') return r();
        if (schema.string?.not_blank && !value.trim()) return r();
        if (schema.string?.not_empty && !value) return r();
        break;
      case Number: case "number": case "integer":
        if (typeof value !== 'number') return r();
        if (!schema.number?.nan && Number.isNaN(value)) return r();
        if (schema.number?.int && !Number.isInteger(value)) return r();
        if (schema.number?.nagetive && value >= 0) return r();
        if (schema.number?.positive && value <= 0) return r();
        if (schema.number?.nagetive == !1 && value < 0) return r();
        if (schema.number?.positive == !1 && value > 0) return r();
        break;
      case Array: case "array":
        if (!Array.isArray(value)) return r();
        if (!schema.items) return r();

        for (let i = 0; i < value.length; i++) {
          const prop_value = value[i];
          const prop_schema = schema.items;
          const prop_type = prop_schema?.type
          if (
            typeof prop_type === 'function' &&
            prop_type !== Array &&
            prop_type !== Boolean &&
            prop_type !== String &&
            prop_type !== Number
          ) {
            Object.defineProperty(value, i, {
              configurable: true,
              get: () => {
                if (!this._get_instance) throw new Error(`[SchemaValidator] instance_getter not set! ${prop_schema.path}`)
                const ret = this._get_instance(prop_value, prop_type, prop_schema)
                if (ret) return ret;
                if (prop_schema.nullable != false) return null
                throw new Error(`[SchemaValidator] ${prop_schema.path} not found, value: ${prop_value}`)
              },
              set: (v) => {
                if (!this._set_instance) throw new Error(`[SchemaValidator] instance_setter not set! ${prop_schema.path}`)
                this._set_instance(v, prop_value, prop_type, prop_schema)
              },
            })
            continue;
          }
          if (Array.isArray(prop_value)) value[i] = [...prop_value];
          else if (prop_value && typeof prop_type === 'object') value[i] = { ...prop_value };
          if (!this.validate(prop_value, schema.items)) return false;
        }
        break;
      case Object: case "object":
        if (typeof value !== 'object') return r();
        for (const k of Object.keys(value as object)) {
          if (!schema.properties || !(k in schema.properties)) {
            this._warnings.push(`unexpected key '${k}' in '${schema.path}'`);
          }
        }
        for (const k in schema.properties) {
          const prop_schema: ISchema<any> = schema.properties[k];
          let prop_value = value[k];
          const prop_type = prop_schema.type
          if (
            typeof prop_type === 'function' &&
            prop_type !== Array &&
            prop_type !== Boolean &&
            prop_type !== String &&
            prop_type !== Number
          ) {
            delete value[k]
            Object.defineProperty(value, k, {
              configurable: true,
              get: () => {
                if (!this._get_instance) throw new Error(`[SchemaValidator] instance_getter not set! ${prop_schema.path}`)
                const ret = this._get_instance(prop_value, prop_type, prop_schema)
                if (ret) return ret;
                if (prop_schema.nullable != false) return null
                throw new Error(`[SchemaValidator] ${prop_schema.path} not found, value: ${prop_value}`)
              },
              set: (v) => {
                if (!this._set_instance) throw new Error(`[SchemaValidator] instance_setter not set! ${prop_schema.path}`)
                this._set_instance?.(v, prop_value, prop_type, prop_schema)
              },
            })
            continue;
          }
          if (Array.isArray(prop_value)) prop_value = [...prop_value];
          if (!this.validate(prop_value, prop_schema)) return false
          if (Array.isArray(prop_value)) {
            value[k] = prop_value;
          } else if (prop_value && typeof prop_type === 'object') {
            value[k] = { ...prop_value };
          }
        }
        break;
      default: {
        if (typeof schema.type === 'function') {
          if (typeof value !== 'string') {
            this._errors.push(`'${schema.path}' must be a string, but got ${value}`);
            return false;
          }
        }
      }
    }
    if (schema.oneof?.some(v => v === value) === false)
      this._errors.push(`'${schema.path}' should be one of the options: ${JSON.stringify(schema.oneof)}, but got ${value}`);
    return !this._errors.length;
  }
  reset() {
    this._errors.length = 0;
    this._warnings.length = 0;
  }
}

function _wrong<T>(v: unknown, s: ISchema<T>, e: string[]) {
  const _abc = (type: string) => {
    e.push(`type of '${s.path}' must be ${type}, but got ${v}`);
    return false
  }
  switch (s.type) {
    case String: case 'string':
      if (s.string?.not_blank) return _abc('non-blank string')
      if (s.string?.not_empty) return _abc('non-empty string')
      return _abc('string')
    case Number: case 'number': case "integer":
      const type = s.number?.int ? 'integer' : 'number';
      if (s.number?.nagetive) return _abc(`nagetive ${type}`);
      if (s.number?.positive) return _abc(`positive ${type}`);
      if (s.number?.positive == !1) return _abc(`non-positive ${type}`);
      if (s.number?.nagetive == !1) return _abc(`non-nagetive ${type}`);
      return _abc(type)
    case Array: case 'array':
      if (!s.items) {
        e.push(`items not set! ${s.path}`);
        return false
      }
      return _abc('array')
    case Object: case 'object':
      return _abc('object')
    case Boolean: case 'boolean':
      return _abc('boolean');
    default:
      e.push(`type of '${s.path}' must be ${s.type}, but got ${v}`);
  }
  return false
}