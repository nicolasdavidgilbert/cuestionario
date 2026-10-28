import type { APIRoute } from 'astro'
import * as Sentry from '@sentry/astro'
import { getSql } from '../../../lib/server/db'
import { errorResponse, hasValidAdminApiKey, jsonResponse, noStore, publicCache, readOwnerToken } from '../../../lib/server/http'
import { rateLimit } from '../../../lib/server/rateLimit'
import { ServiceError } from '../../../lib/server/errors'
import { trashQuiz, updateQuiz } from '../../../lib/server/quizService'

export const prerender = false

function failure(label: string, error: unknown) {
  if (!(error instanceof ServiceError)) {
    console.error(`${label}:`, error)
    Sentry.captureException(error)
  }
  return noStore(errorResponse(label, error))
}

export const GET: APIRoute = async ({ params, request }) => {
  try {
    const sql = getSql()
    const id = Number(params.id)
    
    if (!Number.isInteger(id)) {
      return jsonResponse({ message: 'ID inválido' }, 400)
    }
    
    const ownerToken = readOwnerToken(request)
    const rows = await sql`
      SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at,
        (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete
      FROM user_quizzes
      WHERE id = ${id} AND deleted_at IS NULL
    `
    
    if (rows.length === 0) {
      return jsonResponse({ message: 'Cuestionario no encontrado' }, 404)
    }
    
    // Con token de propietario la respuesta es personal (can_delete) y no se cachea.
    const response = jsonResponse(rows[0])
    return ownerToken ? noStore(response) : publicCache(response)
  } catch (error) {
    return failure('Error al obtener cuestionario', error)
  }
}

// Edición por su propietario: título, descripción y preguntas. Exige la versión cargada
// para detectar cambios concurrentes (409) en lugar de sobrescribirlos.
export const PATCH: APIRoute = async ({ params, request }) => {
  try {
    const limitError = await rateLimit(request, { key: 'update-quiz', limit: 60, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const body = await request.json().catch(() => ({}))
    const quiz = await updateQuiz(Number(params.id), {
      expectedVersion: body?.version,
      changes: { title: body?.title, description: body?.description, questions: body?.questions },
      actor: 'public',
      ownerToken: readOwnerToken(request)
    })
    return noStore(jsonResponse({ ...quiz, can_delete: true }))
  } catch (error) {
    return failure('Error al actualizar cuestionario', error)
  }
}

// Envío a la papelera por su propietario, o desde scripts con la clave técnica.
export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const limitError = await rateLimit(request, { key: 'delete-quiz', limit: 30, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const viaApiKey = hasValidAdminApiKey(request)
    await trashQuiz(Number(params.id), {
      actor: viaApiKey ? 'script' : 'public',
      ownerToken: readOwnerToken(request)
    })
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return failure('Error al eliminar cuestionario', error)
  }
}
