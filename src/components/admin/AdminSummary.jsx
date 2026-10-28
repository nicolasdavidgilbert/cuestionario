import { formatDate, Notice, PriorityBadge, StatusBadge, useAdminResource } from './ui'
import { describeAudit } from './auditLabels'

export default function AdminSummary() {
  const { data, loading, error } = useAdminResource('/summary')
  const totals = data?.totals

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Resumen</h1>
          <p>Estado del contenido y lo que necesita atención.</p>
        </div>
        <div className="admin-actions">
          <a className="btn-primary" href="/admin/cuestionarios/nuevo">Nuevo cuestionario</a>
          <a className="btn-secondary" href="/admin/incidencias?nueva=1">Nueva incidencia</a>
        </div>
      </header>

      <Notice tone="danger">{error}</Notice>

      {loading && !data ? <div className="loading">Cargando…</div> : totals && (
        <>
          <section className="admin-stats" aria-label="Totales">
            <a className="admin-stat" href="/admin/cuestionarios"><strong>{totals.quizzes}</strong><span>Cuestionarios publicados</span></a>
            <div className="admin-stat"><strong>{totals.questions}</strong><span>Preguntas publicadas</span></div>
            <a className={`admin-stat ${totals.issues_pending ? 'admin-stat--alert' : ''}`} href="/admin/incidencias?status=pendiente"><strong>{totals.issues_pending}</strong><span>Incidencias pendientes</span></a>
            <a className="admin-stat" href="/admin/incidencias?status=en_revision"><strong>{totals.issues_reviewing}</strong><span>En revisión</span></a>
            <a className="admin-stat" href="/admin/catalogo"><strong>{totals.grades} · {totals.subjects} · {totals.topics}</strong><span>Cursos · asignaturas · temas</span></a>
            <a className="admin-stat" href="/admin/papelera"><strong>{totals.trashed}</strong><span>En la papelera</span></a>
          </section>

          <div className="admin-grid-2">
            <section className="admin-card" aria-labelledby="summary-issues">
              <header>
                <h2 id="summary-issues">Incidencias abiertas</h2>
                <a href="/admin/incidencias">Ver todas</a>
              </header>
              {data.openIssues.length === 0 ? <p className="admin-muted">No hay incidencias abiertas.</p> : (
                <ul className="admin-list">
                  {data.openIssues.map((issue) => (
                    <li key={issue.id}>
                      <a href={`/admin/incidencias/${issue.id}`}>{issue.title || `Incidencia ${issue.id}`}</a>
                      <span className="admin-actions"><PriorityBadge priority={issue.priority} /><StatusBadge status={issue.status} /><span className="admin-muted">{formatDate(issue.created_at, false)}</span></span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="admin-card" aria-labelledby="summary-activity">
              <header>
                <h2 id="summary-activity">Actividad reciente</h2>
                <a href="/admin/auditoria">Ver auditoría</a>
              </header>
              {data.recentActivity.length === 0 ? <p className="admin-muted">Sin actividad todavía.</p> : (
                <ul className="admin-list">
                  {data.recentActivity.map((entry) => {
                    const item = describeAudit(entry)
                    return (
                      <li key={entry.id}>
                        <span>{item.href ? <a href={item.href}>{item.text}</a> : item.text}</span>
                        <span className="admin-muted">{formatDate(entry.created_at)}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
