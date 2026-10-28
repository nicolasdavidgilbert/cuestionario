import { getDb, withTransaction, type Db } from './db'
import { ServiceError, badRequest, notFound, type FieldError } from './errors'
import { diffFields, logAuditTx, type AuditActor } from './audit'
import { invalidateCatalogCache, readCatalogCache, topicIdOf, writeCatalogCache } from './catalogCache'
import { moveQuizTx, QUIZ_COLUMNS, type QuizRecord } from './quizService'
import { CATALOG_ID_PATTERN, CATALOG_LIMITS } from './catalogRules'

// Cursos/grados, asignaturas por curso y temas por asignatura, administrados desde el panel.
// Los identificadores forman las URLs públicas y no cambian una vez creados.

export type CatalogLevel = 'grade' | 'subject' | 'topic'

export interface CatalogTopic { id: string; name: string; description: string; sort_order: number }
export interface CatalogSubject { id: string; name: string; description: string; sort_order: number; topics: CatalogTopic[] }
export interface CatalogGrade { id: string; name: string; short: string; description: string; sort_order: number; subjects: CatalogSubject[] }
export interface Catalog { grades: CatalogGrade[] }

export interface CatalogKey { grade: string; subject?: string; topic?: string }


async function loadCatalog(db: Db): Promise<Catalog> {
  const [grades, subjects, topics] = await Promise.all([
    db.query<Omit<CatalogGrade, 'subjects'>>('SELECT id, name, short, description, sort_order FROM catalog_grades ORDER BY sort_order, name'),
    db.query<Omit<CatalogSubject, 'topics'> & { grade_id: string }>('SELECT grade_id, id, name, description, sort_order FROM catalog_subjects ORDER BY sort_order, name'),
    db.query<CatalogTopic & { grade_id: string; subject_id: string }>('SELECT grade_id, subject_id, id, name, description, sort_order FROM catalog_topics ORDER BY sort_order, name')
  ])

  return {
    grades: grades.map((grade) => ({
      ...grade,
      subjects: subjects
        .filter((subject) => subject.grade_id === grade.id)
        .map(({ grade_id: _grade, ...subject }) => ({
          ...subject,
          topics: topics
            .filter((topic) => topic.grade_id === grade.id && topic.subject_id === subject.id)
            .map(({ grade_id: _g, subject_id: _s, ...topic }) => topic)
        }))
    }))
  }
}

export async function getCatalog(options: { fresh?: boolean } = {}): Promise<Catalog> {
  if (!options.fresh) {
    const cached = readCatalogCache<Catalog>()
    if (cached) return cached
  }
  const catalog = await loadCatalog(getDb())
  writeCatalogCache(catalog)
  return catalog
}

// Consultas con nombres por defecto para identificadores que aún no estén en el catálogo.
export function gradeInfo(catalog: Catalog, gradeId: string) {
  const grade = catalog.grades.find((item) => item.id === gradeId)
  const label = (gradeId || '').toUpperCase()
  return {
    name: grade?.name || label,
    short: grade?.short || `Cuestionarios de ${label}`,
    description: grade?.description || `Cuestionarios tipo test de ${label} organizados por asignatura y tema.`,
    sort_order: grade?.sort_order ?? Number.MAX_SAFE_INTEGER
  }
}

export function subjectInfo(catalog: Catalog, gradeId: string, subjectId: string) {
  const subject = catalog.grades.find((item) => item.id === gradeId)?.subjects.find((item) => item.id === subjectId)
  return {
    name: subject?.name || (subjectId || '').toUpperCase(),
    description: subject?.description || '',
    sort_order: subject?.sort_order ?? Number.MAX_SAFE_INTEGER
  }
}

export function topicInfo(catalog: Catalog, gradeId: string, subjectId: string, topicId: string, fallback = '') {
  const topic = catalog.grades.find((item) => item.id === gradeId)
    ?.subjects.find((item) => item.id === subjectId)
    ?.topics.find((item) => item.id === topicId)
  return {
    name: topic?.name || fallback || (topicId || '').toUpperCase(),
    description: topic?.description || '',
    sort_order: topic?.sort_order ?? Number.MAX_SAFE_INTEGER
  }
}

// --- Panel ---------------------------------------------------------------------------------

export async function getCatalogForAdmin() {
  const db = getDb()
  const [catalog, counts] = await Promise.all([
    loadCatalog(db),
    db.query<{ grado: string; course_id: string; topic: string; active: number; trashed: number }>(
      `SELECT grado, course_id, COALESCE(NULLIF(unidad, ''), course_id) AS topic,
         COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
         COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trashed
       FROM user_quizzes GROUP BY 1, 2, 3`
    )
  ])
  return { catalog, counts }
}

function cleanText(value: unknown, max: number, field: string, label: string, errors: FieldError[], required = false) {
  const text = typeof value === 'string' ? value.trim() : ''
  if (required && !text) errors.push({ field, message: `${label} es obligatorio` })
  if (text.length > max) errors.push({ field, message: `${label} no puede superar ${max} caracteres` })
  return text
}

function cleanSortOrder(value: unknown, errors: FieldError[]) {
  if (value === undefined || value === null || value === '') return undefined
  const number = Number(value)
  if (!Number.isInteger(number) || Math.abs(number) > 1_000_000) {
    errors.push({ field: 'sort_order', message: 'El orden debe ser un número entero' })
    return undefined
  }
  return number
}

function validateId(value: unknown, field: string, errors: FieldError[]) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : ''
  if (!CATALOG_ID_PATTERN.test(id)) {
    errors.push({ field, message: 'Usa solo minúsculas, números, guiones y guiones bajos (máx. 60), sin empezar ni acabar en guion' })
  }
  return id
}

function parseKey(level: CatalogLevel, key: unknown): CatalogKey {
  const raw = (key && typeof key === 'object' ? key : {}) as Record<string, unknown>
  const result: CatalogKey = { grade: String(raw.grade || '') }
  if (level !== 'grade') result.subject = String(raw.subject || '')
  if (level === 'topic') result.topic = String(raw.topic || '')
  if (!result.grade || (level !== 'grade' && !result.subject) || (level === 'topic' && !result.topic)) {
    throw badRequest('Falta el identificador del elemento')
  }
  return result
}

function assertLevel(level: unknown): CatalogLevel {
  if (level === 'grade' || level === 'subject' || level === 'topic') return level
  throw badRequest('Tipo de elemento no válido')
}

const LEVEL_LABEL: Record<CatalogLevel, string> = { grade: 'curso', subject: 'asignatura', topic: 'tema' }

function keyLabel(key: CatalogKey) {
  return [key.grade, key.subject, key.topic].filter(Boolean).join('/')
}

async function lockEntry(db: Db, level: CatalogLevel, key: CatalogKey) {
  const rows = level === 'grade'
    ? await db.query('SELECT id, name, short, description, sort_order FROM catalog_grades WHERE id = $1 FOR UPDATE', [key.grade])
    : level === 'subject'
      ? await db.query('SELECT id, name, description, sort_order FROM catalog_subjects WHERE grade_id = $1 AND id = $2 FOR UPDATE', [key.grade, key.subject])
      : await db.query('SELECT id, name, description, sort_order FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2 AND id = $3 FOR UPDATE', [key.grade, key.subject, key.topic])
  if (rows.length === 0) throw notFound(`No existe ${LEVEL_LABEL[level] === 'asignatura' ? 'la' : 'el'} ${LEVEL_LABEL[level]} ${keyLabel(key)}`)
  return rows[0]
}

// Cuestionarios (activos y en papelera) bajo un elemento del catálogo.
function quizFilter(level: CatalogLevel, key: CatalogKey): [string, unknown[]] {
  if (level === 'grade') return ['grado = $1', [key.grade]]
  if (level === 'subject') return ['grado = $1 AND course_id = $2', [key.grade, key.subject]]
  return [`grado = $1 AND course_id = $2 AND COALESCE(NULLIF(unidad, ''), course_id) = $3`, [key.grade, key.subject, key.topic]]
}

export async function createCatalogEntry(input: { level: unknown; key?: unknown; data?: Record<string, unknown> }, actor: AuditActor = 'admin') {
  const level = assertLevel(input.level)
  const data = input.data || {}
  const errors: FieldError[] = []
  const id = validateId(data.id, 'id', errors)
  const name = cleanText(data.name, CATALOG_LIMITS.name, 'name', 'El nombre', errors, true)
  const description = cleanText(data.description, CATALOG_LIMITS.description, 'description', 'La descripción', errors)
  const short = level === 'grade' ? cleanText(data.short, CATALOG_LIMITS.short, 'short', 'El subtítulo', errors) : ''
  const sortOrder = cleanSortOrder(data.sort_order, errors)
  const parent = level === 'grade' ? { grade: '' } : parseKey(level === 'topic' ? 'subject' : 'grade', input.key)
  if (errors.length > 0) throw badRequest('Revisa los campos marcados', errors)

  const key: CatalogKey = level === 'grade' ? { grade: id } : level === 'subject' ? { grade: parent.grade, subject: id } : { ...parent, topic: id }

  return withTransaction(async (db) => {
    if (level !== 'grade') await lockEntry(db, level === 'topic' ? 'subject' : 'grade', parent)

    const exists = level === 'grade'
      ? await db.query('SELECT 1 FROM catalog_grades WHERE id = $1', [id])
      : level === 'subject'
        ? await db.query('SELECT 1 FROM catalog_subjects WHERE grade_id = $1 AND id = $2', [key.grade, id])
        : await db.query('SELECT 1 FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2 AND id = $3', [key.grade, key.subject, id])
    if (exists.length > 0) {
      throw new ServiceError(409, 'exists', `Ya existe ese identificador`, { errors: [{ field: 'id', message: 'Ya existe un elemento con este identificador' }] })
    }

    if (level === 'grade') {
      await db.query(
        `INSERT INTO catalog_grades (id, name, short, description, sort_order)
         VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_grades)))`,
        [id, name, short, description, sortOrder ?? null]
      )
    } else if (level === 'subject') {
      await db.query(
        `INSERT INTO catalog_subjects (grade_id, id, name, description, sort_order)
         VALUES ($1, $2, $3, $4, COALESCE($5, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_subjects WHERE grade_id = $1)))`,
        [key.grade, id, name, description, sortOrder ?? null]
      )
    } else {
      await db.query(
        `INSERT INTO catalog_topics (grade_id, subject_id, id, name, description, sort_order)
         VALUES ($1, $2, $3, $4, $5, COALESCE($6, (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2)))`,
        [key.grade, key.subject, id, name, description, sortOrder ?? null]
      )
    }

    await logAuditTx(db, {
      action: 'catalog_created',
      entityType: level,
      entityId: keyLabel(key),
      actor,
      changedFields: ['id', 'name', 'description', ...(level === 'grade' ? ['short'] : []), 'sort_order'],
      details: { name }
    })
    invalidateCatalogCache()
    return { level, key }
  })
}

export async function updateCatalogEntry(input: { level: unknown; key: unknown; data?: Record<string, unknown> }, actor: AuditActor = 'admin') {
  const level = assertLevel(input.level)
  const key = parseKey(level, input.key)
  const data = input.data || {}

  return withTransaction(async (db) => {
    const current = await lockEntry(db, level, key)
    const errors: FieldError[] = []
    const next = {
      name: data.name === undefined ? current.name : cleanText(data.name, CATALOG_LIMITS.name, 'name', 'El nombre', errors, true),
      description: data.description === undefined ? current.description : cleanText(data.description, CATALOG_LIMITS.description, 'description', 'La descripción', errors),
      short: level !== 'grade' || data.short === undefined ? current.short : cleanText(data.short, CATALOG_LIMITS.short, 'short', 'El subtítulo', errors),
      sort_order: cleanSortOrder(data.sort_order, errors) ?? current.sort_order
    }
    if (errors.length > 0) throw badRequest('Revisa los campos marcados', errors)

    const diff = diffFields(current, next, level === 'grade' ? ['name', 'short', 'description', 'sort_order'] : ['name', 'description', 'sort_order'])
    if (diff.changed.length === 0) return { level, key }

    if (level === 'grade') {
      await db.query('UPDATE catalog_grades SET name = $2, short = $3, description = $4, sort_order = $5, updated_at = NOW() WHERE id = $1',
        [key.grade, next.name, next.short, next.description, next.sort_order])
    } else if (level === 'subject') {
      await db.query('UPDATE catalog_subjects SET name = $3, description = $4, sort_order = $5, updated_at = NOW() WHERE grade_id = $1 AND id = $2',
        [key.grade, key.subject, next.name, next.description, next.sort_order])
    } else {
      await db.query('UPDATE catalog_topics SET name = $4, description = $5, sort_order = $6, updated_at = NOW() WHERE grade_id = $1 AND subject_id = $2 AND id = $3',
        [key.grade, key.subject, key.topic, next.name, next.description, next.sort_order])
    }

    await logAuditTx(db, { action: 'catalog_updated', entityType: level, entityId: keyLabel(key), actor, changedFields: diff.changed, details: { from: diff.from, to: diff.to } })
    invalidateCatalogCache()
    return { level, key }
  })
}

async function deleteEntryTx(db: Db, level: CatalogLevel, key: CatalogKey, actor: AuditActor) {
  await lockEntry(db, level, key)
  const [where, params] = quizFilter(level, key)
  const usage = await db.query<{ active: number; trashed: number }>(
    `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trashed
     FROM user_quizzes WHERE ${where}`,
    params
  )
  const { active, trashed } = usage[0]
  if (active + trashed > 0) {
    throw new ServiceError(409, 'in_use',
      `No se puede eliminar: tiene ${active} cuestionario${active === 1 ? '' : 's'} publicado${active === 1 ? '' : 's'} y ${trashed} en la papelera. Reasígnalos antes.`,
      { details: { active, trashed } })
  }

  // Los elementos hijos vacíos se eliminan con su padre.
  if (level === 'grade') {
    await db.query('DELETE FROM catalog_topics WHERE grade_id = $1', [key.grade])
    await db.query('DELETE FROM catalog_subjects WHERE grade_id = $1', [key.grade])
    await db.query('DELETE FROM catalog_grades WHERE id = $1', [key.grade])
  } else if (level === 'subject') {
    await db.query('DELETE FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2', [key.grade, key.subject])
    await db.query('DELETE FROM catalog_subjects WHERE grade_id = $1 AND id = $2', [key.grade, key.subject])
  } else {
    await db.query('DELETE FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2 AND id = $3', [key.grade, key.subject, key.topic])
  }

  await logAuditTx(db, { action: 'catalog_deleted', entityType: level, entityId: keyLabel(key), actor })
  invalidateCatalogCache()
}

export async function deleteCatalogEntry(input: { level: unknown; key: unknown }, actor: AuditActor = 'admin') {
  const level = assertLevel(input.level)
  const key = parseKey(level, input.key)
  await withTransaction((db) => deleteEntryTx(db, level, key, actor))
  return { level, key }
}

// Mueve todos los cuestionarios (activos y en papelera) de un elemento a otro del mismo nivel.
// Las asignaturas y temas conservan sus identificadores al cambiar de curso o asignatura.
// Todo ocurre en una transacción: una colisión de ruta deja los datos como estaban.
export async function reassignCatalogEntry(input: { level: unknown; from: unknown; to: unknown; deleteSource?: unknown }, actor: AuditActor = 'admin') {
  const level = assertLevel(input.level)
  const from = parseKey(level, input.from)
  const to = parseKey(level, input.to)
  if (keyLabel(from) === keyLabel(to)) throw badRequest('El destino debe ser distinto del origen')

  return withTransaction(async (db) => {
    await lockEntry(db, level, from)
    await lockEntry(db, level, to)

    const [where, params] = quizFilter(level, from)
    const quizzes = await db.query<QuizRecord>(`SELECT ${QUIZ_COLUMNS} FROM user_quizzes WHERE ${where} ORDER BY deleted_at NULLS FIRST, id FOR UPDATE`, params)

    for (const quiz of quizzes) {
      const topicId = topicIdOf(quiz)
      const target = level === 'topic'
        ? { grado: to.grade, course_id: to.subject!, unidad: to.topic! }
        : level === 'subject'
          ? { grado: to.grade, course_id: to.subject!, unidad: topicId }
          : { grado: to.grade, course_id: quiz.course_id, unidad: quiz.unidad || '' }

      // Copia los nombres de asignatura y tema al destino si allí no existen.
      if (level !== 'topic') {
        await db.query(
          `INSERT INTO catalog_subjects (grade_id, id, name, description, sort_order)
           SELECT $1, id, name, description, sort_order FROM catalog_subjects WHERE grade_id = $2 AND id = $3
           ON CONFLICT (grade_id, id) DO NOTHING`,
          [target.grado, quiz.grado, quiz.course_id]
        )
        await db.query(
          `INSERT INTO catalog_topics (grade_id, subject_id, id, name, description, sort_order)
           SELECT $1, $2, id, name, description, sort_order FROM catalog_topics WHERE grade_id = $3 AND subject_id = $4 AND id = $5
           ON CONFLICT (grade_id, subject_id, id) DO NOTHING`,
          [target.grado, target.course_id, quiz.grado, quiz.course_id, topicId]
        )
      }

      await moveQuizTx(db, quiz, target, actor)
    }

    await logAuditTx(db, {
      action: 'catalog_reassigned',
      entityType: level,
      entityId: keyLabel(from),
      actor,
      details: { to: keyLabel(to), quizzes: quizzes.map((quiz) => quiz.id) }
    })

    if (input.deleteSource === true) await deleteEntryTx(db, level, from, actor)
    invalidateCatalogCache()
    return { moved: quizzes.length, deleted: input.deleteSource === true }
  })
}
