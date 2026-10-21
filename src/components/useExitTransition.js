import { useEffect, useState } from 'react'
import { prefersReducedMotion } from '../lib/motion'

export default function useExitTransition(isOpen, ms = 200) {
  const [retained, setRetained] = useState(isOpen)
  useEffect(() => {
    if (isOpen) {
      setRetained(true)
      return
    }
    const timer = setTimeout(() => setRetained(false), prefersReducedMotion() ? 0 : ms)
    return () => clearTimeout(timer)
  }, [isOpen, ms])
  return { mounted: isOpen || retained, state: isOpen ? 'open' : 'closing' }
}
