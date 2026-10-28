import AsyncStorage from '@react-native-async-storage/async-storage';
import { limits } from './config';
import type { Article, UserPrefs } from './types';

const KEYS = {
  SAVED_IDS: '@ai_news/saved_article_ids',
  SAVED_ARTICLES: '@ai_news/saved_articles_data',
  HIDDEN_IDS: '@ai_news/hidden_article_ids',
  /** 「完全に消す」後の非表示ID（戻す対象外） */
  PURGED_IDS: '@ai_news/purged_article_ids',
  USER_PREFS: '@ai_news/user_prefs',
} as const;

export async function getSavedArticleIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SAVED_IDS);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return parsed.slice(-limits.maxSavedArticles);
  } catch {
    return [];
  }
}

export async function setSavedArticleIds(ids: string[]): Promise<void> {
  const trimmed = ids.slice(-limits.maxSavedArticles);
  await AsyncStorage.setItem(KEYS.SAVED_IDS, JSON.stringify(trimmed));
}

export async function getSavedArticlesData(): Promise<Article[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.SAVED_ARTICLES);
    const parsed = raw ? (JSON.parse(raw) as Article[]) : [];
    return parsed.slice(-limits.maxSavedArticles);
  } catch {
    return [];
  }
}

export async function setSavedArticlesData(articles: Article[]): Promise<void> {
  const trimmed = articles.slice(-limits.maxSavedArticles);
  await AsyncStorage.setItem(KEYS.SAVED_ARTICLES, JSON.stringify(trimmed));
}

export async function getHiddenArticleIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.HIDDEN_IDS);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return parsed.slice(-limits.maxHiddenIds);
  } catch {
    return [];
  }
}

export async function setHiddenArticleIds(ids: string[]): Promise<void> {
  const trimmed = ids.slice(-limits.maxHiddenIds);
  await AsyncStorage.setItem(KEYS.HIDDEN_IDS, JSON.stringify(trimmed));
}

export async function getPurgedArticleIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.PURGED_IDS);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    return parsed.slice(-limits.maxHiddenIds);
  } catch {
    return [];
  }
}

export async function setPurgedArticleIds(ids: string[]): Promise<void> {
  const trimmed = ids.slice(-limits.maxHiddenIds);
  await AsyncStorage.setItem(KEYS.PURGED_IDS, JSON.stringify(trimmed));
}

export async function getUserPrefs(): Promise<UserPrefs | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS.USER_PREFS);
    return raw ? (JSON.parse(raw) as UserPrefs) : null;
  } catch {
    return null;
  }
}

export async function setUserPrefs(prefs: UserPrefs): Promise<void> {
  await AsyncStorage.setItem(KEYS.USER_PREFS, JSON.stringify(prefs));
}
