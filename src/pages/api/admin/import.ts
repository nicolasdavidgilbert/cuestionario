import { adminRoute } from '../../../lib/server/adminRoute'
import { readJsonBody } from '../../../lib/server/http'
import { commitImport, previewImport } from '../../../lib/server/transferService'

export const prerender = false

// { mode: 'preview', text } → clasificación sin escribir
// { mode: 'commit', text, previewId, confirmUpdates: [ref] } → escritura por lotes atómicos de 100
export const POST = adminRoute('Error al importar', async ({ request }) => {
  const body = await readJsonBody(request)
  if (body.mode === 'commit') return commitImport({ text: body.text, previewId: body.previewId, confirmUpdates: body.confirmUpdates })
  return previewImport(body.text)
})
