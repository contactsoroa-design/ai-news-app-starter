import seedSponsoredData from '../../data/sponsored.json';
import { env, limits } from './config';
import { getVerifiedArticleTool } from './feed';
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
 * おすすめ: 設定のツール／ソース絞り込みに関係なく広告を出す。
 * ツール別／ソース別（「すべて」時）・探索: tool_tag / source_id が prefs・有効ソースに合うものだけ。
 */
export function sponsoredMatchesContext(
  item: SponsoredItem,
  ctx: SponsoredMatchContext
): boolean {
  if (ctx.mode === 'recommended') return true;

  if (item.tool_tag) {
    const tools = ctx.prefsTools ?? [];
    if (tools.length > 0 && !tools.includes(item.tool_tag)) return false;
  }
  if (item.source_id && ctx.enabledSourceIds) {
    if (!ctx.enabledSourceIds.has(item.source_id)) return false;
  }
  return true;
}

function isContextualSponsored(
  item: SponsoredItem,
  ctx: SponsoredMatchContext
): boolean {
  if (ctx.mode === 'tool' && ctx.selectedTool) {
    return item.tool_tag === ctx.selectedTool;
  }
  if (ctx.mode === 'source' && ctx.selectedSourceId) {
    return item.source_id === ctx.selectedSourceId;
  }
  return false;
}

/** いま見ているツール／ソースに合う案件を先に（無ければ全体） */
export function sortSponsoredForContext(
  sponsored: SponsoredItem[],
  ctx: SponsoredMatchContext
): SponsoredItem[] {
  return [...sponsored].sort((a, b) => {
    const score = (s: SponsoredItem) => {
      let n = (s.weight ?? 1) * 10;
      if (isContextualSponsored(s, ctx)) n += 1000;
      return n;
    };
    return score(b) - score(a);
  });
}

export function filterSponsoredForContext(
  sponsored: SponsoredItem[],
  ctx: SponsoredMatchContext
): SponsoredItem[] {
  const matched = sponsored.filter((s) => sponsoredMatchesContext(s, ctx));
  // 個別ツール／ソース選択: 該当案件だけ（無ければ空。他案件へフォールバックしない）
  if (
    (ctx.mode === 'tool' && ctx.selectedTool) ||
    (ctx.mode === 'source' && ctx.selectedSourceId)
  ) {
    const contextual = matched.filter((s) => isContextualSponsored(s, ctx));
    return sortSponsoredForContext(contextual, ctx);
  }
  return sortSponsoredForContext(matched, ctx);
}

/**
 * ソース別／ツール別専用: 該当広告を先頭で一覧し、その後ろに記事。
 * 記事0件でも広告カードだけスワイプできる。
 */
export function listSponsoredThenArticles(
  articles: Article[],
  sponsored: SponsoredItem[],
  options?: { locale?: AppLocale }
): FeedCardItem[] {
  const locale = options?.locale ?? 'ja';
  if (sponsored.length === 0) return articles;

  const ads: FeedCardItem[] = sponsored.map((s, i) => {
    const base = localizeSponsoredItem(s, locale);
    return {
      ...base,
      id: `${base.id}__list_${i}`,
    };
  });
  return [...ads, ...articles];
}

/** 記事のツール／ソースがスポンサード案件と対応するか */
export function articleMatchesSponsored(
  article: Article,
  item: SponsoredItem
): boolean {
  if (item.tool_tag) {
    if (article.tool_tags?.includes(item.tool_tag)) return true;
    if (getVerifiedArticleTool(article) === item.tool_tag) return true;
  }
  if (item.source_id && article.source_id === item.source_id) {
    return true;
  }
  return false;
}

/**
 * 記事に紐づく広告案件を1件選ぶ（weight 優先）。
 * 同一広告主の複数パターンがある場合は代表として使う。
 */
export function pickRelatedSponsored(
  article: Article,
  sponsored: SponsoredItem[]
): SponsoredItem | null {
  const matches = sponsored.filter((s) => articleMatchesSponsored(article, s));
  if (matches.length === 0) return null;
  return [...matches].sort((a, b) => (b.weight ?? 1) - (a.weight ?? 1))[0];
}

function sponsoredFeedIdMatches(
  feedItem: SponsoredItem,
  related: SponsoredItem
): boolean {
  if (feedItem.id === related.id) return true;
  // interleave で `${id}__slot_N` になる
  if (feedItem.id.startsWith(`${related.id}__`)) return true;
  if (
    related.tool_tag &&
    feedItem.tool_tag &&
    feedItem.tool_tag === related.tool_tag
  ) {
    return true;
  }
  if (
    related.source_id &&
    feedItem.source_id &&
    feedItem.source_id === related.source_id
  ) {
    return true;
  }
  if (
    feedItem.advertiser_name &&
    related.advertiser_name &&
    feedItem.advertiser_name === related.advertiser_name
  ) {
    return true;
  }
  return false;
}

/** フィード内の該当広告カードへ。現在位置から前方優先、無ければ後方 */
export function findNearestSponsoredIndex(
  feed: FeedCardItem[],
  fromIndex: number,
  related: SponsoredItem
): number {
  const start = Math.max(0, Math.min(fromIndex, Math.max(0, feed.length - 1)));
  for (let i = start; i < feed.length; i++) {
    const item = feed[i];
    if (isSponsoredItem(item) && sponsoredFeedIdMatches(item, related)) {
      return i;
    }
  }
  for (let i = start - 1; i >= 0; i--) {
    const item = feed[i];
    if (isSponsoredItem(item) && sponsoredFeedIdMatches(item, related)) {
      return i;
    }
  }
  return -1;
}

/**
 * 複数広告主がいるとき、広告主単位で交互に並べる（A→B→A→B…）。
 * おすすめフィードで ElevenLabs / Synthesia / Firecrawl が固まるのを防ぐ。
 */
export function alternateSponsoredByAdvertiser(
  sponsored: SponsoredItem[]
): SponsoredItem[] {
  if (sponsored.length <= 1) return sponsored;
  const queues = new Map<string, SponsoredItem[]>();
  const order: string[] = [];
  for (const item of sponsored) {
    const key = item.advertiser_name || item.id;
    if (!queues.has(key)) {
      queues.set(key, []);
      order.push(key);
    }
    queues.get(key)!.push(item);
  }
  if (order.length <= 1) return sponsored;

  const out: SponsoredItem[] = [];
  const pointers = new Map(order.map((k) => [k, 0]));
  let remaining = sponsored.length;
  while (remaining > 0) {
    let progressed = false;
    for (const key of order) {
      const q = queues.get(key)!;
      const i = pointers.get(key)!;
      if (i < q.length) {
        out.push(q[i]);
        pointers.set(key, i + 1);
        remaining -= 1;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return out;
}

/**
 * 記事リストへスポンサードを差し込む。
 * 先頭直後は出さず、everyN 件ごとに1枚を繰り返し（案件が1件でも周期表示）。
 * 複数広告主は交互。記事が少ないソース／ツールでも件数に合わせて最低1枚。
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
  const configuredMinBefore = Math.max(
    1,
    options?.minArticlesBeforeFirst ?? limits.sponsoredMinArticlesBeforeFirst
  );
  // 記事2件のツール別などで「初回まで4件必要」だと広告が一生出ないのを防ぐ
  const minBefore = Math.min(
    configuredMinBefore,
    Math.max(1, articles.length)
  );
  const locale = options?.locale ?? 'ja';

  if (sponsored.length === 0 || articles.length === 0) {
    return articles;
  }

  const pool = alternateSponsoredByAdvertiser(sponsored).map((s) =>
    localizeSponsoredItem(s, locale)
  );

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
