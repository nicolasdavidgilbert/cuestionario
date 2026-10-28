import { prepareQuiz, type PreparedQuiz } from './quizRules'
import { CATALOG_ID_PATTERN, CATALOG_LIMITS } from './catalogRules'
import { ServiceError } from './errors'

// Clasifica cada registro de un archivo de importación sin escribir nada:
// nuevo, actualización (solo con ID y confirmación), sin cambios, conflicto o error.

export const IMPORT_FORMAT = 'cuestionarios-export'
export const IMPORT_VERSION = 1
export const IMPORT_MAX_RECORDS = 5000
export const IMPORT_BATCH_SIZE = 100

export type ImportAction = 'create' | 'update' | 'unchanged' | 'conflict' | 'error'
export type ImportKind = 'grade' | 'subject' | 'topic' | 'quiz'

export interface ImportRecord {
  ref: string
  kind: ImportKind
  action: ImportAction
  label: string
  messages: string[]
  data?: Record<string, unknown>
  quiz?: PreparedQuiz & { deleted_at: string | null }
  targetId?: number
  expectedVersion?: number
}

export interface ExistingState {
  grades: Map<string, Record<string, unknown>>
  subjects: Map<string, Record<string, unknown>>
  topics: Map<string, Record<string, unknown>>
  quizzes: Map<number, { id: number; version: number; title: string; description: string; quiz_hash: string | null; grado: string; course_id: string; unidad: string; deleted_at: string | null }>
  activeRoutes: Map<string, number>
  activeHashes: Map<string, number>
}

export function routeKey(quiz: { grado: string; course_id: string; unidad?: string | null }) {
  return `${quiz.grado}/${quiz.course_id}/${quiz.unidad || quiz.course_id}`
}

export function parseImportFile(text: string) {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new ServiceError(400, 'invalid_file', 'El archivo no es un JSON válido')
  }
  const file = json as Record<string, any>
  if (!file || typeof file !== 'object' || file.format !== IMPORT_FORMAT) {
    throw new ServiceError(400, 'invalid_file', `El archivo no es una exportación de cuestionarios (falta "format": "${IMPORT_FORMAT}")`)
  }
  if (file.version !== IMPORT_VERSION) {
    throw new ServiceError(400, 'invalid_file', `Versión de archivo no compatible: ${file.version}. Se admite la versión ${IMPORT_VERSION}.`)
  }

  const list = (value: unknown) => (Array.isArray(value) ? value : [])
  const catalog = file.catalog && typeof file.catalog === 'object' ? file.catalog : {}
  const parsed = {
    grades: list(catalog.grades),
    subjects: list(catalog.subjects),
    topics: list(catalog.topics),
    quizzes: list(file.quizzes)
  }
  const total = parsed.grades.length + parsed.subjects.length + parsed.topics.length + parsed.quizzes.length
  if (total === 0) throw new ServiceError(400, 'invalid_file', 'El archivo no contiene registros')
  if (total > IMPORT_MAX_RECORDS) throw new ServiceError(400, 'invalid_file', `El archivo tiene ${total} registros; el máximo es ${IMPORT_MAX_RECORDS}`)
  return parsed
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function catalogFields(kind: ImportKind, raw: Record<string, unknown>, messages: string[]) {
  const data: Record<string, unknown> = {
    id: text(raw.id).toLowerCase(),
    name: text(raw.name),
    description: text(raw.description),
    sort_order: raw.sort_order === undefined || raw.sort_order === null ? null : Number(raw.sort_order)
  }
  if (kind === 'grade') data.short = text(raw.short)
  if (kind !== 'grade') data.grade_id = text(raw.grade_id).toLowerCase()
  if (kind === 'topic') data.subject_id = text(raw.subject_id).toLowerCase()

  for (const field of ['id', 'grade_id', 'subject_id']) {
    if (data[field] !== undefined && !CATALOG_ID_PATTERN.test(String(data[field]))) messages.push(`Identificador "${field}" no válido: "${data[field]}"`)
  }
  if (!data.name) messages.push('Falta el nombre')
  if (String(data.name).length > CATALOG_LIMITS.name) messages.push(`El nombre supera ${CATALOG_LIMITS.name} caracteres`)
  if (String(data.description).length > CATALOG_LIMITS.description) messages.push(`La descripción supera ${CATALOG_LIMITS.description} caracteres`)
  if (kind === 'grade' && String(data.short).length > CATALOG_LIMITS.short) messages.push(`El subtítulo supera ${CATALOG_LIMITS.short} caracteres`)
  if (data.sort_order !== null && !Number.isInteger(data.sort_order)) messages.push('El orden debe ser un número entero')
  return data
}

export function planImport(file: ReturnType<typeof parseImportFile>, existing: ExistingState): ImportRecord[] {
  const records: ImportRecord[] = []
  const seen = new Set<string>()
  const plannedGrades = new Set(existing.grades.keys())
  const plannedSubjects = new Set(existing.subjects.keys())
  const plannedRoutes = new Map(existing.activeRoutes)
  const plannedHashes = new Map(existing.activeHashes)

  const catalogPass = (kind: Exclude<ImportKind, 'quiz'>, rows: unknown[]) => {
    rows.forEach((raw, index) => {
      const messages: string[] = []
      const data = catalogFields(kind, (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>, messages)
      const key = kind === 'grade' ? String(data.id) : kind === 'subject' ? `${data.grade_id}/${data.id}` : `${data.grade_id}/${data.subject_id}/${data.id}`
      const ref = `${kind}:${key || `#${index + 1}`}`
      const label = `${key || `registro ${index + 1}`} · ${data.name || 'sin nombre'}`

      if (seen.has(ref)) messages.push('Registro repetido en el archivo')
      seen.add(ref)
      if (kind === 'subject' && !plannedGrades.has(String(data.grade_id))) messages.push(`No existe el curso "${data.grade_id}" ni se importa en este archivo`)
      if (kind === 'topic' && !plannedSubjects.has(`${data.grade_id}/${data.subject_id}`)) messages.push(`No existe la asignatura "${data.grade_id}/${data.subject_id}" ni se importa en este archivo`)

      if (messages.length > 0) {
        records.push({ ref, kind, action: 'error', label, messages })
        return
      }

      const map = kind === 'grade' ? existing.grades : kind === 'subject' ? existing.subjects : existing.topics
      const current = map.get(key)
      if (!current) {
        records.push({ ref, kind, action: 'create', label, messages: [], data })
      } else {
        const fields = ['name', 'description', 'sort_order', ...(kind === 'grade' ? ['short'] : [])]
        const changed = fields.filter((field) => data[field] !== null && String(data[field] ?? '') !== String(current[field] ?? ''))
        records.push(changed.length === 0
          ? { ref, kind, action: 'unchanged', label, messages: [] }
          : { ref, kind, action: 'update', label, messages: [`Cambia: ${changed.join(', ')}`], data })
      }
      if (kind === 'grade') plannedGrades.add(key)
      if (kind === 'subject') plannedSubjects.add(key)
    })
  }

  catalogPass('grade', file.grades)
  catalogPass('subject', file.subjects)
  catalogPass('topic', file.topics)

  file.quizzes.forEach((raw, index) => {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const id = Number.isInteger(row.id) && Number(row.id) > 0 ? Number(row.id) : 0
    const ref = id ? `quiz:${id}` : `quiz:#${index + 1}`
    const baseLabel = `${id ? `n.º ${id}` : `registro ${index + 1}`} · ${text(row.title) || 'sin título'}`

    if (seen.has(ref)) {
      records.push({ ref, kind: 'quiz', action: 'error', label: baseLabel, messages: ['Registro repetido en el archivo'] })
      return
    }
    seen.add(ref)

    let quiz: PreparedQuiz
    try {
      quiz = prepareQuiz(row)
    } catch (error) {
      const messages = error instanceof ServiceError && error.errors.length ? error.errors.map((item) => item.message) : [(error as Error).message]
      records.push({ ref, kind: 'quiz', action: 'error', label: baseLabel, messages })
      return
    }

    const label = `${baseLabel} · /${routeKey(quiz)}`
    const deletedAt = typeof row.deleted_at === 'string' && row.deleted_at ? row.deleted_at : null
    const current = id ? existing.quizzes.get(id) : undefined
    const messages: string[] = []
    const route = routeKey(quiz)

    // Colisiones con otros cuestionarios activos (de la base de datos o de este mismo archivo).
    const checkAvailability = (excludeId: number) => {
      const routeOwner = plannedRoutes.get(route)
      if (routeOwner !== undefined && routeOwner !== excludeId) messages.push(`La ruta /${route} ya está ocupada por ${routeOwner > 0 ? `el n.º ${routeOwner}` : 'otro registro del archivo'}`)
      const hashOwner = plannedHashes.get(quiz.quiz_hash)
      if (hashOwner !== undefined && hashOwner !== excludeId) messages.push(`Contenido idéntico a ${hashOwner > 0 ? `el n.º ${hashOwner}` : 'otro registro del archivo'}`)
    }

    if (current) {
      if (current.deleted_at) {
        records.push({ ref, kind: 'quiz', action: 'conflict', label, messages: ['Está en la papelera: restáuralo antes de actualizarlo'] })
        return
      }
      if (row.version !== current.version) {
        records.push({ ref, kind: 'quiz', action: 'conflict', label, messages: [`Se ha modificado desde la exportación (versión del archivo ${row.version ?? 'sin versión'}, actual ${current.version})`] })
        return
      }
      const same = current.quiz_hash === quiz.quiz_hash && (current.description || '') === quiz.description
      if (same) {
        records.push({ ref, kind: 'quiz', action: 'unchanged', label, messages: [] })
        return
      }
      plannedRoutes.delete(routeKey(current))
      checkAvailability(id)
      if (messages.length > 0) {
        plannedRoutes.set(routeKey(current), id)
        records.push({ ref, kind: 'quiz', action: 'conflict', label, messages })
        return
      }
      plannedRoutes.set(route, id)
      plannedHashes.set(quiz.quiz_hash, id)
      records.push({ ref, kind: 'quiz', action: 'update', label, messages: ['Sustituye el contenido actual'], quiz: { ...quiz, deleted_at: null }, targetId: id, expectedVersion: current.version })
      return
    }

    if (!deletedAt) {
      // Marcador negativo propio de este registro: distingue colisiones entre registros nuevos del archivo.
      const marker = -(index + 1)
      checkAvailability(marker)
      if (messages.length > 0) {
        records.push({ ref, kind: 'quiz', action: 'conflict', label, messages })
        return
      }
      plannedRoutes.set(route, marker)
      plannedHashes.set(quiz.quiz_hash, marker)
    }
    records.push({
      ref,
      kind: 'quiz',
      action: 'create',
      label,
      messages: [id ? 'El ID no existe aquí: se creará con un ID nuevo' : '', deletedAt ? 'Se importará en la papelera' : ''].filter(Boolean),
      quiz: { ...quiz, deleted_at: deletedAt }
    })
  })

  return records
}

export function summarizePlan(records: ImportRecord[]) {
  const counts: Record<ImportAction, number> = { create: 0, update: 0, unchanged: 0, conflict: 0, error: 0 }
  for (const record of records) counts[record.action] += 1
  return counts
}
