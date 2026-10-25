import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
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
/** 無料枠 Lite: 毎時実行で分割しつつ取りこぼしを減らす既定 */
const DEFAULT_ARTICLES_PER_RUN = 15;
/** 各RSSから見る最新件数（要約するのは maxPerRun まで） */
const RSS_ITEMS_PER_SOURCE = 6;

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
  if (err instanceof LlmHttpError && err.retryAfterMs && err.retryAfterMs > 0) {
    return Math.min(err.retryAfterMs, 180_000);
  }
  // 30s → 60s → 120s …（上限3分）
  return Math.min(30_000 * 2 ** attempt, 180_000);
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
  'source-midjourney': 'Midjourney',
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

    const res = await fetch(url, {
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
    const res = await fetch('https://api.anthropic.com/v1/messages', {
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

  const res = await fetch(endpoint, {
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
  const maxRateRetries = 6;

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

  // ソース取りこぼし防止。毎時 cron で分割取得してレート制限を避ける
  const maxPerDay = Number(process.env.MAX_ARTICLES_PER_DAY || '240');
  const maxPerRun = Math.min(
    Number(process.env.MAX_ARTICLES_PER_RUN || DEFAULT_ARTICLES_PER_RUN),
    maxPerDay
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

  const checkedSources = sources.filter(
    (s) => s.terms_checked && Boolean(s.feed_url)
  );
  const activeSources =
    checkedSources.length > 0
      ? checkedSources
      : sources.filter((s) => Boolean(s.feed_url));

  if (!apiKey) {
    console.log(
      '情報: SUMMARY_API_KEY が未設定のため、ローカルフォールバック（API費用0円）で動作します。'
    );
  } else {
    console.log(
      `情報: プロバイダ=${detectProvider(apiKey, model)} / モデル=${model} / 記事間隔=${articleDelayMs}ms / 1実行上限=${maxPerRun}件 / 1日上限=${maxPerDay}件（Asia/Tokyo）`
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

  // 全ソースから並列で最新RSSを取得し、特定のソースだけで枠が埋まらないよう「ラウンドロビン（1件ずつ均等）」で処理する
  console.log(`全 ${activeSources.length} 件のRSSフィードを巡回中...`);
  const sourceQueues: Array<{ source: Source; items: RawFeedItem[] }> = [];

  await Promise.all(
    activeSources.map(async (source) => {
      if (!source.feed_url) return;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6000);
        const res = await fetch(source.feed_url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        clearTimeout(timer);
        if (!res.ok) return;
        const xml = await res.text();
        // 最新寄りの候補を多めに拾い、1実行上限・1日上限で実際の要約件数は抑える
        const feedItems = parseRssItems(xml, source.site_url).slice(
          0,
          RSS_ITEMS_PER_SOURCE
        );
        if (feedItems.length > 0) {
          sourceQueues.push({ source, items: feedItems });
        }
      } catch {
        // 通信失敗したソースはスキップ
      }
    })
  );

  // ラウンドロビンで各ソースの1件目 → 2件目…の順に並べる（後半ソースの取りこぼしを防ぐ）
  const roundRobinCandidates: Array<{ source: Source; item: RawFeedItem }> = [];
  for (let depth = 0; depth < RSS_ITEMS_PER_SOURCE; depth++) {
    for (const q of sourceQueues) {
      if (q.items[depth]) {
        roundRobinCandidates.push({ source: q.source, item: q.items[depth] });
      }
    }
  }

  let todayCount = 0;
  const newArticles: Article[] = [];

  if (alreadyToday >= maxPerDay) {
    console.log(
      `本日すでに ${alreadyToday} 件追加済み（1日上限 ${maxPerDay}）のため新規処理をスキップします。`
    );
  }

  for (const { source, item } of roundRobinCandidates) {
    if (alreadyToday >= maxPerDay) {
      break;
    }
    if (todayCount >= maxPerRun) {
      console.log(
        `1実行の上限件数 (${maxPerRun}件) に達したため停止します（残りは次回 ingest で処理）。`
      );
      break;
    }
    if (alreadyToday + todayCount >= maxPerDay) {
      console.log(
        `1日の上限件数 (${maxPerDay}件) に達したため停止します。`
      );
      break;
    }
    if (
      apiKey &&
      estimatedMonthlyCost + ESTIMATED_COST_PER_ARTICLE_JPY > maxMonthlyCostJpy
    ) {
      console.log(
        `月間費用上限 (${maxMonthlyCostJpy}円) に達したため停止します。`
      );
      break;
    }

    const allKnown = [...existingArticles, ...newArticles];
    const isDuplicate = allKnown.some(
      (a) => a.url === item.link || isSimilarTitle(a.title_ja, item.title)
    );
    if (isDuplicate) continue;

    try {
      // OGP取得とLLMを同時に叩くとレート制限しやすいので直列にする
      const ogImageUrl = await fetchOgImageUrl(item.link);
      const summary = await summarizeWithRetry(item, source, apiKey, model, 3);
      if (!summary) {
        if (articleDelayMs > 0 && apiKey) await sleep(articleDelayMs);
        continue;
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
      if (apiKey) {
        estimatedMonthlyCost += ESTIMATED_COST_PER_ARTICLE_JPY;
      }
      console.log(`  + 保存: [${source.name}] ${article.title_ja}`);
    } catch (err) {
      console.warn(`  ! 処理失敗: ${item.title}`, err);
    }

    // 記事間に間隔を空けて 429 を予防（最終記事の後は不要だが単純化のため常に待つ）
    if (articleDelayMs > 0 && apiKey) {
      await sleep(articleDelayMs);
    }
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
