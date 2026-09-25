import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import {
  allowed_of,
  extra_fighter,
  extra_fighter2,
  extra_player,
  extra_player2,
  group_of,
  max_of,
  owner_key,
  submit_to_family,
  type IRankLookup,
  type IRankOptions,
  type IRankResult,
  type IRankScore,
  type IRankStore,
  type IRankSubmit,
} from './IRankStore';

interface ISqliteStatement {
  run(...params: unknown[]): { changes: number | bigint };
  get(...params: unknown[]): Record<string, unknown> | undefined;
  all(...params: unknown[]): Record<string, unknown>[];
}

interface ISqliteDatabase {
  exec(sql: string): void;
  prepare(sql: string): ISqliteStatement;
  close(): void;
}

interface ISqliteModule {
  DatabaseSync: new (path: string) => ISqliteDatabase;
}

function load_sqlite(): ISqliteModule | undefined {
  try {
    return require('node:sqlite') as ISqliteModule;
  } catch {
    return void 0;
  }
}

function parse_json(text: unknown): unknown {
  if (typeof text !== 'string' || !text) return void 0;
  try {
    return JSON.parse(text);
  } catch {
    return void 0;
  }
}

function row_to_score(row: Record<string, unknown>): IRankScore {
  return {
    type: `${row.type ?? ''}`,
    name: `${row.name ?? ''}`,
    score: Number(row.score),
    extra: parse_json(row.extra),
    date: Number(row.date),
    uid: row.uid ? `${row.uid}` : void 0,
    group: row.owner_group ? `${row.owner_group}` : void 0,
    client_id: row.client_id ? `${row.client_id}` : void 0,
    address: row.address ? `${row.address}` : void 0,
  };
}

function num_of(row: Record<string, unknown> | undefined, key: string, fallback: number = 0): number {
  const value = Number(row?.[key]);
  return Number.isFinite(value) ? value : fallback;
}

const SQL_CREATE_TABLE = `CREATE TABLE IF NOT EXISTS scores (
  type TEXT NOT NULL,
  owner TEXT NOT NULL,
  name TEXT NOT NULL,
  score REAL NOT NULL,
  date INTEGER NOT NULL,
  uid TEXT,
  extra TEXT,
  client_id TEXT,
  address TEXT,
  owner_group TEXT,
  PRIMARY KEY (type, owner)
)`;

const SQL_GROUP_COLUMN = `SELECT COUNT(*) AS total FROM pragma_table_info('scores') WHERE name = 'owner_group'`;

const SQL_CREATE_INDEX = `CREATE INDEX IF NOT EXISTS scores_rank_idx ON scores (type, score DESC, date ASC)`;

const SQL_UPSERT = `INSERT INTO scores (type, owner, name, score, date, uid, extra, client_id, address, owner_group)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(type, owner) DO UPDATE SET
  name = excluded.name,
  score = excluded.score,
  date = excluded.date,
  uid = excluded.uid,
  extra = excluded.extra,
  client_id = excluded.client_id,
  address = excluded.address,
  owner_group = excluded.owner_group
WHERE excluded.score > scores.score`;

const SQL_RANK = `SELECT COUNT(*) + 1 AS rank FROM scores WHERE type = ? AND (score > ? OR (score = ? AND date < ?))`;
const SQL_TOTAL = `SELECT COUNT(*) AS total FROM scores WHERE type = ?`;
const SQL_BY_OWNER = `SELECT * FROM scores WHERE type = ? AND owner = ?`;
const SQL_BY_UID = `SELECT * FROM scores WHERE type = ? AND uid = ? ORDER BY score DESC, date ASC LIMIT 1`;
const SQL_BY_NAME = `SELECT * FROM scores WHERE type = ? AND name = ? ORDER BY score DESC, date ASC LIMIT 1`;
const SQL_FIND_TOTAL = `SELECT COUNT(*) AS total FROM scores WHERE type = ? AND name = ?`;
const SQL_TRIM = `DELETE FROM scores WHERE type = ? AND owner NOT IN (
  SELECT owner FROM scores WHERE type = ? ORDER BY score DESC, date ASC LIMIT ?
)`;

export class SqliteRankMgr implements IRankStore {
  static readonly TAG = 'SqliteRankMgr';
  readonly kind = 'sqlite';
  readonly path: string;
  readonly max_per_type: number;
  readonly allowed_types?: string[];
  protected _db: ISqliteDatabase;

  constructor(path: string, options: IRankOptions = {}) {
    const sqlite = load_sqlite();
    if (!sqlite) throw new Error('当前运行环境不支持 node:sqlite（需要 Node 22.5 及以上）');
    this.path = path;
    this.max_per_type = max_of(options.max_per_type);
    this.allowed_types = allowed_of(options.allowed_types);
    mkdirSync(dirname(path), { recursive: true });
    this._db = new sqlite.DatabaseSync(path);
    this._db.exec('PRAGMA journal_mode = WAL');
    this._db.exec('PRAGMA synchronous = NORMAL');
    this._db.exec(SQL_CREATE_TABLE);
    if (!num_of(this._db.prepare(SQL_GROUP_COLUMN).get(), 'total'))
      this._db.exec(`ALTER TABLE scores ADD COLUMN owner_group TEXT`);
    this._db.exec(SQL_CREATE_INDEX);
    this.migrate_groups();
    process.on('exit', () => {
      try { this._db.close(); } catch { }
    });
  }

  /** 老记录的 owner 只有 uid：按 extra 里的角色补上分组，避免同一客户端多角色仍被并成一行 */
  protected migrate_groups(): void {
    try {
      const rows = this._db.prepare(`SELECT rowid AS id, type, uid, name, extra FROM scores WHERE owner_group IS NULL OR owner_group = ''`).all();
      if (!rows.length) return;
      const update = this._db.prepare(`UPDATE scores SET owner = ?, owner_group = ? WHERE rowid = ?`);
      let count = 0;
      for (const row of rows) {
        const group = group_of(`${row.type ?? ''}`, parse_json(row.extra));
        if (!group) continue;
        update.run(owner_key({ uid: row.uid ? `${row.uid}` : void 0, name: `${row.name ?? ''}`, group }), group, row.id);
        ++count;
      }
      if (count) console.log(`[${SqliteRankMgr.TAG}] 已按角色补全 ${count} 条记录的分组`);
    } catch (error) {
      console.error(`[${SqliteRankMgr.TAG}] 按角色补全分组失败`, error);
    }
  }

  allows(type: string): boolean {
    return !this.allowed_types || this.allowed_types.includes(type);
  }

  total(type: string): number {
    return num_of(this._db.prepare(SQL_TOTAL).get(type), 'total');
  }

  find(type: string, opts: { name?: string; uid?: string }): { rank: number; score: IRankScore } | undefined {
    const row = opts.uid
      ? this._db.prepare(SQL_BY_UID).get(type, opts.uid)
      : opts.name
        ? this._db.prepare(SQL_BY_NAME).get(type, opts.name)
        : void 0;
    if (!row) return void 0;
    const score = row_to_score(row);
    const rank = num_of(this._db.prepare(SQL_RANK).get(type, score.score, score.score, score.date), 'rank', 1);
    return { rank, score };
  }

  scores(type: string, limit: number = 50, name?: string): { total: number; scores: IRankScore[] } {
    const total = name
      ? num_of(this._db.prepare(SQL_FIND_TOTAL).get(type, name), 'total')
      : this.total(type);
    const rows = name
      ? this._db.prepare(`SELECT * FROM scores WHERE type = ? AND name = ? ORDER BY score DESC, date ASC LIMIT ?`).all(type, name, limit)
      : this._db.prepare(`SELECT * FROM scores WHERE type = ? ORDER BY score DESC, date ASC LIMIT ?`).all(type, limit);
    return { total, scores: rows.map(row_to_score) };
  }

  extra_fighter(extra: unknown): string | undefined {
    return extra_fighter(extra);
  }

  extra_player(extra: unknown): string | undefined {
    return extra_player(extra);
  }

  extra_fighter2(extra: unknown): string | undefined {
    return extra_fighter2(extra);
  }

  extra_player2(extra: unknown): string | undefined {
    return extra_player2(extra);
  }

  char_lookup(type: string, names: string[]): IRankLookup[] {
    const wanted = Array.from(new Set(names.filter(Boolean)));
    if (!wanted.length) return [];
    const placeholders = wanted.map(() => '?').join(', ');
    const rows = this._db.prepare(
      `SELECT name, score, extra FROM scores WHERE type = ? AND name IN (${placeholders}) ORDER BY score DESC, date ASC`
    ).all(type, ...wanted);
    const found = new Map<string, IRankLookup>();
    for (const row of rows) {
      const name = `${row.name ?? ''}`;
      if (!name || found.has(name)) continue;
      const extra = parse_json(row.extra);
      const fighter = extra_fighter(extra);
      const player = extra_player(extra);
      const fighter2 = extra_fighter2(extra);
      const player2 = extra_player2(extra);
      if (fighter || player) found.set(name, { name, score: Number(row.score), fighter, player, fighter2, player2 });
    }
    return Array.from(found.values());
  }

  submit(info: IRankSubmit): IRankResult {
    return submit_to_family(this, submit => this.store(submit), info);
  }

  protected store(info: IRankSubmit): IRankResult {
    const key = owner_key(info);
    const date = Date.now();
    this._db.prepare(SQL_UPSERT).run(
      info.type,
      key,
      info.name,
      info.score,
      date,
      info.uid ?? null,
      info.extra === void 0 ? null : JSON.stringify(info.extra),
      info.client_id ?? null,
      info.address ?? null,
      info.group ?? null,
    );
    const row = this._db.prepare(SQL_BY_OWNER).get(info.type, key);
    const score = row ? row_to_score(row) : { ...info, date };
    const rank = num_of(this._db.prepare(SQL_RANK).get(info.type, score.score, score.score, score.date), 'rank', 1);
    const total = this.total(info.type);
    if (this.max_per_type !== Infinity) this.trim(info.type);
    return { rank, total, kept: rank <= this.max_per_type, score };
  }

  protected trim(type: string) {
    if (this.max_per_type === Infinity) return;
    this._db.prepare(SQL_TRIM).run(type, type, this.max_per_type);
  }
}
