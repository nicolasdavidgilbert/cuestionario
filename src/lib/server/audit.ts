import type { NeonQueryFunction } from '@neondatabase/serverless'

export async function logAudit(sql: NeonQueryFunction<false, false>, action: string, details: Record<string, unknown> = {}) {
  try {
    await sql`
      INSERT INTO audit_logs (action, details)
      VALUES (${action}, ${JSON.stringify(details)})
    `
  } catch (error) {
    console.error('audit log failed:', error)
  }
}
