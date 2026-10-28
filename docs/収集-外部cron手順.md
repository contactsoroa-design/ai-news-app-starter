# 収集の間引き対策（信頼できる Cron → repository_dispatch）

## なぜ必要か

GitHub Actions の `schedule` は混雑時に**間引かれる**（公式の既知挙動）。  
確実に起こすには、信用できる基盤のタイマーから `repository_dispatch` を叩く。

- **実行本体**: 従来どおり GitHub Actions（要約 API キーは Actions secrets のみ）
- **保険**: `.github/workflows/ingest.yml` の GitHub `schedule`（1 時間 6 枠）は残す
- **非推奨**: cron-job.org 等の無名 SaaS に GitHub PAT を載せる運用

## プラン制約（重要）

| 基盤 | 15分間隔 | 備考 |
|------|----------|------|
| **Cloudflare Workers Cron（推奨・無料）** | 可 | `ops/ingest-wake-cf/` |
| Vercel Cron | Hobby は **1日1回まで** | Pro なら 15 分可。`ops/ingest-wake/` は保険用に日2回設定済み |
| 無名 cron SaaS + PAT | 使わない | |

**主起動は Cloudflare**（完全自動・追加課金なし）。Vercel は任意の保険。

日上限（500）・1 実行 10 件・ソース公平枠はそのまま効く。

## セキュリティ（最小）

| 置く場所 | 内容 |
|----------|------|
| Cloudflare Worker Secret | `INGEST_DISPATCH_TOKEN`（Fine-grained PAT） |
| GitHub Actions secrets | 要約用 `SUMMARY_API_KEY` 等（dispatch 用 PAT は置かない） |
| リポジトリ | **トークンをコミットしない** |

PAT 権限（Fine-grained）:

- Repository access: **Only** `ai-news-app-starter`
- **Contents**: Read and write（`repository_dispatch` に必要）
- **Metadata**: Read
- 有効期限例: 90 日。名前例: `ainews-ingest-wake`

漏洩時: PAT を revoke → Cloudflare の Secret だけ差し替え。

---

## あなたがやること（最短・約5分）

コード側（ingest の後回しソース取りこぼし改善・wake プロジェクト）はリポジトリに入っています。  
**PAT の発行と Cloudflare ログインだけは代理できません。**

### A. Fine-grained PAT

1. https://github.com/settings/personal-access-tokens/new  
2. Token name: `ainews-ingest-wake`  
3. Expiration: 90 days  
4. Repository access: Only select → `ai-news-app-starter`  
5. Permissions → Repository → **Contents: Read and write**（Metadata は自動）  
6. Generate → **トークンをコピー**（再表示不可）

### B. Cloudflare にデプロイ（主起動・15分）

ターミナルで:

```bash
cd /Users/kadowakisoranari/Desktop/ai-news-app-starter/ops/ingest-wake-cf

# ブラウザが開く → ログイン許可
npx wrangler login

# PAT を Secret に（貼り付け後 Enter。画面に残らない）
npx wrangler secret put INGEST_DISPATCH_TOKEN

# デプロイ（Cron */15 付き）
npx wrangler deploy
```

### C. 確認

1. Cloudflare Dashboard → Workers → `ainews-ingest-wake` → Triggers に cron  
2. GitHub → Actions → `Ingest AI news (JA+EN)` で trigger が **`repository_dispatch`** の run が約15分おきに並ぶ  

手動一発（デバッグ用・自動化には使わない）:

```bash
gh auth refresh -h github.com   # いま keyring 無効なら先に
gh workflow run "Ingest AI news (JA+EN)" --repo contactsoroa-design/ai-news-app-starter
```

---

## （任意）Vercel 保険

プロジェクト `ainews-ingest-wake` はリンク済み。Hobby のため Cron は **UTC 0:07 と 12:07 の日2回**のみ。

```bash
cd /Users/kadowakisoranari/Desktop/ai-news-app-starter/ops/ingest-wake
npx vercel env add INGEST_DISPATCH_TOKEN production   # 同じ PAT
npx vercel deploy --prod --yes
```

Pro に上げるなら `vercel.json` の schedule を `*/15 * * * *` に戻してよい。

`CRON_SECRET` は Production に設定済み（Cron の Bearer 用）。

---

## 取りこぼし（実行時）

ingest は不足ソース優先のあと、**枠が余れば件数の多い後回しソース全般**を同じ実行内で拾う。

## やらないこと

- 無名 cron SaaS への PAT 設置  
- Mac 常時起動を主系にすること  
- 収集・要約を Vercel/CF に移すこと（起こすだけ）
