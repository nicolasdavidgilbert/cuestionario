import { useCallback, useEffect, useRef, useState } from 'react'
import { adminApi } from '../../lib/adminApi'

// Piezas comunes de las pantallas del panel.

export const STATUS_LABELS = { pendiente: 'Pendiente', en_revision: 'En revisión', resuelta: 'Resuelta', descartada: 'Descartada' }
export const PRIORITY_LABELS = { baja: 'Baja', normal: 'Normal', alta: 'Alta', urgente: 'Urgente' }
export const KIND_LABELS = { contenido: 'Contenido', error: 'Error de la web', mejora: 'Mejora', otro: 'Otro' }

export function formatDate(value, withTime = true) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('es-ES', withTime
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value))
}

export function quizRoute(quiz) {
  return `/${quiz.grado}/${quiz.course_id}/${quiz.topic || quiz.unidad || quiz.course_id}`
}

export function StatusBadge({ status }) {
  const tone = status === 'pendiente' ? 'accent' : status === 'resuelta' ? 'success' : status === 'descartada' ? '' : 'accent'
  return <span className={`admin-badge ${tone ? `admin-badge--${tone}` : ''}`}>{STATUS_LABELS[status] || status}</span>
}

export function PriorityBadge({ priority }) {
  const tone = priority === 'urgente' ? 'danger' : priority === 'alta' ? 'accent' : ''
  return <span className={`admin-badge ${tone ? `admin-badge--${tone}` : ''}`}>{PRIORITY_LABELS[priority] || priority}</span>
}

export function FieldError({ id, message }) {
  if (!message) return null
  return <p className="field-error" id={id} role="alert">{message}</p>
}

// Props para enlazar un campo con su mensaje de error (aria-invalid + aria-describedby).
export function fieldProps(errors, field, id) {
  return errors?.[field]
    ? { 'aria-invalid': 'true', 'aria-describedby': `${id}-error` }
    : {}
}

export function Notice({ tone = 'info', children }) {
  if (!children) return null
  return (
    <div className={`admin-notice ${tone !== 'info' ? `admin-notice--${tone}` : ''}`} role={tone === 'danger' ? 'alert' : 'status'}>
      {children}
    </div>
  )
}

export function Pagination({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav className="admin-pagination" aria-label="Paginación">
      <p>{total === 0 ? 'Sin resultados' : `${from}–${to} de ${total}`}</p>
      {pages > 1 && (
        <div className="admin-actions">
          <button type="button" className="btn-secondary btn-small" disabled={page <= 1} onClick={() => onPage(page - 1)}>Anterior</button>
          <span className="admin-muted">Página {page} de {pages}</span>
          <button type="button" className="btn-secondary btn-small" disabled={page >= pages} onClick={() => onPage(page + 1)}>Siguiente</button>
        </div>
      )}
    </nav>
  )
}

// Lee y escribe los filtros en la URL para que recargar o volver atrás conserve la vista.
// `search` llega de Astro.url.search: el servidor no tiene window y así el
// HTML inicial coincide con lo que hidrata el navegador.
export function useUrlFilters(defaults, search = '') {
  const [filters, setFilters] = useState(() => {
    const params = new URLSearchParams(search)
    const initial = { ...defaults }
    for (const key of Object.keys(defaults)) {
      if (params.has(key)) initial[key] = key === 'page' ? Number(params.get(key)) || 1 : params.get(key)
    }
    return initial
  })

  const update = useCallback((patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch, page: patch.page ?? 1 }
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(next)) {
        if (value !== '' && value !== undefined && value !== defaults[key]) params.set(key, String(value))
      }
      const query = params.toString()
      window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}`)
      return next
    })
  }, [])

  return [filters, update]
}

// Carga un recurso de la API cada vez que cambian los parámetros; reload() fuerza otra lectura.
// Con path null no se pide nada (por ejemplo, una búsqueda vacía).
export function useAdminResource(path, params) {
  const [state, setState] = useState({ loading: Boolean(path), error: '', data: null })
  const [tick, setTick] = useState(0)
  const key = JSON.stringify(params || {})
  const latest = useRef(0)

  useEffect(() => {
    const requestId = ++latest.current
    if (!path) {
      setState({ loading: false, error: '', data: null })
      return
    }
    setState((current) => ({ ...current, loading: true, error: '' }))
    adminApi.get(path, params)
      .then((data) => { if (latest.current === requestId) setState({ loading: false, error: '', data }) })
      .catch((error) => { if (latest.current === requestId) setState((current) => ({ ...current, loading: false, error: error.message })) })
  }, [path, key, tick])

  return { ...state, reload: () => setTick((value) => value + 1) }
}

// Campo de búsqueda que espera a que se deje de escribir.
// Con `name`, un Intro antes de hidratar envía el formulario por GET y el servidor aplica el filtro igualmente.
export function SearchInput({ id, name = 'q', label, value, onChange, placeholder }) {
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  useEffect(() => {
    if (draft === value) return
    const timer = setTimeout(() => onChange(draft), 350)
    return () => clearTimeout(timer)
  }, [draft])

  return (
    <div className="form-group form-group--wide">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type="search" value={draft} placeholder={placeholder} onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => { if (event.key === 'Enter') onChange(draft) }} />
    </div>
  )
}

// Selectores encadenados de curso → asignatura → tema a partir del catálogo administrado.
export function CatalogSelects({ catalog, value, onChange, idPrefix, labels = {}, allowEmpty = true, errors = {}, disabled = false }) {
  const grades = catalog?.grades || []
  const grade = grades.find((item) => item.id === value.grade)
  const subject = grade?.subjects.find((item) => item.id === value.subject)
  const emptyLabel = allowEmpty ? 'Todos' : 'Elige…'

  return (
    <>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-grade`}>{labels.grade || 'Curso'}</label>
        <select id={`${idPrefix}-grade`} value={value.grade} disabled={disabled} {...fieldProps(errors, 'grado', `${idPrefix}-grade`)}
          onChange={(event) => onChange({ grade: event.target.value, subject: '', topic: '' })}>
          <option value="">{emptyLabel}</option>
          {grades.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
        </select>
        <FieldError id={`${idPrefix}-grade-error`} message={errors.grado} />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-subject`}>{labels.subject || 'Asignatura'}</label>
        <select id={`${idPrefix}-subject`} value={value.subject} disabled={disabled || !grade} {...fieldProps(errors, 'course_id', `${idPrefix}-subject`)}
          onChange={(event) => onChange({ ...value, subject: event.target.value, topic: '' })}>
          <option value="">{emptyLabel}</option>
          {(grade?.subjects || []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
        </select>
        <FieldError id={`${idPrefix}-subject-error`} message={errors.course_id} />
      </div>
      <div className="form-group">
        <label htmlFor={`${idPrefix}-topic`}>{labels.topic || 'Tema'}</label>
        <select id={`${idPrefix}-topic`} value={value.topic} disabled={disabled || !subject} {...fieldProps(errors, 'unidad', `${idPrefix}-topic`)}
          onChange={(event) => onChange({ ...value, topic: event.target.value })}>
          <option value="">{emptyLabel}</option>
          {(subject?.topics || []).map((item) => <option key={item.id} value={item.id}>{item.name} ({item.id})</option>)}
        </select>
        <FieldError id={`${idPrefix}-topic-error`} message={errors.unidad} />
      </div>
    </>
  )
}

export function useCatalog() {
  const { data, error, reload } = useAdminResource('/catalog')
  return { catalog: data?.catalog || null, counts: data?.counts || [], error, reload }
}
