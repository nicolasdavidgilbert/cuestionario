import { ACTION_LABELS, ENTITY_LABELS, entityHref } from './auditLabels'
import { formatDate, Notice, Pagination, useAdminResource, useUrlFilters } from './ui'

const ACTOR_LABELS = { admin: 'Panel', public: 'Web pública', script: 'Script' }

export default function AdminAudit({ search = '' }) {
  const [filters, setFilters] = useUrlFilters({ entity: '', action: '', id: '', page: 1 }, search)
  const { data, loading, error } = useAdminResource('/audit', filters)
  const items = data?.items || []

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Auditoría</h1>
          <p>Historial de acciones sobre el contenido. No se registran contraseñas, sesiones ni tokens.</p>
        </div>
      </header>

      <form className="admin-filters" onSubmit={(event) => event.preventDefault()}>
        <div className="form-group">
          <label htmlFor="audit-entity">Entidad</label>
          <select id="audit-entity" value={filters.entity} onChange={(event) => setFilters({ entity: event.target.value })}>
            <option value="">Todas</option>
            {Object.entries(ENTITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="audit-action">Acción</label>
          <select id="audit-action" value={filters.action} onChange={(event) => setFilters({ action: event.target.value })}>
            <option value="">Todas</option>
            {(data?.actions || []).map((action) => <option key={action} value={action}>{ACTION_LABELS[action] || action}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="audit-id">Identificador</label>
          <input id="audit-id" type="text" value={filters.id} placeholder="p. ej. 12 o 1asir/pni"
            onChange={(event) => setFilters({ id: event.target.value.trim() })} />
        </div>
        {(filters.entity || filters.action || filters.id) && (
          <button type="button" className="btn-clear btn-small" onClick={() => setFilters({ entity: '', action: '', id: '' })}>Limpiar</button>
        )}
      </form>

      <Notice tone="danger">{error}</Notice>

      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table">
          <caption className="sr-only">Historial de acciones</caption>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Acción</th>
              <th scope="col">Elemento</th>
              <th scope="col">Origen</th>
              <th scope="col">Campos</th>
            </tr>
          </thead>
          <tbody>
            {items.map((entry) => {
              const href = entityHref(entry)
              const label = entry.entity_type ? `${ENTITY_LABELS[entry.entity_type] || entry.entity_type} ${entry.entity_id}` : '—'
              const hasDetails = entry.details && Object.keys(entry.details).length > 0
              return (
                <tr key={entry.id}>
                  <td data-label="Fecha" style={{ whiteSpace: 'nowrap' }}>{formatDate(entry.created_at)}</td>
                  <td data-label="Acción">
                    {ACTION_LABELS[entry.action] || entry.action}
                    {hasDetails && (
                      <details className="admin-details">
                        <summary>Detalles</summary>
                        <pre className="admin-json">{JSON.stringify(entry.details, null, 2)}</pre>
                      </details>
                    )}
                  </td>
                  <td data-label="Elemento">{href ? <a href={href}>{label}</a> : label}</td>
                  <td data-label="Origen">{ACTOR_LABELS[entry.actor] || entry.actor}</td>
                  <td data-label="Campos">{(entry.changed_fields || []).length ? <span className="admin-code">{entry.changed_fields.join(', ')}</span> : '—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="admin-empty">No hay registros con estos filtros.</p>}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setFilters({ page })} />}
      </div>
    </div>
  )
}
