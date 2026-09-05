import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, open, unlink } from 'node:fs/promises';
import { join, isAbsolute } from 'node:path';
import type { PublicSource } from './audit-public-sources.ts';

// Single shared persistent volume required. Reservations survive errors/restarts;
// they are never refunded on ambiguous provider outcomes. No automatic retries.
const CAP = 0.24; // per network: posts <= .06, comments <= .18
const TTL = 2 * 60 * 60 * 1000;
async function budgetFileLock(path: string) {
  // Two networks may reserve concurrently. Wait only for the local critical
  // section, never retry a paid provider call or remove another process's lock.
  for (let attempt = 0; attempt < 10; attempt++) {
    try { return await open(path, 'wx'); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw new Error('Budget reservation busy');
}
export function socialProfile(raw: string): { network: 'instagram' | 'facebook'; url: string; handle: string } | null {
  const u = new URL(raw), host = u.hostname.replace(/^www\./, '');
  if (!['instagram.com', 'facebook.com'].includes(host)) return null;
  const handle = u.pathname.replace(/^\/|\/$/g, '');
  if (u.protocol !== 'https:' || u.search || u.hash || u.username || u.password || u.port || !/^[a-zA-Z0-9._-]{1,100}$/.test(handle)
    || ['p','reel','reels','posts','groups','login','share','profile.php'].includes(handle)) throw new Error('Use a public business profile URL');
  return { network: host === 'instagram.com' ? 'instagram' : 'facebook', url: `https://www.${host}/${handle}/`, handle };
}
type Row = Record<string, unknown>;
type Run = { id: string; status: string; defaultDatasetId: string; usageTotalUsd?: number };
function id(value: unknown): string { if (typeof value !== 'string' || !/^[a-zA-Z0-9]{10,40}$/.test(value)) throw new Error('Invalid provider ID'); return value; }
function postUrl(value: unknown, network: string): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || ![`${network}.com`, `www.${network}.com`].includes(u.hostname)) return null;
    if (!/(?:\/(?:p|reel|reels|posts|videos)\/[^/]+|\/photo\/?$|\/permalink\.php$)/.test(u.pathname)) return null;
    // Only content-identifying parameters; remove tracking, signed media and tokens.
    for (const key of [...u.searchParams.keys()]) if (!['story_fbid','id','fbid','comment_id','reply_comment_id'].includes(key)) u.searchParams.delete(key);
    u.hash = ''; return u.href;
  } catch { return null; }
}
export function socialRecords(rows: unknown, network: string, type: 'post' | 'comment', run: Run, allowedParents: string[] = []): PublicSource[] {
  if (!Array.isArray(rows)) throw new Error('Invalid dataset');
  const unique = new Set<string>();
  return rows.slice(0, type === 'post' ? 10 : 50).flatMap((row: Row) => {
    if (!row || typeof row !== 'object' || row.error) return [];
    const text = row.caption ?? row.text;
    const url = postUrl(row.url ?? row.postUrl, network);
    if (!url || typeof text !== 'string' || !text.trim()) return [];
    if (type === 'comment') {
      const parent = postUrl(row.postUrl ?? row.inputUrl ?? row.facebookUrl ?? row.url, network);
      if (!parent || !allowedParents.some((p) => new URL(p).pathname.replace(/\/$/,'') === new URL(parent).pathname.replace(/\/$/,''))) return [];
    }
    const excerpt = text.trim().slice(0, type === 'post' ? 1200 : 600);
    const key = url + excerpt;
    if (unique.has(key)) return []; unique.add(key);
    return [{ id: '', url, checkedAt: new Date().toISOString(), status: 'read' as const, title: type, excerpt,
      provider: 'apify' as const, recordType: type, runId: id(run.id), datasetId: id(run.defaultDatasetId), verification: 'provider_only' as const }];
  });
}
async function api(path: string, method = 'GET', body?: unknown) {
  const response = await fetch(`https://api.apify.com/v2/${path}`, {
    method, headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30_000), cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Social provider unavailable (${response.status})`);
  return response.json();
}
async function runActor(actor: string, input: unknown, cap: number, receipt: (r: Run) => Promise<void>) {
  let run: Run = (await api(`acts/apify~${actor}/runs?maxTotalChargeUsd=${cap}&timeout=50`, 'POST', input)).data;
  id(run.id); id(run.defaultDatasetId); await receipt(run);
  const until = Date.now() + 60_000;
  while (['READY','RUNNING'].includes(run.status) && Date.now() < until) {
    run = (await api(`actor-runs/${id(run.id)}?waitForFinish=20`)).data;
  }
  await receipt(run);
  if (run.status !== 'SUCCEEDED') throw new Error('Social collection incomplete');
  const rows = await api(`datasets/${id(run.defaultDatasetId)}/items?clean=true&limit=50`);
  return { run, rows };
}
export async function scanSocial(raw: string): Promise<PublicSource[]> {
  const profile = socialProfile(raw);
  if (!profile) throw new Error('Unsupported network');
  const root = process.env.AUDIT_SOURCE_STORE;
  if (!process.env.APIFY_TOKEN || !root || !isAbsolute(root)) throw new Error('Social collection is not configured');
  await mkdir(root, { recursive: true });
  const hash = createHash('sha256').update(profile.url).digest('hex');
  const cache = join(root, `cache-${hash}.json`);
  try { const saved = JSON.parse(await readFile(cache, 'utf8')); if (Date.now() - saved.at < TTL) return saved.sources; } catch { /* cache miss */ }
  // Lock per profile prevents double-clicks, concurrent replicas and uncertain retries.
  const lock = await open(join(root, `lock-${hash}`), 'wx');
  await lock.close();
  let started = false;
  try {
    const day = new Date().toISOString().slice(0,10);
    const budgetLock = await budgetFileLock(join(root, 'budget.lock'));
    try {
      const file = join(root, `budget-${day}.json`);
      let spent = 0;
      try { spent = JSON.parse(await readFile(file, 'utf8')).reserved; } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
      const configured = Number(process.env.AUDIT_SOCIAL_DAILY_USD || 1);
      const limit = Number.isFinite(configured) ? Math.min(5, Math.max(0, configured)) : 0;
      if (!Number.isFinite(spent) || spent + CAP > limit) throw new Error('Daily social budget reached');
      await writeFile(file, JSON.stringify({ reserved: spent + CAP }), { mode: 0o600 });
    } finally { await budgetLock.close(); await unlink(join(root, 'budget.lock')); }
    started = true;
    const receiptId = `${Date.now()}-${hash.slice(0,16)}`;
    const runs: Run[] = [];
    const saveRun = async (run: Run) => {
      const i = runs.findIndex((r) => r.id === run.id);
      const safe = { id: id(run.id), status: run.status, defaultDatasetId: id(run.defaultDatasetId), usageTotalUsd: run.usageTotalUsd };
      if (i < 0) runs.push(safe); else runs[i] = safe;
      await writeFile(join(root, `receipt-${receiptId}.json`), JSON.stringify({ profile: profile.url, runs }), { mode: 0o600 });
    };
    const instagram = profile.network === 'instagram';
    const posts = await runActor(instagram ? 'instagram-scraper' : 'facebook-posts-scraper', instagram
      ? { directUrls: [profile.url], resultsType: 'posts', resultsLimit: 10 }
      : { startUrls: [{url: profile.url}], resultsLimit: 10, captionText: false }, .06, saveRun);
    let sources = socialRecords(posts.rows, profile.network, 'post', posts.run);
    // Only returned, validated post URLs; no model chooses crawl targets.
    const parents = [...new Set(sources.map((s) => s.url))].slice(0, 10);
    if (parents.length) {
      try {
        const comments = await runActor(instagram ? 'instagram-comment-scraper' : 'facebook-comments-scraper', instagram
          ? { directUrls: parents, resultsLimit: 5, includeNestedComments: false }
          : { startUrls: parents.map((url) => ({url})), resultsLimit: 5, includeNestedComments: false }, .18, saveRun);
        sources = [...sources, ...socialRecords(comments.rows, profile.network, 'comment', comments.run, parents)];
        if (Array.isArray(comments.rows) && comments.rows.some((row) => row?.error)) sources.push({id:'',url:profile.url,checkedAt:new Date().toISOString(),status:'unavailable',title:'Some comment sources returned no readable items',excerpt:''});
      } catch { sources.push({ id:'',url:profile.url,checkedAt:new Date().toISOString(),status:'unavailable',title:'Comments unavailable',excerpt:'' }); }
    }
    if (!sources.length) sources.push({id:'',url:profile.url,checkedAt:new Date().toISOString(),status:'unavailable',title:'No readable publications returned',excerpt:''});
    sources = sources.map((s) => ({...s,receiptId}));
    await writeFile(join(root, `evidence-${receiptId}.json`), JSON.stringify({ profile:profile.url,runs,sources }), { mode:0o600 });
    await writeFile(cache, JSON.stringify({at:Date.now(),sources}), {mode:0o600});
    await unlink(join(root, `lock-${hash}`));
    return sources;
  } catch (error) {
    // Once a request might have reached Apify, retain the lock for operator review.
    if (!started) await unlink(join(root, `lock-${hash}`));
    throw error;
  }
}
