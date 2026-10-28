import { adminRoute } from '../../../../lib/server/adminRoute'
import { readJsonBody } from '../../../../lib/server/http'
import { reassignCatalogEntry } from '../../../../lib/server/catalogService'

export const prerender = false

// { level, from: { grade, subject?, topic? }, to: {...}, deleteSource?: boolean }
export const POST = adminRoute('Error al reasignar', async ({ request }) => {
  const body = await readJsonBody(request)
  return reassignCatalogEntry({ level: body.level, from: body.from, to: body.to, deleteSource: body.deleteSource })
})
