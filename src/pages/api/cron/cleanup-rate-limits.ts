import type { APIRoute } from 'astro'
import * as Sentry from '@sentry/astro'
import { neon } from '@neondatabase/serverless'
import { getDatabaseUrl } from '../../../lib/server/env'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization') || ''
  const cronSecret = import.meta.env.CRON_SECRET?.trim() || ''
  if (!cronSecret || authHeader !== 'Bearer ' + cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  try {
    const sql = neon(getDatabaseUrl())

    await sql`
      DELETE FROM rate_limits
      WHERE created_at < now() - interval '1 hour'
    `

    // Sesiones de administración caducadas o cerradas hace más de 30 días (se conservan un tiempo para auditoría).
    await sql`
      DELETE FROM admin_sessions
      WHERE COALESCE(revoked_at, expires_at) < now() - interval '30 days'
    `

    return Response.json({ ok: true })
  } catch (error) {
    console.error('Cron cleanup rate limits error:', error)
    Sentry.captureException(error)
    return Response.json({ ok: false, error: 'Cleanup failed' }, { status: 500 })
  }
}


