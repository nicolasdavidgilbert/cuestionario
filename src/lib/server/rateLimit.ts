import * as Sentry from '@sentry/astro'
import { neon } from '@neondatabase/serverless'
import { jsonResponse } from './http'
import { getDatabaseUrl } from './env'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
  // Si no se puede comprobar el límite: false deja pasar (rutas públicas), true rechaza (acceso al panel).
  failClosed?: boolean
}

function shouldCleanupExpiredRows() {
  return Math.random() < 0.05
}

function bucketKeyFor(request: Request, key: string) {
  const forwardedFor = request.headers.get('x-forwarded-for') || ''
  const realIp = request.headers.get('x-real-ip') || ''
  const clientIp = forwardedFor.split(',')[0]?.trim() || realIp.trim() || 'unknown'
  return `${key}:${clientIp}`
}

export async function rateLimit(request: Request, options: RateLimitOptions): Promise<Response | null> {
  try {
    const sql = neon(getDatabaseUrl())
    const bucketKey = bucketKeyFor(request, options.key)
    const cutoff = new Date(Date.now() - options.windowMs).toISOString()

    if (shouldCleanupExpiredRows()) {
      await sql`DELETE FROM rate_limits WHERE created_at < ${cutoff}::timestamptz`
    }

    // Comprobar y registrar es una sola operación: el bloqueo por clave serializa las peticiones
    // simultáneas del mismo cliente y la fila solo se inserta si queda hueco (insertada = permitida).
    const [, inserted] = await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(hashtext(${bucketKey}))`,
      sql`INSERT INTO rate_limits (bucket_key)
          SELECT ${bucketKey}
          WHERE (SELECT COUNT(*) FROM rate_limits WHERE bucket_key = ${bucketKey} AND created_at > ${cutoff}::timestamptz) < ${options.limit}
          RETURNING id`
    ])

    if (inserted.length === 0) {
      return jsonResponse({ message: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }, 429)
    }

    return null
  } catch (error) {
    console.error('Rate limit error:', error)
    Sentry.captureException(error, {
      tags: { feature: 'rate-limit', fail_open: String(!options.failClosed) },
      fingerprint: ['rate-limit', options.failClosed ? 'fail-closed' : 'fail-open'],
    })
    return options.failClosed
      ? jsonResponse({ message: 'No se puede comprobar el límite de intentos. Inténtalo de nuevo en unos minutos.' }, 503)
      : null
  }
}

// Tras un acceso correcto los intentos previos dejan de contar.
export async function clearRateLimit(request: Request, key: string): Promise<void> {
  try {
    const sql = neon(getDatabaseUrl())
    await sql`DELETE FROM rate_limits WHERE bucket_key = ${bucketKeyFor(request, key)}`
  } catch (error) {
    console.error('Rate limit clear error:', error)
  }
}
