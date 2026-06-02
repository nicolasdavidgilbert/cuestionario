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

  if (normalized.startsWith('/user-quiz/')) {
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
