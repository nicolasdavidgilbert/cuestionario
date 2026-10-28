import { useMemo, useState } from 'react'
import { adminApi, fieldErrorMap } from '../../lib/adminApi'
import { FieldError, fieldProps, Notice, useCatalog } from './ui'

const LEVEL_NAMES = { grade: 'curso', subject: 'asignatura', topic: 'tema' }
const LEVEL_TITLES = { grade: 'Curso', subject: 'Asignatura', topic: 'Tema' }

function keyOf(level, key) {
  return level === 'grade' ? key.grade : level === 'subject' ? `${key.grade}/${key.subject}` : `${key.grade}/${key.subject}/${key.topic}`
}

function Counts({ count }) {
  if (!count || count.active + count.trashed === 0) return <span className="admin-muted">Sin cuestionarios</span>
  return (
    <span className="admin-muted">
      {count.active} publicado{count.active === 1 ? '' : 's'}{count.trashed ? ` · ${count.trashed} en la papelera` : ''}
    </span>
  )
}

function EntryForm({ mode, level, keyValue, entry, onDone, onCancel }) {
  const [form, setForm] = useState({
    id: '',
    name: entry?.name || '',
    short: entry?.short || '',
    description: entry?.description || '',
    sort_order: entry?.sort_order ?? ''
  })
  const [errors, setErrors] = useState({})
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const prefix = `catalog-${mode}-${level}`
  const set = (patch) => setForm((current) => ({ ...current, ...patch }))

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    const data = { name: form.name, description: form.description, sort_order: form.sort_order === '' ? undefined : Number(form.sort_order) }
    if (level === 'grade') data.short = form.short
    try {
      if (mode === 'create') await adminApi.post('/catalog', { level, key: keyValue, data: { ...data, id: form.id.trim().toLowerCase() } })
      else await adminApi.patch('/catalog', { level, key: keyValue, data })
      onDone(mode === 'create' ? `${LEVEL_TITLES[level]} «${form.name}» creado.` : 'Cambios guardados. La web los mostrará en menos de un minuto.')
    } catch (err) {
      setErrors(fieldErrorMap(err))
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="catalog-editor admin-form" onSubmit={submit} noValidate aria-label={`${mode === 'create' ? 'Nuevo' : 'Editar'} ${LEVEL_NAMES[level]}`}>
      <h3>{mode === 'create' ? `Nuevo ${LEVEL_NAMES[level]}` : `Editar ${LEVEL_NAMES[level]} ${keyOf(level, keyValue)}`}</h3>
      <Notice tone="danger">{error}</Notice>
      <div className="admin-form-row">
        {mode === 'create' && (
          <div className="form-group">
            <label htmlFor={`${prefix}-id`}>Identificador (URL)</label>
            <input id={`${prefix}-id`} type="text" value={form.id} autoFocus placeholder={level === 'grade' ? '1daw' : level === 'subject' ? 'pro' : 'ud1'}
              onChange={(event) => set({ id: event.target.value })} {...fieldProps(errors, 'id', `${prefix}-id`)} />
            <p className="field-hint">No se puede cambiar después: forma parte de la URL.</p>
            <FieldError id={`${prefix}-id-error`} message={errors.id} />
          </div>
        )}
        <div className="form-group">
          <label htmlFor={`${prefix}-name`}>Nombre</label>
          <input id={`${prefix}-name`} type="text" value={form.name} maxLength={120} autoFocus={mode === 'edit'}
            onChange={(event) => set({ name: event.target.value })} {...fieldProps(errors, 'name', `${prefix}-name`)} />
          <FieldError id={`${prefix}-name-error`} message={errors.name} />
        </div>
        <div className="form-group">
          <label htmlFor={`${prefix}-order`}>Orden</label>
          <input id={`${prefix}-order`} type="number" step="1" value={form.sort_order} placeholder="Al final"
            onChange={(event) => set({ sort_order: event.target.value })} {...fieldProps(errors, 'sort_order', `${prefix}-order`)} />
          <FieldError id={`${prefix}-order-error`} message={errors.sort_order} />
        </div>
      </div>
      {level === 'grade' && (
        <div className="form-group">
          <label htmlFor={`${prefix}-short`}>Subtítulo</label>
          <input id={`${prefix}-short`} type="text" value={form.short} maxLength={200}
            onChange={(event) => set({ short: event.target.value })} {...fieldProps(errors, 'short', `${prefix}-short`)} />
          <FieldError id={`${prefix}-short-error`} message={errors.short} />
        </div>
      )}
      <div className="form-group">
        <label htmlFor={`${prefix}-description`}>Descripción</label>
        <textarea id={`${prefix}-description`} rows={3} value={form.description} maxLength={1000}
          onChange={(event) => set({ description: event.target.value })} {...fieldProps(errors, 'description', `${prefix}-description`)} />
        <p className="field-hint">Se muestra en las páginas públicas y en los metadatos para buscadores.</p>
        <FieldError id={`${prefix}-description-error`} message={errors.description} />
      </div>
      <div className="admin-actions">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Guardando…' : mode === 'create' ? 'Crear' : 'Guardar'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

function DeleteForm({ level, keyValue, count, targets, onDone, onCancel }) {
  const used = count && count.active + count.trashed > 0
  const [target, setTarget] = useState('')
  const [deleteSource, setDeleteSource] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const label = keyOf(level, keyValue)

  const submit = async (event) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (used) {
        const to = targets.find((item) => item.value === target)?.key
        const result = await adminApi.post('/catalog/reassign', { level, from: keyValue, to, deleteSource })
        onDone(`${result.moved} cuestionario${result.moved === 1 ? '' : 's'} reasignado${result.moved === 1 ? '' : 's'} a ${target}${result.deleted ? ` y ${LEVEL_NAMES[level]} ${label} eliminado` : ''}.`)
      } else {
        await adminApi.del('/catalog', { level, key: keyValue })
        onDone(`${LEVEL_TITLES[level]} ${label} eliminado.`)
      }
    } catch (err) {
      setError(err.message)
      setSaving(false)
    }
  }

  return (
    <form className="catalog-editor admin-form" onSubmit={submit} noValidate aria-label={`Eliminar ${LEVEL_NAMES[level]} ${label}`}>
      <h3>{used ? `Reasignar y eliminar ${label}` : `Eliminar ${label}`}</h3>
      <Notice tone="danger">{error}</Notice>
      {used ? (
        <>
          <p>
            Tiene {count.active} cuestionario{count.active === 1 ? '' : 's'} publicado{count.active === 1 ? '' : 's'} y {count.trashed} en la papelera,
            así que no se puede eliminar directamente. Elige a dónde moverlos: sus URLs cambiarán.
            {level !== 'topic' && ` Los ${level === 'grade' ? 'asignaturas y temas' : 'temas'} conservan sus identificadores.`}
          </p>
          <div className="form-group">
            <label htmlFor={`reassign-${label}`}>Mover a</label>
            <select id={`reassign-${label}`} value={target} onChange={(event) => setTarget(event.target.value)} autoFocus>
              <option value="">Elige…</option>
              {targets.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </div>
          <label className="admin-checkbox">
            <input type="checkbox" checked={deleteSource} onChange={(event) => setDeleteSource(event.target.checked)} />
            Eliminar {label} después de moverlos
          </label>
          <p className="field-hint">Si algún cuestionario choca con uno publicado en el destino, no se mueve nada.</p>
        </>
      ) : (
        <p>{level === 'topic' ? 'El tema no tiene cuestionarios.' : `No tiene cuestionarios. Se eliminarán también sus ${level === 'grade' ? 'asignaturas y temas' : 'temas'} vacíos.`}</p>
      )}
      <div className="admin-actions">
        <button type="submit" className="btn-primary btn-danger" disabled={saving || (used && !target)}>{used ? 'Reasignar' : 'Eliminar'}</button>
        <button type="button" className="btn-secondary" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}

export default function AdminCatalog() {
  const { catalog, counts, error, reload } = useCatalog()
  const [panel, setPanel] = useState(null)
  const [notice, setNotice] = useState('')

  const countMap = useMemo(() => {
    const map = new Map()
    const add = (key, row) => {
      const current = map.get(key) || { active: 0, trashed: 0 }
      map.set(key, { active: current.active + row.active, trashed: current.trashed + row.trashed })
    }
    for (const row of counts) {
      add(row.grado, row)
      add(`${row.grado}/${row.course_id}`, row)
      add(`${row.grado}/${row.course_id}/${row.topic}`, row)
    }
    return map
  }, [counts])

  const targetsFor = (level, exclude) => {
    const list = []
    for (const grade of catalog?.grades || []) {
      if (level === 'grade') list.push({ value: grade.id, label: `${grade.name} (${grade.id})`, key: { grade: grade.id } })
      for (const subject of grade.subjects) {
        if (level === 'subject') list.push({ value: `${grade.id}/${subject.id}`, label: `${grade.name} › ${subject.name} (${subject.id})`, key: { grade: grade.id, subject: subject.id } })
        if (level === 'topic') {
          for (const topic of subject.topics) list.push({ value: `${grade.id}/${subject.id}/${topic.id}`, label: `${grade.id} › ${subject.name} › ${topic.name} (${topic.id})`, key: { grade: grade.id, subject: subject.id, topic: topic.id } })
        }
      }
    }
    return list.filter((item) => item.value !== exclude)
  }

  const isOpen = (mode, level, key) => panel && panel.mode === mode && panel.level === level && keyOf(level, panel.key) === keyOf(level, key)
  const done = (message) => {
    setPanel(null)
    setNotice(message)
    reload()
  }
  const renderPanel = (level, key, entry, parentKey) => {
    if (!panel) return null
    if (panel.mode === 'create' && panel.level === level && JSON.stringify(panel.key) === JSON.stringify(parentKey)) {
      return <EntryForm mode="create" level={level} keyValue={parentKey} onDone={done} onCancel={() => setPanel(null)} />
    }
    if (entry && isOpen('edit', level, key)) return <EntryForm mode="edit" level={level} keyValue={key} entry={entry} onDone={done} onCancel={() => setPanel(null)} />
    if (entry && isOpen('delete', level, key)) {
      return <DeleteForm level={level} keyValue={key} count={countMap.get(keyOf(level, key))} targets={targetsFor(level, keyOf(level, key))} onDone={done} onCancel={() => setPanel(null)} />
    }
    return null
  }

  const actions = (level, key, extra) => (
    <div className="admin-actions">
      {extra}
      <button type="button" className="btn-secondary btn-small" onClick={() => { setNotice(''); setPanel({ mode: 'edit', level, key }) }}>Editar<span className="sr-only"> {keyOf(level, key)}</span></button>
      <button type="button" className="btn-clear btn-danger btn-small" onClick={() => { setNotice(''); setPanel({ mode: 'delete', level, key }) }}>Eliminar<span className="sr-only"> {keyOf(level, key)}</span></button>
    </div>
  )

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Catálogo</h1>
          <p>Cursos, asignaturas y temas: sus nombres, descripciones y orden se usan en toda la web. Los identificadores forman las URLs y no cambian.</p>
        </div>
        <button type="button" className="btn-primary" onClick={() => setPanel({ mode: 'create', level: 'grade', key: {} })}>Nuevo curso</button>
      </header>

      <Notice tone="danger">{error}</Notice>
      {notice && <Notice tone="success">{notice}</Notice>}
      {renderPanel('grade', null, null, {})}

      {!catalog ? <div className="loading">Cargando catálogo…</div> : (
        <div className="catalog-tree">
          {catalog.grades.length === 0 && <p className="admin-empty">Todavía no hay cursos.</p>}
          {catalog.grades.map((grade) => {
            const gradeKey = { grade: grade.id }
            return (
              <section key={grade.id} className="catalog-node" aria-labelledby={`grade-${grade.id}`}>
                <div className="catalog-row">
                  <div className="catalog-node__title">
                    <strong id={`grade-${grade.id}`}>{grade.name} <span className="admin-code">{grade.id}</span></strong>
                    <span className="admin-muted">Orden {grade.sort_order} · <Counts count={countMap.get(grade.id)} /></span>
                  </div>
                  {actions('grade', gradeKey, (
                    <>
                      <a className="btn-secondary btn-small" href={`/admin/cuestionarios?grade=${grade.id}`}>Cuestionarios</a>
                      <button type="button" className="btn-secondary btn-small" onClick={() => setPanel({ mode: 'create', level: 'subject', key: gradeKey })}>Añadir asignatura</button>
                    </>
                  ))}
                </div>
                {renderPanel('grade', gradeKey, grade, null)}
                {renderPanel('subject', null, null, gradeKey)}

                <div className="catalog-children">
                  {grade.subjects.length === 0 && <p className="admin-muted">Sin asignaturas.</p>}
                  {grade.subjects.map((subject) => {
                    const subjectKey = { grade: grade.id, subject: subject.id }
                    return (
                      <section key={subject.id} className="catalog-node" aria-labelledby={`subject-${grade.id}-${subject.id}`}>
                        <div className="catalog-row">
                          <div className="catalog-node__title">
                            <strong id={`subject-${grade.id}-${subject.id}`}>{subject.name} <span className="admin-code">{subject.id}</span></strong>
                            <span className="admin-muted">Orden {subject.sort_order} · <Counts count={countMap.get(`${grade.id}/${subject.id}`)} /></span>
                          </div>
                          {actions('subject', subjectKey, (
                            <button type="button" className="btn-secondary btn-small" onClick={() => setPanel({ mode: 'create', level: 'topic', key: subjectKey })}>Añadir tema</button>
                          ))}
                        </div>
                        {renderPanel('subject', subjectKey, subject, null)}
                        {renderPanel('topic', null, null, subjectKey)}

                        <div className="catalog-children">
                          {subject.topics.length === 0 ? <p className="admin-muted">Sin temas.</p> : (
                            <div className="catalog-topic-list">
                              {subject.topics.map((topic) => {
                                const topicKey = { grade: grade.id, subject: subject.id, topic: topic.id }
                                const count = countMap.get(`${grade.id}/${subject.id}/${topic.id}`)
                                return (
                                  <div key={topic.id}>
                                    <div className="catalog-row">
                                      <div className="catalog-node__title">
                                        <span><strong>{topic.name}</strong> <span className="admin-code">{topic.id}</span></span>
                                        <span className="admin-muted">Orden {topic.sort_order} · <Counts count={count} /></span>
                                      </div>
                                      {actions('topic', topicKey, (
                                        <>
                                          {count?.active > 0 && <a className="btn-secondary btn-small" href={`/${grade.id}/${subject.id}/${topic.id}`} target="_blank" rel="noopener">Ver ↗</a>}
                                          {count && count.active + count.trashed > 0 && <a className="btn-secondary btn-small" href={`/admin/cuestionarios?grade=${grade.id}&subject=${subject.id}&topic=${topic.id}`}>Cuestionarios</a>}
                                        </>
                                      ))}
                                    </div>
                                    {renderPanel('topic', topicKey, topic, null)}
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      </section>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
