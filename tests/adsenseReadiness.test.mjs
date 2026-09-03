import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const readProjectFile = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8')

test('publishes the expected Google AdSense seller record', async () => {
  const adsTxt = await readProjectFile('public/ads.txt')
  const sellerRecords = adsTxt
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))

  assert.deepEqual(sellerRecords, [
    'google.com, pub-2941574848925726, DIRECT, f08c47fec0942fa0'
  ])
})

test('keeps public pages crawlable and advertises the sitemap', async () => {
  const robots = await readProjectFile('public/robots.txt')

  assert.match(robots, /^User-agent: \*$/m)
  assert.match(robots, /^Allow: \/$/m)
  assert.match(robots, /^Sitemap: https:\/\/cuestionario\.online\/sitemap\.xml$/m)
  assert.doesNotMatch(robots, /^Disallow: \/privacy-policy$/m)
  assert.doesNotMatch(robots, /^Disallow: \/terms$/m)
  assert.doesNotMatch(robots, /^Disallow: \/contact$/m)
})

test('links every trust page from the shared layout', async () => {
  const layout = await readProjectFile('src/layouts/Layout.astro')

  assert.match(layout, /href="\/privacy-policy"/)
  assert.match(layout, /href="\/terms"/)
  assert.match(layout, /href="\/contact"/)
  assert.match(layout, /rel="canonical"/)
  assert.match(layout, /name="description"/)
})

test('privacy policy contains the AdSense cookie disclosures and opt-out links', async () => {
  const privacy = await readProjectFile('src/pages/privacy-policy.astro')

  assert.match(privacy, /Google y otros proveedores externos pueden usar cookies/)
  assert.match(privacy, /adssettings\.google\.com/)
  assert.match(privacy, /policies\.google\.com\/technologies\/partner-sites/)
  assert.match(privacy, /aboutads\.info\/choices/)
})

test('dynamic public routes prevent soft-404 indexing', async () => {
  const gradePage = await readProjectFile('src/pages/[grado].astro')
  const quizPage = await readProjectFile('src/pages/[grado]/[curso]/[unidad].astro')

  for (const page of [gradePage, quizPage]) {
    assert.match(page, /Astro\.response\.status = 404/)
    assert.match(page, /Astro\.response\.status = 503/)
    assert.match(page, /'noindex, nofollow'/)
  }

  assert.match(quizPage, /unidad IS NULL OR unidad = ''/)
})

test('new quizzes cannot silently collide on the same public URL', async () => {
  const quizzesApi = await readProjectFile('src/pages/api/quizzes.ts')

  assert.match(quizzesApi, /routeCollisionRows/)
  assert.match(quizzesApi, /Ya existe un cuestionario publicado para ese grado, asignatura y unidad/)
})

test('sitemap includes database-backed public quiz routes and fails closed', async () => {
  const sitemap = await readProjectFile('src/pages/sitemap.xml.ts')

  assert.match(sitemap, /FROM user_quizzes/)
  assert.match(sitemap, /entries\.push\(urlEntry\(quizLoc/)
  assert.match(sitemap, /status: 503/)
  assert.doesNotMatch(sitemap, /<lastmod>/)
})
