import { createHash } from 'node:crypto'
import { getDb, withTransaction, type Db } from './db'
import { ServiceError } from './errors'
import { logAuditTx, type AuditActor } from './audit'
import { invalidateCatalogCache } from './catalogCache'
import { createQuizTx, QUIZ_COLUMNS, updateQuizTx } from './quizService'
import { toCsv } from './csv'
import {
  IMPORT_BATCH_SIZE, IMPORT_FORMAT, IMPORT_VERSION,
  parseImportFile, planImport, routeKey, summarizePlan,
  type ExistingState, type ImportRecord
} from './importPlan'

// Exportaciones e importaciones de contenido. Nunca incluyen tokens de propietario, sesiones ni credenciales:
// las consultas solo seleccionan columnas de contenido. La copia completa de la base de datos sigue siendo cosa de Neon.

// Vercel limita el cuerpo de la petición a 4,5 MB.
export const IMPORT_MAX_BYTES = 4 * 1024 * 1024

async function readCatalogRows(db: Db) {
  const [grades, subjects, topics] = await Promise.all([
    db.query('SELECT id, name, short, description, sort_order FROM catalog_grades ORDER BY sort_order, id'),
    db.query('SELECT grade_id, id, name, description, sort_order FROM catalog_subjects ORDER BY grade_id, sort_order, id'),
    db.query('SELECT grade_id, subject_id, id, name, description, sort_order FROM catalog_topics ORDER BY grade_id, subject_id, sort_order, id')
  ])
  return { grades, subjects, topics }
}

export async function exportContent(options: { scope: 'all' | 'catalog'; includeTrash: boolean }) {
  const db = getDb()
  const catalog = await readCatalogRows(db)
  const quizzes = options.scope === 'catalog'
    ? undefined
    : await db.query(`SELECT ${QUIZ_COLUMNS} FROM user_quizzes ${options.includeTrash ? '' : 'WHERE deleted_at IS NULL'} ORDER BY id`)

  return {
    format: IMPORT_FORMAT,
    version: IMPORT_VERSION,
    exported_at: new Date().toISOString(),
    catalog,
    ...(quizzes ? { quizzes } : {})
  }
}

export async function exportQuizzesCsv() {
  const rows = await getDb().query(
    `SELECT q.id, q.title, q.grado, q.course_id, COALESCE(NULLIF(q.unidad, ''), q.course_id) AS topic, t.name AS topic_name,
       jsonb_array_length(q.questions) AS question_count, CASE WHEN q.deleted_at IS NULL THEN 'publicado' ELSE 'papelera' END AS status,
       q.version, q.created_at, q.updated_at, q.deleted_at,
       '/' || q.grado || '/' || q.course_id || '/' || COALESCE(NULLIF(q.unidad, ''), q.course_id) AS path
     FROM user_quizzes q
     LEFT JOIN catalog_topics t ON t.grade_id = q.grado AND t.subject_id = q.course_id AND t.id = COALESCE(NULLIF(q.unidad, ''), q.course_id)
     ORDER BY q.id`
  )
  return toCsv([
    { key: 'id', label: 'ID' }, { key: 'title', label: 'Título' }, { key: 'grado', label: 'Curso' },
    { key: 'course_id', label: 'Asignatura' }, { key: 'topic', label: 'Tema' }, { key: 'topic_name', label: 'Nombre del tema' },
    { key: 'question_count', label: 'Preguntas' }, { key: 'status', label: 'Estado' }, { key: 'version', label: 'Versión' },
    { key: 'path', label: 'Ruta' }, { key: 'created_at', label: 'Creado' }, { key: 'updated_at', label: 'Actualizado' },
    { key: 'deleted_at', label: 'Enviado a la papelera' }
  ], rows)
}

export async function exportIssuesCsv() {
  const rows = await getDb().query(
    `SELECT r.id, r.status, r.priority, r.kind, r.title, r.reason, r.internal_notes, r.quiz_id, q.title AS quiz_title,
       r.created_at, r.updated_at, r.resolved_at
     FROM quiz_reports r LEFT JOIN user_quizzes q ON q.id = r.quiz_id ORDER BY r.id`
  )
  return toCsv([
    { key: 'id', label: 'ID' }, { key: 'status', label: 'Estado' }, { key: 'priority', label: 'Prioridad' },
    { key: 'kind', label: 'Tipo' }, { key: 'title', label: 'Título' }, { key: 'reason', label: 'Descripción' },
    { key: 'internal_notes', label: 'Notas internas' }, { key: 'quiz_id', label: 'Cuestionario' },
    { key: 'quiz_title', label: 'Título del cuestionario' }, { key: 'created_at', label: 'Creada' },
    { key: 'updated_at', label: 'Actualizada' }, { key: 'resolved_at', label: 'Cerrada' }
  ], rows)
}

async function loadExistingState(db: Db): Promise<ExistingState> {
  const [{ grades, subjects, topics }, quizzes] = await Promise.all([
    readCatalogRows(db),
    db.query<ExistingState['quizzes'] extends Map<number, infer Q> ? Q : never>(
      'SELECT id, version, title, description, quiz_hash, grado, course_id, unidad, deleted_at FROM user_quizzes'
    )
  ])

  const state: ExistingState = {
    grades: new Map(grades.map((row) => [String(row.id), row])),
    subjects: new Map(subjects.map((row) => [`${row.grade_id}/${row.id}`, row])),
    topics: new Map(topics.map((row) => [`${row.grade_id}/${row.subject_id}/${row.id}`, row])),
    quizzes: new Map(quizzes.map((row) => [row.id, row])),
    activeRoutes: new Map(),
    activeHashes: new Map()
  }
  for (const quiz of quizzes) {
    if (quiz.deleted_at) continue
    state.activeRoutes.set(routeKey(quiz), quiz.id)
    if (quiz.quiz_hash) state.activeHashes.set(quiz.quiz_hash, quiz.id)
  }
  return state
}

function fileId(text: string) {
  return createHash('sha256').update(text).digest('hex').slice(0, 32)
}

function checkSize(text: unknown): string {
  if (typeof text !== 'string' || !text.trim()) throw new ServiceError(400, 'invalid_file', 'Selecciona un archivo JSON de exportación')
  if (Buffer.byteLength(text) > IMPORT_MAX_BYTES) throw new ServiceError(400, 'invalid_file', 'El archivo supera 4 MB')
  return text
}

function publicRecord(record: ImportRecord) {
  const { quiz: _quiz, data: _data, ...rest } = record
  return rest
}

export async function previewImport(text: unknown) {
  const content = checkSize(text)
  const file = parseImportFile(content)
  const records = planImport(file, await loadExistingState(getDb()))
  return { previewId: fileId(content), summary: summarizePlan(records), records: records.map(publicRecord) }
}

async function applyRecord(db: Db, record: ImportRecord, actor: AuditActor) {
  const data = record.data || {}
  if (record.kind === 'quiz') {
    if (record.action === 'create') {
      await createQuizTx(db, record.quiz!, { actor, deletedAt: record.quiz!.deleted_at, action: 'quiz_imported' })
    } else {
      await updateQuizTx(db, record.targetId!, { expectedVersion: record.expectedVersion, changes: { ...record.quiz! }, actor, action: 'quiz_imported' })
    }
    return
  }

  const sortOrder = data.sort_order ?? null
  if (record.kind === 'grade') {
    await db.query(
      record.action === 'create'
        ? `INSERT INTO catalog_grades (id, name, short, description, sort_order) VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_grades)))`
        : `UPDATE catalog_grades SET name = $2, short = $3, description = $4, sort_order = COALESCE($5, sort_order), updated_at = NOW() WHERE id = $1`,
      [data.id, data.name, data.short, data.description, sortOrder]
    )
  } else if (record.kind === 'subject') {
    await db.query(
      record.action === 'create'
        ? `INSERT INTO catalog_subjects (grade_id, id, name, description, sort_order) VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_subjects WHERE grade_id = $1)))`
        : `UPDATE catalog_subjects SET name = $3, description = $4, sort_order = COALESCE($5, sort_order), updated_at = NOW() WHERE grade_id = $1 AND id = $2`,
      [data.grade_id, data.id, data.name, data.description, sortOrder]
    )
  } else {
    await db.query(
      record.action === 'create'
        ? `INSERT INTO catalog_topics (grade_id, subject_id, id, name, description, sort_order) VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2)))`
        : `UPDATE catalog_topics SET name = $4, description = $5, sort_order = COALESCE($6, sort_order), updated_at = NOW() WHERE grade_id = $1 AND subject_id = $2 AND id = $3`,
      [data.grade_id, data.subject_id, data.id, data.name, data.description, sortOrder]
    )
  }
  await logAuditTx(db, {
    action: record.action === 'create' ? 'catalog_imported' : 'catalog_import_updated',
    entityType: record.kind,
    entityId: record.ref.slice(record.kind.length + 1),
    actor,
    changedFields: ['name', 'description', 'sort_order', ...(record.kind === 'grade' ? ['short'] : [])]
  })
}

// Vuelve a planificar con el estado actual (no se confía en la vista previa del navegador) y escribe
// por lotes de 100 registros: cada lote se confirma entero o no se escribe nada de él.
export async function commitImport(input: { text: unknown; previewId: unknown; confirmUpdates?: unknown }, actor: AuditActor = 'admin') {
  const content = checkSize(input.text)
  if (input.previewId !== fileId(content)) {
    throw new ServiceError(409, 'preview_mismatch', 'El archivo no coincide con la vista previa. Vuelve a generarla.')
  }
  const confirmed = new Set(Array.isArray(input.confirmUpdates) ? input.confirmUpdates.map(String) : [])
  const records = planImport(parseImportFile(content), await loadExistingState(getDb()))

  const toApply = records.filter((record) => record.action === 'create' || (record.action === 'update' && confirmed.has(record.ref)))
  const skipped = records.filter((record) => !toApply.includes(record)).map((record) => ({
    ref: record.ref,
    label: record.label,
    reason: record.action === 'update' ? 'Actualización no confirmada' : record.action === 'unchanged' ? 'Sin cambios' : record.messages.join('; ')
  }))

  const batches: { index: number; refs: string[]; ok: boolean; error?: string }[] = []
  for (let start = 0; start < toApply.length; start += IMPORT_BATCH_SIZE) {
    const batch = toApply.slice(start, start + IMPORT_BATCH_SIZE)
    let current: ImportRecord | null = null
    try {
      await withTransaction(async (db) => {
        for (const record of batch) {
          current = record
          await applyRecord(db, record, actor)
        }
      })
      batches.push({ index: batches.length + 1, refs: batch.map((record) => record.ref), ok: true })
    } catch (error) {
      const failed = current as ImportRecord | null
      const message = error instanceof Error ? error.message : 'Error desconocido'
      batches.push({
        index: batches.length + 1,
        refs: batch.map((record) => record.ref),
        ok: false,
        error: `${failed ? `${failed.label}: ` : ''}${message}. No se ha escrito ningún registro de este lote.`
      })
    }
  }

  invalidateCatalogCache()
  const written = batches.filter((batch) => batch.ok).reduce((sum, batch) => sum + batch.refs.length, 0)
  return { written, failed: toApply.length - written, skipped, batches }
}
