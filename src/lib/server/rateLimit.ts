import { neon } from '@neondatabase/serverless'
import { jsonResponse } from './http'
import { getDatabaseUrl } from './env'

interface RateLimitOptions {
  key: string
  limit: number
  windowMs: number
}

function shouldCleanupExpiredRows() {
  return Math.random() < 0.05
}

export async function rateLimit(request: Request, options: RateLimitOptions): Promise<Response | null> {
  try {
    const sql = neon(getDatabaseUrl())
    const forwardedFor = request.headers.get('x-forwarded-for') || ''
    const realIp = request.headers.get('x-real-ip') || ''
    const clientIp = forwardedFor.split(',')[0]?.trim() || realIp.trim() || 'unknown'
    const bucketKey = `${options.key}:${clientIp}`
    const cutoff = new Date(Date.now() - options.windowMs).toISOString()

    if (shouldCleanupExpiredRows()) {
      await sql`DELETE FROM rate_limits WHERE created_at < ${cutoff}::timestamptz`
    }

    const rows = await sql`SELECT COUNT(*) as count FROM rate_limits WHERE bucket_key = ${bucketKey} AND created_at > ${cutoff}::timestamptz`
    const count = Number(rows?.[0]?.count || 0)

    if (count >= options.limit) {
      return jsonResponse({ message: 'Demasiadas peticiones. Inténtalo de nuevo más tarde.' }, 429)
    }

    await sql`INSERT INTO rate_limits (bucket_key) VALUES (${bucketKey})`

    return null
  } catch (error) {
    console.error('Rate limit error:', error)
    return null
  }
}
