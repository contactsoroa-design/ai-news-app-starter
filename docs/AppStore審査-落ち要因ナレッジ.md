# App Store 審査 — 落ち要因ナレッジ（本アプリ向け）

**最終更新:** 2026-10-26  
**出典:** `life_Design_Simulator/compath/docs/AppStore審査-落ち要因ナレッジ.md`（Compath実録）を、**AIニュース**用に読み替えたもの。  
**目的:** 初回審査で落ちやすい型を先に潰す。ASO・星・Growthは対象外。

関連: `ストア提出チェックリスト.md` ／ `ストア掲載文-貼り付け用.md`

---

## 0. 30秒で言うと

落ちるのはだいたい次のどれか。

1. **メタと実装が違う**（書いてあるのに触れない／壊れている）
2. **サブスクの開示不足**（本アプリは現状 IAP なし → 説明に「課金がある」と書かない）
3. **審査官が最後まで進めない**（特に iPad／小さい高さ）
4. **センシティブ権限の説明不足**（本アプリは基本権限なし。取るなら用途を揃える）
5. **Connect の手続きミス**（版トレイン、ローカライズ欠落）
6. **公開ウェブが弱い**（`vercel.app`・403・PP/Support が開かない）

「完成度」より **審査官の1本道が通ること**。ウェブは **開く・屋号が分かる・規約が辿れる**。

---

## 1. 本アプリで特に効く型

| 型 | 本アプリでの読み替え | 潰し方 |
|----|----------------------|--------|
| **2.1 完成度** | フィード真っ白・無限読込・探索タップ不能・設定で行き止まり | 新品インストール → ホームで1枚スワイプ → 探索でカード → 設定、を iPhone で通す。`supportsTablet: false` でも iPad 互換表示を一度確認 |
| **2.3 メタ不一致** | スクショや説明に「ランキング」「ログイン」「Push」など未実装を書く | **今触れる機能だけ**書く（スワイプ要約・絞り込み・保存・探索・日英） |
| **3.1 課金** | 現状 IAP なし | 説明・Review Notes で「No in-app purchase」と明記。将来課金するなら EULA を説明文末尾＋アプリ内開示 |
| **5.1 プライバシー** | 端末内設定／保存のみ。フィードは公開JSON | Connect の Privacy URL = 独自ドメインの本アプリ用 PP。App Privacy ラベルは「端末内＋表示用にフィード取得」に合わせる。追跡なし |
| **広告** | 自前スポンサード（「広告」バッジ） | スクショでも広告ラベルが見えること。トラッキングSDKは入れない（現状どおり） |
| **ウェブ** | Support / PP / Terms | `https://soroa-studio.com/ainews/` 系。`*.vercel.app` を Connect に貼らない |

Compathで実撃した詳細表は原典 §1・§8 を参照（Enrollment の独自ドメイン要件など共通）。

---

## 2. 本番に残すと危険な開発ゴミ

- debug 画面・テスト解除スイッチが本番で開ける
- 「Expo Go / 準備中」がユーザー向け主文言になっている（情報源の terms 待ちラベルは可）
- 開発用フィードURLや API キーがクライアントに入っている（本アプリはキー無し方針を維持）

---

## 3. Review Notes 骨格（本アプリ）

正本の全文は `ストア掲載文-貼り付け用.md`。骨子のみ:

```
AI News: swipeable feed of short AI-news summaries (JA/EN). No account. No IAP.

How to try: open app → swipe home cards → Explore grid → open a card → Settings filters.

Privacy: on-device prefs/saved/hidden only. Public feed JSON over HTTPS. No tracking/ATT.
Privacy: https://soroa-studio.com/ainews/privacy.html
Terms: https://soroa-studio.com/ainews/terms.html
Support: https://soroa-studio.com/ainews/  or mailto:support@soroa-studio.com

Sponsored cards (if shown) are labeled 広告/Ad. No click analytics SDK.
```

---

## 4. 再提出のコツ（共通）

1. メモ欄は追記せず **全文上書き**
2. 直した画面の再現手順を番号で書く
3. メタだけの指摘ならビルド不要のこともある
4. UI 行き止まりは必ず新しいビルド＋ version 上げ

---

## 5. 原典との差分

| Compath | AIニュース |
|---------|------------|
| サブスク・RevenueCat | なし（今は） |
| Family Controls / Health | なし |
| 医療誤解リスク | 低（ニュース要約。投資助言でない旨を規約に記載） |
| ログインなし | 同じ（有利） |
