import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { request as httpRequest } from 'node:http';
import type { PublicSource } from './audit-public-sources.ts';

const AGENT = 'aiAUDITBot';
export function publicUrl(raw: string): URL {
  const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port
    || isIP(url.hostname.replace(/^\[|\]$/g, '')) || !url.hostname.includes('.')
    || /(?:^|\.)(?:localhost|local|internal|test|invalid)$/i.test(url.hostname)
    || url.search || url.href.length > 600) throw new Error('Unsupported public URL');
  url.hash = ''; return url;
}
export function publicIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false;
  const [a, b, c] = ip.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99)))
    || (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100)))
    || (a === 203 && b === 0 && c === 113));
}

// Resolve and pin the validated address to the actual connection. Redirects get
// a fresh validation; no credentials, cookies, JS execution or proxy inheritance.
async function download(url: URL, signal: AbortSignal): Promise<{ status: number; location?: string; type: string; text: string }> {
  signal.throwIfAborted();
  const addresses = await Promise.race([
    lookup(url.hostname, { all: true, family: 4 }).then((items) => items.map((item) => item.address)),
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error('DNS timeout')), 3000);
      timer.unref();
    }),
  ]);
  if (!addresses.length || addresses.some((ip) => !publicIPv4(ip))) throw new Error('Address blocked');
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const transport = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = transport(url, {
      signal, agent: false, family: 4,
      lookup: (_host, _options, callback) => callback(null, addresses[0], 4),
      headers: { 'User-Agent': `${AGENT}/1.0 (+https://aiaudit.ge)`, Accept: 'text/html,text/plain;q=0.8', 'Accept-Encoding': 'identity' },
    }, (res) => {
      const status = res.statusCode || 0;
      const type = String(res.headers['content-type'] || '');
      if (status >= 300 && status < 400) { res.destroy(); resolve({ status, location: res.headers.location, type, text: '' }); return; }
      if (status !== 200) { res.destroy(); resolve({ status, type, text: '' }); return; }
      if (!/^(?:text\/html|text\/plain|application\/xhtml\+xml)/i.test(type)
        || Number(res.headers['content-length'] || 0) > 1_000_000
        || (res.headers['content-encoding'] && res.headers['content-encoding'] !== 'identity')) {
        res.destroy(); reject(new Error('Page unavailable')); return;
      }
      let bytes = 0; const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 1_000_000) { res.destroy(new Error('Page too large')); return; }
        chunks.push(chunk);
      });
      res.on('error', reject);
      res.on('end', () => resolve({ status, type, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject); req.end();
  });
}

export function robotsAllowed(text: string, path: string): boolean {
  if (text.length > 64_000) return false;
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }> }> = [];
  let group = { agents: [] as string[], rules: [] as Array<{ allow: boolean; path: string }> };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split('#')[0].trim(), colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).trim().toLowerCase(), value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      if (group.rules.length) { groups.push(group); group = { agents: [], rules: [] }; }
      group.agents.push(value.toLowerCase());
    } else if (['allow', 'disallow'].includes(key) && group.agents.length && value) {
      if (value.length > 500 || (value.match(/\*/g) || []).length > 3) return false;
      group.rules.push({ allow: key === 'allow', path: value });
    }
  }
  groups.push(group);
  const specific = groups.filter((g) => g.agents.includes(AGENT.toLowerCase()));
  const selected = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const matches = selected.flatMap((g) => g.rules).filter((r) => {
    const pattern = r.path.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$/, '$');
    return new RegExp('^' + pattern).test(path);
  }).sort((a, b) => b.path.length - a.path.length || Number(b.allow) - Number(a.allow));
  return matches[0]?.allow ?? true;
}

function decode(text: string): string {
  return text.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos|nbsp);/gi, (whole, number, name) => {
    if (number) { const n = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number); return n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : ''; }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' } as Record<string, string>)[name.toLowerCase()] || whole;
  }).replace(/[\u200b-\u200f\u2060\ufeff]/gu, '').replace(/\s+/g, ' ').trim();
}
export function pageText(html: string): { title: string; excerpt: string } {
  // Quotes refer to this normalized HTML text, not a rendered-page/visibility claim.
  const clean = html.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(script|style|noscript|template|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, ' ');
  const title = decode(clean.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '').slice(0, 180);
  const excerpt = decode(clean.replace(/<[^>]*>/g, ' ')).slice(0, 9000);
  return { title, excerpt };
}
export function relatedPages(html: string, base: URL): string[] {
  const links: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi)) {
    try {
      const url = publicUrl(new URL(decode(match[1]), base).href);
      if (url.origin === base.origin && url.pathname !== base.pathname
        && /(?:about|services|products|contact|ჩვენ|მომსახურ|კონტაქტ)/iu.test(decodeURIComponent(url.pathname))) links.push(url.href);
    } catch { /* Unsupported links are not followed. */ }
  }
  return [...new Set(links)].slice(0, 2);
}

export async function scanPage(raw: string, id: string, signal: AbortSignal): Promise<{ source: PublicSource; related: string[] }> {
  let url = publicUrl(raw);
  const source: PublicSource = { id, url: url.href, checkedAt: new Date().toISOString(), status: 'unavailable', title: '', excerpt: '' };
  try {
    for (let redirects = 0; redirects <= 3; redirects++) {
      const localSignal = AbortSignal.any([signal, AbortSignal.timeout(8000)]);
      // Fail closed when robots cannot be read, except an explicit absent file.
      let robotText = '';
      try {
        const robots = await download(new URL('/robots.txt', url), localSignal);
        if (![200, 404, 410].includes(robots.status)) { source.status = robots.status === 403 ? 'restricted' : 'unavailable'; return { source, related: [] }; }
        robotText = robots.text;
      } catch { return { source, related: [] }; }
      if (!robotsAllowed(robotText, url.pathname)) { source.status = 'restricted'; return { source, related: [] }; }
      const page = await download(url, localSignal);
      if (page.location && page.status >= 300 && page.status < 400) {
        url = publicUrl(new URL(page.location, url).href); continue;
      }
      if (page.status !== 200) return { source, related: [] };
      const content = pageText(page.text);
      if (content.excerpt.length < 100 || /just a moment|verify you are human|access denied|log in to (?:instagram|facebook)|enable javascript/i.test(content.excerpt.slice(0, 500))) return { source, related: [] };
      return { source: { ...source, ...content, url: url.href, status: 'read' }, related: relatedPages(page.text, url) };
    }
  } catch { /* Never expose network internals or pretend an inaccessible page was read. */ }
  return { source, related: [] };
}
