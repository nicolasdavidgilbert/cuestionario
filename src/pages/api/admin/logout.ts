import { adminRoute } from '../../../lib/server/adminRoute'
import { revokeAdminSession, revokeAllAdminSessions } from '../../../lib/server/adminAuth'
import { getSql } from '../../../lib/server/db'
import { logAudit } from '../../../lib/server/audit'

export const prerender = false

// { all: true } cierra también las sesiones abiertas en otros dispositivos.
export const POST = adminRoute('Error al cerrar sesión', async ({ request, cookies, locals }) => {
  const body = await request.json().catch(() => ({}))
  const closedOthers = body?.all === true ? await revokeAllAdminSessions() : 0
  await revokeAdminSession(cookies, locals.admin!.id)
  await logAudit(getSql(), 'admin_logout', { all: body?.all === true, closed: closedOthers }, { entityType: 'session', entityId: locals.admin!.id.slice(0, 12), actor: 'admin' })
  return { ok: true }
})
