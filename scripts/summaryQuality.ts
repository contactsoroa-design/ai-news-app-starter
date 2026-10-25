/**
 * 日英ネイティブ要約の品質ゲート（日本語カードと同密度を英語でも要求する）
 */

export type BilingualSummaryFields = {
  title_ja: string;
  summary_ja: string;
  title_en: string;
  summary_en: string;
};

const JA_TITLE_MIN = 40;
const JA_TITLE_MAX = 80;
const JA_SUMMARY_MIN = 140;
const JA_SUMMARY_MAX = 240;
const EN_TITLE_WORDS_MIN = 12;
const EN_TITLE_WORDS_MAX = 28;
const EN_SUMMARY_WORDS_MIN = 95;
const EN_SUMMARY_WORDS_MAX = 145;

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function hasJapanese(text: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9faf]/.test(text);
}

function hasLatin(text: string): boolean {
  return /[A-Za-z]/.test(text);
}

/**
 * 品質を満たさなければ Error を投げる（ingest のリトライ対象になる）
 */
export function assertBilingualSummaryQuality(
  fields: BilingualSummaryFields
): void {
  const {
    title_ja: titleJa,
    summary_ja: summaryJa,
    title_en: titleEn,
    summary_en: summaryEn,
  } = fields;

  if (!hasJapanese(titleJa) || !hasJapanese(summaryJa)) {
    throw new Error('日本語要約に日本語スクリプトが不足しています');
  }
  if (titleJa.length < JA_TITLE_MIN || titleJa.length > JA_TITLE_MAX) {
    throw new Error(
      `title_ja の長さが範囲外です (${titleJa.length}字 / ${JA_TITLE_MIN}–${JA_TITLE_MAX})`
    );
  }
  if (summaryJa.length < JA_SUMMARY_MIN || summaryJa.length > JA_SUMMARY_MAX) {
    throw new Error(
      `summary_ja の長さが範囲外です (${summaryJa.length}字 / ${JA_SUMMARY_MIN}–${JA_SUMMARY_MAX})`
    );
  }

  const titleEnWords = wordCount(titleEn);
  const summaryEnWords = wordCount(summaryEn);
  if (!hasLatin(titleEn) || !hasLatin(summaryEn)) {
    throw new Error('英語要約にラテン文字が不足しています');
  }
  if (hasJapanese(titleEn) || hasJapanese(summaryEn)) {
    throw new Error('英語要約に日本語が混入しています');
  }
  if (titleEnWords < EN_TITLE_WORDS_MIN || titleEnWords > EN_TITLE_WORDS_MAX) {
    throw new Error(
      `title_en の語数が範囲外です (${titleEnWords}語 / ${EN_TITLE_WORDS_MIN}–${EN_TITLE_WORDS_MAX})`
    );
  }
  if (
    summaryEnWords < EN_SUMMARY_WORDS_MIN ||
    summaryEnWords > EN_SUMMARY_WORDS_MAX
  ) {
    throw new Error(
      `summary_en の語数が範囲外です (${summaryEnWords}語 / ${EN_SUMMARY_WORDS_MIN}–${EN_SUMMARY_WORDS_MAX})`
    );
  }

  // 中身のない締めを拒否
  if (
    /解説している|紹介されている|ご覧ください|read more|is introduced/i.test(
      `${summaryJa} ${summaryEn}`
    )
  ) {
    throw new Error('要約に禁止フィラー表現が含まれています');
  }
}

/**
 * 既存 articles.json の英語密度を集計する（CI や手元確認用）
 */
export function summarizeCorpusQuality(
  articles: Array<{
    title_ja: string;
    summary_ja: string;
    translations?: {
      en?: { title?: string; summary?: string };
    };
  }>
): {
  total: number;
  withEn: number;
  enBelowMin: number;
  avgEnWords: number;
} {
  let withEn = 0;
  let enBelowMin = 0;
  let enWordSum = 0;
  for (const a of articles) {
    const en = a.translations?.en;
    if (!en?.title || !en?.summary) continue;
    withEn += 1;
    const w = wordCount(en.summary);
    enWordSum += w;
    if (w < EN_SUMMARY_WORDS_MIN) enBelowMin += 1;
  }
  return {
    total: articles.length,
    withEn,
    enBelowMin,
    avgEnWords: withEn > 0 ? enWordSum / withEn : 0,
  };
}
