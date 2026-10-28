import type { Db } from './db'
import { topicIdOf } from './catalogRules'

export { topicIdOf }

// Caché del catálogo en memoria del proceso (máximo 60 s). Las escrituras del panel la invalidan;
// otras instancias la renuevan como mucho al cabo de ese tiempo.
export const CATALOG_CACHE_TTL_MS = 60 * 1000

let cached: { expiresAt: number; value: unknown } | null = null

export function readCatalogCache<T>(): T | null {
  return cached && cached.expiresAt > Date.now() ? (cached.value as T) : null
}

export function writeCatalogCache(value: unknown) {
  cached = { expiresAt: Date.now() + CATALOG_CACHE_TTL_MS, value }
}

export function invalidateCatalogCache() {
  cached = null
}

// Registra en el catálogo un curso, asignatura o tema nuevos usados por un cuestionario.
// Nunca sobrescribe nombres existentes: solo inserta lo que falta, con nombres iniciales editables.
export async function ensureCatalogPath(db: Db, quiz: { grado: string; course_id: string; unidad?: string | null; title?: string | null }) {
  const topicId = topicIdOf(quiz)

  const grades = await db.query(
    `INSERT INTO catalog_grades (id, name, short, description, sort_order)
     VALUES ($1, upper($1), 'Cuestionarios de ' || upper($1),
       'Cuestionarios tipo test de ' || upper($1) || ' organizados por asignatura y tema.',
       (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_grades))
     ON CONFLICT (id) DO NOTHING RETURNING id`,
    [quiz.grado]
  )

  // Si la misma asignatura ya existe en otro curso, se reutiliza su nombre como punto de partida.
  const subjects = await db.query(
    `INSERT INTO catalog_subjects (grade_id, id, name, description, sort_order)
     VALUES ($1, $2,
       COALESCE((SELECT name FROM catalog_subjects WHERE id = $2 ORDER BY grade_id LIMIT 1), upper($2)),
       COALESCE((SELECT description FROM catalog_subjects WHERE id = $2 ORDER BY grade_id LIMIT 1), ''),
       (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_subjects WHERE grade_id = $1))
     ON CONFLICT (grade_id, id) DO NOTHING RETURNING id`,
    [quiz.grado, quiz.course_id]
  )

  const topics = await db.query(
    `INSERT INTO catalog_topics (grade_id, subject_id, id, name, sort_order)
     VALUES ($1, $2, $3, COALESCE(NULLIF(btrim($4), ''), upper($3)),
       (SELECT COALESCE(MAX(sort_order), 0) + 10 FROM catalog_topics WHERE grade_id = $1 AND subject_id = $2))
     ON CONFLICT (grade_id, subject_id, id) DO NOTHING RETURNING id`,
    [quiz.grado, quiz.course_id, topicId, quiz.title || '']
  )

  if (grades.length + subjects.length + topics.length > 0) invalidateCatalogCache()
}
