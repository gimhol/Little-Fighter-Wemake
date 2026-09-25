import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  allowed_of,
  extra_fighter,
  extra_fighter2,
  extra_player,
  extra_player2,
  group_of,
  max_of,
  owner_key,
  RANK_FILE_EXT,
  SAVE_DELAY,
  submit_to_family,
  type IRankLookup,
  type IRankOptions,
  type IRankResult,
  type IRankScore,
  type IRankStore,
  type IRankSubmit,
} from './IRankStore';

export * from './IRankStore';

function sort_scores(list: IRankScore[]) {
  list.sort((a, b) => b.score - a.score || a.date - b.date);
}

function write_atomic(file: string, text: string) {
  const tmp = `${file}.tmp`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(tmp, text);
  renameSync(tmp, file);
}

export class RankMgr implements IRankStore {
  static readonly TAG = 'RankMgr';
  readonly kind = 'file';
  readonly path: string;
  readonly dir?: string;
  readonly max_per_type: number;
  readonly allowed_types?: string[];
  protected _scores = new Map<string, IRankScore[]>();
  protected _timer?: ReturnType<typeof setTimeout>;
  protected _dirty = new Set<string>();

  constructor(path: string, options: IRankOptions = {}) {
    this.path = path;
    this.dir = options.dir?.trim() || void 0;
    this.max_per_type = max_of(options.max_per_type);
    this.allowed_types = allowed_of(options.allowed_types);
    this.load();
    process.on('exit', () => this.flush());
  }

  get types(): string[] { return Array.from(this._scores.keys()) }

  allows(type: string): boolean {
    return !this.allowed_types || this.allowed_types.includes(type);
  }

  file_of(type: string): string {
    return this.dir ? join(this.dir, `${type}${RANK_FILE_EXT}`) : this.path;
  }

  total(type: string): number { return this._scores.get(type)?.length ?? 0 }

  find(type: string, opts: { name?: string; uid?: string }): { rank: number; score: IRankScore } | undefined {
    const list = this._scores.get(type);
    if (!list) return void 0;
    for (let i = 0; i < list.length; i++) {
      const score = list[i]!;
      if (opts.uid) {
        if (score.uid === opts.uid) return { rank: i + 1, score };
      } else if (opts.name && score.name === opts.name) {
        return { rank: i + 1, score };
      }
    }
    return void 0;
  }

  scores(type: string, limit: number = 50, name?: string): { total: number; scores: IRankScore[] } {
    const list = this._scores.get(type) ?? [];
    const filtered = name ? list.filter(v => v.name === name) : list;
    return { total: filtered.length, scores: filtered.slice(0, limit) };
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
    const list = this._scores.get(type);
    if (!list?.length || !names.length) return [];
    const want = new Set(names);
    const found = new Map<string, IRankLookup>();
    for (const v of list) {
      if (!want.has(v.name) || found.has(v.name)) continue;
      const fighter = this.extra_fighter(v.extra);
      const player = this.extra_player(v.extra);
      const fighter2 = this.extra_fighter2(v.extra);
      const player2 = this.extra_player2(v.extra);
      if (fighter || player) found.set(v.name, { name: v.name, score: v.score, fighter, player, fighter2, player2 });
    }
    return Array.from(found.values());
  }

  submit(info: IRankSubmit): IRankResult {
    return submit_to_family(this, submit => this.store(submit), info);
  }

  protected store(info: IRankSubmit): IRankResult {
    const list = this.list_of(info.type);
    const key = owner_key(info);
    const index = list.findIndex(v => owner_key(v) === key);
    if (index >= 0 && list[index]!.score >= info.score) {
      const rank = index + 1;
      return { rank, total: list.length, kept: rank <= this.max_per_type, score: list[index]! };
    }
    const score: IRankScore = { ...info, date: Date.now() };
    if (index >= 0) list.splice(index, 1, score);
    else list.push(score);
    sort_scores(list);
    const rank = list.indexOf(score) + 1;
    const total = list.length;
    if (list.length > this.max_per_type) list.length = this.max_per_type;
    this._dirty.add(info.type);
    this.save();
    return { rank, total, kept: rank <= this.max_per_type, score };
  }

  flush() {
    if (!this._dirty.size) return;
    if (this._timer) { clearTimeout(this._timer); this._timer = void 0 }
    try {
      if (this.dir) {
        for (const type of this._dirty) {
          const list = this._scores.get(type) ?? [];
          write_atomic(this.file_of(type), JSON.stringify({ version: 1, type, saved_at: Date.now(), scores: list }));
        }
      } else {
        const scores: Record<string, IRankScore[]> = {};
        for (const [type, list] of this._scores) scores[type] = list;
        write_atomic(this.path, JSON.stringify({ version: 1, saved_at: Date.now(), scores }));
      }
      this._dirty.clear();
    } catch (error) {
      console.error(`[${RankMgr.TAG}] 写入失败: ${this.dir ?? this.path}`, error);
    }
  }

  protected save() {
    if (this._timer) return;
    this._timer = setTimeout(() => { this._timer = void 0; this.flush() }, SAVE_DELAY);
    this._timer.unref?.();
  }

  protected load() {
    if (this.dir) {
      if (!existsSync(this.dir)) return;
      try {
        for (const name of readdirSync(this.dir)) {
          if (!name.endsWith(RANK_FILE_EXT)) continue;
          this.load_file(join(this.dir, name), name.slice(0, -RANK_FILE_EXT.length));
        }
      } catch (error) {
        console.error(`[${RankMgr.TAG}] 读取失败: ${this.dir}`, error);
      }
      return;
    }
    this.load_file(this.path);
  }

  protected load_file(file: string, type?: string) {
    if (!existsSync(file)) return;
    try {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as { type?: unknown; scores?: unknown };
      if (Array.isArray(raw.scores)) {
        const file_type = type ?? (typeof raw.type === 'string' ? raw.type : void 0);
        if (file_type) this.load_scores(file_type, raw.scores);
      } else if (raw.scores && typeof raw.scores === 'object') {
        for (const [type_name, list] of Object.entries(raw.scores))
          if (Array.isArray(list)) this.load_scores(type_name, list);
      }
      console.log(`[${RankMgr.TAG}] ${file} 已加载`);
    } catch (error) {
      console.error(`[${RankMgr.TAG}] 读取失败: ${file}`, error);
    }
  }

  protected load_scores(type: string, list: unknown[]) {
    const target = this.list_of(type);
    const parsed: IRankScore[] = [];
    for (const v of list) {
      const score = v as IRankScore;
      if (!score || typeof score.name !== 'string' || !Number.isFinite(score.score)) continue;
      // 老数据没有 group：按 extra 里的角色补上，避免同一客户端多角色被并成一行
      if (!score.group) {
        const group = group_of(type, score.extra);
        if (group) score.group = group;
      }
      parsed.push(score);
    }
    sort_scores(parsed);
    const kept = new Set<string>();
    for (const score of parsed) {
      const key = owner_key(score);
      if (kept.has(key)) continue;
      kept.add(key);
      target.push(score);
    }
    sort_scores(target);
    if (target.length > this.max_per_type) target.length = this.max_per_type;
  }

  protected list_of(type: string): IRankScore[] {
    let list = this._scores.get(type);
    if (!list) this._scores.set(type, list = []);
    return list;
  }
}
