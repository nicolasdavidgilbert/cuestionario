import { QUIZ_LIMITS } from '../quizLimits'
import { validateQuizJson, type QuizData, type QuizQuestion } from '../quizValidator'
import { getGroqApiKey, getGroqModel } from './env'

interface GenerateQuizInput {
  file: File
  grado: string
  course_id: string
  unidad: string
}

interface RequestGroqOptions {
  attempt: number
  minQuestions: number
  maxQuestions: number
  maxChars: number
}

type GeneratedQuiz = QuizData & { notice?: string }

const GROQ_TIMEOUT_MS = 45000
const SINGLE_CALL_MAX_CHARS = 6500
const LONG_TEXT_THRESHOLD_CHARS = 9000
const MAX_CHUNKS = 2
const CHUNK_MIN_QUESTIONS = 10
const CHUNK_MAX_QUESTIONS = 13
const SCHEMA_MIN_QUESTIONS = 1

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncateForModel(text: string, maxChars: number) {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n[contenido truncado por longitud]`
}

function splitTextIntoChunks(text: string) {
  if (text.length <= LONG_TEXT_THRESHOLD_CHARS) return [text]

  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
  const chunks = Array.from({ length: MAX_CHUNKS }, () => '')

  if (paragraphs.length === 0) {
    const chunkSize = Math.ceil(text.length / MAX_CHUNKS)
    return Array.from({ length: MAX_CHUNKS }, (_, index) => text.slice(index * chunkSize, (index + 1) * chunkSize).trim()).filter(Boolean)
  }

  for (const paragraph of paragraphs) {
    const targetIndex = chunks[0].length <= chunks[1].length ? 0 : 1
    chunks[targetIndex] = chunks[targetIndex] ? `${chunks[targetIndex]}\n\n${paragraph}` : paragraph
  }

  return chunks.map((chunk) => chunk.trim()).filter(Boolean)
}

async function extractTextFromPdf(file: File) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default
  const buffer = Buffer.from(await file.arrayBuffer())
  const result = await pdfParse(buffer)
  return normalizeExtractedText(result.text || '')
}

function buildPrompt({
  text,
  grado,
  course_id,
  unidad,
  fileName,
  attempt,
  minQuestions,
  maxQuestions
}: {
  text: string
  grado: string
  course_id: string
  unidad: string
  fileName: string
  attempt: number
  minQuestions: number
  maxQuestions: number
}) {
  const unitInstruction = unidad
    ? `El valor exacto de "unidad" debe ser "${unidad}".`
    : 'El valor de "unidad" debe ser una cadena vacia si no se puede inferir nada mejor.'
  const retryInstruction = attempt > 1
    ? `- IMPORTANTE: en el intento anterior no devolviste suficientes preguntas. Esta vez debes devolver como minimo ${minQuestions} preguntas completas y distintas.`
    : ''

  return [
    {
      role: 'system',
      content:
        'Eres un generador de cuestionarios. Debes responder exclusivamente con JSON valido que cumpla el esquema indicado. No escribas texto adicional.'
    },
    {
      role: 'user',
      content: `Genera un cuestionario tipo test a partir del contenido del PDF.

Reglas:
- Usa el contenido del documento como fuente principal.
- Devuelve entre ${minQuestions} y ${maxQuestions} preguntas.
- Cada pregunta debe tener exactamente 4 opciones.
- Solo una opcion puede ser correcta.
- "answer" debe ser un indice numerico entre 0 y 3.
- Cada pregunta debe incluir una explicacion breve y util.
- Las opciones incorrectas deben ser plausibles.
- No inventes datos si el PDF no da suficiente contexto; prioriza preguntas claras y literales.
- El valor exacto de "grado" debe ser "${grado}".
- El valor exacto de "course_id" debe ser "${course_id}".
- ${unitInstruction}
${retryInstruction}
- El titulo debe ser descriptivo y estar en el idioma dominante del contenido.
- La descripcion debe resumir el tema en una sola frase.
- Si el PDF esta en espanol, genera las preguntas en espanol.

Nombre del archivo: ${fileName}

Contenido del PDF:
"""
${text}
"""`.trim()
    }
  ]
}

function getQuizSchema(minQuestions: number, maxQuestions: number) {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: { type: 'string' },
      description: { type: 'string' },
      grado: { type: 'string' },
      course_id: { type: 'string' },
      unidad: { type: 'string' },
      questions: {
        type: 'array',
        minItems: SCHEMA_MIN_QUESTIONS,
        maxItems: maxQuestions,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            question: { type: 'string' },
            options: {
              type: 'array',
              minItems: 4,
              maxItems: 4,
              items: { type: 'string' }
            },
            answer: { type: 'integer', minimum: 0, maximum: 3 },
            explanation: { type: 'string' }
          },
          required: ['question', 'options', 'answer', 'explanation']
        }
      }
    },
    required: ['title', 'description', 'grado', 'course_id', 'unidad', 'questions']
  }
}

function parseGroqContent(content: string) {
  try {
    return JSON.parse(content)
  } catch {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')

    if (start === -1 || end === -1 || end <= start) {
      throw new Error('La IA no devolvio JSON utilizable')
    }

    return JSON.parse(content.slice(start, end + 1))
  }
}

function isGroqSchemaFailure(message: string) {
  return /failed_generation|failed to validate json|does not match the expected schema|jsonschema/i.test(message)
}

async function fetchGroqCompletion(payload: GenerateQuizInput, text: string, options: RequestGroqOptions, mode: 'schema' | 'json') {
  const apiKey = getGroqApiKey()
  const model = getGroqModel()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)
  const responseFormat = mode === 'schema'
    ? {
      type: 'json_schema',
      json_schema: {
        name: 'quiz_generation',
        strict: true,
        schema: getQuizSchema(options.minQuestions, options.maxQuestions)
      }
    }
    : { type: 'json_object' }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: mode === 'schema' ? 0.2 : 0.1,
      messages: buildPrompt({
        text: truncateForModel(text, options.maxChars),
        grado: payload.grado,
        course_id: payload.course_id,
        unidad: payload.unidad,
        fileName: payload.file.name,
        attempt: options.attempt,
        minQuestions: options.minQuestions,
        maxQuestions: options.maxQuestions
      }),
      response_format: responseFormat
    })
  }).finally(() => clearTimeout(timeoutId))

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    const apiMessage = json?.error?.message || json?.message || `HTTP ${response.status}`
    const retryAfter = response.headers.get('retry-after')

    if (response.status === 429 || /rate limit|too many requests|tokens per minute|TPM/i.test(apiMessage)) {
      throw new Error(`Groq rate limit: ${apiMessage}${retryAfter ? `. Retry-After: ${retryAfter}s` : ''}`)
    }

    throw new Error(`Groq devolvio un error: ${apiMessage}`)
  }

  const content = json?.choices?.[0]?.message?.content

  if (!content || typeof content !== 'string') {
    throw new Error('La IA no devolvio contenido utilizable')
  }

  return parseGroqContent(content)
}

async function requestGroqQuiz(payload: GenerateQuizInput, text: string, options: RequestGroqOptions) {
  try {
    return await fetchGroqCompletion(payload, text, options, 'schema')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!isGroqSchemaFailure(message)) throw error

    return fetchGroqCompletion(payload, text, options, 'json')
  }
}

function normalizeGeneratedQuiz(generated: unknown, input: GenerateQuizInput): QuizData {
  if (!generated || typeof generated !== 'object') {
    throw new Error('La IA devolvio un JSON invalido')
  }

  const obj = generated as Record<string, unknown>
  const questions = Array.isArray(obj.questions) ? obj.questions : []
  const normalizedQuestions: QuizQuestion[] = []

  for (const question of questions) {
    if (!question || typeof question !== 'object') continue

    const qObj = question as Record<string, unknown>
    const options = Array.isArray(qObj.options)
      ? qObj.options.map((option) => String(option || '').trim()).filter(Boolean)
      : []
    const answer = qObj.answer

    if (typeof qObj.question !== 'string' || !qObj.question.trim()) continue
    if (options.length !== 4) continue
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > 3) continue

    normalizedQuestions.push({
      question: qObj.question.trim().slice(0, QUIZ_LIMITS.questionMaxLength),
      options: options.map((option) => option.slice(0, QUIZ_LIMITS.optionMaxLength)),
      answer,
      explanation: typeof qObj.explanation === 'string'
        ? qObj.explanation.trim().slice(0, QUIZ_LIMITS.explanationMaxLength)
        : ''
    })
  }

  if (normalizedQuestions.length === 0) {
    throw new Error('La IA no devolvio preguntas utilizables')
  }

  return {
    title: typeof obj.title === 'string' && obj.title.trim() ? obj.title.trim() : `Cuestionario de ${input.file.name}`,
    description: typeof obj.description === 'string' ? obj.description.trim() : 'Cuestionario generado desde PDF.',
    grado: input.grado,
    course_id: input.course_id,
    unidad: typeof obj.unidad === 'string' ? obj.unidad.trim() : input.unidad,
    questions: normalizedQuestions
  }
}

async function generatePartialQuiz(input: GenerateQuizInput, text: string, options: Omit<RequestGroqOptions, 'attempt'>) {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const generated = await requestGroqQuiz(input, text, { ...options, attempt })
      const quiz = normalizeGeneratedQuiz(generated, input)

      return quiz
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Error desconocido')

      if (!/minItems|preguntas|schema/i.test(lastError.message) || attempt === 3) {
        break
      }
    }
  }

  throw lastError || new Error('No se pudo generar un cuestionario valido')
}

function mergeQuizzes(input: GenerateQuizInput, quizzes: QuizData[], notice?: string): GeneratedQuiz {
  const seenQuestions = new Set<string>()
  const questions = quizzes.flatMap((quiz) => quiz.questions).filter((question) => {
    const key = question.question.trim().toLowerCase()
    if (seenQuestions.has(key)) return false
    seenQuestions.add(key)
    return true
  }).slice(0, QUIZ_LIMITS.maxQuestions)

  return {
    title: quizzes[0]?.title || `Cuestionario de ${input.file.name}`,
    description: quizzes[0]?.description || 'Cuestionario generado desde PDF.',
    grado: input.grado,
    course_id: input.course_id,
    unidad: quizzes.find((quiz) => quiz.unidad)?.unidad || input.unidad,
    questions,
    notice
  }
}

function validateFinalQuiz(quiz: GeneratedQuiz) {
  const validation = validateQuizJson(quiz)

  if (!validation.valid || !validation.data) {
    const onlyQuestionCountError = validation.errors.every((error) => error.field === 'questions')

    if (onlyQuestionCountError && quiz.questions.length > 0 && quiz.questions.length < QUIZ_LIMITS.minQuestions) {
      return {
        title: quiz.title,
        description: quiz.description,
        grado: quiz.grado,
        course_id: quiz.course_id,
        unidad: quiz.unidad,
        questions: quiz.questions,
        notice: quiz.notice || `La IA solo pudo generar ${quiz.questions.length} pregunta${quiz.questions.length === 1 ? '' : 's'} con este PDF. Puedes editar el cuestionario y añadir preguntas antes de guardarlo.`
      }
    }

    throw new Error(validation.errors.map((error) => error.message).join('\n'))
  }

  return {
    ...validation.data,
    notice: quiz.notice
  }
}

export async function generateQuizFromPdf(input: GenerateQuizInput): Promise<GeneratedQuiz> {
  const extractedText = await extractTextFromPdf(input.file)

  if (!extractedText) {
    throw new Error('No se pudo extraer texto del PDF. Si es un PDF escaneado, este MVP no lo leera bien.')
  }

  const chunks = splitTextIntoChunks(extractedText)

  if (chunks.length === 1) {
    const quiz = await generatePartialQuiz(input, chunks[0], {
      minQuestions: QUIZ_LIMITS.minQuestions,
      maxQuestions: Math.min(25, QUIZ_LIMITS.maxQuestions),
      maxChars: SINGLE_CALL_MAX_CHARS
    })

    return validateFinalQuiz(mergeQuizzes(input, [quiz]))
  }

  const quizzes: QuizData[] = []

  for (const chunk of chunks) {
    quizzes.push(await generatePartialQuiz(input, chunk, {
      minQuestions: CHUNK_MIN_QUESTIONS,
      maxQuestions: CHUNK_MAX_QUESTIONS,
      maxChars: SINGLE_CALL_MAX_CHARS
    }))
  }

  const notice = `PDF largo: se dividio el contenido en ${chunks.length} partes para no superar el limite actual de Groq. Las preguntas se han unido en un unico cuestionario.`
  return validateFinalQuiz(mergeQuizzes(input, quizzes, notice))
}
