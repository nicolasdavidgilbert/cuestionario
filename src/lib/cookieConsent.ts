export type CookieConsent = {
  necessary: true
  analytics: boolean
  ads: boolean
}

export const COOKIE_CONSENT_STORAGE_KEY = 'cuestionario.cookie-consent.v1'
export const COOKIE_CONSENT_CHANGE_EVENT = 'cookie-consent:change'
export const COOKIE_CONSENT_OPEN_EVENT = 'cookie-consent:open'

export const defaultCookieConsent: CookieConsent = {
  necessary: true,
  analytics: false,
  ads: false,
}

export function normalizeCookieConsent(value: Partial<CookieConsent> | null | undefined): CookieConsent {
  return {
    necessary: true,
    analytics: Boolean(value?.analytics),
    ads: Boolean(value?.ads),
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

    return normalizeCookieConsent(JSON.parse(raw) as Partial<CookieConsent>)
  } catch {
    return null
  }
}

export function writeCookieConsent(consent: CookieConsent) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, JSON.stringify(normalizeCookieConsent(consent)))
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT))
}

export function clearCookieConsent() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(COOKIE_CONSENT_STORAGE_KEY)
  window.dispatchEvent(new Event(COOKIE_CONSENT_CHANGE_EVENT))
}

export function canShowAdsFromConsent(consent: CookieConsent | null) {
  return Boolean(consent?.ads)
}
