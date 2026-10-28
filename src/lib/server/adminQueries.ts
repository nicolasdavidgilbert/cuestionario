import { getDb } from './db'

// Consultas de solo lectura del panel. Todas paginan en el servidor.

export const ADMIN_PAGE_SIZE = 25

export function readPage(url: URL) {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1))
  return { page, offset: (page - 1) * ADMIN_PAGE_SIZE }
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`)
}

// Construye condiciones con parámetros numerados ($1, $2...).
function createWhere() {
  const conditions: string[] = []
  const params: unknown[] = []
  return {
    add(sql: (next: () => string) => string) { conditions.push(sql(() => `$${params.length + 1}`)) },
    param(value: unknown) { params.push(value); return `$${params.length}` },
    sql() { return conditions.length ? `WHERE ${conditions.join(' AND ')}` : '' },
    params
  }
}

export interface QuizListFilters { q?: string; grade?: string; subject?: string; topic?: string; status?: string; page: number; offset: number }

export async function listQuizzes(filters: QuizListFilters) {
  const where = createWhere()
  where.add(() => filters.status === 'papelera' ? 'q.deleted_at IS NOT NULL' : 'q.deleted_at IS NULL')
  if (filters.grade) where.add(() => `q.grado = ${where.param(filters.grade)}`)
  if (filters.subject) where.add(() => `q.course_id = ${where.param(filters.subject)}`)
  if (filters.topic) where.add(() => `COALESCE(NULLIF(q.unidad, ''), q.course_id) = ${where.param(filters.topic)}`)
  if (filters.q) {
    const term = `%${escapeLike(filters.q)}%`
    const asId = /^\d+$/.test(filters.q) ? Number(filters.q) : 0
    where.add(() => {
      const p = where.param(term)
      const idParam = where.param(asId)
      return `(q.id = ${idParam} OR q.title ILIKE ${p} OR q.description ILIKE ${p} OR q.grado ILIKE ${p} OR q.course_id ILIKE ${p} OR q.unidad ILIKE ${p} OR t.name ILIKE ${p})`
    })
  }

  const from = `FROM user_quizzes q
    LEFT JOIN catalog_topics t ON t.grade_id = q.grado AND t.subject_id = q.course_id AND t.id = COALESCE(NULLIF(q.unidad, ''), q.course_id)`
  const db = getDb()
  const [rows, total] = await Promise.all([
    db.query(
      `SELECT q.id, q.title, q.description, q.grado, q.course_id, q.unidad, q.version, q.created_at, q.updated_at, q.deleted_at,
         COALESCE(NULLIF(q.unidad, ''), q.course_id) AS topic, t.name AS topic_name,
         jsonb_array_length(q.questions) AS question_count,
         (SELECT COUNT(*)::int FROM quiz_reports r WHERE r.quiz_id = q.id AND r.status IN ('pendiente', 'en_revision')) AS open_issues
       ${from} ${where.sql()}
       ORDER BY ${filters.status === 'papelera' ? 'q.deleted_at DESC' : 'COALESCE(q.updated_at, q.created_at) DESC'}, q.id DESC
       LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${filters.offset}`,
      where.params
    ),
    db.query<{ count: number }>(`SELECT COUNT(*)::int AS count ${from} ${where.sql()}`, where.params)
  ])
  return { items: rows, total: total[0].count, page: filters.page, pageSize: ADMIN_PAGE_SIZE }
}

export async function searchQuestions(filters: { q?: string; grade?: string; subject?: string; topic?: string; page: number; offset: number }) {
  const where = createWhere()
  where.add(() => 'q.deleted_at IS NULL')
  if (filters.grade) where.add(() => `q.grado = ${where.param(filters.grade)}`)
  if (filters.subject) where.add(() => `q.course_id = ${where.param(filters.subject)}`)
  if (filters.topic) where.add(() => `COALESCE(NULLIF(q.unidad, ''), q.course_id) = ${where.param(filters.topic)}`)
  if (filters.q) {
    const p = where.param(`%${escapeLike(filters.q)}%`)
    where.add(() => `(item.value->>'question' ILIKE ${p} OR item.value->>'explanation' ILIKE ${p} OR (item.value->'options')::text ILIKE ${p})`)
  }

  const from = `FROM user_quizzes q CROSS JOIN LATERAL jsonb_array_elements(q.questions) WITH ORDINALITY AS item(value, position)`
  const db = getDb()
  const [rows, total] = await Promise.all([
    db.query(
      `SELECT q.id AS quiz_id, q.title AS quiz_title, q.grado, q.course_id, COALESCE(NULLIF(q.unidad, ''), q.course_id) AS topic,
         (item.position - 1)::int AS question_index, item.value->>'question' AS question,
         item.value->'options' AS options, (item.value->>'answer')::int AS answer
       ${from} ${where.sql()}
       ORDER BY q.grado, q.course_id, topic, q.id, item.position
       LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${filters.offset}`,
      where.params
    ),
    db.query<{ count: number }>(`SELECT COUNT(*)::int AS count ${from} ${where.sql()}`, where.params)
  ])
  return { items: rows, total: total[0].count, page: filters.page, pageSize: ADMIN_PAGE_SIZE }
}

export async function getSummary() {
  const db = getDb()
  const [totals, recent, issues] = await Promise.all([
    db.query(`SELECT
      (SELECT COUNT(*)::int FROM user_quizzes WHERE deleted_at IS NULL) AS quizzes,
      (SELECT COUNT(*)::int FROM user_quizzes WHERE deleted_at IS NOT NULL) AS trashed,
      (SELECT COALESCE(SUM(jsonb_array_length(questions)), 0)::int FROM user_quizzes WHERE deleted_at IS NULL) AS questions,
      (SELECT COUNT(*)::int FROM catalog_grades) AS grades,
      (SELECT COUNT(*)::int FROM catalog_subjects) AS subjects,
      (SELECT COUNT(*)::int FROM catalog_topics) AS topics,
      (SELECT COUNT(*)::int FROM quiz_reports WHERE status = 'pendiente') AS issues_pending,
      (SELECT COUNT(*)::int FROM quiz_reports WHERE status = 'en_revision') AS issues_reviewing`),
    db.query(`SELECT id, action, entity_type, entity_id, actor, changed_fields, created_at FROM audit_logs ORDER BY created_at DESC, id DESC LIMIT 10`),
    db.query(`SELECT r.id, COALESCE(NULLIF(r.title, ''), left(r.reason, 80)) AS title, r.priority, r.status, r.kind, r.quiz_id, r.created_at
      FROM quiz_reports r WHERE r.status IN ('pendiente', 'en_revision')
      ORDER BY CASE r.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END, r.created_at DESC LIMIT 5`)
  ])
  return { totals: totals[0], recentActivity: recent, openIssues: issues }
}

export async function listAudit(filters: { entityType?: string; action?: string; entityId?: string; page: number; offset: number }) {
  const where = createWhere()
  if (filters.entityType) where.add(() => `entity_type = ${where.param(filters.entityType)}`)
  if (filters.action) where.add(() => `action = ${where.param(filters.action)}`)
  if (filters.entityId) where.add(() => `entity_id = ${where.param(filters.entityId)}`)

  const db = getDb()
  const [rows, total, actions] = await Promise.all([
    db.query(`SELECT id, action, entity_type, entity_id, actor, changed_fields, details, created_at FROM audit_logs ${where.sql()}
      ORDER BY created_at DESC, id DESC LIMIT ${ADMIN_PAGE_SIZE} OFFSET ${filters.offset}`, where.params),
    db.query<{ count: number }>(`SELECT COUNT(*)::int AS count FROM audit_logs ${where.sql()}`, where.params),
    db.query<{ action: string }>('SELECT DISTINCT action FROM audit_logs ORDER BY action')
  ])
  return { items: rows, total: total[0].count, page: filters.page, pageSize: ADMIN_PAGE_SIZE, actions: actions.map((row) => row.action) }
}
