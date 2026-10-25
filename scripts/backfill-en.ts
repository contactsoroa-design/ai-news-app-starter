/**
 * 既存 articles.json に英語ネイティブ要約（translations.en）を追加する。
 * 日本語要約を素材に、英語圏向けへ書き直す（直訳禁止）。
 *
 * 使い方: SUMMARY_API_KEY=... npx tsx scripts/backfill-en.ts
 */
import 'dotenv/config';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  cleanArticleSummary,
  cleanArticleTitle,
} from '../src/lib/feed';
import type { Article } from '../src/lib/types';
import { writeArticlesJson } from './lib/writeArticlesJson';

const ESTIMATED_COST_PER_ARTICLE_JPY = 0.08;

type LlmProvider = 'gemini' | 'openai' | 'anthropic' | 'openrouter';

const SYSTEM = [
  'You are a tech news editor writing native English card copy for builders.',
  'Rewrite the Japanese title and summary into natural English (NOT a literal translation).',
  'Match the SAME information density as the Japanese: keep every material fact, number, mechanism, and the builder takeaway. Do not shorten.',
  'Return ONLY JSON: {"title_en":"...","summary_en":"..."}',
  'title_en: 14–24 words. summary_en: 95–140 words, 3–4 sentences ending with a practical takeaway.',
  'No “read more”, no app UI instructions, no thin gloss that drops details present in Japanese.',
].join('\n');

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
  if (apiKey.startsWith('sk-ant')) return 'anthropic';
  if (model.toLowerCase().includes('openrouter') || apiKey.startsWith('sk-or')) {
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
    const geminiModel = model.includes('gemini') ? model : 'gemini-2.5-flash';
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
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
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
          error?: { status?: string; details?: Array<{ reason?: string }> };
        };
        detail = [errJson.error?.status, errJson.error?.details?.[0]?.reason]
          .filter(Boolean)
          .join('/');
      } catch {
        // ignore
      }
      throw new Error(`Gemini ${res.status}${detail ? ` (${detail})` : ''}`);
    }
    const json = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  }

  if (provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 800,
        system: SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
    if (!res.ok) throw new Error(`Anthropic ${res.status}`);
    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return json.content?.find((c) => c.type === 'text')?.text ?? '{}';
  }

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
      model,
      temperature: 0.35,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userPrompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI-compatible ${res.status}`);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return json.choices?.[0]?.message?.content ?? '{}';
}

function hasNativeEn(article: Article): boolean {
  const en = article.translations?.en;
  return Boolean(
    en?.title &&
      en?.summary &&
      /[A-Za-z]/.test(en.title) &&
      /[A-Za-z]/.test(en.summary) &&
      !/[\u3040-\u30ff]/.test(`${en.title}${en.summary}`)
  );
}

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const articlesPath = path.join(rootDir, 'data', 'articles.json');
  const apiKey =
    process.env.SUMMARY_API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.ANTHROPIC_API_KEY ||
    '';
  const model = process.env.SUMMARY_MODEL || 'gemini-2.5-flash';
  const limit = Number(process.env.BACKFILL_LIMIT || '9999');

  if (!apiKey) {
    console.error('SUMMARY_API_KEY（または各社キー）が必要です。');
    process.exit(1);
  }

  const articles: Article[] = JSON.parse(
    fs.readFileSync(articlesPath, 'utf-8')
  );
  const targets = articles.filter((a) => !hasNativeEn(a)).slice(0, limit);
  console.log(
    `対象: ${targets.length} / ${articles.length} 件（推定上限 roughly ${(
      targets.length * ESTIMATED_COST_PER_ARTICLE_JPY
    ).toFixed(1)} 円）`
  );

  const provider = detectProvider(apiKey, model);
  let done = 0;
  let failed = 0;

  for (const article of targets) {
    const jaTitle = article.translations?.ja?.title ?? article.title_ja;
    const jaSummary = article.translations?.ja?.summary ?? article.summary_ja;
    try {
      const raw = await callLlmJson(
        provider,
        apiKey,
        model,
        [
          `Japanese title: ${jaTitle}`,
          `Japanese summary: ${jaSummary}`,
          `Source: ${article.source_name}`,
        ].join('\n')
      );
      const parsed = JSON.parse(raw) as {
        title_en?: string;
        summary_en?: string;
      };
      if (!parsed.title_en || !parsed.summary_en) {
        throw new Error('incomplete JSON');
      }
      const titleEn = cleanArticleTitle(parsed.title_en);
      const summaryEn = cleanArticleSummary(parsed.summary_en);
      article.translations = {
        ...article.translations,
        ja: {
          title: jaTitle,
          summary: jaSummary,
        },
        en: { title: titleEn, summary: summaryEn },
      };
      done += 1;
      console.log(`  + ${done}: ${titleEn.slice(0, 72)}`);
      // 軽いレート制限
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      failed += 1;
      console.warn(`  ! 失敗: ${article.id}`, err);
    }
  }

  writeArticlesJson(rootDir, articles);
  console.log(
    `完了: 成功 ${done} / 失敗 ${failed}（推定費用 ~${(
      done * ESTIMATED_COST_PER_ARTICLE_JPY
    ).toFixed(1)} 円） / data+public 同期済み`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
