import { adminRoute, readId } from '../../../../../lib/server/adminRoute'
import { restoreQuiz } from '../../../../../lib/server/quizService'

export const prerender = false

export const POST = adminRoute('Error al restaurar el cuestionario', ({ params }) => restoreQuiz(readId(params.id), { actor: 'admin' }))
