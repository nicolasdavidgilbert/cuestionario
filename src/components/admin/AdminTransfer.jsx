import { useMemo, useState } from 'react'
import { adminApi } from '../../lib/adminApi'
import { Notice } from './ui'

const ACTION_INFO = {
  create: { label: 'Nuevo', tone: 'success' },
  update: { label: 'Actualización', tone: 'accent' },
  unchanged: { label: 'Sin cambios', tone: '' },
  conflict: { label: 'Conflicto', tone: 'danger' },
  error: { label: 'Error', tone: 'danger' }
}
const KIND_LABELS = { grade: 'Curso', subject: 'Asignatura', topic: 'Tema', quiz: 'Cuestionario' }

const EXPORTS = [
  { type: 'content', title: 'Contenido completo (JSON)', text: 'Catálogo y cuestionarios, incluidos los de la papelera. Se puede volver a importar.' },
  { type: 'catalog', title: 'Catálogo (JSON)', text: 'Cursos, asignaturas y temas con sus nombres y orden.' },
  { type: 'quizzes', title: 'Listado de cuestionarios (CSV)', text: 'Para hojas de cálculo: ruta, preguntas, estado y fechas.' },
  { type: 'issues', title: 'Incidencias (CSV)', text: 'Todas las incidencias con su estado, prioridad y notas.' }
]

export default function AdminTransfer() {
  const [fileName, setFileName] = useState('')
  const [text, setText] = useState('')
  const [preview, setPreview] = useState(null)
  const [confirmed, setConfirmed] = useState(new Set())
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState('')

  const reset = () => {
    setPreview(null)
    setResult(null)
    setConfirmed(new Set())
    setError('')
  }

  const readFile = async (file) => {
    reset()
    if (!file) return
    if (file.size > 4 * 1024 * 1024) {
      setError('El archivo supera 4 MB. Divídelo en varios archivos.')
      return
    }
    setFileName(file.name)
    setText(await file.text())
  }

  const runPreview = async () => {
    reset()
    setBusy(true)
    try {
      setPreview(await adminApi.post('/import', { mode: 'preview', text }))
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const commit = async () => {
    const writes = preview.summary.create + confirmed.size
    if (!window.confirm(`Se escribirán ${writes} registro${writes === 1 ? '' : 's'} en lotes de 100. ¿Continuar?`)) return
    setBusy(true)
    setError('')
    try {
      setResult(await adminApi.post('/import', { mode: 'commit', text, previewId: preview.previewId, confirmUpdates: [...confirmed] }))
      setPreview(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const records = useMemo(() => (preview?.records || []).filter((record) => !filter || record.action === filter), [preview, filter])
  const updates = (preview?.records || []).filter((record) => record.action === 'update')
  const toggle = (ref) => setConfirmed((current) => {
    const next = new Set(current)
    if (next.has(ref)) next.delete(ref)
    else next.add(ref)
    return next
  })

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Importar / exportar</h1>
          <p>Transferencia de contenido entre entornos. La copia de seguridad completa de la base de datos se hace en Neon.</p>
        </div>
      </header>

      <section className="admin-card" aria-labelledby="export-heading">
        <h2 id="export-heading">Exportar</h2>
        <ul className="admin-list">
          {EXPORTS.map((item) => (
            <li key={item.type}>
              <span><strong>{item.title}</strong><br /><span className="admin-muted">{item.text}</span></span>
              <a className="btn-secondary btn-small" href={`/api/admin/export?type=${item.type}`} download>Descargar</a>
            </li>
          ))}
        </ul>
        <p className="field-hint" style={{ marginTop: 10 }}>Ninguna descarga incluye tokens de propietario, sesiones ni credenciales.</p>
      </section>

      <section className="admin-card admin-form" aria-labelledby="import-heading">
        <h2 id="import-heading">Importar</h2>
        <p className="admin-muted">
          Sube un JSON exportado desde este panel (formato <span className="admin-code">cuestionarios-export</span>, versión 1).
          Primero verás una vista previa; no se escribe nada hasta que confirmes. Los registros con ID existente solo se actualizan si los marcas.
        </p>
        <div className="form-group">
          <label htmlFor="import-file">Archivo JSON</label>
          <input id="import-file" type="file" accept="application/json,.json" onChange={(event) => readFile(event.target.files?.[0])} />
        </div>
        <div className="admin-actions">
          <button type="button" className="btn-primary" disabled={!text || busy} onClick={runPreview}>{busy && !preview ? 'Analizando…' : 'Ver vista previa'}</button>
          {fileName && <span className="admin-muted">{fileName}</span>}
        </div>
        <Notice tone="danger">{error}</Notice>
      </section>

      {preview && (
        <section className="admin-card admin-form" aria-labelledby="preview-heading">
          <header>
            <h2 id="preview-heading">Vista previa</h2>
            <div className="admin-actions" role="group" aria-label="Filtrar por resultado">
              <button type="button" className={`filter-tab btn-small ${filter === '' ? 'active' : ''}`} aria-pressed={filter === ''} onClick={() => setFilter('')}>Todos ({preview.records.length})</button>
              {Object.entries(preview.summary).filter(([, count]) => count > 0).map(([action, count]) => (
                <button key={action} type="button" className={`filter-tab btn-small ${filter === action ? 'active' : ''}`} aria-pressed={filter === action} onClick={() => setFilter(action)}>
                  {ACTION_INFO[action].label} ({count})
                </button>
              ))}
            </div>
          </header>

          {updates.length > 0 && (
            <Notice>
              <p>{updates.length} registro{updates.length === 1 ? '' : 's'} sustituiría{updates.length === 1 ? '' : 'n'} datos existentes. Márcalos uno a uno para confirmarlo.</p>
              <div className="admin-actions">
                <button type="button" className="btn-secondary btn-small" onClick={() => setConfirmed(new Set(updates.map((record) => record.ref)))}>Marcar todas</button>
                <button type="button" className="btn-secondary btn-small" onClick={() => setConfirmed(new Set())}>Desmarcar</button>
              </div>
            </Notice>
          )}

          <div className="admin-table-wrap">
            <table className="admin-table">
              <caption className="sr-only">Registros del archivo</caption>
              <thead>
                <tr><th scope="col">Resultado</th><th scope="col">Tipo</th><th scope="col">Registro</th><th scope="col">Detalle</th></tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.ref}>
                    <td data-label="Resultado">
                      {record.action === 'update' ? (
                        <label className="admin-checkbox">
                          <input type="checkbox" checked={confirmed.has(record.ref)} onChange={() => toggle(record.ref)} />
                          Actualizar
                        </label>
                      ) : <span className={`admin-badge ${ACTION_INFO[record.action].tone ? `admin-badge--${ACTION_INFO[record.action].tone}` : ''}`}>{ACTION_INFO[record.action].label}</span>}
                    </td>
                    <td data-label="Tipo">{KIND_LABELS[record.kind]}</td>
                    <td data-label="Registro">{record.label}</td>
                    <td data-label="Detalle">{record.messages.length ? record.messages.join(' · ') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="admin-sticky-bar">
            <p>Se escribirán {preview.summary.create} nuevo{preview.summary.create === 1 ? '' : 's'} y {confirmed.size} actualización{confirmed.size === 1 ? '' : 'es'}. Conflictos y errores no se escriben.</p>
            <div className="admin-actions">
              <button type="button" className="btn-secondary" onClick={reset}>Cancelar</button>
              <button type="button" className="btn-primary" disabled={busy || preview.summary.create + confirmed.size === 0} onClick={commit}>{busy ? 'Importando…' : 'Importar'}</button>
            </div>
          </div>
        </section>
      )}

      {result && (
        <section className="admin-card admin-form" aria-labelledby="result-heading">
          <h2 id="result-heading">Resultado</h2>
          <Notice tone={result.failed ? 'danger' : 'success'}>
            <p>{result.written} registro{result.written === 1 ? '' : 's'} escrito{result.written === 1 ? '' : 's'}{result.failed ? `, ${result.failed} sin escribir por errores en su lote` : ''}. {result.skipped.length} omitido{result.skipped.length === 1 ? '' : 's'}.</p>
          </Notice>
          {result.batches.filter((batch) => !batch.ok).map((batch) => (
            <Notice key={batch.index} tone="danger"><p>Lote {batch.index} ({batch.refs.length} registros): {batch.error}</p></Notice>
          ))}
          {result.skipped.length > 0 && (
            <details className="admin-details">
              <summary>Registros omitidos</summary>
              <ul className="admin-list">
                {result.skipped.map((item) => <li key={item.ref}><span>{item.label}</span><span className="admin-muted">{item.reason}</span></li>)}
              </ul>
            </details>
          )}
        </section>
      )}
    </div>
  )
}
