import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import { Image } from 'expo-image';
import Svg, { Circle, Path } from 'react-native-svg';
import { getCopy, getGenreLabel, getSourceDisplayName, limits } from '../lib/config';
import {
  formatShortDate,
  getFaviconUrl,
  getVerifiedArticleTool,
} from '../lib/feed';
import {
  filterSponsoredForContext,
  findNearestSponsoredIndex,
  interleaveSponsoredCards,
  isSponsoredItem,
  pickRelatedSponsored,
} from '../lib/sponsored';
import type {
  AppLocale,
  Article,
  FeedCardItem,
  SponsoredItem,
  UserPrefs,
} from '../lib/types';
import {
  getThemeForArticle,
  size,
  text,
  themes,
  toolBadgeColors,
  toolSiteUrls,
  uiColors,
} from '../theme/tokens';
import { EmptyState } from './EmptyState';
import { NewsCard } from './NewsCard';
import { SponsoredCard } from './SponsoredCard';

const RELATED_SPONSOR_LOCAL_ICON: Record<
  string,
  ReturnType<typeof require>
> = {
  ElevenLabs: require('../../assets/sponsors/elevenlabs-symbol.png'),
  Firecrawl: require('../../assets/sponsors/firecrawl-symbol.png'),
};

type ExploreViewProps = {
  articles: Article[];
  savedIds: string[];
  showOriginalButton?: boolean;
  sponsoredItems?: SponsoredItem[];
  prefsTools?: UserPrefs['tools'];
  enabledSourceIds?: ReadonlySet<string>;
  onToggleSave: (articleId: string) => void;
  onHideArticle: (articleId: string) => void;
  onOpenSaved: () => void;
  onPressSource?: (article: Article) => void;
  locale?: AppLocale;
};

type ExploreGridCellProps = {
  article: Article;
  onSelect: (articleId: string) => void;
  locale: AppLocale;
};

const ExploreGridCell = memo(function ExploreGridCell({
  article,
  onSelect,
  locale,
}: ExploreGridCellProps) {
  const t = getCopy(locale);
  const primaryTool = getVerifiedArticleTool(article);
  const { colors } = getThemeForArticle(primaryTool ? [primaryTool] : []);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [article.id, article.og_image_url]);

  const showImage = Boolean(article.og_image_url) && !imgFailed;

  const primaryGenre = (article.genre_tags ?? [])[0] || '';
  const primaryGenreLabel = primaryGenre
    ? getGenreLabel(primaryGenre, locale)
    : '';
  const displaySourceName = getSourceDisplayName(article.source_name, locale);
  const sourceShortLabel =
    displaySourceName.split(/[（(]/)[0]?.trim() || displaySourceName;
  const badgeText =
    primaryTool || sourceShortLabel || primaryGenreLabel || t.explore.defaultTag;
  const dateStr = formatShortDate(article.published_at, locale);

  const toolBadge =
    (primaryTool && toolBadgeColors[primaryTool]) || {
      bg: colors.accent,
      fg: colors.background,
      initial: sourceShortLabel.slice(0, 2).toUpperCase(),
    };

  const afterColon = article.title_ja.includes('：')
    ? article.title_ja.split('：').slice(1).join('：').trim()
    : '';
  const shortTopic =
    afterColon.length >= 14 ? afterColon : article.title_ja;

  return (
    <Pressable
      style={styles.gridItem}
      onPress={() => onSelect(article.id)}
      accessibilityRole="button"
      accessibilityLabel={article.title_ja}
    >
      <View
        style={[
          styles.cardBox,
          { backgroundColor: uiColors.cardSurface, borderColor: colors.line },
        ]}
      >
        <View
          style={[
            styles.thumbBox,
            { backgroundColor: colors.panel, borderBottomColor: colors.line },
          ]}
        >
          {showImage && article.og_image_url ? (
            <>
              <Image
                recyclingKey={`explore-${article.id}`}
                source={{ uri: article.og_image_url }}
                style={styles.thumbImage}
                contentFit="cover"
                cachePolicy="memory-disk"
                // ホームの大きなカードより優先度を下げ、スワイプ体感を守る（画質は同じ）
                priority="low"
                transition={0}
                onError={() => setImgFailed(true)}
              />
              <View style={styles.imageBottomGradient}>
                <Text style={styles.imageSourceText} numberOfLines={1}>
                  {displaySourceName}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.customThumbContent}>
              <View
                style={[
                  styles.circleFilled,
                  { backgroundColor: colors.accent },
                ]}
              />
              <View
                style={[
                  styles.circleOutline,
                  { borderColor: colors.accent },
                ]}
              />
              <Text
                style={[styles.watermarkText, { color: colors.accent }]}
                numberOfLines={1}
              >
                {toolBadge.initial}
              </Text>

              {primaryGenre && primaryTool ? (
                <View
                  style={[
                    styles.genreMiniBadge,
                    {
                      backgroundColor: colors.background,
                      borderColor: colors.line,
                    },
                  ]}
                >
                  <Text style={styles.genreMiniBadgeText} numberOfLines={1}>
                    {primaryGenreLabel}
                  </Text>
                </View>
              ) : null}

              <View style={styles.customThumbBottom}>
                <Text style={styles.customThumbTopic} numberOfLines={2}>
                  {shortTopic}
                </Text>
                <View style={styles.customThumbSourceRow}>
                  <View
                    style={[
                      styles.miniToolDot,
                      { backgroundColor: toolBadge.bg },
                    ]}
                  />
                  <Text style={styles.customThumbSource} numberOfLines={1}>
                    {displaySourceName}
                  </Text>
                </View>
              </View>
            </View>
          )}

          <View style={[styles.tagPill, { backgroundColor: colors.accent }]}>
            <Text
              style={[styles.tagPillText, { color: colors.background }]}
              numberOfLines={1}
            >
              {badgeText}
            </Text>
          </View>
        </View>

        <View style={styles.cardBody}>
          <Text style={styles.gridTitle} numberOfLines={4}>
            {article.title_ja}
          </Text>
          <Text style={styles.gridMeta} numberOfLines={1}>
            {[dateStr, displaySourceName]
              .filter(Boolean)
              .join(locale === 'en' ? ' · ' : ' ・ ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export function ExploreView({
  articles,
  savedIds,
  showOriginalButton = true,
  sponsoredItems = [],
  prefsTools = [],
  enabledSourceIds,
  onToggleSave,
  onHideArticle,
  onOpenSaved,
  onPressSource,
  locale = 'ja',
}: ExploreViewProps) {
  const t = getCopy(locale);
  const [query, setQuery] = useState('');
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    null
  );
  const [feedHeight, setFeedHeight] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardListRef = useRef<FlatList<FeedCardItem>>(null);

  const indexedArticles = useMemo(
    () =>
      articles.map((art) => ({
        article: art,
        searchKey: [
          art.title_ja,
          art.summary_ja,
          art.source_name,
          ...(art.tool_tags ?? []),
          ...(art.genre_tags ?? []),
        ]
          .join(' ')
          .toLowerCase(),
      })),
    [articles]
  );

  const filteredArticles = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return articles;
    const keywords = trimmed.split(/\s+/);
    return indexedArticles
      .filter((entry) => keywords.every((kw) => entry.searchKey.includes(kw)))
      .map((entry) => entry.article);
  }, [articles, indexedArticles, query]);

  /** 探索のカード閲覧でもホーム同様に広告を差し込む */
  const exploreFeedCards = useMemo((): FeedCardItem[] => {
    if (sponsoredItems.length === 0) return filteredArticles;
    const matched = filterSponsoredForContext(sponsoredItems, {
      mode: 'recommended',
      prefsTools,
      enabledSourceIds,
    });
    if (matched.length === 0) return filteredArticles;
    return interleaveSponsoredCards(filteredArticles, matched, {
      locale,
      everyN: limits.sponsoredEveryN,
      minArticlesBeforeFirst: limits.sponsoredMinArticlesBeforeFirst,
    });
  }, [
    filteredArticles,
    sponsoredItems,
    prefsTools,
    enabledSourceIds,
    locale,
  ]);

  const selectedIndex = selectedArticleId
    ? exploreFeedCards.findIndex(
        (item) => !isSponsoredItem(item) && item.id === selectedArticleId
      )
    : -1;
  const isShowingCard = selectedArticleId !== null && selectedIndex >= 0;

  // 検索で選択中記事が消えたらグリッドへ戻す
  useEffect(() => {
    if (selectedArticleId && selectedIndex < 0) {
      setSelectedArticleId(null);
    }
  }, [selectedArticleId, selectedIndex]);

  const handleSelect = useCallback(
    (articleId: string) => {
      const idx = exploreFeedCards.findIndex(
        (item) => !isSponsoredItem(item) && item.id === articleId
      );
      if (idx < 0) return;
      setSelectedArticleId(articleId);
      setCurrentIndex(idx);
    },
    [exploreFeedCards]
  );

  const handleBackToList = useCallback(() => {
    setSelectedArticleId(null);
  }, []);

  const handleLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0 && Math.abs(h - feedHeight) > 1) {
      setFeedHeight(h);
    }
  };

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        const idx = viewableItems[0].index;
        setCurrentIndex(idx);
        const item = exploreFeedCards[idx];
        if (item && !isSponsoredItem(item)) {
          setSelectedArticleId(item.id);
        }
      }
    },
    [exploreFeedCards]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: Article }) => (
      <ExploreGridCell
        article={item}
        onSelect={handleSelect}
        locale={locale}
      />
    ),
    [handleSelect, locale]
  );

  if (isShowingCard) {
    const activeIndex = Math.min(currentIndex, exploreFeedCards.length - 1);
    const activeItem =
      exploreFeedCards[activeIndex] ?? exploreFeedCards[selectedIndex];
    const activeArticle = activeItem && !isSponsoredItem(activeItem)
      ? activeItem
      : null;
    const verifiedTool = activeArticle
      ? getVerifiedArticleTool(activeArticle)
      : isSponsoredItem(activeItem)
        ? activeItem.tool_tag ?? ''
        : '';
    const activeTheme = getThemeForArticle(
      verifiedTool ? [verifiedTool] : []
    ).colors;

    return (
      <View
        style={[
          styles.cardModeContainer,
          { backgroundColor: activeTheme.background },
        ]}
        onLayout={handleLayout}
      >
        {feedHeight > 0 ? (
          <FlatList
            ref={cardListRef}
            data={exploreFeedCards}
            keyExtractor={(item) => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={feedHeight}
            snapToAlignment="start"
            initialScrollIndex={
              exploreFeedCards.length > 0
                ? Math.max(
                    0,
                    Math.min(selectedIndex, exploreFeedCards.length - 1)
                  )
                : 0
            }
            initialNumToRender={3}
            maxToRenderPerBatch={3}
            windowSize={5}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            getItemLayout={(_, index) => ({
              length: feedHeight,
              offset: feedHeight * index,
              index,
            })}
            onScrollToIndexFailed={({ index }) => {
              cardListRef.current?.scrollToOffset({
                offset: feedHeight * index,
                animated: false,
              });
            }}
            renderItem={({ item, index }) => {
              if (isSponsoredItem(item)) {
                return (
                  <SponsoredCard
                    item={item}
                    index={index}
                    total={exploreFeedCards.length}
                    cardHeight={feedHeight}
                    hasChipRow={false}
                    locale={locale}
                    onHide={onHideArticle}
                  />
                );
              }
              const related = pickRelatedSponsored(
                item,
                sponsoredItems.filter((s) => s.active !== false)
              );
              const jumpIndex = related
                ? findNearestSponsoredIndex(exploreFeedCards, index, related)
                : -1;
              const siteForIcon = related?.tool_tag
                ? toolSiteUrls[related.tool_tag]
                : null;
              const localIcon = related?.tool_tag
                ? RELATED_SPONSOR_LOCAL_ICON[related.tool_tag]
                : undefined;
              const relatedSponsor = related
                ? {
                    name: related.advertiser_name,
                    iconUrl:
                      (siteForIcon ? getFaviconUrl(siteForIcon) : null) ||
                      getFaviconUrl(related.url) ||
                      related.image_url,
                    iconSource: localIcon ?? null,
                    onPress: () => {
                      if (jumpIndex >= 0 && feedHeight > 0) {
                        setCurrentIndex(jumpIndex);
                        cardListRef.current?.scrollToIndex({
                          index: jumpIndex,
                          animated: true,
                        });
                        return;
                      }
                      void Linking.openURL(related.url);
                    },
                  }
                : null;
              return (
                <NewsCard
                  article={item}
                  index={index}
                  total={exploreFeedCards.length}
                  cardHeight={feedHeight}
                  hasChipRow={false}
                  isSaved={savedIds.includes(item.id)}
                  showOriginalButton={showOriginalButton}
                  locale={locale}
                  relatedSponsor={relatedSponsor}
                  onToggleSave={onToggleSave}
                  onHideArticle={onHideArticle}
                  onPressSource={onPressSource}
                />
              );
            }}
          />
        ) : null}

        <View style={styles.cardTopBar} pointerEvents="box-none">
          <Pressable
            style={[
              styles.backButton,
              {
                backgroundColor: activeTheme.panel,
                borderColor: activeTheme.line,
              },
            ]}
            onPress={handleBackToList}
            accessibilityRole="button"
            accessibilityLabel={t.explore.backToListAria}
          >
            <Text style={styles.backButtonText}>{t.explore.backToList}</Text>
          </Pressable>

          <View
            style={[
              styles.counterPill,
              {
                backgroundColor: activeTheme.panel,
                borderColor: activeTheme.line,
              },
            ]}
          >
            <Text style={[styles.counterText, { color: activeTheme.accent }]}>
              {activeIndex + 1} / {exploreFeedCards.length}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.searchHeaderRow}>
        <View style={styles.searchBox}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Circle
              cx={11}
              cy={11}
              r={7}
              stroke={text.muted}
              strokeWidth={2}
            />
            <Path
              d="M20 20l-4-4"
              stroke={text.muted}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t.explore.searchPlaceholder}
            placeholderTextColor={text.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t.explore.searchPlaceholder}
          />
          {query.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={t.explore.clearSearchAria}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={styles.savedIconButton}
          onPress={onOpenSaved}
          accessibilityRole="button"
          accessibilityLabel={t.bottomTabs.saved}
        >
          <Svg width={26} height={26} viewBox="0 0 24 24" fill="none">
            <Path
              d="M6 3h12v18l-6-4-6 4z"
              stroke={text.primary}
              strokeWidth={2}
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {filteredArticles.length === 0 ? (
        <EmptyState
          title={t.explore.emptySearchTitle}
          description={t.explore.emptySearchDescription}
          actionLabel={query.length > 0 ? t.chips.all : undefined}
          onAction={query.length > 0 ? () => setQuery('') : undefined}
        />
      ) : (
        <FlatList
          key="explore-2col"
          data={filteredArticles}
          keyExtractor={(item) => item.id}
          numColumns={2}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.gridContent}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          removeClippedSubviews
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themes.neutral.background,
    paddingTop: size.topTabsTop,
  },
  cardModeContainer: {
    flex: 1,
  },
  cardTopBar: {
    position: 'absolute',
    top: 52,
    left: size.pageSide,
    right: size.pageSide,
    zIndex: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    color: text.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  counterPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: {
    fontSize: 12,
    fontWeight: '800',
  },
  searchHeaderRow: {
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchBox: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    backgroundColor: themes.neutral.panel,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: text.primary,
    fontSize: 15,
    height: 48,
  },
  clearButton: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    color: text.muted,
    fontSize: 14,
    fontWeight: '700',
  },
  savedIconButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridContent: {
    paddingHorizontal: 10,
    paddingBottom: 28,
  },
  gridItem: {
    width: '50%',
    padding: 6,
  },
  cardBox: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  thumbBox: {
    position: 'relative',
    height: 104,
    borderBottomWidth: 1,
    overflow: 'hidden',
  },
  thumbImage: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  imageBottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: uiColors.overlayDark,
  },
  imageSourceText: {
    color: text.primary,
    fontSize: 10,
    fontWeight: '700',
  },
  customThumbContent: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: 10,
    justifyContent: 'flex-end',
  },
  circleFilled: {
    position: 'absolute',
    right: -24,
    top: -30,
    width: 96,
    height: 96,
    borderRadius: 48,
    opacity: 0.22,
  },
  circleOutline: {
    position: 'absolute',
    left: -16,
    bottom: -30,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1.5,
    opacity: 0.35,
  },
  watermarkText: {
    position: 'absolute',
    right: 8,
    top: 14,
    fontSize: 44,
    fontWeight: '900',
    opacity: 0.16,
    letterSpacing: -1,
  },
  genreMiniBadge: {
    position: 'absolute',
    right: 8,
    top: 8,
    maxWidth: '48%',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  genreMiniBadgeText: {
    color: text.muted,
    fontSize: 9,
    fontWeight: '700',
  },
  customThumbBottom: {
    gap: 4,
  },
  customThumbTopic: {
    color: text.primary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
  },
  customThumbSourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  miniToolDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  customThumbSource: {
    flex: 1,
    color: text.muted,
    fontSize: 10,
    fontWeight: '700',
  },
  tagPill: {
    position: 'absolute',
    left: 8,
    top: 8,
    maxWidth: '58%',
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 999,
  },
  tagPillText: {
    fontSize: 10,
    fontWeight: '900',
  },
  cardBody: {
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 11,
    minHeight: 104,
    justifyContent: 'space-between',
    gap: 6,
  },
  gridTitle: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
    color: text.primary,
  },
  gridMeta: {
    fontSize: 11,
    color: text.muted,
  },
});
