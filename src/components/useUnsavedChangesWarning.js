import { useEffect } from 'react'

// Pide confirmación al navegador si el usuario intenta salir (enlace, recarga, cerrar pestaña)
// mientras hay cambios sin guardar.
export default function useUnsavedChangesWarning(active) {
  useEffect(() => {
    if (!active) return

    const onBeforeUnload = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [active])
}
