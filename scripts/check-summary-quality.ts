/**
 * data/articles.json の日英品質を検査する（CI / 手元確認）
 * 使い方: npm run quality:check
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { summarizeCorpusQuality } from './summaryQuality';
import type { Article } from '../src/lib/types';

const rootDir = path.resolve(__dirname, '..');
const articlesPath = path.join(rootDir, 'data', 'articles.json');
const articles: Article[] = JSON.parse(fs.readFileSync(articlesPath, 'utf-8'));
const stats = summarizeCorpusQuality(articles);

console.log(
  JSON.stringify(
    {
      ...stats,
      avgEnWords: Number(stats.avgEnWords.toFixed(1)),
    },
    null,
    2
  )
);

if (stats.withEn < stats.total) {
  console.error(
    `ERROR: 英語ネイティブ要約が無い記事が ${stats.total - stats.withEn} 件あります`
  );
  process.exit(1);
}
if (stats.enBelowMin > 0) {
  console.error(
    `ERROR: 英語要約が95語未満の記事が ${stats.enBelowMin} 件あります（日本語と同密度にしてください）`
  );
  process.exit(1);
}

console.log('OK: 日英ネイティブ要約の品質ゲートを通過しました');
