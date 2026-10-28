// アプリ共通の文言・設定値（直書きを避けるためここに集約）
import type { AppLocale } from './types';
import { genres as genreIds } from '../theme/tokens';
import { sourceKindLabelsEn } from './sourceKindLabelsEn';

export const regionLocales: ReadonlyArray<{
  code: AppLocale;
  label: string;
  regionName: string;
}> = [
  { code: 'ja', label: '日本語（日本）', regionName: '日本' },
  { code: 'en', label: 'English (US/Global)', regionName: 'US / Global' },
] as const;

const copyJa = {
  /** ホーム画面・アプリ内表示用の短い名前 */
  appName: 'Fast News AI',
  /** App Store 表示名（ASO: 生成AI・最新・速報を前方配置、30字以内） */
  storeName: 'Fast News AI - 生成AI・最新速報',
  /** ASC サブタイトル案（30字以内・名前と語を重複させない） */
  storeSubtitle: '公式まとめをスワイプで1枚要約',
  topTabs: {
    recommended: 'おすすめ',
    bySource: 'ソース別',
    byTool: 'ツール別',
  },
  chips: {
    all: 'すべて',
    edit: '＋ 編集',
    editAria: '情報源とツールを編集',
  },
  bottomTabs: {
    home: 'ホーム',
    explore: '探索',
    saved: '保存済み',
    settings: '設定',
  },
  rail: {
    save: '保存',
    saved: '保存済',
    share: '共有',
    openOriginal: '元記事',
    openOriginalAria: '元記事を開く',
    notInterested: '興味なし',
    relatedSponsor: '製品',
    relatedSponsorAria: (name: string) => `${name}の広告カードへ移動`,
  },
  card: {
    ogpFallbackLabel: '元記事のサムネイル（OGP画像）',
    longPressHint: '長押しで元記事へ',
    longPressAriaHint: '長押しすると元記事をブラウザで開きます',
    readFullSummary: '全文を見る',
    readFullSummaryAria: '要約の全文を表示する',
    closeFullSummary: '閉じる',
    openOriginalFromModal: '元記事をブラウザで開く',
    translatingBadge: '翻訳中...',
  },
  sponsored: {
    badge: '広告',
    badgeAria: 'スポンサー広告',
    cta: '公式へ',
    openCtaAria: 'スポンサーの公式ページを開く',
    longPressHint: '長押しで公式へ',
  },
  explore: {
    title: '探索（一覧）',
    subtitle: '気になる記事をタップするとカード表示で読めます',
    searchPlaceholder: 'AIニュース・ツール・キーワードを検索',
    clearSearchAria: '検索キーワードをクリア',
    emptySearchTitle: '一致するニュースが見つかりません',
    emptySearchDescription: '別のツール名やキーワードで検索してみてください。',
    defaultTag: 'AI動向',
    backToList: '‹ 探索一覧に戻る',
    backToListAria: '探索一覧に戻る',
    openSourceAria: 'この情報源のソース別フィードを開く',
  },
  saved: {
    title: '保存済み',
    subtitle:
      'この端末に保存したAIニュース。フィードや元記事から消えても、解除するまで端末内に残ります（オフライン可）',
    emptyTitle: '保存した記事はまだありません',
    emptyDescription:
      'フィード画面の右下にある「保存」を押すと、この端末内に記事データが残ります。フィードから外れても、解除するまで保存済みに残ります。',
    removeLabel: '解除',
    removeAria: '保存を解除',
    backToList: '‹ 保存済み一覧に戻る',
    backToListAria: '保存済み一覧に戻る',
  },
  settings: {
    title: '設定',
    subtitle: 'フィードのカスタマイズ・言語・表示設定',
    filterHeroBadge: 'おすすめフィードの絞り込み（掛け算フィルタ）',
    filterHeroTitle: '届くニュースを自分好みに絞り込む',
    filterHeroDesc:
      '「AIツール × ジャンル × 情報源（ソース）」を1つの画面で絞り込めます。選んだ条件の掛け算（AND条件）に一致するニュースが流れます。',
    unifiedActionTitle: 'ツール・ジャンル・情報源を絞り込む',
    unifiedActionSub: '1画面でAIツール・分野・購読メディアを掛け算で絞り込み',
    activeFilterHeading: '現在の絞り込み状態（掛け算適用中）',
    allToolsActive: '全ツール対象（34種）',
    allGenresActive: '全ジャンル対象（13分野）',
    sourcesSectionLabel: '情報源',
    sourcesCardTitle: 'ソース・ジャンル・ツール',
    regionLocaleLabel: '表示言語（日本語 / 英語のネイティブ要約）',
    displaySectionLabel: '表示オプション',
    showOriginalButtonLabel: '「元記事」ボタンを表示',
    showSponsoredLabel: 'スポンサー枠（常時表示）',
    hiddenExplainTitle: '「興味なし」について',
    hiddenExplain:
      'カード右下の「興味なし」を押すと、その記事だけフィードから非表示になります（この端末のみ）。間違えたときは「戻す」で復元できます。「完全に消す」を押すと戻せなくなり、非表示のままです。',
    hiddenResetLabel: '「興味なし」で非表示にした記事を戻す',
    hiddenResetButton: '戻す',
    hiddenPurgeLabel: '非表示を確定する（戻せなくする）',
    hiddenPurgeButton: '完全に消す',
    hiddenPurgeConfirmTitle: '完全に消しますか？',
    hiddenPurgeConfirmMessage:
      'いま非表示の記事は戻せなくなります。フィードにも再表示されません。',
    hiddenPurgeConfirmCancel: 'キャンセル',
    privacyNote:
      '保存済み・興味なし・地域設定はすべてこの端末内にのみ保存され、外部サーバーには送信されません。保存した記事はフィードから外れても、解除するまで端末に残ります。',
    legalSectionLabel: 'サポート・法務',
    openPrivacy: 'プライバシーポリシー',
    openTerms: '利用規約',
    /** 問い合わせ・要望・不具合はメール1本に集約 */
    sendFeedback: 'お問い合わせ・ご要望',
    sendFeedbackAria: 'メールでお問い合わせ・ご要望・不具合を送る',
    openLegalAria: (label: string) => `${label}をブラウザで開く`,
    toolsPrefix: 'ツール',
    genresPrefix: 'ジャンル',
    sourcesPrefix: '情報源',
    mediaOnSuffix: (on: number, total: number) =>
      `${on} / ${total} メディアON`,
    andMore: (n: number) => ` ほか+${n}`,
    matchingNewsSuffix: (n: number) => ` — 該当ニュース ${n}件`,
    hiddenCountSuffix: (n: number) => `（${n}件）`,
  },
  manage: {
    backToSettings: '‹ 設定に戻る',
    backToSettingsAria: '設定に戻る',
    unifiedTitle: 'フィードを絞り込む（掛け算フィルタ）',
    unifiedDesc:
      'ここで選んだ「① ジャンル × ② AIツール × ③ 情報源（ソース）」のすべてに一致するニュースが表示されます（未選択の項目は「すべて対象」になります）。',
    selectAll: 'すべてON',
    clearAll: 'すべて解除',
    genresHeading: '① ジャンル（分野）で絞る',
    genresSub: '複数選択可・未選択なら全分野が対象',
    toolsHeading: '② AIツール・モデルで絞る',
    toolsSub: '複数選択可・未選択なら全ツールが対象',
    sourcesHeading: '③ 購読する情報源（ソース）で絞る',
    sourcesSub: 'オンにしたメディアの記事だけを対象にする',
    previewHeading: 'いまの掛け算設定（①×②×③）で流れるニュース',
    previewAll: '全情報源 × 全ツール × 全ジャンルのAIニュース（フル表示）',
    applyAndStart: 'この設定でスワイプ開始',
    pendingSourceLabel: '準備中（利用条件を確認中）',
    otherCategory: 'その他',
    allSources: (n: number) => `全${n}情報源`,
    selectedSources: (n: number) => `選択した${n}情報源`,
    allToolsShort: '全ツール',
    allGenresShort: '全ジャンル',
    matchCountSuffix: (n: number) => `（該当 ${n}件）`,
    sourcesOnSuffix: (on: number, total: number) =>
      `（${on} / ${total}件ON）`,
    categoryOnSuffix: (on: number, total: number) =>
      `${on} / ${total} 件オン`,
  },
  emptyFeed: '条件に合うニュースがありません。情報源を編集してください',
  editSourcesButton: '情報源を編集',
  resetHiddenButton: '非表示を戻す',
  errorNetwork: '通信に失敗しました。接続を確認して再試行してください。',
  retryButton: '再読み込み',
  refreshingFeed: '最新のニュースを取得中…',
} as const;

type CopyShape = {
  -readonly [K in keyof typeof copyJa]: (typeof copyJa)[K] extends string
    ? string
    : (typeof copyJa)[K] extends (...args: infer A) => string
      ? (...args: A) => string
      : {
          -readonly [P in keyof (typeof copyJa)[K]]: (typeof copyJa)[K][P] extends (
            ...args: infer A
          ) => string
            ? (...args: A) => string
            : string;
        };
};

const copyEn: CopyShape = {
  appName: 'Fast News AI',
  storeName: 'Fast News AI - Generative AI briefs',
  storeSubtitle: 'Official digests, one swipe at a time',
  topTabs: {
    recommended: 'For you',
    bySource: 'By source',
    byTool: 'By tool',
  },
  chips: {
    all: 'All',
    edit: '+ Edit',
    editAria: 'Edit sources and tools',
  },
  bottomTabs: {
    home: 'Home',
    explore: 'Explore',
    saved: 'Saved',
    settings: 'Settings',
  },
  rail: {
    save: 'Save',
    saved: 'Saved',
    share: 'Share',
    openOriginal: 'Original',
    openOriginalAria: 'Open original article',
    notInterested: 'Not for me',
    relatedSponsor: 'Product',
    relatedSponsorAria: (name: string) => `Jump to ${name} sponsored card`,
  },
  card: {
    ogpFallbackLabel: 'Article thumbnail (OGP image)',
    longPressHint: 'Long-press for original',
    longPressAriaHint: 'Long-press to open the original article in a browser',
    readFullSummary: 'Read full summary',
    readFullSummaryAria: 'Show the full summary',
    closeFullSummary: 'Close',
    openOriginalFromModal: 'Open original article',
    translatingBadge: 'Translating…',
  },
  sponsored: {
    badge: 'Ad',
    badgeAria: 'Sponsored advertisement',
    cta: 'Official',
    openCtaAria: 'Open sponsor page',
    longPressHint: 'Long-press for sponsor',
  },
  explore: {
    title: 'Explore',
    subtitle: 'Tap a story to open it in card view',
    searchPlaceholder: 'Search AI news, tools, or keywords',
    clearSearchAria: 'Clear search',
    emptySearchTitle: 'No matching news',
    emptySearchDescription: 'Try another tool name or keyword.',
    defaultTag: 'AI news',
    backToList: '‹ Back to explore',
    backToListAria: 'Back to explore grid',
    openSourceAria: 'Open this source in the By Source feed',
  },
  saved: {
    title: 'Saved',
    subtitle:
      'AI news saved on this device. Stays here until you remove it—even if it leaves the feed or the original page (works offline)',
    emptyTitle: 'No saved articles yet',
    emptyDescription:
      'Tap Save on the lower right of the feed to keep an article on this device. It remains in Saved after it drops off the feed, until you remove it.',
    removeLabel: 'Remove',
    removeAria: 'Remove from saved',
    backToList: '‹ Back to saved list',
    backToListAria: 'Back to saved list',
  },
  settings: {
    title: 'Settings',
    subtitle: 'Feed, language, and display preferences',
    filterHeroBadge: 'Recommended feed filters (AND)',
    filterHeroTitle: 'Tune the news that reaches you',
    filterHeroDesc:
      'Filter by AI tool × genre × source on one screen. Only stories matching every selected condition appear.',
    unifiedActionTitle: 'Filter tools, genres, and sources',
    unifiedActionSub: 'Combine AI tools, topics, and publishers in one place',
    activeFilterHeading: 'Active filters (AND applied)',
    allToolsActive: 'All tools (34)',
    allGenresActive: 'All genres (13)',
    sourcesSectionLabel: 'Sources',
    sourcesCardTitle: 'Sources, genres, and tools',
    regionLocaleLabel: 'Display language (JA / EN native summaries)',
    displaySectionLabel: 'Display options',
    showOriginalButtonLabel: 'Show “Original” button',
    showSponsoredLabel: 'Sponsor cards (always on)',
    hiddenExplainTitle: 'About “Not for me”',
    hiddenExplain:
      'Tap “Not for me” on the lower-right of a card to hide that story from your feed on this device. Use Restore if you hid something by mistake. Hide permanently makes the change irreversible.',
    hiddenResetLabel: 'Restore articles marked “Not for me”',
    hiddenResetButton: 'Restore',
    hiddenPurgeLabel: 'Make hidden permanent',
    hiddenPurgeButton: 'Hide permanently',
    hiddenPurgeConfirmTitle: 'Hide permanently?',
    hiddenPurgeConfirmMessage:
      'Hidden stories cannot be restored and will stay out of your feed.',
    hiddenPurgeConfirmCancel: 'Cancel',
    privacyNote:
      'Saved items, hidden articles, and region settings stay on this device only and are never sent to a server. Saved articles remain after they leave the feed, until you remove them.',
    legalSectionLabel: 'Support & legal',
    openPrivacy: 'Privacy Policy',
    openTerms: 'Terms of Use',
    /** Single mailto for contact / requests / bugs */
    sendFeedback: 'Contact & feedback',
    sendFeedbackAria: 'Email support with questions, requests, or bugs',
    openLegalAria: (label: string) => `Open ${label} in browser`,
    toolsPrefix: 'Tools',
    genresPrefix: 'Genres',
    sourcesPrefix: 'Sources',
    mediaOnSuffix: (on: number, total: number) => `${on} / ${total} publishers on`,
    andMore: (n: number) => ` +${n} more`,
    matchingNewsSuffix: (n: number) => ` — ${n} matching articles`,
    hiddenCountSuffix: (n: number) => ` (${n})`,
  },
  manage: {
    backToSettings: '‹ Back to settings',
    backToSettingsAria: 'Back to settings',
    unifiedTitle: 'Filter your feed (AND)',
    unifiedDesc:
      'Stories must match every selected “① genre × ② AI tool × ③ source”. Unselected groups mean “all”.',
    selectAll: 'Turn all on',
    clearAll: 'Clear all',
    genresHeading: '① Filter by genre',
    genresSub: 'Multi-select · leave empty for all genres',
    toolsHeading: '② Filter by AI tool / model',
    toolsSub: 'Multi-select · leave empty for all tools',
    sourcesHeading: '③ Sources to follow',
    sourcesSub: 'Only articles from enabled publishers',
    previewHeading: 'News that will flow with ①×②×③',
    previewAll: 'All sources × all tools × all genres (full feed)',
    applyAndStart: 'Apply and start swiping',
    pendingSourceLabel: 'Pending (terms under review)',
    otherCategory: 'Other',
    allSources: (n: number) => `All ${n} sources`,
    selectedSources: (n: number) => `${n} sources selected`,
    allToolsShort: 'All tools',
    allGenresShort: 'All genres',
    matchCountSuffix: (n: number) => ` (${n} matches)`,
    sourcesOnSuffix: (on: number, total: number) => ` (${on} / ${total} on)`,
    categoryOnSuffix: (on: number, total: number) => `${on} / ${total} on`,
  },
  emptyFeed: 'No news matches your filters. Edit your sources.',
  editSourcesButton: 'Edit sources',
  resetHiddenButton: 'Restore hidden',
  errorNetwork: 'Couldn’t load the feed. Check your connection and try again.',
  retryButton: 'Reload',
  refreshingFeed: 'Fetching the latest news…',
};

export type AppCopy = CopyShape;

/** 表示言語に合わせた UI 文言 */
export function getCopy(locale: AppLocale = 'ja'): AppCopy {
  return locale === 'en' ? copyEn : copyJa;
}

/** 後方互換（日本語）。新規コードは getCopy(locale) を使う */
export const copy = copyJa;

const genreLabelsEn: Record<(typeof genreIds)[number], string> = {
  アップデート: 'Updates',
  '個人開発・収益化': 'Indie & monetization',
  'マーケ・集客・ASO': 'Marketing & ASO',
  'SNS・ショート動画': 'Social & short video',
  '課金・ペイウォール': 'Billing & paywalls',
  'コスト・API料金': 'Cost & API pricing',
  開発: 'Development',
  ビジネス: 'Business',
  画像生成: 'Image generation',
  動画: 'Video',
  音声: 'Audio',
  研究: 'Research',
  セキュリティ: 'Security',
};

/** 保存用ジャンルID（日本語）を表示言語のラベルへ */
export function getGenreLabel(genreId: string, locale: AppLocale = 'ja'): string {
  if (locale !== 'en') return genreId;
  return genreLabelsEn[genreId as (typeof genreIds)[number]] ?? genreId;
}

const sourceCategoryLabelsEn: Record<string, string> = {
  '主要AI・LLM公式': 'Major AI / LLM official',
  '個人開発マーケ・ASO・課金・グロース': 'Indie marketing, ASO, billing & growth',
  'AIエディタ・開発エージェント（個人開発定番）':
    'AI editors & coding agents',
  '個人開発インフラ・自動化・ローカルLLM':
    'Indie infra, automation & local LLM',
  '個人開発トレンド・収益化・ランキング':
    'Indie trends, monetization & rankings',
  'クリエイティブ・業務AIツール': 'Creative & productivity AI',
  '日本語メディア・個人開発コミュニティ': 'Japanese media & indie community',
  '研究・海外まとめ': 'Research & global digests',
  その他: 'Other',
};

/** 情報源カテゴリ名の表示用ラベル */
export function getSourceCategoryLabel(
  category: string,
  locale: AppLocale = 'ja'
): string {
  if (locale !== 'en') return category;
  return sourceCategoryLabelsEn[category] ?? category;
}

/** 情報源の表示名（英語UIでは「公式」などを Official に） */
const sourceNameLabelsEn: Record<string, string> = {
  'OpenAI 公式': 'OpenAI Official',
  'Anthropic 公式': 'Anthropic Official',
  'xAI (Grok) 公式': 'xAI (Grok) Official',
  'Mistral AI 公式': 'Mistral AI Official',
  'CapCut 公式（AI動画編集）': 'CapCut Official (AI video)',
  'Claude / Claude Code リリースノート': 'Claude / Claude Code Release Notes',
  'Framer Blog (AI LP制作)': 'Framer Blog (AI landing pages)',
  'Zenn (個人開発 × AI)': 'Zenn (Indie × AI)',
  'Zenn (AI・LLMトピック)': 'Zenn (AI / LLM)',
  'Qiita (AI・個人開発)': 'Qiita (AI / Indie)',
  'note (AI・個人開発マガジン)': 'note (AI / Indie magazine)',
  'BenchLM（モデル動向）': 'BenchLM (model trends)',
};

export function getSourceDisplayName(
  sourceName: string,
  locale: AppLocale = 'ja'
): string {
  if (locale !== 'en' || !sourceName) return sourceName;
  const mapped = sourceNameLabelsEn[sourceName];
  if (mapped) return mapped;
  // 未登録でも「公式」だけは英語化（記事JSON側の canonical 名ずれ対策）
  return sourceName
    .replace(/\s*公式/g, ' Official')
    .replace(/（/g, '(')
    .replace(/）/g, ')')
    .replace(/\s+/g, ' ')
    .trim();
}

/** 情報源の kind（説明文）表示用 */
export function getSourceKindLabel(
  kind: string,
  locale: AppLocale = 'ja'
): string {
  if (locale !== 'en' || !kind) return kind;
  return (
    sourceKindLabelsEn[kind] ??
    kind
      .replace(/\s*公式/g, ' Official')
      .replace(/（/g, '(')
      .replace(/）/g, ')')
      .replace(/\s+/g, ' ')
      .trim()
  );
}

export const limits = {
  // フィードの保持日数（直近30日以内の記事は件数制限なしで全件ストックし、31日以上前の記事を自動ローテーション）
  retentionDays: 30,
  // 30日以内に更新がなかったツールでもタブが空にならないよう保護するツール別最低保証件数
  minArticlesPerTool: 3,
  // 万が一のRSS暴走時のみ作動するメモリ保護の安全上限（通常運用では到達しない安全弁）
  maxFeedArticles: 2000,
  // 端末内の「保存済み」最大保持件数
  maxSavedArticles: 500,
  // 端末内の「興味なし（非表示ID）」最大保持件数
  maxHiddenIds: 500,
  /** おすすめフィードでスポンサードを差し込む間隔（記事N件ごと） */
  sponsoredEveryN: 8,
  /** 先頭から何件記事を出してから最初のスポンサードを出すか */
  sponsoredMinArticlesBeforeFirst: 4,
} as const;

/** 本番ビルドで EXPO_PUBLIC_FEED_URL が空でも確実にリモート取得する既定（raw優先。jsDelivrは古い@mainを長くキャッシュする） */
const PRODUCTION_FEED_URL_FALLBACK =
  'https://raw.githubusercontent.com/contactsoroa-design/ai-news-app-starter/main/data/articles.json';

export const env = {
  // リモート配信用の静的JSON URL（未設定時は開発中 Metro の public/、本番はフォールバックURL）
  feedUrl: (() => {
    const fromEnv = (process.env.EXPO_PUBLIC_FEED_URL ?? '').trim();
    if (fromEnv) return fromEnv;
    if (typeof __DEV__ !== 'undefined' && __DEV__) return '';
    return PRODUCTION_FEED_URL_FALLBACK;
  })(),
} as const;

/**
 * App Store Connect / アプリ内法務リンク用（独自ドメイン。vercel.app は使わない）
 * 公開 HTML の正本: landing/ainews/
 */
export const legalUrls = {
  support: 'https://soroa-studio.com/ainews/',
  privacy: 'https://soroa-studio.com/ainews/privacy.html',
  terms: 'https://soroa-studio.com/ainews/terms.html',
  mediaKit: 'https://soroa-studio.com/ainews/media-kit.html',
  contactEmail: 'support@soroa-studio.com',
} as const;

/** 設定の要望インボックス（計測SDKなし。mailto のみ） */
export function feedbackMailto(locale: AppLocale): string {
  const isEn = locale === 'en';
  const subject = isEn
    ? '[Fast News AI] Feedback'
    : '[Fast News AI] Feedback';
  const body = isEn
    ? [
        'Thanks for helping improve Fast News AI.',
        '',
        'Type (pick one): bug / free-fix / plus-candidate / other',
        'Device / OS:',
        'What happened or what you want:',
        '',
        '(We tag plus-candidate weekly. Core swipe reading stays free.)',
        '',
      ].join('\n')
    : [
        'Fast News AI へのご意見ありがとうございます。',
        '',
        '種別（どれか残す）: bug / free-fix / plus-candidate / other',
        '端末・OS:',
        '内容:',
        '',
        '（plus-candidate は週次でタグ付けします。スワイプで読む体験は無料のままです）',
        '',
      ].join('\n');
  return `mailto:${legalUrls.contactEmail}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`;
}
