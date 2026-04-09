import { useState, useEffect, useRef } from 'react'
import { createQuiz, getAllQuizzes } from '../lib/api'
import { validateQuizJson, getPreviewMessage } from '../lib/quizValidator'

export default function CreateQuiz() {
  const [existingQuizzes, setExistingQuizzes] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [inputMode, setInputMode] = useState('paste')
  const [jsonText, setJsonText] = useState('')
  const [preview, setPreview] = useState(null)
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
      setPreview(null)
      return
    }

    try {
      const json = JSON.parse(jsonString)
      const validation = validateQuizJson(json)
      
      if (!validation.valid) {
        setError(validation.errors.map(e => e.message).join('\n'))
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
    } catch (e) {
      setError('JSON inválido: ' + e.message)
      setPreview(null)
    }
  }

  const handleFile = async (file) => {
    if (!file.name.endsWith('.json')) {
      setError('Solo se permiten archivos .json')
      return
    }

    try {
      const text = await file.text()
      parseJson(text, file.name)
    } catch (e) {
      setError('Error al leer el archivo: ' + e.message)
      setPreview(null)
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
      setInputMode('file')
      handleFile(files[0])
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!preview) {
      setError(inputMode === 'paste' 
        ? 'Primero pega un JSON válido' 
        : 'Primero sube un archivo JSON válido')
      return
    }
    
    if (!quiz.grado) {
      setError('Selecciona o escribe un grado')
      return
    }
    if (!quiz.course_id) {
      setError('Selecciona o escribe un curso')
      return
    }

    setLoading(true)
    setError('')

    try {
      await createQuiz({
        title: quiz.title.trim(),
        description: quiz.description.trim(),
        grado: quiz.grado.trim().toLowerCase(),
        course_id: quiz.course_id.trim().toLowerCase(),
        unidad: quiz.unidad.trim().toLowerCase(),
        questions: preview.questions
      })
      
      window.location.href = `/${quiz.grado.trim().toLowerCase()}`
    } catch (err) {
      setError('Error al guardar: ' + err.message)
      setLoading(false)
    }
  }

  const clearAll = () => {
    setPreview(null)
    setJsonText('')
    setQuiz({ title: '', description: '', grado: '', course_id: '', unidad: '' })
    setError('')
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
        <p>Sube un archivo JSON o pega el contenido</p>
      </header>

      <form onSubmit={handleSubmit} className="create-quiz-form">
        <div className="input-mode-tabs">
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
        ) : (
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

            <button type="button" onClick={clearAll} className="btn-clear">
              Limpiar y empezar de nuevo
            </button>
          </>
        )}

        {error && <div className="error-msg error-box">{error}</div>}

        <button type="submit" disabled={loading || !preview} className="btn-submit">
          {loading ? 'Guardando...' : 'Guardar Cuestionario'}
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
      </div>
    </div>
  )
}