import useExitTransition from './useExitTransition'
import { useState, useEffect, useRef, useMemo } from 'react'
import * as Sentry from '@sentry/astro'
import { ApiError, getQuizById, updateQuiz } from '../lib/api'
import { getOwnerToken } from '../lib/ownerToken'
import QuizQuestionEditor from './QuizQuestionEditor'
import FloatingActions from './FloatingActions'
import useUnsavedChangesWarning from './useUnsavedChangesWarning'

export default function EditQuiz({ id }) {
  const [quiz, setQuiz] = useState(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)
  const editorTransition = useExitTransition(editorOpen)
  const saveButtonRef = useRef(null)
  const [savedSnapshot, setSavedSnapshot] = useState('')
  const hasUnsavedChanges = useMemo(
    () => Boolean(savedSnapshot) && JSON.stringify({ title, description, questions }) !== savedSnapshot,
    [savedSnapshot, title, description, questions]
  )

  // Mientras se guarda (y durante la redirección posterior) no se avisa.
  useUnsavedChangesWarning(hasUnsavedChanges && !saving)

  useEffect(() => {
    loadQuiz()
  }, [id])

  const loadQuiz = async () => {
    try {
      const data = await getQuizById(Number(id), getOwnerToken())
      if (!data.can_delete) {
        setLoadError('Solo puedes editar los cuestionarios creados desde este navegador.')
        return
      }
      setQuiz(data)
      setTitle(data.title || '')
      setDescription(data.description || '')
      setQuestions(data.questions || [])
      setSavedSnapshot(JSON.stringify({ title: data.title || '', description: data.description || '', questions: data.questions || [] }))
    } catch (e) {
      Sentry.captureException(e, { tags: { feature: 'edit-quiz-load' } })
      setLoadError('Cuestionario no encontrado.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    try {
      await updateQuiz(Number(id), {
        title: title.trim(),
        description: description.trim(),
        questions,
        version: quiz.version
      }, getOwnerToken())
      window.location.href = '/mis-cuestionarios'
    } catch (err) {
      // Otro guardado (otra pestaña o la administración) llegó antes: no se sobrescribe.
      if (err instanceof ApiError && (err.code === 'version_conflict' || err.code === 'version_required')) {
        setConflict(true)
        setError(err.message)
      } else {
        Sentry.captureException(err, { tags: { feature: 'edit-quiz-save' } })
        setError('No se pudo guardar: ' + err.message)
      }
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="page-wrap">
        <a href="/mis-cuestionarios" className="quiz-back">← Mis cuestionarios</a>
        <div className="error-msg">{loadError}</div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <a href="/mis-cuestionarios" className="quiz-back">← Mis cuestionarios</a>

      <header className="home-header">
        <p className="section-kicker">{[quiz.grado?.toUpperCase(), quiz.course_id, quiz.unidad].filter(Boolean).join(' · ')}</p>
        <h1>Editar cuestionario</h1>
        <p>Cambia el título, la descripción o las preguntas. El grado, la asignatura y la unidad no se pueden modificar.</p>
      </header>

      <form id="edit-quiz-form" onSubmit={handleSubmit} className="create-quiz-form">
        <div className="form-group">
          <label htmlFor="quiz-title">Título</label>
          <input
            id="quiz-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título del cuestionario"
            maxLength={100}
          />
        </div>

        <div className="form-group">
          <label htmlFor="quiz-description">Descripción (opcional)</label>
          <textarea
            id="quiz-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        <details className="questions-preview">
          <summary>Ver preguntas ({questions.length})</summary>
          <div className="questions-list">
            {questions.map((q, i) => (
              <div key={i} className="question-preview-item">
                <div className="question-preview-heading">
                  <span className="question-preview-num">{i + 1}.</span>
                  <span className="question-preview-text">{q.question}</span>
                </div>
                <ol className="question-preview-options">
                  {q.options.map((option, optionIndex) => (
                    <li key={optionIndex} className={optionIndex === q.answer ? 'correct-option' : ''}>
                      {option}
                    </li>
                  ))}
                </ol>
                {q.explanation && <p className="question-preview-explanation">{q.explanation}</p>}
              </div>
            ))}
          </div>
        </details>

        <div className="preview-actions">
          <button type="button" onClick={() => setEditorOpen(true)} className="btn-secondary">
            Editar preguntas
          </button>
        </div>

        {error && (
          <div className="error-msg error-box" role="alert">
            {error}
            {conflict && (
              <div className="preview-actions" style={{ marginTop: 10 }}>
                <button type="button" className="btn-secondary" onClick={() => {
                  if (!window.confirm('Se descartarán tus cambios y se cargará la versión guardada. ¿Continuar?')) return
                  setConflict(false)
                  setError('')
                  setLoading(true)
                  loadQuiz()
                }}>Cargar la versión guardada</button>
              </div>
            )}
          </div>
        )}

        <button ref={saveButtonRef} type="submit" disabled={saving} className="btn-submit">
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </form>

      <FloatingActions anchorRefs={[saveButtonRef]} actions={[
        { label: saving ? 'Guardando...' : 'Guardar cambios', icon: 'save', form: 'edit-quiz-form', disabled: saving },
        { label: 'Editar preguntas', icon: 'pencil', variant: 'secondary', onClick: () => setEditorOpen(true) }
      ]} />

      {editorTransition.mounted && (
        <QuizQuestionEditor
          transitionState={editorTransition.state}
          initialQuestions={questions}
          onSave={(nextQuestions) => {
            setQuestions(nextQuestions)
            setEditorOpen(false)
          }}
          onCancel={() => setEditorOpen(false)}
        />
      )}
    </div>
  )
}
