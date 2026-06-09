import type { APIRoute } from 'astro'
import { normalizeSlug } from '../../lib/slug'
import { jsonResponse } from '../../lib/server/http'
import { rateLimit } from '../../lib/server/rateLimit'

export const prerender = false

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024

function getPublicGenerateErrorMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : ''

  if (/Falta configurar GROQ_API_KEY/i.test(detail)) {
    return 'Falta configurar GROQ_API_KEY en el servidor. Revisa la variable de entorno en Vercel y redepliega.'
  }

  if (/No se pudo extraer texto del PDF|PDF escaneado/i.test(detail)) {
    return detail
  }

  if (/pdf-parse|pdfjs|DOMMatrix|Promise.withResolvers|worker|canvas/i.test(detail)) {
    return `El servidor no pudo inicializar el lector de PDF: ${detail}`
  }

  if (/tokens per minute|TPM|Request too large|rate limit/i.test(detail)) {
    return 'El PDF sigue superando el límite actual de Groq incluso usando trozos más pequeños. Prueba con un PDF más corto o un modelo/límite superior.'
  }

  if (/Groq devolvi[oó] un error:/i.test(detail)) {
    return detail
  }

  if (/aborted|timeout|timed out/i.test(detail)) {
    return 'La generación tardó demasiado. Prueba con un PDF más corto o vuelve a intentarlo.'
  }

  if (/JSON|schema|preguntas|question|options|answer/i.test(detail)) {
    return 'La IA respondió con un cuestionario inválido. Prueba de nuevo o usa un PDF con contenido más claro.'
  }

  return 'Error al generar cuestionario desde PDF. Revisa los logs de Vercel para ver el detalle técnico.'
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const limitError = await rateLimit(request, { key: 'generate-quiz-pdf', limit: 5, windowMs: 60 * 60 * 1000 })
    if (limitError) return limitError

    const formData = await request.formData()
    const file = formData.get('file')
    const grado = normalizeSlug(formData.get('grado'))
    const course_id = normalizeSlug(formData.get('course_id'))
    const unidad = normalizeSlug(formData.get('unidad'))

    if (!(file instanceof File)) {
      return jsonResponse({ message: 'Debes subir un archivo PDF' }, 400)
    }

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return jsonResponse({ message: 'Solo se permiten archivos PDF' }, 400)
    }

    if (file.size > MAX_PDF_SIZE_BYTES) {
      return jsonResponse({ message: 'El PDF no puede superar los 10 MB' }, 413)
    }

    if (!grado || !course_id) {
      return jsonResponse({ message: 'Los campos grado y curso son obligatorios antes de generar' }, 400)
    }

    const { generateQuizFromPdf } = await import('../../lib/server/generateQuizFromPdf')
    const quiz = await generateQuizFromPdf({
      file,
      grado,
      course_id,
      unidad
    })

    return jsonResponse({ ...quiz, source: `${file.name} (generado desde PDF)` })
  } catch (error) {
    console.error('POST generate quiz from pdf error:', error)
    return jsonResponse({ message: getPublicGenerateErrorMessage(error) }, 500)
  }
}
