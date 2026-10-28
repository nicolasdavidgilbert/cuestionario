import { validateQuizJson, type QuizQuestion } from '../quizValidator'
import { normalizeSlug } from '../slug'
import { getQuizHash } from './hash'
import { badRequest } from './errors'
import { topicIdOf } from './catalogRules'

// Validación y normalización de un cuestionario antes de guardarlo (sin base de datos).

export interface PreparedQuiz {
  title: string
  description: string
  grado: string
  course_id: string
  unidad: string
  questions: QuizQuestion[]
  quiz_hash: string
}

export function quizPath(quiz: { grado: string; course_id: string; unidad?: string | null }) {
  return `/${quiz.grado}/${quiz.course_id}/${topicIdOf({ course_id: quiz.course_id, unidad: quiz.unidad })}`
}

export function prepareQuiz(input: unknown): PreparedQuiz {
  const validation = validateQuizJson(input)
  if (!validation.valid || !validation.data) {
    throw badRequest(validation.errors.map((error) => error.message).join('\n'), validation.errors)
  }

  const { questions } = validation.data
  const title = validation.data.title || ''
  const description = validation.data.description || ''
  const grado = normalizeSlug(validation.data.grado)
  const course_id = normalizeSlug(validation.data.course_id)
  const unidad = normalizeSlug(validation.data.unidad)
  const quiz_hash = getQuizHash({ title, grado, course_id, unidad, questions })

  return { title, description, grado, course_id, unidad, questions, quiz_hash }
}

