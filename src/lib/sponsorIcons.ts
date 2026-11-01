import type { ImageSourcePropType } from 'react-native';
import type { SponsoredItem } from './types';

/**
 * 広告主／tool_tag → 公式シンボル（未加工）。
 * ホーム／探索の製品レール・スポンサードカードで共通利用する。
 * 新規広告主を足したらここに1行足す（記事右レールにも自動で出る）。
 */
const SPONSOR_LOCAL_ICONS: Record<string, ImageSourcePropType> = {
  ElevenLabs: require('../../assets/sponsors/elevenlabs-symbol.png'),
  Synthesia: require('../../assets/sponsors/synthesia-symbol.png'),
  Arcads: require('../../assets/sponsors/arcads-symbol.png'),
  Firecrawl: require('../../assets/sponsors/firecrawl-symbol.png'),
  Transkriptor: require('../../assets/sponsors/transkriptor-symbol.png'),
  'Context.dev': require('../../assets/sponsors/context-symbol.png'),
};

/** tool_tag または advertiser_name からローカル製品アイコンを返す */
export function getSponsorLocalIcon(
  toolTagOrName: string | null | undefined
): ImageSourcePropType | null {
  if (!toolTagOrName) return null;
  return SPONSOR_LOCAL_ICONS[toolTagOrName] ?? null;
}

/** ソースチップ用: 公式シンボルがある広告主ソースのみ */
const SOURCE_ID_LOCAL_ICON_TOOL: Record<string, string> = {
  'source-elevenlabs': 'ElevenLabs',
  'source-synthesia': 'Synthesia',
  'source-arcads': 'Arcads',
  'source-firecrawl': 'Firecrawl',
  'source-context-dev': 'Context.dev',
};

export function getSponsorLocalIconForSourceId(
  sourceId: string | null | undefined
): ImageSourcePropType | null {
  if (!sourceId) return null;
  const tool = SOURCE_ID_LOCAL_ICON_TOOL[sourceId];
  return tool ? getSponsorLocalIcon(tool) : null;
}

/** スポンサード案件から製品レール／カード用アイコンを解決する */
export function resolveSponsoredLocalIcon(
  item: Pick<SponsoredItem, 'tool_tag' | 'advertiser_name'>
): ImageSourcePropType | null {
  return (
    getSponsorLocalIcon(item.tool_tag) ??
    getSponsorLocalIcon(item.advertiser_name)
  );
}
