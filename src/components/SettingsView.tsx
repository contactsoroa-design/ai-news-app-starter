import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import {
  getCopy,
  getGenreLabel,
  getSourceCategoryLabel,
  regionLocales,
} from '../lib/config';
import { getFaviconUrl } from '../lib/feed';
import type { AppLocale, Source, SourceLanguageFilter, UserPrefs } from '../lib/types';
import {
  genres as allGenres,
  size,
  text,
  themes,
  toolBadgeColors,
  toolSiteUrls,
  tools as allTools,
  uiColors,
} from '../theme/tokens';

/**
 * ジャンル（分野）ごとの汎用アイコン（公式ロゴではない一般図形のためストア審査・商標上も完全に安全）
 */
function GenreIcon({ genre, color }: { genre: string; color: string }) {
  switch (genre) {
    case 'アップデート':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '個人開発・収益化':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 2l3 6 6 .9-4.3 4.2 1 6-5.7-3-5.7 3 1-6L3 8.9 9 8l3-6z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'マーケ・集客・ASO':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M3 17l6-6 4 4 8-8M14 7h7v7"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'SNS・ショート動画':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Rect
            x={6}
            y={2}
            width={12}
            height={20}
            rx={3}
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="M10 9l5 3-5 3V9z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '課金・ペイウォール':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Rect
            x={2}
            y={5}
            width={20}
            height={14}
            rx={2}
            stroke={color}
            strokeWidth={2}
          />
          <Path d="M2 10h20" stroke={color} strokeWidth={2} />
        </Svg>
      );
    case 'コスト・API料金':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
          <Path
            d="M12 7v10M9.5 9.5c0-1.1 1.1-2 2.5-2s2.5.9 2.5 2-1.1 1.8-2.5 2-2.5.9-2.5 2 1.1 2 2.5 2 2.5-.9 2.5-2"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case '開発':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M16 18l6-6-6-6M8 6l-6 6 6 6"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'ビジネス':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Rect
            x={3}
            y={7}
            width={18}
            height={13}
            rx={2}
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2"
            stroke={color}
            strokeWidth={2}
          />
        </Svg>
      );
    case '画像生成':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Rect
            x={3}
            y={3}
            width={18}
            height={18}
            rx={3}
            stroke={color}
            strokeWidth={2}
          />
          <Circle cx={8.5} cy={8.5} r={1.5} fill={color} />
          <Path
            d="M21 15l-5-5L5 21"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '動画':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={2} />
          <Path
            d="M10 8l6 4-6 4V8z"
            stroke={color}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </Svg>
      );
    case '音声':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Rect
            x={9}
            y={2}
            width={6}
            height={11}
            rx={3}
            stroke={color}
            strokeWidth={2}
          />
          <Path
            d="M5 10a7 7 0 0014 0M12 17v4M8 21h8"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
          />
        </Svg>
      );
    case '研究':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M9 3h6M10 3v6l-5 8a2 2 0 001.7 3h10.6a2 2 0 001.7-3l-5-8V3"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    case 'セキュリティ':
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path
            d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
            stroke={color}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      );
    default:
      return (
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Circle cx={12} cy={12} r={7} stroke={color} strokeWidth={2} />
        </Svg>
      );
  }
}

/**
 * サイトの公式faviconを無加工で表示し、取得失敗時のみ頭文字バッジにフォールバックするアイコン部品
 */
export function SiteFaviconBadge({
  siteUrl,
  fallbackInitial,
  fallbackBg,
  fallbackFg,
  sizePx = 22,
}: {
  siteUrl: string | undefined;
  fallbackInitial: string;
  fallbackBg: string;
  fallbackFg: string;
  sizePx?: number;
}) {
  const [failed, setFailed] = useState(false);
  const faviconUrl = siteUrl ? getFaviconUrl(siteUrl) : null;

  if (faviconUrl && !failed) {
    return (
      <View
        style={[
          styles.faviconWrap,
          {
            width: sizePx,
            height: sizePx,
            borderRadius: sizePx / 2,
          },
        ]}
      >
        <Image
          source={{ uri: faviconUrl }}
          style={{
            width: Math.round(sizePx * 0.76),
            height: Math.round(sizePx * 0.76),
            borderRadius: 3,
          }}
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.toolMiniBadge,
        {
          width: sizePx,
          height: sizePx,
          borderRadius: sizePx / 2,
          backgroundColor: fallbackBg,
        },
      ]}
    >
      <Text
        style={[
          styles.toolMiniBadgeText,
          { color: fallbackFg, fontSize: Math.max(10, Math.round(sizePx * 0.48)) },
        ]}
      >
        {fallbackInitial}
      </Text>
    </View>
  );
}

type SettingsViewProps = {
  sources: Source[];
  prefs: UserPrefs;
  hiddenCount: number;
  matchingCount?: number;
  initialSubScreen?: 'root' | 'manage_sources' | 'manage_tools';
  onUpdatePrefs: (
    next: UserPrefs | ((prev: UserPrefs) => UserPrefs)
  ) => void;
  onResetHidden: () => void;
  onStartSwiping: () => void;
};

export function SettingsView({
  sources,
  prefs,
  hiddenCount,
  matchingCount,
  initialSubScreen = 'root',
  onUpdatePrefs,
  onResetHidden,
  onStartSwiping,
}: SettingsViewProps) {
  const locale = prefs.region_locale;
  const t = getCopy(locale);
  const [subScreen, setSubScreen] = useState<'root' | 'manage'>(
    initialSubScreen === 'root' ? 'root' : 'manage'
  );

  const toggleSource = (sourceId: string) => {
    onUpdatePrefs((prev) => {
      const exists = prev.enabled_source_ids.includes(sourceId);
      const nextIds = exists
        ? prev.enabled_source_ids.filter((id) => id !== sourceId)
        : [...prev.enabled_source_ids, sourceId];
      return {
        ...prev,
        enabled_source_ids: nextIds,
        updated_at: new Date().toISOString(),
      };
    });
  };

  const toggleCategorySources = (categorySources: Source[], enableAll: boolean) => {
    const catIds = categorySources.map((s) => s.id);
    onUpdatePrefs((prev) => {
      const nextIds = enableAll
        ? Array.from(new Set([...prev.enabled_source_ids, ...catIds]))
        : prev.enabled_source_ids.filter((id) => !catIds.includes(id));
      return {
        ...prev,
        enabled_source_ids: nextIds,
        updated_at: new Date().toISOString(),
      };
    });
  };

  const toggleAllSources = (enableAll: boolean) => {
    onUpdatePrefs((prev) => ({
      ...prev,
      enabled_source_ids: enableAll ? sources.map((s) => s.id) : [],
      updated_at: new Date().toISOString(),
    }));
  };

  const toggleGenre = (genre: string) => {
    onUpdatePrefs((prev) => {
      const exists = prev.genres.includes(genre);
      const nextGenres = exists
        ? prev.genres.filter((g) => g !== genre)
        : [...prev.genres, genre];
      return {
        ...prev,
        genres: nextGenres,
        updated_at: new Date().toISOString(),
      };
    });
  };

  const clearGenres = () => {
    onUpdatePrefs((prev) => ({
      ...prev,
      genres: [],
      updated_at: new Date().toISOString(),
    }));
  };

  const toggleTool = (tool: string) => {
    onUpdatePrefs((prev) => {
      const exists = prev.tools.includes(tool);
      const nextTools = exists
        ? prev.tools.filter((t) => t !== tool)
        : [...prev.tools, tool];
      return {
        ...prev,
        tools: nextTools,
        updated_at: new Date().toISOString(),
      };
    });
  };

  const clearTools = () => {
    onUpdatePrefs((prev) => ({
      ...prev,
      tools: [],
      updated_at: new Date().toISOString(),
    }));
  };

  const setSourceLanguage = (lang: SourceLanguageFilter) => {
    onUpdatePrefs((prev) => ({
      ...prev,
      source_language: lang,
      updated_at: new Date().toISOString(),
    }));
  };

  const setRegionLocale = (locale: AppLocale) => {
    // ja / en のみ（旧 ko/es 設定は呼び出し側で正規化済み）
    onUpdatePrefs((prev) => ({
      ...prev,
      region_locale: locale,
      updated_at: new Date().toISOString(),
    }));
  };

  const toggleShowOriginalButton = () => {
    onUpdatePrefs((prev) => ({
      ...prev,
      show_original_button: !prev.show_original_button,
      updated_at: new Date().toISOString(),
    }));
  };

  const toggleShowSponsored = () => {
    onUpdatePrefs((prev) => ({
      ...prev,
      show_sponsored: !prev.show_sponsored,
      updated_at: new Date().toISOString(),
    }));
  };

  // 設定 > 1枚に統合された「ジャンル × ツール × 情報源（ソース）」絞り込み画面
  if (subScreen === 'manage') {
    const categories = Array.from(
      new Set(sources.map((s) => s.category || 'その他'))
    );

    const listJoin = locale === 'en' ? ', ' : '・';
    const previewSourcesText =
      prefs.enabled_source_ids.length === sources.length
        ? t.manage.allSources(sources.length)
        : t.manage.selectedSources(prefs.enabled_source_ids.length);
    const previewToolsText =
      prefs.tools.length > 0
        ? prefs.tools.join(listJoin)
        : t.manage.allToolsShort;
    const previewGenresText =
      prefs.genres.length > 0
        ? prefs.genres.map((g) => getGenreLabel(g, locale)).join(listJoin)
        : t.manage.allGenresShort;

    const countSuffix =
      typeof matchingCount === 'number'
        ? t.manage.matchCountSuffix(matchingCount)
        : '';

    const previewSummary =
      prefs.tools.length === 0 &&
      prefs.genres.length === 0 &&
      prefs.enabled_source_ids.length === sources.length
        ? `${t.manage.previewAll}${countSuffix}`
        : `${previewSourcesText} × ${previewToolsText} × ${previewGenresText}${countSuffix}`;

    const allSourcesEnabled = prefs.enabled_source_ids.length === sources.length;

    return (
      <View style={styles.container}>
        {/* 上部バー（‹ 設定に戻る + 現在の掛け算プレビュー） */}
        <View style={styles.manageTopHeader}>
          <View style={styles.manageNavRow}>
            <Pressable
              style={styles.backButton}
              onPress={() => setSubScreen('root')}
              accessibilityRole="button"
              accessibilityLabel={t.manage.backToSettingsAria}
            >
              <Text style={styles.backButtonText}>{t.manage.backToSettings}</Text>
            </Pressable>

            <Pressable
              style={styles.headerApplyPill}
              onPress={onStartSwiping}
              accessibilityRole="button"
              accessibilityLabel={t.manage.applyAndStart}
            >
              <Text style={styles.headerApplyPillText}>
                {t.manage.applyAndStart}
              </Text>
            </Pressable>
          </View>

          {/* 固定表示される掛け算プレビューボックス */}
          <View style={styles.previewBox}>
            <View style={styles.previewHeaderRow}>
              <View style={styles.previewLiveDot} />
              <Text style={styles.previewHeading}>{t.manage.previewHeading}</Text>
            </View>
            <Text style={styles.previewBody} numberOfLines={2}>
              {previewSummary}
            </Text>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.manageContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.pageTitle}>{t.manage.unifiedTitle}</Text>
          <Text style={styles.pageDescription}>{t.manage.unifiedDesc}</Text>

          {/* ① ジャンル選択セクション（分野アイコン付き） */}
          <View style={styles.filterSectionCard}>
            <View style={styles.filterSectionHeader}>
              <View style={styles.filterSectionTitleCol}>
                <Text style={styles.filterSectionTitle}>
                  {t.manage.genresHeading}
                </Text>
                <Text style={styles.filterSectionSub}>
                  {t.manage.genresSub}
                </Text>
              </View>
              {prefs.genres.length > 0 ? (
                <Pressable
                  style={styles.batchToggleBtn}
                  onPress={clearGenres}
                  accessibilityRole="button"
                >
                  <Text style={styles.batchToggleBtnText}>
                    {t.manage.clearAll}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.chipWrap}>
              {allGenres.map((genre) => {
                const genreLabel = getGenreLabel(genre, locale);
                const selected = prefs.genres.includes(genre);
                const iconColor = selected
                  ? themes.neutral.background
                  : themes.neutral.accent;
                return (
                  <Pressable
                    key={genre}
                    style={[
                      styles.filterChip,
                      selected
                        ? styles.filterChipSelected
                        : styles.filterChipUnselected,
                    ]}
                    onPress={() => toggleGenre(genre)}
                    accessibilityRole="button"
                    accessibilityLabel={genreLabel}
                    accessibilityState={{ selected }}
                  >
                    <GenreIcon genre={genre} color={iconColor} />
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextSelected,
                      ]}
                    >
                      {selected ? `${genreLabel} ✓` : genreLabel}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ② AIツール選択セクション（各公式サイトのfaviconアイコン付き） */}
          <View style={styles.filterSectionCard}>
            <View style={styles.filterSectionHeader}>
              <View style={styles.filterSectionTitleCol}>
                <Text style={styles.filterSectionTitle}>
                  {t.manage.toolsHeading}
                </Text>
                <Text style={styles.filterSectionSub}>
                  {t.manage.toolsSub}
                </Text>
              </View>
              {prefs.tools.length > 0 ? (
                <Pressable
                  style={styles.batchToggleBtn}
                  onPress={clearTools}
                  accessibilityRole="button"
                >
                  <Text style={styles.batchToggleBtnText}>
                    {t.manage.clearAll}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.chipWrap}>
              {allTools.map((tool) => {
                const selected = prefs.tools.includes(tool);
                const badge = toolBadgeColors[tool] ?? {
                  bg: themes.neutral.accent,
                  fg: themes.neutral.background,
                  initial: tool.slice(0, 1),
                };
                return (
                  <Pressable
                    key={tool}
                    style={[
                      styles.filterChip,
                      selected
                        ? styles.filterChipSelected
                        : styles.filterChipUnselected,
                    ]}
                    onPress={() => toggleTool(tool)}
                    accessibilityRole="button"
                    accessibilityLabel={tool}
                    accessibilityState={{ selected }}
                  >
                    <SiteFaviconBadge
                      siteUrl={toolSiteUrls[tool]}
                      fallbackInitial={badge.initial}
                      fallbackBg={badge.bg}
                      fallbackFg={badge.fg}
                      sizePx={22}
                    />
                    <Text
                      style={[
                        styles.filterChipText,
                        selected && styles.filterChipTextSelected,
                      ]}
                    >
                      {selected ? `${tool} ✓` : tool}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* ③ 情報源（ソース）選択セクション（各メディアのfaviconアイコン付き） */}
          <View style={styles.filterSectionCard}>
            <View style={styles.filterSectionHeader}>
              <View style={styles.filterSectionTitleCol}>
                <Text style={styles.filterSectionTitle}>
                  {t.manage.sourcesHeading}
                </Text>
                <Text style={styles.filterSectionSub}>
                  {`${t.manage.sourcesSub}${t.manage.sourcesOnSuffix(
                    prefs.enabled_source_ids.length,
                    sources.length
                  )}`}
                </Text>
              </View>
              <Pressable
                style={styles.batchToggleBtn}
                onPress={() => toggleAllSources(!allSourcesEnabled)}
                accessibilityRole="button"
              >
                <Text style={styles.batchToggleBtnText}>
                  {allSourcesEnabled ? t.manage.clearAll : t.manage.selectAll}
                </Text>
              </Pressable>
            </View>

            {categories.map((category) => {
              const catSources = sources.filter(
                (s) => (s.category || 'その他') === category
              );
              const enabledInCat = catSources.filter((s) =>
                prefs.enabled_source_ids.includes(s.id)
              ).length;
              const allCatEnabled = enabledInCat === catSources.length;
              const categoryLabel = getSourceCategoryLabel(category, locale);

              return (
                <View key={category} style={styles.categoryGroupBox}>
                  <View style={styles.categoryHeaderRow}>
                    <View style={styles.categoryTitleCol}>
                      <Text style={styles.sectionLabel}>{categoryLabel}</Text>
                      <Text style={styles.categoryCountText}>
                        {t.manage.categoryOnSuffix(
                          enabledInCat,
                          catSources.length
                        )}
                      </Text>
                    </View>
                    <Pressable
                      style={styles.batchToggleBtn}
                      onPress={() =>
                        toggleCategorySources(catSources, !allCatEnabled)
                      }
                      accessibilityRole="button"
                    >
                      <Text style={styles.batchToggleBtnText}>
                        {allCatEnabled ? t.manage.clearAll : t.manage.selectAll}
                      </Text>
                    </Pressable>
                  </View>

                  {catSources.map((src) => {
                    const enabled = prefs.enabled_source_ids.includes(src.id);
                    const initial = src.name.slice(0, 2).toUpperCase();
                    return (
                      <Pressable
                        key={src.id}
                        style={styles.sourceRow}
                        onPress={() => toggleSource(src.id)}
                        accessibilityRole="switch"
                        accessibilityLabel={src.name}
                        accessibilityState={{ checked: enabled }}
                      >
                        <SiteFaviconBadge
                          siteUrl={src.site_url}
                          fallbackInitial={initial}
                          fallbackBg={uiColors.avatarSurface}
                          fallbackFg={text.primary}
                          sizePx={size.manageIcon}
                        />
                        <View style={styles.sourceInfo}>
                          <Text style={styles.sourceRowName}>{src.name}</Text>
                          <Text style={styles.sourceRowKind}>
                            {src.kind || src.site_url}
                          </Text>
                        </View>
                        <View style={styles.switchHitArea}>
                          <View
                            style={[
                              styles.switchTrack,
                              {
                                backgroundColor: enabled
                                  ? themes.neutral.accent
                                  : themes.neutral.line,
                              },
                            ]}
                          >
                            <View
                              style={[
                                styles.switchThumb,
                                enabled ? styles.switchThumbOn : styles.switchThumbOff,
                              ]}
                            />
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
          </View>

          <Pressable
            style={styles.applyButton}
            onPress={onStartSwiping}
            accessibilityRole="button"
            accessibilityLabel={t.manage.applyAndStart}
          >
            <Text style={styles.applyButtonText}>{t.manage.applyAndStart}</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // 設定トップ画面
  const listJoin = locale === 'en' ? ', ' : '・';
  const activeToolsSummary =
    prefs.tools.length > 0
      ? `${t.settings.toolsPrefix}: ${prefs.tools
          .slice(0, 4)
          .join(listJoin)}${
          prefs.tools.length > 4
            ? t.settings.andMore(prefs.tools.length - 4)
            : ''
        }`
      : t.settings.allToolsActive;

  const activeGenresSummary =
    prefs.genres.length > 0
      ? `${t.settings.genresPrefix}: ${prefs.genres
          .map((g) => getGenreLabel(g, locale))
          .join(listJoin)}`
      : t.settings.allGenresActive;

  const activeSourcesSummary = `${t.settings.sourcesPrefix}: ${t.settings.mediaOnSuffix(
    prefs.enabled_source_ids.length,
    sources.length
  )}`;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.rootContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageSubtitle}>{t.settings.subtitle}</Text>
      <Text style={styles.pageTitle}>{t.settings.title}</Text>

      {/* 目立つフィード絞り込み・カスタマイズ大型パネル（1画面統合） */}
      <View style={styles.filterHeroCard}>
        <View style={styles.filterHeroBadgeRow}>
          <View style={styles.filterHeroBadge}>
            <Text style={styles.filterHeroBadgeText}>
              {t.settings.filterHeroBadge}
            </Text>
          </View>
        </View>

        <Text style={styles.filterHeroTitle}>{t.settings.filterHeroTitle}</Text>
        <Text style={styles.filterHeroDesc}>{t.settings.filterHeroDesc}</Text>

        {/* 現在の掛け算ステータス一覧バッジ */}
        <View style={styles.activeStatusBox}>
          <Text style={styles.activeStatusHeading}>
            {t.settings.activeFilterHeading}
            {typeof matchingCount === 'number'
              ? t.settings.matchingNewsSuffix(matchingCount)
              : ''}
          </Text>
          <View style={styles.activeStatusPillsRow}>
            <View
              style={[
                styles.statusPill,
                prefs.tools.length > 0 && styles.statusPillHighlighted,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  prefs.tools.length > 0 && styles.statusPillTextHighlighted,
                ]}
              >
                {activeToolsSummary}
              </Text>
            </View>
            <Text style={styles.multiplySign}>×</Text>
            <View
              style={[
                styles.statusPill,
                prefs.genres.length > 0 && styles.statusPillHighlighted,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  prefs.genres.length > 0 && styles.statusPillTextHighlighted,
                ]}
              >
                {activeGenresSummary}
              </Text>
            </View>
            <Text style={styles.multiplySign}>×</Text>
            <View
              style={[
                styles.statusPill,
                prefs.enabled_source_ids.length < sources.length &&
                  styles.statusPillHighlighted,
              ]}
            >
              <Text
                style={[
                  styles.statusPillText,
                  prefs.enabled_source_ids.length < sources.length &&
                    styles.statusPillTextHighlighted,
                ]}
              >
                {activeSourcesSummary}
              </Text>
            </View>
          </View>
        </View>

        {/* 1つに統合された大きなアクションボタン */}
        <Pressable
          style={styles.heroActionCardPrimary}
          onPress={() => setSubScreen('manage')}
          accessibilityRole="button"
          accessibilityLabel={t.settings.unifiedActionTitle}
        >
          <View style={styles.heroActionIconBoxPrimary}>
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 6h16M7 12h10M10 18h4"
                stroke={themes.neutral.background}
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </View>
          <View style={styles.heroActionTextCol}>
            <Text style={styles.heroActionTitlePrimary}>
              {t.settings.unifiedActionTitle}
            </Text>
            <Text style={styles.heroActionSubPrimary}>
              {t.settings.unifiedActionSub}
            </Text>
          </View>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 5l7 7-7 7"
              stroke={themes.neutral.accent}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {/* 地域・翻訳言語 */}
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
        {t.settings.regionLocaleLabel}
      </Text>
      <View style={styles.chipWrap}>
        {regionLocales.map((loc) => {
          const selected = (prefs.region_locale || 'ja') === loc.code;
          return (
            <Pressable
              key={loc.code}
              style={[
                styles.filterChip,
                selected
                  ? styles.filterChipSelected
                  : styles.filterChipUnselected,
              ]}
              onPress={() => setRegionLocale(loc.code)}
              accessibilityRole="button"
              accessibilityLabel={loc.label}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextSelected,
                ]}
              >
                {selected ? `✓ ${loc.label}` : loc.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* ソースの言語 */}
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
        {t.settings.sourceLanguageLabel}
      </Text>
      <View style={styles.chipWrap}>
        {(
          [
            { key: 'ja', label: t.settings.langJaOnly },
            { key: 'en', label: t.settings.langEnOnly },
            { key: 'both', label: t.settings.langBoth },
          ] as const
        ).map((opt) => {
          const selected = prefs.source_language === opt.key;
          return (
            <Pressable
              key={opt.key}
              style={[
                styles.filterChip,
                selected ? styles.filterChipSelected : styles.filterChipUnselected,
              ]}
              onPress={() => setSourceLanguage(opt.key)}
              accessibilityRole="button"
              accessibilityLabel={opt.label}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selected && styles.filterChipTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 表示オプション */}
      <Text style={[styles.sectionLabel, styles.sectionSpacing]}>
        {t.settings.displaySectionLabel}
      </Text>
      <View style={styles.settingRow}>
        <Text style={styles.settingRowLabel}>
          {t.settings.showOriginalButtonLabel}
        </Text>
        <Pressable
          style={styles.switchHitArea}
          onPress={toggleShowOriginalButton}
          accessibilityRole="switch"
          accessibilityLabel={t.settings.showOriginalButtonLabel}
          accessibilityState={{ checked: prefs.show_original_button }}
        >
          <View
            style={[
              styles.switchTrack,
              {
                backgroundColor: prefs.show_original_button
                  ? themes.neutral.accent
                  : themes.neutral.line,
              },
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                prefs.show_original_button
                  ? styles.switchThumbOn
                  : styles.switchThumbOff,
              ]}
            />
          </View>
        </Pressable>
      </View>

      <View style={styles.settingRow}>
        <Text style={styles.settingRowLabel}>
          {t.settings.showSponsoredLabel}
        </Text>
        <Pressable
          style={styles.switchHitArea}
          onPress={toggleShowSponsored}
          accessibilityRole="switch"
          accessibilityLabel={t.settings.showSponsoredLabel}
          accessibilityState={{ checked: prefs.show_sponsored }}
        >
          <View
            style={[
              styles.switchTrack,
              {
                backgroundColor: prefs.show_sponsored
                  ? themes.neutral.accent
                  : themes.neutral.line,
              },
            ]}
          >
            <View
              style={[
                styles.switchThumb,
                prefs.show_sponsored
                  ? styles.switchThumbOn
                  : styles.switchThumbOff,
              ]}
            />
          </View>
        </Pressable>
      </View>

      {hiddenCount > 0 ? (
        <View style={styles.settingRow}>
          <Text style={styles.settingRowLabel}>
            {`${t.settings.hiddenResetLabel}${t.settings.hiddenCountSuffix(
              hiddenCount
            )}`}
          </Text>
          <Pressable
            style={styles.resetButton}
            onPress={onResetHidden}
            accessibilityRole="button"
            accessibilityLabel={t.settings.hiddenResetButton}
          >
            <Text style={styles.resetButtonText}>
              {t.settings.hiddenResetButton}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.privacyBox}>
        <Text style={styles.privacyText}>{t.settings.privacyNote}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: themes.neutral.background,
  },
  scroll: {
    flex: 1,
  },
  rootContent: {
    paddingTop: 64,
    paddingHorizontal: size.pageSide,
    paddingBottom: 40,
  },
  pageSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: themes.neutral.accent,
    marginBottom: 4,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: text.primary,
  },
  pageDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 21,
    color: text.muted,
  },
  filterHeroCard: {
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: uiColors.cardSurface,
    borderWidth: 1.5,
    borderColor: themes.neutral.accent,
    gap: 12,
  },
  filterHeroBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterHeroBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(182, 242, 74, 0.16)',
    borderWidth: 1,
    borderColor: themes.neutral.accent,
  },
  filterHeroBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: themes.neutral.accent,
  },
  filterHeroTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: text.primary,
    lineHeight: 26,
  },
  filterHeroDesc: {
    fontSize: 13,
    lineHeight: 20,
    color: text.muted,
  },
  activeStatusBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: themes.neutral.background,
    borderWidth: 1,
    borderColor: themes.neutral.line,
    gap: 8,
  },
  activeStatusHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: themes.neutral.accent,
  },
  activeStatusPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  multiplySign: {
    fontSize: 13,
    fontWeight: '900',
    color: text.muted,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: themes.neutral.panel,
    borderWidth: 1,
    borderColor: themes.neutral.line,
  },
  statusPillHighlighted: {
    backgroundColor: 'rgba(182, 242, 74, 0.14)',
    borderColor: themes.neutral.accent,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: text.primary,
  },
  statusPillTextHighlighted: {
    color: themes.neutral.accent,
  },
  heroActionCardPrimary: {
    marginTop: 4,
    minHeight: 72,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(182, 242, 74, 0.12)',
    borderWidth: 1.5,
    borderColor: themes.neutral.accent,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  heroActionIconBoxPrimary: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: themes.neutral.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroActionTextCol: {
    flex: 1,
    gap: 3,
  },
  heroActionTitlePrimary: {
    fontSize: 16,
    fontWeight: '900',
    color: text.primary,
  },
  heroActionSubPrimary: {
    fontSize: 12,
    color: text.body,
    lineHeight: 17,
  },
  manageTopHeader: {
    paddingTop: 52,
    paddingHorizontal: size.pageSide,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: themes.neutral.panel,
    gap: 10,
  },
  manageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    minHeight: 40,
    paddingVertical: 6,
    paddingRight: 12,
    justifyContent: 'center',
  },
  backButtonText: {
    color: themes.neutral.accent,
    fontSize: 15,
    fontWeight: '800',
  },
  headerApplyPill: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: themes.neutral.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerApplyPillText: {
    color: themes.neutral.background,
    fontSize: 13,
    fontWeight: '900',
  },
  manageContent: {
    paddingHorizontal: size.pageSide,
    paddingTop: 14,
    paddingBottom: 48,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: themes.neutral.accent,
  },
  sectionSpacing: {
    marginTop: 24,
    marginBottom: 10,
  },
  filterSectionCard: {
    marginTop: 18,
    padding: 16,
    borderRadius: 18,
    backgroundColor: uiColors.cardSurface,
    borderWidth: 1,
    borderColor: uiColors.cardBorder,
    gap: 14,
  },
  filterSectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  filterSectionTitleCol: {
    flex: 1,
    gap: 3,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: text.primary,
  },
  filterSectionSub: {
    fontSize: 12,
    color: text.muted,
  },
  batchToggleBtn: {
    minHeight: 34,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: themes.neutral.panel,
    borderWidth: 1,
    borderColor: themes.neutral.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  batchToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: themes.neutral.accent,
  },
  categoryGroupBox: {
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: themes.neutral.line,
  },
  categoryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  categoryTitleCol: {
    flex: 1,
    gap: 2,
  },
  categoryCountText: {
    fontSize: 12,
    color: text.muted,
  },
  sourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: themes.neutral.panel,
  },
  faviconWrap: {
    backgroundColor: uiColors.avatarSurface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: themes.neutral.line,
  },
  sourceInfo: {
    flex: 1,
  },
  sourceRowName: {
    color: text.primary,
    fontSize: 15,
    fontWeight: '700',
  },
  sourceRowKind: {
    color: text.muted,
    fontSize: 12,
    marginTop: 2,
  },
  switchHitArea: {
    width: 56,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    position: 'relative',
  },
  switchThumb: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  switchThumbOn: {
    right: 3,
    backgroundColor: themes.neutral.background,
  },
  switchThumbOff: {
    left: 3,
    backgroundColor: text.muted,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: size.chipHeight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  filterChipSelected: {
    backgroundColor: themes.neutral.accent,
    borderColor: themes.neutral.accent,
  },
  filterChipUnselected: {
    backgroundColor: themes.neutral.panel,
    borderColor: uiColors.chipBorder,
  },
  filterChipText: {
    color: text.primary,
    fontSize: 14,
    fontWeight: '700',
  },
  filterChipTextSelected: {
    color: themes.neutral.background,
    fontWeight: '900',
  },
  toolMiniBadge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolMiniBadgeText: {
    fontWeight: '900',
  },
  previewBox: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(182, 242, 74, 0.1)',
    borderWidth: 1.5,
    borderColor: themes.neutral.accent,
  },
  previewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  previewLiveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: themes.neutral.accent,
  },
  previewHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: themes.neutral.accent,
  },
  previewBody: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 19,
    color: text.primary,
  },
  applyButton: {
    marginTop: 22,
    minHeight: 54,
    borderRadius: 14,
    backgroundColor: themes.neutral.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: themes.neutral.background,
    fontSize: 16,
    fontWeight: '900',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: themes.neutral.panel,
  },
  settingRowLabel: {
    flex: 1,
    color: text.primary,
    fontSize: 15,
  },
  resetButton: {
    minHeight: size.minTap,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: themes.neutral.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    color: text.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  privacyBox: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: uiColors.cardSurface,
    borderWidth: 1,
    borderColor: uiColors.cardBorder,
  },
  privacyText: {
    color: text.muted,
    fontSize: 12,
    lineHeight: 18,
  },
});
