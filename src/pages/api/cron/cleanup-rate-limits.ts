import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'
import { getDatabaseUrl } from '../../../lib/server/env'

export const prerender = false

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get('authorization') || ''
  const cronSecret = import.meta.env.CRON_SECRET?.trim() || ''
  if (!cronSecret || authHeader !== 'Bearer ' + cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const sql = neon(getDatabaseUrl())

  await sql`
    DELETE FROM rate_limits
    WHERE created_at < now() - interval '1 hour'
  `

  return Response.json({ ok: true })
}


