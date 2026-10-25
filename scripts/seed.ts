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
import { writeArticlesJson } from './lib/writeArticlesJson';

type SeedSource = {
  id?: string;
  name: string;
  site_url: string;
  kind?: string;
  category?: string;
  feed_url: string | null;
  icon_url: string | null;
  language: string;
  terms_checked: boolean;
  enabled_default: boolean;
};

type SeedArticle = {
  id: string;
  sample?: boolean;
  url_verified?: boolean;
  source_id?: string | null;
  source_name: string;
  url: string | null;
  published_at: string | null;
  title_ja: string;
  summary_ja: string;
  translations?: Article['translations'];
  tool_tags: string[];
  genre_tags: string[];
  og_image_url: string | null;
};

const GENERIC_SITE_OG_PATTERNS = [
  'opengraph.githubassets.com',
  'changelog-og.png',
  'Devin+Desktop+changelog',
  'opengraph-image.png',
  'ollama.com/public/og.png',
  'fbcdn.net',
];

function isArticleSpecificOgImage(ogUrl: string | null): boolean {
  if (!ogUrl) return false;
  return !GENERIC_SITE_OG_PATTERNS.some((pattern) => ogUrl.includes(pattern));
}

function main() {
  const rootDir = path.resolve(__dirname, '..');
  const seedSourcesPath = path.join(rootDir, 'data', 'sources.seed.json');
  const seedArticlesPath = path.join(rootDir, 'data', 'seed_articles.json');
  const outSourcesPath = path.join(rootDir, 'data', 'sources.json');

  const seedSources: SeedSource[] = JSON.parse(
    fs.readFileSync(seedSourcesPath, 'utf-8')
  );
  const seedArticles: SeedArticle[] = JSON.parse(
    fs.readFileSync(seedArticlesPath, 'utf-8')
  );

  const sourceNameToId = new Map<string, string>();
  const sourceIdToName = new Map<string, string>();

  const sources: Source[] = seedSources.map((src, idx) => {
    const id = src.id ?? `source-${idx + 1}`;
    sourceNameToId.set(src.name, id);
    sourceIdToName.set(id, src.name);
    return {
      id,
      name: src.name,
      site_url: src.site_url,
      kind: src.kind,
      category: src.category ?? 'その他',
      feed_url: src.feed_url,
      icon_url: src.icon_url,
      language: src.language,
      terms_checked: true,
      enabled_default: src.enabled_default ?? true,
    };
  });

  fs.writeFileSync(outSourcesPath, JSON.stringify(sources, null, 2) + '\n', 'utf-8');
  console.log(`data/sources.json: ${sources.length} 件のソースを書き出しました。`);

  const seenUrls = new Set<string>();
  const nowIso = new Date().toISOString();

  const validArticles: Article[] = [];

  for (const article of seedArticles) {
    if (!article.url || !/^https?:\/\//i.test(article.url)) continue;
    const cleanUrl = article.url.split('#')[0];
    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    let publishedAt = article.published_at;
    if (publishedAt && /^\d{4}-\d{2}-\d{2}$/.test(publishedAt)) {
      publishedAt = new Date(`${publishedAt}T12:00:00Z`).toISOString();
    }

    const resolvedSourceId =
      article.source_id ?? sourceNameToId.get(article.source_name) ?? null;
    // ソース別タブのチップ名とカード上の情報源名が100%一致するよう正規化する
    const canonicalSourceName =
      (resolvedSourceId && sourceIdToName.get(resolvedSourceId)) ||
      article.source_name;

    const cleanedTitle = cleanArticleTitle(article.title_ja);
    const cleanedSummary = cleanArticleSummary(
      article.summary_ja,
      cleanedTitle,
      canonicalSourceName
    );

    validArticles.push(
      sanitizeArticleToolTags({
        id: article.id,
        source_id: resolvedSourceId,
        source_name: canonicalSourceName,
        url: cleanUrl,
        published_at: publishedAt,
        og_image_url: isArticleSpecificOgImage(article.og_image_url)
          ? article.og_image_url
          : null,
        title_ja: cleanedTitle,
        summary_ja: cleanedSummary,
        translations: {
          ja: { title: cleanedTitle, summary: cleanedSummary },
          ...(article.translations?.en
            ? { en: article.translations.en }
            : {}),
        },
        tool_tags: article.tool_tags ?? [],
        genre_tags: article.genre_tags ?? [],
        created_at: nowIso,
      })
    );
  }

  const allArticles = trimFeedArticles(validArticles, limits.maxFeedArticles);

  writeArticlesJson(rootDir, allArticles);
  console.log(
    `data/articles.json + public/articles.json: 実在個別記事URL ${allArticles.length} 件（全ソース網羅・上限 ${limits.maxFeedArticles} 件）を書き出しました。`
  );
}

main();
