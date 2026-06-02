"use client";

import { useEffect, useState } from 'react'

type CookieConsentBannerProps = {
  enabled: boolean
}

export default function CookieConsentBanner({ enabled }: CookieConsentBannerProps) {
  const [isOpen, setIsOpen] = useState(enabled)

  useEffect(() => {
    setIsOpen(enabled)
  }, [enabled])

  if (!enabled || !isOpen) {
    return null
  }

  return (
    <section className="cookie-banner" role="status" aria-labelledby="cookie-banner-title" aria-live="polite">
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
          <button type="button" className="btn-primary" onClick={() => setIsOpen(false)}>
            Entendido
          </button>
        </div>
      </div>
    </section>
  )
}
