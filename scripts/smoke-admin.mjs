// Prueba de humo del panel contra un servidor en marcha y una base de datos de DESARROLLO.
// Uso: ADMIN_PASSWORD=... [ADMIN_API_KEY=...] node scripts/smoke-admin.mjs http://localhost:4321
// Crea datos bajo el curso "zz-smoke" y los borra al terminar (borrado directo en SQL: nunca en producción).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { neon } from '@neondatabase/serverless'

const BASE = (process.argv[2] || 'http://localhost:4321').replace(/\/$/, '')
const PASSWORD = process.env.ADMIN_PASSWORD || ''
const API_KEY = process.env.ADMIN_API_KEY || ''
const GRADE = 'zz-smoke'

if (!PASSWORD) {
  console.error('Falta ADMIN_PASSWORD')
  process.exit(1)
}

const envText = await readFile('.env', 'utf8').catch(() => '')
const databaseUrl = process.env.DATABASE_URL || envText.match(/^DATABASE_URL="?([^"\n]*)/m)?.[1]
if (!databaseUrl || /production/i.test(process.env.VERCEL_ENV || '')) {
  console.error('Se necesita DATABASE_URL de desarrollo')
  process.exit(1)
}
const sql = neon(databaseUrl)

let cookie = ''
let csrf = ''
let passed = 0

async function call(method, path, { body, headers = {}, auth = true, origin = BASE } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect: 'manual',
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(origin ? { Origin: origin } : {}),
      ...(auth && cookie ? { Cookie: cookie } : {}),
      ...(auth && csrf && method !== 'GET' ? { 'x-csrf-token': csrf } : {}),
      ...headers
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
  const text = await response.text()
  let json = null
  try { json = JSON.parse(text) } catch { /* no JSON */ }
  return { status: response.status, json, text, headers: response.headers }
}

async function step(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`ok   ${name}`)
  } catch (error) {
    console.log(`FAIL ${name}\n     ${error.message.split('\n').join('\n     ')}`)
    process.exitCode = 1
  }
}

function makeQuiz(topic, seed, overrides = {}) {
  return {
    title: `Smoke ${seed}`,
    description: 'Cuestionario de prueba automática',
    grado: GRADE,
    course_id: 'sm1',
    unidad: topic,
    questions: Array.from({ length: 20 }, (_, index) => ({
      question: `Pregunta ${seed}-${index + 1} marcador-${seed}`,
      options: ['A', 'B', 'C', 'D'],
      answer: index % 4,
      explanation: 'Explicación'
    })),
    ...overrides
  }
}

async function cleanup() {
  await sql`DELETE FROM quiz_reports WHERE quiz_id IN (SELECT id FROM user_quizzes WHERE grado = ${GRADE}) OR title LIKE 'Smoke %'`
  await sql`DELETE FROM user_quizzes WHERE grado = ${GRADE}`
  await sql`DELETE FROM catalog_topics WHERE grade_id = ${GRADE}`
  await sql`DELETE FROM catalog_subjects WHERE grade_id = ${GRADE}`
  await sql`DELETE FROM catalog_grades WHERE id = ${GRADE}`
}

await cleanup()
const ids = {}

await step('sin sesión: la API responde 401 y las páginas redirigen al acceso', async () => {
  assert.equal((await call('GET', '/api/admin/summary', { auth: false })).status, 401)
  const page = await call('GET', '/admin/cuestionarios', { auth: false })
  assert.equal(page.status, 303)
  assert.match(page.headers.get('location') || '', /^\/admin\/login\?next=/)
})

await step('exportación protegida (sin sesión ni clave → 401)', async () => {
  assert.equal((await call('GET', '/api/admin/export', { auth: false })).status, 401)
  assert.equal((await call('GET', '/api/admin/export', { auth: false, headers: { 'x-admin-api-key': 'incorrecta' } })).status, 401)
})

await step('acceso: origen ajeno → 403, contraseña errónea → 401', async () => {
  assert.equal((await call('POST', '/api/admin/login', { auth: false, origin: 'https://evil.example', body: { password: PASSWORD } })).status, 403)
  assert.equal((await call('POST', '/api/admin/login', { auth: false, body: { password: 'incorrecta' } })).status, 401)
})

await step('acceso correcto con cookie HttpOnly y SameSite=Strict', async () => {
  const response = await call('POST', '/api/admin/login', { auth: false, body: { password: PASSWORD } })
  assert.equal(response.status, 200, response.text)
  const setCookie = response.headers.get('set-cookie') || ''
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /SameSite=Strict/i)
  cookie = setCookie.split(';')[0]
  const session = await call('GET', '/api/admin/session')
  assert.equal(session.status, 200)
  csrf = session.json.csrfToken
  assert.ok(csrf)
  assert.equal(session.headers.get('cache-control'), 'no-store')
})

await step('escrituras sin token CSRF → 403', async () => {
  const saved = csrf
  csrf = ''
  const response = await call('POST', '/api/admin/catalog', { body: { level: 'grade', data: { id: GRADE, name: 'x' } } })
  csrf = saved
  assert.equal(response.status, 403)
})

await step('resumen', async () => {
  const response = await call('GET', '/api/admin/summary')
  assert.equal(response.status, 200, response.text)
  assert.equal(typeof response.json.totals.quizzes, 'number')
})

await step('catálogo: crear curso, asignatura y tema; id inválido con error por campo', async () => {
  let response = await call('POST', '/api/admin/catalog', { body: { level: 'grade', data: { id: 'Mal Id', name: '' } } })
  assert.equal(response.status, 400)
  assert.ok(response.json.errors.some((error) => error.field === 'id'))
  assert.ok(response.json.errors.some((error) => error.field === 'name'))
  response = await call('POST', '/api/admin/catalog', { body: { level: 'grade', data: { id: GRADE, name: 'Curso de humo' } } })
  assert.equal(response.status, 200, response.text)
  response = await call('POST', '/api/admin/catalog', { body: { level: 'subject', key: { grade: GRADE }, data: { id: 'sm1', name: 'Asignatura de humo' } } })
  assert.equal(response.status, 200, response.text)
  for (const topic of ['t1', 't2', 't3']) {
    response = await call('POST', '/api/admin/catalog', { body: { level: 'topic', key: { grade: GRADE, subject: 'sm1' }, data: { id: topic, name: `Tema ${topic}` } } })
    assert.equal(response.status, 200, response.text)
  }
  response = await call('POST', '/api/admin/catalog', { body: { level: 'grade', data: { id: GRADE, name: 'Repetido' } } })
  assert.equal(response.status, 409)
})

await step('cuestionario: crear desde el panel y validar límites de preguntas', async () => {
  let response = await call('POST', '/api/admin/quizzes', { body: makeQuiz('t1', 'a', { questions: [] }) })
  assert.equal(response.status, 400)
  response = await call('POST', '/api/admin/quizzes', { body: makeQuiz('t1', 'a') })
  assert.equal(response.status, 201, response.text)
  assert.equal(response.json.version, 1)
  assert.equal(response.json.owner_token, undefined)
  ids.a = response.json.id
})

await step('colisión de ruta y duplicado devuelven 409 sin escribir', async () => {
  let response = await call('POST', '/api/admin/quizzes', { body: makeQuiz('t1', 'b') })
  assert.equal(response.status, 409)
  assert.equal(response.json.code, 'route_collision')
  response = await call('POST', '/api/admin/quizzes', { body: { ...makeQuiz('t1', 'a'), unidad: 't2' } })
  assert.equal(response.status, 201, 'el hash incluye la ruta: misma pregunta en otro tema es válida')
  ids.b = response.json.id
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE grado = ${GRADE}`
  assert.equal(count, 2)
})

await step('edición y detección de guardados concurrentes', async () => {
  let response = await call('PATCH', `/api/admin/quizzes/${ids.a}`, { body: { version: 1, title: 'Smoke a editado' } })
  assert.equal(response.status, 200, response.text)
  assert.equal(response.json.version, 2)
  response = await call('PATCH', `/api/admin/quizzes/${ids.a}`, { body: { version: 1, title: 'Smoke a pisado' } })
  assert.equal(response.status, 409)
  assert.equal(response.json.code, 'version_conflict')
  assert.equal(response.json.current.title, 'Smoke a editado')
  response = await call('PATCH', `/api/admin/quizzes/${ids.a}`, { body: { version: 2, unidad: 't2' } })
  assert.equal(response.status, 409, 'mover a un tema ocupado')
  response = await call('PATCH', `/api/admin/quizzes/${ids.a}`, { body: { title: 'sin versión' } })
  assert.equal(response.status, 428)
})

await step('la edición pública exige propietario y versión', async () => {
  const response = await call('PATCH', `/api/quizzes/${ids.a}`, { auth: false, body: { version: 2, title: 'ajeno' }, headers: { 'x-owner-token': 'otro' } })
  assert.equal(response.status, 401)
})

await step('búsqueda transversal de preguntas', async () => {
  const response = await call('GET', `/api/admin/questions?q=${encodeURIComponent('a-7 marcador-a')}&grade=${GRADE}`)
  assert.equal(response.status, 200, response.text)
  const hit = response.json.items.find((item) => item.quiz_id === ids.a)
  assert.ok(hit)
  assert.equal(hit.question_index, 6)
})

await step('papelera: enviar, restaurar y restauración conflictiva', async () => {
  let response = await call('DELETE', `/api/admin/quizzes/${ids.a}`, { body: {} })
  assert.equal(response.status, 200, response.text)
  response = await call('GET', `/api/admin/quizzes?status=papelera&grade=${GRADE}`)
  assert.ok(response.json.items.some((item) => item.id === ids.a))
  response = await call('POST', `/api/admin/quizzes/${ids.a}/restore`)
  assert.equal(response.status, 200, response.text)
  await call('DELETE', `/api/admin/quizzes/${ids.a}`, { body: {} })
  response = await call('POST', '/api/admin/quizzes', { body: makeQuiz('t1', 'c') })
  assert.equal(response.status, 201, response.text)
  ids.c = response.json.id
  response = await call('POST', `/api/admin/quizzes/${ids.a}/restore`)
  assert.equal(response.status, 409)
  assert.equal(response.json.code, 'route_collision')
  const [row] = await sql`SELECT deleted_at FROM user_quizzes WHERE id = ${ids.a}`
  assert.ok(row.deleted_at, 'sigue en la papelera')
})

await step('catálogo: no se borra con contenido; reasignar y borrar', async () => {
  let response = await call('DELETE', '/api/admin/catalog', { body: { level: 'topic', key: { grade: GRADE, subject: 'sm1', topic: 't1' } } })
  assert.equal(response.status, 409)
  assert.equal(response.json.code, 'in_use')
  response = await call('POST', '/api/admin/catalog/reassign', { body: { level: 'topic', from: { grade: GRADE, subject: 'sm1', topic: 't1' }, to: { grade: GRADE, subject: 'sm1', topic: 't2' } } })
  assert.equal(response.status, 409, 't2 ya tiene uno activo: la reasignación entera se revierte')
  const [{ count }] = await sql`SELECT COUNT(*)::int AS count FROM user_quizzes WHERE grado = ${GRADE} AND unidad = 't1'`
  assert.equal(count, 2)
  response = await call('POST', '/api/admin/catalog/reassign', { body: { level: 'topic', from: { grade: GRADE, subject: 'sm1', topic: 't1' }, to: { grade: GRADE, subject: 'sm1', topic: 't3' }, deleteSource: true } })
  assert.equal(response.status, 200, response.text)
  assert.equal(response.json.moved, 2)
  response = await call('PATCH', '/api/admin/catalog', { body: { level: 'topic', key: { grade: GRADE, subject: 'sm1', topic: 't3' }, data: { name: 'Tema renombrado' } } })
  assert.equal(response.status, 200, response.text)
  response = await call('GET', '/api/admin/catalog')
  const subject = response.json.catalog.grades.find((grade) => grade.id === GRADE).subjects[0]
  assert.deepEqual(subject.topics.map((topic) => topic.id).sort(), ['t2', 't3'])
  assert.equal(subject.topics.find((topic) => topic.id === 't3').name, 'Tema renombrado')
})

await step('incidencias: general, cambios de estado y notas', async () => {
  let response = await call('POST', '/api/admin/issues', { body: { title: 'Smoke incidencia', reason: 'Fallo general de prueba', priority: 'alta' } })
  assert.equal(response.status, 201, response.text)
  const id = response.json.id
  assert.equal(response.json.status, 'pendiente')
  assert.equal(response.json.quiz_id, null)
  response = await call('PATCH', `/api/admin/issues/${id}`, { body: { status: 'en_revision', internal_notes: 'Revisando' } })
  assert.equal(response.json.status, 'en_revision')
  response = await call('PATCH', `/api/admin/issues/${id}`, { body: { status: 'resuelta' } })
  assert.equal(response.json.status, 'resuelta')
  assert.ok(response.json.resolved_at)
  response = await call('PATCH', `/api/admin/issues/${id}`, { body: { status: 'inventado' } })
  assert.equal(response.status, 400)
})

await step('reporte público entra como pendiente y prioridad normal', async () => {
  const response = await call('POST', `/api/quizzes/${ids.b}/report`, { auth: false, body: { reason: 'Smoke reporte público' } })
  assert.equal(response.status, 201, response.text)
  const [row] = await sql`SELECT status, priority, kind FROM quiz_reports WHERE id = ${response.json.id}`
  assert.deepEqual({ ...row }, { status: 'pendiente', priority: 'normal', kind: 'contenido' })
})

await step('exportaciones sin secretos (JSON y CSV) y clave técnica para scripts', async () => {
  const json = await call('GET', '/api/admin/export?type=content')
  assert.equal(json.status, 200)
  assert.equal(json.json.format, 'cuestionarios-export')
  // Se buscan claves JSON (el contenido de las preguntas puede hablar de contraseñas).
  for (const secret of ['owner_token', 'csrf_token', 'password_hash', 'session']) assert.ok(!json.text.includes(`"${secret}"`), `contiene la clave ${secret}`)
  const csv = await call('GET', '/api/admin/export?type=issues')
  assert.match(csv.headers.get('content-type') || '', /text\/csv/)
  if (API_KEY) {
    const viaKey = await call('GET', '/api/admin/export?type=catalog', { auth: false, headers: { 'x-admin-api-key': API_KEY } })
    assert.equal(viaKey.status, 200)
  }
})

await step('importación: vista previa clasifica y la confirmación no escribe errores ni conflictos', async () => {
  const file = JSON.stringify({
    format: 'cuestionarios-export',
    version: 1,
    catalog: { grades: [], subjects: [], topics: [{ grade_id: GRADE, subject_id: 'sm1', id: 't4', name: 'Tema importado' }] },
    quizzes: [
      makeQuiz('t4', 'imp'),
      makeQuiz('t2', 'col'),
      { ...makeQuiz('t5', 'bad'), questions: [{ question: 'x', options: ['a'], answer: 9 }] },
      { ...makeQuiz('t3', 'upd'), id: ids.c, version: 99 }
    ]
  })
  let response = await call('POST', '/api/admin/import', { body: { mode: 'preview', text: file } })
  assert.equal(response.status, 200, response.text)
  assert.deepEqual(response.json.summary, { create: 2, update: 0, unchanged: 0, conflict: 2, error: 1 })
  const stale = await call('POST', '/api/admin/import', { body: { mode: 'commit', text: file, previewId: 'otro' } })
  assert.equal(stale.status, 409)
  response = await call('POST', '/api/admin/import', { body: { mode: 'commit', text: file, previewId: response.json.previewId } })
  assert.equal(response.status, 200, response.text)
  assert.equal(response.json.written, 2)
  const rows = await sql`SELECT unidad FROM user_quizzes WHERE grado = ${GRADE} AND deleted_at IS NULL ORDER BY unidad`
  assert.deepEqual(rows.map((row) => row.unidad), ['t2', 't3', 't4'])
})

await step('auditoría registra entidad, acción y campos', async () => {
  const response = await call('GET', `/api/admin/audit?entity=quiz&id=${ids.a}`)
  assert.equal(response.status, 200)
  const actions = response.json.items.map((item) => item.action)
  for (const action of ['quiz_created', 'quiz_updated', 'quiz_trashed', 'quiz_restored', 'quiz_reassigned']) assert.ok(actions.includes(action), `falta ${action}`)
  const update = response.json.items.find((item) => item.action === 'quiz_updated')
  assert.deepEqual(update.changed_fields, ['title'])
})

await step('cerrar sesión revoca el acceso', async () => {
  assert.equal((await call('POST', '/api/admin/logout', { body: {} })).status, 200)
  assert.equal((await call('GET', '/api/admin/summary')).status, 401)
})

await cleanup()
console.log(`\n${passed} pasos correctos${process.exitCode ? ', con fallos' : ''}`)
