import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'
import { getAdminApiKey, getDatabaseUrl } from '../../../lib/server/env'
import { jsonResponse, serverErrorResponse } from '../../../lib/server/http'
import { rateLimit } from '../../../lib/server/rateLimit'
import { logAudit } from '../../../lib/server/audit'

export const prerender = false

function getSql() {
  return neon(getDatabaseUrl())
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const sql = getSql()
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return jsonResponse({ message: 'ID inválido' }, 400)
    }
    
    const ownerToken = request.headers.get('x-owner-token')?.trim().slice(0, 120) || ''
    const rows = await sql`
      SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at,
        (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete
      FROM user_quizzes
      WHERE id = ${id} AND deleted_at IS NULL
    `
    
    if (rows.length === 0) {
      return jsonResponse({ message: 'Cuestionario no encontrado' }, 404)
    }
    
    return jsonResponse(rows[0])
  } catch (error) {
    console.error('GET quiz error:', error)
    return serverErrorResponse('Error al obtener cuestionario', error)
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const limitError = rateLimit(request, { key: 'delete-quiz', limit: 30, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const sql = getSql()
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return jsonResponse({ message: 'ID inválido' }, 400)
    }
    
    const existing = await sql`SELECT id, owner_token FROM user_quizzes WHERE id = ${id} AND deleted_at IS NULL`

    if (existing.length === 0) {
      return jsonResponse({ message: 'Cuestionario no encontrado' }, 404)
    }

    const adminApiKey = getAdminApiKey()
    const ownerToken = request.headers.get('x-owner-token') || ''
    const isOwner = existing[0].owner_token && existing[0].owner_token === ownerToken
    const isAdmin = adminApiKey && request.headers.get('x-admin-api-key') === adminApiKey

    if (!isOwner && !isAdmin) return jsonResponse({ message: 'No autorizado' }, 401)

    await sql`UPDATE user_quizzes SET deleted_at = NOW() WHERE id = ${id}`
    await logAudit(sql, 'quiz_soft_deleted', { quiz_id: id, by_owner: isOwner })
    
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE quiz error:', error)
    return serverErrorResponse('Error al eliminar cuestionario', error)
  }
}
