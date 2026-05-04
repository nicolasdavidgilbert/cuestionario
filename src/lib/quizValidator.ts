import { QUIZ_LIMITS } from './quizLimits'

export interface QuizQuestion {
  question: string
  options: string[]
  answer: number
  explanation?: string
}

export interface QuizData {
  title?: string
  description?: string
  grado: string
  course_id: string
  unidad?: string
  questions: QuizQuestion[]
}

export interface ValidationError {
  field: string
  message: string
}

export function validateQuizJson(json: unknown): { valid: boolean; errors: ValidationError[]; data: QuizData | null } {
  const errors: ValidationError[] = []

  if (!json || typeof json !== 'object') {
    return {
      valid: false,
      errors: [{ field: 'root', message: 'El archivo debe ser un objeto JSON válido' }],
      data: null
    }
  }

  const obj = json as Record<string, unknown>
  const title = typeof obj.title === 'string' ? obj.title.trim() : ''
  const description = typeof obj.description === 'string' ? obj.description.trim() : ''
  const unidad = typeof obj.unidad === 'string' ? obj.unidad.trim() : ''

  if (title.length > QUIZ_LIMITS.titleMaxLength) {
    errors.push({ field: 'title', message: `El título no puede superar ${QUIZ_LIMITS.titleMaxLength} caracteres` })
  }

  if (description.length > QUIZ_LIMITS.descriptionMaxLength) {
    errors.push({ field: 'description', message: `La descripción no puede superar ${QUIZ_LIMITS.descriptionMaxLength} caracteres` })
  }

  if (!obj.grado || typeof obj.grado !== 'string') {
    errors.push({ field: 'grado', message: 'El campo "grado" es obligatorio (ej: "1asir")' })
  } else if (obj.grado.trim().length > QUIZ_LIMITS.slugMaxLength) {
    errors.push({ field: 'grado', message: `El campo "grado" no puede superar ${QUIZ_LIMITS.slugMaxLength} caracteres` })
  }

  if (!obj.course_id || typeof obj.course_id !== 'string') {
    errors.push({ field: 'course_id', message: 'El campo "course_id" es obligatorio (ej: "pni")' })
  } else if (obj.course_id.trim().length > QUIZ_LIMITS.slugMaxLength) {
    errors.push({ field: 'course_id', message: `El campo "course_id" no puede superar ${QUIZ_LIMITS.slugMaxLength} caracteres` })
  }

  if (unidad.length > QUIZ_LIMITS.slugMaxLength) {
    errors.push({ field: 'unidad', message: `El campo "unidad" no puede superar ${QUIZ_LIMITS.slugMaxLength} caracteres` })
  }

  if (!Array.isArray(obj.questions) || obj.questions.length < QUIZ_LIMITS.minQuestions || obj.questions.length > QUIZ_LIMITS.maxQuestions) {
    errors.push({ field: 'questions', message: `El campo "questions" debe ser un array con entre ${QUIZ_LIMITS.minQuestions} y ${QUIZ_LIMITS.maxQuestions} preguntas` })
  } else {
    obj.questions.forEach((q: unknown, index: number) => {
      const qObj = q as Record<string, unknown>
      const prefix = `questions[${index}]`

      if (!qObj || typeof qObj !== 'object') {
        errors.push({ field: prefix, message: `Pregunta ${index + 1} debe ser un objeto` })
        return
      }

      if (!qObj.question || typeof qObj.question !== 'string' || !qObj.question.trim()) {
        errors.push({ field: `${prefix}.question`, message: `Pregunta ${index + 1} debe tener un enunciado` })
      } else if (qObj.question.trim().length > QUIZ_LIMITS.questionMaxLength) {
        errors.push({ field: `${prefix}.question`, message: `Pregunta ${index + 1} no puede superar ${QUIZ_LIMITS.questionMaxLength} caracteres` })
      }

      if (!Array.isArray(qObj.options) || qObj.options.length !== 4) {
        errors.push({ field: `${prefix}.options`, message: `Pregunta ${index + 1} debe tener exactamente 4 opciones` })
      } else {
        const emptyOptions = qObj.options.filter((o: unknown) => typeof o !== 'string' || !String(o).trim())
        if (emptyOptions.length > 0) {
          errors.push({ field: `${prefix}.options`, message: `Pregunta ${index + 1} tiene opciones vacías` })
        }

        const longOptions = qObj.options.filter((o: unknown) => typeof o === 'string' && o.trim().length > QUIZ_LIMITS.optionMaxLength)
        if (longOptions.length > 0) {
          errors.push({ field: `${prefix}.options`, message: `Pregunta ${index + 1} tiene opciones de más de ${QUIZ_LIMITS.optionMaxLength} caracteres` })
        }
      }

      if (typeof qObj.answer !== 'number' || !Number.isInteger(qObj.answer)) {
        errors.push({ field: `${prefix}.answer`, message: `Pregunta ${index + 1} debe tener "answer" como número entero` })
      } else if (qObj.answer < 0 || (Array.isArray(qObj.options) && qObj.answer >= qObj.options.length)) {
        errors.push({ field: `${prefix}.answer`, message: `Pregunta ${index + 1} tiene un índice de respuesta inválido` })
      }

      if (qObj.explanation !== undefined && typeof qObj.explanation !== 'string') {
        errors.push({ field: `${prefix}.explanation`, message: `Pregunta ${index + 1} tiene una explicación inválida` })
      } else if (typeof qObj.explanation === 'string' && qObj.explanation.trim().length > QUIZ_LIMITS.explanationMaxLength) {
        errors.push({ field: `${prefix}.explanation`, message: `Pregunta ${index + 1} tiene una explicación de más de ${QUIZ_LIMITS.explanationMaxLength} caracteres` })
      }
    })
  }

  if (errors.length > 0) {
    return { valid: false, errors, data: null }
  }

  return {
    valid: true,
    errors: [],
    data: {
      title,
      description,
      grado: String(obj.grado),
      course_id: String(obj.course_id),
      unidad,
      questions: obj.questions as QuizQuestion[]
    }
  }
}

export function getPreviewMessage(data: QuizData): string {
  const qCount = data.questions.length
  const hasTitle = data.title && data.title.length > 0
  const unitSuffix = data.unidad ? ` / ${data.unidad}` : ''
  return `${hasTitle ? `"${data.title}"` : 'Cuestionario sin título'} · ${qCount} pregunta${qCount !== 1 ? 's' : ''} · ${data.grado} / ${data.course_id}${unitSuffix}`
}
