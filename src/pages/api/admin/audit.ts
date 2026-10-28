import { adminRoute, searchParam } from '../../../lib/server/adminRoute'
import { listAudit, readPage } from '../../../lib/server/adminQueries'

export const prerender = false

export const GET = adminRoute('Error al cargar la auditoría', ({ url }) => listAudit({
  entityType: searchParam(url, 'entity'),
  action: searchParam(url, 'action'),
  entityId: searchParam(url, 'id'),
  ...readPage(url)
}))
