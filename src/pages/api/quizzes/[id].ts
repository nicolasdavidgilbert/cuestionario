import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'

export const prerender = false

const sql = neon(import.meta.env.DATABASE_URL)

export const GET: APIRoute = async ({ params }) => {
  try {
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return new Response(JSON.stringify({ message: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const rows = await sql`SELECT * FROM user_quizzes WHERE id = ${id}`
    
    if (rows.length === 0) {
      return new Response(JSON.stringify({ message: 'Cuestionario no encontrado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    return new Response(JSON.stringify(rows[0]), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  } catch (error) {
    console.error('GET quiz error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ message: 'Error al obtener cuestionario: ' + message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const id = Number(params.id)
    
    if (isNaN(id)) {
      return new Response(JSON.stringify({ message: 'ID inválido' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    await sql`DELETE FROM user_quizzes WHERE id = ${id}`
    
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error('DELETE quiz error:', error)
    const message = error instanceof Error ? error.message : 'Error desconocido'
    return new Response(JSON.stringify({ message: 'Error al eliminar cuestionario: ' + message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
