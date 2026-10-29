# Google Play：個人アカウント → 組織アカウント（URLつき手順）

**最終更新:** 2026-10-29  
対象: 以前 **個人** で Play Console（$25）を購入済み → いま **Soroa Studio（組織）** で出したい  
このあとアプリ作成: `GooglePlay提出チェックリスト.md` / 掲載文 `GooglePlay掲載文-貼り付け用.md`

ブラウザは **Chrome**、ログインは **個人で Play Console を買ったときの Google アカウント** を使う。

---

## 全体の流れ（目安）

| 順 | やること | 所要 |
|----|----------|------|
| 0 | ログイン確認 | 1分 |
| 1 | D-U-N-S を用意（未所持なら申請） | 即〜最大約30営業日（無料枠） |
| 2 | Play Console で公式サイトを検証 | 数分〜数時間 |
| 3 | アカウント種類を「組織」に変更 | 数十分＋審査待ちの場合あり |
| 4 | **72時間待つ**（新規アプリ提出禁止） | 3日 |
| 5 | アプリ作成・掲載・AAB | 別チェックリスト |

---

## 0. まず開く

1. Play Console トップ  
   → https://play.google.com/console  
2. アカウントが一覧に出る場合は、**個人で登録したデベロッパーアカウント**を選ぶ  
3. 左メニュー（または設定ギア付近）から  
   **デベロッパー アカウント** → **あなたの情報**（英語 UI: **Developer account** → **About you**）  
   直近の画面が違う場合の公式説明:  
   → https://support.google.com/googleplay/android-developer/answer/13634081?hl=ja  

ホームに「確認が必要」「制限あり」などの警告が出ていたら、**先にそれを解消**してから種類変更へ。

---

## 1. D-U-N-S 番号を用意する

組織アカウントには **D-U-N-S（9桁）が必須**。  
すでに Apple Developer（組織）や他サービスで取得済みなら、同じ番号を使う。

### 1-A. 日本法人・屋号で新規／照会（国内窓口）

東京商工リサーチ（D&B 日本）公式:  
→ https://duns.tsr-net.co.jp/duns-web/index  

やること:

1. 上記を開く  
2. **自社 D-U-N-S Number の取得・照会／発番** を選ぶ  
3. 会社メールで認証（フリーメールは弾かれることあり → `…@soroa-studio.com` 推奨）  
4. **納期 30営業日・0円** を選べば無料（急ぎなら有料の短縮あり。第三者代行サイトは使わない）  
5. 通知書の **9桁** を控える  

料金・納期の説明も同ページ内。

### 1-B. 英語の D&B（Google Developer 向け導線）

→ https://www.dnb.com/en-us/smb/duns/get-a-duns.html  

「I'm a Google Developer」等を選び申請。通常処理は無料・最大約30営業日。有料の急ぎは任意。

照会だけ:  
→ https://dunsnumberlookup.dnb.com/

### このアプリ用に書いておく値（例）

| 項目 | 値 |
|------|-----|
| 組織名（表示） | Soroa Studio |
| 公式サイト | https://soroa-studio.com/ |
| 連絡メール | support@soroa-studio.com |
| アプリ LP | https://soroa-studio.com/ainews/ |

登記上の正式名称・住所は **登記／開業届どおり**（Play・D-U-N-S で一致させる）。

---

## 2. 組織の公式ウェブサイトを検証する

種類変更ボタンは、**サイト検証が終わるまで出ない**ことが多い。  
Play は **Google Search Console の所有者**と紐づけて確認する。

### 2-1. Search Console でサイト所有を証明（未登録なら）

ログイン: **contact.soroa@gmail.com**（Play と同じ）  
→ https://search.google.com/search-console  

`soroa-studio.com` は未検証のことが多い（`neolra.com` だけある状態でも可）。

1. プロパティ追加  
   → https://search.google.com/search-console/welcome  
2. **ドメイン** に `soroa-studio.com` → 続行  
3. 表示された **TXT レコード全体**をコピー（`google-site-verification=…`）

#### DNS の置き場所（重要）

このドメインのネームサーバは **お名前.com / GMO**（`ns-rs1.gmoserver.jp` / `ns-rs2.gmoserver.jp`）。  
GoDaddy / Namecheap / Vercel DNS には書かない（Vercel にゾーンがあっても **NS が GMO のまま**なので反映されない）。

お名前.com ナビ:

1. https://www.onamae.com/navi/login/  
2. https://www.onamae.com/navi/domain/ → `soroa-studio.com`  
3. **DNS関連機能の設定** → **DNSレコード設定を利用する**  
4. 追加: タイプ **TXT** / ホスト名 **空欄** / VALUE = Search Console の文字列  
5. 既存の `v=spf1 …` TXT は **消さない**  
6. 設定反映後、Search Console で **確認**（数分〜数時間）

代替（DNS が難しいとき）: welcome で **URL プレフィックス** `https://soroa-studio.com/` を選び、HTML メタタグをルート `index.html` に入れる（サイト正本は Compath リポの `server/public/index.html`）。ドメイン方式の方が Play 組織サイト検証と相性が良い。

### 2-2. Play Console 側で紐づけ

1. → https://play.google.com/console  
2. **デベロッパー アカウント** → **あなたの情報**  
3. **組織のウェブサイト**に入力（Search Console と **同じ文字列**）:  
   `https://soroa-studio.com/`  
4. 保存 → **確認リクエストを送信**（Send verification request）  
5. Search Console の所有者アカウントが別なら、メール／Search Console 通知で **承認**  
6. Play のステータスが **確認済み** になるまで待つ  

サイト検証の公式:  
→ https://support.google.com/googleplay/android-developer/answer/13205715?hl=ja

---

## 3. アカウントの種類を「組織」に変更する

公式の変換手順（日本語）:  
→ https://support.google.com/googleplay/android-developer/answer/16260648?hl=ja  
（見出し「個人のデベロッパー アカウントを組織アカウントに変換する」）

アカウント種類の説明:  
→ https://support.google.com/googleplay/android-developer/answer/13634885?hl=ja  

画面操作:

1. https://play.google.com/console → **あなたの情報**  
2. **アカウントの種類を変更**（Change account type）をクリック  
3. **お支払いプロファイルを作成または選択**  
4. なければ **新しいお支払いプロファイルを作成**  
   - 種類: 組織 / ビジネス  
   - **D-U-N-S を入力**  
   - 正式名称・住所は D-U-N-S／登記と一致  
5. 組織情報  
   - 種類: **会社 / ビジネス**  
   - 規模: **1〜10人**（該当なら）  
   - 組織の電話: `+81…` 形式  
6. 連絡先（どちらも OTP 確認あり）  
   - Google 連絡用: 自分が見るメール／電話  
   - Play 表示用: `support@soroa-studio.com` と公開してよい電話  
7. 求められたら登記簿・本人確認書類をアップロード  
8. 審査メールを待つ → お支払いプロファイルが **確認済み** に  
9. **あなたの情報** に戻り  
   **デベロッパー アカウントへのお支払いプロファイルのリンク**  
10. **確認して保存**

お支払いセンター（プロファイル編集が必要なとき）:  
→ https://pay.google.com/business/console  

---

## 4. 変換後は 72 時間待つ

移行完了メール／画面で組織になっていることを確認したあと、  
**最低 72 時間は新しいアプリを審査提出しない**（同期前の否承認を防ぐ公式注意）。

この間にできる準備（提出はしない）:

- 掲載文を読む: `docs/GooglePlay掲載文-貼り付け用.md`
- スクショ・フィーチャーグラフィック 1024×500 を用意
- Privacy 等が開けるか確認  
  - https://soroa-studio.com/ainews/  
  - https://soroa-studio.com/ainews/privacy.html  
  - https://soroa-studio.com/ainews/terms.html  

---

## 5. 72 時間後：アプリを作る（ここから提出準備）

1. Play Console  
   → https://play.google.com/console  
2. **アプリを作成**  
3. 入力例  
   - アプリ名: `Fast News AI`  
   - デフォルト言語: 日本語  
   - アプリ or ゲーム: **アプリ**  
   - 無料 / 有料: **無料**  
   - 宣言に同意  
4. ダッシュボードのチェックリストを上から埋める  
   - パッケージ名（後で AAB と一致）: `com.soroa.ainews`  
   - プライバシーポリシー: `https://soroa-studio.com/ainews/privacy.html`  
   - カテゴリ: ニュース＆雑誌  
   - Data safety / 広告 ID「使用しない」→ チェックリスト参照  

ビルド（リポ側・**明示してから**実行）:

```bash
cd /Users/kadowakisoranari/Desktop/ai-news-app-starter
eas build --platform android --profile production
```

初回は **内部テスト** トラックへ AAB を上げる（本番公開は後）。

アプリの移管（別アカウントに既に組織がある場合だけ）:  
→ https://support.google.com/googleplay/android-developer/answer/11637431?hl=ja  

---

## つまずいたとき

| 症状 | 確認 |
|------|------|
| 「種類を変更」が出ない | サイト検証が未完了。確認リクエスト送信済みか |
| D-U-N-S が弾かれる | 正式名称・住所の表記ゆれ。登記どおりに揃える |
| 有料の D-U-N-S 代行を勧められた | **使わない**。TSR の 30営業日無料 or D&B 公式無料 |
| 個人と組織で Google アカウントが違う | 変換は **個人アカウント側で実施**。別組織 Console を新規購入した場合は $25 は別口座 |

サポート窓口（Console 内 Help）:  
→ https://play.google.com/console → ？ヘルプ → お問い合わせ  

---

## 関連ドキュメント

- 提出全体: `GooglePlay提出チェックリスト.md`
- ストア文面: `GooglePlay掲載文-貼り付け用.md`
- 手元 TODO: `提出準備-手元TODO.md`
