# AIニュース スワイプアプリ（仮）

AI関連のニュースだけを、1枚ずつ縦スワイプで読めるモバイルアプリ（Expo + TypeScript）。
セキュリティとシンプルさを最優先し、**外部データベース（Supabase等）を持たない構成**（記事は静的JSONファイル、ユーザーの保存・設定は端末内ストレージ `AsyncStorage` のみ）で動作します。

## フォルダ構成
- `app/` … 画面コンポーネント
- `src/components/` … 共通UI部品
- `src/lib/` … 型定義・端末内ストレージ（`storage.ts`）・設定・文言管理
- `src/theme/tokens.ts` … 配色・寸法・タグ定義（直書き禁止）
- `scripts/` … 記事収集・要約・シード生成スクリプト
- `data/` … サンプル記事（`seed_articles.json`）、初期ソース（`sources.seed.json`）、およびアプリが読み込む生成済みデータ（`articles.json`, `sources.json`）
- `docs/` … 仕様（`SPEC.md`）・デザイン（`DESIGN.md`）・App Store提出（`ストア提出チェックリスト.md` ほか）
- `landing/ainews/` … Support / Privacy / Terms（独自ドメイン `soroa-studio.com/ainews/` へデプロイ）

---

## セットアップ手順（Step 1）

### 1. パッケージのインストール
```bash
npm install
```

### 2. シードデータの生成（`scripts/seed.ts`）
外部DBや環境変数の設定なしで、すぐに手元でシードデータを生成できます。
以下のコマンドを実行すると、`data/sources.seed.json` と `data/seed_articles.json` から `data/sources.json` と `data/articles.json` が生成されます。

```bash
npm run seed
```

### 3. `.env` ファイルの作成（Step 2 の記事収集・要約用、コミット厳禁）
Step 2 で RSS 収集と LLM 要約スクリプト（`scripts/ingest.ts`）を動かす際に使用します（`.env` は `.gitignore` によりGit管理から除外されています）。

```bash
cp .env.example .env
```

`.env` の各項目:
- `SUMMARY_API_KEY`: 要約生成に使うLLMのAPIキー（スクリプト専用。**アプリ側には一切入らない**）
- `SUMMARY_MODEL`: 要約モデル名（既定: `gemini-3.1-flash-lite`。比較例: `gemini-3.8-flash` / `gemini-3.6-flash`）
- `MAX_ARTICLES_PER_DAY`: 1日の最大要約件数（Asia/Tokyo、既定: `360`）
- `MAX_ARTICLES_PER_RUN`: 1回の ingest で追加する件数（既定: `10`。cron 間引き対策と日上限360のバランス。ソース間は公平枠で分散）
- `INGEST_ARTICLE_DELAY_MS`: 記事ごとのLLM間隔ミリ秒（デフォルト: `4000`）
- `MAX_MONTHLY_COST_JPY`: 月間の費用上限（デフォルト: `3000`。無料枠中は実質 $0）
- `EXPO_PUBLIC_FEED_URL`: （任意）本番等でリモートの静的JSON URLから記事を取得する場合に指定。未指定でも **開発中（`expo start`）は `public/articles.json` を都度取得**する。
- 表示は **日本語 / 英語のネイティブ要約**（`translations`）。ko/es や端末側機械翻訳は使わない。

### 新着がアプリに反映されるタイミング
- **開発中（`npx expo start`）**: `npm run ingest` / Actions が `data/` と `public/articles.json` を同期。起動時・フォアグラウンド復帰時（約60秒クールダウン）に再取得。手動の再読み込みも可。
- **`EXPO_PUBLIC_FEED_URL` あり（本番推奨）**: 起動・フォアグラウンド復帰時にそのURLを取りにいくので、JSONを更新すれば次に開いたときに新着が入る。
- **本番ビルドで URL 未設定**: 同梱 JSON のみ。新着は次のアプリアップデートまで増えない。

### 4. アプリの起動
```bash
npx expo start
```
- iOSシミュレーターで開く場合: `i` キー
- Androidエミュレーターで開く場合: `a` キー
- 実機（Expo Go）で開く場合: 表示されるQRコードを読み取る
- Webで確認する場合: `w` キー

---

## 自動更新（日英ネイティブ要約・同品質）

記事は DB なしで `data/articles.json` に溜め、アプリは必要なら `EXPO_PUBLIC_FEED_URL` から取得します。品質は `scripts/ingest.ts` の編集プロンプト＋語数ゲートで担保します。

### A. 手元で1回動かす
```bash
cp .env.example .env   # SUMMARY_API_KEY を入れる
npm run ingest         # RSS収集 → 日英ネイティブ要約
npm run quality:check  # 英語95語未満など不合格を検出
```

### B. 毎時自動更新（無料枠 Lite）

**GitHub Actions（本線・PCオフでも動く）**
1. Secret `SUMMARY_API_KEY` と Variables（`SUMMARY_MODEL=gemini-3.1-flash-lite` 等）を設定
2. **主起動**: Vercel Cron（`ops/ingest-wake`）が約15分ごとに `repository_dispatch` → Actions が収集・push（手順: `docs/収集-外部cron手順.md`）
3. **保険**: GitHub Actions の `schedule`（間引きあり）も残す
4. 手動デバッグ: Actions タブ → `Ingest AI news (JA+EN)` → Run workflow（または `gh workflow run`）

※ 収集の実行本体は GitHub Actions のみ（Mac 不要）。無名 cron SaaS への PAT 設置はしない。

ワークフロー: `.github/workflows/ingest.yml`  
起こし用: `ops/ingest-wake/`

### C. アプリに新着を届ける
1. **開発中**: 上記 A/B のあと、アプリ起動またはフォアグラウンド復帰で `public/articles.json` を再取得（手動再読み込みも可）。
2. **本番リモート配信（推奨）**  
   - `data/articles.json` を raw URL で公開（このリポジトリ例:  
     `https://raw.githubusercontent.com/contactsoroa-design/ai-news-app-starter/main/data/articles.json`）  
   - EAS ビルドの環境変数に  
     `EXPO_PUBLIC_FEED_URL=https://raw.githubusercontent.com/contactsoroa-design/ai-news-app-starter/main/data/articles.json`
3. **本番で URL 未設定**  
   - 同梱 JSON のみ。新着は次のアプリアップデートまで反映されない

### 費用の目安
- 無料枠の `gemini-3.1-flash-lite` 利用時: API 料金は $0（日次リクエスト上限に注意）
- 有料 Flash 想定: 記事1件（日英）約 0.15〜1 円前後 / 上限 `MAX_MONTHLY_COST_JPY=3000` で停止
