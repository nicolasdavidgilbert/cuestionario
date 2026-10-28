import type { APIRoute } from 'astro'
import * as Sentry from '@sentry/astro'
import { checkAdminPassword, createAdminSession, getClientIp } from '../../../lib/server/adminAuth'
import { getSql } from '../../../lib/server/db'
import { logAudit } from '../../../lib/server/audit'
import { jsonResponse, noStore, serverErrorResponse } from '../../../lib/server/http'
import { clearRateLimit, rateLimit } from '../../../lib/server/rateLimit'

export const prerender = false

const FAILED_LOGIN_DELAY_MS = 600

export const POST: APIRoute = async ({ request, cookies }) => {
  try {
    const limitError = await rateLimit(request, { key: 'admin-login', limit: 5, windowMs: 15 * 60 * 1000, failClosed: true })
    if (limitError?.status === 429) {
      return noStore(jsonResponse({ message: 'Demasiados intentos. Espera 15 minutos antes de volver a intentarlo.' }, 429))
    }
    if (limitError) return noStore(limitError)

    const body = await request.json().catch(() => ({}))
    const password = typeof body?.password === 'string' ? body.password : ''
    const ip = getClientIp(request)

    if (!(await checkAdminPassword(password))) {
      // Retardo fijo para no dar pistas por el tiempo de respuesta.
      await new Promise((resolve) => setTimeout(resolve, FAILED_LOGIN_DELAY_MS))
      await logAudit(getSql(), 'admin_login_failed', { ip }, { entityType: 'session', actor: 'admin' })
      return noStore(jsonResponse({ message: 'Contraseña incorrecta' }, 401))
    }

    await clearRateLimit(request, 'admin-login')
    const session = await createAdminSession(cookies, { ip, userAgent: request.headers.get('user-agent') || '' })
    await logAudit(getSql(), 'admin_login', { ip }, { entityType: 'session', entityId: session.id.slice(0, 12), actor: 'admin' })
    return noStore(jsonResponse({ ok: true, expiresAt: session.expiresAt }))
  } catch (error) {
    console.error('admin login error:', error)
    Sentry.captureException(error, { tags: { feature: 'admin-login' } })
    return noStore(serverErrorResponse('Error al iniciar sesión', error))
  }
}
