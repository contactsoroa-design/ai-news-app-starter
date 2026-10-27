/**
 * CI 用: 並行 ingest の push 衝突時に、手元の articles.json と
 * origin/main 上の articles.json を URL キーでマージして書き戻す。
 *
 * 使い方:
 *   node --import tsx scripts/merge-feed-on-push.ts /tmp/ours-articles.json
 *
 * ours 側（この実行で書いたフィード）と data/articles.json（いま checkout されている側）を
 * マージし、writeArticlesJson で data/public の4ファイルを同期する。
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { writeArticlesJson } from './lib/writeArticlesJson';
import { trimFeedArticles } from '../src/lib/feed';
import { limits } from '../src/lib/config';
import type { Article } from '../src/lib/types';

function readArticles(filePath: string): Article[] {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed: unknown = JSON.parse(raw);
  if (Array.isArray(parsed)) return parsed as Article[];
  if (
    parsed &&
    typeof parsed === 'object' &&
    Array.isArray((parsed as { articles?: unknown }).articles)
  ) {
    return (parsed as { articles: Article[] }).articles;
  }
  throw new Error(`Invalid articles JSON: ${filePath}`);
}

function articleKey(a: Article): string {
  return (a.url || a.id || '').trim();
}

function preferArticle(a: Article, b: Article): Article {
  const aCreated = Date.parse(a.created_at || '') || 0;
  const bCreated = Date.parse(b.created_at || '') || 0;
  if (aCreated !== bCreated) return aCreated >= bCreated ? a : b;
  const aPub = Date.parse(a.published_at || '') || 0;
  const bPub = Date.parse(b.published_at || '') || 0;
  return aPub >= bPub ? a : b;
}

function main(): void {
  const oursPath = process.argv[2];
  if (!oursPath) {
    console.error('Usage: merge-feed-on-push.ts <ours-articles.json>');
    process.exit(1);
  }
  const rootDir = path.resolve(__dirname, '..');
  const theirsPath = path.join(rootDir, 'data', 'articles.json');

  const ours = readArticles(oursPath);
  const theirs = fs.existsSync(theirsPath) ? readArticles(theirsPath) : [];

  const byKey = new Map<string, Article>();
  for (const a of theirs) {
    const k = articleKey(a);
    if (k) byKey.set(k, a);
  }
  for (const a of ours) {
    const k = articleKey(a);
    if (!k) continue;
    const prev = byKey.get(k);
    byKey.set(k, prev ? preferArticle(a, prev) : a);
  }

  const merged = trimFeedArticles(
    [...byKey.values()],
    limits.maxFeedArticles,
    limits.retentionDays
  );
  writeArticlesJson(rootDir, merged);
  console.log(
    `merged feed: ours=${ours.length} theirs=${theirs.length} → ${merged.length}`
  );
}

main();
