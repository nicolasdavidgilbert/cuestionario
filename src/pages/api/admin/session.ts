import { adminRoute } from '../../../lib/server/adminRoute'

export const prerender = false

// Token CSRF de la sesión para las escrituras del panel (cabecera x-csrf-token).
// Otro origen no puede leer esta respuesta: no hay CORS y la cookie es SameSite=Strict.
export const GET = adminRoute('Error al leer la sesión', async ({ locals }) => ({
  csrfToken: locals.admin!.csrfToken,
  expiresAt: locals.admin!.expiresAt
}))
