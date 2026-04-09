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

  if (!obj.grado || typeof obj.grado !== 'string') {
    errors.push({ field: 'grado', message: 'El campo "grado" es obligatorio (ej: "1asir")' })
  }

  if (!obj.course_id || typeof obj.course_id !== 'string') {
    errors.push({ field: 'course_id', message: 'El campo "course_id" es obligatorio (ej: "pni")' })
  }

  if (!Array.isArray(obj.questions) || obj.questions.length === 0) {
    errors.push({ field: 'questions', message: 'El campo "questions" debe ser un array con al menos 1 pregunta' })
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
      }

      if (!Array.isArray(qObj.options) || qObj.options.length < 2) {
        errors.push({ field: `${prefix}.options`, message: `Pregunta ${index + 1} debe tener al menos 2 opciones` })
      } else {
        const emptyOptions = qObj.options.filter((o: unknown) => typeof o !== 'string' || !String(o).trim())
        if (emptyOptions.length > 0) {
          errors.push({ field: `${prefix}.options`, message: `Pregunta ${index + 1} tiene opciones vacías` })
        }
      }

      if (typeof qObj.answer !== 'number') {
        errors.push({ field: `${prefix}.answer`, message: `Pregunta ${index + 1} debe tener "answer" como número` })
      } else if (qObj.answer < 0 || (Array.isArray(qObj.options) && qObj.answer >= qObj.options.length)) {
        errors.push({ field: `${prefix}.answer`, message: `Pregunta ${index + 1} tiene un índice de respuesta inválido` })
      }

      if (qObj.explanation !== undefined && typeof qObj.explanation !== 'string') {
        errors.push({ field: `${prefix}.explanation`, message: `Pregunta ${index + 1} tiene una explicación inválida` })
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
      title: typeof obj.title === 'string' ? obj.title.trim() : '',
      description: typeof obj.description === 'string' ? obj.description.trim() : '',
      grado: String(obj.grado),
      course_id: String(obj.course_id),
      questions: obj.questions as QuizQuestion[]
    }
  }
}

export function getPreviewMessage(data: QuizData): string {
  const qCount = data.questions.length
  const hasTitle = data.title && data.title.length > 0
  return `${hasTitle ? `"${data.title}"` : 'Cuestionario sin título'} · ${qCount} pregunta${qCount !== 1 ? 's' : ''} · ${data.grado} / ${data.course_id}`
}
