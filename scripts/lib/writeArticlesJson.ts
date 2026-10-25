import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * data/articles.json と、Expo 開発サーバーが配信する public/articles.json を同じ内容で書き出す。
 * アプリは開発時に public/ を fetch するため、ingest/seed 後に再読み込みすれば新着が見える。
 */
export function writeArticlesJson(
  rootDir: string,
  articles: unknown
): { dataPath: string; publicPath: string } {
  const payload = `${JSON.stringify(articles, null, 2)}\n`;
  const dataPath = path.join(rootDir, 'data', 'articles.json');
  const publicPath = path.join(rootDir, 'public', 'articles.json');

  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(dataPath, payload, 'utf-8');
  fs.writeFileSync(publicPath, payload, 'utf-8');

  return { dataPath, publicPath };
}
