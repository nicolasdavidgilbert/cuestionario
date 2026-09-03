"use client";

import { useEffect, useState } from 'react'

type CookieConsentBannerProps = {
  enabled: boolean
}

const AD_NOTICE_STORAGE_KEY = 'cuestionario.ads-notice-dismissed.v1'

function hasDismissedNotice() {
  if (typeof window === 'undefined') {
    return false
  }

  try {
    return window.localStorage.getItem(AD_NOTICE_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

function markNoticeDismissed() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(AD_NOTICE_STORAGE_KEY, 'true')
  } catch {
    // Si el navegador bloquea localStorage, el banner seguirá siendo descartable en esta sesión.
  }
}

export default function CookieConsentBanner({ enabled }: CookieConsentBannerProps) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    setIsOpen(enabled && !hasDismissedNotice())
  }, [enabled])

  if (!enabled || !isOpen) {
    return null
  }

  const dismiss = () => {
    markNoticeDismissed()
    setIsOpen(false)
  }

  return (
    <section className="cookie-banner" role="dialog" aria-modal="false" aria-labelledby="cookie-banner-title">
      <div className="cookie-banner__panel">
        <div className="cookie-banner__copy">
          <p className="cookie-banner__eyebrow">Publicidad y cookies</p>
          <h2 id="cookie-banner-title">Privacidad y anuncios</h2>
          <p>
            Este sitio usa Google AdSense. Cuando la normativa lo exige, Google muestra sus opciones de
            consentimiento mediante una plataforma certificada. Este aviso es informativo y no sustituye esas
            opciones.
          </p>
        </div>

        <div className="cookie-banner__actions">
          <a className="btn-secondary" href="/privacy-policy">
            Política de privacidad
          </a>
          <button type="button" className="btn-primary" onClick={dismiss}>
            Cerrar aviso
          </button>
        </div>
      </div>
    </section>
  )
}
