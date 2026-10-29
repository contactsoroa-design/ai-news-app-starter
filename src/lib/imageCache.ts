import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { Platform } from 'react-native';
import { limits } from './config';

const IMAGE_CACHE_TRIM_KEY = '@ai_news/image_cache_disk_trim_v1';

/**
 * OGP の memory-disk キャッシュが無制限に膨らまないよう上限を付ける。
 * 表示品質は変えず、古いキャッシュから捨てる（直近のスワイプ／探索は残りやすい）。
 */
export function configureImageDiskCache(): void {
  if (Platform.OS === 'web') return;
  try {
    Image.configureCache({
      maxDiskSize: limits.imageDiskCacheMaxBytes,
    });
  } catch {
    // 古いネイティブバイナリでは未対応のことがある
  }
}

/**
 * 上限導入前に溜まったディスクキャッシュを1回だけ整理する。
 * 次回表示は再取得になるが画質は同じ。以降は maxDiskSize で抑制。
 */
export async function trimImageDiskCacheOnce(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const done = await AsyncStorage.getItem(IMAGE_CACHE_TRIM_KEY);
    if (done === '1') return;
    await Image.clearDiskCache();
    await AsyncStorage.setItem(IMAGE_CACHE_TRIM_KEY, '1');
  } catch {
    // 失敗しても起動は続行。次回また試す
  }
}
