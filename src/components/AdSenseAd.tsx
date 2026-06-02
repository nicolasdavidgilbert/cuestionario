"use client";

import { useEffect, useRef, useState } from 'react'
import {
  COOKIE_CONSENT_CHANGE_EVENT,
  canShowAdsFromConsent,
  readCookieConsent,
} from '../lib/cookieConsent'

declare global {
  interface Window {
    adsbygoogle?: unknown[]
    __adsenseScriptPromise?: Promise<void>
  }
}

type AdSenseAdProps = {
  slot: string
  format?: string
  className?: string
  responsive?: boolean
  clientId?: string
}

function loadAdSenseScript(clientId: string) {
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  const existing = document.getElementById('adsense-script') as HTMLScriptElement | null
  if (existing) {
    return window.__adsenseScriptPromise ?? Promise.resolve()
  }

  if (window.__adsenseScriptPromise) {
    return window.__adsenseScriptPromise
  }

  window.__adsenseScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.id = 'adsense-script'
    script.async = true
    script.crossOrigin = 'anonymous'
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('No se pudo cargar el script de AdSense'))
    document.head.appendChild(script)
  })

  return window.__adsenseScriptPromise
}

export default function AdSenseAd({
  slot,
  format = 'auto',
  className,
  responsive = true,
  clientId,
}: AdSenseAdProps) {
  const [canRender, setCanRender] = useState(false)
  const hasPushedRef = useRef(false)

  useEffect(() => {
    if (!clientId) {
      setCanRender(false)
      return
    }

    const sync = () => {
      const consent = readCookieConsent()
      const allowed = canShowAdsFromConsent(consent)
      setCanRender(allowed)

      if (!allowed) {
        return
      }

      void loadAdSenseScript(clientId)
        .then(() => {
          if (hasPushedRef.current) {
            return
          }

          try {
            window.adsbygoogle = window.adsbygoogle || []
            window.adsbygoogle.push({})
            hasPushedRef.current = true
          } catch {
            // Evita romper el render si AdSense falla.
          }
        })
        .catch(() => {
          // El anuncio se oculta silenciosamente si el script no carga.
        })
    }

    sync()
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync)
    }
  }, [clientId, slot])

  if (!canRender || !clientId) {
    return null
  }

  return (
    <ins
      className={`adsbygoogle ${className ?? ''}`.trim()}
      style={{ display: 'block' }}
      data-ad-client={clientId}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  )
}
