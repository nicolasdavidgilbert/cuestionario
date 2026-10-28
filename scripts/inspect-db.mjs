// Informe de solo lectura del esquema real y de inconsistencias del contenido.
// Uso: node scripts/inspect-db.mjs   (lee DATABASE_URL de .env, igual que run-sql.mjs)
// No modifica nada: solo ejecuta SELECT.
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
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^"(.*)"$/, '$1')
    if (key && process.env[key] === undefined) process.env[key] = value
  }
}

await loadEnv()

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required')
  process.exit(1)
}

const sql = neon(process.env.DATABASE_URL)
const host = new URL(process.env.DATABASE_URL).hostname.split('.')[0]

function section(title, rows) {
  console.log(`\n## ${title} (${rows.length})`)
  if (rows.length > 0) console.table(rows)
}

console.log(`# Inspección de ${host} — ${new Date().toISOString()}`)

section('Columnas', await sql`
  SELECT table_name, column_name, data_type, is_nullable, column_default
  FROM information_schema.columns
  WHERE table_schema = 'public'
  ORDER BY table_name, ordinal_position
`)

section('Índices', await sql`
  SELECT tablename, indexname, indexdef
  FROM pg_indexes WHERE schemaname = 'public'
  ORDER BY tablename, indexname
`)

section('Restricciones', await sql`
  SELECT conrelid::regclass::text AS table_name, conname, pg_get_constraintdef(oid) AS definition
  FROM pg_constraint
  WHERE connamespace = 'public'::regnamespace
  ORDER BY 1, 2
`)

section('Totales', await sql`
  SELECT
    (SELECT COUNT(*)::int FROM user_quizzes) AS quizzes,
    (SELECT COUNT(*)::int FROM user_quizzes WHERE deleted_at IS NULL) AS activos,
    (SELECT COUNT(*)::int FROM user_quizzes WHERE deleted_at IS NOT NULL) AS papelera,
    (SELECT COUNT(*)::int FROM quiz_reports) AS reportes,
    (SELECT COUNT(*)::int FROM audit_logs) AS auditoria
`)

section('Slugs sin normalizar (mayúsculas o espacios)', await sql`
  SELECT id, grado, course_id, unidad, deleted_at IS NOT NULL AS en_papelera
  FROM user_quizzes
  WHERE grado <> lower(btrim(grado))
     OR course_id <> lower(btrim(course_id))
     OR COALESCE(unidad, '') <> lower(btrim(COALESCE(unidad, '')))
  ORDER BY id
`)

section('Rutas con más de un cuestionario activo', await sql`
  SELECT grado, course_id, COALESCE(NULLIF(unidad, ''), course_id) AS tema,
    COUNT(*)::int AS activos, array_agg(id ORDER BY id) AS ids
  FROM user_quizzes
  WHERE deleted_at IS NULL
  GROUP BY 1, 2, 3
  HAVING COUNT(*) > 1
  ORDER BY 1, 2, 3
`)

section('quiz_hash nulo o duplicado', await sql`
  SELECT quiz_hash, COUNT(*)::int AS total, array_agg(id ORDER BY id) AS ids,
    array_agg(deleted_at IS NOT NULL ORDER BY id) AS en_papelera
  FROM user_quizzes
  GROUP BY quiz_hash
  HAVING quiz_hash IS NULL OR COUNT(*) > 1
`)

section('Preguntas fuera de los límites de publicación', await sql`
  SELECT id, grado, course_id, unidad, jsonb_array_length(questions) AS preguntas,
    deleted_at IS NOT NULL AS en_papelera
  FROM user_quizzes
  WHERE jsonb_typeof(questions) <> 'array'
     OR jsonb_array_length(questions) NOT BETWEEN 20 AND 50
     OR EXISTS (
       SELECT 1 FROM jsonb_array_elements(questions) q
       WHERE jsonb_typeof(q->'options') <> 'array'
          OR jsonb_array_length(q->'options') <> 4
          OR jsonb_typeof(q->'answer') <> 'number'
          OR (q->>'answer')::numeric NOT IN (0, 1, 2, 3)
          OR btrim(COALESCE(q->>'question', '')) = ''
          OR EXISTS (SELECT 1 FROM jsonb_array_elements(q->'options') o WHERE btrim(o #>> '{}') = '')
     )
  ORDER BY id
`)

section('Combinaciones de catálogo (incluida papelera)', await sql`
  SELECT grado, course_id, COALESCE(NULLIF(unidad, ''), course_id) AS tema,
    COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS activos,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS papelera
  FROM user_quizzes
  GROUP BY 1, 2, 3
  ORDER BY 1, 2, 3
`)

section('Estados de reportes', await sql`
  SELECT COALESCE(status, '(null)') AS status, COUNT(*)::int AS total
  FROM quiz_reports GROUP BY 1 ORDER BY 1
`)

section('Reportes sobre cuestionarios inexistentes', await sql`
  SELECT r.id, r.quiz_id FROM quiz_reports r
  LEFT JOIN user_quizzes q ON q.id = r.quiz_id
  WHERE q.id IS NULL
`)
