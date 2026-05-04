import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { neon } from '@neondatabase/serverless'

async function loadEnv() {
  const text = await readFile(resolve('.env'), 'utf8').catch(() => '')

  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex === -1) continue

    const key = trimmed.slice(0, separatorIndex).trim()
    const value = trimmed.slice(separatorIndex + 1).trim()
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

function splitStatements(sqlText) {
  return sqlText
    .split(';')
    .map((statement) => statement.trim())
    .filter(Boolean)
}

const file = process.argv[2]

if (!file) {
  console.error('Usage: node scripts/run-sql.mjs <file.sql>')
  process.exit(1)
}

await loadEnv()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const sqlText = await readFile(resolve(file), 'utf8')
const statements = splitStatements(sqlText)

for (const statement of statements) {
  await sql.query(statement)
}

console.log(`Applied ${statements.length} SQL statements from ${file}`)
