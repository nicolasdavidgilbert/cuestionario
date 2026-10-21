import { useEffect, useRef, useState } from 'react'
import useExitTransition from './useExitTransition'

export default function UndoToast({ message, onUndo, onExpire = () => {} }) {
  const [open, setOpen] = useState(true)
  const { mounted, state } = useExitTransition(open)
  const done = useRef(false)
  const expire = useRef(onExpire)
  expire.current = onExpire
  useEffect(() => {
    const timer = setTimeout(() => {
      if (done.current) return
      done.current = true
      setOpen(false)
      expire.current?.()
    }, 6000)
    return () => clearTimeout(timer)
  }, [])
  if (!mounted) return null
  return (
    <div className="undo-toast" role="status" data-state={state}>
      <span className="undo-toast__text">{message}</span>
      <button type="button" className="undo-toast__action" disabled={!open} onClick={() => {
        if (done.current) return
        done.current = true
        setOpen(false)
        onUndo()
      }}>Deshacer</button>
    </div>
  )
}
