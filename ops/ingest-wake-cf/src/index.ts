/**
 * Cloudflare Cron → GitHub repository_dispatch (ingest)
 * 要約 API キーは置かない。起こすだけ。
 *
 * Secrets: INGEST_DISPATCH_TOKEN
 * Optional env: INGEST_GITHUB_REPO
 */

export interface Env {
  INGEST_DISPATCH_TOKEN: string;
  INGEST_GITHUB_REPO?: string;
}

const DEFAULT_REPO = 'contactsoroa-design/ai-news-app-starter';

async function dispatchIngest(env: Env): Promise<Response> {
  const token = env.INGEST_DISPATCH_TOKEN;
  if (!token) {
    return Response.json(
      { ok: false, error: 'missing_INGEST_DISPATCH_TOKEN' },
      { status: 500 }
    );
  }

  const repo = (env.INGEST_GITHUB_REPO || DEFAULT_REPO).trim() || DEFAULT_REPO;
  const ghRes = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'ainews-ingest-wake-cf',
    },
    body: JSON.stringify({
      event_type: 'ingest',
      client_payload: { source: 'cloudflare-cron' },
    }),
  });

  if (ghRes.status === 204 || ghRes.status === 200) {
    return Response.json({ ok: true, dispatched: true, repo });
  }

  const detail = await ghRes.text().catch(() => '');
  return Response.json(
    {
      ok: false,
      error: 'github_dispatch_failed',
      status: ghRes.status,
      detail_len: detail.length,
      detail_prefix: detail.slice(0, 120),
    },
    { status: 502 }
  );
}

export default {
  async scheduled(
    _controller: ScheduledController,
    env: Env,
    _ctx: ExecutionContext
  ): Promise<void> {
    const res = await dispatchIngest(env);
    if (!res.ok) {
      const body = await res.text();
      console.error('ingest wake failed', res.status, body.slice(0, 200));
      throw new Error(`ingest wake failed: ${res.status}`);
    }
  },

  /** 手動確認用（認証なし公開はしない想定。必要なら Worker を Private に） */
  async fetch(_request: Request, env: Env): Promise<Response> {
    return dispatchIngest(env);
  },
};
