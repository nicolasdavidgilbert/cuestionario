import { useState, useEffect, useRef } from 'react'

const COLLAPSE_AFTER_PX = 80

const ICONS = {
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none" />,
  pencil: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  retry: (
    <>
      <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3" />
      <path d="M4.5 4.5v4h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  save: (
    <>
      <path d="M5 4h11l3 3v13H5z" />
      <path d="M8 4v5h7V4M8 20v-6h8v6" />
    </>
  ),
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  next: <path d="M12 5v14M6 13l6 6 6-6" />
}

export function FabIcon({ name }) {
  return (
    <svg className="fab-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

const COLLAPSE_SCROLL_PX = 120
const EXPAND_SCROLL_PX = 12

// Al bajar se queda en icono; al subir un poco (o al volver arriba) recupera el texto.
function useCollapsedOnScroll(hidden) {
  const [collapsed, setCollapsed] = useState(false)
  const lastY = useRef(0)
  const travel = useRef(0)

  useEffect(() => {
    // Cada vez que el botón vuelve a aparecer entra con el texto visible.
    travel.current = 0
    lastY.current = window.scrollY
    setCollapsed(false)
  }, [hidden])

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const delta = y - lastY.current
      lastY.current = y

      if (y <= COLLAPSE_AFTER_PX) {
        travel.current = 0
        setCollapsed(false)
        return
      }

      travel.current = Math.sign(delta) === Math.sign(travel.current) ? travel.current + delta : delta
      if (travel.current > COLLAPSE_SCROLL_PX) setCollapsed(true)
      if (travel.current < -EXPAND_SCROLL_PX) setCollapsed(false)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    lastY.current = window.scrollY
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return collapsed
}

// Oculta los flotantes mientras su botón equivalente de la página está a la vista.
function useAnchorsVisible(anchorRefs) {
  const [visible, setVisible] = useState(anchorRefs.length > 0)

  useEffect(() => {
    const elements = anchorRefs.map((ref) => ref.current).filter(Boolean)
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') {
      setVisible(false)
      return
    }

    const state = new Map()
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => state.set(entry.target, entry.isIntersecting))
      setVisible([...state.values()].some(Boolean))
    })
    elements.forEach((element) => observer.observe(element))
    return () => observer.disconnect()
  }, [])

  return visible
}

export function scrollToQuestion(index) {
  const card = document.getElementById(`question-${index}`)
  if (!card) return
  card.scrollIntoView({ behavior: 'smooth', block: 'center' })
  card.querySelector('input')?.focus({ preventScroll: true })
}

export function SubmitNotice({ missing, onGoToNext, onSubmit, onClose }) {
  return (
    <div className="fab-confirm" role="alert">
      <p>
        Te falta{missing === 1 ? '' : 'n'} <strong>{missing}</strong> pregunta{missing === 1 ? '' : 's'} sin responder.
      </p>
      <div className="fab-confirm__actions">
        <button type="button" className="btn-secondary" onClick={onGoToNext}>Ir a la siguiente</button>
        <button type="button" className="btn-primary" onClick={onSubmit}>Enviar igualmente</button>
      </div>
      <button type="button" className="fab-confirm__close" onClick={onClose} aria-label="Cerrar aviso">×</button>
    </div>
  )
}

function FabLabel({ text }) {
  // Cada letra se anima por separado para que el texto "se deshaga" en el icono.
  return (
    <span className="fab-label" aria-hidden="true">
      {Array.from(text).map((char, index) => (
        <span key={index} className="fab-char" style={{ '--i': index, '--n': text.length }}>
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </span>
  )
}

/**
 * Botones flotantes abajo a la derecha. Arriba de la página muestran el texto;
 * al hacer scroll se transforman en su icono para no tapar el contenido.
 *
 * actions: [{ label, icon, onClick?, href?, form?, variant?: 'primary' | 'secondary', disabled?, badge? }]
 * anchorRefs: refs a los botones normales equivalentes; mientras alguno se ve, los flotantes se ocultan.
 * notice: contenido que se muestra encima de los botones (p. ej. el aviso de envío incompleto).
 */
export default function FloatingActions({ actions, anchorRefs = [], notice = null }) {
  const hidden = useAnchorsVisible(anchorRefs)
  const collapsed = useCollapsedOnScroll(hidden)
  const visibleActions = actions.filter(Boolean)

  if (visibleActions.length === 0 && !notice) return null

  return (
    <div className={`fab-stack${collapsed ? ' is-collapsed' : ''}${hidden ? ' is-hidden' : ''}`}>
      {visibleActions.map((action, index) => {
        const className = `fab fab--${action.variant || 'primary'}`
        const content = (
          <>
            <span className="fab-icon-wrap"><FabIcon name={action.icon} /></span>
            <FabLabel text={action.label} />
            {action.badge && <span className="fab-badge" aria-hidden="true">{action.badge}</span>}
          </>
        )
        const accessibleLabel = action.badge ? `${action.label} (${action.badge})` : action.label

        if (action.href) {
          return (
            <a key={index} href={action.href} className={className} aria-label={accessibleLabel} title={action.label}>
              {content}
            </a>
          )
        }

        return (
          <button
            key={index}
            type={action.form ? 'submit' : 'button'}
            form={action.form}
            className={className}
            onClick={action.onClick}
            disabled={action.disabled}
            aria-label={accessibleLabel}
            title={action.label}
          >
            {content}
          </button>
        )
      })}
      {notice}
    </div>
  )
}
