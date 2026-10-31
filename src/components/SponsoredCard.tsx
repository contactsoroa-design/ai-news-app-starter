import React, { memo, useMemo } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { NewsCard } from './NewsCard';
import { getCopy } from '../lib/config';
import { localizeSponsoredItem } from '../lib/sponsored';
import { resolveSponsoredLocalIcon } from '../lib/sponsorIcons';
import type { AppLocale, Article, SponsoredItem } from '../lib/types';

/** サムネのみカードID別。アイコンは全広告主共通の resolveSponsoredLocalIcon */
const SPONSOR_THUMBNAILS: Record<string, ImageSourcePropType> = {
  'sponsor-elevenlabs-1': require('../../assets/sponsors/elevenlabs-1-api.jpg'),
  'sponsor-elevenlabs-2': require('../../assets/sponsors/elevenlabs-2-agents.jpg'),
  'sponsor-elevenlabs-3': require('../../assets/sponsors/elevenlabs-3-creative.jpg'),
  'sponsor-elevenlabs-4': require('../../assets/sponsors/elevenlabs-4-everyday.jpg'),
  'sponsor-firecrawl-1': require('../../assets/sponsors/firecrawl-1.jpg'),
  'sponsor-firecrawl-2': require('../../assets/sponsors/firecrawl-2.jpg'),
  'sponsor-firecrawl-3': require('../../assets/sponsors/firecrawl-3.jpg'),
  'sponsor-firecrawl-4': require('../../assets/sponsors/firecrawl-4.jpg'),
  'sponsor-firecrawl-5': require('../../assets/sponsors/firecrawl-5.jpg'),
  'sponsor-firecrawl-6': require('../../assets/sponsors/firecrawl-6.jpg'),
  'sponsor-firecrawl-7': require('../../assets/sponsors/firecrawl-7.jpg'),
  'sponsor-firecrawl-8': require('../../assets/sponsors/firecrawl-8.jpg'),
};

type SponsoredCardProps = {
  item: SponsoredItem;
  index: number;
  total: number;
  cardHeight: number;
  hasChipRow?: boolean;
  locale?: AppLocale;
  overrideTool?: string | null;
  onHide: (sponsoredId: string) => void;
};

/** 記事カードと同じ NewsCard レイアウトに載せるため Article 形へ変換する */
function toArticle(item: SponsoredItem): Article {
  return {
    id: item.id,
    source_id: item.source_id ?? null,
    source_name: item.advertiser_name,
    url: item.url,
    published_at: null,
    og_image_url: item.image_url,
    title_ja: item.title_ja,
    summary_ja: item.summary_ja,
    translations: item.translations,
    tool_tags: item.tool_tag ? [item.tool_tag] : [],
    genre_tags:
      item.tool_tag === 'ElevenLabs' || item.tool_tag === 'Transkriptor'
        ? ['音声']
        : item.tool_tag === 'Firecrawl' || item.tool_tag === 'Context.dev'
          ? ['個人開発・収益化']
          : [],
    created_at: new Date(0).toISOString(),
  };
}

export const SponsoredCard = memo(function SponsoredCard({
  item,
  index,
  total,
  cardHeight,
  hasChipRow = false,
  locale = 'ja',
  overrideTool = null,
  onHide,
}: SponsoredCardProps) {
  const localizedItem = useMemo(
    () => localizeSponsoredItem(item, locale),
    [item, locale]
  );
  const article = useMemo(
    () => toArticle(localizedItem),
    [localizedItem]
  );
  // interleave が同一案件を複数差し込むとき id に __slot_N を付ける
  const mediaBaseId = item.id.replace(/__slot_\d+$/, '');
  const localThumb = SPONSOR_THUMBNAILS[mediaBaseId] ?? null;
  const sponsorIcon = resolveSponsoredLocalIcon(item);
  const t = getCopy(locale);
  const ctaLabel =
    (locale === 'en'
      ? localizedItem.cta_label_en || localizedItem.cta_label_ja
      : localizedItem.cta_label_ja
    )?.trim() || t.sponsored.cta;

  return (
    <NewsCard
      article={article}
      index={index}
      total={total}
      cardHeight={cardHeight}
      hasChipRow={hasChipRow}
      showOriginalButton
      overrideTool={overrideTool ?? item.tool_tag ?? null}
      locale={locale}
      variant="sponsored"
      openOriginalLabel={ctaLabel}
      thumbnailSource={
        localThumb ?? (item.image_url ? { uri: item.image_url } : null)
      }
      iconSource={sponsorIcon}
      showNotInterested={false}
      isSaved={false}
      onToggleSave={() => {
        // スポンサードは保存対象外。レール形状だけ記事と揃える
      }}
      onHideArticle={onHide}
    />
  );
});
