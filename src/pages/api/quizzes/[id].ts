import type { APIRoute } from 'astro'
import * as Sentry from '@sentry/astro'
import { neon } from '@neondatabase/serverless'
import { getAdminApiKey, getDatabaseUrl } from '../../../lib/server/env'
import { jsonResponse, serverErrorResponse } from '../../../lib/server/http'
import { rateLimit } from '../../../lib/server/rateLimit'
import { logAudit } from '../../../lib/server/audit'
import { getQuizHash } from '../../../lib/server/hash'
import { validateQuizJson } from '../../../lib/quizValidator'

export const prerender = false

function applyReadCacheHeaders(response: Response, hasOwnerToken: boolean) {
  response.headers.set(
    'Cache-Control',
    hasOwnerToken ? 'no-store' : 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
  )
  return response
}

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
    
    return applyReadCacheHeaders(jsonResponse(rows[0]), Boolean(ownerToken))
  } catch (error) {
    console.error('GET quiz error:', error)
    Sentry.captureException(error)
    return serverErrorResponse('Error al obtener cuestionario', error)
  }
}

export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const limitError = await rateLimit(request, { key: 'update-quiz', limit: 60, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const sql = getSql()
    const id = Number(params.id)

    if (isNaN(id)) {
      return jsonResponse({ message: 'ID inválido' }, 400)
    }

    const existing = await sql`
      SELECT id, title, description, grado, course_id, unidad, questions, owner_token
      FROM user_quizzes WHERE id = ${id} AND deleted_at IS NULL
    `

    if (existing.length === 0) {
      return jsonResponse({ message: 'Cuestionario no encontrado' }, 404)
    }

    const ownerToken = request.headers.get('x-owner-token') || ''
    const isOwner = existing[0].owner_token && existing[0].owner_token === ownerToken
    if (!isOwner) return jsonResponse({ message: 'No autorizado' }, 401)

    const body = await request.json()
    const current = existing[0]
    // Solo se editan título, descripción y preguntas; grado, curso y unidad definen la URL pública.
    const validation = validateQuizJson({
      title: body.title ?? current.title,
      description: body.description ?? current.description,
      grado: current.grado,
      course_id: current.course_id,
      unidad: current.unidad,
      questions: body.questions ?? current.questions
    })

    if (!validation.valid || !validation.data) {
      return jsonResponse({ message: validation.errors.map((error) => error.message).join('\n') }, 400)
    }

    const { title, description, questions } = validation.data
    const quizHash = getQuizHash({ title, grado: current.grado, course_id: current.course_id, unidad: current.unidad, questions })

    const duplicateRows = await sql`
      SELECT id FROM user_quizzes
      WHERE deleted_at IS NULL AND quiz_hash = ${quizHash} AND id <> ${id}
      LIMIT 1
    `

    if (duplicateRows.length > 0) {
      return jsonResponse({ message: 'Ya existe otro cuestionario idéntico', id: duplicateRows[0].id }, 409)
    }

    const rows = await sql`
      UPDATE user_quizzes
      SET title = ${title || ''}, description = ${description || ''}, questions = ${JSON.stringify(questions)}, quiz_hash = ${quizHash}
      WHERE id = ${id}
      RETURNING id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, true AS can_delete
    `
    await logAudit(sql, 'quiz_updated', { quiz_id: id })

    return jsonResponse(rows[0])
  } catch (error) {
    console.error('PATCH quiz error:', error)
    Sentry.captureException(error)
    return serverErrorResponse('Error al actualizar cuestionario', error)
  }
}

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const limitError = await rateLimit(request, { key: 'delete-quiz', limit: 30, windowMs: 60 * 60 * 1000 })
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
    Sentry.captureException(error)
    return serverErrorResponse('Error al eliminar cuestionario', error)
  }
}
