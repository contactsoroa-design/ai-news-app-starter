import React, { useCallback, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type ViewToken,
} from 'react-native';
import { copy } from '../lib/config';
import { formatShortDateJa, getVerifiedArticleTool } from '../lib/feed';
import type { Article } from '../lib/types';
import { getThemeForArticle, size, text, themes, uiColors } from '../theme/tokens';
import { EmptyState } from './EmptyState';
import { NewsCard } from './NewsCard';

type SavedViewProps = {
  savedArticles: Article[];
  showOriginalButton: boolean;
  onRemoveSaved: (articleId: string) => void;
};

export function SavedView({
  savedArticles,
  showOriginalButton,
  onRemoveSaved,
}: SavedViewProps) {
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [feedHeight, setFeedHeight] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<Article>>(null);

  const selectedIndex = selectedArticleId
    ? savedArticles.findIndex((a) => a.id === selectedArticleId)
    : -1;

  const isShowingCard = selectedArticleId !== null && selectedIndex >= 0;

  const handleOpenCard = useCallback((article: Article, index: number) => {
    setSelectedArticleId(article.id);
    setCurrentIndex(index);
  }, []);

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
        const item = savedArticles[idx];
        if (item) {
          setSelectedArticleId(item.id);
        }
      }
    },
    [savedArticles]
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
  }).current;

  const renderSavedListItem = useCallback(
    ({ item: article, index }: { item: Article; index: number }) => {
      const dateStr = formatShortDateJa(article.published_at);
      const meta = [dateStr, article.source_name].filter(Boolean).join(' ・ ');
      return (
        <View style={styles.itemCard}>
          <Pressable
            style={styles.itemMain}
            onPress={() => handleOpenCard(article, index)}
            accessibilityRole="button"
            accessibilityLabel={article.title_ja}
          >
            <Text style={styles.itemTitle}>{article.title_ja}</Text>
            <Text style={styles.itemMeta}>{meta}</Text>
          </Pressable>
          <Pressable
            style={styles.removeButton}
            onPress={() => onRemoveSaved(article.id)}
            accessibilityRole="button"
            accessibilityLabel={copy.saved.removeAria}
          >
            <Text style={styles.removeButtonText}>{copy.saved.removeLabel}</Text>
          </Pressable>
        </View>
      );
    },
    [handleOpenCard, onRemoveSaved]
  );

  if (isShowingCard) {
    const activeIndex = Math.min(currentIndex, savedArticles.length - 1);
    const activeArticle = savedArticles[activeIndex] ?? savedArticles[selectedIndex];
    const verifiedTool = activeArticle ? getVerifiedArticleTool(activeArticle) : '';
    const activeTheme = activeArticle
      ? getThemeForArticle(verifiedTool ? [verifiedTool] : []).colors
      : themes.neutral;

    return (
      <View
        style={[styles.cardModeContainer, { backgroundColor: activeTheme.background }]}
        onLayout={handleLayout}
      >
        {feedHeight > 0 ? (
          <FlatList
            ref={flatListRef}
            data={savedArticles}
            keyExtractor={(item) => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={feedHeight}
            snapToAlignment="start"
            initialScrollIndex={
              savedArticles.length > 0
                ? Math.max(0, Math.min(selectedIndex, savedArticles.length - 1))
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
              flatListRef.current?.scrollToOffset({
                offset: feedHeight * index,
                animated: false,
              });
            }}
            renderItem={({ item, index }) => (
              <NewsCard
                article={item}
                index={index}
                total={savedArticles.length}
                cardHeight={feedHeight}
                hasChipRow={false}
                isSaved={true}
                showOriginalButton={showOriginalButton}
                onToggleSave={onRemoveSaved}
                onHideArticle={onRemoveSaved}
              />
            )}
          />
        ) : null}

        {/* 上部オーバーレイ：保存済み一覧へ戻るバー */}
        <View style={styles.cardTopBar}>
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
            accessibilityLabel={copy.saved.backToListAria}
          >
            <Text style={styles.backButtonText}>{copy.saved.backToList}</Text>
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
              {activeIndex + 1} / {savedArticles.length}
            </Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.subtitle}>{copy.saved.subtitle}</Text>
        <Text style={styles.title}>{copy.saved.title}</Text>
      </View>

      {savedArticles.length === 0 ? (
        <EmptyState
          title={copy.saved.emptyTitle}
          description={copy.saved.emptyDescription}
        />
      ) : (
        <FlatList
          data={savedArticles}
          keyExtractor={(item) => item.id}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={5}
          renderItem={renderSavedListItem}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themes.neutral.background,
    paddingTop: 64,
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
  header: {
    paddingHorizontal: size.pageSide,
    marginBottom: 14,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: themes.neutral.accent,
  },
  title: {
    marginTop: 6,
    fontSize: 26,
    fontWeight: '900',
    color: text.primary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: size.pageSide,
    paddingBottom: 32,
    gap: 10,
  },
  itemCard: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: uiColors.cardSurface,
    borderWidth: 1,
    borderColor: uiColors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemMain: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    color: text.primary,
  },
  itemMeta: {
    fontSize: 12,
    color: text.muted,
    marginTop: 4,
  },
  removeButton: {
    minWidth: size.minTap,
    minHeight: size.minTap,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themes.neutral.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButtonText: {
    color: text.muted,
    fontSize: 12,
    fontWeight: '700',
  },
});
