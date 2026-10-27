import seedArticlesData from '../../data/articles.json';
import seedSourcesData from '../../data/sources.json';
import { env, limits } from './config';
import { localizeArticlesBatch } from './translate';
import { genres as allGenres, tools as allTools } from '../theme/tokens';
import type { AppLocale, Article, Source, UserPrefs } from './types';

/** 本番フィードのミラー候補（raw を優先し、jsDelivr は最後＝キャッシュ遅れ対策） */
const PRODUCTION_FEED_MIRRORS = [
  'https://raw.githubusercontent.com/contactsoroa-design/ai-news-app-starter/main/data/articles.json',
  'https://github.com/contactsoroa-design/ai-news-app-starter/raw/refs/heads/main/data/articles.json',
  'https://raw.githubusercontent.com/contactsoroa-design/ai-news-app-starter/main/data/feed.json',
  'https://cdn.jsdelivr.net/gh/contactsoroa-design/ai-news-app-starter@main/data/articles.json',
] as const;

/**
 * フィードJSONの取得先一覧。
 * EXPO_PUBLIC_FEED_URL 優先。未設定の開発時は Metro が配信する
 * public/articles.json を都度取得し、同梱 import のキャッシュを避ける。
 * （ingest 等の Node からもこのファイルを読むため、expo-constants は遅延 require）
 */
function resolveFeedUrls(): string[] {
  const urls: string[] = [];
  const pushUnique = (url: string) => {
    const trimmed = url.trim();
    if (trimmed && !urls.includes(trimmed)) urls.push(trimmed);
  };

  if (env.feedUrl) pushUnique(env.feedUrl);

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Constants = require('expo-constants').default as {
        expoConfig?: { hostUri?: string | null };
        manifest?: { debuggerHost?: string | null };
        manifest2?: { extra?: { expoGo?: { debuggerHost?: string | null } } };
      };
      const hostUri =
        Constants.expoConfig?.hostUri ||
        Constants.manifest2?.extra?.expoGo?.debuggerHost ||
        Constants.manifest?.debuggerHost ||
        null;
      if (hostUri) {
        pushUnique(`http://${hostUri}/articles.json`);
      }
    } catch {
      // Node スクリプトや Constants 未初期化時は同梱JSONへフォールバック
    }
  }

  // 本番ビルド（FEED_URL あり）でも raw CDN障害に備えミラーを末尾に足す
  if (env.feedUrl) {
    for (const mirror of PRODUCTION_FEED_MIRRORS) {
      pushUnique(mirror);
    }
  }

  return urls;
}

function withCacheBust(url: string): string {
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}_=${Date.now()}`;
}

/**
 * 見出しに含まれる余計な記号やプレフィックスノイズを除去する
 */
export function cleanArticleTitle(rawTitle: string): string {
  return String(rawTitle ?? '')
    .replace(/\s+/g, ' ')
    .replace(/\b(?:Read more|Continue reading)\b/gi, '')
    .replace(/続きを(?:みる|見る)|続きを読む/g, '')
    .trim();
}

/**
 * 要約文から「続きを見る」「右下の元記事ボタン〜」「The post ... appeared first on」等の
 * RSS定型ノイズや冒頭挨拶、中途半端な途切れ（「...」「…」）をすべて除去して整形する
 */
export function cleanArticleSummary(
  rawSummary: string,
  titleJa = '',
  sourceName = ''
): string {
  let s = String(rawSummary ?? '')
    // 1. アプリ独自の旧案内定型文・操作説明・汎用フィラー文を除去（入れ子のカギ括弧にも対応）
    .replace(/右下の「元記事」[^。]*。?/g, '')
    .replace(/^[^。]{1,60}で公開された「[\s\S]+?」の個別記事。\s*/g, '')
    .replace(/[^。]*による「[\s\S]+?」に関する技術・動向トピックを解説している。?/g, '')
    .replace(/[^。]*による「[\s\S]+?」の解説記事。背景や具体的な仕組み、開発・実務への活用ポイントがまとめられている。?/g, '')
    // 2. note・ブログ・海外RSS特有の「続きを見る」系ノイズを除去
    .replace(/続きを(?:みる|見る)|続きを読む|全文を(?:みる|見る)/g, '')
    .replace(/\b(?:Continue reading|Read more)\b\.?/gi, '')
    // 3. Product Hunt / Hacker News / GitHub Blog / WordPress 等のフッターノイズを除去
    .replace(/ディスカッション\s*[|｜]\s*リンク/g, '')
    .replace(/Discussion\s*[|｜]\s*Link/gi, '')
    .replace(/(?:ディスカッション\s*[|｜])?\s*リンク\s*$/g, '')
    .replace(/The post [\s\S]*$/i, '')
    .replace(/投稿 [\s\S]*?最初に[\s\S]*?掲載されました。?/g, '')
    .replace(/[^。]*?が最初に登場しました[\s\S]*$/g, '')
    .replace(/appeared first on [\s\S]*$/i, '')
    .replace(/ハッカーニュースの[\s\S]*$/g, '')
    .replace(/Comments URL:[\s\S]*$/i, '')
    // 4. 記事冒頭の挨拶・メタ注釈・URL・Markdown記号を除去
    .replace(/^!\s*この記事は、.*?元動画をご覧ください。\s*/g, '')
    .replace(/^※\s*この記事は.*?からの転載です。\s*/g, '')
    .replace(/^※\s*ペーパートレード.*?勧めるものではありません。\s*/g, '')
    .replace(/^この記事は AIHubMix が作成しました。[^。]*。\s*/g, '')
    .replace(/^内容は\s*\d{4}年\d+月\d+日時点の情報[^。]*。\s*/g, '')
    .replace(/^🌐\s*English\s*[｜|]\s*Español\s*/g, '')
    .replace(/^https?:\/\/\S+\s*/g, '')
    .replace(/^(?:はじめに|こんにちは[！!]?|どうも[^。]{0,30}です。)\s*/g, '')
    .replace(/^この記事の対象者\s*/g, '')
    .replace(/^0\.\s*前提[^。]*。\s*/g, '')
    .replace(/\bTL;DR\b\s*/gi, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[ ?[0-9a-f]{6,10} ?\]/gi, '')
    .replace(/共著:\s*\S+\[bot\]/gi, '')
    // 5. 連続空白や末尾の三点リーダーを整理
    .replace(/\s+/g, ' ')
    .replace(/(?:\.{2,}|…+)\s*$/g, '')
    .trim();

  // 同じ文が重複している場合は重複を除去
  const sentences = s
    .split(/(?<=[。！？!?])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (sentences.length > 1) {
    const uniqueSentences: string[] = [];
    for (const sent of sentences) {
      const normalized = sent.replace(/[。！？!?\s]/g, '');
      if (
        normalized &&
        !uniqueSentences.some((u) =>
          u.replace(/[。！？!?\s]/g, '').includes(normalized)
        )
      ) {
        uniqueSentences.push(sent);
      }
    }
    s = uniqueSentences.join(' ');
  }

  const isJapanese = /[\u3040-\u30ff\u4e00-\u9faf]/.test(s);
  const period = isJapanese ? '。' : '.';

  // 日本語カードは約240字で収める。英語は95–140語のため文字数カットしない
  // （以前は英語にも240字制限がかかり、要約が1文に潰れて品質ゲートに落ちていた）
  if (isJapanese && s.length > 240) {
    const sliced = s.slice(0, 240);
    const lastPeriod = Math.max(
      sliced.lastIndexOf('。'),
      sliced.lastIndexOf('！'),
      sliced.lastIndexOf('？')
    );
    if (lastPeriod >= 80) {
      s = sliced.slice(0, lastPeriod + 1).trim();
    } else {
      s = `${sliced.replace(/[、,・\s]+$/, '')}${period}`;
    }
  } else if (isJapanese && s.length > 0 && !/[。！？.!?」』)]$/.test(s)) {
    const lastPeriod = Math.max(s.lastIndexOf('。'), s.lastIndexOf('. '));
    if (lastPeriod >= 75 && s.length - lastPeriod <= 35) {
      s = s.slice(0, lastPeriod + (s[lastPeriod] === '。' ? 1 : 2)).trim();
    } else {
      s = `${s.replace(/[、,・\s]+$/, '')}${period}`;
    }
  } else if (!isJapanese && s.length > 0 && !/[.!?]$/.test(s)) {
    s = `${s.replace(/[,;\s]+$/, '')}.`;
  }

  return s;
}

export function detectDeviceDefaultLocale(): AppLocale {
  try {
    const intlLocale =
      Intl.DateTimeFormat().resolvedOptions().locale?.toLowerCase() ?? 'ja';
    if (intlLocale.startsWith('ja')) return 'ja';
    // 日本語以外の端末は英語ネイティブ要約を既定にする（ko/es は需要が出てから追加）
    if (intlLocale.startsWith('en')) return 'en';
    return 'en';
  } catch {
    return 'ja';
  }
}

/** 端末に残った旧ロケール（ko/es）をサポート言語へ正規化する */
export function normalizeAppLocale(value: unknown): AppLocale {
  if (value === 'ja' || value === 'en') return value;
  return 'en';
}

/** articles.json は配列、または誤って包まれた { articles: [...] } のどちらでも読む */
function unwrapArticlesPayload(data: unknown): Article[] {
  if (Array.isArray(data)) {
    return data as Article[];
  }
  if (
    data &&
    typeof data === 'object' &&
    Array.isArray((data as { articles?: unknown }).articles)
  ) {
    return (data as { articles: Article[] }).articles;
  }
  throw new Error('Invalid articles feed shape');
}

async function loadRawArticlesFromRemote(urls: string[]): Promise<Article[]> {
  let lastError: unknown;
  for (const url of urls) {
    try {
      const response = await fetch(withCacheBust(url));
      if (!response.ok) {
        lastError = new Error(`HTTP ${response.status} for ${url}`);
        continue;
      }
      return unwrapArticlesPayload(await response.json());
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('All feed URLs failed');
}

/**
 * Show HN / Product Hunt 等は記事リンクが外部サイトになるため、
 * site_url ドメイン一致チェックをしない。
 */
const AGGREGATOR_SOURCE_IDS = new Set([
  'source-hn',
  'source-producthunt-ai',
]);

function registrableDomain(hostname: string): string {
  const host = hostname.replace(/^www\./i, '').toLowerCase();
  const parts = host.split('.').filter(Boolean);
  if (parts.length <= 2) return host;
  return parts.slice(-2).join('.');
}

/** blog.langchain.com と langchain.com のような同一サイト内サブドメイン差を許容 */
function articleHostMatchesSource(articleUrl: string, siteUrl: string): boolean {
  const artHost = new URL(articleUrl).hostname.replace(/^www\./i, '');
  const siteHost = new URL(siteUrl).hostname.replace(/^www\./i, '');
  if (artHost === siteHost) return true;
  if (artHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${artHost}`)) {
    return true;
  }
  return registrableDomain(artHost) === registrableDomain(siteHost);
}

/**
 * 生の articles 配列をサニタイズ・ソート・ロケール適用する（同梱／リモート共通）
 */
function prepareArticles(
  rawArticles: Article[],
  targetLocale: AppLocale,
  onProgress?: (
    localizedSoFar: Article[],
    done: number,
    total: number
  ) => void
): Article[] {
  const sourceById = new Map<string, Source>(
    (seedSourcesData as Source[]).map((s) => [s.id, s])
  );

  const sanitized = rawArticles
    .filter((art) => {
      if (!art.source_id || !art.url) return true;
      const src = sourceById.get(art.source_id);
      if (!src) return true;
      // HN / PH は元記事が外部ドメインになるのが正常
      if (AGGREGATOR_SOURCE_IDS.has(src.id)) return true;
      try {
        // 公式系は同一登録ドメイン（サブドメイン差含む）のみ残す
        return articleHostMatchesSource(art.url, src.site_url);
      } catch {
        return false;
      }
    })
    .map((art) => {
      const canonicalSourceName =
        (art.source_id && sourceById.get(art.source_id)?.name) ||
        art.source_name;
      // フィードJSONの原文は日本語。他言語へ汚さないよう、クリーンアップは日本語原文にだけ適用する
      const cleanedTitle = cleanArticleTitle(art.title_ja);
      const cleanedSummary = cleanArticleSummary(
        art.summary_ja,
        cleanedTitle,
        canonicalSourceName
      );
      const genreTags = Array.isArray(art.genre_tags)
        ? art.genre_tags.filter(
            (g): g is string => typeof g === 'string' && g.trim().length > 0
          )
        : [];
      return sanitizeArticleToolTags({
        ...art,
        source_name: canonicalSourceName,
        title_ja: cleanedTitle,
        summary_ja: cleanedSummary,
        genre_tags: genreTags,
        translations: {
          ...art.translations,
          ja: { title: cleanedTitle, summary: cleanedSummary },
        },
      });
    });

  const sorted = trimFeedArticles(sortArticles(sanitized), limits.maxFeedArticles);
  return localizeArticlesBatch(sorted, targetLocale, { onProgress });
}

/**
 * 同梱 articles.json を同期で返す。起動直後にカードを出して OGP 先読みを始める用。
 */
export function getBundledArticles(
  targetLocale: AppLocale = 'ja'
): Article[] {
  return prepareArticles(
    unwrapArticlesPayload(seedArticlesData),
    targetLocale
  );
}

export async function fetchArticles(
  targetLocale: AppLocale = 'ja',
  onProgress?: (
    localizedSoFar: Article[],
    done: number,
    total: number
  ) => void
): Promise<Article[]> {
  let rawArticles: Article[];
  const feedUrls = resolveFeedUrls();
  if (feedUrls.length > 0) {
    try {
      rawArticles = await loadRawArticlesFromRemote(feedUrls);
    } catch {
      // リモート不通・壊れたJSONでも起動できるように同梱フィードへフォールバック
      rawArticles = unwrapArticlesPayload(seedArticlesData);
    }
  } else {
    rawArticles = unwrapArticlesPayload(seedArticlesData);
  }

  return prepareArticles(rawArticles, targetLocale, onProgress);
}

export function getAllSources(): Source[] {
  return seedSourcesData as Source[];
}

export function createDefaultUserPrefs(sources: Source[]): UserPrefs {
  return {
    enabled_source_ids: sources.filter((s) => s.enabled_default).map((s) => s.id),
    tools: [],
    genres: [],
    region_locale: 'ja',
    source_language: 'both',
    show_original_button: true,
    show_sponsored: true,
    updated_at: new Date().toISOString(),
  };
}

/**
 * 端末に保存された絞り込み設定を復元する。
 * ※ 以前は default の情報源を毎回 union しており、ユーザーが OFF にしたソースが起動のたびに復活していた。
 * 保存済みの enabled_source_ids / tools / genres は尊重する（空配列＝意図的な「すべて解除」も維持）。
 * アプリ更新で増えた新規ソースだけ、enabled_default なら追加する。
 */
export function hydrateUserPrefs(
  stored: UserPrefs | null | undefined,
  sources: Source[],
  fallbackLocale: AppLocale = 'ja'
): UserPrefs {
  const defaults = createDefaultUserPrefs(sources);
  const locale = normalizeAppLocale(
    stored?.region_locale ?? fallbackLocale
  );

  if (!stored) {
    return { ...defaults, region_locale: locale };
  }

  const knownIds = new Set(sources.map((s) => s.id));
  const storedEnabled = Array.isArray(stored.enabled_source_ids)
    ? stored.enabled_source_ids.filter((id) => knownIds.has(id))
    : defaults.enabled_source_ids;

  // 前回認識済みに無い新規ソースだけ enabled_default なら ON を足す
  // （初回移行時は seen が無いので、enabled に入っているIDを既知とみなす＝OFFを復活させない）
  const seenSourceIds = Array.isArray(stored.seen_source_ids)
    ? stored.seen_source_ids.filter((id) => knownIds.has(id))
    : [...storedEnabled];
  const seenSet = new Set(seenSourceIds);

  const newlyDefaultOn = sources
    .filter(
      (s) =>
        s.enabled_default && !seenSet.has(s.id) && !storedEnabled.includes(s.id)
    )
    .map((s) => s.id);

  const enabled_source_ids = Array.from(
    new Set([...storedEnabled, ...newlyDefaultOn])
  );

  const tools = Array.isArray(stored.tools)
    ? stored.tools.filter((t) => (allTools as readonly string[]).includes(t))
    : [];
  const genres = Array.isArray(stored.genres)
    ? stored.genres.filter((g) => (allGenres as readonly string[]).includes(g))
    : [];

  return {
    ...defaults,
    ...stored,
    region_locale: locale,
    enabled_source_ids,
    tools,
    genres,
    source_language:
      stored.source_language === 'ja' ||
      stored.source_language === 'en' ||
      stored.source_language === 'both'
        ? stored.source_language
        : defaults.source_language,
    show_original_button:
      typeof stored.show_original_button === 'boolean'
        ? stored.show_original_button
        : defaults.show_original_button,
    // 広告枠は常時表示（設定でのOFFは不可）
    show_sponsored: true,
    updated_at: stored.updated_at || defaults.updated_at,
    seen_source_ids: sources.map((s) => s.id),
  };
}

/**
 * おすすめ／探索の掛け算フィルタ用。ツールは公式検証タグ優先、なければ tool_tags。
 */
export function articleMatchesToolFilter(
  article: Article,
  selectedTools: readonly string[]
): boolean {
  if (selectedTools.length === 0) return true;
  const selected = new Set(selectedTools);
  const verified = getVerifiedArticleTool(article);
  if (verified && selected.has(verified)) return true;
  if ((article.tool_tags ?? []).some((t) => selected.has(t))) return true;
  return false;
}

/**
 * ジャンル絞り込み（複数選択は OR。未選択なら全ジャンル対象）。
 */
export function articleMatchesGenreFilter(
  article: Article,
  selectedGenres: readonly string[]
): boolean {
  if (!selectedGenres || selectedGenres.length === 0) return true;
  const tags = article.genre_tags ?? [];
  if (tags.length === 0) return false;
  const selected = new Set(selectedGenres);
  return tags.some((g) => selected.has(g));
}

/**
 * 絞り込み中のジャンルをカード表示用に優先して返す。
 */
export function getDisplayGenre(
  article: Article,
  highlightGenres: readonly string[] = []
): string {
  const tags = article.genre_tags ?? [];
  if (tags.length === 0) return '';
  if (highlightGenres.length > 0) {
    const hit = tags.find((g) => highlightGenres.includes(g));
    if (hit) return hit;
  }
  return tags[0] || '';
}

export function articleMatchesPrefsFilter(
  article: Article,
  prefs: UserPrefs,
  enabledSourceIds: ReadonlySet<string>
): boolean {
  if (article.source_id && !enabledSourceIds.has(article.source_id)) {
    return false;
  }
  if (!articleMatchesGenreFilter(article, prefs.genres ?? [])) {
    return false;
  }
  if (!articleMatchesToolFilter(article, prefs.tools ?? [])) {
    return false;
  }
  return true;
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

// 特定の単一ツール専用の公式ソースのみマッピング（汎用メディアやコミュニティは絶対に入れない）
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
  'source-midjourney': 'Midjourney',
  'source-notion': 'Notion',
};

// 各情報源（source_id）が表示を許可される公式ツール名の厳密な1対1（または1対2）マッピング。
// これ以外の汎用メディア（Starter Story, Marketing Examples, Zenn, Qiita, Product Hunt, GitHub Trending 等）の記事には
// 絶対に他社ツールのバナーを表示させず、必ずそのメディア自身のバナーを表示する。
const SOURCE_ALLOWED_TOOLS: Record<string, readonly string[]> = {
  'source-openai': ['ChatGPT'],
  'source-openai-changelog': ['ChatGPT'],
  'source-anthropic': ['Claude'],
  'source-claude-release': ['Claude'],
  'source-deepmind': ['Gemini'],
  'source-xai': ['Grok'],
  'source-perplexity': ['Perplexity'],
  'source-mistral': ['Mistral'],
  'source-meta-ai': ['Meta AI'],
  'source-revenuecat': ['RevenueCat'],
  'source-appfigures': ['Appfigures'],
  'source-posthog': ['PostHog'],
  'source-stripe': ['Stripe'],
  'source-resend': ['Resend'],
  'source-framer': ['Framer'],
  'source-heygen-ugc': ['HeyGen'],
  'source-capcut': ['CapCut'],
  'source-cursor': ['Cursor'],
  'source-windsurf': ['Windsurf'],
  'source-bolt': ['Bolt'],
  'source-lovable': ['Lovable'],
  'source-devin': ['Devin'],
  'source-github-copilot': ['GitHub Copilot'],
  'source-vercel': ['Vercel'],
  'source-supabase': ['Supabase'],
  'source-cloudflare-ai': ['Cloudflare'],
  'source-dify': ['Dify'],
  'source-n8n': ['n8n'],
  'source-ollama': ['Ollama'],
  'source-openrouter': ['OpenRouter'],
  'source-runway': ['Runway'],
  'source-elevenlabs': ['ElevenLabs'],
  'source-koala-ai': ['Koala AI'],
  'source-copyai': ['Copy.ai'],
  'source-midjourney': ['Midjourney'],
  'source-notion': ['Notion'],
};

/**
 * 記事が本当にそのツールの公式情報源の記事かを厳密に検証する。
 * Starter Story や Zenn などのメディア記事に CapCut や Claude のバナーが付くのを100%防止する。
 */
export function isToolRelevantToArticle(tool: string, article: Article): boolean {
  if (!tool || !article.source_id) return false;
  const allowedForSource = SOURCE_ALLOWED_TOOLS[article.source_id];
  if (!allowedForSource || !allowedForSource.includes(tool)) {
    return false;
  }
  // 1つのソースに2つのツール（HeyGen / CapCut）がある場合は、見出しに含まれる方を優先する
  if (allowedForSource.length > 1) {
    return article.title_ja.toLowerCase().includes(tool.toLowerCase());
  }
  return true;
}

/**
 * 記事に付与された tool_tags から、記事内容と無関係なツールタグを除去する。
 * 公式ソースでタグ欠落時は SOURCE_PRIMARY_TOOL を補完（ツール別チップ用）。
 */
export function sanitizeArticleToolTags(article: Article): Article {
  const primaryFromSource = article.source_id
    ? SOURCE_PRIMARY_TOOL[article.source_id]
    : undefined;
  const rawTags = [...(article.tool_tags ?? [])];
  if (primaryFromSource && !rawTags.includes(primaryFromSource)) {
    rawTags.unshift(primaryFromSource);
  }
  const validTools = rawTags.filter((t) => isToolRelevantToArticle(t, article));
  if (
    validTools.length === (article.tool_tags ?? []).length &&
    validTools.every((t, i) => t === (article.tool_tags ?? [])[i])
  ) {
    return article;
  }
  return {
    ...article,
    tool_tags: validTools,
  };
}

/**
 * バナーやカードに表示する主役ツール名を返す（関係ない場合は空文字を返し、ソース名・ジャンルバナーにする）
 */
export function getVerifiedArticleTool(
  article: Article,
  overrideTool?: string | null
): string {
  if (overrideTool && isToolRelevantToArticle(overrideTool, article)) {
    return overrideTool;
  }
  const primary = article.tool_tags[0];
  if (primary && isToolRelevantToArticle(primary, article)) {
    return primary;
  }
  return '';
}

/**
 * 最新のキュレーション済みフィード（リモート配信JSONまたはローカルのarticles.json）を再取得し、
 * ユーザーの地域設定（region_locale）に合わせてローカライズして返す。
 * （クライアント側での生RSS機械翻訳による低品質記事混入を防止）
 */
export async function fetchLiveRssUpdates(
  _sources: Source[],
  existingArticles: Article[],
  targetLocale: AppLocale = 'ja'
): Promise<{ articles: Article[]; addedCount: number }> {
  const latestCurated = await fetchArticles(targetLocale);
  const existingUrls = new Set(existingArticles.map((a) => a.url));
  const newlyAdded = latestCurated.filter((a) => !existingUrls.has(a.url));

  return {
    articles: latestCurated,
    addedCount: newlyAdded.length,
  };
}

/**
 * 直近30日（limits.retentionDays）以内の記事を件数制限なしで全件ストックし、
 * 31日以上前の古い記事を自動ローテーションして除外する。
 * また、30日間に更新が少なかったツールでもタブが空にならないよう各ツール最低件数（minArticlesPerTool）を保護する。
 */
export function trimFeedArticles(
  articles: Article[],
  safetyMaxCount: number = limits.maxFeedArticles,
  retentionDays: number = limits.retentionDays
): Article[] {
  const sorted = sortArticles(articles);
  if (sorted.length === 0) return [];

  // 最新記事のフィード時刻（または現在時刻）を基準に、直近30日間のカットオフ時刻を算出
  const newestMs = sorted[0] ? articleFeedTimestamp(sorted[0]) : Date.now();
  const referenceNowMs = Number.isNaN(newestMs)
    ? Date.now()
    : Math.max(Date.now(), newestMs);
  const cutoffMs = referenceNowMs - retentionDays * 24 * 60 * 60 * 1000;

  const keptIds = new Set<string>();
  const result: Article[] = [];

  // 1. まず直近30日以内（公開または取り込み）の記事をすべてストックする
  for (const article of sorted) {
    if (result.length >= safetyMaxCount) break;
    const feedMs = articleFeedTimestamp(article) || referenceNowMs;
    if (!Number.isNaN(feedMs) && feedMs >= cutoffMs) {
      keptIds.add(article.id);
      result.push(article);
    }
  }

  // 2. 万が一30日以内に更新が少なかったツールや情報源があっても、タブが空にならないよう最新記事を保護して残す
  const minPerTool = limits.minArticlesPerTool;
  for (const tool of allTools) {
    let countForTool = result.filter((a) => a.tool_tags[0] === tool).length;
    if (countForTool < minPerTool) {
      for (const article of sorted) {
        if (countForTool >= minPerTool || result.length >= safetyMaxCount) break;
        if (article.tool_tags[0] === tool && !keptIds.has(article.id)) {
          keptIds.add(article.id);
          result.push(article);
          countForTool++;
        }
      }
    }
  }

  for (const src of seedSourcesData as Source[]) {
    const hasSourceArticle = result.some((a) => a.source_id === src.id);
    if (!hasSourceArticle) {
      const rep = sorted.find((a) => a.source_id === src.id);
      if (rep && !keptIds.has(rep.id) && result.length < safetyMaxCount) {
        keptIds.add(rep.id);
        result.push(rep);
      }
    }
  }

  return sortArticles(result);
}

/**
 * フィード上の「新しさ」。原則は元記事の公開日。
 * created_at（取り込み時刻）で max すると、数日前〜数ヶ月前の公式投稿が
 * 再ingestされただけで先頭に上がる（Anthropic / 古い Windsurf 等）。
 * 公開日が無いときだけ取り込み時刻にフォールバックする。
 */
export function articleFeedTimestamp(article: Article): number {
  const published = article.published_at
    ? new Date(article.published_at).getTime()
    : NaN;
  if (Number.isFinite(published) && published > 0) {
    return published;
  }
  const created = article.created_at
    ? new Date(article.created_at).getTime()
    : 0;
  return Number.isFinite(created) ? created : 0;
}

function sortArticles(articles: Article[]): Article[] {
  return [...articles].sort(
    (a, b) => articleFeedTimestamp(b) - articleFeedTimestamp(a)
  );
}

export function formatShortDateJa(isoDate: string | null): string {
  return formatShortDate(isoDate, 'ja');
}

/** 表示言語に合わせた短い日付（UTC基準） */
export function formatShortDate(
  isoDate: string | null,
  locale: AppLocale = 'ja'
): string {
  if (!isoDate) return '';
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return '';
  if (locale === 'en') {
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  }
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export function getFaviconUrl(articleUrl: string): string | null {
  try {
    const parsed = new URL(articleUrl);
    if (parsed.hostname.endsWith('.invalid')) {
      return null;
    }
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=64`;
  } catch {
    return null;
  }
}

/**
 * カード上の情報源アイコン用。記事のリンク先ではなく source の公式 site_url を使う。
 * （HN 等のアグリゲータで GitHub/Medium など外部 favicon がばらつくのを防ぐ）
 */
export function getArticleSourceFaviconUrl(article: Article): string | null {
  if (article.source_id) {
    const src = (seedSourcesData as Source[]).find(
      (s) => s.id === article.source_id
    );
    if (src?.site_url) {
      return getFaviconUrl(src.site_url);
    }
  }
  return getFaviconUrl(article.url);
}
