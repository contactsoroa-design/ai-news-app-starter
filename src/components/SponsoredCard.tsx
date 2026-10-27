import React, { memo, useMemo } from 'react';
import type { ImageSourcePropType } from 'react-native';
import { NewsCard } from './NewsCard';
import { getCopy } from '../lib/config';
import { localizeSponsoredItem } from '../lib/sponsored';
import type { AppLocale, Article, SponsoredItem } from '../lib/types';

/** ElevenLabs 公式ブランドキット由来（https://elevenlabs.io/brand ）。ロゴ／シンボルは未加工 */
const ELEVENLABS_MEDIA = {
  thumbnail: require('../../assets/sponsors/elevenlabs-og.jpg') as ImageSourcePropType,
  icon: require('../../assets/sponsors/elevenlabs-symbol.png') as ImageSourcePropType,
};

const SPONSOR_MEDIA: Record<
  string,
  { thumbnail: ImageSourcePropType; icon: ImageSourcePropType }
> = {
  'sponsor-elevenlabs-1': ELEVENLABS_MEDIA,
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
    genre_tags: item.tool_tag === 'ElevenLabs' ? ['音声'] : [],
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
  const media = SPONSOR_MEDIA[mediaBaseId] ?? null;
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
        media?.thumbnail ??
        (item.image_url ? { uri: item.image_url } : null)
      }
      iconSource={
        media?.icon ??
        (item.tool_tag === 'ElevenLabs'
          ? ELEVENLABS_MEDIA.icon
          : null)
      }
      showNotInterested={false}
      isSaved={false}
      onToggleSave={() => {
        // スポンサードは保存対象外。レール形状だけ記事と揃える
      }}
      onHideArticle={onHide}
    />
  );
});
