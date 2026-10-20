import { useState, useEffect } from 'react'

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
  list: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
}

export function FabIcon({ name }) {
  return (
    <svg className="fab-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

function useCollapsedOnScroll() {
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setCollapsed(window.scrollY > COLLAPSE_AFTER_PX)
    }
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) window.cancelAnimationFrame(frame)
    }
  }, [])

  return collapsed
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
 */
export default function FloatingActions({ actions }) {
  const collapsed = useCollapsedOnScroll()
  const visibleActions = actions.filter(Boolean)

  if (visibleActions.length === 0) return null

  return (
    <div className={`fab-stack${collapsed ? ' is-collapsed' : ''}`}>
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
    </div>
  )
}
