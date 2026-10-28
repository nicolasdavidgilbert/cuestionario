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
    // env-dev.mjs escribe los valores entre comillas dobles
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

// Divide por ';' fuera de comillas simples y comentarios '--', para que los textos del seed puedan contener ';'.
function splitStatements(sqlText) {
  const statements = []
  let current = ''
  let inString = false
  let inComment = false

  for (let index = 0; index < sqlText.length; index += 1) {
    const char = sqlText[index]

    if (inComment) {
      if (char === '\n') inComment = false
      current += char
      continue
    }
    if (!inString && char === '-' && sqlText[index + 1] === '-') inComment = true
    if (char === "'") inString = !inString

    if (char === ';' && !inString && !inComment) {
      statements.push(current)
      current = ''
    } else {
      current += char
    }
  }
  statements.push(current)

  // Descarta trozos que solo contienen comentarios o espacios.
  return statements
    .map((statement) => statement.trim())
    .filter((statement) => statement.replace(/--.*$/gm, '').trim())
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
