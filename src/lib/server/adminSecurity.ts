import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// Reglas de acceso al panel que no dependen de la base de datos ni de Astro (testeadas aparte).

export const ADMIN_SESSION_TTL_MS = 8 * 60 * 60 * 1000

export const ADMIN_PUBLIC_PATHS = new Set(['/admin/login', '/api/admin/login'])

export function getSessionCookieName(secure: boolean): string {
  // El prefijo __Host- exige Secure, así que en local (http) se usa un nombre sin prefijo.
  return secure ? '__Host-admin_session' : 'admin_session'
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

// En la base de datos solo se guarda un HMAC del token: una fuga de la tabla no da sesiones válidas.
// La clave es el hash de la contraseña, así que al cambiarla ninguna sesión anterior vuelve a coincidir.
export function sessionIdFromToken(token: string, passwordHash: string): string {
  return createHmac('sha256', passwordHash).update(token).digest('hex')
}

export function isAdminPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
    || pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

export function isAdminPublicPath(pathname: string): boolean {
  return ADMIN_PUBLIC_PATHS.has(pathname.replace(/\/+$/, ''))
}

export function isWriteMethod(method: string): boolean {
  return !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())
}

// Las escrituras solo se aceptan desde el propio sitio: Origin igual al de la petición
// o, si el navegador no lo envía, Sec-Fetch-Site same-origin.
export function isSameOriginRequest(request: Request): boolean {
  const expected = new URL(request.url).origin
  const origin = request.headers.get('origin')
  if (origin) return origin === expected

  return request.headers.get('sec-fetch-site') === 'same-origin'
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(String(a || ''))
  const right = Buffer.from(String(b || ''))
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right)
}

const SECRET_KEY = /^(owner_token|password|password_hash|session|session_id|csrf|csrf_token|token|api_key|admin_api_key)$/i

// Quita credenciales y tokens de cualquier objeto antes de auditarlo o exportarlo.
export function redactSecrets<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item)) as T
  if (!value || typeof value !== 'object' || value instanceof Date) return value

  const result: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (SECRET_KEY.test(key)) continue
    result[key] = redactSecrets(item)
  }
  return result as T
}
