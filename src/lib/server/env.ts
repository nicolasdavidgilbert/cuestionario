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

export function isProduction(): boolean {
  return import.meta.env.PROD === true
}
