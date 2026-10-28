import { adminRoute, searchParam } from '../../../lib/server/adminRoute'
import { readPage, searchQuestions } from '../../../lib/server/adminQueries'

export const prerender = false

// Búsqueda transversal en el enunciado, las opciones y la explicación de las preguntas publicadas.
export const GET = adminRoute('Error al buscar preguntas', ({ url }) => searchQuestions({
  q: searchParam(url, 'q', 200),
  grade: searchParam(url, 'grade'),
  subject: searchParam(url, 'subject'),
  topic: searchParam(url, 'topic'),
  ...readPage(url)
}))
