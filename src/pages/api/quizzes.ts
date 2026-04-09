import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'

export const prerender = false

const sql = neon(import.meta.env.DATABASE_URL)

export const GET: APIRoute = async ({ url }) => {
  try {
    const grado = url.searchParams.get('grado')
    
    let rows
    if (grado) {
      rows = await sql`SELECT * FROM user_quizzes WHERE grado = ${grado} ORDER BY created_at DESC`
    } else {
      rows = await sql`SELECT * FROM user_quizzes ORDER BY created_at DESC`
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json()
    
    const { title, description, grado, course_id, questions } = body
    
    if (!grado || !course_id || !Array.isArray(questions) || questions.length === 0) {
      return new Response(JSON.stringify({ message: 'Datos inválidos' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const rows = await sql`
      INSERT INTO user_quizzes (title, description, grado, course_id, questions)
      VALUES (${title || ''}, ${description || ''}, ${grado}, ${course_id}, ${JSON.stringify(questions)})
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
