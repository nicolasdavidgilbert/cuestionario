"use client";

import { useEffect, useMemo, useState } from 'react'
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  COOKIE_CONSENT_OPEN_EVENT,
  defaultCookieConsent,
  readCookieConsent,
  type CookieConsent,
  writeCookieConsent,
} from '../lib/cookieConsent'

type CookieConsentBannerProps = {
  adsEnabledByEnv: boolean
}

function cloneConsent(consent: CookieConsent) {
  return {
    necessary: true,
    analytics: consent.analytics,
    ads: consent.ads,
  }
}

export default function CookieConsentBanner({ adsEnabledByEnv }: CookieConsentBannerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [draft, setDraft] = useState<CookieConsent>(defaultCookieConsent)

  const adsAllowed = useMemo(() => adsEnabledByEnv, [adsEnabledByEnv])

  useEffect(() => {
    const syncFromStorage = () => {
      const stored = readCookieConsent()
      if (stored) {
        setDraft(cloneConsent(stored))
        setIsOpen(false)
        return
      }

      setDraft(defaultCookieConsent)
      setIsOpen(true)
    }

    const openPanel = () => {
      const stored = readCookieConsent()
      setDraft(cloneConsent(stored ?? defaultCookieConsent))
      setIsOpen(true)
    }

    syncFromStorage()
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, syncFromStorage)
    window.addEventListener(COOKIE_CONSENT_OPEN_EVENT, openPanel)
    window.addEventListener('storage', syncFromStorage)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, syncFromStorage)
      window.removeEventListener(COOKIE_CONSENT_OPEN_EVENT, openPanel)
      window.removeEventListener('storage', syncFromStorage)
    }
  }, [])

  const acceptAll = () => {
    const next = { necessary: true, analytics: true, ads: adsAllowed }
    writeCookieConsent(next)
    setDraft(next)
    setIsOpen(false)
  }

  const rejectAll = () => {
    const next = { necessary: true, analytics: false, ads: false }
    writeCookieConsent(next)
    setDraft(next)
    setIsOpen(false)
  }

  const savePreferences = () => {
    const next = {
      necessary: true,
      analytics: draft.analytics,
      ads: adsAllowed ? draft.ads : false,
    }

    writeCookieConsent(next)
    setDraft(next)
    setIsOpen(false)
  }

  if (!isOpen) {
    return null
  }

  return (
    <section className="cookie-banner" role="dialog" aria-labelledby="cookie-banner-title" aria-live="polite">
      <div className="cookie-banner__panel">
        <div className="cookie-banner__copy">
          <p className="cookie-banner__eyebrow">Cookies y privacidad</p>
          <h2 id="cookie-banner-title">Gestiona el uso de cookies</h2>
          <p>
            Usamos cookies necesarias para que la app funcione. Si activas las no necesarias,
            podremos habilitar analítica y, cuando esté disponible, publicidad de Google AdSense.
          </p>
        </div>

        <div className="cookie-banner__preferences">
          <label className="cookie-toggle">
            <span>
              <strong>Necesarias</strong>
              <small>Imprescindibles para sesión, navegación y seguridad.</small>
            </span>
            <input type="checkbox" checked readOnly />
          </label>

          <label className="cookie-toggle">
            <span>
              <strong>Analítica</strong>
              <small>Nos ayuda a entender el uso de la app.</small>
            </span>
            <input
              type="checkbox"
              checked={draft.analytics}
              onChange={(e) => setDraft((prev) => ({ ...prev, analytics: e.target.checked }))}
            />
          </label>

          <label className="cookie-toggle">
            <span>
              <strong>Publicidad</strong>
              <small>Necesaria para mostrar anuncios de AdSense.</small>
            </span>
            <input
              type="checkbox"
              checked={draft.ads}
              disabled={!adsAllowed}
              onChange={(e) => setDraft((prev) => ({ ...prev, ads: e.target.checked }))}
            />
          </label>

          {!adsAllowed && (
            <p className="cookie-banner__note">
              La publicidad seguirá desactivada hasta que `NEXT_PUBLIC_ENABLE_ADS` y `NEXT_PUBLIC_ADSENSE_CLIENT`
              estén configuradas.
            </p>
          )}
        </div>

        <div className="cookie-banner__actions">
          <button type="button" className="btn-secondary" onClick={rejectAll}>
            Rechazar
          </button>
          <button type="button" className="btn-secondary" onClick={savePreferences}>
            Guardar
          </button>
          <button type="button" className="btn-primary" onClick={acceptAll}>
            Aceptar todo
          </button>
        </div>
      </div>
    </section>
  )
}
