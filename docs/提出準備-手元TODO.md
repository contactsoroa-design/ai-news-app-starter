# 提出準備 — 手元で残っていること（Fast News AI）

**更新:** 2026-10-28  
コード／ウェブ側の準備はほぼ完了。以下は **人手＋ASC＋ビルド** だけ。  
初回 ASC 貼り付け一式: `docs/ASC初回登録-貼り付け一式.md`  
**ソフトローンチ方針:** `docs/ソフトローンチ手順.md`（ウェイトリスト閉門なし・Approved 後すぐ公開）

## すでに済んでいること（自動確認済み）

| 項目 | 状態 |
|------|------|
| Bundle ID `com.soroa.ainews` / version `1.0.0` / build `4` | `app.json` |
| `ITSAppUsesNonExemptEncryption: false` | 済 |
| Privacy Manifest（UserDefaults CA92.1） | 済 |
| `supportsTablet: false` | 済 |
| App Icon 1024×1024 | `assets/icon.png` |
| JA/EN 表示名（ホーム画面） | `locales/ja.json` / `locales/en.json` |
| DEMO_SWIPE オフ | `DEMO_SWIPE_ENABLED = false` |
| 設定から Support / PP / Terms | `legalUrls` → 独自ドメイン |
| Support / PP / Terms HTTPS 200 | `https://soroa-studio.com/ainews/` 系（2026-10-26 再デプロイ済） |
| 本番フィード JSON | `EXPO_PUBLIC_FEED_URL`（eas production） |
| 掲載文・Review Notes | `docs/ストア掲載文-貼り付け用.md` |
| EAS ログイン | `soroa` / projectId 設定済 / ascAppId `6826796016` |

## 運用（収集の主起動）— ASC とは別だが初回セットアップ必須

GitHub `schedule` の間引き対策。正本: `docs/収集-外部cron手順.md`  
（Vercel Hobby は15分 Cron 不可 → **Cloudflare が主**）

- [ ] Fine-grained PAT（リポ限定・Contents R/W・期限付き）を発行
- [ ] `npx wrangler login` → `ops/ingest-wake-cf` で `secret put` + `deploy`
- [ ] Actions に `repository_dispatch` 起因の run が約15分おきに並ぶことを確認

## あなたがやること（この順）

### 1. スクショ → **済（シミュレータ）**

`store/screenshots/01-home-swipe-69.png` 他3枚を Connect の **6.9"ディスプレイ** にアップロード。  
（実機 Pro Max で撮り直すとより自然。拡大版で提出も可）

### 2. Connect メタを貼る

正本: `docs/ストア掲載文-貼り付け用.md`

- Support / Privacy URL（表のとおり。`*.vercel.app` は使わない）
- JA・EN の名前・説明・キーワード
- Review Notes（英語・全文）
- App Privacy: 追跡なし／第三者広告SDKなし（チェックリスト参照）
- 年齢: 12+ 推奨
- カテゴリ: News
- 広告 ID: **使用しない**
- Export Compliance: 非該当（暗号化免除）

### 3. production ビルド → 提出

チェックリストどおり、**明示してから**実行:

```bash
cd /Users/kadowakisoranari/Desktop/ai-news-app-starter
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

ビルド後の実機スモーク:

- [ ] Expo Go 文言・dev スイッチが出ない
- [ ] 新品インストールで ホーム → 探索カード → 設定 が通る
- [ ] 通信オフで真っ白無限にならない

### 4. 提出 → 即公開

TestFlight で自分確認 → Connect で「審査へ提出」。  
**Approved 後はウェイトリスト待ちにせず、当日中に一般公開**（`docs/ソフトローンチ手順.md`）。

### 5. 公開と同時（ビジネス加速）

- [ ] `landing/ainews/` を再デプロイ（告知フォーム・`media-kit.html`）
- [ ] メディアキット送付開始: `docs/スポンサー候補リスト.md`
- [ ] 週次KPI: `docs/週次KPI.md`

## Google Play（Android・並行準備可）

正本: `docs/GooglePlay提出チェックリスト.md` / 掲載文 `docs/GooglePlay掲載文-貼り付け用.md`

- [ ] **URLつき手順どおり**個人→組織: `docs/GooglePlay-個人から組織へ-手順.md`  
  （D-U-N-S → Search Console → Play サイト検証 → 種類変更 → 72h待ち）
- [ ] Search Console: `https://soroa-studio.com/` を **URLプレフィックス**で追加 → メタタグをルート HTML に入れるか、ドメインTXTをお名前.comへ（NSは GMO）
- [ ] 変換完了後 **72時間** あけてから新規アプリ提出
- [ ] Play にアプリ作成（パッケージ `com.soroa.ainews`）→ 同手順 §5
- [ ] Data safety / コンテンツレーティング / プライバシー URL
- [x] スクショ＋フィーチャー: `store/play/`（アップロードは人手）
- [ ] `eas build --platform android --profile production`（明示してから）
- [ ] 初回は **内部テスト** トラックへ（`eas.json` submit.android は internal/draft）

## 注意（名前）

- ストア名（JA/EN）: **Fast News AI**
- 日本語の別名・補足: 後日（サブタイトル等）
- LP / 規約のブランド表記も Fast News AI
- Connect の「名前」は `ストア掲載文-貼り付け用.md` に合わせる
