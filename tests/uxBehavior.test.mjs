import assert from 'node:assert/strict'
import test from 'node:test'
import { createPendingDeletion } from '../src/components/pendingDeletion.js'
import { prefersReducedMotion, scrollBehavior } from '../src/lib/motion.ts'

function deletionHarness(remove = async () => {}) {
  const notices = []
  const sent = []
  const leaving = []
  const controller = createPendingDeletion({
    remove: async (id) => { sent.push(id); await remove(id) },
    removeOnLeave: async (id) => { leaving.push(id); await remove(id) },
    onChange: (notice) => notices.push(notice)
  })
  return { controller, notices, sent, leaving }
}

test('undo restores locally without sending a delete, even if expiry later fires', async () => {
  const { controller, notices, sent } = deletionHarness()
  let restored = 0
  controller.schedule(7, () => { restored++ })
  assert.equal(controller.hiddenIds.has(7), true)
  notices[0].onUndo()
  await notices[0].onExpire()
  await controller.leave()
  assert.equal(restored, 1)
  assert.deepEqual(sent, [])
  assert.equal(controller.hiddenIds.size, 0)
})

test('expiry commits once; subsequent lifecycle events do not duplicate deletion', async () => {
  const { controller, notices, sent, leaving } = deletionHarness()
  let completed = 0
  controller.schedule(8, () => assert.fail('must not restore'), () => { completed++ })
  await notices[0].onExpire()
  await controller.leave()
  await controller.commit()
  assert.deepEqual(sent, [8])
  assert.deepEqual(leaving, [])
  assert.equal(completed, 1)
})

test('replacing a toast commits the old deletion and preserves the new undo', async () => {
  const { controller, notices, sent } = deletionHarness()
  let restored = 0
  controller.schedule(1, () => assert.fail('old undo must be inactive'))
  controller.schedule(2, () => { restored++ })
  notices[0].onUndo()
  await notices[0].onExpire()
  notices[1].onUndo()
  await controller.commit()
  assert.deepEqual(sent, [1])
  assert.equal(restored, 1)
})

test('API failure restores the removed item and passes the error', async () => {
  const error = new Error('Sin conexión')
  const { controller } = deletionHarness(async () => { throw error })
  let received
  controller.schedule(3, (failure) => { received = failure })
  await controller.commit()
  assert.equal(received, error)
  assert.equal(controller.hiddenIds.size, 0)
})

test('leaving flushes through the keepalive adapter once', async () => {
  const { controller, sent, leaving } = deletionHarness()
  controller.schedule(4, () => assert.fail('must not restore'))
  await controller.leave()
  await controller.leave()
  assert.deepEqual(sent, [])
  assert.deepEqual(leaving, [4])
})

test('scroll behavior respects reduced motion and works during SSR', () => {
  const original = globalThis.window
  try {
    delete globalThis.window
    assert.equal(prefersReducedMotion(), false)
    assert.equal(scrollBehavior(), 'smooth')
    globalThis.window = { matchMedia: (query) => ({ matches: query === '(prefers-reduced-motion: reduce)' }) }
    assert.equal(prefersReducedMotion(), true)
    assert.equal(scrollBehavior(), 'auto')
    globalThis.window = { matchMedia: () => ({ matches: false }) }
    assert.equal(scrollBehavior(), 'smooth')
    globalThis.window = {}
    assert.equal(scrollBehavior(), 'smooth')
  } finally {
    if (original === undefined) delete globalThis.window
    else globalThis.window = original
  }
})
