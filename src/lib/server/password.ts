import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// Hash de la contraseña administradora: scrypt:N:r:p:sal:hash (base64url).
// Separado por «:» porque Vite expande «$» al leer .env, incluso entre comillas.
// Se sigue aceptando el formato antiguo con «$».
// Sin dependencias para que lo use también scripts/admin-password.mjs.
const KEY_LENGTH = 64
const DEFAULT_COST = { N: 32768, r: 8, p: 1 }

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N, r, p, maxmem: 128 * N * r * 2 }, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const { N, r, p } = DEFAULT_COST
  const key = await derive(password, salt, N, r, p)
  return ['scrypt', N, r, p, salt.toString('base64url'), key.toString('base64url')].join(':')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = String(stored || '').trim().split(/[:$]/)
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [N, r, p] = parts.slice(1, 4).map(Number)
  if (![N, r, p].every((value) => Number.isInteger(value) && value > 0)) return false

  const salt = Buffer.from(parts[4], 'base64url')
  const expected = Buffer.from(parts[5], 'base64url')
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false

  try {
    const key = await derive(password, salt, N, r, p)
    return timingSafeEqual(key, expected)
  } catch {
    return false
  }
}

export function isPasswordHash(value: string): boolean {
  return /^scrypt([:$])\d+\1\d+\1\d+\1[\w-]+\1[\w-]+$/.test(String(value || '').trim())
}
