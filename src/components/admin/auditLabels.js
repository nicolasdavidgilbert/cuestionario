// Textos legibles de las acciones de auditoría.
export const ACTION_LABELS = {
  quiz_created: 'Cuestionario creado',
  quiz_updated: 'Cuestionario editado',
  quiz_trashed: 'Cuestionario enviado a la papelera',
  quiz_soft_deleted: 'Cuestionario enviado a la papelera',
  quiz_restored: 'Cuestionario restaurado',
  quiz_reassigned: 'Cuestionario reasignado',
  quiz_imported: 'Cuestionario importado',
  quiz_reported: 'Reporte público recibido',
  catalog_created: 'Elemento del catálogo creado',
  catalog_updated: 'Elemento del catálogo editado',
  catalog_deleted: 'Elemento del catálogo eliminado',
  catalog_reassigned: 'Contenido reasignado',
  catalog_imported: 'Elemento del catálogo importado',
  catalog_import_updated: 'Elemento del catálogo actualizado por importación',
  issue_created: 'Incidencia creada',
  issue_updated: 'Incidencia actualizada',
  issue_resolved: 'Incidencia resuelta',
  issue_dismissed: 'Incidencia descartada',
  admin_login: 'Inicio de sesión',
  admin_login_failed: 'Intento de acceso fallido',
  admin_logout: 'Cierre de sesión'
}

export const ENTITY_LABELS = { quiz: 'Cuestionario', issue: 'Incidencia', grade: 'Curso', subject: 'Asignatura', topic: 'Tema', session: 'Sesión' }

export function entityHref(entry) {
  if (entry.entity_type === 'quiz' && entry.entity_id) return `/admin/cuestionarios/${entry.entity_id}`
  if (entry.entity_type === 'issue' && entry.entity_id) return `/admin/incidencias/${entry.entity_id}`
  if (['grade', 'subject', 'topic'].includes(entry.entity_type)) return '/admin/catalogo'
  return ''
}

export function describeAudit(entry) {
  const label = ACTION_LABELS[entry.action] || entry.action
  const id = entry.entity_id ? ` ${entry.entity_type === 'quiz' || entry.entity_type === 'issue' ? 'n.º ' : ''}${entry.entity_id}` : ''
  return { text: `${label}${id}`, href: entityHref(entry) }
}
