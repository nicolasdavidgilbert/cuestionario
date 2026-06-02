"use client";

import { useEffect } from 'react'
import { canServeAdsOnPage, loadAdSenseScript } from '../lib/ads'

type AdSenseManagerProps = {
  clientId: string
  enabledByEnv: boolean
}

export default function AdSenseManager({ clientId, enabledByEnv }: AdSenseManagerProps) {
  useEffect(() => {
    if (!enabledByEnv || !clientId || typeof window === 'undefined') {
      return
    }

    if (!canServeAdsOnPage(window.location.pathname, enabledByEnv, clientId)) {
      return
    }

    // Google CMP / Privacy & messaging gestiona el consentimiento de anuncios en EEE, UK y Suiza.
    // Esta app solo decide si el script puede cargarse en una página apta para anuncios.
    void loadAdSenseScript(clientId)
  }, [clientId, enabledByEnv])

  return null
}
