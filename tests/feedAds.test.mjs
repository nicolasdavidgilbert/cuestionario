import assert from 'node:assert/strict'
import test from 'node:test'
import { getFeedAdPositions } from '../src/lib/feedAds.ts'

const positions = (total) => [...getFeedAdPositions(total)]

test('no feed ads in empty or single-item lists', () => {
  assert.deepEqual(positions(0), [])
  assert.deepEqual(positions(1), [])
})

test('short lists get a single ad at the end', () => {
  assert.deepEqual(positions(2), [1])
  assert.deepEqual(positions(3), [2])
})

test('long lists get an ad after the third card, then every eight, max three', () => {
  assert.deepEqual(positions(4), [2])
  assert.deepEqual(positions(11), [2])
  assert.deepEqual(positions(12), [2, 10])
  assert.deepEqual(positions(100), [2, 10, 18])
})
