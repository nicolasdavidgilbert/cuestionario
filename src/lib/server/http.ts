import { getAdminApiKey, isProduction } from './env'
import { safeEqual } from './adminSecurity'
import { ServiceError } from './errors'

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

// Errores esperados (validación, conflicto, permisos) con su estado; el resto como 500.
export function errorResponse(message: string, error: unknown): Response {
  if (error instanceof ServiceError) return jsonResponse(error.toJSON(), error.status)
  return serverErrorResponse(message, error)
}

export function noStore(response: Response): Response {
  response.headers.set('Cache-Control', 'no-store')
  return response
}

// Lecturas públicas: como mucho 60 s en la CDN y sin servir contenido caducado.
export function publicCache(response: Response): Response {
  response.headers.set('Cache-Control', 'public, max-age=0, s-maxage=60, must-revalidate')
  return response
}

// Clave técnica para scripts. Si no está configurada, se deniega (nunca se deja abierto).
export function hasValidAdminApiKey(request: Request): boolean {
  const adminApiKey = getAdminApiKey()
  return Boolean(adminApiKey) && safeEqual(request.headers.get('x-admin-api-key') || '', adminApiKey)
}

export function requireAdminApiKey(request: Request): Response | null {
  return hasValidAdminApiKey(request) ? null : jsonResponse({ message: 'No autorizado' }, 401)
}

export async function readJsonBody(request: Request): Promise<Record<string, any>> {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ServiceError(400, 'invalid_json', 'El cuerpo de la petición debe ser un objeto JSON')
  }
  return body
}

export function readOwnerToken(request: Request): string {
  return request.headers.get('x-owner-token')?.trim().slice(0, 120) || ''
}
