export type Source = {
  id: string;
  name: string;
  site_url: string;
  kind?: string;
  category?: string;
  feed_url: string | null;
  icon_url: string | null;
  language: string;
  terms_checked: boolean;
  enabled_default: boolean;
};

/** 対応言語。ko/es は需要が出たら追加する想定 */
export type AppLocale = 'ja' | 'en';

export type LocalizedArticleText = {
  title: string;
  summary: string;
};

export type Article = {
  id: string;
  source_id: string | null;
  source_name: string;
  url: string;
  published_at: string | null;
  og_image_url: string | null;
  title_ja: string;
  summary_ja: string;
  /** 収集時に作ったネイティブ要約。en は日英同時生成 */
  translations?: Partial<Record<AppLocale, LocalizedArticleText>>;
  tool_tags: string[];
  genre_tags: string[];
  created_at: string;
};

/** 自前スポンサード（アフィリ／直契約）。AdMob は使わない */
export type SponsoredItem = {
  kind: 'sponsored';
  id: string;
  advertiser_name: string;
  /** テーマ用（tokens の tools 名）。ツール別タブ／設定のツール絞り込みと対応 */
  tool_tag?: string | null;
  /** data/sources.json の id。ソース別タブ／有効情報源と対応 */
  source_id?: string | null;
  url: string;
  image_url: string | null;
  title_ja: string;
  summary_ja: string;
  cta_label_ja: string;
  cta_label_en: string;
  translations?: Partial<Record<AppLocale, LocalizedArticleText>>;
  active: boolean;
  weight?: number;
  start_at?: string | null;
  end_at?: string | null;
};

export type FeedCardItem = Article | SponsoredItem;

export function isSponsoredItem(item: FeedCardItem): item is SponsoredItem {
  return (item as SponsoredItem).kind === 'sponsored';
}

export type SourceLanguageFilter = 'ja' | 'en' | 'both';

export type UserPrefs = {
  enabled_source_ids: string[];
  tools: string[];
  genres: string[];
  region_locale: AppLocale;
  source_language: SourceLanguageFilter;
  show_original_button: boolean;
  /** 互換用。常に true（広告OFFは不可） */
  show_sponsored: boolean;
  updated_at: string;
  /**
   * 端末が最後に認識したソースID一覧。
   * アプリ更新で増えた新規ソースだけ default ON を足すために使う。
   */
  seen_source_ids?: string[];
};
