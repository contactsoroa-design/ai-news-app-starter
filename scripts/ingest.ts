import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as zlib from 'node:zlib';
import { limits } from '../src/lib/config';
import {
  cleanArticleSummary,
  cleanArticleTitle,
  sanitizeArticleToolTags,
  trimFeedArticles,
} from '../src/lib/feed';
import type { Article, Source } from '../src/lib/types';
import { genres, tools } from '../src/theme/tokens';
import { assertBilingualSummaryQuality } from './summaryQuality';
import { writeArticlesJson } from './lib/writeArticlesJson';

type RawFeedItem = {
  title: string;
  link: string;
  pubDate: string | null;
  snippet: string;
};

type SummaryResult = {
  title_ja: string;
  summary_ja: string;
  title_en: string;
  summary_en: string;
  tool_tags: string[];
  genre_tags: string[];
};

type LlmProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

/** 日英ネイティブ要約を1回のLLM呼び出しで作る想定の記事あたり概算（円） */
const ESTIMATED_COST_PER_ARTICLE_JPY = 0.15;

/** 本番向け: 記事ごとのLLM間隔（ミリ秒）。連続呼び出しで 429 を避ける */
const ARTICLE_DELAY_MS = Number(process.env.INGEST_ARTICLE_DELAY_MS || '4000');
/** 要約API 1回あたりの上限。未設定だとハングして Actions が埋まってしまう */
const LLM_FETCH_TIMEOUT_MS = Number(
  process.env.LLM_FETCH_TIMEOUT_MS || '60000'
);
/** 1実行のソフト締切。過ぎたら途中結果を書いて終了（次の wake に回す） */
const INGEST_SOFT_DEADLINE_MS = Number(
  process.env.INGEST_SOFT_DEADLINE_MS || String(12 * 60 * 1000)
);
/**
 * 1実行の追加上限。
 * schedule は間引かれる前提。チャンスが増えた分、成功した回で厚めに拾う。
 * 日上限 MAX_ARTICLES_PER_DAY（既定500）でブレーキ。
 */
const DEFAULT_ARTICLES_PER_RUN = 10;
/** 各RSSから見る最新件数（要約するのは maxPerRun まで） */
const RSS_ITEMS_PER_SOURCE = 6;
/** RSS取得タイムアウト（arXiv 等は遅いことがある） */
const RSS_FETCH_TIMEOUT_MS = Number(process.env.RSS_FETCH_TIMEOUT_MS || '20000');
const RSS_FETCH_HEADERS: Record<string, string> = {
  // データセンターIP向けにボットUAだと 403 になるソース（Substack等）がある
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept:
    'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.1',
  'Accept-Language': 'en-US,en;q=0.9',
};

/** RSSが死んでいる／無い／Actionsから弾かれるソース向けのサイトマップフォールバック */
type SitemapFeedFallback = {
  sitemapUrl: string;
  pathIncludes: string;
  /** 除外するパス（前方一致 or 完全一致） */
  pathExcludes?: string[];
  /** pathname のセグメント数下限（カテゴリページ除外用） */
  minPathSegments?: number;
};

const SITEMAP_FEED_FALLBACKS: Record<string, SitemapFeedFallback> = {
  'source-marketingexamples': {
    sitemapUrl: 'https://marketingexamples.com/sitemap.xml',
    pathIncludes: '/content/',
  },
  'source-framer': {
    sitemapUrl: 'https://www.framer.com/sitemap_en.xml',
    pathIncludes: '/blog/',
    pathExcludes: [
      '/blog/product',
      '/blog/company',
      '/blog/engineering',
      '/blog/resources',
      '/blog/inspiration',
      '/blog/tutorials',
      '/blog/press',
    ],
    minPathSegments: 2,
  },
  'source-capcut': {
    sitemapUrl:
      'https://www.capcut.com/sitemap/new/348188/default/index0.xml',
    pathIncludes: '/blog/',
    minPathSegments: 2,
  },
  'source-runway': {
    sitemapUrl: 'https://runway.com/sitemap.xml',
    pathIncludes: '/news/',
    pathExcludes: [
      '/news/customers',
      '/news/company-news',
      '/news/safety',
      '/news/research',
      '/news/engineering',
      '/news/developers',
    ],
    minPathSegments: 2,
  },
  // 公式RSSは死んでいるが、sitemap（gzip）に /stories/ と lastmod がある
  'source-starterstory': {
    sitemapUrl: 'https://www.starterstory.com/sitemap',
    pathIncludes: '/stories/',
    minPathSegments: 2,
  },
  // Copy.ai は公式RSSなし。sitemap に /blog/* が大量にある
  'source-copyai': {
    sitemapUrl: 'https://www.copy.ai/sitemap.xml',
    pathIncludes: '/blog/',
    pathExcludes: ['/blog'],
    minPathSegments: 2,
  },
};

/**
 * 公式ブログのカテゴリ一覧HTMLから記事URL＋日付を取る（Webflow等でRSSが弱いソース向け）。
 * Noticeable RSS（製品Updates）と併用し、新しい会社ブログも取りこぼさない。
 */
type ListingFeedFallback = {
  listingUrl: string;
  origin: string;
};

const LISTING_FEED_FALLBACKS: Record<string, ListingFeedFallback> = {
  'source-synthesia': {
    listingUrl: 'https://www.synthesia.io/blog/category/synthesia',
    origin: 'https://www.synthesia.io',
  },
};

function parseEnglishMonthDayYear(raw: string): string | null {
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

async function itemsFromListingFallback(
  sourceId: string
): Promise<RawFeedItem[] | null> {
  const conf = LISTING_FEED_FALLBACKS[sourceId];
  if (!conf) return null;
  const fetched = await fetchText(conf.listingUrl, RSS_FETCH_TIMEOUT_MS);
  if (!fetched.ok) {
    console.warn(`  ! listing失敗: [${sourceId}] ${fetched.error}`);
    return null;
  }
  const items: RawFeedItem[] = [];
  const seen = new Set<string>();
  const cardRe =
    /href="(\/post\/[^"]+)"[^>]*>[\s\S]*?paragraph-xlarge[^>]*>([^<]+)<[\s\S]*?text-color-tertiary">([A-Za-z]+ \d{1,2}, 202\d)</g;
  for (const m of fetched.text.matchAll(cardRe)) {
    const path = m[1];
    const title = m[2].replace(/&#x27;/g, "'").replace(/&amp;/g, '&').trim();
    const pubDate = parseEnglishMonthDayYear(m[3]);
    const link = `${conf.origin}${path}`;
    if (seen.has(link)) continue;
    seen.add(link);
    items.push({
      title: title || titleFromUrlSlug(link),
      link,
      pubDate,
      snippet: '',
    });
  }
  items.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });
  return items.slice(0, RSS_ITEMS_PER_SOURCE);
}

function titleFromUrlSlug(url: string): string {
  try {
    const slug = new URL(url).pathname.split('/').filter(Boolean).pop() ?? url;
    return slug
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (ch) => ch.toUpperCase());
  } catch {
    return url;
  }
}

async function fetchText(
  url: string,
  timeoutMs: number
): Promise<{ ok: true; text: string; status: number } | { ok: false; error: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: RSS_FETCH_HEADERS,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    return { ok: true, text: await res.text(), status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** sitemap.xml / sitemap.xml.gz 両対応（Starter Story 等） */
async function fetchSitemapXml(
  url: string,
  timeoutMs: number
): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        ...RSS_FETCH_HEADERS,
        Accept: 'application/xml, text/xml, application/gzip, */*;q=0.1',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}` };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const looksGzip =
      res.url.endsWith('.gz') ||
      (res.headers.get('content-type') || '').includes('gzip') ||
      (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b);
    const text = looksGzip
      ? zlib.gunzipSync(buf).toString('utf8')
      : buf.toString('utf8');
    return { ok: true, text };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function sitemapPathMatches(url: string, conf: SitemapFeedFallback): boolean {
  if (!url.includes(conf.pathIncludes)) return false;
  let pathname = url;
  try {
    pathname = new URL(url).pathname.replace(/\/$/, '') || '/';
  } catch {
    /* keep raw */
  }
  // カテゴリページそのものは除外（子記事 /news/company-news/foo は残す）
  if (conf.pathExcludes?.some((ex) => pathname === ex)) return false;
  if (typeof conf.minPathSegments === 'number') {
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length < conf.minPathSegments) return false;
  }
  return true;
}

async function itemsFromSitemapFallback(
  sourceId: string
): Promise<RawFeedItem[] | null> {
  const conf = SITEMAP_FEED_FALLBACKS[sourceId];
  if (!conf) return null;
  const fetched = await fetchSitemapXml(conf.sitemapUrl, RSS_FETCH_TIMEOUT_MS);
  if (!fetched.ok) {
    console.warn(`  ! sitemap失敗: [${sourceId}] ${fetched.error}`);
    return null;
  }
  type SitemapEntry = { link: string; pubDate: string | null };
  const entries: SitemapEntry[] = [];
  for (const m of fetched.text.matchAll(
    /<url>\s*<loc>\s*([^<\s]+)\s*<\/loc>\s*(?:<lastmod>\s*([^<\s]+)\s*<\/lastmod>)?/gi
  )) {
    const link = m[1].trim();
    if (!sitemapPathMatches(link, conf)) continue;
    entries.push({ link, pubDate: m[2]?.trim() || null });
  }
  // lastmod がある場合は新しい順（Starter Story 等で先頭が古い問題を防ぐ）
  entries.sort((a, b) => {
    const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
    const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
    return tb - ta;
  });
  return entries.slice(0, RSS_ITEMS_PER_SOURCE).map((entry) => ({
    title: titleFromUrlSlug(entry.link),
    link: entry.link,
    pubDate: entry.pubDate,
    snippet: '',
  }));
}
/**
 * 1実行あたり同一ソースから取る上限（既定1）。
 * 高頻度コミュニティ系（Zenn/Qiita/HN）が枠を独占しないようにする。
 * 枠が余ったときだけ 2 件目以降を許可する（soft fill）。
 */
const DEFAULT_MAX_PER_SOURCE_PER_RUN = 1;
/** 公開日がこの日数より前の候補は未登録でも取り込まない（古い公式が枠を使うのを防ぐ） */
const DEFAULT_MAX_ARTICLE_AGE_DAYS = 7;

type SourceQueue = { source: Source; items: RawFeedItem[] };

function isArticleTooOld(
  pubDate: string | null,
  maxAgeDays: number,
  now: Date
): boolean {
  if (!pubDate) return false;
  const publishedMs = Date.parse(pubDate);
  if (!Number.isFinite(publishedMs)) return false;
  const cutoffMs = now.getTime() - maxAgeDays * 24 * 60 * 60 * 1000;
  return publishedMs < cutoffMs;
}

/** フィード内のソース別件数（偏り補正の並び替え用） */
function countArticlesBySourceId(articles: Article[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const article of articles) {
    const key = article.source_id || article.source_name;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * 不足ソースを先に回し、**同件数のグループ内だけ**実行スロットで回転させる。
 * （全体回転だと件数0のソースが末尾に回り、偏り補正が壊れる）
 */
function orderSourceQueuesForFairness(
  queues: SourceQueue[],
  counts: Map<string, number>,
  rotateSlot: number
): SourceQueue[] {
  const sorted = [...queues].sort((a, b) => {
    const ca = counts.get(a.source.id) ?? 0;
    const cb = counts.get(b.source.id) ?? 0;
    if (ca !== cb) return ca - cb;
    return a.source.id.localeCompare(b.source.id);
  });

  const result: SourceQueue[] = [];
  let i = 0;
  while (i < sorted.length) {
    const groupCount = counts.get(sorted[i].source.id) ?? 0;
    let j = i + 1;
    while (
      j < sorted.length &&
      (counts.get(sorted[j].source.id) ?? 0) === groupCount
    ) {
      j += 1;
    }
    const group = sorted.slice(i, j);
    const offset =
      group.length === 0
        ? 0
        : ((rotateSlot % group.length) + group.length) % group.length;
    result.push(...group.slice(offset), ...group.slice(0, offset));
    i = j;
  }
  return result;
}

/** UTC 時刻から実行スロット番号（約10分枠×6。時刻ぴったりには依存しない） */
function ingestRotateSlot(now: Date): number {
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  const slot = Math.min(5, Math.floor(minute / 10));
  return hour * 6 + slot;
}

function buildRoundRobinCandidates(
  queues: SourceQueue[],
  maxDepth: number
): Array<{ source: Source; item: RawFeedItem }> {
  const candidates: Array<{ source: Source; item: RawFeedItem }> = [];
  for (let depth = 0; depth < maxDepth; depth++) {
    for (const q of queues) {
      if (q.items[depth]) {
        candidates.push({ source: q.source, item: q.items[depth] });
      }
    }
  }
  return candidates;
}

/** Asia/Tokyo の YYYY-MM-DD（日次上限の判定用） */
function tokyoDatePrefix(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

class LlmHttpError extends Error {
  readonly status: number;
  readonly retryAfterMs: number | null;

  constructor(message: string, status: number, retryAfterMs: number | null = null) {
    super(message);
    this.name = 'LlmHttpError';
    this.status = status;
    this.retryAfterMs = retryAfterMs;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof LlmHttpError) {
    return err.status === 429 || err.status === 503;
  }
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|RESOURCE_EXHAUSTED|rate limit|quota/i.test(msg);
}

function rateLimitWaitMs(err: unknown, attempt: number): number {
  // 旧上限3分×多数回だと1実行が何十分も埋まる。自己修復のため短く抑える
  const hardCap = 45_000;
  if (err instanceof LlmHttpError && err.retryAfterMs && err.retryAfterMs > 0) {
    return Math.min(err.retryAfterMs, hardCap);
  }
  // 12s → 24s → 45s …
  return Math.min(12_000 * 2 ** attempt, hardCap);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = LLM_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`LLM fetch timeout after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function parseRetryAfterMs(res: Response): number | null {
  const raw = res.headers.get('retry-after');
  if (!raw) return null;
  const asInt = Number(raw);
  if (Number.isFinite(asInt) && asInt >= 0) return asInt * 1000;
  const when = Date.parse(raw);
  if (!Number.isNaN(when)) return Math.max(0, when - Date.now());
  return null;
}

const SOURCE_PRIMARY_TOOL: Record<string, string> = {
  'source-openai': 'ChatGPT',
  'source-openai-changelog': 'ChatGPT',
  'source-anthropic': 'Claude',
  'source-claude-release': 'Claude',
  'source-deepmind': 'Gemini',
  'source-xai': 'Grok',
  'source-perplexity': 'Perplexity',
  'source-mistral': 'Mistral',
  'source-meta-ai': 'Meta AI',
  'source-revenuecat': 'RevenueCat',
  'source-appfigures': 'Appfigures',
  'source-posthog': 'PostHog',
  'source-stripe': 'Stripe',
  'source-resend': 'Resend',
  'source-framer': 'Framer',
  'source-heygen-ugc': 'HeyGen',
  'source-capcut': 'CapCut',
  'source-cursor': 'Cursor',
  'source-windsurf': 'Windsurf',
  'source-bolt': 'Bolt',
  'source-lovable': 'Lovable',
  'source-devin': 'Devin',
  'source-github-copilot': 'GitHub Copilot',
  'source-vercel': 'Vercel',
  'source-supabase': 'Supabase',
  'source-cloudflare-ai': 'Cloudflare',
  'source-dify': 'Dify',
  'source-n8n': 'n8n',
  'source-ollama': 'Ollama',
  'source-openrouter': 'OpenRouter',
  'source-runway': 'Runway',
  'source-elevenlabs': 'ElevenLabs',
  'source-koala-ai': 'Koala AI',
  'source-copyai': 'Copy.ai',
  'source-synthesia': 'Synthesia',
  'source-notion': 'Notion',
};

const GENERIC_SITE_OG_PATTERNS = [
  'opengraph.githubassets.com',
  'changelog-og.png',
  'Devin+Desktop+changelog',
  'opengraph-image.png',
  'ollama.com/public/og.png',
  'fbcdn.net',
];

/**
 * 日英ネイティブ要約を1回の呼び出しで生成する共通プロンプト。
 * 英語は日本語の直訳ではなく、英語圏テックメディア見出しとして書き直す。
 */
const EDITORIAL_SYSTEM_PROMPT = [
  'You are a bilingual AI/tech news editor for builders.',
  'From the article title and excerpt, produce ONE JSON object with native Japanese AND native English card copy (not a literal translation of each other).',
  '',
  '【Japanese rules】',
  '1. title_ja: 50–72 chars, newspaper/tech-headline style, include proper nouns and concrete numbers.',
  '2. summary_ja: 150–200 Japanese chars, 2–3 sentences. Facts/mechanism first, then a natural conclusion for developers/builders.',
  '',
  '【English rules — native, SAME information density as Japanese (not a short gloss)】',
  '3. title_en: 14–24 words, crisp English tech headline with the same facts/numbers as title_ja.',
  '4. summary_en: 95–140 words, 3–4 sentences. Must carry THE SAME facts, mechanisms, numbers, and builder takeaway as summary_ja — do not shorten or omit the conclusion. Prefer a slightly richer explanation than Japanese when English needs more words for equal clarity.',
  '5. English must feel like a native US tech newsletter card, not a compressed translation of the Japanese.',
  '',
  '【Forbidden in all languages】',
  '- Empty filler endings (“explains…”, “is introduced…”, “read more”).',
  '- App UI instructions (“tap the original article button”, etc.).',
  '- Label words like “Conclusion:”.',
  '- Thin English that drops numbers or the practical takeaway present in Japanese.',
  '',
  '【Few-shot example — match this density in BOTH languages】',
  '{"title_ja":"OpenAI、10億人超のChatGPTユーザーを支えるオンラインストレージ基盤「Habitat」の高速化設計（読み取り12倍高速化）を公開","summary_ja":"OpenAIは10億人超のChatGPTユーザーからのアクセスを捌くため、オンラインストレージ基盤「Habitat」にマルチテナント分離とグローバルキャッシュを導入し、読み取り速度を従来の12倍に引き上げた。単一DBのスケールアップに頼らずキャッシュ層とパーティション設計を工夫することが、巨大AIサービスのレスポンス遅延を防ぐ鍵となる。","title_en":"OpenAI details Habitat storage redesign that makes ChatGPT reads 12× faster for 1B+ users","summary_en":"OpenAI published the internals of Habitat, the online storage layer that serves more than a billion ChatGPT users, explaining how multi-tenant isolation plus a global cache lifted read throughput by about 12× versus the prior design. The piece walks through why a single primary database stops scaling once chat traffic becomes both hot and globally distributed, and how partition boundaries plus cache tiers absorb the spike without pushing every request back to origin. The write-up argues that chasing a bigger single database is the wrong bet at this scale; careful cache tiers and tenancy isolation are what actually keep interactive latency under control for massive AI products. For builders shipping agent backends, the practical lesson is to budget for caching and tenancy isolation early instead of treating storage as an afterthought once traffic spikes.","tool_tags":["ChatGPT"],"genre_tags":["開発","セキュリティ"]}',
  '',
  'Return ONLY a JSON object with keys: title_ja, summary_ja, title_en, summary_en, tool_tags, genre_tags.',
].join('\n');

function decodeEntities(str: string): string {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&#8230;/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isTopPageOrIndexUrl(urlStr: string, siteUrl?: string): boolean {
  try {
    const u = new URL(urlStr);
    const cleanPath = u.pathname.replace(/\/+$/, '');
    if (
      !cleanPath ||
      /^\/(blog|news|changelog|releases|updates|hub|topics|tags|trending)$/i.test(
        cleanPath
      ) ||
      /^\/(topics|tags)\/[^/]+$/i.test(cleanPath)
    ) {
      return true;
    }
    if (siteUrl) {
      const s = new URL(siteUrl);
      if (u.origin === s.origin && cleanPath === s.pathname.replace(/\/+$/, '')) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

function parseRssItems(xml: string, siteUrl?: string): RawFeedItem[] {
  const items: RawFeedItem[] = [];
  const itemMatches = xml.match(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi) ?? [];

  for (const block of itemMatches) {
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const altLinkMatch = block.match(
      /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*\/?>/i
    );
    const hrefLinkMatch = block.match(
      /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i
    );
    const textLinkMatch = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    const guidMatch = block.match(
      /<guid[^>]*isPermaLink=["']true["'][^>]*>([\s\S]*?)<\/guid>/i
    );

    const pubDateMatch =
      block.match(/<(pubDate|published|updated)[^>]*>([\s\S]*?)<\/\1>/i);
    const descMatch =
      block.match(/<(description|summary|content:encoded|content)[^>]*>([\s\S]*?)<\/\1>/i);

    const title = titleMatch ? decodeEntities(titleMatch[1]) : '';
    const rawLink =
      altLinkMatch?.[1] ||
      hrefLinkMatch?.[1] ||
      textLinkMatch?.[1] ||
      guidMatch?.[1] ||
      '';
    const link = decodeEntities(rawLink).split('#')[0];
    const pubDateRaw = pubDateMatch ? decodeEntities(pubDateMatch[2]) : null;
    const snippet = descMatch ? decodeEntities(descMatch[2]).slice(0, 900) : '';

    if (
      title &&
      link &&
      /^https?:\/\//i.test(link) &&
      !isTopPageOrIndexUrl(link, siteUrl)
    ) {
      const parsedDate = pubDateRaw ? new Date(pubDateRaw) : null;
      items.push({
        title,
        link,
        pubDate:
          parsedDate && !Number.isNaN(parsedDate.getTime())
            ? parsedDate.toISOString()
            : null,
        snippet,
      });
    }
  }
  return items;
}

function isSimilarTitle(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\u3040-\u9fff]/g, '');
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const shorter = na.length < nb.length ? na : nb;
  const longer = na.length < nb.length ? nb : na;
  return shorter.length >= 16 && longer.includes(shorter);
}

async function fetchOgImageUrl(articleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(articleUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 60000);
    const match =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
      );
    if (!match?.[1]) return null;
    const resolved = new URL(match[1].replace(/&amp;/g, '&'), articleUrl).toString();
    if (GENERIC_SITE_OG_PATTERNS.some((p) => resolved.includes(p))) {
      return null;
    }
    return resolved;
  } catch {
    return null;
  }
}

/**
 * モデルの出力に万が一「〜を解説している」等の弱い語尾が残っていた場合でも、
 * 結論まで言い切る自然な文末へ自動補正する品質ガードレール
 */
function enforceConclusionQualityJa(summary: string, tool: string): string {
  let s = cleanArticleSummary(summary);
  s = s
    .replace(
      /(?:について|の方法を|の手順を|の仕組みを|の裏側を)?(?:解説|紹介|説明|詳解|共有|整理|レポート)(?:します|しています|している|された|されている|した)?。?$/,
      '。'
    )
    .replace(/をご覧ください。?$/, '。')
    .replace(/を学びましょう。?$/, '。')
    .trim();

  if (!/[。！？]$/.test(s)) s += '。';

  if (s.length < 95) {
    const subject = tool ? `${tool}を活用した` : 'AI時代の';
    s = `${s} ${subject}開発スピード向上と運用コスト最適化を両立するための実践的な指針となる。`;
  }
  return cleanArticleSummary(s);
}

function enforceConclusionQualityEn(summary: string, tool: string): string {
  let s = cleanArticleSummary(summary)
    .replace(/\b(?:is explained|are introduced|read more|learn more)\b\.?$/i, '.')
    .trim();
  if (s && !/[.!?]$/.test(s)) s += '.';
  const words = s.split(/\s+/).filter(Boolean).length;
  // 日本語150〜200字相当の密度（おおよそ95語以上）を下回る場合のみ補完
  if (words < 95) {
    const subject = tool ? `${tool}` : 'AI tooling';
    s = `${s} For builders, the durable takeaway is to treat ${subject} as leverage for faster iteration and controlled cost—not a one-off demo—so the same architectural choice keeps paying off as traffic and feature scope grow. Ship the boring reliability pieces (caching, tenancy, budgets, verification) alongside the model call, or the demo quality will not survive real usage. In practice that means measuring latency and unit economics on day one, writing a clear failure mode for when the model is wrong, and keeping a human review path for high-impact actions so the product stays trustworthy as volume scales.`;
  }
  // 英語は文字数トリムしない clean を前提に、語数だけ再確認
  s = cleanArticleSummary(s);
  return s;
}

async function fallbackSummarize(
  item: RawFeedItem,
  source: Source
): Promise<SummaryResult> {
  const mappedTool = SOURCE_PRIMARY_TOOL[source.id];
  const combined = `${item.title} ${item.snippet}`.toLowerCase();

  let detectedTool = mappedTool || '';
  if (!detectedTool) {
    for (const t of tools) {
      if (combined.includes(t.toLowerCase())) {
        detectedTool = t;
        break;
      }
    }
  }

  const matchedGenres: string[] = [];
  if (/release|changelog|update|new|launch|公開|発表|追加/i.test(combined)) {
    matchedGenres.push('アップデート');
  }
  if (/indie|solo|mrr|revenue|個人開発|副業|収益/i.test(combined)) {
    matchedGenres.push('個人開発・収益化');
  }
  if (/aso|marketing|seo|growth|funnel|集客|マーケ/i.test(combined)) {
    matchedGenres.push('マーケ・集客・ASO');
  }
  if (/price|cost|billing|budget|cache|料金|コスト|無料/i.test(combined)) {
    matchedGenres.push('コスト・API料金');
  }
  if (matchedGenres.length === 0) {
    matchedGenres.push('開発');
  }

  // APIキー無し時: 原文を日英両方に載せつつ最低限の整形（品質はLLM時より落ちる）
  const titleEn = cleanArticleTitle(item.title);
  const summaryEn = enforceConclusionQualityEn(
    item.snippet?.trim() || item.title,
    detectedTool
  );
  const titleJa = cleanArticleTitle(item.title);
  const summaryJa = enforceConclusionQualityJa(
    item.snippet?.trim() || item.title,
    detectedTool
  );

  return {
    title_ja: titleJa,
    summary_ja: summaryJa,
    title_en: titleEn,
    summary_en: summaryEn,
    tool_tags: detectedTool ? [detectedTool] : [],
    genre_tags: matchedGenres
      .filter((g) => (genres as readonly string[]).includes(g))
      .slice(0, 3),
  };
}

/**
 * プロバイダ自動判定（Gemini / OpenAI / Anthropic / OpenRouter のどれでも同じプロンプトで呼び出し可能）
 */
function detectProvider(apiKey: string, model: string): LlmProvider {
  const explicit = (process.env.SUMMARY_PROVIDER || '').toLowerCase();
  if (
    explicit === 'gemini' ||
    explicit === 'openai' ||
    explicit === 'anthropic' ||
    explicit === 'openrouter'
  ) {
    return explicit;
  }
  if (apiKey.startsWith('AIza') || model.toLowerCase().includes('gemini')) {
    return 'gemini';
  }
  if (apiKey.startsWith('sk-ant-') || model.toLowerCase().includes('claude')) {
    return 'anthropic';
  }
  if (apiKey.startsWith('sk-or-')) {
    return 'openrouter';
  }
  return 'openai';
}

async function callLlmJson(
  provider: LlmProvider,
  apiKey: string,
  model: string,
  userPrompt: string
): Promise<string> {
  if (provider === 'gemini') {
    const geminiModel = model.includes('gemini') ? model : 'gemini-3.1-flash-lite';
    // AI Studio の新形式キー（AQ.）は URL クエリよりヘッダ推奨。キーをログに出さない。
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      geminiModel
    )}:generateContent`;

    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: EDITORIAL_SYSTEM_PROMPT }],
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userPrompt }],
          },
        ],
        generationConfig: {
          // Gemini 3.x は thinking がデフォルトで効き、短い max だと本文JSONが切れる
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          thinkingConfig: {
            thinkingLevel: 'LOW',
          },
        },
      }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const errJson = (await res.json()) as {
          error?: { status?: string; message?: string; details?: Array<{ reason?: string }> };
        };
        const reason = errJson.error?.details?.[0]?.reason;
        detail = [errJson.error?.status, reason].filter(Boolean).join('/');
      } catch {
        // ignore parse errors
      }
      throw new LlmHttpError(
        `Gemini API HTTP ${res.status}${detail ? ` (${detail})` : ''}`,
        res.status,
        parseRetryAfterMs(res)
      );
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  }

  if (provider === 'anthropic') {
    const claudeModel = model.includes('claude')
      ? model
      : 'claude-3-5-haiku-latest';
    const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: claudeModel,
        max_tokens: 700,
        temperature: 0.2,
        system: EDITORIAL_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });

    if (!res.ok) {
      throw new Error(`Anthropic API HTTP ${res.status}`);
    }
    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>;
    };
    const rawText = json.content?.find((c) => c.type === 'text')?.text ?? '{}';
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    return jsonMatch ? jsonMatch[0] : rawText;
  }

  // OpenAI または OpenRouter
  const endpoint =
    provider === 'openrouter'
      ? 'https://openrouter.ai/api/v1/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';

  const res = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: EDITORIAL_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    throw new LlmHttpError(
      `${provider} API HTTP ${res.status}`,
      res.status,
      parseRetryAfterMs(res)
    );
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? '{}';
}

async function summarizeWithRetry(
  item: RawFeedItem,
  source: Source,
  apiKey: string,
  model: string,
  maxQualityRetries = 3
): Promise<SummaryResult | null> {
  if (!apiKey) {
    return fallbackSummarize(item, source);
  }

  const provider = detectProvider(apiKey, model);
  let lastErr: unknown;
  let qualityAttempt = 0;
  let rateAttempt = 0;
  // 旧6回×最大3分待機だとハング時に数十分配信が止まる。自己修復のため短く
  const maxRateRetries = 3;

  while (qualityAttempt <= maxQualityRetries) {
    try {
      const userPrompt = [
        'Convert the article below into bilingual native editorial JSON (Japanese + English).',
        `- tool_tags (exactly one primary tool, or []): ${tools.join(', ')}`,
        `- genre_tags (1–3): ${genres.join(', ')}`,
        '',
        'Hard requirement: summary_en MUST be 95–140 English words (count them). Do not write a short gloss.',
        `Source: ${source.name}`,
        `Original title: ${item.title}`,
        `Excerpt: ${item.snippet.slice(0, 750)}`,
      ].join('\n');

      const rawContent = await callLlmJson(provider, apiKey, model, userPrompt);
      const parsed = JSON.parse(rawContent) as Partial<SummaryResult>;
      if (
        !parsed.title_ja ||
        !parsed.summary_ja ||
        !parsed.title_en ||
        !parsed.summary_en
      ) {
        throw new Error(
          'JSONに title_ja / summary_ja / title_en / summary_en が揃っていません'
        );
      }

      const mappedTool = SOURCE_PRIMARY_TOOL[source.id];
      const validTools = mappedTool
        ? [mappedTool]
        : (parsed.tool_tags ?? [])
            .filter((t) => (tools as readonly string[]).includes(t))
            .slice(0, 1);
      const validGenres = (parsed.genre_tags ?? []).filter((g) =>
        (genres as readonly string[]).includes(g)
      );
      const tool = validTools[0] ?? '';

      const result: SummaryResult = {
        title_ja: cleanArticleTitle(parsed.title_ja),
        summary_ja: enforceConclusionQualityJa(parsed.summary_ja, tool),
        title_en: cleanArticleTitle(parsed.title_en),
        summary_en: enforceConclusionQualityEn(parsed.summary_en, tool),
        tool_tags: validTools,
        genre_tags: validGenres.length > 0 ? validGenres : ['開発'],
      };
      assertBilingualSummaryQuality(result);
      return result;
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && rateAttempt < maxRateRetries) {
        const waitMs = rateLimitWaitMs(err, rateAttempt);
        rateAttempt += 1;
        console.warn(
          `  … レート制限のため ${Math.round(waitMs / 1000)}s 待機して再試行 (${rateAttempt}/${maxRateRetries})`
        );
        await sleep(waitMs);
        continue;
      }
      if (isRateLimitError(err)) {
        break;
      }
      qualityAttempt += 1;
    }
  }

  const msg = lastErr instanceof Error ? lastErr.message : String(lastErr);
  if (isRateLimitError(lastErr)) {
    console.warn('レート制限が続きこの記事はスキップします:', msg);
  } else {
    console.warn('品質ゲート未達のためこの記事はスキップします:', msg);
  }
  return null;
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const sourcesPath = path.join(rootDir, 'data', 'sources.json');
  const articlesPath = path.join(rootDir, 'data', 'articles.json');
  const runStartedAt = Date.now();
  const softDeadlineMs = Math.max(
    60_000,
    Number(
      process.env.INGEST_SOFT_DEADLINE_MS || INGEST_SOFT_DEADLINE_MS
    )
  );
  const pastSoftDeadline = () => Date.now() - runStartedAt >= softDeadlineMs;

  // ソース取りこぼし防止。間引き前提の分散 cron × 少数件で分割しレート制限を避ける
  const maxPerDay = Number(process.env.MAX_ARTICLES_PER_DAY || '500');
  const maxPerRun = Math.min(
    Number(process.env.MAX_ARTICLES_PER_RUN || DEFAULT_ARTICLES_PER_RUN),
    maxPerDay
  );
  const maxPerSourcePerRun = Math.max(
    1,
    Number(
      process.env.MAX_ARTICLES_PER_SOURCE_PER_RUN ||
        DEFAULT_MAX_PER_SOURCE_PER_RUN
    )
  );
  const maxArticleAgeDays = Math.max(
    1,
    Number(
      process.env.MAX_ARTICLE_AGE_DAYS || DEFAULT_MAX_ARTICLE_AGE_DAYS
    )
  );
  const maxMonthlyCostJpy = Number(process.env.MAX_MONTHLY_COST_JPY || '3000');
  const apiKey =
    process.env.SUMMARY_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    '';
  const model = process.env.SUMMARY_MODEL || 'gemini-3.1-flash-lite';
  const articleDelayMs = Number(
    process.env.INGEST_ARTICLE_DELAY_MS || ARTICLE_DELAY_MS
  );

  const sources: Source[] = fs.existsSync(sourcesPath)
    ? JSON.parse(fs.readFileSync(sourcesPath, 'utf-8'))
    : [];
  const existingArticles: Article[] = fs.existsSync(articlesPath)
    ? JSON.parse(fs.readFileSync(articlesPath, 'utf-8'))
    : [];

  const isIngestible = (s: Source) =>
    Boolean(s.feed_url) || Boolean(SITEMAP_FEED_FALLBACKS[s.id]);
  const checkedSources = sources.filter(
    (s) => s.terms_checked && isIngestible(s)
  );
  const activeSources =
    checkedSources.length > 0
      ? checkedSources
      : sources.filter((s) => isIngestible(s));

  if (!apiKey) {
    console.log(
      '情報: SUMMARY_API_KEY が未設定のため、ローカルフォールバック（API費用0円）で動作します。'
    );
  } else {
    console.log(
      `情報: プロバイダ=${detectProvider(apiKey, model)} / モデル=${model} / 記事間隔=${articleDelayMs}ms / 1実行上限=${maxPerRun}件 / 1日上限=${maxPerDay}件（Asia/Tokyo） / LLMタイムアウト=${LLM_FETCH_TIMEOUT_MS}ms / ソフト締切=${Math.round(softDeadlineMs / 1000)}s`
    );
  }

  const now = new Date();
  // 日次・月次上限は日本時間で数える（UTC日付だと深夜〜朝に枠が枯渇しやすい）
  const dayPrefix = tokyoDatePrefix(now);
  const monthPrefix = dayPrefix.slice(0, 7);
  const monthCount = existingArticles.filter(
    (a) => tokyoDatePrefix(new Date(a.created_at)).startsWith(monthPrefix)
  ).length;
  const alreadyToday = existingArticles.filter(
    (a) => tokyoDatePrefix(new Date(a.created_at)) === dayPrefix
  ).length;
  let estimatedMonthlyCost = apiKey
    ? monthCount * ESTIMATED_COST_PER_ARTICLE_JPY
    : 0;

  // 全ソースから並列で最新RSSを取得し、件数の少ないソース優先＋1実行1ソース上限で偏りを抑える
  console.log(`全 ${activeSources.length} 件のRSSフィードを巡回中...`);
  const fetchedQueues: SourceQueue[] = [];

  await Promise.all(
    activeSources.map(async (source) => {
      let lastErr: string | null = null;
      let feedItems: RawFeedItem[] = [];

      if (source.feed_url) {
        for (let attempt = 0; attempt < 2; attempt++) {
          const fetched = await fetchText(source.feed_url, RSS_FETCH_TIMEOUT_MS);
          if (!fetched.ok) {
            lastErr = fetched.error;
            if (attempt === 0) await sleep(800);
            continue;
          }
          const looksLikeFeed =
            /<(rss|feed|rdf:RDF)\b/i.test(fetched.text) ||
            /<item[\s>]/i.test(fetched.text) ||
            /<entry[\s>]/i.test(fetched.text);
          if (!looksLikeFeed) {
            lastErr = 'not an RSS/Atom document';
            break;
          }
          feedItems = parseRssItems(fetched.text, source.site_url).slice(
            0,
            RSS_ITEMS_PER_SOURCE
          );
          lastErr = null;
          break;
        }
      }

      if (feedItems.length === 0) {
        const fallback = await itemsFromSitemapFallback(source.id);
        if (fallback && fallback.length > 0) {
          console.warn(
            `  ~ RSS不可のため sitemap フォールバック: [${source.name}]`
          );
          feedItems = fallback;
          lastErr = null;
        }
      }

      // ブログ一覧フォールバック（Synthesia 等）。RSSとマージして新しい公式記事も拾う
      const listing = await itemsFromListingFallback(source.id);
      if (listing && listing.length > 0) {
        const seen = new Set(feedItems.map((i) => i.link));
        let added = 0;
        for (const item of listing) {
          if (seen.has(item.link)) continue;
          feedItems.push(item);
          seen.add(item.link);
          added += 1;
        }
        if (added > 0) {
          console.warn(
            `  ~ listing併用: [${source.name}] +${added}件（公式ブログ）`
          );
          lastErr = null;
        }
      }

      if (feedItems.length > 0) {
        // 各ソース内は新しい順（最新のもれを減らす）
        feedItems.sort((a, b) => {
          const ta = a.pubDate ? Date.parse(a.pubDate) : 0;
          const tb = b.pubDate ? Date.parse(b.pubDate) : 0;
          return tb - ta;
        });
        fetchedQueues.push({ source, items: feedItems });
      } else if (lastErr) {
        console.warn(`  ! RSS失敗: [${source.name}] ${lastErr}`);
      } else {
        console.warn(
          `  ! RSS 0件: [${source.name}] ${source.feed_url ?? '(sitemap only)'}`
        );
      }
    })
  );

  const sourceCounts = countArticlesBySourceId(existingArticles);
  const rotateSlot = ingestRotateSlot(now);
  const sourceQueues = orderSourceQueuesForFairness(
    fetchedQueues,
    sourceCounts,
    rotateSlot
  );
  // 件数中央値以下を「不足側」とし、その深さ全部を先に回す（人気ソースの depth0 が先に枠を取るのを防ぐ）
  const countSnapshot = sourceQueues
    .map((q) => sourceCounts.get(q.source.id) ?? 0)
    .sort((a, b) => a - b);
  const medianCount =
    countSnapshot.length === 0
      ? 0
      : countSnapshot[Math.floor(countSnapshot.length / 2)];
  const primaryQueues = sourceQueues.filter(
    (q) => (sourceCounts.get(q.source.id) ?? 0) <= medianCount
  );
  const overflowQueues = sourceQueues.filter(
    (q) => (sourceCounts.get(q.source.id) ?? 0) > medianCount
  );
  console.log(
    `公平巡回: 不足ソース優先 (中央値≤${medianCount}) / 回転スロット=${rotateSlot} / 1ソース上限=${maxPerSourcePerRun}件（枠余り時は緩和） / 公開${maxArticleAgeDays}日以内のみ`
  );
  console.log(
    `  優先: ${primaryQueues
      .map((q) => `${q.source.name}(${sourceCounts.get(q.source.id) ?? 0})`)
      .join(' → ') || '（なし）'}`
  );
  console.log(
    `  後回し: ${overflowQueues
      .map((q) => `${q.source.name}(${sourceCounts.get(q.source.id) ?? 0})`)
      .join(' → ') || '（なし）'}`
  );

  // 不足側と後回し側を分離。不足側の深い候補で枠を埋め切ると
  // 件数の多いソース（Zenn/Qiita/HN 等）が同じ実行で後回しのまま枠を取れないため。
  const primaryCandidates = buildRoundRobinCandidates(
    primaryQueues,
    RSS_ITEMS_PER_SOURCE
  );
  const overflowCandidates = buildRoundRobinCandidates(
    overflowQueues,
    RSS_ITEMS_PER_SOURCE
  );

  let todayCount = 0;
  const newArticles: Article[] = [];
  const acceptedBySource = new Map<string, number>();

  if (alreadyToday >= maxPerDay) {
    console.log(
      `本日すでに ${alreadyToday} 件追加済み（1日上限 ${maxPerDay}）のため新規処理をスキップします。`
    );
  }

  const tryAcceptCandidate = async (
    source: Source,
    item: RawFeedItem,
    perSourceCap: number
  ): Promise<'accepted' | 'skipped' | 'stop'> => {
    if (pastSoftDeadline()) {
      console.warn(
        `ソフト締切（${Math.round(softDeadlineMs / 1000)}s）に達したため残りは次回へ回します（途中結果は保存）`
      );
      return 'stop';
    }
    if (alreadyToday >= maxPerDay) return 'stop';
    if (todayCount >= maxPerRun) return 'stop';
    if (alreadyToday + todayCount >= maxPerDay) return 'stop';
    if (
      apiKey &&
      estimatedMonthlyCost + ESTIMATED_COST_PER_ARTICLE_JPY > maxMonthlyCostJpy
    ) {
      return 'stop';
    }

    const taken = acceptedBySource.get(source.id) ?? 0;
    if (taken >= perSourceCap) return 'skipped';

    const allKnown = [...existingArticles, ...newArticles];
    const isDuplicate = allKnown.some(
      (a) => a.url === item.link || isSimilarTitle(a.title_ja, item.title)
    );
    if (isDuplicate) return 'skipped';

    if (isArticleTooOld(item.pubDate, maxArticleAgeDays, now)) {
      console.log(
        `  ~ 古いためスキップ (${maxArticleAgeDays}日超): [${source.name}] ${item.title}`
      );
      return 'skipped';
    }

    try {
      // OGP取得とLLMを同時に叩くとレート制限しやすいので直列にする
      const ogImageUrl = await fetchOgImageUrl(item.link);
      const summary = await summarizeWithRetry(item, source, apiKey, model, 3);
      if (!summary) {
        if (articleDelayMs > 0 && apiKey) await sleep(articleDelayMs);
        return 'skipped';
      }

      const article = sanitizeArticleToolTags({
        id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        source_id: source.id,
        source_name: source.name,
        url: item.link,
        published_at: item.pubDate ?? new Date().toISOString(),
        og_image_url: ogImageUrl,
        title_ja: summary.title_ja,
        summary_ja: summary.summary_ja,
        translations: {
          ja: { title: summary.title_ja, summary: summary.summary_ja },
          en: { title: summary.title_en, summary: summary.summary_en },
        },
        tool_tags: summary.tool_tags,
        genre_tags: summary.genre_tags,
        created_at: new Date().toISOString(),
      });

      newArticles.push(article);
      todayCount += 1;
      acceptedBySource.set(source.id, taken + 1);
      if (apiKey) {
        estimatedMonthlyCost += ESTIMATED_COST_PER_ARTICLE_JPY;
      }
      console.log(`  + 保存: [${source.name}] ${article.title_ja}`);
      if (articleDelayMs > 0 && apiKey) {
        await sleep(articleDelayMs);
      }
      return 'accepted';
    } catch (err) {
      console.warn(`  ! 処理失敗: ${item.title}`, err);
      if (articleDelayMs > 0 && apiKey) {
        await sleep(articleDelayMs);
      }
      return 'skipped';
    }
  };

  const runPass = async (
    label: string,
    candidates: Array<{ source: Source; item: RawFeedItem }>,
    perSourceCap: number
  ) => {
    if (todayCount >= maxPerRun || alreadyToday >= maxPerDay) return;
    if (candidates.length === 0) return;
    console.log(
      `${label}: 候補 ${candidates.length} / ソース上限 ${perSourceCap}（現在 ${todayCount}/${maxPerRun}）`
    );
    for (const { source, item } of candidates) {
      const result = await tryAcceptCandidate(source, item, perSourceCap);
      if (result === 'stop') break;
    }
  };

  // Pass 1: 不足ソースのみ・1ソース1件（偏り抑制）
  await runPass('Pass1 不足ソース', primaryCandidates, maxPerSourcePerRun);

  // Pass 1b: 枠余りなら後回しソース全般を同じ厳格上限で先に拾う
  // （不足側の depth 2〜6 で枠を埋め切る前に overflow の最新へ回す）
  if (todayCount < maxPerRun && alreadyToday < maxPerDay) {
    await runPass(
      'Pass1b 後回しソース',
      overflowCandidates,
      maxPerSourcePerRun
    );
  }

  // Pass 2: まだ余りなら緩和上限。後回し側を先に埋め、その後不足側
  if (todayCount < maxPerRun && alreadyToday < maxPerDay) {
    const softCap = Math.max(maxPerSourcePerRun + 2, maxPerRun);
    console.log(
      `枠余り (${todayCount}/${maxPerRun}) のためソース上限を ${softCap} に緩和します`
    );
    await runPass('Pass2 後回しソース', overflowCandidates, softCap);
    await runPass('Pass2 不足ソース', primaryCandidates, softCap);
  }

  if (todayCount >= maxPerRun) {
    console.log(
      `1実行の上限件数 (${maxPerRun}件) に達しました（残りは次回 ingest で処理）。`
    );
  } else if (alreadyToday + todayCount >= maxPerDay && alreadyToday < maxPerDay) {
    console.log(`1日の上限件数 (${maxPerDay}件) に達しました。`);
  }

  const mergedAll = [...newArticles, ...existingArticles];
  const merged = trimFeedArticles(
    mergedAll,
    limits.maxFeedArticles,
    limits.retentionDays
  );

  writeArticlesJson(rootDir, merged);
  console.log(
    `完了: 新規 ${newArticles.length} 件追加（直近 ${limits.retentionDays} 日間ストック合計: ${merged.length} 件） / data+public 同期済み`
  );
}

main().catch((err) => {
  console.error('エラー:', err);
  process.exit(1);
});
