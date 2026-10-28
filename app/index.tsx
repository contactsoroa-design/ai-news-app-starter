import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  type AppStateStatus,
  FlatList,
  LayoutChangeEvent,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { SCREENSHOT_TAB } from '../store/screenshots/target';
import { CardSkeleton } from '../src/components/CardSkeleton';
import { EmptyState } from '../src/components/EmptyState';
import { ExploreView } from '../src/components/ExploreView';
import { NewsCard } from '../src/components/NewsCard';
import { SavedView } from '../src/components/SavedView';
import {
  SettingsView,
  SiteFaviconBadge,
} from '../src/components/SettingsView';
import { SponsoredCard } from '../src/components/SponsoredCard';
import { TabBarIcon } from '../src/components/TabBarIcon';
import { getCopy, getSourceDisplayName, limits } from '../src/lib/config';
import { DEMO_SWIPE_ENABLED } from '../src/lib/demoSwipe';
import {
  articleMatchesPrefsFilter,
  cleanArticleSummary,
  cleanArticleTitle,
  createDefaultUserPrefs,
  detectDeviceDefaultLocale,
  articleFeedTimestamp,
  fetchArticles,
  getAllSources,
  getBundledArticles,
  getArticleSourceFaviconUrl,
  getFaviconUrl,
  getVerifiedArticleTool,
  hydrateUserPrefs,
  normalizeAppLocale,
} from '../src/lib/feed';
import {
  fetchSponsoredItems,
  filterSponsoredForContext,
  findNearestSponsoredIndex,
  interleaveSponsoredCards,
  listSponsoredThenArticles,
  pickRelatedSponsored,
} from '../src/lib/sponsored';
import { looksLikeLocale, relocalizeArticles } from '../src/lib/translate';
import {
  getHiddenArticleIds,
  getPurgedArticleIds,
  getSavedArticleIds,
  getSavedArticlesData,
  getUserPrefs,
  setHiddenArticleIds,
  setPurgedArticleIds,
  setSavedArticleIds,
  setSavedArticlesData,
  setUserPrefs,
} from '../src/lib/storage';
import type {
  Article,
  FeedCardItem,
  Source,
  SponsoredItem,
  UserPrefs,
} from '../src/lib/types';
import { isSponsoredItem } from '../src/lib/types';
import {
  getThemeForArticle,
  size,
  text,
  themes,
  toolBadgeColors,
  toolSiteUrls,
  tools as allTools,
  uiColors,
} from '../src/theme/tokens';

type BottomTab = 'home' | 'explore' | 'saved' | 'settings';
type HomeTopTab = 'recommended' | 'source' | 'tool';

/** 製品レール用。情報源アイコンと同じ黒シンボル（白マットに載せる） */
const RELATED_SPONSOR_LOCAL_ICON: Record<
  string,
  ReturnType<typeof require>
> = {
  ElevenLabs: require('../assets/sponsors/elevenlabs-symbol.png'),
};

/** 先頭付近の OGP だけ先読み（favicon は帯域を奪うので後回し） */
function prefetchOgImages(
  items: ReadonlyArray<Article | FeedCardItem>,
  fromIndex: number,
  count: number
) {
  const urls: string[] = [];
  const end = Math.min(items.length, fromIndex + count);
  for (let i = Math.max(0, fromIndex); i < end; i += 1) {
    const item = items[i];
    if (!item || isSponsoredItem(item)) continue;
    if (item.og_image_url) urls.push(item.og_image_url);
  }
  if (urls.length > 0) {
    void Image.prefetch(urls, 'memory-disk');
  }
}

export default function HomeScreen() {
  const windowDims = useWindowDimensions();
  const [feedHeight, setFeedHeight] = useState(
    Math.max(windowDims.height - size.tabBarHeight, 500)
  );
  const flatListRef = useRef<FlatList<FeedCardItem> | null>(null);
  const sourceChipScrollRef = useRef<ScrollView | null>(null);
  /** ソースチップの content 内 x（ScrollView.scrollTo 用） */
  const sourceChipOffsetXRef = useRef<Record<string, number>>({});

  const sources = useMemo<Source[]>(() => getAllSources(), []);
  const [articles, setArticles] = useState<Article[]>([]);
  const [sponsoredItems, setSponsoredItems] = useState<SponsoredItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedArticlesData, setSavedArticlesDataState] = useState<Article[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  /** 「完全に消す」後の非表示（戻す対象外） */
  const [purgedIds, setPurgedIds] = useState<string[]>([]);
  const [prefs, setPrefs] = useState<UserPrefs>(() =>
    createDefaultUserPrefs(sources)
  );

  const [bottomTab, setBottomTab] = useState<BottomTab>('home');
  const [settingsSubScreen, setSettingsSubScreen] = useState<
    'root' | 'manage_sources' | 'manage_tools'
  >('root');

  /** スクショ撮影用（__DEV__ + store/screenshots/target.ts）。本番では無視 */
  useEffect(() => {
    if (typeof __DEV__ === 'undefined' || !__DEV__) return;
    if (
      SCREENSHOT_TAB === 'home' ||
      SCREENSHOT_TAB === 'explore' ||
      SCREENSHOT_TAB === 'saved' ||
      SCREENSHOT_TAB === 'settings'
    ) {
      setBottomTab(SCREENSHOT_TAB);
      if (SCREENSHOT_TAB === 'settings') setSettingsSubScreen('root');
    }
  }, []);
  const [topTab, setTopTab] = useState<HomeTopTab>('recommended');
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);

  const [currentIndex, setCurrentIndex] = useState(0);
  /** silent 更新後に同じ記事へ戻すための ID */
  const currentArticleIdRef = useRef<string | null>(null);
  const pendingRestoreArticleIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 探索から開いた記事を、絞り込みを壊さず一時的に先頭表示するためのID */
  const [previewArticleId, setPreviewArticleId] = useState<string | null>(null);
  const lastFeedRefreshAtRef = useRef(0);

  const loadData = useCallback(async (
    mode: 'initial' | 'refresh' | 'silent' = 'initial'
  ) => {
    const refreshStartedAt = mode === 'refresh' ? Date.now() : 0;
    if (mode === 'refresh') {
      setRefreshing(true);
    } else if (mode === 'initial') {
      setLoading(true);
      // 同梱フィードを即表示し、リモート待ち中でも OGP の取得を開始する
      const bootLocale = normalizeAppLocale(
        prefs.region_locale ?? detectDeviceDefaultLocale()
      );
      const bundled = getBundledArticles(bootLocale);
      if (bundled.length > 0) {
        setArticles(bundled);
        prefetchOgImages(bundled, 0, 3);
      }
    }
    setError(null);
    let uiLocale = prefs.region_locale;
    try {
      const localeGuess = normalizeAppLocale(
        prefs.region_locale ?? detectDeviceDefaultLocale()
      );
      // ストレージとフィード取得を並行。prefs 書き戻しは待たない
      const storagePromise = Promise.all([
        getSavedArticleIds(),
        getSavedArticlesData(),
        getHiddenArticleIds(),
        getPurgedArticleIds(),
        getUserPrefs(),
      ]);
      const feedPromise = fetchArticles(localeGuess, (partial) => {
        setArticles(partial);
        prefetchOgImages(partial, 0, 3);
      });
      const sponsoredPromise = fetchSponsoredItems();

      const [
        storedSaved,
        storedSavedArticles,
        storedHidden,
        storedPurged,
        storedPrefs,
      ] = await storagePromise;
      const nextPrefs = hydrateUserPrefs(
        storedPrefs,
        sources,
        detectDeviceDefaultLocale()
      );
      const targetLocale = nextPrefs.region_locale;
      uiLocale = targetLocale;
      setPrefs(nextPrefs);
      // 移行後の seen_source_ids などを端末へ書き戻し、次回以降の誤マージを防ぐ
      void setUserPrefs(nextPrefs);
      setSavedIds(storedSaved);
      setHiddenIds(storedHidden);
      setPurgedIds(storedPurged);

      const [fetchedArticles, fetchedSponsored] = await Promise.all([
        feedPromise,
        sponsoredPromise,
      ]);
      const localizedArticles =
        targetLocale === localeGuess
          ? fetchedArticles
          : relocalizeArticles(fetchedArticles, targetLocale);
      setArticles(localizedArticles);
      prefetchOgImages(localizedArticles, 0, 3);
      setSponsoredItems(fetchedSponsored);

      // 端末保存済みの記事データを復元・同期（日本語原文のみクリーンアップ。他言語訳を壊さない）
      try {
        const articleById = new Map<string, Article>();
        for (const a of storedSavedArticles) {
          const cleanedTitle = cleanArticleTitle(a.title_ja);
          const summaryNeedsJaClean = looksLikeLocale(a.summary_ja, 'ja');
          articleById.set(a.id, {
            ...a,
            title_ja: cleanedTitle,
            summary_ja: summaryNeedsJaClean
              ? cleanArticleSummary(
                  a.summary_ja,
                  cleanedTitle,
                  a.source_name
                )
              : a.summary_ja,
          });
        }
        for (const a of fetchedArticles) {
          if (storedSaved.includes(a.id)) {
            articleById.set(a.id, a);
          }
        }
        const syncedSavedArticles = storedSaved
          .map((id) => articleById.get(id))
          .filter((a): a is Article => Boolean(a));
        setSavedArticlesDataState(syncedSavedArticles);
        await setSavedArticlesData(syncedSavedArticles);
      } catch {
        // 保存同期の失敗でフィード全体を落とさない
      }
      // silent: 読んでいた記事 ID を覚えて再描画後に復帰。initial/refresh だけ先頭へ
      if (mode === 'silent') {
        pendingRestoreArticleIdRef.current = currentArticleIdRef.current;
      } else {
        pendingRestoreArticleIdRef.current = null;
        setCurrentIndex(0);
      }
      lastFeedRefreshAtRef.current = Date.now();
      if (mode === 'refresh') {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    } catch {
      // 最終手段: 同梱フィードだけでも表示する
      try {
        const fallback = await fetchArticles(uiLocale);
        if (fallback.length > 0) {
          setArticles(fallback);
          setError(null);
        } else {
          setError(getCopy(uiLocale).errorNetwork);
        }
      } catch {
        setError(getCopy(uiLocale).errorNetwork);
      }
    } finally {
      // 通信が速すぎてもスピナーが見えるよう最短表示
      if (mode === 'refresh') {
        const elapsed = Date.now() - refreshStartedAt;
        const minVisibleMs = 800;
        if (elapsed < minVisibleMs) {
          await new Promise((resolve) =>
            setTimeout(resolve, minVisibleMs - elapsed)
          );
        }
      }
      setLoading(false);
      setRefreshing(false);
    }
  }, [sources]);

  useEffect(() => {
    void loadData('initial');
  }, [loadData]);

  /** スクショ用: exp://…/?tab=explore&lang=en */
  useEffect(() => {
    const applyFromUrl = (url: string | null) => {
      if (!url) return;
      const tabMatch = url.match(/[?&]tab=(home|explore|saved|settings)\b/);
      if (tabMatch) {
        setBottomTab(tabMatch[1] as BottomTab);
        if (tabMatch[1] === 'settings') setSettingsSubScreen('root');
      }
      const langMatch = url.match(/[?&]lang=(ja|en)\b/);
      if (langMatch) {
        const nextLocale = langMatch[1] as 'ja' | 'en';
        setPrefs((prev) => {
          if (prev.region_locale === nextLocale) return prev;
          const stamped = {
            ...prev,
            region_locale: nextLocale,
            updated_at: new Date().toISOString(),
          };
          void setUserPrefs(stamped);
          return stamped;
        });
        setArticles((prev) => relocalizeArticles(prev, nextLocale));
      }
    };
    void Linking.getInitialURL().then(applyFromUrl);
    const sub = Linking.addEventListener('url', ({ url }) => applyFromUrl(url));
    return () => sub.remove();
  }, []);

  // フォアグラウンド復帰時にフィードを再取得（短時間の連続復帰はスキップ）
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const FEED_REFRESH_COOLDOWN_MS = 60_000;
    const onChange = (nextState: AppStateStatus) => {
      const wasBackgrounded =
        appStateRef.current === 'background' ||
        appStateRef.current === 'inactive';
      appStateRef.current = nextState;
      if (!wasBackgrounded || nextState !== 'active') return;
      const now = Date.now();
      if (now - lastFeedRefreshAtRef.current < FEED_REFRESH_COOLDOWN_MS) return;
      lastFeedRefreshAtRef.current = now;
      void loadData('silent');
    };
    const sub = AppState.addEventListener('change', onChange);
    lastFeedRefreshAtRef.current = Date.now();
    return () => sub.remove();
  }, [loadData]);

  const handlePullRefresh = useCallback(() => {
    if (refreshing || loading) return;
    void loadData('refresh');
  }, [loadData, refreshing, loading]);

  const t = getCopy(prefs.region_locale);
  const refreshProgressOffset = size.topTabsTop + size.minTap + 8;
  const feedRefreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={handlePullRefresh}
      tintColor={themes.neutral.accent}
      colors={[themes.neutral.accent]}
      progressBackgroundColor={themes.neutral.panel}
      progressViewOffset={refreshProgressOffset}
      accessibilityLabel={t.retryButton}
    />
  );

  // 有効なソース・ツール一覧（チップ表示用）
  const enabledSources = useMemo(() => {
    const map = new Set(prefs.enabled_source_ids);
    return sources.filter((s) => map.has(s.id));
  }, [sources, prefs.enabled_source_ids]);

  const availableTools = useMemo(() => {
    return prefs.tools.length > 0 ? prefs.tools : [...allTools];
  }, [prefs.tools]);

  // 設定の「情報源 × ジャンル × ツール」の掛け算（AND条件）に一致するベース記事リスト
  // 一時非表示（hidden）＋完全非表示（purged）の両方をフィードから除外
  const hiddenIdSet = useMemo(
    () => new Set([...hiddenIds, ...purgedIds]),
    [hiddenIds, purgedIds]
  );
  const enabledSourceIdSet = useMemo(
    () => new Set(enabledSources.map((s) => s.id)),
    [enabledSources]
  );
  const baseFilteredArticles = useMemo(() => {
    return articles.filter((article) => {
      if (hiddenIdSet.has(article.id)) return false;
      return articleMatchesPrefsFilter(article, prefs, enabledSourceIdSet);
    });
  }, [articles, hiddenIdSet, enabledSourceIdSet, prefs]);

  // ホーム画面の上部タブ（おすすめ / ソース別 / ツール別）の表示記事
  const visibleArticles = useMemo((): FeedCardItem[] => {
    let filtered = baseFilteredArticles.filter((article) => {
      if (topTab === 'source' && selectedSourceId) {
        return article.source_id === selectedSourceId;
      }
      if (topTab === 'tool' && selectedTool) {
        return getVerifiedArticleTool(article) === selectedTool;
      }
      return true;
    });

    // 探索から開いた記事が絞り込み外でも、設定を壊さず一時的に先頭へ差し込む
    if (previewArticleId && topTab === 'recommended') {
      const already = filtered.some((a) => a.id === previewArticleId);
      if (!already) {
        const preview = articles.find((a) => a.id === previewArticleId);
        if (preview && !hiddenIdSet.has(preview.id)) {
          filtered = [preview, ...filtered];
        }
      }
    }

    // 公開日と取り込み時刻の遅い方で新しい順。preview 先頭は維持する
    const preview = previewArticleId
      ? filtered.find((a) => a.id === previewArticleId)
      : undefined;
    const rest = filtered
      .filter((a) => a.id !== previewArticleId)
      .sort(
        (a, b) => articleFeedTimestamp(b) - articleFeedTimestamp(a)
      );
    const ordered = preview ? [preview, ...rest] : rest;

    // スポンサード:
    // - おすすめ: 設定絞り込みに関係なく差し込み
    // - ソース別／ツール別「すべて」: prefs に合う案件を差し込み
    // - 個別選択: そのツール／ソース専用の広告があるときだけ先頭一覧＋記事
    if (sponsoredItems.length === 0) return ordered;

    const matchMode =
      topTab === 'source' ? 'source' : topTab === 'tool' ? 'tool' : 'recommended';
    const sourceOrToolNarrowed =
      (topTab === 'source' && selectedSourceId !== null) ||
      (topTab === 'tool' && selectedTool !== null);
    const activeSponsored = sponsoredItems.filter((s) => {
      if (s.active === false) return false;
      if (hiddenIdSet.has(s.id)) return false;
      for (const hid of hiddenIdSet) {
        if (hid.startsWith(`${s.id}__`)) return false;
      }
      return true;
    });
    const matchedSponsored = filterSponsoredForContext(activeSponsored, {
      mode: matchMode,
      selectedTool,
      selectedSourceId,
      prefsTools: prefs.tools,
      enabledSourceIds: enabledSourceIdSet,
    });
    if (matchedSponsored.length === 0) return ordered;

    if (sourceOrToolNarrowed) {
      return listSponsoredThenArticles(ordered, matchedSponsored, {
        locale: prefs.region_locale,
      });
    }

    return interleaveSponsoredCards(ordered, matchedSponsored, {
      locale: prefs.region_locale,
    });
  }, [
    baseFilteredArticles,
    topTab,
    selectedSourceId,
    selectedTool,
    previewArticleId,
    articles,
    hiddenIdSet,
    prefs.region_locale,
    prefs.tools,
    enabledSourceIdSet,
    sponsoredItems,
  ]);

  // 端末に保存された記事データ（フィードから消えた過去記事も含めて保持）
  const savedArticles = useMemo(() => {
    const map = new Map<string, Article>();
    for (const a of savedArticlesData) {
      map.set(a.id, a);
    }
    for (const a of articles) {
      if (savedIds.includes(a.id)) {
        map.set(a.id, a);
      }
    }
    return savedIds
      .map((id) => map.get(id))
      .filter((a): a is Article => Boolean(a));
  }, [articles, savedArticlesData, savedIds]);

  const safeIndex =
    visibleArticles.length > 0
      ? Math.min(currentIndex, visibleArticles.length - 1)
      : 0;

  /** 表示中カード周辺の OGP を先読み（favicon は現在カードのみ） */
  useEffect(() => {
    if (visibleArticles.length === 0) return;
    prefetchOgImages(visibleArticles, Math.max(0, safeIndex - 1), 4);
    const current = visibleArticles[safeIndex];
    if (current && !isSponsoredItem(current)) {
      const favicon = getArticleSourceFaviconUrl(current);
      if (favicon) {
        void Image.prefetch([favicon], 'memory-disk');
      }
    }
  }, [safeIndex, visibleArticles]);

  const activeCard = visibleArticles[safeIndex];
  const activeArticle =
    activeCard && !isSponsoredItem(activeCard) ? activeCard : null;
  const activeSponsored =
    activeCard && isSponsoredItem(activeCard) ? activeCard : null;

  const overrideToolForTheme = topTab === 'tool' ? selectedTool : null;
  const verifiedActiveTool = activeArticle
    ? getVerifiedArticleTool(activeArticle, overrideToolForTheme)
    : activeSponsored?.tool_tag?.trim() || '';
  const activeTheme =
    bottomTab === 'home' && (activeArticle || activeSponsored)
      ? getThemeForArticle(
          verifiedActiveTool ? [verifiedActiveTool] : [],
          verifiedActiveTool || null
        ).colors
      : bottomTab === 'home' && topTab === 'tool' && selectedTool
      ? getThemeForArticle([], selectedTool).colors
      : themes.neutral;

  const handleToggleSave = useCallback(
    (articleId: string) => {
      setSavedIds((prev) => {
        const isRemoving = prev.includes(articleId);
        const nextIds = isRemoving
          ? prev.filter((id) => id !== articleId)
          : [...prev, articleId];
        setSavedArticleIds(nextIds);

        setSavedArticlesDataState((prevArticles) => {
          let nextArticles: Article[];
          if (isRemoving) {
            nextArticles = prevArticles.filter((a) => a.id !== articleId);
          } else {
            const target = articles.find((a) => a.id === articleId);
            const exists = prevArticles.some((a) => a.id === articleId);
            nextArticles =
              target && !exists ? [...prevArticles, target] : prevArticles;
          }
          setSavedArticlesData(nextArticles);
          return nextArticles;
        });

        return nextIds;
      });
    },
    [articles]
  );

  const handleHideArticle = useCallback((articleId: string) => {
    setHiddenIds((prev) => {
      if (prev.includes(articleId)) return prev;
      const next = [...prev, articleId];
      void setHiddenArticleIds(next);
      return next;
    });
  }, []);

  const handleResetHidden = useCallback(async () => {
    setHiddenIds([]);
    await setHiddenArticleIds([]);
    setCurrentIndex(0);
  }, []);

  /** 非表示を確定 → purged へ移し、戻す対象から外す */
  const handlePurgeHidden = useCallback(async () => {
    const moving = hiddenIds;
    if (moving.length === 0) return;
    setPurgedIds((prev) => {
      const merged = [...prev];
      for (const id of moving) {
        if (!merged.includes(id)) merged.push(id);
      }
      const next = merged.slice(-limits.maxHiddenIds);
      void setPurgedArticleIds(next);
      return next;
    });
    setHiddenIds([]);
    await setHiddenArticleIds([]);
    setCurrentIndex(0);
  }, [hiddenIds]);

  const handleUpdatePrefs = useCallback(
    async (next: UserPrefs | ((prev: UserPrefs) => UserPrefs)) => {
      const prevLocale = prefs.region_locale;
      // 絞り込み変更時は探索プレビューを破棄し、おすすめに即反映する
      setPreviewArticleId(null);

      // setState の updater 副作用に頼らず、保存・ローカライズ用オブジェクトを同期的に作る
      const resolved = typeof next === 'function' ? next(prefs) : next;
      const stamped: UserPrefs = {
        ...resolved,
        genres: Array.isArray(resolved.genres) ? resolved.genres : [],
        tools: Array.isArray(resolved.tools) ? resolved.tools : [],
        region_locale: normalizeAppLocale(resolved.region_locale),
        seen_source_ids: sources.map((s) => s.id),
        updated_at: resolved.updated_at || new Date().toISOString(),
      };
      setPrefs(stamped);
      setCurrentIndex(0);
      await setUserPrefs(stamped);

      // 言語変更時は保持中の translations から即載せ替え（通信不要）。続けて最新JSONも取り込み
      if (stamped.region_locale !== prevLocale) {
        setArticles((prev) => relocalizeArticles(prev, stamped.region_locale));
        try {
          const localized = await fetchArticles(stamped.region_locale);
          setArticles(localized);
        } catch {
          // 手元の載せ替えは済んでいるので、通信失敗でも表示言語は維持する
        }
      }
    },
    [prefs, sources]
  );

  /** FlatList をジャンル／ツール変更時にも確実に載せ替えるためのキー */
  const feedFilterKey = useMemo(() => {
    const genreKey =
      prefs.genres.length > 0
        ? [...prefs.genres].sort().join('+')
        : 'all-genres';
    const toolKey =
      prefs.tools.length > 0 ? [...prefs.tools].sort().join('+') : 'all-tools';
    return [
      topTab,
      selectedSourceId ?? 'all',
      selectedTool ?? 'all',
      genreKey,
      toolKey,
      prefs.enabled_source_ids.length,
      prefs.region_locale,
    ].join('|');
  }, [
    topTab,
    selectedSourceId,
    selectedTool,
    prefs.genres,
    prefs.tools,
    prefs.enabled_source_ids.length,
    prefs.region_locale,
  ]);

  const handleOpenManage = useCallback(
    (target: 'manage_sources' | 'manage_tools') => {
      setSettingsSubScreen(target);
      setBottomTab('settings');
    },
    []
  );

  const scrollHomeToTop = useCallback(() => {
    setPreviewArticleId(null);
    setCurrentIndex(0);
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: 0,
        animated: true,
      });
    });
  }, []);

  /** 記事レールの製品アイコン → フィード内の該当広告カードへ */
  const scrollHomeToSponsoredIndex = useCallback(
    (index: number) => {
      if (index < 0 || feedHeight <= 0) return;
      setBottomTab('home');
      setCurrentIndex(index);
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToIndex({
          index,
          animated: true,
        });
      });
    },
    [feedHeight]
  );

  /** LP録画用: 実フィードをループ自動スワイプ（demoSwipe.ts のフラグ） */
  useEffect(() => {
    if (!DEMO_SWIPE_ENABLED) return;
    if (bottomTab !== 'home' || topTab !== 'recommended') return;
    if (feedHeight <= 0 || visibleArticles.length < 2) return;
    let step = 0;
    const maxSteps = Math.min(6, visibleArticles.length - 1);
    const timer = setInterval(() => {
      step += 1;
      if (step > maxSteps) {
        step = 0;
      }
      flatListRef.current?.scrollToIndex({
        index: step,
        animated: true,
      });
      setCurrentIndex(step);
    }, 1400);
    return () => clearInterval(timer);
  }, [bottomTab, topTab, feedHeight, visibleArticles.length]);

  const scrollSourceChipIntoView = useCallback(
    (sourceId: string | null, animated = true) => {
      const key = sourceId ?? '__all__';
      const x = sourceChipOffsetXRef.current[key];
      if (typeof x !== 'number') return;
      sourceChipScrollRef.current?.scrollTo({
        x: Math.max(0, x - 12),
        animated,
      });
    },
    []
  );

  /** 記事の情報源アイコン／名から「ソース別」タブへ */
  const handleOpenSourceFeed = useCallback(
    (article: Article) => {
      const sourceId =
        article.source_id ||
        sources.find((s) => s.name === article.source_name)?.id ||
        null;
      if (!sourceId) return;

      setPreviewArticleId(null);
      setTopTab('source');
      setSelectedSourceId(sourceId);
      setSelectedTool(null);
      setCurrentIndex(0);
      setBottomTab('home');

      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({
          offset: 0,
          animated: false,
        });
        // チップ列マウント後に選択ソースまで横スクロール
        setTimeout(() => scrollSourceChipIntoView(sourceId, true), 80);
      });
    },
    [sources, scrollSourceChipIntoView]
  );

  // ソース別表示中に選択が変わったらチップ列を追従（レイアウト遅延にも対応）
  useEffect(() => {
    if (bottomTab !== 'home' || topTab !== 'source') return;
    const timer = setTimeout(
      () => scrollSourceChipIntoView(selectedSourceId, true),
      60
    );
    return () => clearTimeout(timer);
  }, [
    bottomTab,
    topTab,
    selectedSourceId,
    enabledSources.length,
    scrollSourceChipIntoView,
  ]);

  const handleMomentumScrollEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    if (feedHeight <= 0) return;
    const nextIdx = Math.round(e.nativeEvent.contentOffset.y / feedHeight);
    if (nextIdx >= 0 && nextIdx < visibleArticles.length) {
      setCurrentIndex(nextIdx);
      const item = visibleArticles[nextIdx];
      currentArticleIdRef.current =
        item && !isSponsoredItem(item) ? item.id : currentArticleIdRef.current;
    }
  };

  // silent 更新後、同じ記事が見える位置へ戻す（先頭固定の体感を防ぐ）
  useEffect(() => {
    const restoreId = pendingRestoreArticleIdRef.current;
    if (!restoreId || feedHeight <= 0 || visibleArticles.length === 0) return;
    const idx = visibleArticles.findIndex(
      (item) => !isSponsoredItem(item) && item.id === restoreId
    );
    pendingRestoreArticleIdRef.current = null;
    if (idx < 0) return;
    setCurrentIndex(idx);
    requestAnimationFrame(() => {
      flatListRef.current?.scrollToOffset({
        offset: feedHeight * idx,
        animated: false,
      });
    });
  }, [visibleArticles, feedHeight]);

  const handleFeedLayout = (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    if (h > 0) {
      setFeedHeight(h);
    }
  };

  const hasChipRow = topTab === 'source' || topTab === 'tool';

  return (
    <View style={[styles.screen, { backgroundColor: activeTheme.background }]}>
      {/* メイン領域 */}
      <View style={styles.mainArea} onLayout={handleFeedLayout}>
        {bottomTab === 'home' ? (
          <>
            {loading && !refreshing && visibleArticles.length === 0 ? (
              <CardSkeleton />
            ) : error ? (
              <ScrollView
                contentContainerStyle={styles.pullRefreshFill}
                refreshControl={feedRefreshControl}
              >
                <EmptyState
                  title={error}
                  actionLabel={t.retryButton}
                  onAction={handlePullRefresh}
                />
              </ScrollView>
            ) : visibleArticles.length === 0 ? (
              <ScrollView
                contentContainerStyle={styles.pullRefreshFill}
                refreshControl={feedRefreshControl}
              >
                <EmptyState
                  title={t.emptyFeed}
                  actionLabel={
                    hiddenIds.length > 0
                      ? t.resetHiddenButton
                      : t.editSourcesButton
                  }
                  onAction={
                    hiddenIds.length > 0
                      ? handleResetHidden
                      : () =>
                          handleOpenManage(
                            topTab === 'tool' ? 'manage_tools' : 'manage_sources'
                          )
                  }
                />
              </ScrollView>
            ) : (
              <FlatList
                key={feedFilterKey}
                ref={flatListRef}
                data={visibleArticles}
                extraData={`${feedFilterKey}:${refreshing ? '1' : '0'}`}
                keyExtractor={(item) => item.id}
                pagingEnabled={!refreshing}
                bounces
                alwaysBounceVertical
                overScrollMode="always"
                showsVerticalScrollIndicator={false}
                decelerationRate="fast"
                {...(refreshing
                  ? {}
                  : {
                      snapToInterval: feedHeight,
                      snapToAlignment: 'start' as const,
                    })}
                initialScrollIndex={
                  visibleArticles.length > 0
                    ? Math.max(0, Math.min(safeIndex, visibleArticles.length - 1))
                    : 0
                }
                initialNumToRender={3}
                maxToRenderPerBatch={4}
                windowSize={7}
                onMomentumScrollEnd={handleMomentumScrollEnd}
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
                refreshControl={feedRefreshControl}
                renderItem={({ item, index }) => {
                  if (isSponsoredItem(item)) {
                    return (
                      <SponsoredCard
                        item={item}
                        index={index}
                        total={visibleArticles.length}
                        cardHeight={feedHeight}
                        hasChipRow={hasChipRow}
                        locale={prefs.region_locale}
                        overrideTool={overrideToolForTheme}
                        onHide={handleHideArticle}
                      />
                    );
                  }

                  const related = pickRelatedSponsored(
                    item,
                    sponsoredItems.filter((s) => s.active !== false)
                  );
                  const jumpIndex = related
                    ? findNearestSponsoredIndex(
                        visibleArticles,
                        index,
                        related
                      )
                    : -1;
                  const siteForIcon = related?.tool_tag
                    ? toolSiteUrls[related.tool_tag]
                    : null;
                  const localIcon = related?.tool_tag
                    ? RELATED_SPONSOR_LOCAL_ICON[related.tool_tag]
                    : undefined;
                  // フィード内に広告カードが無くてもアイコンは出す（タップでジャンプ or 公式へ）
                  const relatedSponsor = related
                    ? {
                        name: related.advertiser_name,
                        iconUrl:
                          (siteForIcon
                            ? getFaviconUrl(siteForIcon)
                            : null) ||
                          getFaviconUrl(related.url) ||
                          related.image_url,
                        iconSource: localIcon ?? null,
                        onPress: () => {
                          if (jumpIndex >= 0) {
                            scrollHomeToSponsoredIndex(jumpIndex);
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
                      total={visibleArticles.length}
                      cardHeight={feedHeight}
                      hasChipRow={hasChipRow}
                      showOriginalButton={prefs.show_original_button}
                      overrideTool={overrideToolForTheme}
                      highlightGenres={prefs.genres}
                      locale={prefs.region_locale}
                      relatedSponsor={relatedSponsor}
                      isSaved={savedIds.includes(item.id)}
                      onToggleSave={handleToggleSave}
                      onHideArticle={handleHideArticle}
                      onPressSource={handleOpenSourceFeed}
                    />
                  );
                }}
              />
            )}

            {refreshing ? (
              <View
                style={[
                  styles.refreshBanner,
                  { top: refreshProgressOffset },
                ]}
                pointerEvents="none"
                accessibilityLiveRegion="polite"
                accessibilityLabel={t.refreshingFeed}
              >
                <ActivityIndicator
                  size="small"
                  color={themes.neutral.accent}
                />
                <Text style={styles.refreshBannerText}>
                  {t.refreshingFeed}
                </Text>
              </View>
            ) : null}

            {/* 上部タブ (top 54 / 15px bold / 選択中は accent の下線2px) */}
            <View style={styles.topTabs} pointerEvents="box-none">
              {(
                [
                  { key: 'recommended', label: t.topTabs.recommended },
                  { key: 'source', label: t.topTabs.bySource },
                  { key: 'tool', label: t.topTabs.byTool },
                ] as const
              ).map((tab) => {
                const selected = topTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    style={[
                      styles.topTabItem,
                      selected && [
                        styles.topTabItemActive,
                        { borderBottomColor: activeTheme.accent },
                      ],
                    ]}
                    onPress={() => {
                      setPreviewArticleId(null);
                      setTopTab(tab.key);
                      setCurrentIndex(0);
                      requestAnimationFrame(() => {
                        flatListRef.current?.scrollToOffset({
                          offset: 0,
                          animated: false,
                        });
                      });
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                  >
                    <Text
                      style={
                        selected ? styles.topTabTextActive : styles.topTabText
                      }
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {/* ソース別・ツール別 チップ列 (top 100 / 高さ44 / 右端に「＋ 編集」固定) */}
            {topTab === 'source' ? (
              <View style={styles.chipRowContainer}>
                <ScrollView
                  ref={sourceChipScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipScrollContent}
                >
                  <Pressable
                    style={[
                      styles.chipButton,
                      selectedSourceId === null
                        ? {
                            backgroundColor: activeTheme.accent,
                            borderColor: activeTheme.accent,
                          }
                        : { borderColor: activeTheme.line },
                    ]}
                    onLayout={(e) => {
                      sourceChipOffsetXRef.current.__all__ =
                        e.nativeEvent.layout.x;
                    }}
                    onPress={() => {
                      setSelectedSourceId(null);
                      setCurrentIndex(0);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedSourceId === null }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedSourceId === null && {
                          color: activeTheme.background,
                        },
                      ]}
                    >
                      {t.chips.all}
                    </Text>
                  </Pressable>

                  {enabledSources.map((src) => {
                    const selected = selectedSourceId === src.id;
                    const displayName = getSourceDisplayName(
                      src.name,
                      prefs.region_locale
                    );
                    const initial = displayName.slice(0, 2).toUpperCase();
                    return (
                      <Pressable
                        key={src.id}
                        style={[
                          styles.chipButton,
                          selected
                            ? {
                                backgroundColor: activeTheme.accent,
                                borderColor: activeTheme.accent,
                              }
                            : { borderColor: activeTheme.line },
                        ]}
                        onLayout={(e) => {
                          const x = e.nativeEvent.layout.x;
                          sourceChipOffsetXRef.current[src.id] = x;
                          // 遷移直後はレイアウト後に選択チップへ寄せる
                          if (selected) {
                            sourceChipScrollRef.current?.scrollTo({
                              x: Math.max(0, x - 12),
                              animated: true,
                            });
                          }
                        }}
                        onPress={() => {
                          setSelectedSourceId(src.id);
                          setCurrentIndex(0);
                          requestAnimationFrame(() => {
                            scrollSourceChipIntoView(src.id, true);
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                        accessibilityLabel={displayName}
                      >
                        <SiteFaviconBadge
                          siteUrl={src.site_url}
                          fallbackInitial={initial}
                          fallbackBg={uiColors.avatarSurface}
                          fallbackFg={text.primary}
                          sizePx={20}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            selected && { color: activeTheme.background },
                          ]}
                        >
                          {displayName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  style={styles.editChipButton}
                  onPress={() => handleOpenManage('manage_sources')}
                  accessibilityRole="button"
                  accessibilityLabel={t.chips.editAria}
                >
                  <Text style={styles.chipText}>{t.chips.edit}</Text>
                </Pressable>
              </View>
            ) : null}

            {topTab === 'tool' ? (
              <View style={styles.chipRowContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.chipScroll}
                  contentContainerStyle={styles.chipScrollContent}
                >
                  <Pressable
                    style={[
                      styles.chipButton,
                      selectedTool === null
                        ? {
                            backgroundColor: activeTheme.accent,
                            borderColor: activeTheme.accent,
                          }
                        : { borderColor: activeTheme.line },
                    ]}
                    onPress={() => {
                      setSelectedTool(null);
                      setCurrentIndex(0);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selectedTool === null }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedTool === null && {
                          color: activeTheme.background,
                        },
                      ]}
                    >
                      {t.chips.all}
                    </Text>
                  </Pressable>

                  {availableTools.map((tool) => {
                    const selected = selectedTool === tool;
                    const badge = toolBadgeColors[tool] ?? {
                      bg: activeTheme.accent,
                      fg: activeTheme.background,
                      initial: tool.slice(0, 1),
                    };
                    return (
                      <Pressable
                        key={tool}
                        style={[
                          styles.chipButton,
                          selected
                            ? {
                                backgroundColor: activeTheme.accent,
                                borderColor: activeTheme.accent,
                              }
                            : { borderColor: activeTheme.line },
                        ]}
                        onPress={() => {
                          setSelectedTool(tool);
                          setCurrentIndex(0);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected }}
                      >
                        <SiteFaviconBadge
                          siteUrl={toolSiteUrls[tool]}
                          fallbackInitial={badge.initial}
                          fallbackBg={badge.bg}
                          fallbackFg={badge.fg}
                          sizePx={20}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            selected && { color: activeTheme.background },
                          ]}
                        >
                          {tool}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                <Pressable
                  style={styles.editChipButton}
                  onPress={() => handleOpenManage('manage_tools')}
                  accessibilityRole="button"
                  accessibilityLabel={t.chips.editAria}
                >
                  <Text style={styles.chipText}>{t.chips.edit}</Text>
                </Pressable>
              </View>
            ) : null}
          </>
        ) : bottomTab === 'explore' ? (
          <ExploreView
            articles={baseFilteredArticles}
            savedIds={savedIds}
            showOriginalButton={prefs.show_original_button}
            sponsoredItems={sponsoredItems.filter((s) => {
              if (s.active === false) return false;
              if (hiddenIdSet.has(s.id)) return false;
              for (const hid of hiddenIdSet) {
                if (hid.startsWith(`${s.id}__`)) return false;
              }
              return true;
            })}
            prefsTools={prefs.tools}
            enabledSourceIds={enabledSourceIdSet}
            onToggleSave={handleToggleSave}
            onHideArticle={handleHideArticle}
            onOpenSaved={() => setBottomTab('saved')}
            onPressSource={handleOpenSourceFeed}
            locale={prefs.region_locale}
          />
        ) : bottomTab === 'saved' ? (
          <SavedView
            savedArticles={savedArticles}
            showOriginalButton={prefs.show_original_button}
            locale={prefs.region_locale}
            onRemoveSaved={handleToggleSave}
          />
        ) : (
          <SettingsView
            key={settingsSubScreen}
            sources={sources}
            prefs={prefs}
            hiddenCount={hiddenIds.length}
            matchingCount={baseFilteredArticles.length}
            initialSubScreen={settingsSubScreen}
            onUpdatePrefs={handleUpdatePrefs}
            onResetHidden={handleResetHidden}
            onPurgeHidden={handlePurgeHidden}
            onStartSwiping={() => {
              setSettingsSubScreen('root');
              setPreviewArticleId(null);
              setTopTab('recommended');
              setCurrentIndex(0);
              setBottomTab('home');
              requestAnimationFrame(() => {
                flatListRef.current?.scrollToOffset({
                  offset: 0,
                  animated: false,
                });
              });
            }}
          />
        )}
      </View>

      {/* 下タブ (高さ84 / ホーム 探索 保存済み 設定) */}
      <View
        style={[
          styles.bottomTabBar,
          {
            backgroundColor: activeTheme.background,
            borderTopColor: activeTheme.line,
          },
        ]}
      >
        {(
          [
            { key: 'home', label: t.bottomTabs.home, icon: 'home' },
            { key: 'explore', label: t.bottomTabs.explore, icon: 'explore' },
            { key: 'saved', label: t.bottomTabs.saved, icon: 'saved' },
            { key: 'settings', label: t.bottomTabs.settings, icon: 'settings' },
          ] as const
        ).map((tab) => {
          const selected = bottomTab === tab.key;
          const iconColor = selected ? text.primary : text.muted;
          return (
            <Pressable
              key={tab.key}
              style={styles.bottomTabItem}
              onPress={() => {
                if (tab.key === 'home' && bottomTab === 'home') {
                  scrollHomeToTop();
                  return;
                }
                if (tab.key === 'settings') {
                  setSettingsSubScreen('root');
                }
                setBottomTab(tab.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={tab.label}
            >
              <TabBarIcon name={tab.icon} color={iconColor} size={24} />
              <Text
                style={
                  selected ? styles.bottomTabTextActive : styles.bottomTabText
                }
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  mainArea: {
    flex: 1,
    position: 'relative',
  },
  pullRefreshFill: {
    flexGrow: 1,
  },
  refreshBanner: {
    position: 'absolute',
    left: size.pageSide,
    right: size.pageSide,
    zIndex: 20,
    minHeight: size.minTap,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: uiColors.cardSurface,
    borderWidth: 1,
    borderColor: uiColors.cardBorder,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 4 },
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  refreshBannerText: {
    flex: 1,
    color: text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  topTabs: {
    position: 'absolute',
    top: size.topTabsTop,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 22,
  },
  topTabItem: {
    minHeight: size.minTap,
    paddingHorizontal: 4,
    justifyContent: 'center',
  },
  topTabItemActive: {
    borderBottomWidth: 2,
  },
  topTabText: {
    color: text.muted,
    fontSize: 15,
    fontWeight: '700',
  },
  topTabTextActive: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  chipRowContainer: {
    position: 'absolute',
    top: size.chipRowTop,
    left: 0,
    right: 0,
    paddingHorizontal: size.pageSide,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chipScroll: {
    flex: 1,
  },
  chipScrollContent: {
    gap: 8,
    paddingRight: 4,
  },
  chipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: size.chipHeight,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  editChipButton: {
    minHeight: size.chipHeight,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: uiColors.dashedBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  toolMiniBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolMiniBadgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  bottomTabBar: {
    height: size.tabBarHeight,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  bottomTabItem: {
    minWidth: size.minTap,
    minHeight: size.minTap,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    gap: 4,
  },
  bottomTabText: {
    color: text.muted,
    fontSize: 11,
  },
  bottomTabTextActive: {
    color: text.primary,
    fontSize: 11,
    fontWeight: '700',
  },
});
