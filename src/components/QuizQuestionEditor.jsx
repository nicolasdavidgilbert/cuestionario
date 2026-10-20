import { useState, useEffect, useRef } from 'react'
import useUnsavedChangesWarning from './useUnsavedChangesWarning'

const EDITOR_OPTION_COUNT = 4

function createEmptyQuestion() {
  return {
    question: '',
    options: Array(EDITOR_OPTION_COUNT).fill(''),
    answer: 0,
    explanation: ''
  }
}

function cloneQuestionsForEdit(questions = []) {
  return questions.map((question) => {
    const rawOptions = Array.isArray(question.options) && question.options.length > 0
      ? question.options.map((option) => String(option ?? ''))
      : []
    const options = rawOptions.slice(0, EDITOR_OPTION_COUNT)
    while (options.length < EDITOR_OPTION_COUNT) options.push('')

    const answer = Number.isInteger(question.answer) && question.answer >= 0 && question.answer < EDITOR_OPTION_COUNT
      ? question.answer
      : 0

    return {
      question: String(question.question ?? ''),
      options,
      answer,
      explanation: String(question.explanation ?? '')
    }
  })
}

function validateDraftQuestions(questions) {
  if (questions.length === 0) {
    return 'Añade al menos una pregunta antes de guardar.'
  }

  for (let questionIndex = 0; questionIndex < questions.length; questionIndex += 1) {
    const question = questions[questionIndex]
    const questionNumber = questionIndex + 1
    const options = question.options.map((option) => option.trim())

    if (!question.question.trim()) return `La pregunta ${questionNumber} necesita un enunciado.`
    if (options.length !== EDITOR_OPTION_COUNT) return `La pregunta ${questionNumber} debe tener exactamente ${EDITOR_OPTION_COUNT} respuestas.`
    if (options.some((option) => !option)) return `La pregunta ${questionNumber} tiene respuestas vacías.`
    if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= options.length) {
      return `Marca una respuesta correcta válida en la pregunta ${questionNumber}.`
    }
  }

  return ''
}

export default function QuizQuestionEditor({ initialQuestions, onSave, onCancel }) {
  const [draftQuestions, setDraftQuestions] = useState(() => cloneQuestionsForEdit(initialQuestions))
  const [initialSnapshot] = useState(() => JSON.stringify(cloneQuestionsForEdit(initialQuestions)))
  const hasChanges = JSON.stringify(draftQuestions) !== initialSnapshot
  useUnsavedChangesWarning(hasChanges)
  const [editorError, setEditorError] = useState('')
  const focusQuestionIndex = useRef(null)

  useEffect(() => {
    document.body.classList.add('modal-open')
    return () => {
      document.body.classList.remove('modal-open')
    }
  }, [])

  const updateDraftQuestion = (questionIndex, patch) => {
    setDraftQuestions((questions) => questions.map((question, index) => (
      index === questionIndex ? { ...question, ...patch } : question
    )))
  }

  const updateDraftOption = (questionIndex, optionIndex, value) => {
    setDraftQuestions((questions) => questions.map((question, index) => {
      if (index !== questionIndex) return question

      return {
        ...question,
        options: question.options.map((option, currentIndex) => currentIndex === optionIndex ? value : option)
      }
    }))
  }

  // Tras añadir una pregunta, llevar al usuario a ella sin tener que bajar a mano.
  useEffect(() => {
    if (focusQuestionIndex.current === null) return
    const field = document.getElementById(`editor-question-${focusQuestionIndex.current}`)
    focusQuestionIndex.current = null
    if (!field) return
    field.closest('.quiz-editor-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    field.focus({ preventScroll: true })
  }, [draftQuestions.length])

  const addDraftQuestion = () => {
    focusQuestionIndex.current = draftQuestions.length
    setDraftQuestions((questions) => [...questions, createEmptyQuestion()])
  }

  const removeDraftQuestion = (questionIndex) => {
    setDraftQuestions((questions) => questions.filter((_, index) => index !== questionIndex))
  }

  const moveDraftQuestion = (questionIndex, direction) => {
    setDraftQuestions((questions) => {
      const targetIndex = questionIndex + direction
      if (targetIndex < 0 || targetIndex >= questions.length) return questions

      const nextQuestions = [...questions]
      const [movedQuestion] = nextQuestions.splice(questionIndex, 1)
      nextQuestions.splice(targetIndex, 0, movedQuestion)
      return nextQuestions
    })
  }

  const cancelQuestionEditor = () => {
    if (hasChanges && !window.confirm('Tienes cambios sin guardar en las preguntas. ¿Descartarlos?')) return
    onCancel()
  }

  const saveQuestionEditor = () => {
    const validationMessage = validateDraftQuestions(draftQuestions)
    if (validationMessage) {
      setEditorError(validationMessage)
      return
    }

    onSave(draftQuestions.map((question) => ({
      question: question.question.trim(),
      options: question.options.map((option) => option.trim()),
      answer: question.answer,
      explanation: question.explanation.trim()
    })))
  }

  return (
    <div className="quiz-editor-modal" role="dialog" aria-modal="true" aria-labelledby="quiz-editor-title" onWheel={(e) => e.stopPropagation()} onTouchMove={(e) => e.stopPropagation()}>
      <div className="quiz-editor-panel">
        <div className="quiz-editor-header">
          <div>
            <p className="section-kicker">Editor visual</p>
            <h2 id="quiz-editor-title">Editar cuestionario</h2>
            <p>{draftQuestions.length} pregunta{draftQuestions.length === 1 ? '' : 's'} en edición</p>
          </div>
          <div className="quiz-editor-header-actions">
            <button type="button" className="btn-secondary" onClick={cancelQuestionEditor}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={saveQuestionEditor}>Guardar cambios</button>
          </div>
        </div>

        {editorError && <div className="error-msg error-box quiz-editor-error">{editorError}</div>}

        <div className="quiz-editor-body">
          {draftQuestions.map((question, questionIndex) => (
            <article key={questionIndex} className="quiz-editor-card">
              <div className="quiz-editor-card-header">
                <div>
                  <span className="question-number">Pregunta {questionIndex + 1}</span>
                  <h3>{question.question.trim() || 'Pregunta sin enunciado'}</h3>
                </div>
                <div className="quiz-editor-card-actions">
                  <button type="button" className="btn-secondary" onClick={() => moveDraftQuestion(questionIndex, -1)} disabled={questionIndex === 0}>Subir</button>
                  <button type="button" className="btn-secondary" onClick={() => moveDraftQuestion(questionIndex, 1)} disabled={questionIndex === draftQuestions.length - 1}>Bajar</button>
                  <button type="button" className="btn-clear btn-danger" onClick={() => removeDraftQuestion(questionIndex)}>Eliminar</button>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor={`editor-question-${questionIndex}`}>Enunciado</label>
                <textarea id={`editor-question-${questionIndex}`} value={question.question} onChange={(e) => updateDraftQuestion(questionIndex, { question: e.target.value })} rows={3} />
              </div>

              <div className="quiz-editor-options" role="group" aria-label={`Respuestas de la pregunta ${questionIndex + 1}`}>
                <div className="quiz-editor-options-heading">
                  <span>Respuestas</span>
                  <span>Correcta</span>
                </div>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="quiz-editor-option-row">
                    <label className="quiz-editor-radio">
                      <input type="radio" name={`correct-answer-${questionIndex}`} checked={question.answer === optionIndex} onChange={() => updateDraftQuestion(questionIndex, { answer: optionIndex })} />
                      <span className="sr-only">Marcar respuesta {optionIndex + 1} como correcta</span>
                    </label>
                    <input type="text" value={option} onChange={(e) => updateDraftOption(questionIndex, optionIndex, e.target.value)} placeholder={`Respuesta ${optionIndex + 1}`} />
                  </div>
                ))}
              </div>

              <div className="form-group">
                <label htmlFor={`editor-explanation-${questionIndex}`}>Explicación</label>
                <textarea id={`editor-explanation-${questionIndex}`} value={question.explanation} onChange={(e) => updateDraftQuestion(questionIndex, { explanation: e.target.value })} rows={3} />
              </div>
            </article>
          ))}

          <button type="button" className="btn-secondary quiz-editor-add-question" onClick={addDraftQuestion}>Añadir pregunta</button>
        </div>

        <div className="quiz-editor-footer">
          <button type="button" className="btn-secondary quiz-editor-add-footer" onClick={addDraftQuestion} aria-label="Añadir pregunta">
            <span aria-hidden="true">+</span><span className="quiz-editor-add-text" aria-hidden="true">Añadir pregunta</span>
          </button>
          <button type="button" className="btn-secondary" onClick={cancelQuestionEditor}>Cancelar</button>
          <button type="button" className="btn-primary" onClick={saveQuestionEditor}>Guardar cambios</button>
        </div>
      </div>
    </div>
  )
}
