// Permite que los tests importen módulos TS de src/ con importaciones sin extensión (estilo Vite).
import { register } from 'node:module'

register('./resolve-ts.mjs', import.meta.url)
