import type { AppLocale, Article, LocalizedArticleText } from './types';

/** ひらがな／カタカナ（漢字だけでは中国語と区別できない） */
function hasJapaneseKana(text: string): boolean {
  return /[\u3040-\u30ff]/.test(text);
}

function hasLatinLetters(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/**
 * 日本語欄に中国語本文が入っていないか。
 * 漢字が多くかな比率が極端に低いとき true。
 */
export function looksLikeChineseNotJapanese(text: string): boolean {
  const han = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const kana = (text.match(/[\u3040-\u30ff]/g) || []).length;
  if (han < 12) return false;
  return kana / (han + kana) < 0.12;
}

/** 表示テキストが目標言語として妥当か */
export function looksLikeLocale(text: string, targetLocale: AppLocale): boolean {
  if (!text) return false;
  if (targetLocale === 'ja') {
    return hasJapaneseKana(text) && !looksLikeChineseNotJapanese(text);
  }
  return hasLatinLetters(text) && !hasJapaneseKana(text);
}

export function isAlreadyInLocale(text: string, targetLocale: AppLocale): boolean {
  if (!text) return true;
  return looksLikeLocale(text, targetLocale);
}

/** 記事の正規日本語テキスト（常に保持する原文） */
export function getCanonicalJapaneseText(article: Article): LocalizedArticleText {
  const stored = article.translations?.ja;
  if (
    stored?.title &&
    stored?.summary &&
    looksLikeLocale(`${stored.title}${stored.summary}`, 'ja')
  ) {
    return stored;
  }
  return {
    title: article.title_ja,
    summary: article.summary_ja,
  };
}

function getNativeEnglishText(article: Article): LocalizedArticleText | null {
  const en = article.translations?.en;
  if (
    en?.title &&
    en?.summary &&
    looksLikeLocale(en.title, 'en') &&
    looksLikeLocale(en.summary, 'en')
  ) {
    return en;
  }
  return null;
}

/**
 * 収集時に保存されたネイティブ要約を表示用フィールドへ載せる。
 * 端末側の機械翻訳は行わない（英語は ingest 時のネイティブ要約のみ）。
 */
export function localizeArticleForRegion(
  article: Article,
  targetLocale: AppLocale
): Article {
  const ja = getCanonicalJapaneseText(article);
  const withJa: Article = {
    ...article,
    translations: {
      ...article.translations,
      ja,
    },
  };

  if (targetLocale === 'ja') {
    return {
      ...withJa,
      title_ja: ja.title,
      summary_ja: ja.summary,
    };
  }

  const en = getNativeEnglishText(withJa);
  if (en) {
    return {
      ...withJa,
      title_ja: en.title,
      summary_ja: en.summary,
      translations: {
        ...withJa.translations,
        ja,
        en,
      },
    };
  }

  // 英語ネイティブ要約がまだ無い記事は日本語のまま表示（薄い機械翻訳はしない）
  return {
    ...withJa,
    title_ja: ja.title,
    summary_ja: ja.summary,
  };
}

/**
 * 記事リストを表示言語へ切り替える（同期・API呼び出しなし）
 */
export function localizeArticlesBatch(
  articles: Article[],
  targetLocale: AppLocale,
  options?: {
    onProgress?: (
      localizedSoFar: Article[],
      done: number,
      total: number
    ) => void;
  }
): Article[] {
  const result = articles.map((a) => localizeArticleForRegion(a, targetLocale));
  options?.onProgress?.(result, result.length, result.length);
  return result;
}

/**
 * 表示中の記事を canonical 日本語に戻してから、指定ロケールへ載せ替える。
 * （すでに英語表示中の title_ja を再度 localize しても壊れないようにする）
 */
export function relocalizeArticles(
  articles: Article[],
  targetLocale: AppLocale
): Article[] {
  const canonical = articles.map((article) => {
    const ja = getCanonicalJapaneseText(article);
    return {
      ...article,
      title_ja: ja.title,
      summary_ja: ja.summary,
      translations: {
        ...article.translations,
        ja,
      },
    };
  });
  return localizeArticlesBatch(canonical, targetLocale);
}

/**
 * @deprecated 端末側機械翻訳は廃止。ingest のフォールバック用に残す場合は scripts 側で完結させる。
 * 互換のため、原文をそのまま返す。
 */
export async function translateTextToLocale(
  rawText: string,
  _targetLocale: AppLocale
): Promise<string> {
  return rawText.trim();
}
