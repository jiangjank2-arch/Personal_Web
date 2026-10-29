import type { AdminEnv } from './env.ts';
import { requireEnv } from './env.ts';
import { apiError, HttpError } from './respond.ts';

const COOKIE_NAME = 'admin_session';
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function base64url(bytes: ArrayBuffer): string {
  let binary = '';
  const view = new Uint8Array(bytes);
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function hmac(secret: string, message: string): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
}

/** 恒定时间比较，避免通过响应时间侧信道猜测密码。 */
export async function safeEqual(a: string, b: string): Promise<boolean> {
  const [da, db] = await Promise.all([hmac(a, 'compare'), hmac(b, 'compare')]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = va.length === vb.length ? 0 : 1;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ (vb[i] ?? 0);
  return diff === 0;
}

async function signSession(secret: string): Promise<string> {
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS);
  return `${expiry}.${base64url(await hmac(secret, `admin-session:${expiry}`))}`;
}

async function verifySession(token: string | undefined, secret: string): Promise<boolean> {
  if (!token) return false;
  const [expiryText, signature] = token.split('.');
  const expiry = Number(expiryText);
  if (!expiryText || !signature || !Number.isFinite(expiry) || expiry * 1000 <= Date.now()) return false;
  const expected = base64url(await hmac(secret, `admin-session:${expiryText}`));
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('Cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function createSessionCookie(request: Request, env: AdminEnv): Promise<string> {
  const { ADMIN_SECRET } = requireEnv(env);
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const token = await signSession(ADMIN_SECRET);
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}${secure}`;
}

export function expiredSessionCookie(request: Request): string {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`;
}

export async function requireAdmin(request: Request, env: AdminEnv): Promise<true | Response> {
  const { ADMIN_SECRET } = requireEnv(env);
  const token = readCookie(request, COOKIE_NAME);
  if (await verifySession(token, ADMIN_SECRET)) return true;
  return apiError(401, '登录已失效，请重新登录。');
}

/** 写操作要求自定义请求头，配合 SameSite=Strict 防止跨站表单 CSRF。 */
export function requireJsonWrite(request: Request): void {
  if (request.headers.get('X-Admin-Request') !== '1') {
    throw new HttpError(403, '缺少 X-Admin-Request 请求头。');
  }
}
