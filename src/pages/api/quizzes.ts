import type { APIRoute } from 'astro'
import * as Sentry from '@sentry/astro'
import { normalizeSlug } from '../../lib/slug'
import { getSql } from '../../lib/server/db'
import { errorResponse, jsonResponse, noStore, publicCache, readOwnerToken } from '../../lib/server/http'
import { rateLimit } from '../../lib/server/rateLimit'
import { createQuiz } from '../../lib/server/quizService'
import { ServiceError } from '../../lib/server/errors'
import { getCatalog, gradeInfo, subjectInfo, topicInfo, type Catalog } from '../../lib/server/catalogService'

export const prerender = false

// Con token de propietario la respuesta es personal (can_delete) y no se cachea.
function applyReadCacheHeaders(response: Response, hasOwnerToken: boolean) {
  return hasOwnerToken ? noStore(response) : publicCache(response)
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const sql = getSql()
    const grado = normalizeSlug(url.searchParams.get('grado'))
    const type = url.searchParams.get('type')
    const q = String(url.searchParams.get('q') || '').trim()
    const owner = url.searchParams.get('owner')
    const ownerToken = readOwnerToken(request)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100)
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0)
    
    let rows
    let totalRows
    const search = `%${q}%`

    if (type === 'catalog') {
      if (grado) {
        rows = await sql`SELECT grado, course_id, unidad, title FROM user_quizzes WHERE deleted_at IS NULL AND grado = ${grado} ORDER BY created_at DESC`
      } else {
        rows = await sql`SELECT grado, course_id, unidad, title FROM user_quizzes WHERE deleted_at IS NULL ORDER BY created_at DESC`
      }
    } else if (owner === 'me' && ownerToken && q) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL
          AND owner_token = ${ownerToken}
          AND (title ILIKE ${search} OR description ILIKE ${search} OR grado ILIKE ${search} OR course_id ILIKE ${search} OR unidad ILIKE ${search})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`
        SELECT COUNT(*)::int AS count FROM user_quizzes
        WHERE deleted_at IS NULL
          AND owner_token = ${ownerToken}
          AND (title ILIKE ${search} OR description ILIKE ${search} OR grado ILIKE ${search} OR course_id ILIKE ${search} OR unidad ILIKE ${search})
      `
    } else if (owner === 'me' && ownerToken) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL AND owner_token = ${ownerToken}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE deleted_at IS NULL AND owner_token = ${ownerToken}`
    } else if (grado && q) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL
          AND grado = ${grado}
          AND (title ILIKE ${search} OR description ILIKE ${search} OR course_id ILIKE ${search} OR unidad ILIKE ${search})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`
        SELECT COUNT(*)::int AS count FROM user_quizzes
        WHERE deleted_at IS NULL
          AND grado = ${grado}
          AND (title ILIKE ${search} OR description ILIKE ${search} OR course_id ILIKE ${search} OR unidad ILIKE ${search})
      `
    } else if (grado) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL AND grado = ${grado}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE deleted_at IS NULL AND grado = ${grado}`
    } else if (q) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL
          AND (title ILIKE ${search} OR description ILIKE ${search} OR grado ILIKE ${search} OR course_id ILIKE ${search} OR unidad ILIKE ${search})
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`
        SELECT COUNT(*)::int AS count FROM user_quizzes
        WHERE deleted_at IS NULL
          AND (title ILIKE ${search} OR description ILIKE ${search} OR grado ILIKE ${search} OR course_id ILIKE ${search} OR unidad ILIKE ${search})
      `
    } else {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, version, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE deleted_at IS NULL`
    }

    if (type === 'catalog') {
      const catalog = buildCatalog(rows, await getCatalog())
      // El catálogo no depende del propietario: siempre se puede cachear en la CDN.
      return publicCache(jsonResponse(catalog))
    }
    
    const response = applyReadCacheHeaders(jsonResponse(rows), Boolean(ownerToken) || owner === 'me')
    if (totalRows?.[0]?.count !== undefined) {
      response.headers.set('X-Total-Count', String(totalRows[0].count))
    }
    return response
  } catch (error) {
    console.error('GET quizzes error:', error)
    Sentry.captureException(error)
    return errorResponse('Error al obtener cuestionarios', error)
  }
}

interface CatalogQuizRow {
  grado?: unknown
  course_id?: unknown
  unidad?: unknown
  title?: unknown
}

// Catálogo público: solo lo que tiene cuestionarios publicados, con los nombres y el orden administrados.
function buildCatalog(quizzes: CatalogQuizRow[], names: Catalog) {
  const grades = new Map<string, Map<string, Set<string>>>()

  for (const quiz of quizzes) {
    const g = typeof quiz.grado === 'string' ? quiz.grado : ''
    const c = typeof quiz.course_id === 'string' ? quiz.course_id : ''
    const u = typeof quiz.unidad === 'string' && quiz.unidad ? quiz.unidad : c
    if (!g || !c) continue
    if (!grades.has(g)) grades.set(g, new Map())
    const courses = grades.get(g)!
    if (!courses.has(c)) courses.set(c, new Set())
    courses.get(c)!.add(u)
  }

  const bySortOrder = <T extends { sort_order: number; label: string }>(a: T, b: T) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, 'es')

  return {
    grados: Array.from(grades, ([gradeId, courses]) => {
      const grade = gradeInfo(names, gradeId)
      return {
        id: gradeId,
        label: grade.name,
        description: grade.short,
        sort_order: grade.sort_order,
        courses: Array.from(courses, ([courseId, units]) => {
          const subject = subjectInfo(names, gradeId, courseId)
          return {
            id: courseId,
            label: subject.name,
            sort_order: subject.sort_order,
            units: Array.from(units, (unitId) => {
              const topic = topicInfo(names, gradeId, courseId, unitId)
              return { id: unitId, title: topic.name, label: topic.name, sort_order: topic.sort_order }
            }).sort(bySortOrder).map(({ id, title }) => ({ id, title }))
          }
        }).sort(bySortOrder).map(({ sort_order: _order, ...course }) => course)
      }
    }).sort(bySortOrder).map(({ sort_order: _order, ...grade }) => grade)
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const limitError = await rateLimit(request, { key: 'create-quiz', limit: 20, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const body = await request.json().catch(() => null)
    const quiz = await createQuiz(body, { actor: 'public', ownerToken: readOwnerToken(request) })
    return noStore(jsonResponse({ ...quiz, can_delete: true }, 201))
  } catch (error) {
    if (!(error instanceof ServiceError)) {
      console.error('POST quiz error:', error)
      Sentry.captureException(error)
    }
    return noStore(errorResponse('Error al crear cuestionario', error))
  }
}
