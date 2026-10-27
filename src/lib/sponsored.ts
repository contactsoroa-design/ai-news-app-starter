import seedSponsoredData from '../../data/sponsored.json';
import { env, limits } from './config';
import type { AppLocale, Article, FeedCardItem, SponsoredItem } from './types';
import { isSponsoredItem } from './types';

function unwrapSponsoredPayload(data: unknown): SponsoredItem[] {
  if (Array.isArray(data)) {
    return data as SponsoredItem[];
  }
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { sponsored?: unknown }).sponsored)
  ) {
    return (data as { sponsored: SponsoredItem[] }).sponsored;
  }
  return [];
}

function resolveSponsoredUrls(): string[] {
  const urls: string[] = [];
  const push = (u: string) => {
    const t = u.trim();
    if (t && !urls.includes(t)) urls.push(t);
  };

  // 開発時は Metro の public/ を最優先（未pushのリモート古文面で本文が戻らないようにする）
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants').default as {
        expoConfig?: { hostUri?: string | null };
      };
      const hostUri = Constants.expoConfig?.hostUri;
      if (hostUri) push(`http://${hostUri}/sponsored.json`);
    } catch {
      // ignore
    }
  }

  if (env.feedUrl) {
    try {
      const base = new URL(env.feedUrl);
      const path = base.pathname.replace(/articles\.json$/i, 'sponsored.json');
      if (path !== base.pathname) {
        base.pathname = path;
        push(base.toString());
      }
    } catch {
      // ignore
    }
    push(
      'https://cdn.jsdelivr.net/gh/contactsoroa-design/ai-news-app-starter@main/data/sponsored.json'
    );
    push(
      'https://raw.githubusercontent.com/contactsoroa-design/ai-news-app-starter/main/data/sponsored.json'
    );
  }

  return urls;
}

function isActiveSponsored(item: SponsoredItem, now = Date.now()): boolean {
  if (!item.active) return false;
  if (!item.url || !/^https?:\/\//i.test(item.url)) return false;
  if (item.start_at) {
    const t = Date.parse(item.start_at);
    if (Number.isFinite(t) && now < t) return false;
  }
  if (item.end_at) {
    const t = Date.parse(item.end_at);
    if (Number.isFinite(t) && now > t) return false;
  }
  return true;
}

export async function fetchSponsoredItems(): Promise<SponsoredItem[]> {
  const fromSeed = () =>
    unwrapSponsoredPayload(seedSponsoredData).filter((s) =>
      isActiveSponsored(s)
    );

  // 開発中は同梱 data/sponsored.json を正とする（リモートCDNの古い本文で上書きしない）
  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    const local = fromSeed();
    if (local.length > 0) return local;
  }

  const urls = resolveSponsoredUrls();
  for (const url of urls) {
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}_=${Date.now()}`);
      if (!res.ok) continue;
      const list = unwrapSponsoredPayload(await res.json());
      const active = list.filter((s) => isActiveSponsored(s));
      if (active.length > 0) return active;
    } catch {
      // try next
    }
  }
  return fromSeed();
}

export function localizeSponsoredItem(
  item: SponsoredItem,
  locale: AppLocale
): SponsoredItem {
  if (locale === 'en') {
    const en = item.translations?.en;
    if (en?.title && en?.summary) {
      return {
        ...item,
        title_ja: en.title,
        summary_ja: en.summary,
      };
    }
  }
  const ja = item.translations?.ja;
  if (ja?.title && ja?.summary) {
    return {
      ...item,
      title_ja: ja.title,
      summary_ja: ja.summary,
    };
  }
  return item;
}

/** ホーム上部タブ／設定絞り込みに対するスポンサードの出し分け */
export type SponsoredMatchContext = {
  mode: 'recommended' | 'source' | 'tool';
  selectedTool?: string | null;
  selectedSourceId?: string | null;
  /** おすすめのツール prefs（空＝全ツール対象） */
  prefsTools?: readonly string[];
  enabledSourceIds?: ReadonlySet<string>;
};

/**
 * 該当ツール／ソースの絞り込み時だけ出す。
 * - ツール別: tool_tag 一致
 * - ソース別: source_id 一致
 * - おすすめ: tool_tag / source_id がある案件は prefs・有効ソースに合うものだけ。
 *   どちらも無い汎用案件はおすすめに常時可。
 */
export function sponsoredMatchesContext(
  item: SponsoredItem,
  ctx: SponsoredMatchContext
): boolean {
  if (ctx.mode === 'tool') {
    if (!ctx.selectedTool) return false;
    return Boolean(item.tool_tag && item.tool_tag === ctx.selectedTool);
  }
  if (ctx.mode === 'source') {
    if (!ctx.selectedSourceId) return false;
    return Boolean(item.source_id && item.source_id === ctx.selectedSourceId);
  }

  if (item.tool_tag) {
    const tools = ctx.prefsTools ?? [];
    if (tools.length > 0 && !tools.includes(item.tool_tag)) return false;
  }
  if (item.source_id && ctx.enabledSourceIds) {
    if (!ctx.enabledSourceIds.has(item.source_id)) return false;
  }
  return true;
}

export function filterSponsoredForContext(
  sponsored: SponsoredItem[],
  ctx: SponsoredMatchContext
): SponsoredItem[] {
  return sponsored.filter((s) => sponsoredMatchesContext(s, ctx));
}

/**
 * 記事リストへスポンサードを差し込む。
 * 先頭直後は出さず、everyN 件ごとに1枚を繰り返し（案件が1件でも周期表示）。
 * おすすめ／該当ツール別／該当ソース別向け。
 */
export function interleaveSponsoredCards(
  articles: Article[],
  sponsored: SponsoredItem[],
  options?: {
    everyN?: number;
    minArticlesBeforeFirst?: number;
    locale?: AppLocale;
  }
): FeedCardItem[] {
  const everyN = Math.max(1, options?.everyN ?? limits.sponsoredEveryN);
  const minBefore = Math.max(
    1,
    options?.minArticlesBeforeFirst ?? limits.sponsoredMinArticlesBeforeFirst
  );
  const locale = options?.locale ?? 'ja';

  if (sponsored.length === 0 || articles.length === 0) {
    return articles;
  }

  const pool = [...sponsored]
    .map((s) => localizeSponsoredItem(s, locale))
    .sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1));

  const out: FeedCardItem[] = [];
  let sponsorIdx = 0;
  let articlesSinceSponsor = 0;

  for (let i = 0; i < articles.length; i++) {
    out.push(articles[i]);
    articlesSinceSponsor++;

    // 初回は minBefore 件のあと、以降は everyN 件ごと。案件が1件でもプールを循環する。
    const threshold = sponsorIdx === 0 ? minBefore : everyN;
    if (articlesSinceSponsor >= threshold) {
      const base = pool[sponsorIdx % pool.length];
      out.push({
        ...base,
        id: `${base.id}__slot_${sponsorIdx}`,
      });
      sponsorIdx++;
      articlesSinceSponsor = 0;
    }
  }

  return out;
}

export { isSponsoredItem };
