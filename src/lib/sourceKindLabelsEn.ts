/** sources.json の kind（日本語）→ 英語UI表示 */
export const sourceKindLabelsEn: Record<string, string> = {
  '公式ブログ・新モデル発表': 'Official blog & model launches',
  'API・開発者向けリリースノート・料金改定':
    'API / developer release notes & pricing',
  'Claude公式アナウンス・研究発表': 'Claude official announcements & research',
  'Claude / Claude Code・MCP 機能更新ログ':
    'Claude / Claude Code & MCP changelog',
  'Gemini・Google AI Studio 公式発表':
    'Gemini & Google AI Studio announcements',
  'Grok 新モデル・APIアナウンス': 'Grok model & API announcements',
  'Perplexity 新機能・Sonar API更新': 'Perplexity features & Sonar API updates',
  'Mistral 新モデル・軽量モデル発表':
    'Mistral model & lightweight model launches',
  'Llama・オープンモデル研究発表': 'Llama & open-model research',
  'アプリ内課金・ペイウォールABテスト・LTV改善の必須知識':
    'IAP, paywall A/B tests & LTV essentials',
  '売れているアプリの課金画面・オンボーディング実例集':
    'Top apps’ paywalls & onboarding examples',
  'App Store / Google Play 検索最適化（ASO）・キーワード戦略':
    'App Store / Play ASO & keyword strategy',
  '個人開発者の初期ユーザー獲得・TikTok/Reddit集客・年商事例':
    'Indie user growth, TikTok/Reddit & revenue cases',
  '広告費ゼロで刺さるLPコピー・SNSバズ事例の図解メディア':
    'Zero-ad LP copy & viral social case studies',
  '開発者向けのプロダクト分析・ファネル改善・離脱防止ノウハウ':
    'Product analytics, funnels & retention for builders',
  'グローバル決済・サブスク解約防止・AIエージェント決済':
    'Global payments, churn prevention & AI agent billing',
  '個人開発のオンボーディングメール・休眠復帰メール自動化':
    'Indie onboarding & win-back email automation',
  '高CVRなアプリ紹介LP・ウェイトリストを即日で公開する手法':
    'High-CVR app LPs & waitlists shipping same-day',
  'AI動画アバター・多言語吹き替え・ショート動画生成 HeyGen公式':
    'HeyGen official: AI avatars, dubbing & short video',
  'TikTok / Reels / Shorts 向けのAI字幕・ショート動画編集 CapCut公式':
    'CapCut official: AI captions & short-form editing',
  'AIコードエディタ Cursor 新機能・更新': 'Cursor AI editor updates',
  'エージェント型IDE Windsurf / Cascade 更新':
    'Windsurf / Cascade agentic IDE updates',
  'ブラウザ完結フルスタックAI生成 Bolt.new 更新':
    'Bolt.new in-browser full-stack AI updates',
  '個人開発で人気のAIアプリビルダー Lovable 新機能':
    'Lovable AI app builder features',
  '自律型AIエンジニア Devin アップデート・料金':
    'Devin autonomous engineer updates & pricing',
  'GitHub Copilot 機能追加・モデル対応':
    'GitHub Copilot features & model support',
  'v0・AI SDK・Next.js 個人開発インフラ更新':
    'v0, AI SDK & Next.js indie infra updates',
  'BaaS・pgvector・MCP連携リリース': 'BaaS, pgvector & MCP releases',
  '格安エッジAI・Workers・R2・D1 新機能':
    'Affordable edge AI, Workers, R2 & D1 features',
  'OSSのAIワークフロー・エージェント構築 Dify':
    'Dify open-source AI workflows & agents',
  'セルフホスト可能なAI自動化・マーケ自動化連携':
    'Self-hosted AI automation & marketing ops',
  'Mac/PCで動かすローカルLLM・APIコストゼロ運用':
    'Local LLMs on Mac/PC with zero API cost',
  '全LLM統合API・無料モデル枠・最安レート比較':
    'Unified LLM APIs, free tiers & rate comparisons',
  'エージェント構築フレームワーク最新情報':
    'Latest agent framework news',
  '毎日ローンチされる世界の個人開発AIプロダクト':
    'Daily indie AI product launches worldwide',
  'AI個人開発者の収益公開（MRR）・集客・技術スタック事例':
    'Indie AI revenue (MRR), growth & stack case studies',
  '個人開発者が今こぞってStarを付けている急上昇OSS':
    'Trending OSS indie developers are starring',
  '世界最大級のAIツール検索・ニッチ需要の発掘':
    'Large-scale AI tool search & niche demand discovery',
  'AIビルダー・個人開発者向けの日刊トレンドニュースレター':
    'Daily trends newsletter for AI builders',
  'LLM個人開発・プロンプト・ローカルAIの実践検証ブログ':
    'Hands-on LLM indie, prompts & local AI blog',
  '動画生成AI Genシリーズ公式発表': 'Official Gen video-AI announcements',
  '音声生成・吹き替え・会話AIアナウンス':
    'Speech, dubbing & conversational AI announcements',
  '画像生成AI 新バージョン・Web機能発表':
    'Image-gen model & web feature launches',
  'Notion AI・ワークスペース新機能': 'Notion AI & workspace features',
  '国内の個人開発×AIアプリ事例・コスト公開・技術選定':
    'JP indie × AI app cases, costs & stack choices',
  '国内エンジニアのAIツール実践・検証記事':
    'JP engineers’ AI tool field notes',
  '日本語のAI実装ノウハウ・ツール紹介':
    'Japanese AI implementation tips & tool guides',
  '個人開発者のアプリ収益報告・プロンプト・マーケ知見':
    'Indie app revenue reports, prompts & marketing',
  '国内外のAIビジネス・企業導入ニュース':
    'AI business & enterprise adoption news',
  'オープンモデル・注目論文・ツール解説':
    'Open models, papers & tool explainers',
  'Show HNで発表された個人開発AIツール・技術議論':
    'Show HN indie AI tools & technical discussion',
  'AI・自然言語処理の最新研究論文': 'Latest AI / NLP research papers',
  '海外AIトレンド・発表まとめ': 'Global AI trends & announcement digests',
  '毎日のAI重要トピック解説ポッドキャスト':
    'Daily AI topics podcast',
  '新モデル公開スケジュール・ベンチマーク集計':
    'Model release calendars & benchmark trackers',
};
