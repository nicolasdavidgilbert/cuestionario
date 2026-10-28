import { useEffect, useState } from 'react'
import { adminApi, fieldErrorMap } from '../../lib/adminApi'
import useUnsavedChangesWarning from '../useUnsavedChangesWarning'
import { FieldError, fieldProps, formatDate, KIND_LABELS, Notice, PRIORITY_LABELS, PriorityBadge, StatusBadge } from './ui'

const EDITABLE = ['title', 'reason', 'kind', 'priority', 'internal_notes']

export default function AdminIssueDetail({ id }) {
  const [issue, setIssue] = useState(null)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState(false)

  const dirty = Boolean(issue && form) && EDITABLE.some((field) => (form[field] ?? '') !== (issue[field] ?? ''))
  useUnsavedChangesWarning(dirty && !busy)

  const apply = (data) => {
    setIssue(data)
    setForm(Object.fromEntries(EDITABLE.map((field) => [field, data[field] ?? ''])))
  }

  useEffect(() => {
    adminApi.get(`/issues/${id}`).then(apply).catch((err) => setLoadError(err.message))
  }, [id])

  const patch = async (body, message) => {
    setBusy(true)
    setNotice(null)
    try {
      const updated = await adminApi.patch(`/issues/${id}`, body)
      // Conserva los cambios de formulario no guardados al cambiar solo el estado.
      setIssue(updated)
      if (body.title !== undefined) apply(updated)
      setErrors({})
      setNotice({ tone: 'success', text: message })
    } catch (err) {
      setErrors(fieldErrorMap(err))
      setNotice({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  const changeStatus = (status, message) => {
    if (dirty && !window.confirm('Hay cambios sin guardar en la incidencia. ¿Cambiar el estado sin guardarlos?')) return
    patch({ status }, message)
  }

  const trashQuiz = async () => {
    if (!window.confirm('¿Enviar el cuestionario a la papelera? Dejará de verse en la web. La incidencia seguirá abierta hasta que la resuelvas.')) return
    setBusy(true)
    try {
      await adminApi.del(`/quizzes/${issue.quiz_id}`, { reason: `Incidencia n.º ${id}` })
      setIssue({ ...issue, quiz_deleted_at: new Date().toISOString() })
      setNotice({ tone: 'info', text: 'Cuestionario enviado a la papelera. Marca la incidencia como resuelta cuando corresponda.' })
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    } finally {
      setBusy(false)
    }
  }

  if (loadError) return <div className="admin-page"><a href="/admin/incidencias" className="quiz-back">← Incidencias</a><Notice tone="danger">{loadError}</Notice></div>
  if (!issue || !form) return <div className="admin-page"><div className="loading">Cargando incidencia…</div></div>

  const open = issue.status === 'pendiente' || issue.status === 'en_revision'
  const set = (patchValue) => setForm((current) => ({ ...current, ...patchValue }))

  return (
    <div className="admin-page">
      <a href="/admin/incidencias" className="quiz-back">← Incidencias</a>
      <header className="admin-page-header">
        <div>
          <h1>{issue.title || `Incidencia n.º ${issue.id}`}</h1>
          <p className="admin-actions">
            <StatusBadge status={issue.status} /> <PriorityBadge priority={issue.priority} />
            <span>n.º {issue.id} · {KIND_LABELS[issue.kind]} · creada {formatDate(issue.created_at)}</span>
            {issue.resolved_at && <span>· cerrada {formatDate(issue.resolved_at)}</span>}
          </p>
        </div>
        <div className="admin-actions" role="group" aria-label="Estado">
          {issue.status === 'pendiente' && <button type="button" className="btn-secondary" disabled={busy} onClick={() => changeStatus('en_revision', 'Marcada en revisión.')}>Marcar en revisión</button>}
          {open && <button type="button" className="btn-primary" disabled={busy} onClick={() => changeStatus('resuelta', 'Incidencia resuelta.')}>Marcar resuelta</button>}
          {open && <button type="button" className="btn-secondary" disabled={busy} onClick={() => changeStatus('descartada', 'Incidencia descartada.')}>Descartar</button>}
          {!open && <button type="button" className="btn-secondary" disabled={busy} onClick={() => changeStatus('pendiente', 'Incidencia reabierta.')}>Reabrir</button>}
        </div>
      </header>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

      {issue.quiz_id && (
        <section className="admin-card" aria-labelledby="issue-quiz">
          <header>
            <h2 id="issue-quiz">Cuestionario afectado</h2>
            {issue.quiz_deleted_at && <span className="admin-badge">En la papelera</span>}
          </header>
          <p><strong>{issue.quiz_title || `n.º ${issue.quiz_id}`}</strong> <span className="admin-code">/{issue.grado}/{issue.course_id}/{issue.topic}</span></p>
          <div className="admin-actions" style={{ marginTop: 10 }}>
            {!issue.quiz_deleted_at && <a className="btn-secondary btn-small" href={`/${issue.grado}/${issue.course_id}/${issue.topic}`} target="_blank" rel="noopener">Ver en la web ↗</a>}
            <a className="btn-primary btn-small" href={`/admin/cuestionarios/${issue.quiz_id}`}>{issue.quiz_deleted_at ? 'Abrir' : 'Corregir en el editor'}</a>
            {!issue.quiz_deleted_at && <button type="button" className="btn-clear btn-danger btn-small" disabled={busy} onClick={trashQuiz}>Enviar a la papelera</button>}
          </div>
        </section>
      )}

      <form className="admin-card admin-form" noValidate onSubmit={(event) => {
        event.preventDefault()
        patch(form, 'Cambios guardados.')
      }}>
        <h2>Detalles</h2>
        <div className="form-group">
          <label htmlFor="issue-title">Título</label>
          <input id="issue-title" type="text" value={form.title} maxLength={160} placeholder="Sin título (reporte público)"
            onChange={(event) => set({ title: event.target.value })} {...fieldProps(errors, 'title', 'issue-title')} />
          <FieldError id="issue-title-error" message={errors.title} />
        </div>
        <div className="form-group">
          <label htmlFor="issue-reason">Descripción</label>
          <textarea id="issue-reason" rows={4} value={form.reason} maxLength={2000}
            onChange={(event) => set({ reason: event.target.value })} {...fieldProps(errors, 'reason', 'issue-reason')} />
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
        </div>
        <div className="form-group">
          <label htmlFor="issue-notes">Notas internas</label>
          <textarea id="issue-notes" rows={5} value={form.internal_notes} maxLength={5000}
            onChange={(event) => set({ internal_notes: event.target.value })} {...fieldProps(errors, 'internal_notes', 'issue-notes')} />
          <p className="field-hint">Solo visibles en el panel.</p>
          <FieldError id="issue-notes-error" message={errors.internal_notes} />
        </div>
        <div className="admin-actions">
          <button type="submit" className="btn-primary" disabled={busy || !dirty}>Guardar cambios</button>
          {dirty && <button type="button" className="btn-clear" onClick={() => apply(issue)}>Descartar</button>}
          <a className="btn-link" href={`/admin/auditoria?entity=issue&id=${issue.id}`}>Historial</a>
        </div>
      </form>
    </div>
  )
}
