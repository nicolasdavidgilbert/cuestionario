import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'

export const prerender = false

const sql = neon(import.meta.env.DATABASE_URL)

export const GET: APIRoute = async ({ url }) => {
  try {
    const grado = url.searchParams.get('grado')
    const type = url.searchParams.get('type')
    
    let rows
    if (grado) {
      rows = await sql`SELECT * FROM user_quizzes WHERE grado = ${grado} ORDER BY created_at DESC`
    } else {
      rows = await sql`SELECT * FROM user_quizzes ORDER BY created_at DESC`
    }

    if (type === 'catalog') {
      const catalog = buildCatalog(rows)
      return new Response(JSON.stringify(catalog), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify(rows), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('GET quizzes error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ message: 'Error al obtener cuestionarios: ' + message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
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
    const body = await request.json()
    
    const { title, description, grado, course_id, unidad, questions } = body
    
    if (!grado || !course_id || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ message: 'Datos inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const rows = await sql`
      INSERT INTO user_quizzes (title, description, grado, course_id, unidad, questions)
      VALUES (${title || ''}, ${description || ''}, ${grado}, ${course_id}, ${unidad || ''}, ${JSON.stringify(questions)})
      RETURNING *
    `
    
    return new Response(JSON.stringify(rows[0]), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('POST quiz error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ message: 'Error al crear cuestionario: ' + message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}