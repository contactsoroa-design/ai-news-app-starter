# Cursorへ渡すプロンプト（順番に、1回に1つ）

## 最初のひとこと（これを最初に貼る）
「`AGENTS.md` と `docs/` を読んでから、`PROMPTS.md` の Step 1 だけを実行してください。終わったら、変更ファイル・動作確認の手順・未解決のことを教えてください。」

---

## Step 1: 準備
やること:
- このフォルダの中に、Expo（TypeScript）のアプリを作る（`create-expo-app`）。`src/theme/tokens.ts` は上書きしない。
- フォルダ構成を整える: `app/`（画面）、`src/components`、`src/lib`、`scripts/`（収集・要約）。
- `.env.example` を元に、`.env` の作り方をREADMEに書く（`.env` はコミットしない）。
- 外部DB（Supabase等）は使わず、記事データは `data/articles.json`・`data/sources.json`、ユーザーデータ（保存・非表示・設定）は端末内ストレージ（AsyncStorage）で扱う構成にする。
- `data/seed_articles.json` と `data/sources.seed.json` から `data/articles.json`・`data/sources.json` を生成する `scripts/seed.ts` を作る。
完了条件: `npx expo start` でアプリが起動し、空の画面が出る。`npm run seed` でシードJSONが作られる。

## Step 2: 収集と要約（画面より先）
やること:
- `scripts/ingest.ts` を作る。有効なソースのRSS取得 → 重複除外 → og:image のURL取得 → モデルで **日英ネイティブ要約** → `data/articles.json` へ保存。
- 要約は `docs/SPEC.md` の仕様（`title_ja` / `summary_ja` / `title_en` / `summary_en` / タグ。英語は95〜140語で日本語と同密度）。見出しと冒頭をモデルに渡す。端末側機械翻訳は使わない。
- 件数と費用の上限（`.env`、1日デフォルト350件・1時間15件・1実行4件・ペースslack6・America/Los_Angeles＝Gemini RPD）を守り、超えたら止める。429連続時は実行停止。品質は `npm run quality:check`。
- `terms_checked = false` のソースは、取得しない。
完了条件: コマンド1つで実行でき、日英要約つきで保存される。保存結果を一覧で表示するコマンドも作る。人が目で確認する。

## Step 3: フィード画面
やること:
- `docs/DESIGN.md` と `design/mock/Main.dc.html` を見ながら、縦スワイプのカード画面を作る（まずは「おすすめ」タブだけ）。
- ツールごとに配色を切り替える（`src/theme/tokens.ts`）。
- OGP画像が無い時の代替表示、読み込み中・空・通信失敗の状態を入れる。
完了条件: シードまたは実データで、1枚ずつスワイプできる。文字がサムネとボタン列に重ならない。

## Step 4: 保存・興味なし・元記事・長押し
やること:
- 右下のボタン列（保存・共有・元記事・興味なし）と、長押しで元記事を開く動作。
- 端末内ストレージ（AsyncStorage）で保存済み（`saves`）と非表示（`hidden`）を永続化する。
- 「保存済み」画面。
完了条件: 保存したものが、アプリを再起動しても残る。興味なしにした記事が出なくなる。

## Step 5: 情報源とツールの選択、ソース別・ツール別
やること:
- 設定 > 情報源（`design/mock/Manage.dc.html` と `ManageTools.dc.html`）。ソースのオン・オフ、ジャンル・ツールの選択、選択数を設定のトップに表示。
- 上部タブ「ソース別」「ツール別」、チップ列と右端の「＋ 編集」。
完了条件: 選択を変えると、フィードの内容が変わる。

## 各ステップの終わりに
変更したファイルの一覧 / 動作確認の手順 / 未解決のこと を出す。次のステップには、指示があるまで進まない。
