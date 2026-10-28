import { defineMiddleware } from 'astro:middleware'
import { getAdminSession, isAdminConfigured } from './lib/server/adminAuth'
import { isAdminPath, isAdminPublicPath, isSameOriginRequest, isWriteMethod, safeEqual } from './lib/server/adminSecurity'
import { hasValidAdminApiKey } from './lib/server/http'

// Protege /admin y /api/admin/* en el servidor. Solo el formulario y el endpoint de acceso
// quedan fuera; la exportación admite además la clave técnica para scripts.

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function privateHeaders(response: Response) {
  response.headers.set('Cache-Control', 'no-store')
  response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  response.headers.set('Referrer-Policy', 'same-origin')
  response.headers.set('X-Frame-Options', 'DENY')
  return response
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url
  if (!isAdminPath(pathname)) return next()

  const isApi = pathname.startsWith('/api/')
  const deny = (status: number, message: string) => privateHeaders(isApi
    ? json({ message, code: status === 401 ? 'unauthorized' : 'forbidden' }, status)
    : new Response(message, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }))

  if (pathname === '/api/admin/export' && context.request.headers.has('x-admin-api-key')) {
    if (context.request.method !== 'GET' || !hasValidAdminApiKey(context.request)) return deny(401, 'No autorizado')
    context.locals.admin = { id: 'api-key', csrfToken: '', expiresAt: '', viaApiKey: true }
    return privateHeaders(await next())
  }

  if (!isAdminConfigured()) {
    return deny(503, 'El panel de administración no está configurado (falta ADMIN_PASSWORD_HASH).')
  }

  if (isWriteMethod(context.request.method) && !isSameOriginRequest(context.request)) {
    return deny(403, 'Origen no permitido')
  }

  if (isAdminPublicPath(pathname)) return privateHeaders(await next())

  const session = await getAdminSession(context.cookies).catch((error) => {
    console.error('admin session lookup failed:', error)
    return null
  })

  if (!session) {
    if (isApi) return deny(401, 'Tu sesión ha caducado. Vuelve a iniciar sesión.')
    const target = `${pathname}${context.url.search}`
    return privateHeaders(context.redirect(`/admin/login?next=${encodeURIComponent(target)}`, 303))
  }

  if (isWriteMethod(context.request.method) && !safeEqual(context.request.headers.get('x-csrf-token') || '', session.csrfToken)) {
    return deny(403, 'Token de seguridad no válido. Recarga la página.')
  }

  context.locals.admin = { ...session, viaApiKey: false }
  return privateHeaders(await next())
})
