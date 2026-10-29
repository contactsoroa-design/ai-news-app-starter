# Google Play 提出チェックリスト（Fast News AI / Android）

**最終更新:** 2026-10-29  
掲載文: `GooglePlay掲載文-貼り付け用.md`  
iOS 側: `ストア提出チェックリスト.md`  
Support / PP / Terms は iOS と同じ独自ドメインを使う（`*.vercel.app` 不可）。

## アプリ情報

| 項目 | 案 |
|------|----|
| 名称 | **Fast News AI**（JA/EN 同名） |
| パッケージ名 | `com.soroa.ainews`（`app.json` → `android.package`） |
| versionName | `1.0.0`（`expo.version`） |
| versionCode | `1`（`android.versionCode`。提出のたびに +1） |
| カテゴリ | ニュース＆雑誌（News & Magazines） |
| 課金 | **なし**（現状） |
| アカウント必須 | **なし** |
| 広告 ID / AdMob | **使わない** |
| 開発者表示名 | Soroa Studio（組織アカウント推奨） |

## アカウント：個人 → 組織

**URLつきでなぞる手順（正本）:** [`GooglePlay-個人から組織へ-手順.md`](./GooglePlay-個人から組織へ-手順.md)

要約:

- **A（推奨）** 同じ個人アカウントを組織に変換 → $25 そのまま  
  入口: https://play.google.com/console → あなたの情報 → サイト検証 → 種類変更  
  公式: https://support.google.com/googleplay/android-developer/answer/16260648?hl=ja  
- **B** すでに別の組織 Console がある → アプリ移管 or 組織側だけ使う（$25 は引き継げない）  
  移管: https://support.google.com/googleplay/android-developer/answer/11637431?hl=ja  
- 変換後 **72時間** は新規アプリ提出しない

## 必須アセット

- [x] Adaptive icon（`assets/android-icon-*.png`）
- [x] 電話スクリーンショット（`store/play/01-home.png` / `02-explore.png` / `03-sources.png`）
- [ ] （任意）7インチ／10インチタブレット用
- [x] フィーチャーグラフィック（`store/play/feature-graphic-1024x500.png`）
- [ ] （任意）プロモ動画
- 詳細: `store/play/README.md`

## プライバシー・ウェブ（独自ドメイン）

| 項目 | URL |
|------|-----|
| アプリのウェブサイト | https://soroa-studio.com/ainews/ |
| Privacy Policy | https://soroa-studio.com/ainews/privacy.html |
| Terms | https://soroa-studio.com/ainews/terms.html |
| 問い合わせ | support@soroa-studio.com |

提出前:

- [ ] 上記が HTTPS で開ける
- [ ] Data safety（データセーフティ）を実態どおり宣言（端末内のみ・追跡なし・第三者広告 SDK なし）
- [ ] 広告 ID 宣言: **アプリは広告 ID を使用しない**

## Data safety 案（実態）

| 項目 | 宣言案 |
|------|--------|
| 収集するユーザーデータ | **なし**（設定・保存は端末内。サーバーへ個人データを送らない） |
| 共有 | なし |
| セキュリティ対策 | 転送中の暗号化（HTTPS でフィード取得）は「はい」で可 |
| アカウント削除 | アカウント無し → 該当なし |
| 子ども向け | 対象外（ニュース・外出しリンク） |
| 機密情報カテゴリ | 金融助言・医療診断アプリではない |

※ 解釈が揺れる場合は「収集なし」寄りで正直に。フィード取得は一般的なコンテンツ配信。

## コンテンツレーティング

IARC アンケートに回答（ニュースアプリ想定）。  
ギャンブル・暴力・性的コンテンツ等は「ない」想定で進める。結果の年齢区分に合わせてストア表示。

## バイナリ／コード側

- [x] `android.package` = `com.soroa.ainews`
- [x] adaptiveIcon 設定済
- [x] 本番に API キーを入れない
- [x] 設定から PP / Terms / Support を開ける
- [ ] `eas.json` production で Android AAB をビルドできること
- [ ] 初回は **内部テスト** → 問題なければ本番トラック
- [ ] versionCode を提出ごとに上げる（いま `1`）

## ビルド／提出コマンド（明示してから実行）

```bash
cd /Users/kadowakisoranari/Desktop/ai-news-app-starter
eas build --platform android --profile production
# 初回は Play Console でアプリ作成・AAB 手動アップロードでも可
eas submit --platform android --profile production
```

`eas submit` には Google サービスアカウント JSON（Play Console API アクセス）が必要。未設定なら Console から AAB 手動上げでよい。

## 審査で聞かれやすい点（iOS と同じ）

- ログインなしで主要機能が使える
- 記事全文は持たず要約＋出典リンクのみ
- スポンサーは「広告」表示（計測 SDK なし）
- 投資・医療の助言アプリではない
