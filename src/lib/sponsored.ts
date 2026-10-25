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
  const urls = resolveSponsoredUrls();
  for (const url of urls) {
    try {
      const sep = url.includes('?') ? '&' : '?';
      const res = await fetch(`${url}${sep}_=${Date.now()}`);
      if (!res.ok) continue;
      const list = unwrapSponsoredPayload(await res.json());
      return list.filter((s) => isActiveSponsored(s));
    } catch {
      // try next
    }
  }
  return unwrapSponsoredPayload(seedSponsoredData).filter((s) =>
    isActiveSponsored(s)
  );
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

/**
 * 記事リストへスポンサードを差し込む。
 * 先頭直後は出さず、everyN 件ごとに1枚。おすすめタブ向け。
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
  const everyN = options?.everyN ?? limits.sponsoredEveryN;
  const minBefore =
    options?.minArticlesBeforeFirst ?? limits.sponsoredMinArticlesBeforeFirst;
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

    const canInsert =
      i + 1 >= minBefore &&
      articlesSinceSponsor >= everyN &&
      sponsorIdx < pool.length;

    if (canInsert) {
      out.push(pool[sponsorIdx % pool.length]);
      sponsorIdx++;
      articlesSinceSponsor = 0;
    }
  }

  return out;
}

export { isSponsoredItem };
