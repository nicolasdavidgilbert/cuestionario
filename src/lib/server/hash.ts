import { createHash } from 'node:crypto'

export function getQuizHash(input: {
  title?: string
  grado: string
  course_id: string
  unidad?: string
  questions: unknown[]
}): string {
  return createHash('sha256')
    .update(JSON.stringify({
      title: input.title || '',
      grado: input.grado,
      course_id: input.course_id,
      unidad: input.unidad || '',
      questions: input.questions
    }))
    .digest('hex')
}
