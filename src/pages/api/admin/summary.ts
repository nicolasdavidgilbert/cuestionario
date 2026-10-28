import { adminRoute } from '../../../lib/server/adminRoute'
import { getSummary } from '../../../lib/server/adminQueries'

export const prerender = false

export const GET = adminRoute('Error al cargar el resumen', () => getSummary())
