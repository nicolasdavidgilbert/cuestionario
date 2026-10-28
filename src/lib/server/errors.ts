export interface FieldError {
  field: string
  message: string
}

// Error esperado de una operación (validación, conflicto, permisos). Las APIs lo convierten
// en una respuesta con su código y los errores por campo; el resto se trata como error interno.
export class ServiceError extends Error {
  status: number
  code: string
  errors: FieldError[]
  details: Record<string, unknown>

  constructor(status: number, code: string, message: string, options: { errors?: FieldError[]; details?: Record<string, unknown> } = {}) {
    super(message)
    this.status = status
    this.code = code
    this.errors = options.errors || []
    this.details = options.details || {}
  }

  toJSON() {
    return { message: this.message, code: this.code, errors: this.errors, ...this.details }
  }
}

export const notFound = (message = 'No encontrado') => new ServiceError(404, 'not_found', message)
export const unauthorized = (message = 'No autorizado') => new ServiceError(401, 'unauthorized', message)
export const badRequest = (message: string, errors: FieldError[] = []) => new ServiceError(400, 'invalid', message, { errors })
