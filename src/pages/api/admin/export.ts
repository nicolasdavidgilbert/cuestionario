import { adminRoute } from '../../../lib/server/adminRoute'
import { exportContent, exportIssuesCsv, exportQuizzesCsv } from '../../../lib/server/transferService'

export const prerender = false

function download(body: string, filename: string, type: string) {
  return new Response(body, {
    headers: {
      'Content-Type': `${type}; charset=utf-8`,
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}

// ?type=content (JSON: catálogo + cuestionarios) | catalog (JSON) | quizzes (CSV) | issues (CSV)
// Accesible con sesión de administración o con la clave técnica x-admin-api-key (scripts).
export const GET = adminRoute('Error al exportar datos', async ({ url }) => {
  const type = url.searchParams.get('type') || 'content'
  const date = new Date().toISOString().slice(0, 10)

  if (type === 'quizzes') return download(await exportQuizzesCsv(), `cuestionarios-${date}.csv`, 'text/csv')
  if (type === 'issues') return download(await exportIssuesCsv(), `incidencias-${date}.csv`, 'text/csv')

  const scope = type === 'catalog' ? 'catalog' : 'all'
  const data = await exportContent({ scope, includeTrash: url.searchParams.get('trash') !== '0' })
  return download(JSON.stringify(data, null, 2), `${scope === 'catalog' ? 'catalogo' : 'contenido'}-${date}.json`, 'application/json')
})
