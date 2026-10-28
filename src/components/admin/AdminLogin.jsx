import { useEffect, useRef, useState } from 'react'
import { AdminApiError, adminApi } from '../../lib/adminApi'
import { FieldError } from './ui'

// Solo se aceptan destinos dentro del panel y nunca la propia página de acceso.
function safeNext(value) {
  return typeof value === 'string' && /^\/admin(\/|$|\?)/.test(value) && !/^\/admin\/login(\/|$|\?)/.test(value) ? value : '/admin'
}

export default function AdminLogin({ next = '/admin', reason = '' }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  // Hasta hidratar, el botón queda desactivado para que el formulario no se envíe sin JavaScript.
  const [ready, setReady] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    setReady(true)
    inputRef.current?.focus()
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    if (!password) {
      setError('Escribe la contraseña')
      return
    }
    setPending(true)
    setError('')
    try {
      await adminApi.post('/login', { password })
      window.location.assign(safeNext(next))
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : 'No se pudo conectar. Inténtalo de nuevo.')
      setPending(false)
      setPassword('')
      inputRef.current?.focus()
    }
  }

  return (
    <form className="admin-login__card" method="post" onSubmit={submit} noValidate>
      <div>
        <p className="section-kicker">Cuestionarios</p>
        <h1>Administración</h1>
      </div>
      {reason === 'expired' && <p role="status">Tu sesión ha caducado. Vuelve a entrar para continuar.</p>}
      <div className="form-group">
        <label htmlFor="admin-password">Contraseña</label>
        <input ref={inputRef} id="admin-password" type="password" autoComplete="current-password" value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={error ? 'true' : undefined} aria-describedby={error ? 'admin-password-error' : undefined} />
        <FieldError id="admin-password-error" message={error} />
      </div>
      <button type="submit" className="btn-primary" disabled={pending || !ready}>{pending ? 'Entrando…' : 'Entrar'}</button>
      <p><a href="/">← Volver a la web</a></p>
    </form>
  )
}
