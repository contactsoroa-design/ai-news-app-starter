import { Image } from 'expo-image';
import { limits } from './config';
import { isSponsoredItem } from './sponsored';
import type { Article, FeedCardItem } from './types';

/** 同一セッション内で既に prefetch した URL（再リクエスト抑制） */
const prefetchedUrls = new Set<string>();
const MAX_TRACKED_URLS = 400;

function trackUrls(urls: string[]): string[] {
  const fresh: string[] = [];
  for (const url of urls) {
    if (!url || prefetchedUrls.has(url)) continue;
    prefetchedUrls.add(url);
    fresh.push(url);
    if (prefetchedUrls.size > MAX_TRACKED_URLS) {
      const oldest = prefetchedUrls.values().next().value;
      if (oldest) prefetchedUrls.delete(oldest);
    }
  }
  return fresh;
}

function collectOgUrls(
  items: ReadonlyArray<Article | FeedCardItem>,
  fromIndex: number,
  count: number
): string[] {
  const urls: string[] = [];
  const start = Math.max(0, fromIndex);
  const end = Math.min(items.length, start + count);
  for (let i = start; i < end; i += 1) {
    const item = items[i];
    if (!item || isSponsoredItem(item)) continue;
    if (item.og_image_url) urls.push(item.og_image_url);
  }
  return urls;
}

/**
 * OGP を memory-disk に先読み（圧縮・縮小なし＝画質は表示時と同じ）。
 * 直近2枚を先に投げ、残りはマイクロタスクで続きを取る（帯域を現在カード優先）。
 */
export function prefetchOgImages(
  items: ReadonlyArray<Article | FeedCardItem>,
  fromIndex: number,
  count: number
): void {
  const fresh = trackUrls(collectOgUrls(items, fromIndex, count));
  if (fresh.length === 0) return;

  // 探索グリッドは一度に多く見えるので、先頭バッチをやや厚めに取る
  const urgent = fresh.slice(0, 6);
  const rest = fresh.slice(6);
  void Image.prefetch(urgent, { cachePolicy: 'memory-disk' });
  if (rest.length > 0) {
    queueMicrotask(() => {
      void Image.prefetch(rest, { cachePolicy: 'memory-disk' });
    });
  }
}

/** 表示中インデックス周辺（前後）の OGP をまとめて先読み */
export function prefetchOgAroundIndex(
  items: ReadonlyArray<Article | FeedCardItem>,
  index: number
): void {
  const behind = limits.imagePrefetchBehind;
  const ahead = limits.imagePrefetchAhead;
  const from = Math.max(0, index - behind);
  const count = behind + ahead;
  prefetchOgImages(items, from, count);
}

/** 探索グリッド用: 可視付近の記事 ID から OGP を先読み */
export function prefetchOgForArticles(
  articles: ReadonlyArray<Article>,
  maxCount: number = limits.imagePrefetchExploreVisible
): void {
  prefetchOgImages(articles, 0, maxCount);
}
