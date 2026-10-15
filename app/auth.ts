// Identidade do usuário via Cloudflare Access.
// O Access fica na frente do site e envia um JWT assinado em `Cf-Access-Jwt-Assertion`.
// Aqui o token é verificado (assinatura RS256, emissor, audiência e validade) antes de
// confiar no e-mail. Cabeçalhos sem JWT válido são ignorados, mesmo que alguém os forje.
import {env} from 'cloudflare:workers';
import {headers} from 'next/headers';

export type AppUser = {userId: string; displayName: string; email: string; fullName: string | null};

type AccessEnv = {CF_ACCESS_TEAM_DOMAIN?: string; CF_ACCESS_AUD?: string; ORIGYN_DEV_USER_EMAIL?: string};
type Jwk = JsonWebKey & {kid?: string};

let certCache: {domain: string; keys: Jwk[]; fetchedAt: number} | null = null;

function b64urlToBytes(value: string) {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

async function accessKeys(domain: string, force = false) {
  if (!force && certCache && certCache.domain === domain && Date.now() - certCache.fetchedAt < 3600_000) return certCache.keys;
  const response = await fetch(`https://${domain}/cdn-cgi/access/certs`, {signal: AbortSignal.timeout(8000)});
  if (!response.ok) throw new Error('Access certs unavailable');
  const body = (await response.json()) as {keys?: Jwk[]};
  certCache = {domain, keys: body.keys || [], fetchedAt: Date.now()};
  return certCache.keys;
}

export async function verifyAccessJwt(token: string, domain: string, aud: string): Promise<{email: string; sub: string} | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header: {alg?: string; kid?: string}, payload: {email?: string; sub?: string; aud?: string | string[]; iss?: string; exp?: number; nbf?: number};
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
  } catch {
    return null;
  }
  if (header.alg !== 'RS256' || !header.kid) return null;
  let jwk = (await accessKeys(domain)).find(k => k.kid === header.kid);
  if (!jwk) jwk = (await accessKeys(domain, true)).find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, {name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256'}, false, ['verify']);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
  if (!valid) return null;
  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (payload.iss !== `https://${domain}` || !audiences.includes(aud)) return null;
  if (typeof payload.exp !== 'number' || payload.exp < now - 30) return null;
  if (typeof payload.nbf === 'number' && payload.nbf > now + 30) return null;
  if (!payload.email || !payload.sub) return null;
  return {email: payload.email, sub: payload.sub};
}

export async function getUser(): Promise<AppUser | null> {
  const e = env as unknown as AccessEnv;
  const h = await headers();
  // Desenvolvimento local apenas: nunca configure esta variável em produção.
  if (e.ORIGYN_DEV_USER_EMAIL && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(h.get('host') || '')) {
    return {userId: 'dev:' + e.ORIGYN_DEV_USER_EMAIL, email: e.ORIGYN_DEV_USER_EMAIL, displayName: e.ORIGYN_DEV_USER_EMAIL, fullName: null};
  }
  const domain = (e.CF_ACCESS_TEAM_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const aud = e.CF_ACCESS_AUD || '';
  const token = h.get('cf-access-jwt-assertion');
  if (!domain || !aud || !token) return null;
  try {
    const claims = await verifyAccessJwt(token, domain, aud);
    if (!claims) return null;
    const email = claims.email.toLowerCase();
    return {userId: 'access:' + claims.sub, email, displayName: email, fullName: null};
  } catch {
    return null;
  }
}
