// アプリ共通の文言・設定値（直書きを避けるためここに集約）
import type { AppLocale } from './types';

export const regionLocales: ReadonlyArray<{
  code: AppLocale;
  label: string;
  regionName: string;
}> = [
  { code: 'ja', label: '日本語（日本）', regionName: '日本' },
  { code: 'en', label: 'English (US/Global)', regionName: 'US / Global' },
] as const;

export const copy = {
  /** ホーム画面・アプリ内表示用の短い名前 */
  appName: 'AIニュース',
  /** App Store 表示名（ASO: 生成AI・最新・速報を前方配置、30字以内） */
  storeName: 'AIニュース - 生成AI・最新速報',
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
  explore: {
    title: '探索（一覧）',
    subtitle: '気になる記事をタップするとカード表示で読めます',
    searchPlaceholder: 'AIニュース・ツール・キーワードを検索',
    clearSearchAria: '検索キーワードをクリア',
    emptySearchTitle: '一致するニュースが見つかりません',
    emptySearchDescription: '別のツール名やキーワードで検索してみてください。',
    defaultTag: 'AI動向',
  },
  saved: {
    title: '保存済み',
    subtitle: 'この端末に保存したAIニュース（オフラインでも閲覧可能）',
    emptyTitle: '保存した記事はまだありません',
    emptyDescription: 'フィード画面の右下にある「保存」ボタンを押すと、この端末内に記事データが保存されます。',
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
    allToolsActive: '全ツール対象（32種）',
    allGenresActive: '全ジャンル対象（13分野）',
    sourcesSectionLabel: '情報源',
    sourcesCardTitle: 'ソース・ジャンル・ツール',
    regionLocaleLabel: '表示言語（日本語 / 英語のネイティブ要約）',
    sourceLanguageLabel: '取得するソースの元言語',
    langJaOnly: '日本語のみ',
    langEnOnly: '英語のみ',
    langBoth: '両方（日英どちらも取り込む）',
    displaySectionLabel: '表示オプション',
    showOriginalButtonLabel: '「元記事」ボタンを表示',
    hiddenResetLabel: '「興味なし」で非表示にした記事を戻す',
    hiddenResetButton: 'リセット',
    privacyNote: '保存済み・興味なし・地域設定はすべてこの端末内にのみ保存され、外部サーバーには送信されません。',
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
  },
  emptyFeed: '条件に合うニュースがありません。情報源を編集してください',
  editSourcesButton: '情報源を編集',
  resetHiddenButton: '非表示をリセット',
  errorNetwork: '通信に失敗しました。接続を確認して再試行してください。',
  retryButton: '再読み込み',
} as const;

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
} as const;

export const env = {
  // リモート配信用の静的JSON URL（未設定時は開発中 Metro の public/、本番ビルドは同梱JSON）
  feedUrl: (process.env.EXPO_PUBLIC_FEED_URL ?? '').trim(),
} as const;
