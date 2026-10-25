import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * data/articles.json と、Expo 開発サーバーが配信する public/articles.json を同じ内容で書き出す。
 * アプリは開発時に public/ を fetch するため、ingest/seed 後に再読み込みすれば新着が見える。
 * 形式は必ず Article[]（配列）。{ articles: [...] } で渡された場合は中身を取り出して書く。
 */
export function writeArticlesJson(
  rootDir: string,
  articles: unknown
): { dataPath: string; publicPath: string } {
  const list = Array.isArray(articles)
    ? articles
    : articles &&
        typeof articles === 'object' &&
        Array.isArray((articles as { articles?: unknown }).articles)
      ? (articles as { articles: unknown[] }).articles
      : null;
  if (!list) {
    throw new Error('writeArticlesJson expects Article[] (or { articles: Article[] })');
  }
  const payload = `${JSON.stringify(list, null, 2)}\n`;
  const dataPath = path.join(rootDir, 'data', 'articles.json');
  const publicPath = path.join(rootDir, 'public', 'articles.json');
  // GitHub raw のCDNキャッシュ回避用（本番 FEED_URL はこちらを向ける）
  const feedDataPath = path.join(rootDir, 'data', 'feed.json');
  const feedPublicPath = path.join(rootDir, 'public', 'feed.json');

  fs.mkdirSync(path.dirname(dataPath), { recursive: true });
  fs.mkdirSync(path.dirname(publicPath), { recursive: true });
  fs.writeFileSync(dataPath, payload, 'utf-8');
  fs.writeFileSync(publicPath, payload, 'utf-8');
  fs.writeFileSync(feedDataPath, payload, 'utf-8');
  fs.writeFileSync(feedPublicPath, payload, 'utf-8');

  return { dataPath, publicPath };
}
