// Reglas de los identificadores y textos del catálogo, compartidas por el panel y la importación.
export const CATALOG_ID_PATTERN = /^[a-z0-9](?:[a-z0-9_-]{0,58}[a-z0-9])?$/
export const CATALOG_LIMITS = { name: 120, short: 200, description: 1000 }

// Id del tema en la URL pública: la unidad o, si no hay, la propia asignatura.
export function topicIdOf(row: { unidad?: string | null; course_id: string }): string {
  return row.unidad || row.course_id
}
