import React, { memo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { getCopy } from '../lib/config';
import type { AppLocale, SponsoredItem } from '../lib/types';
import {
  getThemeForArticle,
  size,
  text,
  themes,
  toolBadgeColors,
} from '../theme/tokens';

type SponsoredCardProps = {
  item: SponsoredItem;
  index: number;
  total: number;
  cardHeight: number;
  hasChipRow?: boolean;
  locale?: AppLocale;
  onHide: (sponsoredId: string) => void;
};

async function openSponsorUrl(rawUrl: string): Promise<void> {
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) return;
  try {
    await WebBrowser.openBrowserAsync(trimmed, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: 'done',
      controlsColor: '#B6F24A',
      toolbarColor: '#0E1117',
    });
  } catch {
    try {
      await Linking.openURL(trimmed);
    } catch {
      // ignore
    }
  }
}

export const SponsoredCard = memo(function SponsoredCard({
  item,
  index,
  total,
  cardHeight,
  hasChipRow = false,
  locale = 'ja',
  onHide,
}: SponsoredCardProps) {
  const t = getCopy(locale);
  const tool = item.tool_tag?.trim() || '';
  const { colors } = getThemeForArticle(tool ? [tool] : [], tool || null);
  const badge = tool ? toolBadgeColors[tool] : null;
  const [imgFailed, setImgFailed] = useState(false);
  const ctaLabel =
    locale === 'en' ? item.cta_label_en || item.cta_label_ja : item.cta_label_ja;

  const open = () => {
    void openSponsorUrl(item.url);
  };

  return (
    <View
      style={[
        styles.card,
        {
          height: cardHeight,
          backgroundColor: colors.background,
          paddingTop: hasChipRow ? 52 : 12,
        },
      ]}
      accessibilityLabel={`${t.sponsored.badgeAria}. ${item.title_ja}`}
    >
      <Pressable
        style={styles.body}
        onPress={open}
        onLongPress={open}
        delayLongPress={380}
        accessibilityRole="link"
        accessibilityHint={t.sponsored.longPressHint}
      >
        <View style={styles.mediaWrap}>
          {item.image_url && !imgFailed ? (
            <Image
              source={{ uri: item.image_url }}
              style={styles.media}
              resizeMode="contain"
              onError={() => setImgFailed(true)}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View
              style={[
                styles.mediaFallback,
                { backgroundColor: colors.panel, borderColor: colors.line },
              ]}
            >
              <Text style={[styles.mediaFallbackText, { color: colors.accent }]}>
                {badge?.initial || item.advertiser_name.slice(0, 2)}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.metaRow}>
          <View
            style={[styles.adBadge, { backgroundColor: colors.accent }]}
            accessibilityLabel={t.sponsored.badgeAria}
          >
            <Text style={styles.adBadgeText}>{t.sponsored.badge}</Text>
          </View>
          <Text style={[styles.advertiser, { color: text.primary }]} numberOfLines={1}>
            {item.advertiser_name}
          </Text>
          <Text style={[styles.counter, { color: text.muted }]}>
            {index + 1}/{total}
          </Text>
        </View>

        <Text style={[styles.title, { color: text.primary }]} numberOfLines={3}>
          {item.title_ja}
        </Text>
        <Text style={[styles.summary, { color: text.body }]} numberOfLines={5}>
          {item.summary_ja}
        </Text>
      </Pressable>

      <View style={styles.rail}>
        <Pressable
          style={[styles.ctaButton, { backgroundColor: colors.accent }]}
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={t.sponsored.openCtaAria}
        >
          <Text style={styles.ctaText} numberOfLines={2}>
            {ctaLabel}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.hideButton, { borderColor: colors.line }]}
          onPress={() => onHide(item.id)}
          accessibilityRole="button"
          accessibilityLabel={t.rail.notInterested}
        >
          <Text style={[styles.hideText, { color: text.muted }]}>
            {t.rail.notInterested}
          </Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: '100%',
    paddingHorizontal: size.pageSide,
    paddingBottom: size.pageSide,
    justifyContent: 'flex-start',
  },
  body: {
    flex: 1,
  },
  mediaWrap: {
    height: 120,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  media: {
    width: 96,
    height: 96,
  },
  mediaFallback: {
    width: 96,
    height: 96,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaFallbackText: {
    fontSize: 28,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  adBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    minHeight: 28,
    justifyContent: 'center',
  },
  adBadgeText: {
    color: themes.neutral.background,
    fontSize: 12,
    fontWeight: '800',
  },
  advertiser: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  counter: {
    fontSize: 12,
  },
  title: {
    fontSize: size.headline.fontSize,
    lineHeight: Math.round(size.headline.fontSize * size.headline.lineHeight),
    fontWeight: '700',
    marginBottom: 8,
  },
  summary: {
    fontSize: size.summary.fontSize,
    lineHeight: Math.round(size.summary.fontSize * size.summary.lineHeight),
  },
  rail: {
    gap: 10,
    paddingTop: 12,
  },
  ctaButton: {
    minHeight: size.minTap,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  ctaText: {
    color: themes.neutral.background,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
  },
  hideButton: {
    minHeight: size.minTap,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  hideText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
