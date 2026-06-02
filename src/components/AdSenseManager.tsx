"use client";

import { useEffect } from 'react'
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

type AdSenseManagerProps = {
  clientId: string
  enabledByEnv: boolean
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

export default function AdSenseManager({ clientId, enabledByEnv }: AdSenseManagerProps) {
  useEffect(() => {
    if (!enabledByEnv || !clientId) {
      return
    }

    const sync = () => {
      const consent = readCookieConsent()
      if (!canShowAdsFromConsent(consent)) {
        return
      }

      void loadAdSenseScript(clientId)
    }

    sync()
    window.addEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync)

    return () => {
      window.removeEventListener(COOKIE_CONSENT_CHANGE_EVENT, sync)
    }
  }, [clientId, enabledByEnv])

  return null
}
