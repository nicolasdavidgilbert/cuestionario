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
  /** 'feed': fila con el mismo aspecto que las tarjetas del listado (anuncio in-feed). */
  variant?: 'block' | 'feed'
  /** Clave de diseño del bloque in-feed creado en AdSense (data-ad-layout-key). */
  layoutKey?: string
}

export default function AdSenseAd({
  slot,
  format = 'auto',
  className,
  responsive = true,
  clientId,
  enabledByEnv,
  variant = 'block',
  layoutKey,
}: AdSenseAdProps) {
  const [canRender, setCanRender] = useState(false)
  const [isFilled, setIsFilled] = useState(false)
  const hasPushedRef = useRef(false)
  const insRef = useRef<HTMLModElement>(null)

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

  // El hueco solo se muestra si AdSense ha servido un anuncio y este ocupa espacio real.
  // data-ad-status="filled" no basta: AdSense a veces lo marca y luego oculta el <ins>.
  useEffect(() => {
    const ins = insRef.current
    if (!canRender || !ins) return

    const update = () => {
      setIsFilled(ins.dataset.adStatus === 'filled' && ins.getBoundingClientRect().height > 0)
    }

    const mutationObserver = new MutationObserver(update)
    mutationObserver.observe(ins, { attributes: true, attributeFilter: ['data-ad-status', 'style'], childList: true, subtree: true })
    const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    resizeObserver?.observe(ins)
    update()

    return () => {
      mutationObserver.disconnect()
      resizeObserver?.disconnect()
    }
  }, [canRender, variant])

  if (!canRender || !clientId) {
    return null
  }

  if (variant === 'feed') {
    // Sin bloque in-feed configurado se usa un anuncio horizontal adaptable dentro de la misma fila.
    const formatProps = layoutKey
      ? { 'data-ad-format': 'fluid', 'data-ad-layout-key': layoutKey }
      : { 'data-ad-format': 'horizontal', 'data-full-width-responsive': 'true' }

    return (
      <aside className={`feed-ad ${className ?? ''}${isFilled ? ' is-filled' : ''}`.trim()} aria-label="Publicidad" aria-hidden={!isFilled}>
        <span className="feed-ad__label" aria-hidden="true">Publicidad</span>
        <ins
          ref={insRef}
          className="adsbygoogle feed-ad__unit"
          style={{ display: 'block' }}
          data-ad-client={clientId}
          data-ad-slot={slot}
          {...formatProps}
        />
      </aside>
    )
  }

  // El contenedor reserva el hueco (evita saltos de diseño) y se oculta si AdSense no sirve anuncio.
  return (
    <aside className={`ad-slot-wrap ${className ?? ''}${isFilled ? ' is-filled' : ''}`.trim()} aria-label="Publicidad" aria-hidden={!isFilled}>
      <span className="ad-slot-label" aria-hidden="true">Publicidad</span>
      <ins
        ref={insRef}
        className="adsbygoogle ad-slot-unit"
        style={{ display: 'block' }}
        data-ad-client={clientId}
        data-ad-slot={slot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </aside>
  )
}
