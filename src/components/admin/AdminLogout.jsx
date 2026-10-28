import { useState } from 'react'
import { adminApi } from '../../lib/adminApi'

export default function AdminLogout() {
  const [pending, setPending] = useState(false)

  // `all` cierra también las sesiones de otros dispositivos (p. ej. tras cambiar la contraseña).
  const logout = async (all) => {
    if (all && !window.confirm('¿Cerrar la sesión en todos los dispositivos, incluido este?')) return
    setPending(true)
    try {
      await adminApi.post('/logout', all ? { all: true } : {})
    } finally {
      window.location.assign('/admin/login')
    }
  }

  return (
    <>
      <button type="button" className="btn-link" onClick={() => logout(false)} disabled={pending}>
        {pending ? 'Cerrando sesión…' : 'Cerrar sesión'}
      </button>
      <button type="button" className="btn-link" onClick={() => logout(true)} disabled={pending}>
        Cerrar todas las sesiones
      </button>
    </>
  )
}
