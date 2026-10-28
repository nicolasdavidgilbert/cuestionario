import { adminRoute } from '../../../lib/server/adminRoute'
import { readJsonBody } from '../../../lib/server/http'
import { createCatalogEntry, deleteCatalogEntry, getCatalogForAdmin, updateCatalogEntry } from '../../../lib/server/catalogService'

export const prerender = false

export const GET = adminRoute('Error al cargar el catálogo', () => getCatalogForAdmin())

// { level: 'grade' | 'subject' | 'topic', key: { grade, subject? }, data: { id, name, ... } }
export const POST = adminRoute('Error al crear el elemento', async ({ request }) => {
  const body = await readJsonBody(request)
  return createCatalogEntry({ level: body.level, key: body.key, data: body.data })
})

export const PATCH = adminRoute('Error al guardar el elemento', async ({ request }) => {
  const body = await readJsonBody(request)
  return updateCatalogEntry({ level: body.level, key: body.key, data: body.data })
})

export const DELETE = adminRoute('Error al eliminar el elemento', async ({ request }) => {
  const body = await readJsonBody(request)
  return deleteCatalogEntry({ level: body.level, key: body.key })
})
