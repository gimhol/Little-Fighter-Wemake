import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LFW } from './LFW';
import {
  mark_suggestion_sent,
  SUGGESTION_CONTACT_MAX,
  SUGGESTION_COOLDOWN_MS,
  SUGGESTION_NAME_MAX,
  SUGGESTION_TEXT_MAX,
  SUGGESTION_TEXT_MIN,
  submit_suggestion,
  suggestion_cooldown_left,
} from './suggestion_api';
import csses from './AnyIdea.module.scss';

const NAME_KEY = 'lfj_any_idea_name';
const GITHUB_NEW_ISSUE = 'https://github.com/gimhol/Little-Fighter-Wemake/issues/new';

function read_name(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function write_name(value: string) {
  try {
    if (value) localStorage.setItem(NAME_KEY, value);
    else localStorage.removeItem(NAME_KEY);
  } catch {
    // 隐私模式等写不进去时忽略
  }
}

function github_issue_url(text: string, meta: string): string {
  const url = new URL(GITHUB_NEW_ISSUE);
  const first_line = text.trim().split('\n')[0]?.trim().slice(0, 60) ?? '';
  url.searchParams.set('title', first_line ? `[Idea] ${first_line}` : '[Idea]');
  url.searchParams.set('body', `${text.trim()}\n\n---\n${meta}`);
  return url.href;
}

export interface IAnyIdeaProps {
  lfw?: LFW;
  page?: string;
  on_close(): void;
}

/**
 * 入口页 / 主页右下角的 “Any idea?” 建议箱。
 *
 * 按钮和弹窗都是网页 DOM（不是游戏内 canvas UI）：输入框可以直接用系统输入法，
 * 提交走联机服务器的 `POST /api/suggestions`，服务端不可达时给一个 GitHub 反馈入口兜底。
 */
export function AnyIdea(props: IAnyIdeaProps) {
  const { lfw, page, on_close } = props;
  const { t } = useTranslation();

  const [text, set_text] = useState('');
  const [name, set_name] = useState(read_name);
  const [contact, set_contact] = useState('');
  const [website, set_website] = useState('');
  const [phase, set_phase] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, set_error] = useState('');
  const [cooldown, set_cooldown] = useState(() => Math.ceil(suggestion_cooldown_left() / 1000));

  const close_timer = useRef<number | undefined>(void 0);
  const alive = useRef(true);

  useEffect(() => {
    const tick = () => set_cooldown(Math.ceil(suggestion_cooldown_left() / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const on_key_down = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      on_close();
    };
    window.addEventListener('keydown', on_key_down, true);
    return () => window.removeEventListener('keydown', on_key_down, true);
  }, [on_close]);

  useEffect(() => () => {
    alive.current = false;
    if (close_timer.current !== void 0) window.clearTimeout(close_timer.current);
  }, []);

  const lang = lfw?.canonical_lang() ?? '';
  const meta = `Version: ${LFW.VERSION_NAME}\nPage: ${page ?? ''}\nLang: ${lang}`;

  const on_submit = async (e: FormEvent) => {
    e.preventDefault();
    if (phase === 'sending') return;
    const value = text.trim();
    if (!value) {
      set_error(t('idea_empty'));
      return;
    }
    if (value.length < SUGGESTION_TEXT_MIN) {
      set_error(t('idea_too_short').replace('%1', `${SUGGESTION_TEXT_MIN}`));
      return;
    }
    if (cooldown > 0) {
      set_error(t('idea_too_frequent').replace('%1', `${cooldown}`));
      return;
    }

    set_error('');
    set_phase('sending');
    const result = await submit_suggestion({
      text: value,
      name: name.trim() || void 0,
      contact: contact.trim() || void 0,
      version: LFW.VERSION_NAME,
      lang,
      page,
      website,
    });

    if (!alive.current) return;
    if (!result.ok) {
      set_phase('idle');
      set_error(result.status === 429 ? t('idea_rate_limited') : t('idea_failed'));
      return;
    }

    mark_suggestion_sent();
    write_name(name.trim());
    set_phase('sent');
    set_cooldown(Math.ceil(SUGGESTION_COOLDOWN_MS / 1000));
    close_timer.current = window.setTimeout(on_close, 2400);
  };

  const error_github_url = text.trim() ? github_issue_url(text, meta) : GITHUB_NEW_ISSUE;

  return (
    <div className={csses.mask} onMouseDown={(e) => { if (e.target === e.currentTarget) on_close(); }}>
      <div
        className={csses.panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby="any_idea_title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={csses.header}>
          <div className={csses.heading}>
            <h2 id="any_idea_title" className={csses.title}>{t('idea_title')}</h2>
            <p className={csses.intro}>{t('idea_intro')}</p>
          </div>
          <button type="button" className={csses.close} onClick={on_close} aria-label={t('idea_close')}>✕</button>
        </div>

        {phase === 'sent' ? (
          <div className={csses.success} role="status">
            <div className={csses.success_icon} aria-hidden="true">✓</div>
            <p className={csses.success_text}>{t('idea_success')}</p>
          </div>
        ) : (
          <form className={csses.form} onSubmit={on_submit}>
            <label className={csses.label} htmlFor="any_idea_text">{t('idea_text_label')}</label>
            <textarea
              id="any_idea_text"
              className={csses.textarea}
              value={text}
              maxLength={SUGGESTION_TEXT_MAX}
              placeholder={t('idea_text_placeholder')}
              autoFocus
              onChange={(e) => {
                set_text(e.target.value);
                if (error) set_error('');
              }}
            />
            <div className={csses.count}>{text.length} / {SUGGESTION_TEXT_MAX}</div>

            <div className={csses.row}>
              <div className={csses.field}>
                <label className={csses.label} htmlFor="any_idea_name">{t('idea_name_label')}</label>
                <input
                  id="any_idea_name"
                  className={csses.input}
                  value={name}
                  maxLength={SUGGESTION_NAME_MAX}
                  placeholder={t('idea_name_placeholder')}
                  onChange={(e) => set_name(e.target.value)}
                />
              </div>
              <div className={csses.field}>
                <label className={csses.label} htmlFor="any_idea_contact">{t('idea_contact_label')}</label>
                <input
                  id="any_idea_contact"
                  className={csses.input}
                  value={contact}
                  maxLength={SUGGESTION_CONTACT_MAX}
                  placeholder={t('idea_contact_placeholder')}
                  onChange={(e) => set_contact(e.target.value)}
                />
              </div>
            </div>

            <p className={csses.privacy}>{t('idea_privacy')}</p>

            {/* 蜜罐：视觉上隐藏，正常用户不会填写 */}
            <input
              className={csses.honeypot}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(e) => set_website(e.target.value)}
            />

            {error && (
              <div className={csses.error} role="alert">
                <span>{error}</span>
                <a className={csses.github} href={error_github_url} target="_blank" rel="noreferrer">
                  {t('idea_github')} ↗
                </a>
              </div>
            )}

            <div className={csses.footer}>
              {cooldown > 0 && (
                <span className={csses.cooldown}>{t('idea_too_frequent').replace('%1', `${cooldown}`)}</span>
              )}
              <button type="button" className={csses.cancel} onClick={on_close}>{t('idea_cancel')}</button>
              <button
                type="submit"
                className={csses.submit}
                disabled={phase === 'sending' || cooldown > 0}
              >
                {phase === 'sending' ? t('idea_sending') : t('idea_submit')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
