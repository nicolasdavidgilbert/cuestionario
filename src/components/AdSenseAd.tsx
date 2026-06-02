"use client";

import { useEffect, useRef, useState } from 'react'
import { canServeAdsOnPage, loadAdSenseScript } from '../lib/ads'

type AdSenseAdProps = {
  slot: string
  format?: string
  className?: string
  responsive?: boolean
  clientId?: string
  enabledByEnv: boolean
}

export default function AdSenseAd({
  slot,
  format = 'auto',
  className,
  responsive = true,
  clientId,
  enabledByEnv,
}: AdSenseAdProps) {
  const [canRender, setCanRender] = useState(false)
  const hasPushedRef = useRef(false)

  useEffect(() => {
    if (!enabledByEnv || !clientId || typeof window === 'undefined') {
      setCanRender(false)
      return
    }

    // Google CMP / Privacy & messaging controla el consentimiento publicitario.
    // Este componente solo monta anuncios en rutas aptas y espera a que el bloque exista en el DOM.
    setCanRender(canServeAdsOnPage(window.location.pathname, enabledByEnv, clientId))
  }, [clientId, enabledByEnv, slot])

  useEffect(() => {
    if (!canRender || !clientId) {
      return
    }

    let cancelled = false

    void loadAdSenseScript(clientId)
      .then(() => {
        if (cancelled || hasPushedRef.current) {
          return
        }

        try {
          window.adsbygoogle = window.adsbygoogle || []
          window.adsbygoogle.push({})
          hasPushedRef.current = true
        } catch {
          // Si AdSense falla o está bloqueado, el resto de la página sigue funcionando.
        }
      })
      .catch(() => {
        // El anuncio se oculta silenciosamente si el script no carga.
      })

    return () => {
      cancelled = true
    }
  }, [clientId, canRender, slot])

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
