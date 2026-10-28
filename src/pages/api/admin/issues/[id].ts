import { adminRoute, readId } from '../../../../lib/server/adminRoute'
import { readJsonBody } from '../../../../lib/server/http'
import { getIssue, updateIssue } from '../../../../lib/server/issueService'

export const prerender = false

export const GET = adminRoute('Error al cargar la incidencia', ({ params }) => getIssue(readId(params.id)))

// { title?, reason?, kind?, priority?, status?, internal_notes? }
export const PATCH = adminRoute('Error al guardar la incidencia', async ({ params, request }) =>
  updateIssue(readId(params.id), await readJsonBody(request)))
