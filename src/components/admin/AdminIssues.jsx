import { useState } from 'react'
import { adminApi, fieldErrorMap } from '../../lib/adminApi'
import {
  FieldError, fieldProps, formatDate, KIND_LABELS, Notice, Pagination, PRIORITY_LABELS, PriorityBadge,
  SearchInput, STATUS_LABELS, StatusBadge, useAdminResource, useUrlFilters
} from './ui'

const EMPTY_FORM = { title: '', reason: '', kind: 'error', priority: 'normal', quiz_id: '' }

function NewIssueForm({ onCreated, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      const issue = await adminApi.post('/issues', { ...form, quiz_id: form.quiz_id || null })
      onCreated(issue)
    } catch (err) {
      setErrors(fieldErrorMap(err))
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="admin-card admin-form" onSubmit={submit} noValidate aria-labelledby="new-issue-title">
      <h2 id="new-issue-title">Nueva incidencia</h2>
      <Notice tone="danger">{error}</Notice>
      <div className="form-group">
        <label htmlFor="issue-title">Título</label>
        <input id="issue-title" type="text" value={form.title} maxLength={160} onChange={(event) => set({ title: event.target.value })} {...fieldProps(errors, 'title', 'issue-title')} autoFocus />
        <FieldError id="issue-title-error" message={errors.title} />
      </div>
      <div className="form-group">
        <label htmlFor="issue-reason">Descripción</label>
        <textarea id="issue-reason" rows={4} value={form.reason} maxLength={2000} onChange={(event) => set({ reason: event.target.value })} {...fieldProps(errors, 'reason', 'issue-reason')} />
        <FieldError id="issue-reason-error" message={errors.reason} />
      </div>
      <div className="admin-form-row">
        <div className="form-group">
          <label htmlFor="issue-kind">Tipo</label>
          <select id="issue-kind" value={form.kind} onChange={(event) => set({ kind: event.target.value })}>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="issue-priority">Prioridad</label>
          <select id="issue-priority" value={form.priority} onChange={(event) => set({ priority: event.target.value })}>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="issue-quiz">Cuestionario (n.º, opcional)</label>
          <input id="issue-quiz" type="number" min="1" inputMode="numeric" value={form.quiz_id} onChange={(event) => set({ quiz_id: event.target.value })} {...fieldProps(errors, 'quiz_id', 'issue-quiz')} />
          <FieldError id="issue-quiz-error" message={errors.quiz_id} />
        </div>
      </div>
      <div className="admin-actions">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Creando…' : 'Crear incidencia'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export default function AdminIssues({ search = '' }) {
  const [filters, setFilters] = useUrlFilters({ status: 'abiertas', priority: '', kind: '', q: '', quiz: '', page: 1 }, search)
  const { data, loading, error } = useAdminResource('/issues', filters)
  const [creating, setCreating] = useState(() => new URLSearchParams(search).get('nueva') === '1')
  const items = data?.items || []

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Incidencias</h1>
          <p>Reportes de los usuarios y fallos generales registrados desde el panel.</p>
        </div>
        {!creating && <button type="button" className="btn-primary" onClick={() => setCreating(true)}>Nueva incidencia</button>}
      </header>

      {creating && (
        <NewIssueForm
          onCancel={() => setCreating(false)}
          onCreated={(issue) => window.location.assign(`/admin/incidencias/${issue.id}`)}
        />
      )}

      <form className="admin-filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <SearchInput id="issue-search" label="Buscar" value={filters.q} placeholder="Título, descripción o notas" onChange={(q) => setFilters({ q })} />
        <div className="form-group">
          <label htmlFor="issue-status-filter">Estado</label>
          <select id="issue-status-filter" value={filters.status} onChange={(event) => setFilters({ status: event.target.value })}>
            <option value="abiertas">Abiertas</option>
            <option value="">Todas</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="issue-priority-filter">Prioridad</label>
          <select id="issue-priority-filter" value={filters.priority} onChange={(event) => setFilters({ priority: event.target.value })}>
            <option value="">Todas</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="issue-kind-filter">Tipo</label>
          <select id="issue-kind-filter" value={filters.kind} onChange={(event) => setFilters({ kind: event.target.value })}>
            <option value="">Todos</option>
            {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        {filters.quiz && <button type="button" className="btn-clear btn-small" onClick={() => setFilters({ quiz: '' })}>Quitar filtro del cuestionario n.º {filters.quiz}</button>}
      </form>

      <Notice tone="danger">{error}</Notice>

      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table">
          <caption className="sr-only">Incidencias</caption>
          <thead>
            <tr>
              <th scope="col">Incidencia</th>
              <th scope="col">Estado</th>
              <th scope="col">Prioridad</th>
              <th scope="col">Cuestionario</th>
              <th scope="col">Creada</th>
            </tr>
          </thead>
          <tbody>
            {items.map((issue) => (
              <tr key={issue.id}>
                <td data-label="Incidencia">
                  <a href={`/admin/incidencias/${issue.id}`}>{issue.title || issue.reason.slice(0, 90)}</a>
                  <div className="admin-muted">n.º {issue.id} · {KIND_LABELS[issue.kind] || issue.kind}</div>
                </td>
                <td data-label="Estado"><StatusBadge status={issue.status} /></td>
                <td data-label="Prioridad"><PriorityBadge priority={issue.priority} /></td>
                <td data-label="Cuestionario">
                  {issue.quiz_id ? <a href={`/admin/cuestionarios/${issue.quiz_id}`}>{issue.quiz_title || `n.º ${issue.quiz_id}`}</a> : <span className="admin-muted">General</span>}
                  {issue.quiz_deleted_at && <> <span className="admin-badge">En la papelera</span></>}
                </td>
                <td data-label="Creada">{formatDate(issue.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && <p className="admin-empty">No hay incidencias con estos filtros.</p>}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setFilters({ page })} />}
      </div>
    </div>
  )
}
