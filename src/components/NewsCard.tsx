import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  type ImageSourcePropType,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import { getCopy, getGenreLabel, getSourceDisplayName } from '../lib/config';
import {
  cleanArticleSummary,
  cleanArticleTitle,
  formatShortDate,
  getDisplayGenre,
  getArticleSourceFaviconUrl,
  getVerifiedArticleTool,
} from '../lib/feed';
import { looksLikeLocale } from '../lib/translate';
import type { AppLocale, Article } from '../lib/types';

import {
  getThemeForArticle,
  size,
  text,
  themes,
  toolBadgeColors,
  uiColors,
} from '../theme/tokens';

const SUMMARY_LINE_HEIGHT = Math.round(
  size.summary.fontSize * size.summary.lineHeight
);
/** 全文ボタン＋summaryBlock内gap分。見切れないよう確保する */
const READ_FULL_BUTTON_RESERVE = size.minTap + 4;

type SummaryAreaSize = { width: number; height: number };
type SummaryFullMetrics = { lines: number; height: number };

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
  /** 表示言語（ボタン文言の日英切替） */
  locale?: AppLocale;
  /** 記事と同じ見た目のスポンサード枠 */
  variant?: 'article' | 'sponsored';
  /** 右レール「元記事」相当の文言（スポンサードCTA） */
  openOriginalLabel?: string;
  /** 上部サムネ（公式ブランド素材など）。指定時は og_image_url より優先 */
  thumbnailSource?: ImageSourcePropType | null;
  /** 情報源アイコン。指定時は favicon より優先（記事と同じ位置） */
  iconSource?: ImageSourcePropType | null;
  /** false のとき興味なしを出さない（広告枠）。レール位置はスペーサーで維持 */
  showNotInterested?: boolean;
  /**
   * 記事のツール／ソースに対応する広告があるとき右レールに製品アイコンを出す。
   * タップでフィード内の該当広告カードへスクロールする。
   */
  relatedSponsor?: {
    name: string;
    iconUrl: string | null;
    /** 公式アセットなどローカル画像（ネットワーク失敗時より優先） */
    iconSource?: ImageSourcePropType | null;
    onPress: () => void;
  } | null;
  isSaved: boolean;
  onToggleSave: (articleId: string) => void;
  onHideArticle: (articleId: string) => void;
  /** 情報源アイコン／名前タップでソース別へ */
  onPressSource?: (article: Article) => void;
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
  locale = 'ja',
  variant = 'article',
  openOriginalLabel,
  thumbnailSource = null,
  iconSource = null,
  showNotInterested = true,
  relatedSponsor = null,
  isSaved,
  onToggleSave,
  onHideArticle,
  onPressSource,
}: NewsCardProps) {
  const primaryTool = getVerifiedArticleTool(article, overrideTool);
  const { colors } = getThemeForArticle(
    primaryTool ? [primaryTool] : [],
    primaryTool || null
  );
  const [ogImageFailed, setOgImageFailed] = useState(false);
  const [faviconFailed, setFaviconFailed] = useState(false);
  const [sponsorIconFailed, setSponsorIconFailed] = useState(false);
  const [summaryAreaSize, setSummaryAreaSize] = useState<SummaryAreaSize>({
    width: 0,
    height: 0,
  });
  const [fullSummaryMetrics, setFullSummaryMetrics] =
    useState<SummaryFullMetrics>({ lines: 0, height: 0 });
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  /** 全文モーダルを閉じたあとで開く元記事URL（Modal上での WebBrowser 重ね表示を避ける） */
  const pendingOriginalUrlRef = useRef<string | null>(null);

  // 記事・要約・言語が切り替わった際に状態をリセットする
  useEffect(() => {
    setOgImageFailed(false);
    setFaviconFailed(false);
    setSponsorIconFailed(false);
    setFullSummaryMetrics({ lines: 0, height: 0 });
    setSummaryModalOpen(false);
    pendingOriginalUrlRef.current = null;
  }, [
    article.id,
    article.og_image_url,
    article.url,
    article.summary_ja,
    locale,
    relatedSponsor?.iconUrl,
    relatedSponsor?.name,
  ]);

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

  const faviconUrl = iconSource ? null : getArticleSourceFaviconUrl(article);
  const showBundledThumb = Boolean(thumbnailSource) && !ogImageFailed;
  const showOgImage =
    showBundledThumb || (Boolean(article.og_image_url) && !ogImageFailed);
  const showBundledIcon = Boolean(iconSource) && !faviconFailed;
  const showFavicon =
    showBundledIcon || (Boolean(faviconUrl) && !faviconFailed);
  const thumbImageSource: ImageSourcePropType | null = showBundledThumb
    ? (thumbnailSource as ImageSourcePropType)
    : article.og_image_url
      ? { uri: article.og_image_url }
      : null;
  const iconImageSource: ImageSourcePropType | null = showBundledIcon
    ? (iconSource as ImageSourcePropType)
    : faviconUrl
      ? { uri: faviconUrl }
      : null;

  const primaryGenre = getDisplayGenre(article, highlightGenres);
  const secondaryGenre =
    (article.genre_tags ?? []).find((g) => g !== primaryGenre) || '';

  const displaySourceName = getSourceDisplayName(article.source_name, locale);
  const sourceShortLabel =
    displaySourceName.split(/[（(]/)[0]?.trim() || displaySourceName;
  const bannerPrimaryLabel = primaryTool || sourceShortLabel;

  const toolBadge =
    (primaryTool && toolBadgeColors[primaryTool]) || {
      bg: colors.accent,
      fg: colors.background,
      initial: sourceShortLabel.slice(0, 2).toUpperCase(),
    };

  const t = getCopy(locale);
  const isSponsored = variant === 'sponsored';
  const dateStr = formatShortDate(article.published_at, locale);
  const primaryGenreLabel = primaryGenre
    ? getGenreLabel(primaryGenre, locale)
    : '';
  const secondaryGenreLabel = secondaryGenre
    ? getGenreLabel(secondaryGenre, locale)
    : '';
  // ジャンル絞り込み中は選んだジャンルを必ずメタに出し、絞り込みが効いていると分かるようにする
  const tagLabel =
    highlightGenres.length > 0 && primaryGenreLabel
      ? primaryGenreLabel
      : primaryTool || primaryGenreLabel || '';
  const metaParts = isSponsored
    ? [t.sponsored.badge, tagLabel, `${index + 1}/${total}`].filter(Boolean)
    : [dateStr, tagLabel, `${index + 1}/${total}`].filter(Boolean);
  const metaText = metaParts.join(locale === 'en' ? ' · ' : ' ・ ');

  const initialChar = displaySourceName.trim().slice(0, 2).toUpperCase();

  const displayTitle = cleanArticleTitle(article.title_ja);
  // 英語ネイティブ要約は ingest 済みの文面を優先（日本語向けクリーンで壊さない）
  // スポンサードも記事と同じ整形ルールを通す
  const displaySummary = looksLikeLocale(article.summary_ja, 'en')
    ? article.summary_ja.trim()
    : cleanArticleSummary(
        article.summary_ja,
        displayTitle,
        article.source_name
      );

  const isEnUi = locale === 'en';
  // 実測の要約高さで判定（英文は折り返しが多く、固定行高換算だと見切れてもボタンが出ない）
  const measuredLineHeight =
    fullSummaryMetrics.lines > 0
      ? fullSummaryMetrics.height / fullSummaryMetrics.lines
      : SUMMARY_LINE_HEIGHT;
  const linesThatFit = Math.max(
    1,
    Math.floor(summaryAreaSize.height / measuredLineHeight)
  );
  const measuredOverflow =
    summaryAreaSize.height > 0 &&
    fullSummaryMetrics.height > 0 &&
    fullSummaryMetrics.height > summaryAreaSize.height + 1;
  // 計測が遅延・欠落したとき用。英文はおおよそ 7.5語/行で行数を見積もる
  const enWordCount = isEnUi
    ? displaySummary.trim().split(/\s+/).filter(Boolean).length
    : 0;
  const enFallbackOverflow =
    isEnUi &&
    fullSummaryMetrics.height <= 0 &&
    summaryAreaSize.height > 0 &&
    summaryAreaSize.width > 0 &&
    Math.ceil(enWordCount / 7.5) > linesThatFit;
  const showReadFullSummary = measuredOverflow || enFallbackOverflow;
  const summaryDisplayLines = showReadFullSummary
    ? Math.max(
        1,
        Math.floor(
          (summaryAreaSize.height - READ_FULL_BUTTON_RESERVE) / measuredLineHeight
        )
      )
    : undefined;
  const readFullLabel = t.card.readFullSummary;
  const readFullAria = t.card.readFullSummaryAria;
  const closeFullLabel = t.card.closeFullSummary;
  const railOpenLabel =
    openOriginalLabel?.trim() || t.rail.openOriginal;
  const openOriginalModalLabel =
    openOriginalLabel?.trim() || t.card.openOriginalFromModal;
  const longPressHintLabel = isSponsored
    ? t.sponsored.longPressHint
    : t.card.longPressHint;
  const longPressAriaHint = isSponsored
    ? t.sponsored.longPressHint
    : t.card.longPressAriaHint;
  const openOriginalAria = isSponsored
    ? t.sponsored.openCtaAria
    : t.rail.openOriginalAria;

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
        accessibilityHint={longPressAriaHint}
        accessibilityLabel={
          isSponsored
            ? `${t.sponsored.badgeAria}. ${displayTitle}`
            : undefined
        }
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
          {showOgImage && thumbImageSource ? (
            <>
              <Image
                recyclingKey={`thumb-${article.id}`}
                source={thumbImageSource}
                style={styles.thumbnailImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                priority="high"
                transition={0}
                onError={() => setOgImageFailed(true)}
              />
              {/* 記事OGP上のツール／ジャンル。スポンサードはプレゼン画像を優先して重ねない */}
              {!isSponsored ? (
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
                      <Text style={styles.bannerGenreText}>
                        {primaryGenreLabel}
                      </Text>
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
                        {secondaryGenreLabel}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
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
                    <Text style={styles.bannerGenreText}>
                      {primaryGenreLabel}
                    </Text>
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
                      {secondaryGenreLabel}
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
                      // 公式シンボル（黒）は明るいホルダー上に置く（ブランド推奨）
                      backgroundColor: showBundledIcon
                        ? '#FFFFFF'
                        : showFavicon
                          ? colors.panel
                          : toolBadge.bg,
                      borderWidth: showFavicon ? 1 : 0,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  {showFavicon && iconImageSource ? (
                    <Image
                      recyclingKey={`banner-icon-${article.id}`}
                      source={iconImageSource}
                      style={styles.faviconImage}
                      contentFit="contain"
                      cachePolicy="memory-disk"
                      transition={0}
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
                    {displaySourceName}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={styles.longPressBadge}>
            <Text style={styles.longPressBadgeText}>
              {longPressHintLabel}
            </Text>
          </View>
        </View>

        {/* 文字ブロック (left 20, right 80 — 常に同じ高さから始まり、右下ボタン列と重ねない) */}
        <View style={[styles.contentBlock, { top: contentTop }]}>
          {/* 情報源の行（アイコン／名前タップでソース別へ） */}
          <Pressable
            style={styles.sourceRow}
            onPress={
              onPressSource && variant === 'article'
                ? () => onPressSource(article)
                : undefined
            }
            disabled={!onPressSource || variant !== 'article'}
            accessibilityRole={
              onPressSource && variant === 'article' ? 'button' : undefined
            }
            accessibilityLabel={
              onPressSource && variant === 'article'
                ? t.explore.openSourceAria
                : undefined
            }
          >
            <View
              style={[
                styles.sourceIconBox,
                {
                  backgroundColor: showBundledIcon
                    ? '#FFFFFF'
                    : showFavicon
                      ? colors.panel
                      : colors.accent,
                  borderColor: colors.line,
                },
              ]}
            >
              {showFavicon && iconImageSource ? (
                <Image
                  recyclingKey={`source-icon-${article.id}`}
                  source={iconImageSource}
                  style={styles.faviconImage}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={0}
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
                {displaySourceName}
              </Text>
              <Text style={styles.sourceMeta} numberOfLines={1}>
                {metaText}
              </Text>
            </View>
          </Pressable>

          {/* 見出し */}
          <Text style={styles.headline} numberOfLines={4}>
            {displayTitle}
          </Text>

          {/* 要約（全文の実測高さが領域を超えるときだけ全文ボタン） */}
          <View style={styles.summarySection}>
            <View
              style={styles.summaryBlock}
              onLayout={(e) => {
                const { width, height } = e.nativeEvent.layout;
                const next = {
                  width: Math.round(width),
                  height: Math.round(height),
                };
                setSummaryAreaSize((prev) =>
                  prev.width === next.width && prev.height === next.height
                    ? prev
                    : next
                );
              }}
            >
              <Text style={styles.summary} numberOfLines={summaryDisplayLines}>
                {displaySummary}
              </Text>
              {showReadFullSummary ? (
                <Pressable
                  onPress={() => setSummaryModalOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={readFullAria}
                  hitSlop={8}
                  style={styles.readFullButton}
                >
                  <Text style={styles.readFullButtonText} numberOfLines={1}>
                    {readFullLabel}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
      </Pressable>

      {/* カード直下・画面外で全文高さを計測（ネスト overflow による英文行欠け対策） */}
      {summaryAreaSize.width > 0 ? (
        <View
          pointerEvents="none"
          collapsable={false}
          style={[
            styles.summaryMeasureWrap,
            { width: summaryAreaSize.width },
          ]}
        >
          <Text
            key={`sum-measure-${article.id}-${locale}`}
            style={[styles.summary, { width: summaryAreaSize.width }]}
            onTextLayout={(e) => {
              const lines = e.nativeEvent.lines;
              if (lines.length === 0) return;
              const last = lines[lines.length - 1];
              const next = {
                lines: lines.length,
                height: last.y + last.height,
              };
              setFullSummaryMetrics((prev) =>
                prev.lines === next.lines &&
                Math.abs(prev.height - next.height) < 0.5
                  ? prev
                  : next
              );
            }}
          >
            {displaySummary}
          </Text>
        </View>
      ) : null}

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
              {displaySourceName}
            </Text>
            <Pressable
              onPress={() => setSummaryModalOpen(false)}
              accessibilityRole="button"
              accessibilityLabel={closeFullLabel}
              hitSlop={12}
              style={styles.summaryModalClose}
            >
              <Text
                style={[styles.summaryModalCloseText, { color: colors.accent }]}
              >
                {closeFullLabel}
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
              accessibilityLabel={openOriginalModalLabel}
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
                {openOriginalModalLabel}
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
          accessibilityLabel={t.rail.save}
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
            {isSaved ? t.rail.saved : t.rail.save}
          </Text>
        </Pressable>

        <Pressable
          style={styles.railButton}
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel={t.rail.share}
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
          <Text style={styles.railLabel}>{t.rail.share}</Text>
        </Pressable>

        {showOriginalButton ? (
          <Pressable
            style={styles.railButton}
            onPress={handleOpenOriginal}
            accessibilityRole="button"
            accessibilityLabel={openOriginalAria}
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
            <Text style={styles.railLabel}>{railOpenLabel}</Text>
          </Pressable>
        ) : null}

        {relatedSponsor && !isSponsored ? (
          <Pressable
            style={styles.railButton}
            onPress={relatedSponsor.onPress}
            accessibilityRole="button"
            accessibilityLabel={t.rail.relatedSponsorAria(relatedSponsor.name)}
          >
            {relatedSponsor.iconSource ||
            (relatedSponsor.iconUrl && !sponsorIconFailed) ? (
              <View
                style={[
                  styles.railSponsorIconWrap,
                  // 情報源アイコンと同じ白マット。暗い avatarSurface だと黒シンボルが潰れる
                  { backgroundColor: '#FFFFFF' },
                ]}
              >
                <Image
                  source={
                    relatedSponsor.iconSource ?? {
                      uri: relatedSponsor.iconUrl as string,
                    }
                  }
                  style={
                    relatedSponsor.iconSource
                      ? styles.railSponsorIconLocal
                      : styles.railSponsorIcon
                  }
                  contentFit="contain"
                  onError={() => setSponsorIconFailed(true)}
                  accessibilityIgnoresInvertColors
                />
              </View>
            ) : (
              <View
                style={[
                  styles.railSponsorFallback,
                  {
                    backgroundColor:
                      toolBadgeColors[relatedSponsor.name]?.bg ??
                      themes.neutral.accent,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.railSponsorFallbackText,
                    {
                      color:
                        toolBadgeColors[relatedSponsor.name]?.fg ??
                        themes.neutral.background,
                    },
                  ]}
                >
                  {(toolBadgeColors[relatedSponsor.name]?.initial ??
                    relatedSponsor.name.slice(0, 2)).slice(0, 2)}
                </Text>
              </View>
            )}
            <Text style={styles.railLabel} numberOfLines={1}>
              {t.rail.relatedSponsor}
            </Text>
          </Pressable>
        ) : null}

        {showNotInterested ? (
          <Pressable
            style={styles.railButton}
            onPress={() => onHideArticle(article.id)}
            accessibilityRole="button"
            accessibilityLabel={t.rail.notInterested}
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
            <Text style={styles.railLabel}>{t.rail.notInterested}</Text>
          </Pressable>
        ) : (
          // 興味なし非表示でも保存・共有・開くの縦位置を記事カードと揃える
          <View style={styles.railButton} pointerEvents="none" />
        )}
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
    width: '100%',
    height: '100%',
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
    bottom: 20,
    gap: 10,
  },
  summarySection: {
    flex: 1,
    minHeight: 0,
  },
  summaryBlock: {
    flex: 1,
    minHeight: 0,
    gap: 4,
    overflow: 'hidden',
  },
  summaryMeasureWrap: {
    position: 'absolute',
    left: size.pageSide,
    top: 0,
    opacity: 0,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
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
    flexShrink: 0,
  },
  summary: {
    color: text.body,
    fontSize: size.summary.fontSize,
    lineHeight: SUMMARY_LINE_HEIGHT,
    fontWeight: '500',
  },
  readFullButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 6,
    paddingRight: 8,
  },
  readFullButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: themes.neutral.accent,
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
  railSponsorIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  railSponsorIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
  },
  railSponsorIconLocal: {
    width: 20,
    height: 20,
  },
  railSponsorFallback: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  railSponsorFallbackText: {
    fontSize: 11,
    fontWeight: '700',
  },
  railLabel: {
    color: text.rail,
    fontSize: 11,
  },
});
