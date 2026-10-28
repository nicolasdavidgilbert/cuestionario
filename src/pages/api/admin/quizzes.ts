import { adminRoute, searchParam } from '../../../lib/server/adminRoute'
import { listQuizzes, readPage } from '../../../lib/server/adminQueries'
import { readJsonBody } from '../../../lib/server/http'
import { createQuiz } from '../../../lib/server/quizService'

export const prerender = false

// ?q=&grade=&subject=&topic=&status=publicado|papelera&page=
export const GET = adminRoute('Error al listar cuestionarios', ({ url }) => listQuizzes({
  q: searchParam(url, 'q'),
  grade: searchParam(url, 'grade'),
  subject: searchParam(url, 'subject'),
  topic: searchParam(url, 'topic'),
  status: searchParam(url, 'status'),
  ...readPage(url)
}))

export const POST = adminRoute('Error al crear el cuestionario', async ({ request }) => {
  const quiz = await createQuiz(await readJsonBody(request), { actor: 'admin' })
  return new Response(JSON.stringify(quiz), { status: 201, headers: { 'Content-Type': 'application/json' } })
})
