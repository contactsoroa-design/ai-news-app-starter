/**
 * アプリ内ブラウザ（長押し／元記事シート）表示中〜直後のフラグ。
 * 見た目の操作は変えず、フォアグラウンド復帰の silent フィード差し替えだけ遅らせる。
 */

let openDepth = 0;
let lastClosedAt = 0;

/** ブラウザを開く直前に呼ぶ */
export function beginInAppBrowserSession(): void {
  openDepth += 1;
}

/** openBrowserAsync が戻ったあとに呼ぶ */
export function endInAppBrowserSession(): void {
  openDepth = Math.max(0, openDepth - 1);
  if (openDepth === 0) {
    lastClosedAt = Date.now();
  }
}

/**
 * true のあいだは AppState の silent 更新をスキップする。
 * 閉じた直後も短く抑止し、リスト差し替えとネイティブ解放の競合を避ける。
 */
export function shouldDeferFeedSilentRefresh(
  cooldownMs: number = 3000
): boolean {
  if (openDepth > 0) return true;
  if (lastClosedAt > 0 && Date.now() - lastClosedAt < cooldownMs) {
    return true;
  }
  return false;
}
