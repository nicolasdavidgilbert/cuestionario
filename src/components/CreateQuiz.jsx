import { useState, useEffect, useRef } from 'react'
import { createQuiz } from '../lib/api'
import { validateQuizJson, getPreviewMessage } from '../lib/quizValidator'

export default function CreateQuiz() {
  const [catalog, setCatalog] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState(null)
  const fileInputRef = useRef(null)

  const [quiz, setQuiz] = useState({
    title: '',
    description: '',
    grado: '',
    course_id: ''
  })

  useEffect(() => {
    fetch('/catalog.json')
      .then((r) => r.json())
      .then(setCatalog)
      .catch(() => setError('Error cargando cursos'))
  }, [])

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    
    const files = e.dataTransfer?.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handleFileChange = (e) => {
    const files = e.target.files
    if (files && files[0]) {
      handleFile(files[0])
    }
  }

  const handleFile = async (file) => {
    if (!file.name.endsWith('.json')) {
      setError('Solo se permiten archivos .json')
      return
    }

    try {
      const text = await file.text()
      const json = JSON.parse(text)
      
      const validation = validateQuizJson(json)
      
      if (!validation.valid) {
        setError(validation.errors.map(e => e.message).join('\n'))
        setPreview(null)
        return
      }

      setPreview({
        ...validation.data,
        fileName: file.name
      })
      setQuiz({
        title: validation.data.title || '',
        description: validation.data.description || '',
        grado: validation.data.grado,
        course_id: validation.data.course_id
      })
      setError('')
    } catch (e) {
      setError('Error al leer el archivo JSON: ' + e.message)
      setPreview(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!preview) {
      setError('Primero sube un archivo JSON válido')
      return
    }
    
    if (!quiz.grado) {
      setError('Selecciona un grado')
      return
    }
    if (!quiz.course_id) {
      setError('Selecciona un curso')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createQuiz({
        title: quiz.title.trim(),
        description: quiz.description.trim(),
        grado: quiz.grado,
        course_id: quiz.course_id,
        questions: preview.questions
      })
      
      window.location.href = `/${quiz.grado}`
    } catch (err) {
      setError('Error al guardar: ' + err.message)
      setLoading(false)
    }
  }

  if (!catalog) {
    return (
      <div className="page-wrap">
        <div className="loading">Cargando...</div>
      </div>
    )
  }

  return (
    <div className="page-wrap">
      <a href="/" className="quiz-back">← Volver</a>

      <header className="home-header">
        <h1>Crear Cuestionario</h1>
        <p>Sube un archivo JSON con tu cuestionario</p>
      </header>

      <form onSubmit={handleSubmit} className="create-quiz-form">
        <div 
          className={`dropzone ${dragActive ? 'drag-active' : ''} ${preview ? 'has-file' : ''}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          
          {preview ? (
            <div className="dropzone-preview">
              <div className="dropzone-icon">✓</div>
              <p className="dropzone-filename">{preview.fileName}</p>
              <p className="dropzone-info">{getPreviewMessage(preview)}</p>
              <button 
                type="button" 
                className="btn-change-file"
                onClick={(e) => {
                  e.stopPropagation()
                  setPreview(null)
                  fileInputRef.current.value = ''
                }}
              >
                Cambiar archivo
              </button>
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

        {preview && (
          <>
            <div className="form-group">
              <label>Título (se toma del JSON, puedes editarlo)</label>
              <input
                type="text"
                value={quiz.title}
                onChange={(e) => setQuiz({ ...quiz, title: e.target.value })}
                placeholder="Título del cuestionario"
                maxLength={100}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Grado *</label>
                <select
                  value={quiz.grado}
                  onChange={(e) => setQuiz({ ...quiz, grado: e.target.value, course_id: '' })}
                >
                  <option value="">Selecciona grado...</option>
                  {catalog.grados.map((g) => (
                    <option key={g.id} value={g.id}>{g.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Curso *</label>
                <select
                  value={quiz.course_id}
                  onChange={(e) => setQuiz({ ...quiz, course_id: e.target.value })}
                  disabled={!quiz.grado}
                >
                  <option value="">Selecciona curso...</option>
                  {quiz.grado && catalog.grados.find((g) => g.id === quiz.grado)?.courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <details className="questions-preview">
              <summary>Ver preguntas ({preview.questions.length})</summary>
              <div className="questions-list">
                {preview.questions.map((q, i) => (
                  <div key={i} className="question-preview-item">
                    <span className="question-preview-num">{i + 1}.</span>
                    <span className="question-preview-text">{q.question}</span>
                  </div>
                ))}
              </div>
            </details>
          </>
        )}

        {error && <div className="error-msg error-box">{error}</div>}

        <button type="submit" disabled={loading || !preview} className="btn-submit">
          {loading ? 'Guardando...' : 'Guardar Cuestionario'}
        </button>
      </form>

      <div className="json-format-help">
        <h3>Formato del archivo JSON</h3>
        <pre>{`{
  "title": "Mi Cuestionario",
  "description": "Descripción opcional",
  "grado": "1asir",
  "course_id": "pni",
  "questions": [
    {
      "question": "¿Cuál es la pregunta?",
      "options": ["Opción A", "Opción B", "Opción C", "Opción D"],
      "answer": 0,
      "explanation": "Explicación de la respuesta"
    }
  ]
}`}</pre>
        <p className="help-note">
          <strong>Nota:</strong> El campo <code>answer</code> indica el índice de la respuesta correcta (0-3).
        </p>
      </div>
    </div>
  )
}
