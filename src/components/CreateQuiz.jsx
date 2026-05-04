import { useState, useEffect, useRef } from 'react'
import { createQuiz, generateQuizFromPdf, getAllQuizzes } from '../lib/api'
import { validateQuizJson, getPreviewMessage } from '../lib/quizValidator'
import { getOwnerToken } from '../lib/ownerToken'

export default function CreateQuiz() {
  const [existingQuizzes, setExistingQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState([])
  const [inputMode, setInputMode] = useState('pdf')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState(null)
  const [selectedPdfName, setSelectedPdfName] = useState('')
  const fileInputRef = useRef(null)

  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    grado: '',
    course_id: '',
    unidad: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const quizzes = await getAllQuizzes()
      setExistingQuizzes(quizzes)
    } catch (e) {
      setError('Error cargando datos')
    }
  }

  const getUniqueValues = (field) => {
    const values = existingQuizzes
      .map(q => q[field])
      .filter(Boolean)

    return [...new Set(values)]
  }

  const parseJson = (jsonString, source = 'texto pegado') => {
    if (!jsonString.trim()) {
      setError('El campo está vacío')
      setValidationErrors([])
      setPreview(null)
      return
    }

    try {
      const json = JSON.parse(jsonString)
      const validation = validateQuizJson(json)

      if (!validation.valid) {
        setError(validation.errors.map(e => e.message).join('\n'))
        setValidationErrors(validation.errors)
        setPreview(null)
        return
      }

      setPreview({
        ...validation.data,
        source
      })
      setQuiz({
        title: validation.data.title || '',
        description: validation.data.description || '',
        grado: validation.data.grado || quiz.grado,
        course_id: validation.data.course_id || quiz.course_id,
        unidad: validation.data.unidad || quiz.unidad
      })
      setError('')
      setValidationErrors([])
    } catch (e) {
      setError('JSON inválido: ' + e.message)
      setValidationErrors([])
      setPreview(null)
    }
  }

  const handleFile = async (file) => {
    if (!file.name.endsWith('.json')) {
      setError('Solo se permiten archivos .json')
      setValidationErrors([])
      return
    }

    try {
      const text = await file.text()
      parseJson(text, file.name)
    } catch (e) {
      setError('Error al leer el archivo: ' + e.message)
      setValidationErrors([])
      setPreview(null)
    }
  }

  const handlePdfFile = async (file) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Solo se permiten archivos PDF en este modo')
      setValidationErrors([])
      setPreview(null)
      return
    }

    if (!quiz.grado.trim() || !quiz.course_id.trim()) {
      setError('Antes de subir el PDF, rellena grado y curso para generar el cuestionario con esos datos')
      setValidationErrors([{ field: 'grado', message: 'Rellena grado y curso antes de subir el PDF' }])
      return
    }

    try {
      setGenerating(true)
      setSelectedPdfName(file.name)
      setError('')
      setValidationErrors([])
      setPreview(null)

      const formData = new FormData()
      formData.set('file', file)
      formData.set('grado', quiz.grado.trim())
      formData.set('course_id', quiz.course_id.trim())
      formData.set('unidad', quiz.unidad.trim())

      const generated = await generateQuizFromPdf(formData)
      setPreview(generated)
      setQuiz({
        title: generated.title || '',
        description: generated.description || '',
        grado: generated.grado || quiz.grado,
        course_id: generated.course_id || quiz.course_id,
        unidad: generated.unidad || quiz.unidad
      })
    } catch (e) {
      setError('No se pudo generar el cuestionario: ' + e.message)
      setValidationErrors([])
      setPreview(null)
    } finally {
      setGenerating(false)
    }
  }

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()

    const files = e.dataTransfer?.files
    if (files && files[0]) {
      const droppedFile = files[0]
      const nextMode = droppedFile.name.toLowerCase().endsWith('.json') ? 'file' : 'pdf'
      setInputMode(nextMode)
      if (nextMode === 'file') {
        handleFile(droppedFile)
      } else {
        handlePdfFile(droppedFile)
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!preview) {
      setError(
        inputMode === 'paste'
          ? 'Primero pega un JSON válido'
          : inputMode === 'file'
            ? 'Primero sube un archivo JSON válido'
            : 'Primero sube un PDF válido'
      )
      setValidationErrors([])
      return
    }

    if (!quiz.grado) {
      setError('Selecciona o escribe un grado')
      setValidationErrors([{ field: 'grado', message: 'Selecciona o escribe un grado' }])
      return
    }
    if (!quiz.course_id) {
      setError('Selecciona o escribe un curso')
      setValidationErrors([{ field: 'course_id', message: 'Selecciona o escribe un curso' }])
      return
    }

    const validation = validateQuizJson({
      ...preview,
      title: quiz.title.trim(),
      description: quiz.description.trim(),
      grado: quiz.grado.trim().toLowerCase(),
      course_id: quiz.course_id.trim().toLowerCase(),
      unidad: quiz.unidad.trim().toLowerCase()
    })

    if (!validation.valid) {
      setError(validation.errors.map(e => e.message).join('\n'))
      setValidationErrors(validation.errors)
      return
    }

    setLoading(true)
    setError('')
    setValidationErrors([])

    try {
      await createQuiz({
        title: quiz.title.trim(),
        description: quiz.description.trim(),
        grado: quiz.grado.trim().toLowerCase(),
        course_id: quiz.course_id.trim().toLowerCase(),
        unidad: quiz.unidad.trim().toLowerCase(),
        questions: preview.questions
      }, getOwnerToken())

      window.location.href = `/${quiz.grado.trim().toLowerCase()}`
    } catch (err) {
      setError('Error al guardar: ' + err.message)
      setValidationErrors([])
      setLoading(false)
    }
  }

  const clearAll = () => {
    setPreview(null)
    setJsonText('')
    setSelectedPdfName('')
    setQuiz({ title: '', description: '', grado: '', course_id: '', unidad: '' })
    setError('')
    setValidationErrors([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (loading) {
    return (
      <div className="page-wrap">
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  const grados = getUniqueValues('grado')
  const cursos = getUniqueValues('course_id')
  const unidades = getUniqueValues('unidad')

  return (
    <div className="page-wrap">
      <a href="/" className="quiz-back">← Volver</a>

      <header className="home-header">
        <h1>Crear Cuestionario</h1>
        <p>Sube un PDF y el sistema generará el JSON del cuestionario por ti.</p>
        <p>También puedes seguir pegando un JSON ya hecho o subirlo directamente si quieres.</p>
      </header>

      <form onSubmit={handleSubmit} className="create-quiz-form">
        <div className="input-mode-tabs">
          <button
            type="button"
            className={`tab-btn ${inputMode === 'pdf' ? 'active' : ''}`}
            onClick={() => setInputMode('pdf')}
          >
            Subir PDF
          </button>
          <button
            type="button"
            className={`tab-btn ${inputMode === 'paste' ? 'active' : ''}`}
            onClick={() => setInputMode('paste')}
          >
            Pegar JSON
          </button>
          <button
            type="button"
            className={`tab-btn ${inputMode === 'file' ? 'active' : ''}`}
            onClick={() => setInputMode('file')}
          >
            Subir archivo
          </button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Grado * (escribe o selecciona)</label>
            <input
              list="grados-list"
              value={quiz.grado}
              onChange={(e) => setQuiz({ ...quiz, grado: e.target.value, course_id: '', unidad: '' })}
              placeholder="ej: 1asir, 2dam, 1bach"
            />
            <datalist id="grados-list">
              {grados.map(g => (
                <option key={g} value={g} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label>Curso * (escribe o selecciona)</label>
            <input
              list="cursos-list"
              value={quiz.course_id}
              onChange={(e) => setQuiz({ ...quiz, course_id: e.target.value, unidad: '' })}
              placeholder="ej: pni, digitalizacion, gtb"
              disabled={!quiz.grado}
            />
            <datalist id="cursos-list">
              {cursos.map(c => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="form-group">
          <label>Unidad (escribe o selecciona, opcional)</label>
          <input
            list="unidades-list"
            value={quiz.unidad}
            onChange={(e) => setQuiz({ ...quiz, unidad: e.target.value })}
            placeholder="ej: ud1, ud2, tema1"
            disabled={!quiz.grado || !quiz.course_id}
          />
          <datalist id="unidades-list">
            {unidades.map(u => (
              <option key={u} value={u} />
            ))}
          </datalist>
        </div>

        {inputMode === 'paste' ? (
          <div className="json-paste-area">
            <textarea
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder={`Pega aquí el JSON generado por la IA...\n\nEjemplo:\n{\n  "title": "Mi Cuestionario",\n  "grado": "1asir",\n  "course_id": "pni",\n  "questions": [...]\n}`}
              rows={12}
              className="json-textarea"
            />
            <button
              type="button"
              onClick={() => parseJson(jsonText)}
              className="btn-validate"
            >
              Validar JSON
            </button>
          </div>
        ) : inputMode === 'file' ? (
          <div
            className={`dropzone ${preview ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
              style={{ display: 'none' }}
            />

            {preview ? (
              <div className="dropzone-preview">
                <div className="dropzone-icon">✓</div>
                <p className="dropzone-filename">{preview.source}</p>
                <p className="dropzone-info">{getPreviewMessage(preview)}</p>
              </div>
            ) : (
              <div className="dropzone-empty">
                <div className="dropzone-icon">📄</div>
                <p className="dropzone-text">
                  Arrastra tu archivo JSON aquí o <span className="dropzone-link">haz clic para seleccionar</span>
                </p>
                <p className="dropzone-hint">
                  Formato: {`{ grado, course_id, questions: [...] }`}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            className={`dropzone ${preview ? 'has-file' : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            onClick={() => !generating && fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => e.target.files[0] && handlePdfFile(e.target.files[0])}
              style={{ display: 'none' }}
            />

            {generating ? (
              <div className="dropzone-preview">
                <div className="spinner"></div>
                <p className="dropzone-filename">Procesando {selectedPdfName || 'PDF'}...</p>
                <p className="dropzone-info">Extrayendo texto y generando preguntas con IA</p>
              </div>
            ) : preview ? (
              <div className="dropzone-preview">
                <div className="dropzone-icon">✓</div>
                <p className="dropzone-filename">{preview.source}</p>
                <p className="dropzone-info">{getPreviewMessage(preview)}</p>
              </div>
            ) : (
              <div className="dropzone-empty">
                <div className="dropzone-icon">📕</div>
                <p className="dropzone-text">
                  Arrastra tu PDF aquí o <span className="dropzone-link">haz clic para seleccionar</span>
                </p>
                <p className="dropzone-hint">
                  El servidor extrae el texto, llama a la IA y te devuelve el JSON listo para guardar
                </p>
              </div>
            )}
          </div>
        )}

        {preview && (
          <>
            <div className="form-group">
              <label>Título (puedes editarlo)</label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                placeholder="Título del cuestionario"
                maxLength={100}
              />
            </div>

            <details className="questions-preview">
              <summary>Ver preguntas ({preview.questions.length})</summary>
              <div className="questions-list">
                {preview.questions.map((q, i) => (
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

            <button type="button" onClick={clearAll} className="btn-clear">
              Limpiar y empezar de nuevo
            </button>
          </>
        )}

        {validationErrors.length > 0 && (
          <div className="error-msg error-box">
            <strong>Revisa estos campos:</strong>
            <ul>
              {validationErrors.map((validationError, index) => (
                <li key={`${validationError.field}-${index}`}>
                  <code>{validationError.field}</code>: {validationError.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && validationErrors.length === 0 && <div className="error-msg error-box">{error}</div>}

        <button type="submit" disabled={loading || generating || !preview} className="btn-submit">
          {loading ? 'Guardando...' : generating ? 'Generando...' : 'Guardar Cuestionario'}
        </button>
      </form>

      <div className="json-format-help">
        <h3>Formato del JSON</h3>
        <pre>{`{
  "title": "Mi Cuestionario",
  "description": "Descripción opcional",
  "grado": "1asir",
  "course_id": "pni",
  "unidad": "ud1",
  "questions": [
    {
      "question": "¿Cuál es la pregunta?",
      "options": ["A", "B", "C", "D"],
      "answer": 0,
      "explanation": "Explicación"
    }
  ]
}`}</pre>
        <p className="help-note">
          <strong>Nota:</strong> <code>answer</code> es el índice de la respuesta correcta (0-3). El campo <code>unidad</code> es opcional.
        </p>
        <p className="help-note">
          <strong>Modo PDF:</strong> necesitas configurar <code>GROQ_API_KEY</code> en el servidor. Este MVP funciona mejor con PDFs que ya contienen texto, no con escaneos.
        </p>
      </div>
    </div>
  )
}
