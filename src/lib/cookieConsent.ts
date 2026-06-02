export type CookieConsent = {
  necessary: true
  analytics: boolean
}

export const COOKIE_CONSENT_STORAGE_KEY = 'cuestionario.cookie-consent.v1'
export const COOKIE_CONSENT_CHANGE_EVENT = 'cookie-consent:change'
export const COOKIE_CONSENT_OPEN_EVENT = 'cookie-consent:open'

export const defaultCookieConsent: CookieConsent = {
  necessary: true,
  analytics: false,
}

function serializeCookieConsent(consent: CookieConsent) {
  return JSON.stringify(consent)
}

function normalizeCookieConsent(value: Partial<CookieConsent> | null | undefined): CookieConsent {
  return {
    necessary: true,
    analytics: Boolean(value?.analytics),
  }
}

export function readCookieConsent(): CookieConsent | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as Partial<CookieConsent> & { ads?: unknown }
    const consent = normalizeCookieConsent(parsed)

    // Migra silenciosamente el almacenamiento antiguo que aún incluya `ads`.
    if (raw !== serializeCookieConsent(consent) || Object.prototype.hasOwnProperty.call(parsed, 'ads')) {
      window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serializeCookieConsent(consent))
    }

    return consent
  } catch {
    window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
    return null
  }
}

export function writeCookieConsent(consent: CookieConsent) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, serializeCookieConsent(normalizeCookieConsent(consent)))
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT))
}

export function clearCookieConsent() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT))
}
