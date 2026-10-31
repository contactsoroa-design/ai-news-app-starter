/**
 * 前回成功したリモートフィードを端末に1件だけ保持する。
 * 起動時の即表示と ETag 条件付きGET用。最新取得で丸ごと上書きし、古い記事は残さない。
 */
import {
  cacheDirectory,
  documentDirectory,
  EncodingType,
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
} from 'expo-file-system/legacy';
import type { Article } from './types';

export type FeedDiskCache = {
  url: string;
  etag: string | null;
  lastModified: string | null;
  fetchedAt: number;
  articles: Article[];
};

const FILE_NAME = 'feed-cache-v1.json';

function cacheFileUri(): string | null {
  const base = cacheDirectory ?? documentDirectory;
  if (!base) return null;
  return `${base}${FILE_NAME}`;
}

function isValidCache(parsed: unknown): parsed is FeedDiskCache {
  if (!parsed || typeof parsed !== 'object') return false;
  const c = parsed as FeedDiskCache;
  return (
    typeof c.url === 'string' &&
    typeof c.fetchedAt === 'number' &&
    Array.isArray(c.articles)
  );
}

export async function readFeedDiskCache(): Promise<FeedDiskCache | null> {
  const uri = cacheFileUri();
  if (!uri) return null;
  try {
    const info = await getInfoAsync(uri);
    if (!info.exists) return null;
    const raw = await readAsStringAsync(uri, {
      encoding: EncodingType.UTF8,
    });
    const parsed: unknown = JSON.parse(raw);
    if (!isValidCache(parsed) || parsed.articles.length === 0) return null;
    return {
      url: parsed.url,
      etag: parsed.etag ?? null,
      lastModified: parsed.lastModified ?? null,
      fetchedAt: parsed.fetchedAt,
      articles: parsed.articles,
    };
  } catch {
    return null;
  }
}

/** 最新フィードで上書き（追記しない）。失敗しても本編の表示は続ける。 */
export async function writeFeedDiskCache(cache: FeedDiskCache): Promise<void> {
  const uri = cacheFileUri();
  if (!uri) return;
  try {
    await writeAsStringAsync(uri, JSON.stringify(cache), {
      encoding: EncodingType.UTF8,
    });
  } catch {
    // 容量不足等では黙ってスキップ（次回リモート取得で再試行）
  }
}
