import { useEffect, useRef, useState } from 'react'
import { deleteQuiz } from '../lib/api'
import { getOwnerToken } from '../lib/ownerToken'
import { createPendingDeletion } from './pendingDeletion'

export default function usePendingDeletion() {
  const [toast, setToast] = useState(null)
  const controller = useRef(null)
  if (!controller.current) {
    controller.current = createPendingDeletion({
      onChange: setToast,
      remove: (id) => deleteQuiz(id, getOwnerToken()),
      removeOnLeave: async (id) => {
        const response = await fetch(`/api/quizzes/${id}`, {
          method: 'DELETE', keepalive: true,
          headers: { 'x-owner-token': getOwnerToken() }
        })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
      }
    })
  }
  useEffect(() => {
    const current = controller.current
    const leave = () => { current.leave() }
    window.addEventListener('pagehide', leave)
    return () => {
      window.removeEventListener('pagehide', leave)
      current.leave()
    }
  }, [])
  return { toast, ...controller.current }
}
