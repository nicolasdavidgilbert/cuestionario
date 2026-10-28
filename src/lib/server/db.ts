import { neon, Pool } from '@neondatabase/serverless'
import { getDatabaseUrl } from './env'

// Interfaz común para consultas fuera y dentro de una transacción: los servicios reciben
// un Db y no necesitan saber si van por HTTP (lecturas) o por una conexión con BEGIN/COMMIT.
export interface Db {
  query<T = Record<string, any>>(text: string, params?: unknown[]): Promise<T[]>
}

export function getSql() {
  return neon(getDatabaseUrl())
}

export function getDb(): Db {
  const sql = getSql()
  return {
    query: async <T>(text: string, params: unknown[] = []) => (await sql.query(text, params)) as T[]
  }
}

// Ejecuta fn dentro de una transacción. Cualquier error (incluida la auditoría) revierte todo.
export async function withTransaction<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const pool = new Pool({ connectionString: getDatabaseUrl() })
  const client = await pool.connect()
  const db: Db = {
    query: async <R>(text: string, params: unknown[] = []) => (await client.query(text, params)).rows as R[]
  }

  try {
    await client.query('BEGIN')
    const result = await fn(db)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    client.release()
    await pool.end().catch(() => {})
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const code = (error as { code?: string })?.code
  if (code !== '23505') return false
  return !constraint || (error as { constraint?: string }).constraint === constraint
}
