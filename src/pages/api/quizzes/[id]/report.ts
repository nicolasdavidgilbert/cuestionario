import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'
import { getDatabaseUrl } from '../../../../lib/server/env'
import { jsonResponse, serverErrorResponse } from '../../../../lib/server/http'
import { rateLimit } from '../../../../lib/server/rateLimit'
import { logAudit } from '../../../../lib/server/audit'

export const prerender = false

function getSql() {
  return neon(getDatabaseUrl())
}

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const limitError = rateLimit(request, { key: 'report-quiz', limit: 10, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const id = Number(params.id)
    if (isNaN(id)) return jsonResponse({ message: 'ID inválido' }, 400)

    const body = await request.json().catch(() => ({}))
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

    if (!reason) {
      return jsonResponse({ message: 'Indica el motivo del reporte' }, 400)
    }

    const sql = getSql()
    const existing = await sql`SELECT id FROM user_quizzes WHERE id = ${id} AND deleted_at IS NULL`
    if (existing.length === 0) return jsonResponse({ message: 'Cuestionario no encontrado' }, 404)

    const rows = await sql`
      INSERT INTO quiz_reports (quiz_id, reason)
      VALUES (${id}, ${reason})
      RETURNING *
    `

    await logAudit(sql, 'quiz_reported', { quiz_id: id })
    return jsonResponse(rows[0], 201)
  } catch (error) {
    console.error('POST quiz report error:', error)
    return serverErrorResponse('Error al reportar cuestionario', error)
  }
}
