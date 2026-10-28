import * as Sentry from '@sentry/astro'
import type { NeonQueryFunction } from '@neondatabase/serverless'
import type { Db } from './db'
import { redactSecrets } from './adminSecurity'

export type AuditActor = 'admin' | 'public' | 'script'

// Registro fuera de transacción para eventos sueltos (reportes, inicios de sesión):
// si falla se avisa a Sentry, pero no se bloquea la petición.
export async function logAudit(sql: NeonQueryFunction<false, false>, action: string, details: Record<string, unknown> = {}, meta: { entityType?: string; entityId?: string | number; actor?: AuditActor } = {}) {
  try {
    await sql`
      INSERT INTO audit_logs (action, details, entity_type, entity_id, actor)
      VALUES (${action}, ${JSON.stringify(redactSecrets(details))}, ${meta.entityType || ''}, ${String(meta.entityId ?? '')}, ${meta.actor || 'public'})
    `
  } catch (error) {
    console.error('audit log failed:', error)
    Sentry.captureException(error, {
      tags: { feature: 'audit-log', action },
      fingerprint: ['audit-log', 'write-failed'],
    })
  }
}

// Registro dentro de la transacción de la modificación: si no se puede auditar, no se modifica nada.
export async function logAuditTx(db: Db, entry: {
  action: string
  entityType: string
  entityId: string | number
  actor: AuditActor
  changedFields?: string[]
  details?: Record<string, unknown>
}) {
  await db.query(
    `INSERT INTO audit_logs (action, entity_type, entity_id, actor, changed_fields, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      entry.action,
      entry.entityType,
      String(entry.entityId),
      entry.actor,
      JSON.stringify((entry.changedFields || []).filter((field) => redactSecrets({ [field]: 1 })[field] !== undefined)),
      JSON.stringify(redactSecrets(entry.details || {}))
    ]
  )
}

// Campos que cambian entre dos versiones y sus valores (las preguntas se resumen por número).
export function diffFields(before: Record<string, unknown>, after: Record<string, unknown>, fields: string[]) {
  const changed: string[] = []
  const from: Record<string, unknown> = {}
  const to: Record<string, unknown> = {}

  for (const field of fields) {
    const previous = before[field]
    const next = after[field]
    if (JSON.stringify(previous ?? null) === JSON.stringify(next ?? null)) continue

    changed.push(field)
    if (field === 'questions') {
      from.questions = Array.isArray(previous) ? `${previous.length} preguntas` : null
      to.questions = Array.isArray(next) ? `${next.length} preguntas` : null
    } else {
      from[field] = previous ?? null
      to[field] = next ?? null
    }
  }

  return { changed, from, to }
}
