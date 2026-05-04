import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import ts from 'typescript'

async function importTypeScript(path) {
  const source = await readFile(path, 'utf8')
  const limitsSource = await readFile(new URL('../src/lib/quizLimits.ts', import.meta.url), 'utf8')
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022
    }
  }).outputText.replace(
    "import { QUIZ_LIMITS } from './quizLimits';",
    ts.transpileModule(limitsSource, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2022
      }
    }).outputText.replace('export const QUIZ_LIMITS', 'const QUIZ_LIMITS')
  )
  return import(`data:text/javascript;base64,${Buffer.from(output).toString('base64')}`)
}

const { validateQuizJson } = await importTypeScript(new URL('../src/lib/quizValidator.ts', import.meta.url))

function makeValidQuiz(overrides = {}) {
  return {
    title: 'Redes',
    description: 'Preguntas de redes',
    grado: '1asir',
    course_id: 'pni',
    unidad: 'ud1',
    questions: Array.from({ length: 20 }, (_, index) => ({
      question: `Pregunta ${index + 1}`,
      options: ['A', 'B', 'C', 'D'],
      answer: 0,
      explanation: 'Porque A es correcta'
    })),
    ...overrides
  }
}

test('accepts a valid quiz', () => {
  const result = validateQuizJson(makeValidQuiz())
  assert.equal(result.valid, true)
  assert.equal(result.data.questions.length, 20)
})

test('rejects non-integer answer indexes', () => {
  const quiz = makeValidQuiz()
  quiz.questions[0].answer = 1.5

  const result = validateQuizJson(quiz)
  assert.equal(result.valid, false)
  assert.match(result.errors[0].message, /entero/)
})

test('rejects quizzes outside the supported question range', () => {
  const result = validateQuizJson(makeValidQuiz({ questions: [] }))
  assert.equal(result.valid, false)
  assert.equal(result.errors[0].field, 'questions')
})

test('rejects oversized title and question content', () => {
  const quiz = makeValidQuiz({ title: 'x'.repeat(101) })
  quiz.questions[0].question = 'x'.repeat(501)

  const result = validateQuizJson(quiz)
  assert.equal(result.valid, false)
  assert.equal(result.errors.some((error) => error.field === 'title'), true)
  assert.equal(result.errors.some((error) => error.field === 'questions[0].question'), true)
})
