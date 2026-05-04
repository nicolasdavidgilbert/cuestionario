import { PDFParse } from 'pdf-parse'
import { validateQuizJson, type QuizData } from '../quizValidator'
import { getGroqApiKey, getGroqModel } from './env'

interface GenerateQuizInput {
  file: File
  grado: string
  course_id: string
  unidad: string
}

interface RequestGroqOptions {
  attempt: number
}

const GROQ_TIMEOUT_MS = 45000

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncateForModel(text: string, maxChars = 50000) {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n\n[contenido truncado por longitud]`
}

async function extractTextFromPdf(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  const parser = new PDFParse({ data: buffer })

  try {
    const result = await parser.getText()
    return normalizeExtractedText(result.text || '')
  } finally {
    await parser.destroy()
  }
}

function buildPrompt({ text, grado, course_id, unidad, fileName, attempt }: { text: string; grado: string; course_id: string; unidad: string; fileName: string; attempt: number }) {
  const unitInstruction = unidad
    ? `El valor exacto de "unidad" debe ser "${unidad}".`
    : 'El valor de "unidad" debe ser una cadena vacía si no se puede inferir nada mejor.'
  const retryInstruction = attempt > 1
    ? '- IMPORTANTE: en el intento anterior no devolviste suficientes preguntas. Esta vez debes devolver como mínimo 20 preguntas completas y distintas.'
    : ''

  return [
    {
      role: 'system',
      content:
        'Eres un generador de cuestionarios. Debes responder exclusivamente con JSON válido que cumpla el esquema indicado. No escribas texto adicional.'
    },
    {
      role: 'user',
      content: `Genera un cuestionario tipo test a partir del contenido del PDF.

Reglas:
- Usa el contenido del documento como fuente principal.
- Devuelve entre 20 y 50 preguntas.
- Cada pregunta debe tener exactamente 4 opciones.
- Solo una opción puede ser correcta.
- "answer" debe ser un índice numérico entre 0 y 3.
- Cada pregunta debe incluir una explicación breve y útil.
- Las opciones incorrectas deben ser plausibles.
- No inventes datos si el PDF no da suficiente contexto; prioriza preguntas claras y literales.
- El valor exacto de "grado" debe ser "${grado}".
- El valor exacto de "course_id" debe ser "${course_id}".
- ${unitInstruction}
- ${retryInstruction}
- El título debe ser descriptivo y estar en el idioma dominante del contenido.
- La descripción debe resumir el tema en una sola frase.
- Si el PDF está en español, genera las preguntas en español.

Nombre del archivo: ${fileName}

Contenido del PDF:
"""
${text}
"""`.trim()
    }
  ]
}

function getQuizSchema() {
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
        minItems: 20,
        maxItems: 50,
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

async function requestGroqQuiz(payload: GenerateQuizInput, text: string, options: RequestGroqOptions) {
  const apiKey = getGroqApiKey()
  const model = getGroqModel()
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS)

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: buildPrompt({
        text: truncateForModel(text),
        grado: payload.grado,
        course_id: payload.course_id,
        unidad: payload.unidad,
        fileName: payload.file.name,
        attempt: options.attempt
      }),
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'quiz_generation',
          strict: true,
          schema: getQuizSchema()
        }
      }
    })
  }).finally(() => clearTimeout(timeoutId))

  const json = await response.json().catch(() => null)

  if (!response.ok) {
    const apiMessage = json?.error?.message || json?.message || `HTTP ${response.status}`
    throw new Error(`Groq devolvió un error: ${apiMessage}`)
  }

  const content = json?.choices?.[0]?.message?.content

  if (!content || typeof content !== 'string') {
    throw new Error('La IA no devolvió contenido utilizable')
  }

  return JSON.parse(content)
}

export async function generateQuizFromPdf(input: GenerateQuizInput): Promise<QuizData> {
  const extractedText = await extractTextFromPdf(input.file)

  if (!extractedText) {
    throw new Error('No se pudo extraer texto del PDF. Si es un PDF escaneado, este MVP no lo leerá bien.')
  }

  let lastError: Error | null = null

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const generated = await requestGroqQuiz(input, extractedText, { attempt })
      const validation = validateQuizJson(generated)

      if (!validation.valid || !validation.data) {
        throw new Error(validation.errors.map((error) => error.message).join('\n'))
      }

      return {
        ...validation.data,
        unidad: typeof generated.unidad === 'string' ? generated.unidad.trim() : input.unidad
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Error desconocido')

      if (!/minItems|20 preguntas|20 y 50 preguntas|schema/i.test(lastError.message) || attempt === 3) {
        break
      }
    }
  }

  throw lastError || new Error('No se pudo generar un cuestionario válido')
}
