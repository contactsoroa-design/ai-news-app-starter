import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { copy } from '../lib/config';
import { formatShortDateJa, getVerifiedArticleTool } from '../lib/feed';
import type { Article } from '../lib/types';
import {
  getThemeForArticle,
  size,
  text,
  themes,
  toolBadgeColors,
  uiColors,
} from '../theme/tokens';
import { EmptyState } from './EmptyState';

type ExploreViewProps = {
  articles: Article[];
  onSelectArticle: (articleId: string) => void;
  onOpenSaved: () => void;
};

type ExploreGridCellProps = {
  article: Article;
  onSelect: (articleId: string) => void;
};

const ExploreGridCell = memo(function ExploreGridCell({
  article,
  onSelect,
}: ExploreGridCellProps) {
  const primaryTool = getVerifiedArticleTool(article);
  const { colors } = getThemeForArticle(primaryTool ? [primaryTool] : []);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgFailed(false);
  }, [article.id, article.og_image_url]);

  const showImage = Boolean(article.og_image_url) && !imgFailed;

  const primaryGenre = (article.genre_tags ?? [])[0] || '';
  const sourceShortLabel =
    article.source_name.split(/[（(]/)[0]?.trim() || article.source_name;
  const badgeText = primaryTool || sourceShortLabel || primaryGenre || copy.explore.defaultTag;
  const dateStr = formatShortDateJa(article.published_at);

  const toolBadge =
    (primaryTool && toolBadgeColors[primaryTool]) || {
      bg: colors.accent,
      fg: colors.background,
      initial: sourceShortLabel.slice(0, 2).toUpperCase(),
    };

  // サムネイルの中だけで「何の記事か」がすぐわかるよう、見出しの主題を抽出
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
                key={article.og_image_url}
                source={{ uri: article.og_image_url }}
                style={styles.thumbImage}
                resizeMode="cover"
                onError={() => setImgFailed(true)}
              />
              <View style={styles.imageBottomGradient}>
                <Text style={styles.imageSourceText} numberOfLines={1}>
                  {article.source_name}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.customThumbContent}>
              {/* ツールカラーの装飾背景 */}
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

              {/* 右上：ジャンルサブバッジ */}
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
                    {primaryGenre}
                  </Text>
                </View>
              ) : null}

              {/* 中央〜下部：記事の核心キーワードと情報源 */}
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
                    {article.source_name}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* 左上：メインツールピル */}
          <View style={[styles.tagPill, { backgroundColor: colors.accent }]}>
            <Text
              style={[styles.tagPillText, { color: colors.background }]}
              numberOfLines={1}
            >
              {badgeText}
            </Text>
          </View>
        </View>

        {/* 見出しがしっかり読めるテキスト領域（2列カード幅・最大4行） */}
        <View style={styles.cardBody}>
          <Text style={styles.gridTitle} numberOfLines={4}>
            {article.title_ja}
          </Text>
          <Text style={styles.gridMeta} numberOfLines={1}>
            {[dateStr, article.source_name].filter(Boolean).join(' ・ ')}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

export function ExploreView({
  articles,
  onSelectArticle,
  onOpenSaved,
}: ExploreViewProps) {
  const [query, setQuery] = useState('');

  // 検索用インデックス文字列をarticles変更時に1回だけ事前生成し、キー入力ごとの文字列結合コストをゼロにする
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

  const renderItem = useCallback(
    ({ item }: { item: Article }) => (
      <ExploreGridCell article={item} onSelect={onSelectArticle} />
    ),
    [onSelectArticle]
  );

  return (
    <View style={styles.container}>
      {/* 上部検索バー＋保存済みボタン */}
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
            placeholder={copy.explore.searchPlaceholder}
            placeholderTextColor={text.muted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={copy.explore.searchPlaceholder}
          />
          {query.length > 0 ? (
            <Pressable
              style={styles.clearButton}
              onPress={() => setQuery('')}
              accessibilityRole="button"
              accessibilityLabel={copy.explore.clearSearchAria}
            >
              <Text style={styles.clearButtonText}>✕</Text>
            </Pressable>
          ) : null}
        </View>

        <Pressable
          style={styles.savedIconButton}
          onPress={onOpenSaved}
          accessibilityRole="button"
          accessibilityLabel={copy.bottomTabs.saved}
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
          title={copy.explore.emptySearchTitle}
          description={copy.explore.emptySearchDescription}
          actionLabel={query.length > 0 ? copy.chips.all : undefined}
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
