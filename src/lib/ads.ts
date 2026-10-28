export function normalizePathname(pathname: string) {
  if (!pathname) {
    return '/'
  }

  const normalized = pathname.trim().replace(/\/+$/, '')
  return normalized === '' ? '/' : normalized
}

const SENSITIVE_AD_PATHS = new Set([
  '/crear',
  '/mis-cuestionarios',
])

const QUIZ_RUN_PATH = /^\/[^/]+\/[^/]+\/[^/]+\/?$/

export function isSensitiveAdPage(pathname: string) {
  const normalized = normalizePathname(pathname)

  if (normalized === '/' || normalized.startsWith('/api/')) {
    return false
  }

  if (SENSITIVE_AD_PATHS.has(normalized)) {
    return true
  }

  // Panel de administración y pantallas de uso (resolver o editar un cuestionario propio): sin anuncios.
  if (normalized === '/admin' || normalized.startsWith('/admin/')
    || normalized.startsWith('/user-quiz/') || normalized.startsWith('/editar/')) {
    return true
  }

  return QUIZ_RUN_PATH.test(normalized)
}

export function canServeAdsOnPage(pathname: string, enabledByEnv: boolean, clientId?: string) {
  return enabledByEnv && Boolean(clientId?.trim()) && !isSensitiveAdPage(pathname)
}

declare global {
  interface Window {
    adsbygoogle?: unknown[]
    __adsenseScriptPromise?: Promise<void>
  }
}

const ANCHOR_SELECTOR = 'ins.adsbygoogle[data-anchor-status]'

/**
 * Los anuncios ancla de AdSense (auto ads) se fijan arriba o abajo de la pantalla.
 * Publica su altura en --ad-anchor-top / --ad-anchor-bottom para que la barra de búsqueda
 * fija, el banner de cookies y los botones flotantes se aparten en vez de quedar tapados.
 */
export function watchAnchorAds() {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {}
  }

  const root = document.documentElement
  let frame = 0

  const measure = () => {
    frame = 0
    let top = 0
    let bottom = 0

    document.querySelectorAll<HTMLElement>(ANCHOR_SELECTOR).forEach((anchor) => {
      if (anchor.dataset.anchorStatus !== 'displayed') return
      const rect = anchor.getBoundingClientRect()
      if (rect.height === 0 || getComputedStyle(anchor).display === 'none') return

      if (rect.top < window.innerHeight / 2) {
        top = Math.max(top, Math.max(0, rect.bottom))
      } else {
        bottom = Math.max(bottom, Math.max(0, window.innerHeight - rect.top))
      }
    })

    root.style.setProperty('--ad-anchor-top', `${Math.round(top)}px`)
    root.style.setProperty('--ad-anchor-bottom', `${Math.round(bottom)}px`)
  }

  const schedule = () => {
    if (!frame) frame = window.requestAnimationFrame(measure)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-anchor-status', 'style', 'class'],
  })
  window.addEventListener('resize', schedule)
  schedule()

  return () => {
    observer.disconnect()
    window.removeEventListener('resize', schedule)
    if (frame) window.cancelAnimationFrame(frame)
    root.style.removeProperty('--ad-anchor-top')
    root.style.removeProperty('--ad-anchor-bottom')
  }
}

export function loadAdSenseScript(clientId: string) {
  if (typeof document === 'undefined') {
    return Promise.resolve()
  }

  const existing = document.getElementById('adsense-script') as HTMLScriptElement | null
  if (existing) {
    if (!window.__adsenseScriptPromise) {
      window.__adsenseScriptPromise = Promise.resolve()
    }

    return window.__adsenseScriptPromise
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
