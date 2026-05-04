import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'
import { getDatabaseUrl } from '../../../lib/server/env'
import { jsonResponse, requireAdminApiKey, serverErrorResponse } from '../../../lib/server/http'

export const prerender = false

function getSql() {
  return neon(getDatabaseUrl())
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const authError = requireAdminApiKey(request)
    if (authError) return authError

    const sql = getSql()
    const quizzes = await sql`SELECT * FROM user_quizzes ORDER BY created_at DESC`
    const reports = await sql`SELECT * FROM quiz_reports ORDER BY created_at DESC`
    const auditLogs = await sql`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 1000`

    return jsonResponse({
      exported_at: new Date().toISOString(),
      quizzes,
      reports,
      audit_logs: auditLogs
    })
  } catch (error) {
    console.error('GET admin export error:', error)
    return serverErrorResponse('Error al exportar datos', error)
  }
}
