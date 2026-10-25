import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { copy } from '../lib/config';
import {
  cleanArticleSummary,
  cleanArticleTitle,
  formatShortDateJa,
  getDisplayGenre,
  getFaviconUrl,
  getVerifiedArticleTool,
} from '../lib/feed';
import { looksLikeLocale } from '../lib/translate';
import type { Article } from '../lib/types';
import {
  getThemeForArticle,
  size,
  text,
  toolBadgeColors,
  uiColors,
} from '../theme/tokens';

let isOpeningInAppBrowser = false;

async function openInAppArticleBrowser(
  rawUrl: string | null | undefined
): Promise<void> {
  if (!rawUrl || isOpeningInAppBrowser) return;
  const trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed) || trimmed.includes('example.invalid')) {
    return;
  }

  let normalizedUrl = trimmed;
  try {
    normalizedUrl = new URL(trimmed).toString();
  } catch {
    return;
  }

  isOpeningInAppBrowser = true;
  try {
    await WebBrowser.openBrowserAsync(normalizedUrl, {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      dismissButtonStyle: 'done',
      controlsColor: '#B6F24A',
      toolbarColor: '#0E1117',
    });
  } catch {
    try {
      await Linking.openURL(normalizedUrl);
    } catch {
      // キャンセル時は無視
    }
  } finally {
    setTimeout(() => {
      isOpeningInAppBrowser = false;
    }, 500);
  }
}

type NewsCardProps = {
  article: Article;
  index: number;
  total: number;
  cardHeight: number;
  hasChipRow?: boolean;
  showOriginalButton?: boolean;
  overrideTool?: string | null;
  /** 設定で選中のジャンル。一致タグをメタ表示で優先する */
  highlightGenres?: readonly string[];
  isSaved: boolean;
  onToggleSave: (articleId: string) => void;
  onHideArticle: (articleId: string) => void;
};

export const NewsCard = memo(function NewsCard({
  article,
  index,
  total,
  cardHeight,
  hasChipRow = false,
  showOriginalButton = true,
  overrideTool = null,
  highlightGenres = [],
  isSaved,
  onToggleSave,
  onHideArticle,
}: NewsCardProps) {
  const primaryTool = getVerifiedArticleTool(article, overrideTool);
  const { colors } = getThemeForArticle(
    primaryTool ? [primaryTool] : [],
    primaryTool || null
  );
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [summaryTruncated, setSummaryTruncated] = useState(false);
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  /** 全文モーダルを閉じたあとで開く元記事URL（Modal上での WebBrowser 重ね表示を避ける） */
  const pendingOriginalUrlRef = useRef<string | null>(null);

  // 記事が切り替わった際に必ず画像の失敗状態をリセットする
  useEffect(() => {
    setOgImageFailed(false);
    setFaviconFailed(false);
    setSummaryTruncated(false);
    setSummaryModalOpen(false);
    pendingOriginalUrlRef.current = null;
  }, [article.id, article.og_image_url, article.url]);

  // モーダルが完全に閉じたあとで外部ブラウザを開く（iOS の表示競合対策）
  useEffect(() => {
    if (summaryModalOpen) return;
    const url = pendingOriginalUrlRef.current;
    if (!url) return;
    pendingOriginalUrlRef.current = null;

    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled) return;
      void (async () => {
        try {
          await Linking.openURL(url);
        } catch {
          void openInAppArticleBrowser(url);
        }
      })();
    }, Platform.OS === 'ios' ? 450 : 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [summaryModalOpen]);

  const faviconUrl = getFaviconUrl(article.url);
  const showOgImage = Boolean(article.og_image_url) && !ogImageFailed;
  const showFavicon = Boolean(faviconUrl) && !faviconFailed;

  const primaryGenre = getDisplayGenre(article, highlightGenres);
  const secondaryGenre =
    (article.genre_tags ?? []).find((g) => g !== primaryGenre) || '';

  const sourceShortLabel =
    article.source_name.split(/[（(]/)[0]?.trim() || article.source_name;
  const bannerPrimaryLabel = primaryTool || sourceShortLabel;

  const toolBadge =
    (primaryTool && toolBadgeColors[primaryTool]) || {
      bg: colors.accent,
      fg: colors.background,
      initial: sourceShortLabel.slice(0, 2).toUpperCase(),
    };

  const dateStr = formatShortDateJa(article.published_at);
  // ジャンル絞り込み中は選んだジャンルを必ずメタに出し、絞り込みが効いていると分かるようにする
  const tagLabel =
    highlightGenres.length > 0 && primaryGenre
      ? primaryGenre
      : primaryTool || primaryGenre || '';
  const metaParts = [dateStr, tagLabel, `${index + 1}/${total}`].filter(Boolean);
  const metaText = metaParts.join(' ・ ');

  const initialChar = article.source_name.trim().slice(0, 2).toUpperCase();

  const displayTitle = cleanArticleTitle(article.title_ja);
  // 英語ネイティブ要約は ingest 済みの文面を優先（日本語向けクリーンで壊さない）
  const displaySummary = looksLikeLocale(article.summary_ja, 'en')
    ? article.summary_ja.trim()
    : cleanArticleSummary(
        article.summary_ja,
        displayTitle,
        article.source_name
      );

  // 1画面想定を大きく超えたときだけ全文ボタン（表示行数を多めにして収まるケースを増やす）
  // 行数判定だけだと「行には収まるがカード下端で切れる」ケースを拾えない。
  const summaryOverBudget = useMemo(() => {
    const s = displaySummary.trim();
    if (!s) return false;
    if (looksLikeLocale(s, 'en')) {
      return s.split(/\s+/).filter(Boolean).length > 135;
    }
    return s.length > 220;
  }, [displaySummary]);

  const showReadFullSummary = summaryTruncated || summaryOverBudget;

  const handleOpenOriginal = () => {
    void openInAppArticleBrowser(article.url);
  };

  const handleOpenOriginalFromModal = () => {
    const raw = article.url?.trim() ?? '';
    if (!/^https?:\/\//i.test(raw) || raw.includes('example.invalid')) {
      setSummaryModalOpen(false);
      return;
    }
    // Modal を先に閉じ、useEffect 側で Linking.openURL する
    pendingOriginalUrlRef.current = raw;
    setSummaryModalOpen(false);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `${displayTitle}\n${article.url}`,
        url: article.url,
      });
    } catch {
      // 共有キャンセル時は無視
    }
  };

  // 画像の有無にかかわらず同じ位置（top: 104 / 152, contentTop: 280 / 328）を維持して視線移動を一定に保つ
  const thumbTop = hasChipRow ? size.thumbTopWithChips : size.thumbTop;
  const contentTop = hasChipRow ? size.contentTopWithChips : size.contentTop;

  // バナー内に表示する記事のメインテーマ（見出しの後半や数字を誤抽出せず、記事の主題をそのまま表示）
  const afterColon = displayTitle.includes('：')
    ? displayTitle.split('：').slice(1).join('：').trim()
    : '';
  const bannerHighlight =
    afterColon.length >= 14 ? afterColon : displayTitle;

  return (
    <View
      style={[
        styles.cardContainer,
        {
          height: cardHeight,
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* 本体領域（長押しで元記事を開く。右下ボタン列とは分離してタッチ競合・フリーズを防止） */}
      <Pressable
        onLongPress={handleOpenOriginal}
        delayLongPress={500}
        accessibilityHint={copy.card.longPressAriaHint}
        style={styles.cardBodyPressable}
      >
        {/* 上部ビジュアル領域（記事に1対1で対応したテーマバナー＋個別記事OGPがある場合は重ねて表示） */}
        <View
          style={[
            styles.thumbnailBox,
            {
              top: thumbTop,
              backgroundColor: colors.panel,
              borderColor: colors.line,
            },
          ]}
        >
          {showOgImage && article.og_image_url ? (
            <>
              <Image
                key={article.og_image_url}
                source={{ uri: article.og_image_url }}
                style={styles.thumbnailImage}
                resizeMode="cover"
                onError={() => setOgImageFailed(true)}
              />
              {/* 画像の上にもツール＋ジャンルを並べて表示（テーマバナーと同じ情報） */}
              <View style={styles.imageTopOverlay}>
                {bannerPrimaryLabel ? (
                  <View
                    style={[
                      styles.bannerToolPill,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bannerToolPillText,
                        { color: colors.background },
                      ]}
                    >
                      {bannerPrimaryLabel}
                    </Text>
                  </View>
                ) : null}
                {primaryGenre ? (
                  <View
                    style={[
                      styles.bannerGenrePill,
                      {
                        backgroundColor: uiColors.overlayDark,
                        borderColor: colors.accent,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.bannerGenreDot,
                        { backgroundColor: colors.accent },
                      ]}
                    />
                    <Text style={styles.bannerGenreText}>{primaryGenre}</Text>
                  </View>
                ) : null}
                {secondaryGenre ? (
                  <View
                    style={[
                      styles.bannerGenrePill,
                      {
                        backgroundColor: uiColors.overlayDark,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    <Text style={styles.bannerGenreTextMuted}>
                      {secondaryGenre}
                    </Text>
                  </View>
                ) : null}
              </View>
            </>
          ) : (
            <View style={styles.themeBannerContainer}>
              {/* ツール・テーマ色に連動した背景ジオメトリック装飾 */}
              <View
                style={[
                  styles.bannerGlowRight,
                  { backgroundColor: colors.accent },
                ]}
              />
              <View
                style={[
                  styles.bannerRingLeft,
                  { borderColor: colors.accent },
                ]}
              />
              <View
                style={[
                  styles.bannerGridLineHorizontal,
                  { backgroundColor: colors.line },
                ]}
              />
              <View
                style={[
                  styles.bannerGridLineVertical,
                  { backgroundColor: colors.line },
                ]}
              />

              {/* 大型のウォーターマーク頭文字 */}
              <Text
                style={[
                  styles.bannerWatermark,
                  { color: colors.accent },
                ]}
                numberOfLines={1}
              >
                {toolBadge.initial}
              </Text>

              {/* 左上：主役ツール（または情報源名）＋ジャンルピルタグ */}
              <View style={styles.bannerTopRow}>
                {bannerPrimaryLabel ? (
                  <View
                    style={[
                      styles.bannerToolPill,
                      { backgroundColor: colors.accent },
                    ]}
                  >
                    <Text
                      style={[
                        styles.bannerToolPillText,
                        { color: colors.background },
                      ]}
                    >
                      {bannerPrimaryLabel}
                    </Text>
                  </View>
                ) : null}
                {primaryGenre ? (
                  <View
                    style={[
                      styles.bannerGenrePill,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.bannerGenreDot,
                        { backgroundColor: colors.accent },
                      ]}
                    />
                    <Text style={styles.bannerGenreText}>{primaryGenre}</Text>
                  </View>
                ) : null}
                {secondaryGenre ? (
                  <View
                    style={[
                      styles.bannerGenrePill,
                      {
                        backgroundColor: colors.background,
                        borderColor: colors.line,
                      },
                    ]}
                  >
                    <Text style={styles.bannerGenreTextMuted}>
                      {secondaryGenre}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* 左下：記事内容と1対1で一致する主題見出し＋出典メディア名 */}
              <View style={styles.bannerBottomLeft}>
                <View
                  style={[
                    styles.bannerToolIcon,
                    {
                      backgroundColor: showFavicon ? colors.panel : toolBadge.bg,
                      borderWidth: showFavicon ? 1 : 0,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  {showFavicon && faviconUrl ? (
                    <Image
                      key={`banner-${faviconUrl}`}
                      source={{ uri: faviconUrl }}
                      style={styles.faviconImage}
                      onError={() => setFaviconFailed(true)}
                    />
                  ) : (
                    <Text
                      style={[
                        styles.bannerToolIconText,
                        { color: toolBadge.fg },
                      ]}
                    >
                      {toolBadge.initial}
                    </Text>
                  )}
                </View>
                <View style={styles.bannerTitleCol}>
                  <Text style={styles.bannerToolName} numberOfLines={2}>
                    {bannerHighlight}
                  </Text>
                  <Text style={styles.bannerSourceSub} numberOfLines={1}>
                    {article.source_name}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.longPressBadge}>
            <Text style={styles.longPressBadgeText}>
              {copy.card.longPressHint}
            </Text>
          </View>
        </View>

        {/* 文字ブロック (left 20, right 80 — 常に同じ高さから始まり、右下ボタン列と重ねない) */}
        <View style={[styles.contentBlock, { top: contentTop }]}>
          {/* 情報源の行 */}
          <View style={styles.sourceRow}>
            <View
              style={[
                styles.sourceIconBox,
                {
                  backgroundColor: showFavicon ? colors.panel : colors.accent,
                  borderColor: colors.line,
                },
              ]}
            >
              {showFavicon && faviconUrl ? (
                <Image
                  key={faviconUrl}
                  source={{ uri: faviconUrl }}
                  style={styles.faviconImage}
                  onError={() => setFaviconFailed(true)}
                />
              ) : (
                <Text
                  style={[styles.sourceInitialText, { color: colors.background }]}
                >
                  {initialChar}
                </Text>
              )}
            </View>
            <View style={styles.sourceTextCol}>
              <Text style={styles.sourceName} numberOfLines={1}>
                {article.source_name}
              </Text>
              <Text style={styles.sourceMeta} numberOfLines={1}>
                {metaText}
              </Text>
            </View>
          </View>

          {/* 見出し */}
          <Text style={styles.headline} numberOfLines={4}>
            {displayTitle}
          </Text>

          {/* 要約（長い場合は切り詰め、「全文を見る」でモーダル表示） */}
          <Text
            style={[styles.summary, styles.summaryMeasure]}
            onTextLayout={(e) => {
              // 実測行数が表示上限を超えたときもボタンを出す（文字数判定の保険）
              const truncated = e.nativeEvent.lines.length > 12;
              setSummaryTruncated((prev) =>
                prev === truncated ? prev : truncated
              );
            }}
          >
            {displaySummary}
          </Text>
          <Text style={styles.summary} numberOfLines={12}>
            {displaySummary}
          </Text>
          {showReadFullSummary ? (
            <Pressable
              onPress={() => setSummaryModalOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={copy.card.readFullSummaryAria}
              hitSlop={8}
              style={styles.readFullButton}
            >
              <Text style={[styles.readFullButtonText, { color: colors.accent }]}>
                {copy.card.readFullSummary}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Pressable>

      <Modal
        visible={summaryModalOpen}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setSummaryModalOpen(false)}
      >
        <View
          style={[
            styles.summaryModalRoot,
            { backgroundColor: colors.background },
          ]}
        >
          <View style={styles.summaryModalHeader}>
            <Text style={styles.summaryModalSource} numberOfLines={1}>
              {article.source_name}
            </Text>
            <Pressable
              onPress={() => setSummaryModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={copy.card.closeFullSummary}
              hitSlop={12}
              style={styles.summaryModalClose}
            >
              <Text
                style={[styles.summaryModalCloseText, { color: colors.accent }]}
              >
                {copy.card.closeFullSummary}
              </Text>
            </Pressable>
          </View>
          <ScrollView
            contentContainerStyle={styles.summaryModalBody}
            showsVerticalScrollIndicator
          >
            <Text style={styles.summaryModalHeadline}>{displayTitle}</Text>
            <Text style={styles.summaryModalSummary}>{displaySummary}</Text>
          </ScrollView>
          {showOriginalButton ? (
            <Pressable
              onPress={handleOpenOriginalFromModal}
              accessibilityRole="button"
              accessibilityLabel={copy.card.openOriginalFromModal}
              style={[
                styles.summaryModalPrimary,
                { backgroundColor: colors.accent },
              ]}
            >
              <Text
                style={[
                  styles.summaryModalPrimaryText,
                  { color: colors.background },
                ]}
              >
                {copy.card.openOriginalFromModal}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>

      {/* 右下ボタン列 (right 10, bottom 100, gap 14, 各52px) */}
      <View style={styles.railContainer}>
        <Pressable
          style={styles.railButton}
          onPress={() => onToggleSave(article.id)}
          accessibilityRole="button"
          accessibilityLabel={copy.rail.save}
          accessibilityState={{ selected: isSaved }}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 3h12v18l-6-4-6 4z"
              fill={isSaved ? colors.accent : 'none'}
              stroke={isSaved ? colors.accent : text.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text
            style={[
              styles.railLabel,
              isSaved && { color: colors.accent, fontWeight: '700' },
            ]}
          >
            {isSaved ? copy.rail.saved : copy.rail.save}
          </Text>
        </Pressable>

        <Pressable
          style={styles.railButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={copy.rail.share}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
            <Path
              d="M4 12v7h16v-7M12 3v12M7 8l5-5 5 5"
              stroke={text.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.railLabel}>{copy.rail.share}</Text>
        </Pressable>

        {showOriginalButton ? (
          <Pressable
            style={styles.railButton}
            onPress={handleOpenOriginal}
            accessibilityRole="button"
            accessibilityLabel={copy.rail.openOriginalAria}
          >
            <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
              <Path
                d="M14 4h6v6M20 4l-9 9M18 14v6H4V6h6"
                stroke={text.primary}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={styles.railLabel}>{copy.rail.openOriginal}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={styles.railButton}
          onPress={() => onHideArticle(article.id)}
          accessibilityRole="button"
          accessibilityLabel={copy.rail.notInterested}
        >
          <Svg width={30} height={30} viewBox="0 0 24 24" fill="none">
            <Circle
              cx={12}
              cy={12}
              r={9}
              stroke={text.primary}
              strokeWidth={2}
            />
            <Path
              d="M8 8l8 8"
              stroke={text.primary}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <Text style={styles.railLabel}>{copy.rail.notInterested}</Text>
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  cardContainer: {
    width: '100%',
    position: 'relative',
    overflow: 'hidden',
  },
  cardBodyPressable: {
    flex: 1,
  },
  thumbnailBox: {
    position: 'absolute',
    left: size.pageSide,
    right: size.pageSide,
    height: size.thumbHeight,
    borderRadius: size.thumbRadius,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbnailImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  imageTopOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  themeBannerContainer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  bannerGlowRight: {
    position: 'absolute',
    right: -36,
    top: -54,
    width: 210,
    height: 210,
    borderRadius: 105,
    opacity: 0.24,
  },
  bannerRingLeft: {
    position: 'absolute',
    left: -28,
    bottom: -68,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 2,
    opacity: 0.4,
  },
  bannerGridLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 78,
    height: 1,
    opacity: 0.45,
  },
  bannerGridLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 110,
    width: 1,
    opacity: 0.45,
  },
  bannerWatermark: {
    position: 'absolute',
    right: 18,
    top: 10,
    fontSize: 84,
    fontWeight: '900',
    opacity: 0.14,
    letterSpacing: -2,
  },
  bannerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bannerToolPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  bannerToolPillText: {
    fontSize: 11,
    fontWeight: '900',
  },
  bannerGenrePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  bannerGenreDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  bannerGenreText: {
    color: text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
  bannerGenreTextMuted: {
    color: text.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  bannerBottomLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingRight: 110,
  },
  bannerToolIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerToolIconText: {
    fontSize: 14,
    fontWeight: '900',
  },
  bannerTitleCol: {
    flex: 1,
    minWidth: 0,
  },
  bannerToolName: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 20,
  },
  bannerSourceSub: {
    color: text.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 1,
  },
  longPressBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: uiColors.overlayDark,
  },
  longPressBadgeText: {
    color: text.primary,
    fontSize: 11,
  },
  contentBlock: {
    position: 'absolute',
    left: size.pageSide,
    right: size.contentRight,
    bottom: 12,
    gap: 10,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sourceIconBox: {
    width: size.sourceIcon,
    height: size.sourceIcon,
    borderRadius: size.sourceIcon / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  faviconImage: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  sourceInitialText: {
    fontWeight: '900',
    fontSize: 13,
  },
  sourceTextCol: {
    flex: 1,
    minWidth: 0,
  },
  sourceName: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
  },
  sourceMeta: {
    color: text.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  headline: {
    color: text.primary,
    fontSize: size.headline.fontSize,
    lineHeight: Math.round(size.headline.fontSize * size.headline.lineHeight),
    fontWeight: '700',
  },
  summary: {
    color: text.body,
    fontSize: size.summary.fontSize,
    lineHeight: Math.round(size.summary.fontSize * size.summary.lineHeight),
    fontWeight: '500',
  },
  summaryMeasure: {
    position: 'absolute',
    opacity: 0,
    left: 0,
    right: 0,
    zIndex: -1,
  },
  readFullButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  readFullButtonText: {
    fontSize: 14,
    fontWeight: '700',
  },
  summaryModalRoot: {
    flex: 1,
    paddingTop: 12,
  },
  summaryModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: size.pageSide,
    paddingBottom: 8,
    minHeight: 44,
  },
  summaryModalSource: {
    flex: 1,
    color: text.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  summaryModalClose: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  summaryModalCloseText: {
    fontSize: 15,
    fontWeight: '700',
  },
  summaryModalBody: {
    paddingHorizontal: size.pageSide,
    paddingBottom: 24,
    gap: 14,
  },
  summaryModalHeadline: {
    color: text.primary,
    fontSize: size.headline.fontSize,
    lineHeight: Math.round(size.headline.fontSize * size.headline.lineHeight),
    fontWeight: '700',
  },
  summaryModalSummary: {
    color: text.body,
    fontSize: size.summary.fontSize,
    lineHeight: Math.round(size.summary.fontSize * size.summary.lineHeight),
    fontWeight: '500',
  },
  summaryModalPrimary: {
    marginHorizontal: size.pageSide,
    marginBottom: 28,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  summaryModalPrimaryText: {
    fontSize: 15,
    fontWeight: '800',
  },
  railContainer: {
    position: 'absolute',
    right: size.railRight,
    bottom: size.railBottom - size.tabBarHeight,
    gap: size.railGap,
    alignItems: 'center',
  },
  railButton: {
    width: size.railButton,
    minHeight: size.railButton,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  railLabel: {
    color: text.rail,
    fontSize: 11,
  },
});
