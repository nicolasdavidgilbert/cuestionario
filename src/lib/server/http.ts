import { getAdminApiKey, isProduction } from './env'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  })
}

export function serverErrorResponse(message: string, error: unknown): Response {
  const detail = error instanceof Error ? error.message : 'Error desconocido'
  return jsonResponse({ message: isProduction() ? message : `${message}: ${detail}` }, 500)
}

export function requireAdminApiKey(request: Request): Response | null {
  const adminApiKey = getAdminApiKey()

  if (!adminApiKey) {
    return null
  }

  if (request.headers.get('x-admin-api-key') === adminApiKey) {
    return null
  }

  return jsonResponse({ message: 'No autorizado' }, 401)
}
