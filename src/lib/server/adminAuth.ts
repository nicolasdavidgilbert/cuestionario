import type { AstroCookies } from 'astro'
import { randomBytes } from 'node:crypto'
import { getDb } from './db'
import { getAdminPasswordHash, isProduction } from './env'
import { isPasswordHash, verifyPassword } from './password'
import { ADMIN_SESSION_TTL_MS, createSessionToken, getSessionCookieName, sessionIdFromToken } from './adminSecurity'

export interface AdminSession {
  id: string
  csrfToken: string
  expiresAt: string
}

// El panel solo está disponible con un hash de contraseña válido configurado.
export function isAdminConfigured(): boolean {
  return isPasswordHash(getAdminPasswordHash())
}

export function sessionCookieName(): string {
  return getSessionCookieName(isProduction())
}

export async function checkAdminPassword(password: string): Promise<boolean> {
  if (!isAdminConfigured() || typeof password !== 'string' || password.length === 0 || password.length > 512) return false
  return verifyPassword(password, getAdminPasswordHash())
}

export async function createAdminSession(cookies: AstroCookies, meta: { ip: string; userAgent: string }): Promise<AdminSession> {
  const token = createSessionToken()
  const id = sessionIdFromToken(token, getAdminPasswordHash())
  const csrfToken = randomBytes(24).toString('base64url')
  const expiresAt = new Date(Date.now() + ADMIN_SESSION_TTL_MS)

  await getDb().query(
    `INSERT INTO admin_sessions (id, csrf_token, expires_at, ip, user_agent, last_seen_at)
     VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, csrfToken, expiresAt.toISOString(), meta.ip.slice(0, 64), meta.userAgent.slice(0, 300)]
  )

  cookies.set(sessionCookieName(), token, {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    secure: isProduction(),
    expires: expiresAt
  })

  return { id, csrfToken, expiresAt: expiresAt.toISOString() }
}

export async function getAdminSession(cookies: AstroCookies): Promise<AdminSession | null> {
  const token = cookies.get(sessionCookieName())?.value || ''
  if (!token || token.length > 200 || !isAdminConfigured()) return null

  const rows = await getDb().query<{ id: string; csrf_token: string; expires_at: string }>(
    `UPDATE admin_sessions SET last_seen_at = NOW()
     WHERE id = $1 AND revoked_at IS NULL AND expires_at > NOW()
     RETURNING id, csrf_token, expires_at`,
    [sessionIdFromToken(token, getAdminPasswordHash())]
  )
  if (rows.length === 0) return null
  return { id: rows[0].id, csrfToken: rows[0].csrf_token, expiresAt: new Date(rows[0].expires_at).toISOString() }
}

export async function revokeAdminSession(cookies: AstroCookies, sessionId: string) {
  await getDb().query('UPDATE admin_sessions SET revoked_at = NOW() WHERE id = $1 AND revoked_at IS NULL', [sessionId])
  cookies.delete(sessionCookieName(), { path: '/' })
}

// Cierra todas las sesiones abiertas (por ejemplo, tras cambiar la contraseña).
export async function revokeAllAdminSessions() {
  const rows = await getDb().query('UPDATE admin_sessions SET revoked_at = NOW() WHERE revoked_at IS NULL AND expires_at > NOW() RETURNING id')
  return rows.length
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  return forwardedFor.split(',')[0]?.trim() || request.headers.get('x-real-ip')?.trim() || 'unknown'
}
