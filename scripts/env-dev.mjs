// Genera .env a partir de .env.production.local, apuntando la base de datos a la rama "dev" de Neon.
// Uso: pnpm env:dev  (requiere haber hecho `pnpm env:pull` y `pnpm dlx neon@8.0.10 auth`)
import { readFile, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'

const BRANCH = process.argv[2] || 'dev'

const prodEnv = await readFile('.env.production.local', 'utf8').catch(() => {
  console.error('Falta .env.production.local. Ejecuta primero: pnpm env:pull')
  process.exit(1)
})

const get = (key) => prodEnv.match(new RegExp(`^${key}="?([^"\\n]*)"?`, 'm'))?.[1] || ''

function connectionString(pooled) {
  const args = ['dlx', 'neon@8.0.10', 'connection-string', BRANCH,
    '--project-id', get('NEON_PROJECT_ID'),
    '--database-name', get('PGDATABASE'),
    '--role-name', get('PGUSER')]
  if (pooled) args.push('--pooled')
  const out = execFileSync('pnpm', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] })
  return out.trim().split('\n').pop()
}

const pooledUrl = new URL(connectionString(true))
const directUrl = new URL(connectionString(false))
const prodPooled = new URL(get('DATABASE_URL'))
const prodPassword = decodeURIComponent(prodPooled.password)
const prodEndpoint = prodPooled.hostname.split('.')[0].replace(/-pooler$/, '')
const devEndpoint = directUrl.hostname.split('.')[0]
const devPassword = decodeURIComponent(directUrl.password)

const devEnv = prodEnv
  .split(prodEndpoint).join(devEndpoint)
  .split(prodPassword).join(devPassword)
  .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL="${pooledUrl}"`)
  .replace(/^DATABASE_URL_UNPOOLED=.*$/m, `DATABASE_URL_UNPOOLED="${directUrl}"`)

await writeFile('.env', `# Base de datos: rama Neon '${BRANCH}'. Producción en .env.production.local\n${devEnv}`)
console.log(`.env actualizado: base de datos -> rama Neon '${BRANCH}' (${devEndpoint})`)
