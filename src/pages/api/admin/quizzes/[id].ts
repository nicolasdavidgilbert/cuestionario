import { adminRoute, readId } from '../../../../lib/server/adminRoute'
import { getDb } from '../../../../lib/server/db'
import { notFound } from '../../../../lib/server/errors'
import { readJsonBody } from '../../../../lib/server/http'
import { getQuiz, trashQuiz, updateQuiz } from '../../../../lib/server/quizService'

export const prerender = false

export const GET = adminRoute('Error al cargar el cuestionario', async ({ params }) => {
  const quiz = await getQuiz(getDb(), readId(params.id), { includeDeleted: true })
  if (!quiz) throw notFound('Cuestionario no encontrado')
  return quiz
})

// { version, title?, description?, grado?, course_id?, unidad?, questions? }
export const PATCH = adminRoute('Error al guardar el cuestionario', async ({ params, request }) => {
  const { version, ...changes } = await readJsonBody(request)
  return updateQuiz(readId(params.id), { expectedVersion: version, changes, actor: 'admin' })
})

// Envía a la papelera (recuperable). No hay borrado definitivo desde el panel.
export const DELETE = adminRoute('Error al enviar a la papelera', async ({ params, request }) => {
  const body = await request.json().catch(() => ({}))
  return trashQuiz(readId(params.id), { actor: 'admin', reason: typeof body?.reason === 'string' ? body.reason.slice(0, 200) : '' })
})
