import type { APIRoute } from 'astro'
import { generateQuizFromPdf } from '../../lib/server/generateQuizFromPdf'
import { normalizeSlug } from '../../lib/slug'
import { jsonResponse, serverErrorResponse } from '../../lib/server/http'
import { rateLimit } from '../../lib/server/rateLimit'

export const prerender = false

const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024

export const POST: APIRoute = async ({ request }) => {
  try {
    const limitError = rateLimit(request, { key: 'generate-quiz-pdf', limit: 5, windowMs: 60 * 60 * 1000 })
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

    const quiz = await generateQuizFromPdf({
      file,
      grado,
      course_id,
      unidad
    })

    return jsonResponse({ ...quiz, source: `${file.name} (generado desde PDF)` })
  } catch (error) {
    console.error('POST generate quiz from pdf error:', error)
    return serverErrorResponse('Error al generar cuestionario desde PDF', error)
  }
}
