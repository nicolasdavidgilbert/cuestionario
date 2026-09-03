import type { APIRoute } from 'astro'
import { neon } from '@neondatabase/serverless'
import { getDatabaseUrl } from '../lib/server/env'

const PUBLIC_ROUTES = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/cursos', priority: '0.9', changefreq: 'weekly' },
  { path: '/prompt', priority: '0.8', changefreq: 'monthly' },
  { path: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
  { path: '/terms', priority: '0.3', changefreq: 'yearly' },
  { path: '/contact', priority: '0.3', changefreq: 'yearly' }
] as const

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function urlEntry(loc: string, priority: string, changefreq: string) {
  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`
}

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site ?? new URL('https://cuestionario.online')
  const entries: string[] = PUBLIC_ROUTES.map((route) =>
    urlEntry(new URL(route.path, baseUrl).toString(), route.priority, route.changefreq)
  )

  try {
    const sql = neon(getDatabaseUrl())
    const rows = await sql`
      SELECT grado, course_id, unidad
      FROM user_quizzes
      WHERE deleted_at IS NULL
        AND grado IS NOT NULL
        AND course_id IS NOT NULL
      GROUP BY grado, course_id, unidad
      ORDER BY grado, course_id, unidad
    `

    const seen = new Set<string>()
    for (const row of rows as { grado: string; course_id: string; unidad: string | null }[]) {
      const g = row.grado
      const c = row.course_id
      if (!g || !c) continue

      const gradoLoc = new URL(`/${g}`, baseUrl).toString()
      if (!seen.has(gradoLoc)) {
        seen.add(gradoLoc)
        entries.push(urlEntry(gradoLoc, '0.7', 'weekly'))
      }

      const unit = (row.unidad || c)
      const quizLoc = new URL(`/${g}/${c}/${unit}`, baseUrl).toString()
      if (!seen.has(quizLoc)) {
        seen.add(quizLoc)
        entries.push(urlEntry(quizLoc, '0.8', 'weekly'))
      }
    }
  } catch (error) {
    console.error('Sitemap DB error:', error)
    return new Response('No se pudo generar el sitemap', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store'
      }
    })
  }

  const urls = entries.join('\n')

  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400'
    }
  })
}
