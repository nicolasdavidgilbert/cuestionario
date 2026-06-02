function getEnvValue(name: string): string {
  const value = import.meta.env[name]
  return typeof value === 'string' ? value.trim() : ''
}

export function getRequiredEnv(name: string): string {
  const value = getEnvValue(name)

  if (!value) {
    throw new Error(`Falta configurar ${name} en el servidor`)
  }

  return value
}

export function getOptionalEnv(name: string, fallback = ''): string {
  return getEnvValue(name) || fallback
}

export function getDatabaseUrl(): string {
  return getRequiredEnv('DATABASE_URL')
}

export function getGroqApiKey(): string {
  return getRequiredEnv('GROQ_API_KEY')
}

export function getGroqModel(): string {
  return getOptionalEnv('GROQ_MODEL', 'openai/gpt-oss-20b')
}

export function getAdminApiKey(): string {
  return getOptionalEnv('ADMIN_API_KEY')
}

export function getContactEmail(): string {
  return getOptionalEnv('NEXT_PUBLIC_CONTACT_EMAIL', 'contacto@cuestionario.online')
}

export function getAdsenseClient(): string {
  return getOptionalEnv('NEXT_PUBLIC_ADSENSE_CLIENT')
}

export function isAdsEnabledFromEnv(): boolean {
  return getOptionalEnv('NEXT_PUBLIC_ENABLE_ADS') === 'true'
}

export function getAdsenseConfig() {
  const client = getAdsenseClient()

  return {
    client,
    enabledByEnv: isAdsEnabledFromEnv(),
    ready: isAdsEnabledFromEnv() && Boolean(client)
  }
}

export function isProduction(): boolean {
  return import.meta.env.PROD === true
}
