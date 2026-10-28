import type { APIContext, APIRoute } from 'astro'
import * as Sentry from '@sentry/astro'
import { ServiceError } from './errors'
import { errorResponse, jsonResponse, noStore } from './http'

// Envoltorio de los endpoints /api/admin/*: exige la sesión comprobada por el middleware
// (segunda barrera), no se cachea nunca y convierte los errores esperados en respuestas claras.
export function adminRoute(label: string, handler: (context: APIContext) => Promise<unknown>): APIRoute {
  return async (context) => {
    if (!context.locals.admin) return noStore(jsonResponse({ message: 'No autorizado', code: 'unauthorized' }, 401))

    try {
      const result = await handler(context)
      return noStore(result instanceof Response ? result : jsonResponse(result ?? { ok: true }))
    } catch (error) {
      if (!(error instanceof ServiceError)) {
        console.error(`${label}:`, error)
        Sentry.captureException(error, { tags: { feature: 'admin-api' } })
      }
      return noStore(errorResponse(label, error))
    }
  }
}

export function readId(value: string | undefined): number {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new ServiceError(400, 'invalid', 'ID inválido')
  return id
}

export function searchParam(url: URL, name: string, max = 120): string {
  return (url.searchParams.get(name) || '').trim().slice(0, max)
}
