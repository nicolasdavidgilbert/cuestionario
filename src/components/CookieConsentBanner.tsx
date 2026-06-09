"use client";

import { useEffect, useState } from 'react'

type CookieConsentBannerProps = {
  enabled: boolean
}

const AD_BANNER_STORAGE_KEY = 'cuestionario.ads-banner-accepted.v1'

function hasAcceptedBanner() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(AD_BANNER_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markBannerAccepted() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(AD_BANNER_STORAGE_KEY, 'true')
  } catch {
    // Si el navegador bloquea localStorage, el banner seguirá siendo descartable en esta sesión.
  }
}

export default function CookieConsentBanner({ enabled }: CookieConsentBannerProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(enabled && !hasAcceptedBanner())
  }, [enabled])

  if (!enabled || !isOpen) {
    return null
  }

  const accept = () => {
    markBannerAccepted()
    setIsOpen(false)
  }

  return (
    <section className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-banner-title">
      <div className="cookie-banner__panel">
        <div className="cookie-banner__copy">
          <p className="cookie-banner__eyebrow">Publicidad y cookies</p>
          <h2 id="cookie-banner-title">Aviso sobre anuncios</h2>
          <p>
            Este sitio usa Google AdSense. El consentimiento publicitario lo gestiona Google/CMP cuando
            corresponde. No usamos este aviso para analítica ni para recoger información personal adicional.
          </p>
        </div>

        <div className="cookie-banner__actions">
          <button type="button" className="btn-primary" onClick={accept}>
            Entendido
          </button>
        </div>
      </div>
    </section>
  )
}
