import assert from 'node:assert/strict'
import test from 'node:test'
import { hashPassword, isPasswordHash, verifyPassword } from '../src/lib/server/password.ts'
import {
  createSessionToken,
  getSessionCookieName,
  isAdminPath,
  isAdminPublicPath,
  isSameOriginRequest,
  isWriteMethod,
  redactSecrets,
  safeEqual,
  sessionIdFromToken
} from '../src/lib/server/adminSecurity.ts'
import { toCsv } from '../src/lib/server/csv.ts'
import { isSensitiveAdPage } from '../src/lib/ads.ts'

test('password hash verifies the right password only', async () => {
  const hash = await hashPassword('correct horse battery')
  assert.equal(isPasswordHash(hash), true)
  assert.equal(await verifyPassword('correct horse battery', hash), true)
  assert.equal(await verifyPassword('correct horse batterx', hash), false)
})

// Vite expande «$» al leer .env (también entre comillas): el hash no debe contenerlo.
test('new hashes survive .env expansion and old $-separated hashes still verify', async () => {
  const hash = await hashPassword('correct horse battery')
  assert.doesNotMatch(hash, /\$/)
  const legacy = hash.replaceAll(':', '$')
  assert.equal(isPasswordHash(legacy), true)
  assert.equal(await verifyPassword('correct horse battery', legacy), true)
})

test('malformed or empty hashes never verify', async () => {
  assert.equal(await verifyPassword('x', ''), false)
  assert.equal(await verifyPassword('x', 'scrypt$1$1$1$$'), false)
  assert.equal(await verifyPassword('x', 'plain-text-password'), false)
})

test('session ids are keyed hashes of the token, never the token itself', () => {
  const token = createSessionToken()
  const id = sessionIdFromToken(token, 'scrypt:hash-a')
  assert.notEqual(id, token)
  assert.match(id, /^[0-9a-f]{64}$/)
  assert.equal(sessionIdFromToken(token, 'scrypt:hash-a'), id)
})

test('changing the password hash invalidates existing session ids', () => {
  const token = createSessionToken()
  assert.notEqual(sessionIdFromToken(token, 'scrypt:hash-a'), sessionIdFromToken(token, 'scrypt:hash-b'))
})

test('session cookie uses the __Host- prefix only when secure', () => {
  assert.equal(getSessionCookieName(true), '__Host-admin_session')
  assert.equal(getSessionCookieName(false), 'admin_session')
})

test('admin path matching protects pages and APIs except login', () => {
  assert.equal(isAdminPath('/admin'), true)
  assert.equal(isAdminPath('/admin/cuestionarios'), true)
  assert.equal(isAdminPath('/api/admin/export'), true)
  assert.equal(isAdminPath('/administracion'), false)
  assert.equal(isAdminPath('/api/quizzes'), false)
  assert.equal(isAdminPublicPath('/admin/login'), true)
  assert.equal(isAdminPublicPath('/api/admin/login'), true)
  assert.equal(isAdminPublicPath('/api/admin/logout'), false)
})

test('writes require a same-origin request', () => {
  const url = 'https://cuestionario.online/api/admin/quizzes/1'
  assert.equal(isWriteMethod('PATCH'), true)
  assert.equal(isWriteMethod('GET'), false)
  assert.equal(isSameOriginRequest(new Request(url, { headers: { origin: 'https://cuestionario.online' } })), true)
  assert.equal(isSameOriginRequest(new Request(url, { headers: { origin: 'https://evil.example' } })), false)
  assert.equal(isSameOriginRequest(new Request(url, { headers: { 'sec-fetch-site': 'same-origin' } })), true)
  assert.equal(isSameOriginRequest(new Request(url, { headers: { 'sec-fetch-site': 'cross-site' } })), false)
  assert.equal(isSameOriginRequest(new Request(url)), false)
})

test('safeEqual rejects empty and different values', () => {
  assert.equal(safeEqual('abc', 'abc'), true)
  assert.equal(safeEqual('abc', 'abd'), false)
  assert.equal(safeEqual('', ''), false)
})

test('redactSecrets strips owner tokens and credentials at any depth', () => {
  const result = redactSecrets({
    id: 1,
    owner_token: 'secret',
    nested: [{ title: 'ok', csrf_token: 'x', session_id: 'y' }],
    password_hash: 'h'
  })
  assert.deepEqual(result, { id: 1, nested: [{ title: 'ok' }] })
})

test('CSV escapes quotes, separators and formula prefixes', () => {
  const csv = toCsv(
    [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
    [{ a: 'hola, "mundo"', b: '=SUM(1)' }, { a: null, b: 'línea\nnueva' }]
  )
  assert.equal(csv, '﻿A,B\r\n"hola, ""mundo""",\'=SUM(1)\r\n,"línea\nnueva"\r\n')
})

test('admin screens never serve ads', () => {
  assert.equal(isSensitiveAdPage('/admin'), true)
  assert.equal(isSensitiveAdPage('/admin/incidencias'), true)
})
