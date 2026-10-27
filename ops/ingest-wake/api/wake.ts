import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Vercel Cron → GitHub repository_dispatch (event_type: ingest)
 * 収集本体・要約 API キーは GitHub Actions 側。ここは起こすだけ。
 *
 * Env (Vercel project):
 * - CRON_SECRET: Vercel が Cron 呼び出し時に Authorization: Bearer で付与
 * - INGEST_DISPATCH_TOKEN: Fine-grained PAT（対象リポ Contents: R/W）
 * - INGEST_GITHUB_REPO: 省略時 contactsoroa-design/ai-news-app-starter
 */

const DEFAULT_REPO = 'contactsoroa-design/ai-news-app-starter';

function unauthorized(res: VercelResponse) {
  return res.status(401).json({ ok: false, error: 'unauthorized' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'method_not_allowed' });
  }

  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.authorization;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return unauthorized(res);
  }

  const token = process.env.INGEST_DISPATCH_TOKEN;
  if (!token) {
    return res.status(500).json({
      ok: false,
      error: 'missing_INGEST_DISPATCH_TOKEN',
    });
  }

  const repo =
    (process.env.INGEST_GITHUB_REPO || DEFAULT_REPO).trim() || DEFAULT_REPO;

  const ghRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ainews-ingest-wake',
    },
    body: JSON.stringify({
      event_type: 'ingest',
      client_payload: { source: 'vercel-cron' },
    }),
  });

  // GitHub は成功時 204 No Content
  if (ghRes.status === 204 || ghRes.status === 200) {
    return res.status(200).json({ ok: true, dispatched: true, repo });
  }

  const detail = await ghRes.text().catch(() => '');
  return res.status(502).json({
    ok: false,
    error: 'github_dispatch_failed',
    status: ghRes.status,
    // トークンや詳細ボディは出さない（長さと先頭だけ）
    detail_len: detail.length,
    detail_prefix: detail.slice(0, 120),
  });
}
