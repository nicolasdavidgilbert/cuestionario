import type { QuizQuestion } from '../quizValidator'
import { getQuizHash } from './hash'
import { prepareQuiz, quizPath, type PreparedQuiz } from './quizRules'
import { isUniqueViolation, withTransaction, type Db } from './db'
import { ServiceError, badRequest, notFound, unauthorized } from './errors'

export { prepareQuiz, quizPath, type PreparedQuiz }
import { diffFields, logAuditTx, type AuditActor } from './audit'
import { ensureCatalogPath, topicIdOf } from './catalogCache'
import { safeEqual } from './adminSecurity'

// Lógica única de cuestionarios para la web pública y el panel: mismas reglas de validación,
// hash, duplicados, colisiones de ruta, control de versiones y auditoría.

// Columnas que se pueden devolver: owner_token nunca sale de la base de datos.
export const QUIZ_COLUMNS = 'id, title, description, grado, course_id, unidad, questions, version, created_at, updated_at, deleted_at'

const CONTENT_FIELDS = ['title', 'description', 'grado', 'course_id', 'unidad', 'questions']
const PUBLIC_EDITABLE = ['title', 'description', 'questions']

export interface QuizRecord {
  id: number
  title: string
  description: string
  grado: string
  course_id: string
  unidad: string
  questions: QuizQuestion[]
  version: number
  created_at: string
  updated_at: string | null
  deleted_at: string | null
}

// Un único cuestionario activo por ruta pública y sin copias idénticas activas.
async function assertAvailable(db: Db, quiz: { grado: string; course_id: string; unidad: string; quiz_hash: string }, excludeId = 0) {
  const route = await db.query<{ id: number }>(
    `SELECT id FROM user_quizzes
     WHERE deleted_at IS NULL AND id <> $1 AND grado = $2 AND course_id = $3
       AND COALESCE(NULLIF(unidad, ''), course_id) = $4
     LIMIT 1`,
    [excludeId, quiz.grado, quiz.course_id, topicIdOf(quiz)]
  )
  if (route.length > 0) {
    throw new ServiceError(409, 'route_collision',
      `Ya existe un cuestionario publicado en ${quizPath(quiz)} (n.º ${route[0].id})`,
      { errors: [{ field: 'unidad', message: 'Ese tema ya tiene un cuestionario publicado' }], details: { id: route[0].id, path: quizPath(quiz) } })
  }

  const duplicate = await db.query<{ id: number }>(
    'SELECT id FROM user_quizzes WHERE deleted_at IS NULL AND id <> $1 AND quiz_hash = $2 LIMIT 1',
    [excludeId, quiz.quiz_hash]
  )
  if (duplicate.length > 0) {
    throw new ServiceError(409, 'duplicate', `Ya existe otro cuestionario idéntico (n.º ${duplicate[0].id})`, { details: { id: duplicate[0].id } })
  }
}

// Las restricciones únicas cubren las carreras entre dos guardados simultáneos.
function mapUniqueViolation(error: unknown): never {
  if (isUniqueViolation(error, 'idx_user_quizzes_route_active')) {
    throw new ServiceError(409, 'route_collision', 'Ya existe un cuestionario publicado para ese grado, asignatura y tema')
  }
  if (isUniqueViolation(error, 'idx_user_quizzes_hash_active')) {
    throw new ServiceError(409, 'duplicate', 'Este cuestionario ya existe')
  }
  throw error
}

async function lockQuiz(db: Db, id: number) {
  if (!Number.isInteger(id) || id <= 0) throw badRequest('ID inválido')
  const rows = await db.query<QuizRecord & { owner_token: string }>(
    `SELECT ${QUIZ_COLUMNS}, owner_token FROM user_quizzes WHERE id = $1 FOR UPDATE`,
    [id]
  )
  if (rows.length === 0) throw notFound('Cuestionario no encontrado')
  return rows[0]
}

function assertOwner(current: { owner_token: string }, actor: AuditActor, ownerToken = '') {
  // 'script' (clave técnica) y 'admin' (sesión) ya se han autenticado antes de llegar aquí.
  if (actor === 'public' && !(current.owner_token && safeEqual(current.owner_token, ownerToken))) {
    throw unauthorized()
  }
}

function withoutOwner<T extends { owner_token?: string }>(row: T): Omit<T, 'owner_token'> {
  const { owner_token: _ownerToken, ...rest } = row
  return rest
}

export async function getQuiz(db: Db, id: number, options: { includeDeleted?: boolean } = {}): Promise<QuizRecord | null> {
  if (!Number.isInteger(id) || id <= 0) return null
  const rows = await db.query<QuizRecord>(
    `SELECT ${QUIZ_COLUMNS} FROM user_quizzes WHERE id = $1 ${options.includeDeleted ? '' : 'AND deleted_at IS NULL'}`,
    [id]
  )
  return rows[0] || null
}

export async function createQuiz(input: unknown, options: { actor: AuditActor; ownerToken?: string }): Promise<QuizRecord> {
  const quiz = prepareQuiz(input)
  return withTransaction((db) => createQuizTx(db, quiz, options))
}

// Variante dentro de una transacción abierta (importación por lotes). deletedAt crea el cuestionario ya en la papelera.
export async function createQuizTx(db: Db, quiz: PreparedQuiz, options: { actor: AuditActor; ownerToken?: string; deletedAt?: string | null; action?: string }): Promise<QuizRecord> {
  if (!options.deletedAt) await assertAvailable(db, quiz)
  await ensureCatalogPath(db, quiz)

  const rows = await db.query<QuizRecord>(
    `INSERT INTO user_quizzes (title, description, grado, course_id, unidad, questions, quiz_hash, owner_token, deleted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING ${QUIZ_COLUMNS}`,
    [quiz.title, quiz.description, quiz.grado, quiz.course_id, quiz.unidad, JSON.stringify(quiz.questions), quiz.quiz_hash, options.ownerToken || '', options.deletedAt || null]
  ).catch(mapUniqueViolation)

  await logAuditTx(db, {
    action: options.action || 'quiz_created',
    entityType: 'quiz',
    entityId: rows[0].id,
    actor: options.actor,
    changedFields: CONTENT_FIELDS,
    details: { path: quizPath(quiz), questions: quiz.questions.length }
  })
  return rows[0]
}

export async function updateQuiz(id: number, options: {
  expectedVersion: unknown
  changes: Record<string, unknown>
  actor: AuditActor
  ownerToken?: string
}): Promise<QuizRecord> {
  return withTransaction((db) => updateQuizTx(db, id, options))
}

export async function updateQuizTx(db: Db, id: number, options: {
  expectedVersion: unknown
  changes: Record<string, unknown>
  actor: AuditActor
  ownerToken?: string
  action?: string
}): Promise<QuizRecord> {
  if (!Number.isInteger(options.expectedVersion)) {
    throw new ServiceError(428, 'version_required', 'Falta la versión del cuestionario. Recarga la página e inténtalo de nuevo.')
  }

  const current = await lockQuiz(db, id)
  assertOwner(current, options.actor, options.ownerToken)
  if (current.deleted_at) {
    throw new ServiceError(409, 'in_trash', 'El cuestionario está en la papelera. Restáuralo antes de editarlo.')
  }
  if (current.version !== options.expectedVersion) {
    throw new ServiceError(409, 'version_conflict',
      'Se han guardado otros cambios en este cuestionario mientras lo editabas. Recarga para ver la versión actual; tus cambios no se han guardado.',
      { details: { current: withoutOwner(current) } })
  }

  // La edición pública no puede mover el cuestionario: grado, asignatura y tema definen su URL.
  const editable = options.actor === 'public' ? PUBLIC_EDITABLE : CONTENT_FIELDS
  const merged: Record<string, unknown> = { ...current }
  for (const field of editable) {
    if (options.changes[field] !== undefined) merged[field] = options.changes[field]
  }

  const quiz = prepareQuiz(merged)
  const diff = diffFields(current as unknown as Record<string, unknown>, quiz as unknown as Record<string, unknown>, CONTENT_FIELDS)
  if (diff.changed.length === 0) return withoutOwner(current) as QuizRecord

  await assertAvailable(db, quiz, id)
  await ensureCatalogPath(db, quiz)

  const rows = await db.query<QuizRecord>(
    `UPDATE user_quizzes
     SET title = $2, description = $3, grado = $4, course_id = $5, unidad = $6, questions = $7,
         quiz_hash = $8, version = version + 1, updated_at = NOW()
     WHERE id = $1
     RETURNING ${QUIZ_COLUMNS}`,
    [id, quiz.title, quiz.description, quiz.grado, quiz.course_id, quiz.unidad, JSON.stringify(quiz.questions), quiz.quiz_hash]
  ).catch(mapUniqueViolation)

  await logAuditTx(db, {
    action: options.action || 'quiz_updated',
    entityType: 'quiz',
    entityId: id,
    actor: options.actor,
    changedFields: diff.changed,
    details: { from: diff.from, to: diff.to, version: rows[0].version }
  })
  return rows[0]
}

export async function trashQuiz(id: number, options: { actor: AuditActor; ownerToken?: string; reason?: string }): Promise<QuizRecord> {
  return withTransaction(async (db) => {
    const current = await lockQuiz(db, id)
    assertOwner(current, options.actor, options.ownerToken)
    if (current.deleted_at) throw notFound('Cuestionario no encontrado')

    const rows = await db.query<QuizRecord>(
      `UPDATE user_quizzes SET deleted_at = NOW(), version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING ${QUIZ_COLUMNS}`,
      [id]
    )
    await logAuditTx(db, {
      action: 'quiz_trashed',
      entityType: 'quiz',
      entityId: id,
      actor: options.actor,
      changedFields: ['deleted_at'],
      details: { path: quizPath(current), reason: options.reason || '' }
    })
    return rows[0]
  })
}

// Al restaurar se recalcula el hash y se comprueba que la ruta y el contenido sigan libres.
export async function restoreQuiz(id: number, options: { actor: AuditActor }): Promise<QuizRecord> {
  return withTransaction(async (db) => {
    const current = await lockQuiz(db, id)
    if (!current.deleted_at) throw new ServiceError(409, 'not_in_trash', 'El cuestionario no está en la papelera')

    const quiz_hash = getQuizHash(current)
    await assertAvailable(db, { ...current, quiz_hash }, id)
    await ensureCatalogPath(db, current)

    const rows = await db.query<QuizRecord>(
      `UPDATE user_quizzes SET deleted_at = NULL, quiz_hash = $2, version = version + 1, updated_at = NOW()
       WHERE id = $1 RETURNING ${QUIZ_COLUMNS}`,
      [id, quiz_hash]
    ).catch(mapUniqueViolation)

    await logAuditTx(db, {
      action: 'quiz_restored',
      entityType: 'quiz',
      entityId: id,
      actor: options.actor,
      changedFields: ['deleted_at'],
      details: { path: quizPath(current) }
    })
    return rows[0]
  })
}

// Reasignación desde el catálogo: cambia solo la clasificación, sin exigir que las preguntas
// cumplan los límites actuales (puede haber contenido antiguo). Se ejecuta en la transacción del llamante.
export async function moveQuizTx(db: Db, current: QuizRecord, target: { grado: string; course_id: string; unidad: string }, actor: AuditActor) {
  const next = { ...current, ...target }
  const quiz_hash = getQuizHash(next)
  if (!current.deleted_at) await assertAvailable(db, { ...next, quiz_hash }, current.id)
  await ensureCatalogPath(db, next)

  await db.query(
    `UPDATE user_quizzes SET grado = $2, course_id = $3, unidad = $4, quiz_hash = $5, version = version + 1, updated_at = NOW()
     WHERE id = $1`,
    [current.id, target.grado, target.course_id, target.unidad, quiz_hash]
  ).catch(mapUniqueViolation)

  const diff = diffFields(current as unknown as Record<string, unknown>, next, ['grado', 'course_id', 'unidad'])
  await logAuditTx(db, {
    action: 'quiz_reassigned',
    entityType: 'quiz',
    entityId: current.id,
    actor,
    changedFields: diff.changed,
    details: { from: quizPath(current), to: quizPath(next) }
  })
}
