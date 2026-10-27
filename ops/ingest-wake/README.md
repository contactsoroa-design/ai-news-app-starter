# ainews-ingest-wake

Vercel Cron → GitHub `repository_dispatch`（`event_type: ingest`）だけの最小プロジェクト。  
要約 API キーは置かない。手順の正本はリポジトリ直下の [`docs/収集-外部cron手順.md`](../../docs/収集-外部cron手順.md)。

```bash
npx vercel link
npx vercel env add INGEST_DISPATCH_TOKEN production
npx vercel --prod
```
