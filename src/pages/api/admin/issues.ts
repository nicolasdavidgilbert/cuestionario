import { adminRoute, searchParam } from '../../../lib/server/adminRoute'
import { readPage } from '../../../lib/server/adminQueries'
import { readJsonBody } from '../../../lib/server/http'
import { createIssue, listIssues } from '../../../lib/server/issueService'

export const prerender = false

// ?status=abiertas|pendiente|en_revision|resuelta|descartada&priority=&kind=&q=&quiz=&page=
export const GET = adminRoute('Error al listar incidencias', ({ url }) => listIssues({
  status: searchParam(url, 'status'),
  priority: searchParam(url, 'priority'),
  kind: searchParam(url, 'kind'),
  q: searchParam(url, 'q', 200),
  quizId: Number(url.searchParams.get('quiz')) || undefined,
  ...readPage(url)
}))

export const POST = adminRoute('Error al crear la incidencia', async ({ request }) => {
  const issue = await createIssue(await readJsonBody(request))
  return new Response(JSON.stringify(issue), { status: 201, headers: { 'Content-Type': 'application/json' } })
})
