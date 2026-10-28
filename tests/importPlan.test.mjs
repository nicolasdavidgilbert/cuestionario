import assert from 'node:assert/strict'
import test from 'node:test'
import { parseImportFile, planImport, routeKey, summarizePlan } from '../src/lib/server/importPlan.ts'
import { prepareQuiz } from '../src/lib/server/quizRules.ts'

function quiz(overrides = {}) {
  return {
    title: 'Redes',
    description: '',
    grado: '1asir',
    course_id: 'pni',
    unidad: 'ud1',
    questions: Array.from({ length: 20 }, (_, index) => ({
      question: `Pregunta ${index + 1}`,
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      explanation: ''
    })),
    ...overrides
  }
}

function file(content) {
  return parseImportFile(JSON.stringify({ format: 'cuestionarios-export', version: 1, catalog: {}, ...content }))
}

function state({ quizzes = [], grades = ['1asir'], subjects = ['1asir/pni'], topics = [] } = {}) {
  const result = {
    grades: new Map(grades.map((id) => [id, { id, name: id.toUpperCase(), short: '', description: '', sort_order: 10 }])),
    subjects: new Map(subjects.map((key) => [key, { name: key, description: '', sort_order: 10 }])),
    topics: new Map(topics.map((key) => [key, { name: key, description: '', sort_order: 10 }])),
    quizzes: new Map(),
    activeRoutes: new Map(),
    activeHashes: new Map()
  }
  for (const row of quizzes) {
    const prepared = prepareQuiz(row)
    const stored = { ...prepared, id: row.id, version: row.version ?? 1, deleted_at: row.deleted_at ?? null }
    result.quizzes.set(row.id, stored)
    if (!stored.deleted_at) {
      result.activeRoutes.set(routeKey(stored), row.id)
      result.activeHashes.set(stored.quiz_hash, row.id)
    }
  }
  return result
}

test('rejects files that are not a versioned export', () => {
  assert.throws(() => parseImportFile('no json'), /JSON válido/)
  assert.throws(() => parseImportFile(JSON.stringify({ quizzes: [] })), /format/)
  assert.throws(() => parseImportFile(JSON.stringify({ format: 'cuestionarios-export', version: 2, quizzes: [quiz()] })), /Versión/)
  assert.throws(() => parseImportFile(JSON.stringify({ format: 'cuestionarios-export', version: 1 })), /no contiene registros/)
})

test('classifies new, invalid and colliding quizzes without writing', () => {
  const records = planImport(file({
    quizzes: [
      quiz({ unidad: 'ud2' }),
      quiz({ unidad: 'ud1', title: 'Otro' }),
      quiz({ unidad: 'ud3', questions: [] }),
      quiz({ unidad: 'ud2', title: 'Misma ruta que el primero del archivo' })
    ]
  }), state({ quizzes: [{ id: 7, ...quiz() }] }))

  assert.deepEqual(records.map((record) => record.action), ['create', 'conflict', 'error', 'conflict'])
  assert.match(records[1].messages[0], /ocupada por el n\.º 7/)
  assert.match(records[3].messages[0], /otro registro del archivo/)
})

test('updates need a matching id and version; otherwise they are conflicts', () => {
  const existing = state({ quizzes: [{ id: 7, version: 3, ...quiz() }] })
  const changed = { ...quiz({ title: 'Cambiado' }), id: 7 }

  const [stale] = planImport(file({ quizzes: [{ ...changed, version: 2 }] }), existing)
  assert.equal(stale.action, 'conflict')
  assert.match(stale.messages[0], /modificado desde la exportación/)

  const [update] = planImport(file({ quizzes: [{ ...changed, version: 3 }] }), existing)
  assert.equal(update.action, 'update')
  assert.equal(update.targetId, 7)
  assert.equal(update.expectedVersion, 3)

  const [same] = planImport(file({ quizzes: [{ ...quiz(), id: 7, version: 3 }] }), existing)
  assert.equal(same.action, 'unchanged')
})

test('unknown ids are created as new records and trashed quizzes cannot be overwritten', () => {
  const existing = state({ quizzes: [{ id: 7, ...quiz(), deleted_at: '2026-01-01T00:00:00Z' }] })
  const [created, trashed] = planImport(file({ quizzes: [{ ...quiz({ unidad: 'ud5' }), id: 99 }, { ...quiz({ title: 'x' }), id: 7, version: 1 }] }), existing)
  assert.equal(created.action, 'create')
  assert.match(created.messages[0], /ID nuevo/)
  assert.equal(trashed.action, 'conflict')
  assert.match(trashed.messages[0], /papelera/)
})

test('catalog records validate ids and parents', () => {
  const records = planImport(file({
    catalog: {
      grades: [{ id: '1asir', name: '1.º ASIR renombrado' }, { id: 'Mal ID', name: 'x' }],
      subjects: [{ grade_id: '2daw', id: 'pro', name: 'Programación' }],
      topics: [{ grade_id: '1asir', subject_id: 'pni', id: 'ud9', name: 'Tema 9' }]
    }
  }), state())

  assert.deepEqual(records.map((record) => [record.kind, record.action]), [
    ['grade', 'update'],
    ['grade', 'error'],
    ['subject', 'error'],
    ['topic', 'create']
  ])
  assert.deepEqual(summarizePlan(records), { create: 1, update: 1, unchanged: 0, conflict: 0, error: 2 })
})
