import { useEffect, useMemo, useRef, useState } from 'react'
import { adminApi, AdminApiError, fieldErrorMap } from '../../lib/adminApi'
import { validateQuizJson } from '../../lib/quizValidator'
import { QUIZ_LIMITS } from '../../lib/quizLimits'
import QuizQuestionEditor from '../QuizQuestionEditor'
import useExitTransition from '../useExitTransition'
import useUnsavedChangesWarning from '../useUnsavedChangesWarning'
import { CatalogSelects, FieldError, fieldProps, formatDate, Notice, PriorityBadge, StatusBadge, useCatalog } from './ui'

const EMPTY = { title: '', description: '', grade: '', subject: '', topic: '', questions: [] }

function snapshot(form) {
  return JSON.stringify(form)
}

function formFromQuiz(quiz) {
  return {
    title: quiz.title || '',
    description: quiz.description || '',
    grade: quiz.grado,
    subject: quiz.course_id,
    topic: quiz.unidad || quiz.course_id,
    questions: quiz.questions || []
  }
}

// Errores por pregunta a partir de campos como "questions[3].options".
function questionErrors(errors) {
  const byIndex = {}
  for (const [field, message] of Object.entries(errors)) {
    const match = field.match(/^questions\[(\d+)\]/)
    if (match) (byIndex[Number(match[1])] ||= []).push(message)
  }
  return byIndex
}

/** @param {{ id?: number | null, initialQuestion?: number | null }} props */
export default function AdminQuizEditor({ id = null, initialQuestion = null }) {
  const isNew = !id
  const { catalog } = useCatalog()
  const [quiz, setQuiz] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saved, setSaved] = useState(snapshot(EMPTY))
  const [loading, setLoading] = useState(!isNew)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  const [notice, setNotice] = useState(null)
  const [conflict, setConflict] = useState(null)
  const [editorIndex, setEditorIndex] = useState(null)
  const editorTransition = useExitTransition(editorIndex !== null)
  const [highlight, setHighlight] = useState(initialQuestion)
  const [issues, setIssues] = useState([])
  const [jsonDraft, setJsonDraft] = useState('')
  const headingRef = useRef(null)

  const dirty = snapshot(form) !== saved
  const inTrash = Boolean(quiz?.deleted_at)
  useUnsavedChangesWarning(dirty && !saving)

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminApi.get(`/quizzes/${id}`)
      setQuiz(data)
      const next = formFromQuiz(data)
      setForm(next)
      setSaved(snapshot(next))
      setConflict(null)
      setErrors({})
      const related = await adminApi.get('/issues', { quiz: id, status: 'abiertas' }).catch(() => null)
      setIssues(related?.items || [])
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isNew) load()
    const params = new URLSearchParams(window.location.search)
    if (params.get('guardado') === '1') {
      setNotice({ tone: 'success', text: 'Cuestionario creado y publicado.' })
      window.history.replaceState(null, '', window.location.pathname)
    }
  }, [id])

  // Desde la búsqueda de preguntas: lleva la pregunta a la vista y la resalta.
  useEffect(() => {
    if (highlight === null || loading) return
    document.getElementById(`question-${highlight}`)?.scrollIntoView({ block: 'center' })
  }, [loading])

  const set = (patch) => setForm((current) => ({ ...current, ...patch }))
  const qErrors = useMemo(() => questionErrors(errors), [errors])

  const payload = () => {
    // Si el tema coincide con la asignatura y no había unidad, se conserva vacía (misma ruta y hash).
    const keepEmptyUnit = quiz && !quiz.unidad && form.topic === form.subject
    return {
      title: form.title.trim(),
      description: form.description.trim(),
      grado: form.grade,
      course_id: form.subject,
      unidad: keepEmptyUnit ? '' : form.topic,
      questions: form.questions
    }
  }

  const save = async (event) => {
    event.preventDefault()
    setNotice(null)
    const body = payload()
    const local = {}
    if (!body.grado) local.grado = 'Elige un curso'
    if (!body.course_id) local.course_id = 'Elige una asignatura'
    if (!body.unidad && !(quiz && !quiz.unidad)) local.unidad = 'Elige un tema'
    const validation = validateQuizJson(body)
    for (const item of validation.errors) if (!local[item.field] && !(item.field in local)) local[item.field] = item.message
    if (Object.keys(local).length > 0) {
      setErrors(local)
      setNotice({ tone: 'danger', text: 'Revisa los campos marcados antes de guardar.' })
      return
    }

    setSaving(true)
    setErrors({})
    try {
      if (isNew) {
        const created = await adminApi.post('/quizzes', body)
        setSaved(snapshot(form))
        window.location.assign(`/admin/cuestionarios/${created.id}?guardado=1`)
        return
      }
      const updated = await adminApi.patch(`/quizzes/${id}`, { ...body, version: quiz.version })
      setQuiz(updated)
      const next = formFromQuiz(updated)
      setForm(next)
      setSaved(snapshot(next))
      setNotice({ tone: 'success', text: updated.version === quiz.version ? 'No había cambios que guardar.' : `Cambios guardados (versión ${updated.version}). La web los mostrará en menos de un minuto.` })
    } catch (err) {
      if (err instanceof AdminApiError && err.code === 'version_conflict') {
        setConflict(err.data.current)
      } else {
        setErrors(fieldErrorMap(err))
        setNotice({ tone: 'danger', text: err.message, quiz: err.data?.id })
      }
    } finally {
      setSaving(false)
    }
  }

  const trash = async () => {
    if (dirty && !window.confirm('Tienes cambios sin guardar que se perderán. ¿Enviar igualmente a la papelera?')) return
    if (!dirty && !window.confirm('¿Enviar este cuestionario a la papelera? Dejará de verse en la web; podrás restaurarlo.')) return
    try {
      const updated = await adminApi.del(`/quizzes/${id}`)
      setQuiz(updated)
      setForm(formFromQuiz(updated))
      setSaved(snapshot(formFromQuiz(updated)))
      setNotice({ tone: 'info', text: 'Enviado a la papelera. Ya no se muestra en la web.' })
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    }
  }

  const restore = async () => {
    try {
      const updated = await adminApi.post(`/quizzes/${id}/restore`)
      setQuiz(updated)
      setNotice({ tone: 'success', text: 'Restaurado: vuelve a estar publicado.' })
    } catch (err) {
      setNotice({ tone: 'danger', text: `No se pudo restaurar: ${err.message}`, quiz: err.data?.id })
    }
  }

  const applyJson = () => {
    try {
      const json = JSON.parse(jsonDraft)
      const grade = catalog?.grades.find((item) => item.id === json.grado)
      const subject = grade?.subjects.find((item) => item.id === json.course_id)
      const topicId = json.unidad || json.course_id
      set({
        title: typeof json.title === 'string' ? json.title : form.title,
        description: typeof json.description === 'string' ? json.description : form.description,
        questions: Array.isArray(json.questions) ? json.questions : form.questions,
        ...(grade ? { grade: grade.id, subject: subject?.id || '', topic: subject?.topics.some((item) => item.id === topicId) ? topicId : '' } : {})
      })
      setJsonDraft('')
      setNotice({ tone: 'info', text: `JSON aplicado: ${Array.isArray(json.questions) ? json.questions.length : 0} preguntas. Revisa la clasificación y guarda.` })
    } catch {
      setNotice({ tone: 'danger', text: 'El texto no es un JSON válido.' })
    }
  }

  if (loading) return <div className="admin-page"><div className="loading">Cargando cuestionario…</div></div>
  if (loadError) {
    return (
      <div className="admin-page">
        <a href="/admin/cuestionarios" className="quiz-back">← Cuestionarios</a>
        <Notice tone="danger">{loadError}</Notice>
      </div>
    )
  }

  const route = form.grade && form.subject ? `/${form.grade}/${form.subject}/${form.topic || form.subject}` : ''
  const count = form.questions.length

  return (
    <div className="admin-page">
      <a href={inTrash ? '/admin/papelera' : '/admin/cuestionarios'} className="quiz-back">← {inTrash ? 'Papelera' : 'Cuestionarios'}</a>
      <header className="admin-page-header">
        <div>
          <h1 ref={headingRef}>{isNew ? 'Nuevo cuestionario' : form.title || 'Cuestionario sin título'}</h1>
          {!isNew && (
            <p>
              n.º {quiz.id} · versión {quiz.version} · creado {formatDate(quiz.created_at)}
              {quiz.updated_at && <> · editado {formatDate(quiz.updated_at)}</>}
            </p>
          )}
        </div>
        {!isNew && (
          <div className="admin-actions">
            {!inTrash && <a className="btn-secondary" href={`/${quiz.grado}/${quiz.course_id}/${quiz.unidad || quiz.course_id}`} target="_blank" rel="noopener">Ver en la web ↗</a>}
            <a className="btn-secondary" href={`/admin/auditoria?entity=quiz&id=${quiz.id}`}>Historial</a>
            {inTrash
              ? <button type="button" className="btn-primary" onClick={restore}>Restaurar</button>
              : <button type="button" className="btn-clear btn-danger" onClick={trash}>Enviar a la papelera</button>}
          </div>
        )}
      </header>

      {inTrash && <Notice>Este cuestionario está en la papelera desde {formatDate(quiz.deleted_at)}. Restáuralo para poder editarlo.</Notice>}

      {conflict && (
        <Notice tone="danger">
          <p><strong>Se han guardado otros cambios mientras editabas</strong> (versión {conflict.version}, {formatDate(conflict.updated_at || conflict.created_at)}). Tus cambios no se han guardado.</p>
          <p>Copia lo que necesites conservar y carga la versión actual para continuar desde ella.</p>
          <div className="admin-actions">
            <button type="button" className="btn-primary btn-small" onClick={load}>Cargar la versión actual</button>
            <a className="btn-secondary btn-small" href={`/admin/auditoria?entity=quiz&id=${id}`} target="_blank" rel="noopener">Ver qué cambió ↗</a>
          </div>
        </Notice>
      )}

      {notice && (
        <Notice tone={notice.tone}>
          <p style={{ whiteSpace: 'pre-line' }}>{notice.text}</p>
          {notice.quiz && notice.quiz !== quiz?.id && <p><a href={`/admin/cuestionarios/${notice.quiz}`}>Abrir el cuestionario n.º {notice.quiz}</a></p>}
        </Notice>
      )}

      {issues.length > 0 && (
        <section className="admin-card" aria-labelledby="quiz-issues">
          <header><h2 id="quiz-issues">Incidencias abiertas de este cuestionario</h2></header>
          <ul className="admin-list">
            {issues.map((issue) => (
              <li key={issue.id}>
                <a href={`/admin/incidencias/${issue.id}`}>{issue.title || issue.reason.slice(0, 90)}</a>
                <span className="admin-actions"><PriorityBadge priority={issue.priority} /><StatusBadge status={issue.status} /></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form id="admin-quiz-form" className="admin-form" onSubmit={save} noValidate>
        <fieldset className="admin-card admin-form" disabled={inTrash}>
          <legend className="sr-only">Datos del cuestionario</legend>
          <div className="form-group">
            <label htmlFor="quiz-title">Título</label>
            <input id="quiz-title" type="text" value={form.title} maxLength={QUIZ_LIMITS.titleMaxLength}
              onChange={(event) => set({ title: event.target.value })} {...fieldProps(errors, 'title', 'quiz-title')} />
            <FieldError id="quiz-title-error" message={errors.title} />
          </div>
          <div className="form-group">
            <label htmlFor="quiz-description">Descripción</label>
            <textarea id="quiz-description" rows={3} value={form.description} maxLength={QUIZ_LIMITS.descriptionMaxLength}
              onChange={(event) => set({ description: event.target.value })} {...fieldProps(errors, 'description', 'quiz-description')} />
            <FieldError id="quiz-description-error" message={errors.description} />
          </div>
          <div className="admin-form-row">
            <CatalogSelects idPrefix="quiz" catalog={catalog} allowEmpty={false} errors={errors}
              value={{ grade: form.grade, subject: form.subject, topic: form.topic }}
              onChange={(value) => set(value)} />
          </div>
          <p className="field-hint">
            {route ? <>Se publicará en <span className="admin-code">{route}</span>. </> : null}
            Para usar un curso, asignatura o tema nuevo, créalo antes en el <a href="/admin/catalogo">catálogo</a>.
            {!isNew && (form.grade !== quiz.grado || form.subject !== quiz.course_id || form.topic !== (quiz.unidad || quiz.course_id)) && <strong> Cambiar la clasificación cambia la URL pública.</strong>}
          </p>
        </fieldset>

        <section className="admin-card" aria-labelledby="quiz-questions">
          <header>
            <h2 id="quiz-questions">Preguntas ({count})</h2>
            <div className="admin-actions">
              <span className={`admin-badge ${count < QUIZ_LIMITS.minQuestions || count > QUIZ_LIMITS.maxQuestions ? 'admin-badge--danger' : 'admin-badge--success'}`}>
                Entre {QUIZ_LIMITS.minQuestions} y {QUIZ_LIMITS.maxQuestions}
              </span>
              {!inTrash && <button type="button" className="btn-primary btn-small" onClick={() => setEditorIndex(-1)}>Editar preguntas</button>}
            </div>
          </header>
          <FieldError id="quiz-questions-error" message={errors.questions} />

          {isNew && (
            <details className="admin-details" open={count === 0}>
              <summary>Rellenar desde JSON</summary>
              <div className="admin-form" style={{ marginTop: 10 }}>
                <label htmlFor="quiz-json" className="sr-only">JSON del cuestionario</label>
                <textarea id="quiz-json" rows={6} value={jsonDraft} placeholder='{"title": "...", "grado": "1asir", "course_id": "pni", "unidad": "ud1", "questions": [...]}'
                  onChange={(event) => setJsonDraft(event.target.value)} />
                <div className="admin-actions"><button type="button" className="btn-secondary btn-small" disabled={!jsonDraft.trim()} onClick={applyJson}>Aplicar JSON</button></div>
              </div>
            </details>
          )}

          {count === 0 ? <p className="admin-muted">Todavía no hay preguntas. Usa «Editar preguntas» para añadirlas.</p> : (
            <ol className="admin-question-list" aria-label="Vista previa de las preguntas">
              {form.questions.map((question, index) => (
                <li key={index} id={`question-${index}`} className="admin-question"
                  data-error={qErrors[index] ? 'true' : undefined} data-highlight={highlight === index ? 'true' : undefined}>
                  <header>
                    <h3>{index + 1}. {question.question || <em>Sin enunciado</em>}</h3>
                    {!inTrash && <button type="button" className="btn-secondary btn-small" onClick={() => { setHighlight(index); setEditorIndex(index) }}>Editar<span className="sr-only"> la pregunta {index + 1}</span></button>}
                  </header>
                  <ol type="A">
                    {(question.options || []).map((option, optionIndex) => (
                      <li key={optionIndex} className={optionIndex === question.answer ? 'correct-option' : ''}>
                        {option || <em>Vacía</em>}{optionIndex === question.answer && <span className="sr-only"> (correcta)</span>}
                      </li>
                    ))}
                  </ol>
                  {question.explanation && <p>{question.explanation}</p>}
                  {qErrors[index]?.map((message) => <p key={message} className="field-error">{message}</p>)}
                </li>
              ))}
            </ol>
          )}
        </section>

        {!inTrash && (
          <div className="admin-sticky-bar">
            <p role="status">{saving ? 'Guardando…' : dirty ? 'Hay cambios sin guardar.' : isNew ? 'Completa los datos para publicar.' : 'Todo guardado.'}</p>
            <div className="admin-actions">
              {dirty && !isNew && <button type="button" className="btn-clear btn-small" onClick={() => { setForm(JSON.parse(saved)); setErrors({}) }}>Descartar cambios</button>}
              <button type="submit" className="btn-primary" disabled={saving || (!dirty && !isNew)}>{isNew ? 'Crear y publicar' : 'Guardar cambios'}</button>
            </div>
          </div>
        )}
      </form>

      {editorTransition.mounted && (
        <QuizQuestionEditor
          transitionState={editorTransition.state}
          initialQuestions={form.questions}
          initialFocusIndex={editorIndex >= 0 ? editorIndex : null}
          onSave={(questions) => {
            set({ questions })
            setErrors((current) => Object.fromEntries(Object.entries(current).filter(([field]) => !field.startsWith('questions'))))
            setEditorIndex(null)
          }}
          onCancel={() => setEditorIndex(null)}
        />
      )}
    </div>
  )
}
