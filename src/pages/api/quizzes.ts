import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'
import { validateQuizJson } from '../../lib/quizValidator'
import { normalizeSlug } from '../../lib/slug'
import { getDatabaseUrl } from '../../lib/server/env'
import { jsonResponse, serverErrorResponse } from '../../lib/server/http'
import { rateLimit } from '../../lib/server/rateLimit'
import { logAudit } from '../../lib/server/audit'
import { getQuizHash } from '../../lib/server/hash'

export const prerender = false

function getSql() {
  return neon(getDatabaseUrl())
}

export const GET: APIRoute = async ({ request, url }) => {
  try {
    const sql = getSql()
    const grado = normalizeSlug(url.searchParams.get('grado'))
    const type = url.searchParams.get('type')
    const q = String(url.searchParams.get('q') || '').trim()
    const owner = url.searchParams.get('owner')
    const ownerToken = request.headers.get('x-owner-token')?.trim().slice(0, 120) || ''
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 50), 1), 100)
    const offset = Math.max(Number(url.searchParams.get('offset') || 0), 0)
    
    let rows
    let totalRows
    const search = `%${q}%`

    if (type === 'catalog') {
      if (grado) {
        rows = await sql`SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes WHERE deleted_at IS NULL AND grado = ${grado} ORDER BY created_at DESC`
      } else {
        rows = await sql`SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes WHERE deleted_at IS NULL ORDER BY created_at DESC`
      }
    } else if (owner === 'me' && ownerToken && q) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
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
        SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL AND owner_token = ${ownerToken}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE deleted_at IS NULL AND owner_token = ${ownerToken}`
    } else if (grado && q) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
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
        SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL AND grado = ${grado}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE deleted_at IS NULL AND grado = ${grado}`
    } else if (q) {
      rows = await sql`
        SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
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
        SELECT id, title, description, grado, course_id, unidad, questions, created_at, deleted_at, (owner_token <> '' AND owner_token = ${ownerToken}) AS can_delete FROM user_quizzes
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      totalRows = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE deleted_at IS NULL`
    }

    if (type === 'catalog') {
      const catalog = buildCatalog(rows)
      return jsonResponse(catalog)
    }
    
    const response = jsonResponse(rows)
    response.headers.set('X-Total-Count', String(totalRows?.[0]?.count ?? rows.length))
    return response
  } catch (error) {
    console.error('GET quizzes error:', error)
    return serverErrorResponse('Error al obtener cuestionarios', error)
  }
}

function buildCatalog(quizzes: any[]) {
  const gradoMap = new Map()
  
  for (const quiz of quizzes) {
    const g = quiz.grado
    const c = quiz.course_id
    const u = quiz.unidad || c
    
    if (!gradoMap.has(g)) {
      gradoMap.set(g, {
        id: g,
        label: g.toUpperCase(),
        description: '',
        courses: new Map()
      })
    }
    
    const grado = gradoMap.get(g)
    const courses = grado.courses
    
    if (!courses.has(c)) {
      courses.set(c, {
        id: c,
        label: c.toUpperCase(),
        units: new Map()
      })
    }
    
    const course = courses.get(c)
    const units = course.units
    
    if (!units.has(u)) {
      units.set(u, {
        id: u,
        title: quiz.title || ''
      })
    }
  }
  
  const grados = Array.from(gradoMap.values()).map(g => ({
    id: g.id,
    label: g.label,
    description: g.description,
    courses: Array.from(g.courses.values()).map(c => ({
      id: c.id,
      label: c.label,
      units: Array.from(c.units.values()).map(u => u)
    }))
  }))
  
  return { grados }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const limitError = rateLimit(request, { key: 'create-quiz', limit: 20, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const sql = getSql()
    const body = await request.json()

    const validation = validateQuizJson(body)

    if (!validation.valid || !validation.data) {
      return jsonResponse({ message: validation.errors.map((error) => error.message).join('\n') }, 400)
    }

    const { title, description, questions } = validation.data
    const grado = normalizeSlug(validation.data.grado)
    const course_id = normalizeSlug(validation.data.course_id)
    const unidad = normalizeSlug(validation.data.unidad)
    const ownerToken = request.headers.get('x-owner-token')?.trim().slice(0, 120) || ''
    const quizHash = getQuizHash({ title, grado, course_id, unidad, questions })

    const duplicateRows = await sql`
      SELECT id FROM user_quizzes
      WHERE deleted_at IS NULL AND quiz_hash = ${quizHash}
      LIMIT 1
    `

    if (duplicateRows.length > 0) {
      return jsonResponse({ message: 'Este cuestionario ya existe', id: duplicateRows[0].id }, 409)
    }

    const rows = await sql`
      INSERT INTO user_quizzes (title, description, grado, course_id, unidad, questions, quiz_hash, owner_token)
      VALUES (${title || ''}, ${description || ''}, ${grado}, ${course_id}, ${unidad || ''}, ${JSON.stringify(questions)}, ${quizHash}, ${ownerToken})
      RETURNING *
    `

    await logAudit(sql, 'quiz_created', { quiz_id: rows[0].id, grado, course_id, unidad })
    
    return jsonResponse(rows[0], 201)
  } catch (error) {
    console.error('POST quiz error:', error)
    return serverErrorResponse('Error al crear cuestionario', error)
  }
}
