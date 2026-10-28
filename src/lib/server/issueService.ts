import { getDb, withTransaction } from './db'
import { badRequest, notFound, type FieldError } from './errors'
import { diffFields, logAuditTx, type AuditActor } from './audit'
import { ADMIN_PAGE_SIZE } from './adminQueries'

// Incidencias: reportes públicos de un cuestionario y fallos generales creados desde el panel.

export const ISSUE_STATUSES = ['pendiente', 'en_revision', 'resuelta', 'descartada'] as const
export const ISSUE_PRIORITIES = ['baja', 'normal', 'alta', 'urgente'] as const
export const ISSUE_KINDS = ['contenido', 'error', 'mejora', 'otro'] as const
const CLOSED = new Set(['resuelta', 'descartada'])

const ISSUE_COLUMNS = `r.id, r.quiz_id, r.title, r.reason, r.kind, r.priority, r.status, r.internal_notes,
  r.created_at, r.updated_at, r.resolved_at,
  q.title AS quiz_title, q.grado, q.course_id, COALESCE(NULLIF(q.unidad, ''), q.course_id) AS topic, q.deleted_at AS quiz_deleted_at`

function readIssueInput(data: Record<string, unknown>, partial: boolean) {
  const errors: FieldError[] = []
  const result: Record<string, unknown> = {}

  const text = (field: string, label: string, max: number, required: boolean) => {
    if (data[field] === undefined) {
      if (!partial && required) errors.push({ field, message: `${label} es obligatorio` })
      return
    }
    const value = typeof data[field] === 'string' ? (data[field] as string).trim() : ''
    if (required && !value) errors.push({ field, message: `${label} es obligatorio` })
    else if (value.length > max) errors.push({ field, message: `${label} no puede superar ${max} caracteres` })
    else result[field] = value
  }
  const choice = (field: string, label: string, options: readonly string[]) => {
    if (data[field] === undefined) return
    if (!options.includes(String(data[field]))) errors.push({ field, message: `${label} no es válido` })
    else result[field] = String(data[field])
  }

  text('title', 'El título', 160, true)
  text('reason', 'La descripción', 2000, true)
  text('internal_notes', 'Las notas internas', 5000, false)
  choice('kind', 'El tipo', ISSUE_KINDS)
  choice('priority', 'La prioridad', ISSUE_PRIORITIES)
  choice('status', 'El estado', ISSUE_STATUSES)

  if (data.quiz_id !== undefined && data.quiz_id !== null && data.quiz_id !== '') {
    const quizId = Number(data.quiz_id)
    if (!Number.isInteger(quizId) || quizId <= 0) errors.push({ field: 'quiz_id', message: 'El cuestionario no es válido' })
    else result.quiz_id = quizId
  }

  if (errors.length > 0) throw badRequest('Revisa los campos marcados', errors)
  return result
}

export async function listIssues(filters: { status?: string; priority?: string; kind?: string; q?: string; quizId?: number; page: number; offset: number }) {
  const conditions: string[] = []
  const params: unknown[] = []
  const param = (value: unknown) => { params.push(value); return `$${params.length}` }

  if (filters.status === 'abiertas') conditions.push(`r.status IN ('pendiente', 'en_revision')`)
  else if (filters.status && (ISSUE_STATUSES as readonly string[]).includes(filters.status)) conditions.push(`r.status = ${param(filters.status)}`)
  if (filters.priority) conditions.push(`r.priority = ${param(filters.priority)}`)
  if (filters.kind) conditions.push(`r.kind = ${param(filters.kind)}`)
  if (filters.quizId) conditions.push(`r.quiz_id = ${param(filters.quizId)}`)
  if (filters.q) {
    const p = param(`%${filters.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`)
    conditions.push(`(r.title ILIKE ${p} OR r.reason ILIKE ${p} OR r.internal_notes ILIKE ${p} OR q.title ILIKE ${p})`)
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
  const from = 'FROM quiz_reports r LEFT JOIN user_quizzes q ON q.id = r.quiz_id'

  const db = getDb()
  const [rows, total] = await Promise.all([
    db.query(`SELECT ${ISSUE_COLUMNS} ${from} ${where}
      ORDER BY CASE WHEN r.status IN ('pendiente', 'en_revision') THEN 0 ELSE 1 END,
        CASE r.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
        r.created_at DESC, r.id DESC
      LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${filters.offset}`, params),
    db.query<{ count: number }>(`SELECT COUNT(*)::int AS count ${from} ${where}`, params)
  ])
  return { items: rows, total: total[0].count, page: filters.page, pageSize: ADMIN_PAGE_SIZE }
}

export async function getIssue(id: number) {
  if (!Number.isInteger(id) || id <= 0) throw notFound('Incidencia no encontrada')
  const rows = await getDb().query(`SELECT ${ISSUE_COLUMNS} FROM quiz_reports r LEFT JOIN user_quizzes q ON q.id = r.quiz_id WHERE r.id = $1`, [id])
  if (rows.length === 0) throw notFound('Incidencia no encontrada')
  return rows[0]
}

export async function createIssue(data: Record<string, unknown>, actor: AuditActor = 'admin') {
  const input = readIssueInput(data, false)

  const id = await withTransaction(async (db) => {
    if (input.quiz_id) {
      const quiz = await db.query('SELECT id FROM user_quizzes WHERE id = $1', [input.quiz_id])
      if (quiz.length === 0) throw badRequest('Revisa los campos marcados', [{ field: 'quiz_id', message: 'No existe ese cuestionario' }])
    }
    const rows = await db.query<{ id: number }>(
      `INSERT INTO quiz_reports (quiz_id, title, reason, kind, priority, status, internal_notes, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'pendiente', $6, NOW()) RETURNING id`,
      [input.quiz_id ?? null, input.title, input.reason, input.kind ?? 'error', input.priority ?? 'normal', input.internal_notes ?? '']
    )
    await logAuditTx(db, {
      action: 'issue_created',
      entityType: 'issue',
      entityId: rows[0].id,
      actor,
      changedFields: Object.keys(input),
      details: { quiz_id: input.quiz_id ?? null, kind: input.kind ?? 'error' }
    })
    return rows[0].id
  })
  return getIssue(id)
}

export async function updateIssue(id: number, data: Record<string, unknown>, actor: AuditActor = 'admin') {
  const input = readIssueInput(data, true)
  delete input.quiz_id

  await withTransaction(async (db) => {
    const rows = await db.query('SELECT id, title, reason, kind, priority, status, internal_notes FROM quiz_reports WHERE id = $1 FOR UPDATE', [id])
    if (rows.length === 0) throw notFound('Incidencia no encontrada')
    const current = rows[0]
    const next = { ...current, ...input }
    const diff = diffFields(current, next, ['title', 'reason', 'kind', 'priority', 'status', 'internal_notes'])
    if (diff.changed.length === 0) return

    const closing = CLOSED.has(String(next.status)) && !CLOSED.has(String(current.status))
    const reopening = !CLOSED.has(String(next.status)) && CLOSED.has(String(current.status))

    await db.query(
      `UPDATE quiz_reports SET title = $2, reason = $3, kind = $4, priority = $5, status = $6, internal_notes = $7, updated_at = NOW(),
         resolved_at = CASE WHEN $8::boolean THEN NOW() WHEN $9::boolean THEN NULL ELSE resolved_at END
       WHERE id = $1`,
      [id, next.title, next.reason, next.kind, next.priority, next.status, next.internal_notes, closing, reopening]
    )
    // Las notas internas se registran como campo modificado, sin copiar su contenido.
    const { internal_notes: _fromNotes, ...from } = diff.from
    const { internal_notes: _toNotes, ...to } = diff.to
    await logAuditTx(db, {
      action: closing ? `issue_${next.status === 'resuelta' ? 'resolved' : 'dismissed'}` : 'issue_updated',
      entityType: 'issue',
      entityId: id,
      actor,
      changedFields: diff.changed,
      details: { from, to }
    })
  })
  return getIssue(id)
}
